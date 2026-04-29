import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// @ts-ignore
import * as midtransClient from "midtrans-client";

import { SupabaseService } from "@/common/supabase/supabase.service";
import { MailService } from "@/common/mail/mail.service";

@Injectable()
export class PaymentService {
  private snap: any;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly mailService: MailService
  ) {
    this.snap = new midtransClient.Snap({
      isProduction: this.config.get<string>("MIDTRANS_IS_PRODUCTION") === "true",
      serverKey: this.config.get<string>("MIDTRANS_SERVER_KEY"),
      clientKey: this.config.get<string>("MIDTRANS_CLIENT_KEY")
    });
  }

  async createTransaction(orderId: string) {
    // 1. Get order details from DB
    const { data: order, error: orderError } = await this.supabase.db
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new NotFoundException("Order not found");
    }

    // 2. Prepare Midtrans payload
    const parameter = {
      transaction_details: {
        order_id: order.id,
        gross_amount: order.total
      },
      item_details: order.order_items.map((item: any) => ({
        id: item.product_slug,
        price: item.unit_price,
        quantity: item.quantity,
        name: item.title
      })),
      customer_details: {
        email: order.metadata?.attendeeEmail || order.metadata?.buyerEmail || ""
      }
    };

    try {
      const transaction = await this.snap.createTransaction(parameter);
      return {
        token: transaction.token,
        redirect_url: transaction.redirect_url
      };
    } catch (err: any) {
      console.error("Midtrans Error Detail:", err);
      const errorMessage = err?.ApiResponse?.error_messages?.[0] || err.message || "Unknown Midtrans error";
      throw new InternalServerErrorException(`Midtrans Error: ${errorMessage}`);
    }
  }

  async handleNotification(notification: any) {
    const statusResponse = await this.snap.transaction.notification(notification);
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    let status: "pending" | "paid" | "cancelled" = "pending";

    if (transactionStatus === "capture") {
      if (fraudStatus === "challenge") {
        status = "pending";
      } else if (fraudStatus === "accept") {
        status = "paid";
      }
    } else if (transactionStatus === "settlement") {
      status = "paid";
    } else if (transactionStatus === "cancel" || transactionStatus === "deny" || transactionStatus === "expire") {
      status = "cancelled";
    } else if (transactionStatus === "pending") {
      status = "pending";
    }

    if (status === "paid") {
      // Update order status
      const { data: order, error: updateError } = await this.supabase.db
        .from("orders")
        .update({ status: "paid" })
        .eq("id", orderId)
        .select("*, order_items(*)")
        .single();

      if (!updateError && order) {
        // Update booking status if it's a course
        await this.supabase.db.from("bookings").update({ status: "confirmed" }).eq("order_id", orderId);

        // Send confirmation email with product/receipt
        const customerEmail = order.metadata?.attendeeEmail || order.metadata?.buyerEmail;
        if (customerEmail) {
          try {
            await this.mailService.sendProductEmail(customerEmail, order);
          } catch (mailErr) {
            console.error("Failed to send success email:", mailErr);
          }
        }
      }
    } else if (status === "cancelled") {
      await this.supabase.db.from("orders").update({ status: "cancelled" }).eq("id", orderId);
      await this.supabase.db.from("bookings").update({ status: "cancelled" }).eq("order_id", orderId);
    }

    return { status: "ok" };
  }
}
