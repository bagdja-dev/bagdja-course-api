import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { BagdjaLogger } from "@bagdja/node-sdk";
import { SupabaseService } from "@/common/supabase/supabase.service";
import { MessagingService } from "../users/messaging.service";
import { OrdersService } from "../orders/orders.service";

@Injectable()
export class PaymentService {
  private readonly logger: BagdjaLogger;
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
    this.authApiUrl = this.config.get<string>("BAGDJA_AUTH_API") || "https://auth.bagdja.com";
    this.paymentApiUrl = this.config.get<string>("BAGDJA_PAYMENT_API") || "https://payment.bagdja.com";
  }

  async createTransaction(orderId: string, authorization?: string) {
    this.logger.info('Create payment request started', {
      data: { orderId, authorizationProvided: Boolean(authorization) },
    });
    this.logger.info(`Creating transaction for Order: ${orderId}`);
    const { data: order, error: orderError } = await this.supabase.db
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      this.logger.fail(`Order not found: ${orderId}`, {
        data: { orderId, error: orderError },
      });
      throw new NotFoundException("Order not found");
    }

    if (!order.metadata?.platformProductId) {
      throw new InternalServerErrorException("Order has no platformProductId");
    }
    this.logger.info(`Routing ${order.kind} transaction ${orderId} to Bagdja Platform...`, {
      data: { orderId, kind: order.kind },
    });
    return this.createPlatformTransaction(order, "PRODUCT", authorization);
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

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`[AuthClient] POST /auth/client failed: ${response.status} ${text}`);
      throw new InternalServerErrorException("Failed to obtain Bagdja client token");
    }

    const data = (await response.json()) as { "x-api-token"?: string; expires_in?: number };
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

  private async createPlatformTransaction(
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
      this.logger.info(`[PlatformRequest] initialize transaction ${order.id} to ${targetUrl}`, {
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
        this.logger.fail(`[PlatformError] Status: ${response.status} ${response.statusText}`, {
          data: { responseBody: errorText },
        });
        this.logger.fail(`[PlatformError] Response Body`, {
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
      this.logger.info(`Platform Transaction Initialized: ${data.refNumber}`, {
        data: { refNumber: data.refNumber, checkoutUrl: data.checkoutUrl },
      });

      let checkoutUrl = String(data.checkoutUrl || "");
      const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
      const authToken = tokenMatch?.[1];
      if (authToken) {
        try {
          const url = new URL(checkoutUrl);
          url.searchParams.set("auth_token", authToken);
          checkoutUrl = url.toString();
        } catch {
          this.logger.warn("Unable to append auth_token to checkoutUrl", { checkoutUrl });
        }
      }

      // Update order with platform refNumber for tracking
      const { error: updateError } = await this.supabase.db
        .from("orders")
        .update({
          platform_ref_number: data.refNumber,
        })
        .eq("id", order.id);

      if (updateError) {
        this.logger.error(`Failed to update order with platform_ref_number: ${order.id}`, {
          data: { updateError },
        });
      } else {
        this.logger.info(`Successfully updated order ${order.id} with platform_ref_number ${data.refNumber}`, {
          data: { orderId: order.id, refNumber: data.refNumber },
        });
      }

      return {
        token: '',
        redirect_url: checkoutUrl,
        refNumber: data.refNumber as string,
      };
    } catch (err: any) {
      this.logger.fail("Platform Integration Error:", err);
      throw new InternalServerErrorException(`Platform Integration Error: ${err.message}`);
    }
  }

  async handleBroadcastPaid(payload: any) {
    this.logger.info(`[Broadcast] Raw Payload: ${JSON.stringify(payload)}`);

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

    this.logger.info(
      `[Broadcast] Extracted - Ref: ${refNumber}, appId: ${appId ?? "(none)"}, Metadata keys: ${metadata && typeof metadata === "object" ? Object.keys(metadata).join(",") : "(none)"
      }`
    );

    if (!refNumber) {
      this.logger.fail(`[Broadcast] Missing refNumber in payload`);
      throw new NotFoundException("Missing refNumber");
    }

    // 1. Find Order - Try localOrderId from metadata first, then refNumber
    const orderLookupId = metadata?.localOrderId || refNumber;
    this.logger.info(`[Broadcast] Final Order Lookup ID: ${orderLookupId}`);

    const order = await this.ordersService.findOrderById(orderLookupId);
    if (!order) {
      this.logger.fail(`[Broadcast] Order not found for lookup ID: ${orderLookupId} (refNumber: ${refNumber})`);
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
      this.logger.info(`[Broadcast] Order ${order.id} status updated to PAID`);
    } else {
      this.logger.info(`[Broadcast] Order ${order.id} status already PAID; not updating status`);
    }

    // 3. Get User Details for Email
    const { data: user, error: userError } = await this.supabase.db
      .from("users")
      .select("*")
      .eq("id", order.user_id)
      .single();

    if (userError || !user) {
      this.logger.fail(`[Broadcast] User not found for order ${order.id}`, {
        data: { userError },
      });
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

      this.logger.info(
        `[Broadcast] Sending email via MessagingService: to=${user.email}, template=OrderSuccess, appId=${appName ?? "(none)"
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
      this.logger.info(`[Broadcast] Confirmation email sent to ${user.email}`);

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
          this.logger.fail(`[Broadcast] Failed to persist emailSentAt for order ${order.id}`, {
            data: { metaErr },
          });
        } else {
          this.logger.info(`[Broadcast] Persisted emailSentAt for order ${order.id}`);
        }
      } catch (persistErr) {
        this.logger.fail(`[Broadcast] Failed to persist emailSentAt (unexpected)`, persistErr as any);
      }
    } catch (emailErr) {
      this.logger.fail(`[Broadcast] Failed to send confirmation email`, {
        data: { emailErr },
      });
    }

    return { success: true };
  }
}
