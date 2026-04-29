import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthUser } from "@/common/auth/jwt.strategy";
import { SupabaseService } from "@/common/supabase/supabase.service";

import type { CreateBookCheckoutDto } from "./dto/create-book-checkout.dto";
import type { CreateCourseCheckoutDto } from "./dto/create-course-checkout.dto";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  mode: "online" | "offline";
  price: number;
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
  price: number;
};

type OrderRow = {
  id: string;
  user_id: string;
  kind: "course" | "book";
  currency: "IDR";
  status: "pending" | "paid" | "cancelled";
  subtotal: number;
  total: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_type: "course" | "book";
  product_slug: string;
  title: string;
  unit_price: number;
  quantity: number;
  amount: number;
};

@Injectable()
export class CheckoutService {
  constructor(private readonly supabase: SupabaseService) {}

  async createCourseCheckout(dto: CreateCourseCheckoutDto, user?: AuthUser) {
    const { data: course, error: courseError } = await this.supabase.db
      .from("courses")
      .select("id,slug,title,mode,price")
      .eq("slug", dto.courseSlug)
      .maybeSingle();
    if (courseError) throw courseError;
    if (!course) throw new NotFoundException("Course not found");
    const typedCourse = course as CourseRow;

    if (dto.mode !== typedCourse.mode) {
      throw new BadRequestException("Mode mismatch");
    }
    if (typedCourse.mode === "offline" && !dto.locationId) {
      throw new BadRequestException("locationId is required for offline course");
    }

    const { data: session, error: sessionError } = await this.supabase.db
      .from("course_sessions")
      .select("id,course_id,label,start_date,end_date,time")
      .eq("id", dto.sessionId)
      .eq("course_id", typedCourse.id)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) throw new NotFoundException("Course session not found");
    const typedSession = session as CourseSessionRow;

    const subtotal = typedCourse.price * dto.quantity;
    const total = subtotal;

    // Use a special UUID or null for guest users. 
    // In many systems, we might use a fixed 'GUEST' UUID or just allow null if DB permits.
    // Based on the migration, user_id is NOT NULL. 
    // For now, let's use a zero UUID if no user is provided.
    const finalUserId = user?.userId || "00000000-0000-0000-0000-000000000000";

    const { data: order, error: orderError } = await this.supabase.db
      .from("orders")
      .insert({
        user_id: finalUserId,
        kind: "course",
        currency: "IDR",
        status: "pending",
        subtotal,
        total,
        metadata: {
          courseSlug: typedCourse.slug,
          sessionId: typedSession.id,
          locationId: dto.locationId ?? null,
          attendeeEmail: dto.attendeeEmail
        }
      })
      .select("*")
      .single();
    if (orderError) throw orderError;
    const typedOrder = order as OrderRow;

    const { data: item, error: itemError } = await this.supabase.db
      .from("order_items")
      .insert({
        order_id: typedOrder.id,
        product_type: "course",
        product_slug: typedCourse.slug,
        title: typedCourse.title,
        unit_price: typedCourse.price,
        quantity: dto.quantity,
        amount: subtotal
      })
      .select("*")
      .single();
    if (itemError) throw itemError;
    const typedItem = item as OrderItemRow;

    const { error: bookingError } = await this.supabase.db.from("bookings").insert({
      user_id: finalUserId,
      course_id: typedCourse.id,
      session_id: typedSession.id,
      location_id: dto.locationId ?? null,
      attendee_name: dto.attendeeName,
      attendee_email: dto.attendeeEmail,
      attendee_phone: dto.attendeePhone,
      quantity: dto.quantity,
      order_id: typedOrder.id,
      status: "reserved"
    });
    if (bookingError) throw bookingError;

    return {
      data: {
        order: typedOrder,
        items: [typedItem],
        course: typedCourse,
        session: typedSession
      }
    };
  }

  async createBookCheckout(dto: CreateBookCheckoutDto, user?: AuthUser) {
    const { data: book, error: bookError } = await this.supabase.db
      .from("books")
      .select("id,slug,title,price")
      .eq("slug", dto.bookSlug)
      .maybeSingle();
    if (bookError) throw bookError;
    if (!book) throw new NotFoundException("Book not found");
    const typedBook = book as BookRow;

    const subtotal = typedBook.price * dto.quantity;
    const total = subtotal;

    const finalUserId = user?.userId || "00000000-0000-0000-0000-000000000000";

    const { data: order, error: orderError } = await this.supabase.db
      .from("orders")
      .insert({
        user_id: finalUserId,
        kind: "book",
        currency: "IDR",
        status: "pending",
        subtotal,
        total,
        metadata: { bookSlug: typedBook.slug, buyerEmail: dto.buyerEmail }
      })
      .select("*")
      .single();
    if (orderError) throw orderError;
    const typedOrder = order as OrderRow;

    const { data: item, error: itemError } = await this.supabase.db
      .from("order_items")
      .insert({
        order_id: typedOrder.id,
        product_type: "book",
        product_slug: typedBook.slug,
        title: typedBook.title,
        unit_price: typedBook.price,
        quantity: dto.quantity,
        amount: subtotal
      })
      .select("*")
      .single();
    if (itemError) throw itemError;
    const typedItem = item as OrderItemRow;

    return { data: { order: typedOrder, items: [typedItem], book: typedBook } };
  }
}
