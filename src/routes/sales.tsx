import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Printer, ReceiptText, Search } from "lucide-react";

import { saleQuery, salesQuery } from "@/lib/pos";
import { fmtDateTime, money } from "@/lib/format";
import { PAYMENT_LABELS, type PaymentMethod } from "@/lib/sales.functions";
import { AppShell } from "@/components/app-shell";
import { Modal } from "@/components/shared";

export const Route = createFileRoute("/sales")({
  loader: ({ context }) => context.queryClient.ensureQueryData(salesQuery()),
  head: () => ({
    meta: [
      { title: "Stockroom — Sales" },
      {
        name: "description",
        content: "Every sale with receipts, customers, payment method and totals.",
      },
      { property: "og:title", content: "Stockroom — Sales" },
      { property: "og:description", content: "Every sale with receipts, customers and totals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesPage,
});

function paymentLabel(method: string) {
  return PAYMENT_LABELS[method as PaymentMethod] ?? method;
}

function SalesPage() {
  const { data: sales } = useSuspenseQuery(salesQuery());
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? sales.filter(
        (s) =>
          s.receiptNo.toLowerCase().includes(term) ||
          (s.customerName ?? "").toLowerCase().includes(term) ||
          paymentLabel(s.paymentMethod).toLowerCase().includes(term),
      )
    : sales;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Sales</h1>
            <p className="text-sm text-muted-foreground">
              Every sale recorded at the counter, latest first
            </p>
          </div>
        </header>

        <div className="relative mt-6 max-w-md">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search receipt, customer or payment"
            aria-label="Search sales"
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Receipt</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Items</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className="cursor-pointer border-b border-border transition last:border-0 hover:bg-accent/50"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {fmtDateTime(s.soldAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.receiptNo}</td>
                  <td className="px-4 py-3">{s.customerName ?? "Walk-in"}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                    {s.itemCount}
                  </td>
                  <td className="px-4 py-3 capitalize">{paymentLabel(s.paymentMethod)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {money(s.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              {term ? "No sales match your search." : "No sales yet — ring one up at the counter."}
            </p>
          )}
        </div>
      </div>

      {openId !== null && <SaleDetail id={openId} onClose={() => setOpenId(null)} />}
    </AppShell>
  );
}

function SaleDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: sale, isPending } = useQuery({ ...saleQuery(id) });

  return (
    <Modal title={sale ? `Sale ${sale.receiptNo}` : "Sale"} onClose={onClose}>
      {isPending || !sale ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="text-right">{fmtDateTime(sale.soldAt)}</dd>
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="text-right">{sale.customerName ?? "Walk-in"}</dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd className="text-right capitalize">{paymentLabel(sale.paymentMethod)}</dd>
            {sale.note && (
              <>
                <dt className="text-muted-foreground">Note</dt>
                <dd className="text-right">{sale.note}</dd>
              </>
            )}
          </dl>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Price</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{money(item.unitPrice)}</td>
                  <td className="py-2 text-right tabular-nums">{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tabular-nums">−{money(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{money(sale.total)}</span>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Link
              to="/receipt/$id"
              params={{ id: String(sale.id) }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              <Printer className="size-4" aria-hidden /> Receipt
            </Link>
          </div>
        </>
      )}
    </Modal>
  );
}
