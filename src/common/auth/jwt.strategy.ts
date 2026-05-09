import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export type AuthUser = {
  userId: string;
  email?: string;
  username?: string;
};

type JwtPayload = {
  sub: string;
  email?: string;
  username?: string;
  type?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET") ?? "default-secret"
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Jika token adalah client_app token, kita mungkin ingin menolaknya untuk autentikasi user
    if (payload.type === "client_app") {
      throw new UnauthorizedException("Client app tokens cannot be used for user authentication");
    }

    return {
      userId: payload.sub,
      email: payload.email,
      username: payload.username
    };
  }
}
