import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { AdminJwtGuard } from "@/common/admin-auth/admin-jwt.guard";
import { CurrentAdmin } from "@/common/admin-auth/admin-user.decorator";
import type { AdminUser } from "@/common/admin-auth/admin-jwt.strategy";

import { AdminLoginDto } from "./dto/admin-login.dto";
import { AdminAuthService } from "./admin-auth.service";

@ApiTags("admin-auth")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly service: AdminAuthService) {}

  @Post("login")
  @ApiCreatedResponse({ description: "Admin login (separate JWT)" })
  async login(@Body() dto: AdminLoginDto) {
    const result = await this.service.login(dto.email, dto.password);
    if (!result) throw new UnauthorizedException("Invalid credentials");
    return { data: result };
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @ApiOkResponse({ description: "Current admin from token" })
  async me(@CurrentAdmin() admin: AdminUser) {
    return { data: admin };
  }
}

