import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import { customersQuery } from "@/lib/pos";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
  type CustomerDTO,
} from "@/lib/partners.functions";
import { AppShell } from "@/components/app-shell";
import { IconAction, PartnerForm } from "@/components/shared";

export const Route = createFileRoute("/customers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(customersQuery()),
  head: () => ({
    meta: [
      { title: "Stockroom — Customers" },
      { name: "description", content: "Your customer list with phones, addresses and buy history." },
      { property: "og:title", content: "Stockroom — Customers" },
      {
        property: "og:description",
        content: "Your customer list with phones, addresses and buy history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { queryClient } = Route.useRouteContext();
  const { data: customers } = useSuspenseQuery(customersQuery());
  const [editing, setEditing] = useState<CustomerDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<CustomerDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    try {
      setBusy(true);
      await action();
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["sales"] });
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
            <h1 className="font-display text-2xl font-semibold tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground">
              Save regulars here so their sales are linked at the counter
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="size-4" aria-hidden /> Add customer
          </button>
        </header>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Address</th>
                <th className="px-4 py-3 text-right font-medium">Sales</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">{c.phone || "—"}</td>
                  <td className="hidden max-w-xs truncate px-4 py-3 text-muted-foreground sm:table-cell">
                    {c.address || "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.salesCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <IconAction label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                        <Pencil className="size-4" aria-hidden />
                      </IconAction>
                      <IconAction label={`Delete ${c.name}`} danger onClick={() => setDeleting(c)}>
                        <Trash2 className="size-4" aria-hidden />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && (
            <p className="flex items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
              <Users className="size-4" aria-hidden />
              No customers yet. Add one or leave counter sales as walk-in.
            </p>
          )}
        </div>
      </div>

      {editing && (
        <PartnerForm
          title={editing === "new" ? "Add customer" : `Edit ${editing.name}`}
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
                  ? createCustomer({ data: values })
                  : updateCustomer({ data: { id: editing.id, customer: values } }),
              editing === "new" ? `${values.name} added` : `${values.name} updated`,
            ).then((ok) => ok && setEditing(null))
          }
        />
      )}

      {deleting && (
        <PartnerFormlessDelete
          name={deleting.name}
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            run(() => deleteCustomer({ data: { id: deleting.id } }), `${deleting.name} deleted`).then(
              (ok) => ok && setDeleting(null),
            )
          }
        />
      )}
    </AppShell>
  );
}

import { Modal } from "@/components/shared";

function PartnerFormlessDelete({
  name,
  busy,
  onClose,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Delete customer" onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        Delete <span className="font-medium text-foreground">{name}</span>? Their past sales stay in
        history as walk-in.
      </p>
      <div className="mt-6 flex justify-end gap-2">
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
          onClick={onConfirm}
          className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}
