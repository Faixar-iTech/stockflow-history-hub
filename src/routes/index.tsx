import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  Package,
  Plus,
  ReceiptText,
  ScanBarcode,
  TrendingUp,
  Truck,
} from "lucide-react";

import { dashboardQuery } from "@/lib/pos";
import { fmtDateTime, money } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/shared";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery()),
  head: () => ({
    meta: [
      { title: "Stockroom — POS & Inventory" },
      {
        name: "description",
        content:
          "Point of sale counter, purchases, stock tracking and sales reports for your shop, in one place.",
      },
      { property: "og:title", content: "Stockroom — POS & Inventory" },
      {
        property: "og:description",
        content: "Point of sale counter, purchases, stock tracking and sales reports for your shop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const quickButton =
  "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm transition active:scale-[0.98]";

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery());

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Sales, stock health and quick actions for today
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pos"
              className={quickButton + " bg-primary text-primary-foreground hover:bg-primary/90"}
            >
              <ScanBarcode className="size-4" aria-hidden /> New sale
            </Link>
            <Link
              to="/purchases"
              className={quickButton + " border border-border bg-card hover:bg-accent"}
            >
              <Truck className="size-4" aria-hidden /> New purchase
            </Link>
            <Link
              to="/products"
              className={quickButton + " border border-border bg-card hover:bg-accent"}
            >
              <Plus className="size-4" aria-hidden /> Add product
            </Link>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<TrendingUp className="size-4" />}
            label="Sales today"
            value={money(data.todayTotal)}
          />
          <StatCard
            icon={<ReceiptText className="size-4" />}
            label="Orders today"
            value={data.todayCount}
          />
          <StatCard
            icon={<Banknote className="size-4" />}
            label="Stock value"
            value={money(data.stockValue)}
          />
          <StatCard
            icon={<AlertTriangle className="size-4" />}
            label="Need reorder"
            value={data.lowStock.length}
            warn={data.lowStock.length > 0}
          />
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Recent sales</h2>
              <Link to="/sales" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            {data.recentSales.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No sales yet. Open the counter and ring up your first customer.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentSales.map((sale) => (
                  <li key={sale.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <ReceiptText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs">{sale.receiptNo}</span>
                      <span className="ml-2 text-muted-foreground">
                        {sale.customerName ?? "Walk-in"}
                      </span>
                    </div>
                    <time className="hidden text-xs text-muted-foreground sm:block">
                      {fmtDateTime(sale.soldAt)}
                    </time>
                    <span className="tabular-nums font-medium">{money(sale.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Top products — last 30 days</h2>
              <Link to="/sales" className="text-xs font-medium text-primary hover:underline">
                Sales
              </Link>
            </div>
            {data.topProducts.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Your best sellers will appear here once sales come in.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.quantity} sold</span>
                    <span className="tabular-nums">{money(p.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Low stock — time to reorder</h2>
              <Link to="/purchases" className="text-xs font-medium text-primary hover:underline">
                Record purchase
              </Link>
            </div>
            {data.lowStock.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Everything is comfortably stocked.
              </p>
            ) : (
              <ul className="divide-y divide-border sm:grid sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
                {data.lowStock.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm sm:border-b sm:border-border"
                  >
                    <Package className="size-4 shrink-0 text-warning-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      reorder at {p.reorderLevel}
                    </span>
                    <span className="tabular-nums font-semibold text-warning-foreground">
                      {p.quantity} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
