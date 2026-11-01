import { createServerFn } from "@tanstack/react-start";
import { client, fail } from "./db";
import { receiptNo, type SaleDTO } from "./sales.functions";

export type DashboardDTO = {
  todayTotal: number;
  todayCount: number;
  monthTotal: number;
  stockValue: number;
  totalProducts: number;
  totalUnits: number;
  lowStock: { id: number; name: string; quantity: number; reorderLevel: number }[];
  topProducts: { name: string; quantity: number; total: number }[];
  recentSales: SaleDTO[];
};

// Shop operates on Bangladesh time.
const dhakaDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(iso));

export const getDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardDTO> => {
    const db = client();
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const [productsRes, salesRes] = await Promise.all([
      db.from("products").select("*").order("name", { ascending: true }),
      db
        .from("sales")
        .select("*, customer:customers(name)")
        .gte("sold_at", since)
        .order("sold_at", { ascending: false })
        .limit(500),
    ]);
    fail(productsRes.error);
    fail(salesRes.error);
    const products = productsRes.data ?? [];
    const sales = salesRes.data ?? [];

    let items: Array<{
      quantity: number;
      unit_price: number;
      total: number;
      sale_id: number;
      product: { name: string } | null;
    }> = [];
    const ids = sales.map((s) => s.id);
    if (ids.length) {
      const itemsRes = await db
        .from("sale_items")
        .select("quantity, unit_price, total, sale_id, product:products(name)")
        .in("sale_id", ids)
        .limit(2000);
      fail(itemsRes.error);
      items = (itemsRes.data ?? []) as typeof items;
    }

    const todayKey = dhakaDay(new Date().toISOString());
    const monthKey = todayKey.slice(0, 7);
    const todaySales = sales.filter((s) => dhakaDay(s.sold_at) === todayKey);
    const monthSales = sales.filter((s) => dhakaDay(s.sold_at).slice(0, 7) === monthKey);

    const cutoff = dhakaDay(new Date(Date.now() - 30 * 86_400_000).toISOString());
    const saleDay = new Map(sales.map((s) => [s.id, dhakaDay(s.sold_at)] as const));
    const productTotals = new Map<string, { name: string; quantity: number; total: number }>();
    for (const item of items) {
      const day = saleDay.get(item.sale_id);
      if (!day || day < cutoff) continue;
      const name = item.product?.name ?? "Unknown";
      const entry = productTotals.get(name) ?? { name, quantity: 0, total: 0 };
      entry.quantity += item.quantity;
      entry.total += Number(item.total);
      productTotals.set(name, entry);
    }

    const toSale = (row: (typeof sales)[number]): SaleDTO => ({
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
      itemCount: 0,
    });

    return {
      todayTotal: todaySales.reduce((sum, s) => sum + Number(s.total), 0),
      todayCount: todaySales.length,
      monthTotal: monthSales.reduce((sum, s) => sum + Number(s.total), 0),
      stockValue: products.reduce((sum, p) => sum + p.quantity * Number(p.unit_price), 0),
      totalProducts: products.length,
      totalUnits: products.reduce((sum, p) => sum + p.quantity, 0),
      lowStock: products
        .filter((p) => p.quantity <= p.reorder_level)
        .map((p) => ({
          id: p.id,
          name: p.name,
          quantity: p.quantity,
          reorderLevel: p.reorder_level,
        }))
        .slice(0, 8),
      topProducts: [...productTotals.values()].sort((a, b) => b.total - a.total).slice(0, 5),
      recentSales: sales.slice(0, 6).map(toSale),
    };
  },
);
