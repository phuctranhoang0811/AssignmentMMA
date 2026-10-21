import { Product } from '../types/product';
import { Order, CartItem, FulfillmentType, PaymentMethod } from '../types/order';
import { DemoUser, Coupon } from '../types/user';

export type ProductFilterParams = {
  categoryId?: string;
  query?: string;
  sort?: 'popular' | 'price_asc' | 'price_desc';
  maxPrice?: number;
  onlyAvailable?: boolean;
};

export type CreateOrderInput = {
  customer: {
    fullname: string;
    phone: string;
    email?: string;
  };
  fulfillmentType: FulfillmentType;
  address?: string;
  items: CartItem[];
  promoCode?: string;
  paymentMethod: PaymentMethod;
  userId?: string;
  idempotencyKey?: string;
};

export interface ProductService {
  list(params?: ProductFilterParams): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
}

export interface OrderService {
  create(input: CreateOrderInput): Promise<Order>;
  list(userId?: string): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  cancel(id: string): Promise<Order>;
  advanceDemoStatus(id: string): Promise<Order>;
}

export interface AuthService {
  login(email: string, password?: string): Promise<DemoUser>;
  register(name: string, email: string, phone: string): Promise<DemoUser>;
}

export interface PromoService {
  validate(code: string, subtotal: number): Promise<{ isValid: boolean; coupon?: Coupon; message?: string }>;
  listAvailable(): Promise<Coupon[]>;
}
