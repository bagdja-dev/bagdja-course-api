import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export type AdminUser = {
  adminId: string;
  email: string;
  name?: string;
};

type AdminJwtPayload = {
  sub: string;
  email: string;
  name?: string;
  typ: "admin";
};

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, "admin-jwt") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("ADMIN_JWT_SECRET") ?? "default-admin-secret"
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AdminUser> {
    return { adminId: payload.sub, email: payload.email, name: payload.name };
  }
}

