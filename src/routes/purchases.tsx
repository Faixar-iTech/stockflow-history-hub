import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Truck, X } from "lucide-react";

import { inventoryQuery } from "@/lib/inventory";
import { purchaseQuery, purchasesQuery, suppliersQuery } from "@/lib/pos";
import { createPurchase, type PurchaseDTO } from "@/lib/purchases.functions";
import { fmtDateTime, money } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { Modal } from "@/components/shared";

export const Route = createFileRoute("/purchases")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(purchasesQuery()),
      context.queryClient.ensureQueryData(inventoryQuery("")),
      context.queryClient.ensureQueryData(suppliersQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Stockroom — Purchases" },
      {
        name: "description",
        content: "Record stock purchases from suppliers; every purchase raises your stock.",
      },
      { property: "og:title", content: "Stockroom — Purchases" },
      {
        property: "og:description",
        content: "Record stock purchases from suppliers; every purchase raises your stock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PurchasesPage,
});

type DraftRow = { productId: string; quantity: string; unitCost: string };

function PurchasesPage() {
  const { queryClient } = Route.useRouteContext();
  const { data: purchases } = useSuspenseQuery(purchasesQuery());
  const { data: inventory } = useSuspenseQuery(inventoryQuery(""));
  const { data: suppliers } = useSuspenseQuery(suppliersQuery());
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (values: {
    supplierId: number | null;
    invoiceNo: string;
    note: string;
    items: { productId: number; quantity: number; unitCost: number }[];
  }) => {
    if (busy) return;
    try {
      setBusy(true);
      await createPurchase({ data: values });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success("Purchase recorded — stock updated");
      setCreating(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Purchases</h1>
            <p className="text-sm text-muted-foreground">
              Stock coming in from suppliers, latest first
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="size-4" aria-hidden /> New purchase
          </button>
        </header>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Items</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setOpenId(p.id)}
                  className="cursor-pointer border-b border-border transition last:border-0 hover:bg-accent/50"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {fmtDateTime(p.purchasedAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.invoiceNo || "—"}</td>
                  <td className="px-4 py-3">{p.supplierName ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                    {p.itemCount}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {money(p.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {purchases.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No purchases yet. Record one to bring stock in.
            </p>
          )}
        </div>
      </div>

      {creating && (
        <NewPurchaseModal
          suppliers={suppliers}
          products={inventory.products}
          busy={busy}
          onClose={() => setCreating(false)}
          onSave={save}
        />
      )}

      {openId !== null && <PurchaseDetail id={openId} onClose={() => setOpenId(null)} />}
    </AppShell>
  );
}

function NewPurchaseModal({
  suppliers,
  products,
  busy,
  onClose,
  onSave,
}: {
  suppliers: { id: number; name: string }[];
  products: { id: number; name: string; sku: string; unitPrice: number }[];
  busy: boolean;
  onClose: () => void;
  onSave: (values: {
    supplierId: number | null;
    invoiceNo: string;
    note: string;
    items: { productId: number; quantity: number; unitCost: number }[];
  }) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([{ productId: "", quantity: "1", unitCost: "0" }]);

  const total = rows.reduce(
    (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitCost) || 0),
    0,
  );

  const setRow = (index: number, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const pickProduct = (index: number, productId: string) => {
    const product = products.find((p) => String(p.id) === productId);
    setRow(index, {
      productId,
      unitCost: product ? String(product.unitPrice) : "0",
    });
  };

  const submit = () => {
    const items = rows
      .filter((r) => r.productId)
      .map((r) => ({
        productId: Number(r.productId),
        quantity: Number(r.quantity) || 1,
        unitCost: Number(r.unitCost) || 0,
      }));
    if (items.length === 0) {
      toast.error("Add at least one item to the purchase.");
      return;
    }
    onSave({
      supplierId: supplierId ? Number(supplierId) : null,
      invoiceNo: invoiceNo.trim(),
      note: note.trim(),
      items,
    });
  };

  const input =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30";

  return (
    <Modal title="New purchase" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Supplier
            </span>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={"mt-1 " + input}
            >
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Invoice no.
            </span>
            <input
              maxLength={60}
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="e.g. INV-2041"
              className={"mt-1 " + input}
            />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Items
          </span>
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={row.productId}
                onChange={(e) => pickProduct(index, e.target.value)}
                aria-label="Product"
                className={input + " min-w-0 flex-1"}
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => setRow(index, { quantity: e.target.value })}
                aria-label="Quantity"
                className={input + " w-20 shrink-0"}
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={row.unitCost}
                onChange={(e) => setRow(index, { unitCost: e.target.value })}
                aria-label="Unit cost"
                className={input + " w-28 shrink-0"}
              />
              <button
                type="button"
                aria-label="Remove item"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { productId: "", quantity: "1", unitCost: "0" }])}
            className="text-sm font-medium text-primary hover:underline"
          >
            + Add item
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Note
          </span>
          <input
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={"mt-1 " + input}
          />
        </label>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-medium">Purchase total</span>
          <span className="font-display text-xl font-semibold tabular-nums">{money(total)}</span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Record purchase"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PurchaseDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: purchase, isPending } = useQuery({ ...purchaseQuery(id) });

  return (
    <Modal title="Purchase" onClose={onClose}>
      {isPending || !purchase ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="text-right">{fmtDateTime(purchase.purchasedAt)}</dd>
            <dt className="text-muted-foreground">Invoice</dt>
            <dd className="text-right font-mono text-xs">{purchase.invoiceNo || "—"}</dd>
            <dt className="text-muted-foreground">Supplier</dt>
            <dd className="text-right">{purchase.supplierName ?? "—"}</dd>
            {purchase.note && (
              <>
                <dt className="text-muted-foreground">Note</dt>
                <dd className="text-right">{purchase.note}</dd>
              </>
            )}
          </dl>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Cost</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{money(item.unitCost)}</td>
                  <td className="py-2 text-right tabular-nums">{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{money(purchase.total)}</span>
          </div>
        </>
      )}
    </Modal>
  );
}

export type { PurchaseDTO };
void Truck;
