import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { SupabaseService } from "../../common/supabase/supabase.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class UsersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService
  ) {}

  async syncUser(token: string) {
    try {
      const authApiUrl = this.config.get<string>("BAGDJA_AUTH_API") || "https://auth.bagdja.com";
      
      // Gunakan /auth/profile yang HANYA butuh User Token (Bearer),
      // tanpa butuh x-api-token (Client Secret) di headernya.
      const authRes = await fetch(`${authApiUrl}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!authRes.ok) {
        const errorText = await authRes.text();
        console.error("Auth Profile Error Response:", errorText);
        throw new Error(`Auth API Error: ${authRes.statusText} (${authRes.status})`);
      }
      
      const user = await authRes.json();

      if (!user.id) {
        console.error("User data missing id:", user);
        throw new Error("User data missing id");
      }

      // Sync ke database lokal Supabase
      const { data, error } = await this.supabase.db
        .from("users")
        .upsert({
          id: user.id,
          email: user.email,
          username: user.username,
          full_name: user.full_name || user.fullName || user.username,
          avatar_url: user.profilePicture || user.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error("SyncUser Error:", err);
      throw new InternalServerErrorException(err instanceof Error ? err.message : "Unknown error during sync");
    }
  }

  async ensureUserExists(user: { id: string; email?: string; username?: string }) {
    // Jika user adalah guest (zero UUID), kita tetap coba upsert dengan info minimal
    // Tapi idealnya guest user sudah ada di DB via migrasi.
    const { data, error } = await this.supabase.db
      .from("users")
      .upsert({
        id: user.id,
        email: user.email || `${user.id}@guest.local`,
        username: user.username || `guest-${user.id.split("-")[0]}`,
        full_name: user.username || "Guest User",
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error("Error ensuring user exists:", error);
      throw error;
    }
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
