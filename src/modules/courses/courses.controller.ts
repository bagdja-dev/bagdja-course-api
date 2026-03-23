import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CoursesService } from "./courses.service";

@ApiTags("courses")
@Controller("courses")
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @ApiQuery({ name: "mode", required: false, enum: ["online", "offline"] })
  @ApiOkResponse({ description: "List courses" })
  async list(@Query("mode") mode?: "online" | "offline") {
    return this.courses.listCourses({ mode });
  }

  @Get(":slug")
  @ApiParam({ name: "slug" })
  @ApiOkResponse({ description: "Course detail + sessions" })
  async detail(@Param("slug") slug: string) {
    return this.courses.getCourseBySlug(slug);
  }
}

