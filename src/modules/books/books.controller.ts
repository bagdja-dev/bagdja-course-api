import { Controller, Get, Param } from "@nestjs/common";
import { ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";

import { BooksService } from "./books.service";

@ApiTags("books")
@Controller("books")
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  @ApiOkResponse({ description: "List books" })
  async list() {
    return this.books.listBooks();
  }

  @Get(":slug")
  @ApiParam({ name: "slug" })
  @ApiOkResponse({ description: "Book detail" })
  async detail(@Param("slug") slug: string) {
    return this.books.getBookBySlug(slug);
  }
}

