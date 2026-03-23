import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class UpsertLocationDto {
  @ApiProperty({ example: "jakarta" })
  @IsString()
  id!: string;

  @ApiProperty({ example: "Jakarta" })
  @IsString()
  city!: string;

  @ApiProperty({ example: "Sudirman Park..." })
  @IsString()
  address!: string;

  @ApiProperty({ example: "Near MRT" })
  @IsString()
  notes!: string;

  @ApiProperty({ required: false, example: -6.2088 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ required: false, example: 106.8456 })
  @IsOptional()
  @IsNumber()
  lng?: number;
}
