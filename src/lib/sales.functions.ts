import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client, fail } from "./db";

export type SaleItemDTO = {
  id: number;
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type SaleDTO = {
  id: number;
  receiptNo: string;
  customerId: number | null;
  customerName: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  note: string;
  soldAt: string;
  itemCount: number;
};

export const PAYMENT_METHODS = ["cash", "card", "bkash", "nagad"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bkash: "bKash",
  nagad: "Nagad",
};

export const saleInputSchema = z.object({
  customerId: z.number().int().positive().nullable().optional(),
  discount: z.number().min(0).max(1_000_000).default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  note: z.string().trim().max(300).default(""),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(100_000),
      }),
    )
    .min(1, "Add at least one item to the sale."),
});

export const receiptNo = (id: number) => `R-${String(id).padStart(6, "0")}`;

export const createSale = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saleInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ id: number; receiptNo: string }> => {
    const db = client();
    const ids = [...new Set(data.items.map((i) => i.productId))];
    const { data: rows, error } = await db.from("products").select("*").in("id", ids);
    fail(error);
    const byId = new Map((rows ?? []).map((r) => [r.id, r]));

    const lines = data.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) throw new Error("A product in the cart no longer exists.");
      if (product.quantity < item.quantity) {
        throw new Error(`Not enough stock: ${product.name} has ${product.quantity} on hand.`);
      }
      const unitPrice = Number(product.unit_price);
      return { product, quantity: item.quantity, unitPrice, total: unitPrice * item.quantity };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
    const discount = Math.min(data.discount, subtotal);
    const total = subtotal - discount;

    const { data: sale, error: saleError } = await db
      .from("sales")
      .insert({
        customer_id: data.customerId ?? null,
        subtotal,
        discount,
        total,
        payment_method: data.paymentMethod,
        note: data.note,
      })
      .select("id")
      .single();
    fail(saleError);
    if (!sale) throw new Error("Sale could not be recorded.");

    const { error: itemsError } = await db.from("sale_items").insert(
      lines.map((l) => ({
        sale_id: sale.id,
        product_id: l.product.id,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        total: l.total,
      })),
    );
    fail(itemsError);

    for (const l of lines) {
      const { error: updateError } = await db
        .from("products")
        .update({
          quantity: l.product.quantity - l.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", l.product.id);
      fail(updateError);
      const { error: movementError } = await db.from("stock_movements").insert({
        product_id: l.product.id,
        change: -l.quantity,
        reason: `Sale ${receiptNo(sale.id)}`,
      });
      fail(movementError);
    }

    return { id: sale.id, receiptNo: receiptNo(sale.id) };
  });

export const getSales = createServerFn({ method: "GET" })
  .inputValidator((input: { customerId?: number } | undefined) => input ?? {})
  .handler(async ({ data }): Promise<SaleDTO[]> => {
    const db = client();
    let query = db
      .from("sales")
      .select("*, customer:customers(name), sale_items(count)")
      .order("sold_at", { ascending: false })
      .limit(200);
    if (data?.customerId) query = query.eq("customer_id", data.customerId);
    const { data: rows, error } = await query;
    fail(error);
    return (rows ?? []).map((row) => ({
      id: row.id,
      receiptNo: receiptNo(row.id),
      customerId: row.customer_id,
      customerName: row.customer?.name ?? null,
      subtotal: Number(row.subtotal),
      discount: Number(row.discount),
      total: Number(row.total),
      paymentMethod: row.payment_method,
      note: row.note,
      soldAt: row.sold_at,
      itemCount: Number((row.sale_items as { count: number }[] | null)?.[0]?.count ?? 0),
    }));
  });

export const getSale = createServerFn({ method: "GET" })
  .inputValidator((input: { id: number }) => input)
  .handler(
    async ({ data }): Promise<SaleDTO & { items: SaleItemDTO[] }> => {
      const db = client();
      const { data: row, error } = await db
        .from("sales")
        .select("*, customer:customers(name), sale_items(*, product:products(name, sku))")
        .eq("id", data.id)
        .maybeSingle();
      fail(error);
      if (!row) throw new Error("Sale not found.");
      const items = (row.sale_items ?? []) as Array<{
        id: number;
        product_id: number;
        quantity: number;
        unit_price: number;
        total: number;
        product: { name: string; sku: string } | null;
      }>;
      return {
        id: row.id,
        receiptNo: receiptNo(row.id),
        customerId: row.customer_id,
        customerName: row.customer?.name ?? null,
        subtotal: Number(row.subtotal),
        discount: Number(row.discount),
        total: Number(row.total),
        paymentMethod: row.payment_method,
        note: row.note,
        soldAt: row.sold_at,
        itemCount: items.length,
        items: items.map((item) => ({
          id: item.id,
          productId: item.product_id,
          name: item.product?.name ?? "Unknown product",
          sku: item.product?.sku ?? "",
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          total: Number(item.total),
        })),
      };
    },
  );
