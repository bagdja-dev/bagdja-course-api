import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: ["reserved", "confirmed", "cancelled"], example: "confirmed" })
  @IsIn(["reserved", "confirmed", "cancelled"])
  status!: "reserved" | "confirmed" | "cancelled";
}

