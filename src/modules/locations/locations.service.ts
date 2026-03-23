import { Injectable } from "@nestjs/common";

import { SupabaseService } from "@/common/supabase/supabase.service";

type LocationRow = {
  id: string;
  city: string;
  address: string;
  notes: string;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
};

type LocationResponse = {
  id: string;
  city: string;
  address: string;
  notes: string;
  lat?: number | null;
  lng?: number | null;
  imageUrls?: string[];
  createdAt: string;
};

function mapLocation(row: LocationRow): LocationResponse {
  return {
    id: row.id,
    city: row.city,
    address: row.address,
    notes: row.notes,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    createdAt: row.created_at
  };
}

@Injectable()
export class LocationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listLocations() {
    const { data, error } = await this.supabase.db
      .from("locations")
      .select("*")
      .order("city", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as LocationRow[];
    if (!rows.length) return { data: [] };

    const ids = rows.map((l) => l.id);
    const { data: images, error: imgError } = await this.supabase.db
      .from("location_images")
      .select("location_id,path,sort_order,created_at")
      .in("location_id", ids)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (imgError) throw imgError;

    const byLocation = new Map<string, string[]>();
    const bucket = "location-images";
    for (const img of (images ?? []) as any[]) {
      const locationId = String(img.location_id);
      const path = String(img.path);
      const url = this.supabase.db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      const arr = byLocation.get(locationId) ?? [];
      arr.push(url);
      byLocation.set(locationId, arr);
    }

    return {
      data: rows.map((r) => {
        const base = mapLocation(r);
        return { ...base, imageUrls: byLocation.get(r.id) ?? [] };
      })
    };
  }
}
