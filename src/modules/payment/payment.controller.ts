import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "@/common/auth/jwt-auth.guard";
import { PaymentService } from "./payment.service";

@ApiTags("payment")
@Controller("payment")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiBearerAuth()
  @Post("create-transaction")
  async createTransaction(@Body("orderId") orderId: string) {
    console.log(`[PaymentController] Creating transaction for Order ID: ${orderId}`);
    return this.paymentService.createTransaction(orderId);
  }

  @Post("notification")
  async notification(@Body() notification: any) {
    try {
      console.log("==========================================");
      console.log("--- MIDTRANS WEBHOOK RECEIVED ---");
      console.log("Timestamp:", new Date().toISOString());
      console.log("Payload:", JSON.stringify(notification, null, 2));
      console.log("==========================================");
      
      const result = await this.paymentService.handleNotification(notification);
      
      console.log("--- WEBHOOK PROCESSED SUCCESSFULLY ---");
      return result;
    } catch (error: any) {
      console.error("!!! WEBHOOK PROCESSING ERROR !!!");
      console.error("Error:", error?.message || error);
      console.error("Stack:", error?.stack);
      console.log("==========================================");
      throw error;
    }
  }
}
