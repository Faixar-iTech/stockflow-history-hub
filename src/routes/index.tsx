import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { createFileRoute, useSuspenseQuery } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  History as HistoryIcon,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  inventoryQuery,
  movementsQuery,
} from "@/lib/inventory";
import {
  adjustStock,
  createProduct,
  deleteProduct,
  getMovements,
  updateProduct,
  type InventoryData,
  type MovementDTO,
  type ProductDTO,
} from "@/lib/inventory.functions";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(inventoryQuery("")),
  head: () => ({
    meta: [
      { title: "Stockroom — Inventory" },
      {
        name: "description",
        content:
          "Stockroom keeps your stock counted: products, adjustments and movement history with low-stock alerts.",
      },
      { property: "og:title", content: "Stockroom — Inventory" },
      {
        property: "og:description",
        content:
          "Track products, adjust stock and see every movement with low-stock alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const blankProduct = {
  sku: "",
  name: "",
  category: "General",
  quantity: 0,
  reorderLevel: 5,
  unitPrice: 0,
};

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Index() {
  const { queryClient } = Route.useRouteContext();
  const base = useSuspenseQuery(inventoryQuery(""));
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 250);
  const filtered = useQuery({
    ...inventoryQuery(search),
    enabled: search !== "",
  });
  const data: InventoryData =
    search !== "" ? (filtered.data ?? base.data) : base.data;

  const [editing, setEditing] = useState<ProductDTO | "new" | null>(null);
  const [historyFor, setHistoryFor] = useState<ProductDTO | null>(null);
  const [deleting, setDeleting] = useState<ProductDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    try {
      setBusy(true);
      await action();
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const adjust = (p: ProductDTO, change: number) =>
    run(
      () => adjustStock({ data: { id: p.id, change, reason: change > 0 ? "Stock in" : "Stock out" } }),
      `${change > 0 ? "Added" : "Removed"} 1 unit ${change > 0 ? "to" : "from"} ${p.name}`,
    );

  const confirmDelete = () =>
    deleting &&
    run(() => deleteProduct({ data: { id: deleting.id } }), `${deleting.name} deleted`).then(() =>
      setDeleting(null),
    );

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Boxes className="size-6" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Stockroom
              </h1>
              <p className="text-sm text-muted-foreground">
                Inventory, counts and movement history
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="size-4" aria-hidden /> Add product
          </button>
        </header>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Package className="size-4" />} label="Products" value={data.summary.totalProducts} />
          <StatCard icon={<Boxes className="size-4" />} label="Units on hand" value={data.summary.totalUnits.toLocaleString()} />
          <StatCard icon={<DollarIcon />} label="Stock value" value={money(data.summary.stockValue)} />
          <StatCard
            icon={<AlertTriangle className="size-4" />}
            label="Need reorder"
            value={data.summary.lowStock}
            warn={data.summary.lowStock > 0}
          />
        </section>

        <div className="relative mt-8">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, SKU or category"
            aria-label="Search products"
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Category</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">In stock</th>
                <th className="px-4 py-3 font-medium">Adjust</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p) => {
                const low = p.quantity <= p.reorderLevel;
                return (
                  <tr
                    key={p.id}
                    className={low ? "border-b border-border bg-warning/10" : "border-b border-border last:border-0"}
                  >
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{p.sku}</td>
                    <td className="px-4 py-3 font-medium">
                      {p.name}
                      {low && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
                          <AlertTriangle className="size-3" aria-hidden /> Reorder
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{p.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(p.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{p.quantity}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center overflow-hidden rounded-lg border border-border">
                        <button
                          type="button"
                          aria-label={`Remove one ${p.name}`}
                          disabled={p.quantity === 0 || busy}
                          onClick={() => adjust(p, -1)}
                          className="flex size-8 items-center justify-center text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={`Add one ${p.name}`}
                          disabled={busy}
                          onClick={() => adjust(p, 1)}
                          className="flex size-8 items-center justify-center border-l border-border text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="size-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconAction label={`History for ${p.name}`} onClick={() => setHistoryFor(p)}>
                          <HistoryIcon className="size-4" aria-hidden />
                        </IconAction>
                        <IconAction label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                          <Pencil className="size-4" aria-hidden />
                        </IconAction>
                        <IconAction label={`Delete ${p.name}`} danger onClick={() => setDeleting(p)}>
                          <Trash2 className="size-4" aria-hidden />
                        </IconAction>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.products.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              {search
                ? "No products match your search."
                : "No products yet. Add your first product to start tracking stock."}
            </p>
          )}
        </div>
      </div>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(values) =>
            run(
              () =>
                editing === "new"
                  ? createProduct({ data: values })
                  : updateProduct({ data: { id: editing.id, product: values } }),
              editing === "new" ? `${values.name} added` : `${values.name} updated`,
            ).then(() => setEditing(null))
          }
        />
      )}

      {historyFor && <HistoryModal product={historyFor} onClose={() => setHistoryFor(null)} />}

      {deleting && (
        <Modal title="Delete product" onClose={() => setDeleting(null)}>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{deleting.name}</span> and its
            stock history? This cannot be undone.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={confirmDelete}
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DollarIcon() {
  return (
    <span className="text-[13px] font-semibold leading-none" aria-hidden>
      $
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  warn,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border bg-card p-4 shadow-sm " +
        (warn ? "border-warning/40 bg-warning/10" : "border-border")
      }
    >
      <div
        className={
          "flex items-center gap-1.5 text-xs font-medium " +
          (warn ? "text-warning-foreground" : "text-muted-foreground")
        }
      >
        {icon}
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground " +
        (danger ? "hover:bg-destructive/10 hover:text-destructive" : "")
      }
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProductForm({
  product,
  busy,
  onSave,
  onCancel,
}: {
  product: ProductDTO | null;
  busy: boolean;
  onSave: (values: {
    sku: string;
    name: string;
    category: string;
    quantity: number;
    reorderLevel: number;
    unitPrice: number;
  }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(
    product ?? { ...blankProduct },
  );
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      quantity: Number(form.quantity) || 0,
      reorderLevel: Number(form.reorderLevel) || 0,
      unitPrice: Number(form.unitPrice) || 0,
    });
  };
  const isNew = !product;
  const label = "block text-xs font-medium uppercase tracking-wide text-muted-foreground";
  const input =
    "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30";
  return (
    <Modal title={isNew ? "Add product" : "Edit product"} onClose={onCancel}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className={isNew ? "" : "col-span-2"}>
            <span className={label}>SKU</span>
            <input required maxLength={40} value={form.sku} onChange={set("sku")} className={input} />
          </label>
          <label className="col-span-2">
            <span className={label}>Name</span>
            <input required maxLength={120} value={form.name} onChange={set("name")} className={input} />
          </label>
          <label className="col-span-2">
            <span className={label}>Category</span>
            <input maxLength={60} value={form.category} onChange={set("category")} className={input} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {isNew && (
            <label>
              <span className={label}>Starting qty</span>
              <input type="number" min={0} value={form.quantity} onChange={set("quantity")} className={input} />
            </label>
          )}
          <label>
            <span className={label}>Reorder at</span>
            <input type="number" min={0} value={form.reorderLevel} onChange={set("reorderLevel")} className={input} />
          </label>
          <label>
            <span className={label}>Unit price</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.unitPrice}
              onChange={set("unitPrice")}
              className={input}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            {isNew ? "Add product" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ product, onClose }: { product: ProductDTO; onClose: () => void }) {
  const { data: movements, isPending } = useQuery(movementsQuery(product.id));
  const rows: MovementDTO[] = movements ?? [];
  return (
    <Modal title={`Stock history: ${product.name}`} onClose={onClose}>
      {isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No movements recorded.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span
                className={
                  "w-14 rounded-md px-2 py-0.5 text-center font-mono text-xs font-semibold " +
                  (m.change > 0
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-destructive/10 text-destructive")
                }
              >
                {m.change > 0 ? "+" : ""}
                {m.change}
              </span>
              <span className="flex-1">{m.reason}</span>
              <time className="text-xs text-muted-foreground">
                {new Date(m.createdAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
