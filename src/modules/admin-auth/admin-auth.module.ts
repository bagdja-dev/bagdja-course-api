import { Module } from "@nestjs/common";

import { AdminAuthModule as AdminJwtModule } from "@/common/admin-auth/admin-auth.module";

import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";

@Module({
  imports: [AdminJwtModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService]
})
export class AdminAuthFeatureModule {}

