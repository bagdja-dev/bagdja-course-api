import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpsertCourseDto {
  @ApiProperty({ example: "nextjs-production-frontend" })
  @IsString()
  slug!: string;

  @ApiProperty({ example: "Next.js Production Frontend" })
  @IsString()
  title!: string;

  @ApiProperty({ example: "Ship fast with Pages Router, Tailwind, and real-world patterns." })
  @IsString()
  tagline!: string;

  @ApiProperty({ enum: ["online", "offline"], example: "online" })
  @IsIn(["online", "offline"])
  mode!: "online" | "offline";

  @ApiProperty({ enum: ["beginner", "intermediate", "advanced"], example: "intermediate" })
  @IsIn(["beginner", "intermediate", "advanced"])
  level!: "beginner" | "intermediate" | "advanced";

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(0)
  durationHours!: number;

  @ApiProperty({ example: 28 })
  @IsInt()
  @Min(0)
  lessons!: number;

  @ApiProperty({ example: 1490000 })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 4.8 })
  @IsNumber()
  rating!: number;

  @ApiProperty({ example: ["A", "B"], required: false })
  @IsOptional()
  highlights?: string[];

  @ApiProperty({
    required: false,
    example: [{ label: "Weekend Cohort", startDate: "2026-04-04", endDate: "2026-04-05", time: "09:00–12:00 WIB" }]
  })
  @IsOptional()
  sessions?: { label: string; startDate: string; endDate?: string; time: string }[];
}
