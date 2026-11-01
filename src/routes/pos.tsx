import { useCallback, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  Minus,
  Plus,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";

import { inventoryQuery } from "@/lib/inventory";
import { customersQuery } from "@/lib/pos";
import {
  createSale,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/sales.functions";
import { money } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { CameraScan } from "@/components/camera-scan";
import type { ProductDTO } from "@/lib/inventory.functions";

export const Route = createFileRoute("/pos")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(inventoryQuery("")),
      context.queryClient.ensureQueryData(customersQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Stockroom — Counter" },
      {
        name: "description",
        content: "Scan barcodes, build the cart and complete sales in seconds.",
      },
      { property: "og:title", content: "Stockroom — Counter" },
      { property: "og:description", content: "Scan barcodes, build the cart and complete sales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: POSCounter,
});

type CartLine = { product: ProductDTO; qty: number };

function POSCounter() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const inventory = useSuspenseQuery(inventoryQuery("")).data;
  const customers = useSuspenseQuery(customersQuery()).data;
  const products = inventory.products;

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [customerId, setCustomerId] = useState("");
  const [scan, setScan] = useState("");
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const findByCode = useCallback(
    (code: string) => {
      const v = code.trim().toLowerCase();
      if (!v) return null;
      return (
        products.find(
          (p) => p.sku.toLowerCase() === v || (p.barcode && p.barcode.toLowerCase() === v),
        ) ?? null
      );
    },
    [products],
  );

  const add = useCallback(
    (product: ProductDTO) => {
      if (product.quantity <= 0) {
        toast.error(`${product.name} is out of stock.`);
        return;
      }
      setCart((prev) => {
        const line = prev.find((l) => l.product.id === product.id);
        if (line) {
          if (line.qty >= product.quantity) {
            toast.error(`Only ${product.quantity} of ${product.name} in stock.`);
            return prev;
          }
          return prev.map((l) => (l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l));
        }
        return [...prev, { product, qty: 1 }];
      });
    },
    [],
  );

  const handleCode = useCallback(
    (code: string) => {
      const found = findByCode(code);
      if (found) {
        add(found);
        toast.success(`${found.name} added`);
      } else {
        toast.error(`No product matches code "${code.trim()}"`);
      }
    },
    [findByCode, add],
  );

  const closeCamera = useCallback(() => setCamera(false), []);

  const onScanInput = (value: string) => {
    setScan(value);
    // A USB scanner types the full code instantly — add on exact match.
    const exact = findByCode(value);
    if (exact) {
      add(exact);
      setScan("");
      scanRef.current?.focus();
    }
  };

  const onScanEnter = () => {
    const found = findByCode(scan);
    if (found) {
      add(found);
      toast.success(`${found.name} added`);
    }
    setScan("");
    scanRef.current?.focus();
  };

  const setQty = (productId: number, qty: number) =>
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.product.id !== productId)
        : prev.map((l) => (l.product.id === productId ? { ...l, qty } : l)),
    );

  const subtotal = cart.reduce((sum, l) => sum + l.product.unitPrice * l.qty, 0);
  const discountNum = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - discountNum;

  const term = scan.trim().toLowerCase();
  const visible = term
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term) ||
            p.category.toLowerCase().includes(term) ||
            (p.barcode && p.barcode.toLowerCase().includes(term)),
        )
        .slice(0, 12)
    : products.slice(0, 24);

  const complete = async () => {
    if (cart.length === 0 || busy) return;
    setBusy(true);
    try {
      const result = await createSale({
        data: {
          customerId: customerId ? Number(customerId) : null,
          discount: discountNum,
          paymentMethod: payment,
          note: "",
          items: cart.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
      ]);
      setCart([]);
      setDiscount("0");
      setCustomerId("");
      setPayment("cash");
      toast.success(`Sale ${result.receiptNo} completed`);
      await navigate({ to: "/receipt/$id", params: { id: String(result.id) } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <section>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  ref={scanRef}
                  autoFocus
                  type="search"
                  value={scan}
                  onChange={(e) => onScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onScanEnter()}
                  placeholder="Scan barcode or search products…"
                  aria-label="Scan or search products"
                  className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-4 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <button
                type="button"
                onClick={() => setCamera(true)}
                aria-label="Scan with camera"
                title="Scan with camera"
                className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition hover:bg-accent"
              >
                <Camera className="size-5" aria-hidden />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Keep this box focused — a USB barcode scanner types the code and the item jumps into
              the cart.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visible.map((p) => {
                const low = p.quantity <= p.reorderLevel;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => add(p)}
                    disabled={p.quantity <= 0}
                    className="rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-ring hover:shadow disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                      {p.sku}
                    </span>
                    <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                      <span className="tabular-nums">{money(p.unitPrice)}</span>
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                          (p.quantity <= 0
                            ? "bg-destructive/10 text-destructive"
                            : low
                              ? "bg-warning/20 text-warning-foreground"
                              : "bg-secondary text-secondary-foreground")
                        }
                      >
                        {p.quantity} in stock
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {visible.length === 0 && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                No products match "{scan}".
              </p>
            )}
          </section>

          <aside className="self-start lg:sticky lg:top-20">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                <ShoppingCart className="size-4" aria-hidden /> Cart
              </h2>

              <label className="mt-3 block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Customer
                </span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  <option value="">Walk-in customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` — ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Scan or tap a product to start the sale.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {cart.map((l) => (
                    <li key={l.product.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {money(l.product.unitPrice)} × {l.qty}
                        </p>
                      </div>
                      <div className="inline-flex items-center overflow-hidden rounded-lg border border-border">
                        <button
                          type="button"
                          aria-label={`Reduce ${l.product.name}`}
                          onClick={() => setQty(l.product.id, l.qty - 1)}
                          className="flex size-7 items-center justify-center text-foreground transition hover:bg-accent"
                        >
                          <Minus className="size-3" aria-hidden />
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">{l.qty}</span>
                        <button
                          type="button"
                          aria-label={`Add one more ${l.product.name}`}
                          onClick={() => add(l.product)}
                          className="flex size-7 items-center justify-center border-l border-border text-foreground transition hover:bg-accent"
                        >
                          <Plus className="size-3" aria-hidden />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${l.product.name}`}
                        onClick={() => setQty(l.product.id, 0)}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Discount ৳
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                </label>
                <div className="text-right">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Subtotal
                  </span>
                  <p className="mt-1 font-display text-xl font-semibold tabular-nums">
                    {money(subtotal)}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Payment
                </span>
                <div className="mt-1 grid grid-cols-4 gap-1 rounded-lg border border-border p-1">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayment(m)}
                      className={
                        "rounded-md py-1.5 text-xs font-medium transition " +
                        (payment === m
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent")
                      }
                    >
                      {PAYMENT_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-medium">Total</span>
                <span className="font-display text-2xl font-semibold tabular-nums">
                  {money(total)}
                </span>
              </div>

              <button
                type="button"
                onClick={complete}
                disabled={cart.length === 0 || busy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
              >
                <ScanBarcode className="size-4" aria-hidden />
                {busy ? "Saving…" : `Charge ${money(total)}`}
              </button>
            </div>
          </aside>
        </div>

        {camera && <CameraScan onDetect={handleCode} onClose={closeCamera} />}
      </div>
    </AppShell>
  );
}
