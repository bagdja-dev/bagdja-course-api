import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateCourseCheckoutDto {
  @ApiProperty({ example: "nextjs-production-frontend" })
  @IsString()
  courseSlug!: string;

  @ApiProperty({ example: "s1" })
  @IsString()
  sessionId!: string;

  @ApiProperty({ example: "jakarta", required: false })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiProperty({ example: "Dewi Anggraini" })
  @IsString()
  attendeeName!: string;

  @ApiProperty({ example: "dewi@email.com" })
  @IsEmail()
  attendeeEmail!: string;

  @ApiProperty({ example: "08123456789" })
  @IsString()
  attendeePhone!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: "online", enum: ["online", "offline"] })
  @IsIn(["online", "offline"])
  mode!: "online" | "offline";
}

