import { Injectable, InternalServerErrorException, NotFoundException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// @ts-ignore
import * as midtransClient from "midtrans-client";

import { SupabaseService } from "@/common/supabase/supabase.service";
import { MessagingService } from "../users/messaging.service";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private snap: any;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly messagingService: MessagingService
  ) {
    this.snap = new midtransClient.Snap({
      isProduction: this.config.get<string>("MIDTRANS_IS_PRODUCTION") === "true",
      serverKey: this.config.get<string>("MIDTRANS_SERVER_KEY"),
      clientKey: this.config.get<string>("MIDTRANS_CLIENT_KEY")
    });
  }

  async createTransaction(orderId: string) {
    this.logger.log(`Creating transaction for Order: ${orderId}`);
    const { data: order, error: orderError } = await this.supabase.db
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      this.logger.error(`Order not found: ${orderId}`, orderError);
      throw new NotFoundException("Order not found");
    }

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
      this.logger.log(`Midtrans Transaction Created: ${transaction.token}`);
      return {
        token: transaction.token,
        redirect_url: transaction.redirect_url
      };
    } catch (err: any) {
      this.logger.error("Midtrans Error Detail:", err);
      const errorMessage = err?.ApiResponse?.error_messages?.[0] || err.message || "Unknown Midtrans error";
      throw new InternalServerErrorException(`Midtrans Error: ${errorMessage}`);
    }
  }

  async handleNotification(notification: any) {
    this.logger.log("Received notification from Midtrans");
    try {
      const statusResponse = await this.snap.transaction.notification(notification);
      this.logger.debug(`Midtrans Status Response: ${JSON.stringify(statusResponse)}`);
      
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

      this.logger.log(`Order ${orderId} status determined: ${status}`);

      if (status === "paid") {
        const { data: order, error: updateError } = await this.supabase.db
          .from("orders")
          .update({ status: "paid" })
          .eq("id", orderId)
          .select("*, order_items(*)")
          .single();

        if (updateError) {
          this.logger.error(`Failed to update order ${orderId} to paid`, updateError);
        }

        if (!updateError && order) {
          this.logger.log(`Order ${orderId} updated to PAID. Updating bookings...`);
          await this.supabase.db.from("bookings").update({ status: "confirmed" }).eq("order_id", orderId);

          const customerEmail = order.metadata?.attendeeEmail || order.metadata?.buyerEmail;
          
          if (customerEmail) {
            const isBook = order.kind === "book";
            const templateName = "OrderSuccess";
            
            const context = {
              username: order.metadata?.attendeeName || "Customer",
              planName: order.order_items[0]?.title || (isBook ? "E-Book" : "Course"),
              price: order.total.toLocaleString(),
              duration: isBook ? "Lifetime" : "Course Access",
              expiryDate: "N/A",
              appName: "Bagdja Course"
            };

            this.logger.log(`[PaymentService] Triggering email to ${customerEmail} using template ${templateName}`);
            this.messagingService
              .sendEmail(customerEmail, templateName, context, "books-and-course-store")
              .then(() => this.logger.log(`[PaymentService] Platform Email sent successfully to ${customerEmail}`))
              .catch((mailErr) => this.logger.error("[PaymentService] Failed to send platform email:", mailErr));
          } else {
            this.logger.warn(`No customer email found for order ${orderId}`);
          }
        }
      } else if (status === "cancelled") {
        this.logger.log(`Order ${orderId} marked as CANCELLED`);
        await this.supabase.db.from("orders").update({ status: "cancelled" }).eq("id", orderId);
        await this.supabase.db.from("bookings").update({ status: "cancelled" }).eq("order_id", orderId);
      }

      return { status: "ok" };
    } catch (error) {
      this.logger.error("Error handling Midtrans notification", error);
      throw error;
    }
  }
}
