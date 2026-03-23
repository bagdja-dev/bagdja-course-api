import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpsertBookDto {
  @ApiProperty({ example: "tailwind-ui-systems" })
  @IsString()
  slug!: string;

  @ApiProperty({ example: "Tailwind UI Systems" })
  @IsString()
  title!: string;

  @ApiProperty({ example: "A practical guide..." })
  @IsString()
  subtitle!: string;

  @ApiProperty({ example: "Bagdja Editorial" })
  @IsString()
  author!: string;

  @ApiProperty({ example: 184 })
  @IsInt()
  @Min(0)
  pages!: number;

  @ApiProperty({ example: 159000 })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 4.8 })
  @IsNumber()
  rating!: number;

  @ApiProperty({ example: ["Tailwind", "Components"], required: false })
  @IsOptional()
  topics?: string[];

  @ApiProperty({ example: "Description..." })
  @IsString()
  description!: string;
}

