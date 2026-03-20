import { supabase } from "../lib/supabaseClient";

/** code 기준 부분 업데이트 */
export async function updateChecklistByCode(code, fields) {
  const { error } = await supabase.from("checklist").update(fields).eq("code", code);
  if (error) throw error;
}
