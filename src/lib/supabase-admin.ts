// Server-only Supabase client with service_role key for DB queries.
// NEVER import this in client components — use it only in API routes and server code.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "[supabase-admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl ?? "",
  serviceRoleKey ?? "",
  {
    auth: { persistSession: false },
  }
);
