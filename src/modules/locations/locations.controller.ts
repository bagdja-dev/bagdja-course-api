import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { LocationsService } from "./locations.service";

@ApiTags("locations")
@Controller("locations")
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @ApiOkResponse({ description: "List course locations" })
  async list() {
    return this.locations.listLocations();
  }
}

