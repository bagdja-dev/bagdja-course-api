import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsInt, IsString, Min } from "class-validator";

export class CreateBookCheckoutDto {
  @ApiProperty({ example: "tailwind-ui-systems" })
  @IsString()
  bookSlug!: string;

  @ApiProperty({ example: "you@email.com" })
  @IsEmail()
  buyerEmail!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

