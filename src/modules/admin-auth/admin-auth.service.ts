import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { SupabaseService } from "@/common/supabase/supabase.service";
import { verifyPassword } from "@/common/crypto/password";

type AdminRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  is_active: boolean;
};

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwt: JwtService
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const { data: admin, error } = await this.supabase.db
      .from("admin_users")
      .select("id,email,name,password_hash,is_active")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) throw error;
    if (!admin) return null;
    const typed = admin as AdminRow;
    if (!typed.is_active) return null;

    if (typed.password_hash.startsWith("scrypt$")) {
      const ok = await verifyPassword(password, typed.password_hash);
      if (!ok) return null;
    } else {
      const { data: verified, error: rpcError } = await this.supabase.db.rpc("admin_authenticate", {
        p_email: normalizedEmail,
        p_password: password
      });
      if (rpcError) throw rpcError;
      if (!Array.isArray(verified) || verified.length === 0) return null;
    }

    const accessToken = await this.jwt.signAsync({ sub: typed.id, email: typed.email, name: typed.name, typ: "admin" });
    return {
      accessToken,
      admin: { id: typed.id, email: typed.email, name: typed.name }
    };
  }
}
