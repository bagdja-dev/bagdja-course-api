import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { EventsService } from "./events.service";

@ApiTags("events")
@Controller("events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiQuery({ name: "active", required: false, type: Boolean })
  @ApiOkResponse({ description: "List events" })
  async list(@Query("active") active?: string) {
    const onlyActive = active === undefined ? true : active === "true" || active === "1";
    return this.events.listEvents({ active: onlyActive });
  }

  @Get(":slug")
  @ApiParam({ name: "slug" })
  @ApiOkResponse({ description: "Event detail" })
  async detail(@Param("slug") slug: string) {
    return this.events.getEventBySlug(slug);
  }
}

