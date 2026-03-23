import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class UpsertEventDto {
  @ApiProperty({ example: "frontend-bootcamp-jkt" })
  @IsString()
  slug!: string;

  @ApiProperty({ example: "Frontend Bootcamp Jakarta" })
  @IsString()
  title!: string;

  @ApiProperty({ example: "Hands-on workshop for building production UIs.", required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: "Jakarta", required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ enum: ["webinar", "workshop", "meetup"], example: "workshop" })
  @IsIn(["webinar", "workshop", "meetup"])
  type!: "webinar" | "workshop" | "meetup";

  @ApiProperty({ example: "2026-04-10T09:00:00+07:00" })
  @IsString()
  startAt!: string;

  @ApiProperty({ required: false, example: "2026-04-10T17:00:00+07:00" })
  @IsOptional()
  @IsString()
  endAt?: string | null;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

