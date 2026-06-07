import { firebaseBackend } from "../lib/firebaseClient";

export const CHECKLIST_SELECT_COLUMNS = [
  "accept_reason",
  "area",
  "code",
  "cost",
  "difficulty",
  "domain",
  "evidence_url",
  "guide",
  "impact",
  "itemcode",
  "likelihood",
  "priority",
  "q_impact",
  "q_likelihood",
  "q_risk_score",
  "reason",
  "residual_detail",
  "residual_impact",
  "residual_likelihood",
  "residual_risk_score",
  "residual_status",
  "result",
  "result_detail",
  "risk",
  "status",
  "treatment_due_date",
  "treatment_owner",
  "treatment_plan",
  "treatment_status",
  "treatment_strategy",
  "type",
].join(", ");

export async function fetchChecklistRows() {
  const { data, error } = await firebaseBackend
    .from("checklist")
    .select(CHECKLIST_SELECT_COLUMNS)
    .order("code", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** code 기준 부분 업데이트 */
export async function updateChecklistByCode(code, fields) {
  const { error } = await firebaseBackend.from("checklist").update(fields).eq("code", code);
  if (error) throw error;
}
