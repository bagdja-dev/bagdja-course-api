import { Injectable, NotFoundException } from "@nestjs/common";

import { SupabaseService } from "@/common/supabase/supabase.service";

type BookRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  pages: number;
  price: number;
  rating: number;
  topics: unknown;
  description: string;
  cover_path?: string | null;
  created_at: string;
};

type BookResponse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  pages: number;
  price: number;
  rating: number;
  topics: string[];
  description: string;
  coverPath?: string | null;
  coverUrl?: string | null;
  createdAt: string;
};

function toTopics(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function mapBook(row: BookRow): BookResponse {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    author: row.author,
    pages: row.pages,
    price: row.price,
    rating: Number(row.rating),
    topics: toTopics(row.topics),
    description: row.description,
    coverPath: row.cover_path ?? null,
    createdAt: row.created_at
  };
}

@Injectable()
export class BooksService {
  constructor(private readonly supabase: SupabaseService) {}

  private coverUrl(path?: string | null) {
    if (!path) return null;
    const { data } = this.supabase.db.storage.from("book-covers").getPublicUrl(path);
    return data.publicUrl;
  }

  async listBooks() {
    const { data, error } = await this.supabase.db
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as BookRow[];
    return {
      data: rows.map((r) => {
        const b = mapBook(r);
        return { ...b, coverUrl: this.coverUrl(b.coverPath) };
      })
    };
  }

  async getBookBySlug(slug: string) {
    const { data: book, error } = await this.supabase.db
      .from("books")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!book) throw new NotFoundException("Book not found");
    const b = mapBook(book as BookRow);
    return { data: { ...b, coverUrl: this.coverUrl(b.coverPath) } };
  }
}
