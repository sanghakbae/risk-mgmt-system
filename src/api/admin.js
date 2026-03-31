import { supabase } from "../lib/supabaseClient";

function normalizeRole(role) {
  return role === "admin" ? "admin" : "viewer";
}

export async function syncMyProfile(user) {
  if (!user?.id) return null;

  const payload = {
    user_id: user.id,
    email: user.email ?? "",
    display_name:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.user_metadata?.preferred_username ??
      user.email ??
      "",
    avatar_url: user.user_metadata?.avatar_url ?? null,
    last_sign_in_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchMyRole() {
  const { data, error } = await supabase.rpc("my_role");

  if (error) {
    console.error("fetchMyRole error:", error);
    throw error;
  }

  return normalizeRole(data ?? "viewer");
}

export async function fetchSecuritySettings() {
  const { data, error } = await supabase
    .from("security_settings")
    .select("key, value, description, updated_at, updated_by")
    .order("key", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchRiskEvaluationPolicy() {
  const { data, error } = await supabase
    .from("security_settings")
    .select("value")
    .eq("key", "risk_evaluation_policy")
    .maybeSingle();

  if (error) throw error;
  return data?.value ?? null;
}

export async function upsertSecuritySetting({ key, value, description, updatedBy }) {
  const payload = {
    key,
    value,
    description: description ?? null,
    updated_by: updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("security_settings")
    .upsert(payload, { onConflict: "key" })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchAuditLogs({ limit = 30, action = "", actorEmail = "" } = {}) {
  let q = supabase
    .from("audit_logs")
    .select("id, actor_user_id, actor_email, action, target_type, target_id, detail, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (action.trim()) {
    q = q.ilike("action", `%${action.trim()}%`);
  }

  if (actorEmail.trim()) {
    q = q.ilike("actor_email", `%${actorEmail.trim()}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function writeAuditLog({
  actorUserId,
  actorEmail,
  action,
  targetType = null,
  targetId = null,
  detail = {},
}) {
  const payload = {
    actor_user_id: actorUserId,
    actor_email: actorEmail ?? null,
    action,
    target_type: targetType,
    target_id: targetId,
    detail,
  };

  const { error } = await supabase.from("audit_logs").insert(payload);
  if (error) throw error;
}

export async function fetchProfiles(limit = 50) {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, avatar_url, last_sign_in_at, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function fetchUserRoles() {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, role, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    role: normalizeRole(row.role),
  }));
}

export async function upsertUserRole({ userId, role }) {
  const payload = {
    user_id: userId,
    role: normalizeRole(role),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_roles")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteManagedUser(userId) {
  const { error: roleError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (roleError) throw roleError;

  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("user_id", userId);

  if (profileError) throw profileError;
}
