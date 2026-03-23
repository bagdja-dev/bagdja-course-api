import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { readFile } from "fs/promises";

import { SupabaseService } from "@/common/supabase/supabase.service";

import type { UpsertBookDto } from "./dto/book.dto";
import type { UpsertCourseDto } from "./dto/course.dto";
import type { UpsertEventDto } from "./dto/event.dto";
import type { UpsertLocationDto } from "./dto/location.dto";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  mode: "online" | "offline";
  level: "beginner" | "intermediate" | "advanced";
  duration_hours: number;
  lessons: number;
  price: number;
  rating: number;
  highlights: unknown;
  created_at: string;
};

type CourseSessionRow = {
  id: string;
  course_id: string;
  label: string;
  start_date: string;
  end_date?: string | null;
  time: string;
};

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

type LocationRow = {
  id: string;
  city: string;
  address: string;
  notes: string;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
};

type LocationImageRow = {
  id: string;
  location_id: string;
  path: string;
  sort_order: number;
  created_at: string;
};

type BookingRow = {
  id: string;
  user_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string;
  quantity: number;
  status: "reserved" | "confirmed" | "cancelled";
  created_at: string;
  course_id: string;
  session_id: string;
  location_id: string | null;
  order_id: string | null;
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  type: "webinar" | "workshop" | "meetup";
  start_at: string;
  end_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toJsonArray(values?: string[]) {
  return Array.isArray(values) ? values : [];
}

@Injectable()
export class AdminService {
  constructor(private readonly supabase: SupabaseService) {}

  async listCourses() {
    const { data, error } = await this.supabase.db.from("courses").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return { data: (data ?? []) as CourseRow[] };
  }

  async getCourseBySlug(slug: string) {
    const { data: course, error } = await this.supabase.db.from("courses").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!course) throw new NotFoundException("Course not found");
    const typed = course as CourseRow;

    const { data: sessions, error: sessionsError } = await this.supabase.db
      .from("course_sessions")
      .select("*")
      .eq("course_id", typed.id)
      .order("start_date", { ascending: true });
    if (sessionsError) throw sessionsError;

    return { data: { ...typed, sessions: (sessions ?? []) as CourseSessionRow[] } };
  }

  async deleteCourseBySlug(slug: string) {
    const { data: course, error } = await this.supabase.db.from("courses").select("id,slug,title").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!course) throw new NotFoundException("Course not found");
    const courseId = (course as any).id as string;

    const { count, error: countError } = await this.supabase.db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      throw new BadRequestException("Cannot delete course with existing bookings");
    }

    const { data: deleted, error: deleteError } = await this.supabase.db.from("courses").delete().eq("id", courseId).select("*").maybeSingle();
    if (deleteError) throw deleteError;
    if (!deleted) throw new NotFoundException("Course not found");
    return { data: { deleted: true, slug } };
  }

  async upsertCourse(dto: UpsertCourseDto) {
    const payload = {
      slug: dto.slug,
      title: dto.title,
      tagline: dto.tagline,
      mode: dto.mode,
      level: dto.level,
      duration_hours: dto.durationHours,
      lessons: dto.lessons,
      price: dto.price,
      rating: dto.rating,
      highlights: toJsonArray(dto.highlights)
    };

    const { data, error } = await this.supabase.db
      .from("courses")
      .upsert(payload, { onConflict: "slug" })
      .select("*")
      .single();
    if (error) throw error;
    const course = data as CourseRow;

    if (Array.isArray(dto.sessions)) {
      await this.supabase.db.from("course_sessions").delete().eq("course_id", course.id);
      const rows = dto.sessions
        .filter((s) => s && s.label && s.startDate && s.time)
        .map((s) => ({
          course_id: course.id,
          label: s.label,
          start_date: s.startDate,
          end_date: (s.endDate ?? s.startDate) as string,
          time: s.time
        }));
      if (rows.length) {
        const { error: insertError } = await this.supabase.db.from("course_sessions").insert(rows);
        if (insertError) throw insertError;
      }
    }

    return { data: course };
  }

  async listBooks() {
    const { data, error } = await this.supabase.db.from("books").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as BookRow[];
    const mapped = rows.map((b) => {
      const coverPath = b.cover_path ?? null;
      const coverUrl = coverPath ? this.supabase.db.storage.from("book-covers").getPublicUrl(coverPath).data.publicUrl : null;
      return { ...b, coverUrl };
    });
    return { data: mapped };
  }

  async getBookBySlug(slug: string) {
    const { data, error } = await this.supabase.db.from("books").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException("Book not found");
    const b = data as BookRow;
    const coverPath = b.cover_path ?? null;
    const coverUrl = coverPath ? this.supabase.db.storage.from("book-covers").getPublicUrl(coverPath).data.publicUrl : null;
    return { data: { ...b, coverUrl } };
  }

  async upsertBook(dto: UpsertBookDto) {
    const payload = {
      slug: dto.slug,
      title: dto.title,
      subtitle: dto.subtitle,
      author: dto.author,
      pages: dto.pages,
      price: dto.price,
      rating: dto.rating,
      topics: toJsonArray(dto.topics),
      description: dto.description
    };

    const { data, error } = await this.supabase.db
      .from("books")
      .upsert(payload, { onConflict: "slug" })
      .select("*")
      .single();
    if (error) throw error;
    return { data };
  }

  async uploadBookCover(
    slug: string,
    file?: { buffer?: Buffer; mimetype?: string; path?: string; originalname?: string }
  ) {
    if (!file) throw new BadRequestException("file is required");
    if (!file.mimetype?.startsWith("image/")) throw new BadRequestException("Only image files are allowed");

    const bytes = file.buffer ?? (file.path ? await readFile(file.path) : null);
    if (!bytes) throw new BadRequestException("Invalid file (no buffer/path)");

    const { data: book, error } = await this.supabase.db
      .from("books")
      .select("id,slug,cover_path")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!book) throw new NotFoundException("Book not found");

    const ext =
      file.mimetype === "image/png"
        ? "png"
        : file.mimetype === "image/webp"
          ? "webp"
          : file.mimetype === "image/gif"
            ? "gif"
            : "jpg";
    const path = `${slug}/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;

    const bucket = "book-covers";
    const { error: uploadError } = await this.supabase.db.storage.from(bucket).upload(path, bytes, {
      contentType: file.mimetype,
      cacheControl: "3600",
      upsert: true
    });
    if (uploadError) throw uploadError;

    const { error: updateError } = await this.supabase.db.from("books").update({ cover_path: path }).eq("id", (book as any).id);
    if (updateError) throw updateError;

    const { data: publicData } = this.supabase.db.storage.from(bucket).getPublicUrl(path);
    return { data: { coverPath: path, coverUrl: publicData.publicUrl } };
  }

  async deleteBookBySlug(slug: string) {
    const { data: book, error } = await this.supabase.db
      .from("books")
      .select("id,slug,cover_path")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!book) throw new NotFoundException("Book not found");

    const coverPath = (book as any).cover_path as string | null | undefined;
    if (coverPath) {
      const { error: removeError } = await this.supabase.db.storage.from("book-covers").remove([coverPath]);
      if (removeError) throw removeError;
    }

    const { error: deleteError } = await this.supabase.db.from("books").delete().eq("id", (book as any).id);
    if (deleteError) throw deleteError;

    return { data: { deleted: true, slug } };
  }

  async listLocations() {
    const { data, error } = await this.supabase.db.from("locations").select("*").order("city", { ascending: true });
    if (error) throw error;
    const locations = (data ?? []) as LocationRow[];
    if (!locations.length) return { data: [] };

    const ids = locations.map((l) => l.id);
    const { data: images, error: imgError } = await this.supabase.db
      .from("location_images")
      .select("*")
      .in("location_id", ids)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (imgError) throw imgError;

    const byLocation = new Map<string, LocationImageRow[]>();
    for (const img of (images ?? []) as LocationImageRow[]) {
      const arr = byLocation.get(img.location_id) ?? [];
      arr.push(img);
      byLocation.set(img.location_id, arr);
    }

    const bucket = "location-images";
    const mapped = locations.map((l) => {
      const imgs = byLocation.get(l.id) ?? [];
      const imageUrls = imgs.map((img) => this.supabase.db.storage.from(bucket).getPublicUrl(img.path).data.publicUrl);
      return { ...l, images: imgs, imageUrls };
    });
    return { data: mapped };
  }

  async getLocationById(id: string) {
    const locationId = String(id ?? "").trim();
    if (!locationId) throw new BadRequestException("id is required");

    const { data, error } = await this.supabase.db.from("locations").select("*").eq("id", locationId).maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException("Location not found");
    const location = data as LocationRow;

    const { data: images, error: imgError } = await this.supabase.db
      .from("location_images")
      .select("*")
      .eq("location_id", locationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (imgError) throw imgError;

    const bucket = "location-images";
    const imgs = (images ?? []) as LocationImageRow[];
    const imageUrls = imgs.map((img) => this.supabase.db.storage.from(bucket).getPublicUrl(img.path).data.publicUrl);

    return { data: { ...location, images: imgs, imageUrls } };
  }

  async upsertLocation(dto: UpsertLocationDto) {
    const { data, error } = await this.supabase.db
      .from("locations")
      .upsert(
        {
          id: dto.id,
          city: dto.city,
          address: dto.address,
          notes: dto.notes,
          lat: dto.lat ?? null,
          lng: dto.lng ?? null
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    return { data };
  }

  async deleteLocationById(id: string) {
    const locationId = String(id ?? "").trim();
    if (!locationId) throw new BadRequestException("id is required");

    const { data: location, error: locError } = await this.supabase.db
      .from("locations")
      .select("id,city")
      .eq("id", locationId)
      .maybeSingle();
    if (locError) throw locError;
    if (!location) throw new NotFoundException("Location not found");

    const { count, error: countError } = await this.supabase.db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      throw new BadRequestException("Cannot delete location with existing bookings");
    }

    const { data: images, error: imgError } = await this.supabase.db
      .from("location_images")
      .select("path")
      .eq("location_id", locationId);
    if (imgError) throw imgError;

    const paths = (images ?? []).map((r: any) => String(r.path)).filter(Boolean);
    if (paths.length) {
      const { error: removeError } = await this.supabase.db.storage.from("location-images").remove(paths);
      if (removeError) throw removeError;
    }

    const { data: deleted, error: deleteError } = await this.supabase.db
      .from("locations")
      .delete()
      .eq("id", locationId)
      .select("*")
      .maybeSingle();
    if (deleteError) throw deleteError;
    if (!deleted) throw new NotFoundException("Location not found");

    return { data: { deleted: true, id: locationId } };
  }

  async uploadLocationImages(
    id: string,
    files?: { buffer?: Buffer; mimetype?: string; path?: string; originalname?: string }[]
  ) {
    if (!Array.isArray(files) || files.length === 0) throw new BadRequestException("files is required");

    const { data: loc, error: locError } = await this.supabase.db.from("locations").select("id").eq("id", id).maybeSingle();
    if (locError) throw locError;
    if (!loc) throw new NotFoundException("Location not found");

    const bucket = "location-images";
    const uploaded: { id: string; path: string; url: string }[] = [];

    for (const file of files) {
      if (!file?.mimetype?.startsWith("image/")) throw new BadRequestException("Only image files are allowed");
      const bytes = file.buffer ?? (file.path ? await readFile(file.path) : null);
      if (!bytes) throw new BadRequestException("Invalid file (no buffer/path)");

      const ext =
        file.mimetype === "image/png"
          ? "png"
          : file.mimetype === "image/webp"
            ? "webp"
            : file.mimetype === "image/gif"
              ? "gif"
              : "jpg";
      const storagePath = `${id}/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;

      const { error: uploadError } = await this.supabase.db.storage.from(bucket).upload(storagePath, bytes, {
        contentType: file.mimetype,
        cacheControl: "3600",
        upsert: true
      });
      if (uploadError) throw uploadError;

      const { data: inserted, error: insertError } = await this.supabase.db
        .from("location_images")
        .insert({ location_id: id, path: storagePath })
        .select("*")
        .single();
      if (insertError) throw insertError;

      const publicUrl = this.supabase.db.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
      uploaded.push({ id: (inserted as any).id, path: storagePath, url: publicUrl });
    }

    return { data: { uploaded } };
  }

  async listEvents() {
    const { data, error } = await this.supabase.db.from("events").select("*").order("start_at", { ascending: true });
    if (error) throw error;
    return { data: (data ?? []) as EventRow[] };
  }

  async getEventBySlug(slug: string) {
    const { data, error } = await this.supabase.db.from("events").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException("Event not found");
    return { data: data as EventRow };
  }

  async upsertEvent(dto: UpsertEventDto) {
    const payload = {
      slug: dto.slug,
      title: dto.title,
      description: dto.description ?? "",
      location: dto.location ?? "",
      type: dto.type,
      start_at: dto.startAt,
      end_at: dto.endAt ?? null,
      is_active: dto.isActive ?? true,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase.db.from("events").upsert(payload, { onConflict: "slug" }).select("*").single();
    if (error) throw error;
    return { data: data as EventRow };
  }

  async deleteEventBySlug(slug: string) {
    const { data, error } = await this.supabase.db.from("events").delete().eq("slug", slug).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException("Event not found");
    return { data: { deleted: true, slug } };
  }

  async listBookings({ status }: { status?: "reserved" | "confirmed" | "cancelled" }) {
    let q = this.supabase.db.from("bookings").select("*").order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return { data: (data ?? []) as BookingRow[] };
  }

  async updateBookingStatus(id: string, status: "reserved" | "confirmed" | "cancelled") {
    const { data, error } = await this.supabase.db.from("bookings").update({ status }).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException("Booking not found");
    return { data };
  }

  async listUsers() {
    // Aggregated list: user_ids from orders and bookings (for now).
    const { data: orders, error: orderError } = await this.supabase.db
      .from("orders")
      .select("user_id, total, created_at");
    if (orderError) throw orderError;

    const { data: bookings, error: bookingError } = await this.supabase.db
      .from("bookings")
      .select("user_id, status, created_at");
    if (bookingError) throw bookingError;

    const map = new Map<string, { userId: string; orders: number; bookings: number; totalSpent: number }>();
    for (const o of (orders ?? []) as any[]) {
      const userId = String(o.user_id);
      const entry = map.get(userId) ?? { userId, orders: 0, bookings: 0, totalSpent: 0 };
      entry.orders += 1;
      entry.totalSpent += Number(o.total) || 0;
      map.set(userId, entry);
    }
    for (const b of (bookings ?? []) as any[]) {
      const userId = String(b.user_id);
      const entry = map.get(userId) ?? { userId, orders: 0, bookings: 0, totalSpent: 0 };
      entry.bookings += 1;
      map.set(userId, entry);
    }

    return { data: Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent) };
  }
}
