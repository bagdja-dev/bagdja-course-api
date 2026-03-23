import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AdminUser } from "./admin-jwt.strategy";

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext): AdminUser => {
  const request = ctx.switchToHttp().getRequest<{ user: AdminUser }>();
  return request.user;
});

