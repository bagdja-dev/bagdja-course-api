import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.get<string>("SUPABASE_URL");
    const key = config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  get db() {
    return this.client;
  }
}

