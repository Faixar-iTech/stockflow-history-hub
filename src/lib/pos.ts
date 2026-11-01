import { queryOptions } from "@tanstack/react-query";
import { getCustomers, getSuppliers } from "./partners.functions";
import { getSale, getSales } from "./sales.functions";
import { getPurchase, getPurchases } from "./purchases.functions";
import { getDashboard } from "./reports.functions";
import { getSettings } from "./settings.functions";

export const customersQuery = () =>
  queryOptions({ queryKey: ["customers"], queryFn: () => getCustomers() });

export const suppliersQuery = () =>
  queryOptions({ queryKey: ["suppliers"], queryFn: () => getSuppliers() });

export const salesQuery = () =>
  queryOptions({ queryKey: ["sales"], queryFn: () => getSales({ data: {} }) });

export const saleQuery = (id: number) =>
  queryOptions({ queryKey: ["sales", id], queryFn: () => getSale({ data: { id } }) });

export const purchasesQuery = () =>
  queryOptions({ queryKey: ["purchases"], queryFn: () => getPurchases() });

export const purchaseQuery = (id: number) =>
  queryOptions({ queryKey: ["purchases", id], queryFn: () => getPurchase({ data: { id } }) });

export const dashboardQuery = () =>
  queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const settingsQuery = () =>
  queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });
