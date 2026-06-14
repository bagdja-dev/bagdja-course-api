import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { JwtAuthGuard } from "@/common/auth/jwt-auth.guard";
import { PaymentService } from "./payment.service";

@ApiTags("payment")
@Controller("payment")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("create-transaction")
  async createTransaction(@Req() req: Request, @Body("orderId") orderId: string) {
    console.log(`[PaymentController] Creating transaction for Order ID: ${orderId}`);
    const authorization =
      typeof req.headers.authorization === "string"
        ? req.headers.authorization
        : Array.isArray(req.headers.authorization)
          ? req.headers.authorization[0]
          : undefined;
    return this.paymentService.createTransaction(orderId, authorization);
  }

  @Post("broadcast/paid")
  async handleBroadcastPaid(@Body() payload: any) {
    console.log("--- BROADCAST PAID RECEIVED ---");
    console.log("Payload:", JSON.stringify(payload, null, 2));
    return this.paymentService.handleBroadcastPaid(payload);
  }
}
