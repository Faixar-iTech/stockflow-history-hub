import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Boxes } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", exact: true },
  { to: "/pos", label: "New sale" },
  { to: "/sales", label: "Sales" },
  { to: "/purchases", label: "Purchases" },
  { to: "/products", label: "Products" },
  { to: "/customers", label: "Customers" },
  { to: "/suppliers", label: "Suppliers" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Boxes className="size-5" aria-hidden />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">Stockroom</span>
          </Link>
          <nav aria-label="Main" className="ml-auto flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} activeOptions={{ exact: item.exact === true }}>
                {({ isActive }: { isActive: boolean }) => (
                  <span
                    className={
                      "block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                      (isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground")
                    }
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
