import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store } from "lucide-react";

import { settingsQuery } from "@/lib/pos";
import { saveSettings, type ShopSettings } from "@/lib/settings.functions";
import { AppShell } from "@/components/app-shell";
import { inputClass, labelClass } from "@/components/shared";

export const Route = createFileRoute("/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery()),
  head: () => ({
    meta: [
      { title: "Stockroom — Shop settings" },
      {
        name: "description",
        content: "Shop name, address, phone and the note printed at the bottom of receipts.",
      },
      { property: "og:title", content: "Stockroom — Shop settings" },
      {
        property: "og:description",
        content: "Shop name, address, phone and the note printed at the bottom of receipts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { queryClient } = Route.useRouteContext();
  const { data } = useSuspenseQuery(settingsQuery());
  const [form, setForm] = useState<ShopSettings>(data);
  const [busy, setBusy] = useState(false);

  const set =
    (key: keyof ShopSettings) =>
    (e: { target: { value: string } }) =>
      setForm({ ...form, [key]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    try {
      setBusy(true);
      await saveSettings({ data: form });
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Shop details saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Shop settings</h1>
          <p className="text-sm text-muted-foreground">
            These details print at the top of every receipt
          </p>
        </header>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Store className="size-4 text-primary" aria-hidden /> Shop details
          </div>
          <label className="block">
            <span className={labelClass}>Shop name</span>
            <input required maxLength={80} value={form.shopName} onChange={set("shopName")} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Address</span>
            <input maxLength={200} value={form.shopAddress} onChange={set("shopAddress")} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Phone</span>
            <input maxLength={40} value={form.shopPhone} onChange={set("shopPhone")} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Receipt footer note</span>
            <input
              maxLength={200}
              value={form.receiptNote}
              onChange={set("receiptNote")}
              placeholder="e.g. No refund after 7 days"
              className={inputClass}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
