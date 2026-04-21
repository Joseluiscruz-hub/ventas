export type Id = string;
export type ISODateString = string;
export type Money = number;

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';
export type Plan = 'BASIC' | 'PRO' | 'PREMIUM';
export type PaymentMethod = 'CASH' | 'CARD';
export type MovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER';
export type Feature = 'POS' | 'INVENTORY' | 'MULTISTORE' | 'AUDIT' | 'OFFLINE' | 'API';

export interface Tenant {
  id: Id;
  name: string;
  plan: Plan;
}

export interface Store {
  id: Id;
  tenantId: Id;
  name: string;
  address?: string;
}

export interface User {
  id: Id;
  tenantId: Id;
  storeId: Id;
  username: string;
  name: string;
  role: Role;
}

export interface Product {
  id: Id;
  tenantId: Id;
  barcode: string;
  name: string;
  category: string;
  cost: Money;
  price: Money;
}

export interface StoreProduct {
  id: Id;
  tenantId: Id;
  storeId: Id;
  productId: Id;
  stock: number;
  minStock: number;
}

export interface SaleItem {
  id: Id;
  saleId: Id;
  productId: Id;
  quantity: number;
  price: Money;
  cost: Money;
  subtotal: Money;
}

export interface Sale {
  id: Id;
  tenantId: Id;
  storeId: Id;
  cashierId: Id;
  datetime: ISODateString;
  total: Money;
  paymentMethod: PaymentMethod;
  amountTendered: Money;
  changeAmount: Money;
  itemsCount?: number;
  items?: SaleItemWithName[];
}

export interface StockMovement {
  id: Id;
  tenantId: Id;
  storeId: Id;
  productId: Id;
  userId: Id;
  type: MovementType;
  quantity: number;
  date: ISODateString;
  reason?: string;
}

export type ProductView = Product & {
  stock: number;
  minStock: number;
};

export type SaleItemWithName = SaleItem & {
  name?: string;
};

export type StockMovementView = StockMovement & {
  productName: string;
  userName: string;
};

export interface Session {
  user: User;
  tenant: Tenant;
  store: Store;
  token: string;
}

export interface RequestContext {
  tenantId: Id;
  storeId: Id;
  userId: Id;
}

export interface CreateProductInput {
  barcode: string;
  name: string;
  category: string;
  cost: Money;
  price: Money;
  stock: number;
  minStock: number;
}

export interface UpdateProductInput extends CreateProductInput {
  id: Id;
}

export interface CartItem extends ProductView {
  quantity: number;
  subtotal: Money;
}

export interface ProcessSaleInput {
  items: Array<ProductView & { quantity: number }>;
  paymentMethod: PaymentMethod;
  amountTendered: Money;
}

export interface LoginInput {
  username: string;
  pin: string;
}

export interface LoginResponse {
  user: User;
  tenant: Tenant;
  store: Store;
  token: string;
}
