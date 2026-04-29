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
    return this.paymentService.createTransaction(orderId);
  }

  @Post("notification")
  async notification(@Body() notification: any) {
    return this.paymentService.handleNotification(notification);
  }
}
