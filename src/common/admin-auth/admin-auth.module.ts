import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { AdminJwtStrategy } from "./admin-jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>("ADMIN_JWT_SECRET") ?? "default-admin-secret",
        signOptions: { expiresIn: "2h" }
      }),
      inject: [ConfigService]
    })
  ],
  providers: [AdminJwtStrategy],
  exports: [JwtModule]
})
export class AdminAuthModule {}

