import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getInventory, getMovements } from "./inventory.functions";

export const inventoryQuery = (search: string) =>
  queryOptions({
    queryKey: ["inventory", { search }],
    queryFn: () => getInventory({ data: { search } }),
    placeholderData: keepPreviousData,
  });

export const movementsQuery = (productId: number) =>
  queryOptions({
    queryKey: ["movements", { productId }],
    queryFn: () => getMovements({ data: { id: productId } }),
  });
