import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "@/common/auth/user.decorator";
import type { AuthUser } from "@/common/auth/jwt.strategy";
import { JwtAuthGuard } from "@/common/auth/jwt-auth.guard";

import { CheckoutService } from "./checkout.service";
import { CreateBookCheckoutDto } from "./dto/create-book-checkout.dto";
import { CreateCourseCheckoutDto } from "./dto/create-course-checkout.dto";

@ApiTags("checkout")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post("course")
  @ApiCreatedResponse({ description: "Create course checkout draft (order + booking)" })
  async course(@CurrentUser() user: AuthUser, @Body() dto: CreateCourseCheckoutDto) {
    return this.checkout.createCourseCheckout(user, dto);
  }

  @Post("book")
  @ApiCreatedResponse({ description: "Create book checkout draft (order)" })
  async book(@CurrentUser() user: AuthUser, @Body() dto: CreateBookCheckoutDto) {
    return this.checkout.createBookCheckout(user, dto);
  }
}

