import { Injectable, NotFoundException } from "@nestjs/common";

import { SupabaseService } from "@/common/supabase/supabase.service";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  type: "webinar" | "workshop" | "meetup" | string;
  start_at: string;
  end_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type EventResponse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  type: "webinar" | "workshop" | "meetup";
  startAt: string;
  endAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapType(value: string): "webinar" | "workshop" | "meetup" {
  return value === "workshop" ? "workshop" : value === "meetup" ? "meetup" : "webinar";
}

function mapEvent(row: EventRow): EventResponse {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    location: row.location,
    type: mapType(String(row.type)),
    startAt: row.start_at,
    endAt: row.end_at ?? null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

@Injectable()
export class EventsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listEvents({ active }: { active?: boolean } = {}) {
    let q = this.supabase.db.from("events").select("*").order("start_at", { ascending: true });
    if (active !== undefined) q = q.eq("is_active", active);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as EventRow[];
    return { data: rows.map(mapEvent) };
  }

  async getEventBySlug(slug: string) {
    const { data, error } = await this.supabase.db.from("events").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException("Event not found");
    return { data: mapEvent(data as EventRow) };
  }
}

