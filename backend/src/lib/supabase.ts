import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

// Service-role client: bypasses RLS for trusted server-side operations.
export function getAdminClient(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

// Verify a Supabase JWT (from Authorization: Bearer ...) using the anon key's JWKS.
// Returns the user id (auth.users.id) or null.
export async function verifyUser(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
