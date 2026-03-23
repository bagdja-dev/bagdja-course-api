import { Injectable, NotFoundException } from "@nestjs/common";

import { SupabaseService } from "@/common/supabase/supabase.service";

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

type CourseResponse = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  mode: "online" | "offline";
  level: "beginner" | "intermediate" | "advanced";
  durationHours: number;
  lessons: number;
  price: number;
  rating: number;
  highlights: string[];
  createdAt: string;
};

type CourseSessionResponse = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  time: string;
};

function toHighlights(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function mapCourse(row: CourseRow): CourseResponse {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    mode: row.mode,
    level: row.level,
    durationHours: row.duration_hours,
    lessons: row.lessons,
    price: row.price,
    rating: Number(row.rating),
    highlights: toHighlights(row.highlights),
    createdAt: row.created_at
  };
}

@Injectable()
export class CoursesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listCourses({ mode }: { mode?: "online" | "offline" }) {
    let query = this.supabase.db.from("courses").select("*").order("created_at", { ascending: false });
    if (mode) query = query.eq("mode", mode);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as CourseRow[];
    return { data: rows.map(mapCourse) };
  }

  async getCourseBySlug(slug: string) {
    const { data: course, error } = await this.supabase.db
      .from("courses")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    if (!course) throw new NotFoundException("Course not found");
    const typedCourse = course as CourseRow;

    const { data: sessions, error: sessionsError } = await this.supabase.db
      .from("course_sessions")
      .select("*")
      .eq("course_id", typedCourse.id)
      .order("start_date", { ascending: true })
      ;

    if (sessionsError) throw sessionsError;

    const sessionRows = (sessions ?? []) as CourseSessionRow[];
    const sessionResponse: CourseSessionResponse[] = sessionRows.map((s) => ({
      id: s.id,
      label: s.label,
      startDate: s.start_date,
      endDate: (s.end_date ?? s.start_date) as string,
      time: s.time
    }));

    return { data: { ...mapCourse(typedCourse), sessions: sessionResponse } };
  }
}
