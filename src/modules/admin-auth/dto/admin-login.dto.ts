import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class AdminLoginDto {
  @ApiProperty({ example: "admin@bagdja.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "password" })
  @IsString()
  @MinLength(6)
  password!: string;
}

