// Shared helpers for reading integration tokens from Supabase
import { SupabaseClient } from "@supabase/supabase-js";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate?: number;
}

/** Read stored Gmail tokens (token_data column) for a user. */
export async function getGmailTokens(
  supabase: SupabaseClient,
  userId: string
): Promise<StoredTokens | null> {
  const { data } = await supabase
    .from("integrations")
    .select("token_data")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .eq("connected", true)
    .single();
  const td = (data?.token_data as any) ?? null;
  if (!td?.accessToken) return null;
  return {
    accessToken: td.accessToken,
    refreshToken: td.refreshToken ?? null,
    expiryDate: td.expiryDate,
  };
}

/** Read stored Sheets tokens (meta column) for a user. */
export async function getSheetsTokens(
  supabase: SupabaseClient,
  userId: string
): Promise<StoredTokens | null> {
  const { data } = await supabase
    .from("integrations")
    .select("meta")
    .eq("user_id", userId)
    .eq("provider", "sheets")
    .eq("connected", true)
    .single();
  const meta = (data?.meta as any) ?? null;
  if (!meta?.access_token) return null;
  return {
    accessToken: meta.access_token,
    refreshToken: meta.refresh_token ?? null,
    expiryDate: meta.expiry_date,
  };
}

/** Read the user's configured Slack webhook URL from settings meta. */
export async function getSlackWebhook(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("integrations")
    .select("meta")
    .eq("user_id", userId)
    .eq("provider", "slack")
    .eq("connected", true)
    .single();
  return ((data?.meta as any)?.webhook_url as string) ?? null;
}

/** Read the user's Telegram bot token + chat id from settings meta. */
export async function getTelegramConfig(
  supabase: SupabaseClient,
  userId: string
): Promise<{ botToken: string; chatId: string } | null> {
  const { data } = await supabase
    .from("integrations")
    .select("meta")
    .eq("user_id", userId)
    .eq("provider", "telegram")
    .eq("connected", true)
    .single();
  const meta = (data?.meta as any) ?? null;
  if (!meta?.telegram_bot_token || !meta?.telegram_chat_id) return null;
  return { botToken: meta.telegram_bot_token, chatId: meta.telegram_chat_id };
}

