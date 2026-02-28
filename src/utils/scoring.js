export function score(impact, likelihood) {
  return Number(impact) * Number(likelihood);
}

export function gradeFromScore(s) {
  const v = Number(s);
  if (v >= 20) return { g: "VH", label: "Very High", cls: "bg-rose-100 text-rose-900 border-rose-200" };
  if (v >= 15) return { g: "H", label: "High", cls: "bg-amber-100 text-amber-900 border-amber-200" };
  if (v >= 8) return { g: "M", label: "Medium", cls: "bg-sky-100 text-sky-900 border-sky-200" };
  return { g: "L", label: "Low", cls: "bg-emerald-100 text-emerald-900 border-emerald-200" };
}
