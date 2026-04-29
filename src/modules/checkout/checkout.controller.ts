import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "@/common/auth/user.decorator";
import type { AuthUser } from "@/common/auth/jwt.strategy";
import { JwtAuthGuard } from "@/common/auth/jwt-auth.guard";

import { CheckoutService } from "./checkout.service";
import { CreateBookCheckoutDto } from "./dto/create-book-checkout.dto";
import { CreateCourseCheckoutDto } from "./dto/create-course-checkout.dto";

@ApiTags("checkout")
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post("course")
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: "Create course checkout draft (order + booking)" })
  async course(@Body() dto: CreateCourseCheckoutDto, @CurrentUser() user?: AuthUser) {
    return this.checkout.createCourseCheckout(dto, user);
  }

  @Post("book")
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: "Create book checkout draft (order)" })
  async book(@Body() dto: CreateBookCheckoutDto, @CurrentUser() user?: AuthUser) {
    return this.checkout.createBookCheckout(dto, user);
  }
}

