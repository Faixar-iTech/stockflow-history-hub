import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import { saleQuery, settingsQuery } from "@/lib/pos";
import { fmtDateTime, money } from "@/lib/format";
import { PAYMENT_LABELS, type PaymentMethod } from "@/lib/sales.functions";

export const Route = createFileRoute("/receipt/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(saleQuery(Number(params.id))),
  head: () => ({
    meta: [
      { title: "Stockroom — Receipt" },
      { name: "description", content: "Printable sale receipt." },
      { property: "og:title", content: "Stockroom — Receipt" },
      { property: "og:description", content: "Printable sale receipt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { id } = Route.useParams();
  const saleId = Number(id);
  const { data: sale } = useSuspenseQuery(saleQuery(saleId));
  const { data: settings } = useSuspenseQuery(settingsQuery());

  return (
    <div className="min-h-screen bg-secondary/40 py-10 font-sans text-foreground print:bg-white print:py-0">
      <div className="mx-auto max-w-sm px-4 print:max-w-full print:px-0">
        <div className="mb-4 flex gap-2 print:hidden">
          <Link
            to="/sales"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-accent"
          >
            <ArrowLeft className="size-4" aria-hidden /> Sales
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Printer className="size-4" aria-hidden /> Print receipt
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm print:rounded-none print:border-0 print:bg-white print:p-2 print:shadow-none">
          <div className="text-center">
            <h1 className="font-display text-xl font-bold tracking-tight">{settings.shopName}</h1>
            {settings.shopAddress && (
              <p className="mt-0.5 text-xs text-muted-foreground">{settings.shopAddress}</p>
            )}
            {settings.shopPhone && (
              <p className="text-xs text-muted-foreground">Tel: {settings.shopPhone}</p>
            )}
          </div>

          <div className="mt-4 space-y-1 border-y border-dashed border-border py-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receipt</span>
              <span className="font-mono">{sale.receiptNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{fmtDateTime(sale.soldAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span>{sale.customerName ?? "Walk-in"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <span>{PAYMENT_LABELS[sale.paymentMethod as PaymentMethod] ?? sale.paymentMethod}</span>
            </div>
          </div>

          <table className="mt-3 w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left uppercase tracking-wide text-muted-foreground">
                <th className="pb-1.5 font-medium">Item</th>
                <th className="pb-1.5 text-right font-medium">Qty</th>
                <th className="pb-1.5 text-right font-medium">Price</th>
                <th className="pb-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5">{item.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(item.unitPrice)}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 space-y-1 border-t border-dashed border-border pt-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{money(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular-nums">−{money(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span className="tabular-nums">{money(sale.total)}</span>
            </div>
          </div>

          {sale.note && <p className="mt-3 text-xs text-muted-foreground">Note: {sale.note}</p>}

          {settings.receiptNote && (
            <p className="mt-4 border-t border-dashed border-border pt-3 text-center text-xs">
              {settings.receiptNote}
            </p>
          )}
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Thank you for shopping with us!
          </p>
        </div>
      </div>
    </div>
  );
}
