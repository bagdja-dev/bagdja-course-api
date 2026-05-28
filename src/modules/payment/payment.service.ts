import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// @ts-expect-error midtrans-client has imperfect TS typings in our setup
import * as midtransClient from "midtrans-client";

import { BagdjaLogger } from "@bagdja/node-sdk";
import { SupabaseService } from "@/common/supabase/supabase.service";
import { MessagingService } from "../users/messaging.service";
import { OrdersService } from "../orders/orders.service";

@Injectable()
export class PaymentService {
  private readonly logger: BagdjaLogger;
  private snap: any;
  private readonly authApiUrl: string;
  private readonly paymentApiUrl: string;
  /** Cached client token from POST /auth/client (short-lived) */
  private clientTokenCache: { token: string; expiresAtMs: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly messagingService: MessagingService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    logger: BagdjaLogger,
  ) {
    this.logger = logger;
    const defaultAppId = this.config.get<string>("CLIENT_APP_ID") || "books-and-course-store";
    const defaultOrgId = this.config.get<string>("BAGDJA_ORG_ID") || "system";
    this.logger.init(defaultAppId, defaultOrgId);
    this.snap = new midtransClient.Snap({
      isProduction: this.config.get<string>("MIDTRANS_IS_PRODUCTION") === "true",
      serverKey: this.config.get<string>("MIDTRANS_SERVER_KEY"),
      clientKey: this.config.get<string>("MIDTRANS_CLIENT_KEY")
    });
    this.authApiUrl = this.config.get<string>("BAGDJA_AUTH_API") || "https://auth.bagdja.com";
    this.paymentApiUrl = this.config.get<string>("BAGDJA_PAYMENT_API") || "https://payment.bagdja.com";
  }

  async createTransaction(orderId: string, authorization?: string) {
    this.logger.bagdjaLog('info', 'Create payment request started', {
      data: { orderId, authorizationProvided: Boolean(authorization) },
    });
    this.logger.log(`Creating transaction for Order: ${orderId}`);
    const { data: order, error: orderError } = await this.supabase.db
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      this.logger.bagdjaLog('error', `Order not found: ${orderId}`, {
        data: { orderId, error: orderError },
      });
      throw new NotFoundException("Order not found");
    }

    // If it has platformProductId, use Platform Payment Service
    if (order.metadata?.platformProductId) {
      this.logger.bagdjaLog('info', `Routing ${order.kind} transaction ${orderId} to Bagdja Platform...`, {
        data: { orderId, kind: order.kind },
      });
      return this.createPlatformTransaction(order, "PRODUCT", authorization);
    }

    // Fallback to legacy Midtrans direct for other types (like books)
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
      this.logger.bagdjaLog('error', "Midtrans Error Detail", {
        data: { error: err },
      });
      const errorMessage = err?.ApiResponse?.error_messages?.[0] || err.message || "Unknown Midtrans error";
      throw new InternalServerErrorException(`Midtrans Error: ${errorMessage}`);
    }
  }

  /**
   * Exchange CLIENT_APP_ID + CLIENT_APP_SECRET for a short-lived x-api-token (Bagdja Auth).
   */
  private async getBagdjaClientToken(): Promise<string> {
    const now = Date.now();
    if (this.clientTokenCache && this.clientTokenCache.expiresAtMs > now + 60_000) {
      return this.clientTokenCache.token;
    }

    const appId = this.config.get<string>("CLIENT_APP_ID");
    const appSecret = this.config.get<string>("CLIENT_APP_SECRET");
    if (!appId?.trim() || !appSecret?.trim()) {
      throw new InternalServerErrorException(
        "CLIENT_APP_ID and CLIENT_APP_SECRET must be set for platform checkout",
      );
    }

    const base = this.authApiUrl.replace(/\/$/, "");
    const url = `${base}/auth/client`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`[AuthClient] POST /auth/client failed: ${res.status} ${text}`);
      throw new InternalServerErrorException("Failed to obtain Bagdja client token");
    }

    const data = (await res.json()) as { "x-api-token"?: string; expires_in?: number };
    const token = data["x-api-token"];
    if (!token) {
      throw new InternalServerErrorException("Auth client response missing x-api-token");
    }

    const expiresInSec =
      typeof data.expires_in === "number" && Number.isFinite(data.expires_in)
        ? data.expires_in
        : 3600;
    this.clientTokenCache = {
      token,
      expiresAtMs: now + expiresInSec * 1000,
    };
    return token;
  }

  async createPlatformTransaction(
    order: any,
    itemType: string = "PRODUCT",
    authorization?: string,
  ) {
    try {
      const authHeader = authorization?.trim();
      if (!authHeader?.toLowerCase().startsWith("bearer ")) {
        throw new UnauthorizedException(
          "Authorization Bearer (Bagdja user JWT) is required for platform checkout",
        );
      }

      const clientToken = await this.getBagdjaClientToken();
      const frontendUrl = this.config.get<string>("FRONTEND_URL") || "http://localhost:3000";

      const payload = {
        userId: order.user_id,
        itemId: order.metadata?.platformProductId,
        itemType: itemType,
        amount: order.total,
        successRedirectUrl: `${frontendUrl}/profile?status=success&orderId=${order.id}`,
        failureRedirectUrl: `${frontendUrl}/checkout?status=failure&orderId=${order.id}`,
        metadata: {
          localOrderId: order.id,
          ...order.metadata,
        },
      };

      const targetUrl = `${this.paymentApiUrl}/payments/initialize`;
      this.logger.bagdjaLog('debug', `[PlatformRequest] Target URL: ${targetUrl}`, {
        data: { targetUrl },
      });
      this.logger.bagdjaLog('debug', `[PlatformRequest] Payload prepared`, {
        data: payload,
      });

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": clientToken,
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
this.logger.bagdjaLog('error', `[PlatformError] Status: ${response.status} ${response.statusText}`, {
        data: { responseBody: errorText },
      });
      this.logger.bagdjaLog('error', `[PlatformError] Response Body`, {
        data: { errorText },
      });
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        
        throw new Error(`Platform Error: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      this.logger.bagdjaLog('info', `Platform Transaction Initialized: ${data.refNumber}`, {
        data: { refNumber: data.refNumber, checkoutUrl: data.checkoutUrl },
      });

      // Update order with platform refNumber for tracking
      const { error: updateError } = await this.supabase.db
        .from("orders")
        .update({
          platform_ref_number: data.refNumber,
        })
        .eq("id", order.id);

      if (updateError) {
        this.logger.bagdjaLog('error', `Failed to update order with platform_ref_number: ${order.id}`, {
          data: { updateError },
        });
      } else {
        this.logger.bagdjaLog('info', `Successfully updated order ${order.id} with platform_ref_number ${data.refNumber}`, {
          data: { orderId: order.id, refNumber: data.refNumber },
        });
      }
      
      return {
        token: '',
        redirect_url: data.checkoutUrl as string,
        refNumber: data.refNumber as string,
      };
    } catch (err: any) {
      this.logger.error("Platform Integration Error:", err);
      throw new InternalServerErrorException(`Platform Integration Error: ${err.message}`);
    }
  }

  async handleBroadcastPaid(payload: any) {
    this.logger.log(`[Broadcast] Raw Payload: ${JSON.stringify(payload)}`);
    
    // Handle both wrapped (Event Hub) and flat structures
    const eventData = payload.data || payload;
    const refNumber = eventData.refNumber;
    const metadata = eventData.metadata;
    // Prefer appId from metadata (actual app context) over envelope appId (publisher service)
    const appId =
      metadata?.appId ||
      payload?.metadata?.appId ||
      payload?.appId ||
      eventData?.appId;

    this.logger.log(
      `[Broadcast] Extracted - Ref: ${refNumber}, appId: ${appId ?? "(none)"}, Metadata keys: ${
        metadata && typeof metadata === "object" ? Object.keys(metadata).join(",") : "(none)"
      }`
    );

    if (!refNumber) {
      this.logger.error(`[Broadcast] Missing refNumber in payload`);
      throw new NotFoundException("Missing refNumber");
    }

    // 1. Find Order - Try localOrderId from metadata first, then refNumber
    const orderLookupId = metadata?.localOrderId || refNumber;
    this.logger.log(`[Broadcast] Final Order Lookup ID: ${orderLookupId}`);
    
    const order = await this.ordersService.findOrderById(orderLookupId);
    if (!order) {
      this.logger.error(`[Broadcast] Order not found for lookup ID: ${orderLookupId} (refNumber: ${refNumber})`);
      throw new NotFoundException(`Order ${orderLookupId} not found`);
    }

    const alreadyPaid = order.status === "paid";
    const emailSentAt = order.metadata?.emailSentAt as string | undefined;
    if (alreadyPaid && emailSentAt) {
      this.logger.warn(
        `[Broadcast] Order ${orderLookupId} is already paid and emailSentAt=${emailSentAt}. Skipping email.`,
      );
      return { success: true, message: "Already processed" };
    }
    if (alreadyPaid && !emailSentAt) {
      this.logger.warn(
        `[Broadcast] Order ${orderLookupId} is already paid but no emailSentAt found. Will attempt to send email.`,
      );
    }

    // 2. Update Order Status
    if (!alreadyPaid) {
      await this.ordersService.updateOrderStatus(order.id, "paid");
      this.logger.log(`[Broadcast] Order ${order.id} status updated to PAID`);
    } else {
      this.logger.log(`[Broadcast] Order ${order.id} status already PAID; not updating status`);
    }

    // 3. Get User Details for Email
    const { data: user, error: userError } = await this.supabase.db
      .from("users")
      .select("*")
      .eq("id", order.user_id)
      .single();

    if (userError || !user) {
      this.logger.error(`[Broadcast] User not found for order ${order.id}`, userError);
      // We still return success because the payment part is done
      return { success: true, message: "Order updated but user not found for email" };
    }

    // 4. Send Success Email
    try {
      const item = order.order_items?.[0] || {};
      const appName = this.config.get<string>("APP_NAME") || "Bagdja Course";
      
      // Calculate duration and expiry (simplified)
      const duration = order.kind === "course" ? "Lifetime Access" : "Permanent Download";
      const expiryDate = "Selamanya"; // Or calculate based on product metadata if available

      this.logger.log(
        `[Broadcast] Sending email via MessagingService: to=${user.email}, template=OrderSuccess, appId=${
          appId ?? "(none)"
        }, orderId=${order.id}, kind=${order.kind}`
      );

      await this.messagingService.sendEmail(
        user.email,
        "OrderSuccess",
        {
          username: user.full_name || user.username || "Pelanggan",
          appName: appName,
          planName: item.title || "Pesanan Bagdja",
          price: order.total.toLocaleString("id-ID"),
          duration: duration,
          expiryDate: expiryDate
        },
        appId
      );
      this.logger.log(`[Broadcast] Confirmation email sent to ${user.email}`);

      // Mark as sent to make this handler idempotent for email side-effect
      try {
        const nextMetadata = {
          ...(order.metadata ?? {}),
          emailSentAt: new Date().toISOString(),
          emailTemplate: "OrderSuccess",
          emailAppId: appId ?? null,
        };
        const { error: metaErr } = await this.supabase.db
          .from("orders")
          .update({ metadata: nextMetadata })
          .eq("id", order.id);
        if (metaErr) {
          this.logger.error(`[Broadcast] Failed to persist emailSentAt for order ${order.id}`, metaErr);
        } else {
          this.logger.log(`[Broadcast] Persisted emailSentAt for order ${order.id}`);
        }
      } catch (persistErr) {
        this.logger.error(`[Broadcast] Failed to persist emailSentAt (unexpected)`, persistErr as any);
      }
    } catch (emailErr) {
      this.logger.error(`[Broadcast] Failed to send confirmation email`, emailErr);
    }

    return { success: true };
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
        this.logger.bagdjaLog('info', 'Payment success received', {
          data: { orderId, transactionStatus, fraudStatus },
        });

        const { data: order, error: updateError } = await this.supabase.db
          .from("orders")
          .update({ status: "paid" })
          .or(`id.eq.${orderId},platform_ref_number.eq.${orderId}`)
          .select("*, order_items(*)")
          .single();

        if (updateError) {
          this.logger.error(`Failed to update order ${orderId} to paid`, updateError);
        }

        if (!updateError && order) {
          const actualOrderId = order.id;
          this.logger.log(`Order ${actualOrderId} updated to PAID. Updating bookings...`);
          await this.supabase.db.from("bookings").update({ status: "confirmed" }).eq("order_id", actualOrderId);

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
            this.logger.warn(`No customer email found for order ${actualOrderId}`);
          }
        }
      } else if (status === "cancelled") {
        this.logger.log(`Order ${orderId} marked as CANCELLED`);
        // Find the order first to get the correct internal ID if needed, 
        // but .or should work for update too.
        await this.supabase.db
          .from("orders")
          .update({ status: "cancelled" })
          .or(`id.eq.${orderId},platform_ref_number.eq.${orderId}`);
        
        // For bookings, we need the internal UUID. Let's fetch the order if it was a refNumber.
        const { data: order } = await this.supabase.db
          .from("orders")
          .select("id")
          .or(`id.eq.${orderId},platform_ref_number.eq.${orderId}`)
          .single();
          
        if (order) {
          await this.supabase.db.from("bookings").update({ status: "cancelled" }).eq("order_id", order.id);
        }
      }

      return { status: "ok" };
    } catch (error) {
      this.logger.error("Error handling Midtrans notification", error);
      throw error;
    }
  }
}
