import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "@/common/auth/jwt-auth.guard";
import { CurrentUser } from "@/common/auth/user.decorator";
import type { AuthUser } from "@/common/auth/jwt.strategy";

import { OrdersService } from "./orders.service";

@ApiTags("orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOkResponse({ description: "List orders for current user" })
  async list(@CurrentUser() user: AuthUser) {
    return this.orders.listOrders(user);
  }

  @Get(":id")
  @ApiParam({ name: "id" })
  @ApiOkResponse({ description: "Order detail for current user" })
  async detail(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.orders.getOrderById(user, id);
  }
}

