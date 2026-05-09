import { Controller, Post, Get, UseGuards, Request } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post("sync")
  async sync(@Request() req: any) {
    // Ambil token dari header authorization yang dikirim FE
    const token = req.headers.authorization.split(" ")[1];
    return this.usersService.syncUser(token);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getMe(@Request() req: any) {
    return this.usersService.findOne(req.user.userId);
  }
}
