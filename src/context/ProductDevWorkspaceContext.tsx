import { createContext, useContext } from 'react';
import type { Brand, Product, ProductDevGate, ProductDevItem } from '../types/database';

export interface ProductDevWorkspaceValue {
  item: ProductDevItem;
  brand: Brand | null;
  product: Product | null;
  ownerName: string | null;
  gates: ProductDevGate[];
  reload: () => void;
}

export const ProductDevWorkspaceContext = createContext<ProductDevWorkspaceValue | null>(null);

export function useProductDevWorkspace() {
  const ctx = useContext(ProductDevWorkspaceContext);
  if (!ctx) {
    throw new Error('useProductDevWorkspace precisa ser usado dentro de uma rota /design-produto/:id/*');
  }
  return ctx;
}
