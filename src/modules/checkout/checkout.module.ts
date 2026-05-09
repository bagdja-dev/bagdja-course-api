import { Module } from "@nestjs/common";

import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [UsersModule],
  controllers: [CheckoutController],
  providers: [CheckoutService]
})
export class CheckoutModule {}

