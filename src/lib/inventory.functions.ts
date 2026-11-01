import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export type ProductDTO = {
  id: number;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  updatedAt: string;
};

export type MovementDTO = {
  id: number;
  change: number;
  reason: string;
  createdAt: string;
};

export type InventorySummary = {
  totalProducts: number;
  totalUnits: number;
  stockValue: number;
  lowStock: number;
};

export type InventoryData = {
  products: ProductDTO[];
  summary: InventorySummary;
};

// Public, single-tenant inventory tool (the source app shipped with no auth).
// All access goes through the publishable client; anon policies in the
// migration govern the data.
function client(): SupabaseClient<Database> {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

function toProduct(row: ProductRow): ProductDTO {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    reorderLevel: row.reorder_level,
    unitPrice: Number(row.unit_price),
    updatedAt: row.updated_at,
  };
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export const productInputSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.string().trim().max(60).default("General"),
  quantity: z.number().int().min(0).max(2_147_483_647).default(0),
  reorderLevel: z.number().int().min(0).default(5),
  unitPrice: z.number().min(0).max(1_000_000),
});

export const productUpdateSchema = productInputSchema.omit({ quantity: true });

export const getInventory = createServerFn({ method: "GET" })
  .inputValidator((input: { search?: string }) => input)
  .handler(async ({ data }): Promise<InventoryData> => {
    const db = client();
    let query = db.from("products").select("*").order("name", { ascending: true });
    const search = (data?.search ?? "").trim();
    if (search) {
      // PostgREST .or() splits on commas; keep the pattern safe.
      const term = search.replace(/[%,]/g, "").trim();
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,sku.ilike.%${term}%,category.ilike.%${term}%`,
        );
      }
    }
    const { data: rows, error } = await query;
    fail(error);
    const products = (rows ?? []).map(toProduct);
    return {
      products,
      summary: {
        totalProducts: products.length,
        totalUnits: products.reduce((sum, p) => sum + p.quantity, 0),
        stockValue: products.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0),
        lowStock: products.filter((p) => p.quantity <= p.reorderLevel).length,
      },
    };
  });

export const createProduct = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => productInputSchema.parse(input))
  .handler(async ({ data }): Promise<ProductDTO> => {
    const db = client();
    const { data: existing, error: existingError } = await db
      .from("products")
      .select("id")
      .eq("sku", data.sku)
      .maybeSingle();
    fail(existingError);
    if (existing) throw new Error(`SKU '${data.sku}' already exists.`);
    const { data: rows, error } = await db
      .from("products")
      .insert({
        sku: data.sku,
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        reorder_level: data.reorderLevel,
        unit_price: data.unitPrice,
      })
      .select("*")
      .single();
    fail(error);
    if (data.quantity > 0) {
      const { error: movementError } = await db
        .from("stock_movements")
        .insert({ product_id: rows.id, change: data.quantity, reason: "Initial stock" });
      fail(movementError);
    }
    return toProduct(rows);
  });

export const updateProduct = createServerFn({ method: "POST" })
  .inputValidator(
    (input: unknown) =>
      z.object({ id: z.number().int().positive(), product: productUpdateSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<ProductDTO> => {
    const db = client();
    const { data: existing, error: existingError } = await db
      .from("products")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    fail(existingError);
    if (!existing) throw new Error("Product not found.");
    const { data: skuClash, error: skuError } = await db
      .from("products")
      .select("id")
      .eq("sku", data.product.sku)
      .neq("id", data.id)
      .maybeSingle();
    fail(skuError);
    if (skuClash) throw new Error(`SKU '${data.product.sku}' already exists.`);
    const { data: rows, error } = await db
      .from("products")
      .update({
        sku: data.product.sku,
        name: data.product.name,
        category: data.product.category,
        reorder_level: data.product.reorderLevel,
        unit_price: data.product.unitPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    fail(error);
    return toProduct(rows);
  });

export const adjustStock = createServerFn({ method: "POST" })
  .inputValidator(
    (input: unknown) =>
      z
        .object({
          id: z.number().int().positive(),
          change: z.number().int().refine((n) => n !== 0, "Change must be non-zero"),
          reason: z.string().trim().max(200).default("Manual adjustment"),
        })
        .parse(input),
  )
  .handler(async ({ data }): Promise<ProductDTO> => {
    const db = client();
    const { data: rows, error } = await db
      .from("products")
      .select("*")
      .eq("id", data.id)
      .single();
    fail(error);
    if (!rows) throw new Error("Product not found.");
    if (rows.quantity + data.change < 0) {
      throw new Error(`Not enough stock: ${rows.name} has ${rows.quantity} on hand.`);
    }
    const { data: updated, error: updateError } = await db
      .from("products")
      .update({
        quantity: rows.quantity + data.change,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    fail(updateError);
    const { error: movementError } = await db.from("stock_movements").insert({
      product_id: data.id,
      change: data.change,
      reason: data.reason,
    });
    fail(movementError);
    return toProduct(updated);
  });

export const getMovements = createServerFn({ method: "GET" })
  .inputValidator((input: { id: number }) => input)
  .handler(async ({ data }): Promise<MovementDTO[]> => {
    const db = client();
    const { data: rows, error } = await db
      .from("stock_movements")
      .select("*")
      .eq("product_id", data.id)
      .order("created_at", { ascending: false })
      .limit(50);
    fail(error);
    return (rows ?? []).map((m) => ({
      id: m.id,
      change: m.change,
      reason: m.reason,
      createdAt: m.created_at,
    }));
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number }) => input)
  .handler(async ({ data }): Promise<void> => {
    const db = client();
    const { error } = await db.from("products").delete().eq("id", data.id);
    fail(error);
  });
