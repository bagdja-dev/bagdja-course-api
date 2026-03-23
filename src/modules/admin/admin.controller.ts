import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";

import { AdminJwtGuard } from "@/common/admin-auth/admin-jwt.guard";

import { UpsertBookDto } from "./dto/book.dto";
import { UpsertCourseDto } from "./dto/course.dto";
import { UpsertEventDto } from "./dto/event.dto";
import { UpsertLocationDto } from "./dto/location.dto";
import { UpdateBookingStatusDto } from "./dto/update-booking-status.dto";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("courses")
  @ApiOkResponse({ description: "Admin list courses" })
  async listCourses() {
    return this.admin.listCourses();
  }

  @Get("courses/:slug")
  @ApiParam({ name: "slug" })
  @ApiOkResponse({ description: "Admin course detail by slug" })
  async getCourse(@Param("slug") slug: string) {
    return this.admin.getCourseBySlug(slug);
  }

  @Delete("courses/:slug")
  @ApiParam({ name: "slug" })
  @ApiOkResponse({ description: "Delete course by slug" })
  async deleteCourse(@Param("slug") slug: string) {
    return this.admin.deleteCourseBySlug(slug);
  }

  @Post("courses")
  @ApiOkResponse({ description: "Upsert course by slug" })
  async upsertCourse(@Body() dto: UpsertCourseDto) {
    return this.admin.upsertCourse(dto);
  }

  @Get("books")
  @ApiOkResponse({ description: "Admin list books" })
  async listBooks() {
    return this.admin.listBooks();
  }

  @Get("books/:slug")
  @ApiParam({ name: "slug" })
  @ApiOkResponse({ description: "Admin book detail by slug" })
  async getBook(@Param("slug") slug: string) {
    return this.admin.getBookBySlug(slug);
  }

  @Delete("books/:slug")
  @ApiParam({ name: "slug" })
  @ApiOkResponse({ description: "Delete book by slug" })
  async deleteBook(@Param("slug") slug: string) {
    return this.admin.deleteBookBySlug(slug);
  }

  @Post("books")
  @ApiOkResponse({ description: "Upsert book by slug" })
  async upsertBook(@Body() dto: UpsertBookDto) {
    return this.admin.upsertBook(dto);
  }

  @Post("books/:slug/cover")
  @ApiParam({ name: "slug" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" }
      }
    }
  })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOkResponse({ description: "Upload book cover to storage and update book record" })
  async uploadBookCover(@Param("slug") slug: string, @UploadedFile() file?: any) {
    return this.admin.uploadBookCover(slug, file);
  }

  @Get("locations")
  @ApiOkResponse({ description: "Admin list locations" })
  async listLocations() {
    return this.admin.listLocations();
  }

  @Get("locations/:id")
  @ApiParam({ name: "id" })
  @ApiOkResponse({ description: "Admin location detail by id" })
  async getLocation(@Param("id") id: string) {
    return this.admin.getLocationById(id);
  }

  @Post("locations")
  @ApiOkResponse({ description: "Upsert location by id" })
  async upsertLocation(@Body() dto: UpsertLocationDto) {
    return this.admin.upsertLocation(dto);
  }

  @Delete("locations/:id")
  @ApiParam({ name: "id" })
  @ApiOkResponse({ description: "Delete location by id" })
  async deleteLocation(@Param("id") id: string) {
    return this.admin.deleteLocationById(id);
  }

  @Post("locations/:id/images")
  @ApiParam({ name: "id" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: { type: "array", items: { type: "string", format: "binary" } }
      }
    }
  })
  @UseInterceptors(FilesInterceptor("files", 10, { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOkResponse({ description: "Upload multiple images for a location" })
  async uploadLocationImages(@Param("id") id: string, @UploadedFiles() files?: any[]) {
    return this.admin.uploadLocationImages(id, files);
  }

  @Get("events")
  @ApiOkResponse({ description: "Admin list events" })
  async listEvents() {
    return this.admin.listEvents();
  }

  @Get("events/:slug")
  @ApiParam({ name: "slug" })
  @ApiOkResponse({ description: "Admin event detail by slug" })
  async getEvent(@Param("slug") slug: string) {
    return this.admin.getEventBySlug(slug);
  }

  @Post("events")
  @ApiOkResponse({ description: "Upsert event by slug" })
  async upsertEvent(@Body() dto: UpsertEventDto) {
    return this.admin.upsertEvent(dto);
  }

  @Delete("events/:slug")
  @ApiParam({ name: "slug" })
  @ApiOkResponse({ description: "Delete event by slug" })
  async deleteEvent(@Param("slug") slug: string) {
    return this.admin.deleteEventBySlug(slug);
  }

  @Get("bookings")
  @ApiQuery({ name: "status", required: false, enum: ["reserved", "confirmed", "cancelled"] })
  @ApiOkResponse({ description: "Admin list bookings" })
  async listBookings(@Query("status") status?: "reserved" | "confirmed" | "cancelled") {
    return this.admin.listBookings({ status });
  }

  @Patch("bookings/:id/status")
  @ApiParam({ name: "id" })
  @ApiOkResponse({ description: "Update booking status" })
  async updateBookingStatus(@Param("id") id: string, @Body() dto: UpdateBookingStatusDto) {
    return this.admin.updateBookingStatus(id, dto.status);
  }

  @Get("users")
  @ApiOkResponse({ description: "Admin list users (aggregated from orders/bookings)" })
  async listUsers() {
    return this.admin.listUsers();
  }
}
