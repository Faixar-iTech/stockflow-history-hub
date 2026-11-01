import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client, fail } from "./db";

export type ShopSettings = {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  receiptNote: string;
};

export const settingsSchema = z.object({
  shopName: z.string().trim().min(1, "Shop name is required").max(80),
  shopAddress: z.string().trim().max(200).default(""),
  shopPhone: z.string().trim().max(40).default(""),
  receiptNote: z.string().trim().max(200).default(""),
});

export const getSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShopSettings> => {
    const db = client();
    const { data, error } = await db.from("app_settings").select("*").eq("id", 1).maybeSingle();
    fail(error);
    if (!data) {
      return { shopName: "My Shop", shopAddress: "", shopPhone: "", receiptNote: "" };
    }
    return {
      shopName: data.shop_name,
      shopAddress: data.shop_address,
      shopPhone: data.shop_phone,
      receiptNote: data.receipt_note,
    };
  },
);

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data }): Promise<void> => {
    const db = client();
    const { error } = await db.from("app_settings").upsert({
      id: 1,
      shop_name: data.shopName,
      shop_address: data.shopAddress,
      shop_phone: data.shopPhone,
      receipt_note: data.receiptNote,
      updated_at: new Date().toISOString(),
    });
    fail(error);
  });
