import { Injectable, NotFoundException } from "@nestjs/common";

import type { AuthUser } from "@/common/auth/jwt.strategy";
import { SupabaseService } from "@/common/supabase/supabase.service";

type OrderRow = {
  id: string;
  user_id: string;
  kind: "course" | "book";
  currency: "IDR";
  status: "pending" | "paid" | "cancelled";
  subtotal: number;
  total: number;
  metadata: Record<string, unknown>;
  platform_ref_number?: string;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_type: "course" | "book";
  product_slug: string;
  title: string;
  unit_price: number;
  quantity: number;
  amount: number;
};

type OrderResponse = {
  id: string;
  userId: string;
  kind: "course" | "book";
  currency: "IDR";
  status: "pending" | "paid" | "cancelled";
  subtotal: number;
  total: number;
  metadata: Record<string, unknown>;
  platformRefNumber?: string;
  createdAt: string;
};

type OrderItemResponse = {
  id: string;
  orderId: string;
  productType: "course" | "book";
  productSlug: string;
  title: string;
  unitPrice: number;
  quantity: number;
  amount: number;
};

function mapOrder(row: OrderRow): OrderResponse {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    currency: row.currency,
    status: row.status,
    subtotal: row.subtotal,
    total: row.total,
    metadata: row.metadata,
    platformRefNumber: row.platform_ref_number,
    createdAt: row.created_at
  };
}

function mapOrderItem(row: OrderItemRow): OrderItemResponse {
  return {
    id: row.id,
    orderId: row.order_id,
    productType: row.product_type,
    productSlug: row.product_slug,
    title: row.title,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    amount: row.amount
  };
}

@Injectable()
export class OrdersService {
  constructor(private readonly supabase: SupabaseService) {}

  async listOrders(user: AuthUser) {
    const { data, error } = await this.supabase.db
      .from("orders")
      .select("*")
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as OrderRow[];
    return { data: rows.map(mapOrder) };
  }

  async getOrderById(user: AuthUser, id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let query = this.supabase.db
      .from("orders")
      .select("*")
      .eq("user_id", user.userId);

    if (isUuid) {
      query = query.or(`id.eq.${id},platform_ref_number.eq.${id}`);
    } else {
      query = query.eq("platform_ref_number", id);
    }

    const { data: order, error } = await query.maybeSingle();
    
    if (error) throw error;
    if (!order) throw new NotFoundException("Order not found");
    const typedOrder = order as OrderRow;

    const { data: items, error: itemsError } = await this.supabase.db
      .from("order_items")
      .select("*")
      .eq("order_id", typedOrder.id);
    if (itemsError) throw itemsError;

    const typedItems = (items ?? []) as OrderItemRow[];
    return { data: { order: mapOrder(typedOrder), items: typedItems.map(mapOrderItem) } };
  }

  async findOrderById(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let query = this.supabase.db
      .from("orders")
      .select("*, order_items(*)");

    if (isUuid) {
      query = query.or(`id.eq.${id},platform_ref_number.eq.${id}`);
    } else {
      query = query.eq("platform_ref_number", id);
    }

    const { data: order, error } = await query.maybeSingle();
    if (error) throw error;
    return order;
  }

  async updateOrderStatus(id: string, status: "pending" | "paid" | "cancelled") {
    const { data, error } = await this.supabase.db
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
