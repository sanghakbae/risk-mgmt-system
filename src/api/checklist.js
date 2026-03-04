import { supabase } from "../lib/supabaseClient";

/**
 * checklist 전체 조회 (UI 공통 원천)
 * - itemcode(DB) -> itemCode(UI)
 */
export async function fetchChecklist({ limit = 5000 } = {}) {
  const { data, error } = await supabase
    .from("checklist")
    .select(
      [
        "type",
        "area",
        "domain",
        "code",
        "itemcode",
        "guide",
        "cost",
        "risk",
        "difficulty",
        "priority",
        "reason",
        "status",
        "result",
        "result_detail",
        // ✅ 위험평가/처리/잔여평가에 필수
        "impact",
        "likelihood",
        "treatment_strategy",
        "treatment_plan",
        "treatment_owner",
        "treatment_due_date",
        "treatment_status",
        "accept_reason",
        // ✅ 잔여평가
        "residual_impact",
        "residual_likelihood",
        "residual_status",
        "residual_detail",
      ].join(",")
    )
    .order("code", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((r) => ({
    ...r,
    itemCode: r.itemcode ?? "",
  }));
}

/** code 기준 부분 업데이트 */
export async function updateChecklistByCode(code, fields) {
  const { error } = await supabase.from("checklist").update(fields).eq("code", code);
  if (error) throw error;
}

/** ✅ 취약만 조회 */
export async function fetchVulnerableChecklist({ type = "", domain = "", limit = 5000 } = {}) {
  let q = supabase
    .from("checklist")
    .select(
      [
        "type",
        "area",
        "domain",
        "code",
        "itemcode",
        "status",
        "result",
        "result_detail",
        "reason",
        // ✅ 위험평가/처리에서 읽어야 함
        "impact",
        "likelihood",
        "treatment_strategy",
        "treatment_plan",
        "treatment_owner",
        "treatment_due_date",
        "treatment_status",
        "accept_reason",
      ].join(",")
    )
    .eq("result", "취약")
    .order("domain", { ascending: true })
    .order("code", { ascending: true })
    .limit(limit);

  if (type) q = q.eq("type", type);
  if (domain) q = q.eq("domain", domain);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((r) => ({ ...r, itemCode: r.itemcode ?? "" }));
}

/** ✅ 위험평가 저장(impact/likelihood는 DB integer) */
export async function updateRiskByCode(code, { impact, likelihood }) {
  const payload = {
    impact: impact === "" || impact == null ? null : Number(impact),
    likelihood: likelihood === "" || likelihood == null ? null : Number(likelihood),
  };
  const { error } = await supabase.from("checklist").update(payload).eq("code", code);
  if (error) throw error;
}