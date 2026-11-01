import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";

export const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30";

export const labelClass =
  "block text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function StatCard({
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

export function IconAction({
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

export function Modal({
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
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
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

export function FormButtons({
  busy,
  onCancel,
  label,
}: {
  busy: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
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
        {label}
      </button>
    </div>
  );
}

export function PartnerForm({
  title,
  initial,
  busy,
  onCancel,
  onSave,
}: {
  title: string;
  initial: { name: string; phone: string; address: string };
  busy: boolean;
  onCancel: () => void;
  onSave: (values: { name: string; phone: string; address: string }) => void;
}) {
  const [form, setForm] = useState(initial);
  const set =
    (key: keyof typeof form) =>
    (e: { target: { value: string } }) =>
      setForm({ ...form, [key]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(form);
  };
  return (
    <Modal title={title} onClose={onCancel}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input required maxLength={120} value={form.name} onChange={set("name")} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Phone</span>
          <input maxLength={40} value={form.phone} onChange={set("phone")} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Address</span>
          <input maxLength={200} value={form.address} onChange={set("address")} className={inputClass} />
        </label>
        <FormButtons busy={busy} onCancel={onCancel} label="Save" />
      </form>
    </Modal>
  );
}
