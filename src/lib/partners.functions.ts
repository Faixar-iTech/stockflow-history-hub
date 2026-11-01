import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client, fail } from "./db";

export type CustomerDTO = {
  id: number;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
  salesCount: number;
};

export type SupplierDTO = {
  id: number;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
  purchaseCount: number;
};

const partnerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(200).default(""),
});

export const customerInputSchema = partnerSchema;
export const supplierInputSchema = partnerSchema;

export const getCustomers = createServerFn({ method: "GET" }).handler(
  async (): Promise<CustomerDTO[]> => {
    const db = client();
    const { data: rows, error } = await db
      .from("customers")
      .select("*, sales(count)")
      .order("name", { ascending: true });
    fail(error);
    return (rows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      createdAt: row.created_at,
      salesCount: Number((row.sales as { count: number }[] | null)?.[0]?.count ?? 0),
    }));
  },
);

export const createCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => customerInputSchema.parse(input))
  .handler(async ({ data }): Promise<CustomerDTO> => {
    const db = client();
    const { data: rows, error } = await db
      .from("customers")
      .insert({ name: data.name, phone: data.phone, address: data.address })
      .select("*")
      .single();
    fail(error);
    if (!rows) throw new Error("Customer could not be created.");
    return {
      id: rows.id,
      name: rows.name,
      phone: rows.phone,
      address: rows.address,
      createdAt: rows.created_at,
      salesCount: 0,
    };
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.number().int().positive(), customer: partnerSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<void> => {
    const db = client();
    const { error } = await db
      .from("customers")
      .update({ name: data.customer.name, phone: data.customer.phone, address: data.customer.address })
      .eq("id", data.id);
    fail(error);
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number }) => input)
  .handler(async ({ data }): Promise<void> => {
    const db = client();
    const { error } = await db.from("customers").delete().eq("id", data.id);
    fail(error);
  });

export const getSuppliers = createServerFn({ method: "GET" }).handler(
  async (): Promise<SupplierDTO[]> => {
    const db = client();
    const { data: rows, error } = await db
      .from("suppliers")
      .select("*, purchases(count)")
      .order("name", { ascending: true });
    fail(error);
    return (rows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      createdAt: row.created_at,
      purchaseCount: Number((row.purchases as { count: number }[] | null)?.[0]?.count ?? 0),
    }));
  },
);

export const createSupplier = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => supplierInputSchema.parse(input))
  .handler(async ({ data }): Promise<SupplierDTO> => {
    const db = client();
    const { data: rows, error } = await db
      .from("suppliers")
      .insert({ name: data.name, phone: data.phone, address: data.address })
      .select("*")
      .single();
    fail(error);
    if (!rows) throw new Error("Supplier could not be created.");
    return {
      id: rows.id,
      name: rows.name,
      phone: rows.phone,
      address: rows.address,
      createdAt: rows.created_at,
      purchaseCount: 0,
    };
  });

export const updateSupplier = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.number().int().positive(), supplier: partnerSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<void> => {
    const db = client();
    const { error } = await db
      .from("suppliers")
      .update({ name: data.supplier.name, phone: data.supplier.phone, address: data.supplier.address })
      .eq("id", data.id);
    fail(error);
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number }) => input)
  .handler(async ({ data }): Promise<void> => {
    const db = client();
    const { error } = await db.from("suppliers").delete().eq("id", data.id);
    fail(error);
  });
