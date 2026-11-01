import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";

import { suppliersQuery } from "@/lib/pos";
import {
  createSupplier,
  deleteSupplier,
  updateSupplier,
  type SupplierDTO,
} from "@/lib/partners.functions";
import { AppShell } from "@/components/app-shell";
import { IconAction, Modal, PartnerForm } from "@/components/shared";

export const Route = createFileRoute("/suppliers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(suppliersQuery()),
  head: () => ({
    meta: [
      { title: "Stockroom — Suppliers" },
      { name: "description", content: "Who you buy stock from, with phones and addresses." },
      { property: "og:title", content: "Stockroom — Suppliers" },
      {
        property: "og:description",
        content: "Who you buy stock from, with phones and addresses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const { queryClient } = Route.useRouteContext();
  const { data: suppliers } = useSuspenseQuery(suppliersQuery());
  const [editing, setEditing] = useState<SupplierDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<SupplierDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    try {
      setBusy(true);
      await action();
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Suppliers</h1>
            <p className="text-sm text-muted-foreground">
              The businesses you buy stock from — attach them to purchases
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="size-4" aria-hidden /> Add supplier
          </button>
        </header>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Address</th>
                <th className="px-4 py-3 text-right font-medium">Purchases</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">{s.phone || "—"}</td>
                  <td className="hidden max-w-xs truncate px-4 py-3 text-muted-foreground sm:table-cell">
                    {s.address || "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.purchaseCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <IconAction label={`Edit ${s.name}`} onClick={() => setEditing(s)}>
                        <Pencil className="size-4" aria-hidden />
                      </IconAction>
                      <IconAction label={`Delete ${s.name}`} danger onClick={() => setDeleting(s)}>
                        <Trash2 className="size-4" aria-hidden />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {suppliers.length === 0 && (
            <p className="flex items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
              <Truck className="size-4" aria-hidden />
              No suppliers yet. Add one to link purchases.
            </p>
          )}
        </div>
      </div>

      {editing && (
        <PartnerForm
          title={editing === "new" ? "Add supplier" : `Edit ${editing.name}`}
          initial={
            editing === "new"
              ? { name: "", phone: "", address: "" }
              : { name: editing.name, phone: editing.phone, address: editing.address }
          }
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(values) =>
            run(
              () =>
                editing === "new"
                  ? createSupplier({ data: values })
                  : updateSupplier({ data: { id: editing.id, supplier: values } }),
              editing === "new" ? `${values.name} added` : `${values.name} updated`,
            ).then((ok) => ok && setEditing(null))
          }
        />
      )}

      {deleting && (
        <Modal title="Delete supplier" onClose={() => setDeleting(null)}>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{deleting.name}</span>? Past
            purchases stay in history.
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
              onClick={() =>
                run(
                  () => deleteSupplier({ data: { id: deleting.id } }),
                  `${deleting.name} deleted`,
                ).then((ok) => ok && setDeleting(null))
              }
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
