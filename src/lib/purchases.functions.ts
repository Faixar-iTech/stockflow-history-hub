import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client, fail } from "./db";

export type PurchaseItemDTO = {
  id: number;
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  unitCost: number;
  total: number;
};

export type PurchaseDTO = {
  id: number;
  supplierId: number | null;
  supplierName: string | null;
  invoiceNo: string;
  total: number;
  note: string;
  purchasedAt: string;
  itemCount: number;
};

export const purchaseInputSchema = z.object({
  supplierId: z.number().int().positive().nullable().optional(),
  invoiceNo: z.string().trim().max(60).default(""),
  note: z.string().trim().max(300).default(""),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(1_000_000),
        unitCost: z.number().min(0).max(10_000_000),
      }),
    )
    .min(1, "Add at least one item to the purchase."),
});

export const createPurchase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => purchaseInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ id: number }> => {
    const db = client();
    const ids = [...new Set(data.items.map((i) => i.productId))];
    const { data: rows, error } = await db.from("products").select("*").in("id", ids);
    fail(error);
    const byId = new Map((rows ?? []).map((r) => [r.id, r]));

    const lines = data.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) throw new Error("A product in this purchase no longer exists.");
      const unitCost = item.unitCost;
      return { product, quantity: item.quantity, unitCost, total: unitCost * item.quantity };
    });

    const total = lines.reduce((sum, l) => sum + l.total, 0);

    const { data: purchase, error: purchaseError } = await db
      .from("purchases")
      .insert({
        supplier_id: data.supplierId ?? null,
        invoice_no: data.invoiceNo,
        total,
        note: data.note,
      })
      .select("id")
      .single();
    fail(purchaseError);
    if (!purchase) throw new Error("Purchase could not be recorded.");

    const { error: itemsError } = await db.from("purchase_items").insert(
      lines.map((l) => ({
        purchase_id: purchase.id,
        product_id: l.product.id,
        quantity: l.quantity,
        unit_cost: l.unitCost,
        total: l.total,
      })),
    );
    fail(itemsError);

    for (const l of lines) {
      const { error: updateError } = await db
        .from("products")
        .update({
          quantity: l.product.quantity + l.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", l.product.id);
      fail(updateError);
      const { error: movementError } = await db.from("stock_movements").insert({
        product_id: l.product.id,
        change: l.quantity,
        reason: data.invoiceNo
          ? `Purchase (invoice ${data.invoiceNo})`
          : "Purchase",
      });
      fail(movementError);
    }

    return { id: purchase.id };
  });

export const getPurchases = createServerFn({ method: "GET" }).handler(
  async (): Promise<PurchaseDTO[]> => {
    const db = client();
    const { data: rows, error } = await db
      .from("purchases")
      .select("*, supplier:suppliers(name), purchase_items(count)")
      .order("purchased_at", { ascending: false })
      .limit(200);
    fail(error);
    return (rows ?? []).map((row) => ({
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier?.name ?? null,
      invoiceNo: row.invoice_no,
      total: Number(row.total),
      note: row.note,
      purchasedAt: row.purchased_at,
      itemCount: Number((row.purchase_items as { count: number }[] | null)?.[0]?.count ?? 0),
    }));
  },
);

export const getPurchase = createServerFn({ method: "GET" })
  .inputValidator((input: { id: number }) => input)
  .handler(async ({ data }): Promise<PurchaseDTO & { items: PurchaseItemDTO[] }> => {
    const db = client();
    const { data: row, error } = await db
      .from("purchases")
      .select("*, supplier:suppliers(name), purchase_items(*, product:products(name, sku))")
      .eq("id", data.id)
      .maybeSingle();
    fail(error);
    if (!row) throw new Error("Purchase not found.");
    const items = (row.purchase_items ?? []) as Array<{
      id: number;
      product_id: number;
      quantity: number;
      unit_cost: number;
      total: number;
      product: { name: string; sku: string } | null;
    }>;
    return {
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier?.name ?? null,
      invoiceNo: row.invoice_no,
      total: Number(row.total),
      note: row.note,
      purchasedAt: row.purchased_at,
      itemCount: items.length,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        name: item.product?.name ?? "Unknown product",
        sku: item.product?.sku ?? "",
        quantity: item.quantity,
        unitCost: Number(item.unit_cost),
        total: Number(item.total),
      })),
    };
  });
