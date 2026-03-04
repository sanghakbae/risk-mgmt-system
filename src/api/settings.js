import { supabase } from "../lib/supabaseClient";

export async function fetchAppSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return data;
}

export async function upsertAppSettings(patch) {
  const payload = { id: 1, ...patch, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("app_settings")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function isAdminByEmail(email) {
  if (!email) return false;
  const { data, error } = await supabase
    .from("app_admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}