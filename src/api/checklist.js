import { supabase } from "../lib/supabaseClient";

export async function fetchChecklist({ limit = 2000 } = {}) {
  const { data, error } = await supabase
    .from("checklist")
    .select("type,area,domain,code,itemcode,guide,cost,risk,difficulty,priority,reason,status,result,result_detail,impact,likelihood,treatment_strategy,treatment_plan,treatment_owner")
    .order("code", { ascending: true })
    .limit(limit);

  if (error) throw error;

  // 앱이 itemCode(카멜케이스)를 기대할 수 있어 변환
  return (data ?? []).map((r) => ({
    ...r,
    itemCode: r.itemcode ?? "",
  }));
}