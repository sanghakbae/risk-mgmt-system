// src/components/AdminAccessPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import { fetchProfiles, fetchUserRoles, upsertUserRole, writeAuditLog } from "../api/admin";

function cardClass() {
  return "rounded-2xl border border-slate-200 bg-white p-4";
}

const ROLE_OPTIONS = ["admin", "user", "auditor"];

function formatDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("ko-KR");
}

export default function AdminAccessPanel({ session, reloadKey, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState("");
  const [error, setError] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [draftRoles, setDraftRoles] = useState({});

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [profileRows, roleRows] = await Promise.all([fetchProfiles(50), fetchUserRoles(50)]);
      setProfiles(profileRows);
      setRoles(roleRows);

      const nextDraft = {};
      for (const p of profileRows) {
        const matched = roleRows.find((r) => r.user_id === p.user_id);
        nextDraft[p.user_id] = matched?.role ?? "user";
      }
      setDraftRoles(nextDraft);
    } catch (e) {
      console.error(e);
      setError(e.message || "권한 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [reloadKey]);

  const mergedRows = useMemo(() => {
    const rows = profiles.map((p) => {
      const matchedRole = roles.find((r) => r.user_id === p.user_id);
      return {
        ...p,
        role: matchedRole?.role ?? "user",
      };
    });

    if (!keyword.trim()) return rows;

    const q = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      return (
        String(row.email ?? "").toLowerCase().includes(q) ||
        String(row.display_name ?? "").toLowerCase().includes(q) ||
        String(row.user_id ?? "").toLowerCase().includes(q) ||
        String(row.role ?? "").toLowerCase().includes(q)
      );
    });
  }, [profiles, roles, keyword]);

  const useVerticalScroll = mergedRows.length > 10;

  async function handleSave(userId) {
    const target = mergedRows.find((x) => x.user_id === userId);
    const nextRole = draftRoles[userId] ?? "user";
    const prevRole = target?.role ?? "user";

    try {
      setSavingUserId(userId);
      setError("");

      await upsertUserRole({ userId, role: nextRole });

      await writeAuditLog({
        actorUserId: session?.user?.id,
        actorEmail: session?.user?.email,
        action: "user_role_upsert",
        targetType: "user_roles",
        targetId: userId,
        detail: {
          target_user_id: userId,
          target_email: target?.email ?? null,
          previous_role: prevRole,
          next_role: nextRole,
        },
      });

      await load();
      onChanged?.();
      alert("권한이 저장되었습니다.");
    } catch (e) {
      console.error(e);
      setError(e.message || "권한 저장에 실패했습니다.");
    } finally {
      setSavingUserId("");
    }
  }

  return (
    <div className="space-y-4">
      <div className={cardClass()}>
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:justify-between">
          <div>
            <div className="panel-banner-title text-slate-900">권한 관리</div>
            <div className="panel-banner-body text-slate-500">admin / user / auditor 권한을 관리합니다.</div>
          </div>

          <div className="flex gap-2">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="이메일 / 이름 / role 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Button variant="outline" onClick={load}>
              새로고침
            </Button>
          </div>
        </div>

        {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}
      </div>

      <div className={cardClass()}>
        {loading ? (
          <div className="text-slate-600">사용자 목록을 불러오는 중...</div>
        ) : mergedRows.length === 0 ? (
          <div className="text-slate-500">조회된 사용자가 없습니다.</div>
        ) : (
          <div className={useVerticalScroll ? "max-h-[420px] overflow-y-auto overflow-x-hidden" : "overflow-visible"}>
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-center text-slate-700 font-bold">
                  <th className="py-3 px-2">Email</th>
                  <th className="py-3 px-2">이름</th>
                  <th className="py-3 px-2">현재 Role</th>
                  <th className="py-3 px-2">변경 Role</th>
                  <th className="py-3 px-2">마지막 로그인</th>
                  <th className="py-3 px-2">작업</th>
                </tr>
              </thead>
              <tbody>
                {mergedRows.map((row) => {
                  const draftRole = draftRoles[row.user_id] ?? row.role ?? "user";
                  const changed = draftRole !== (row.role ?? "user");

                  return (
                    <tr key={row.user_id} className="border-b border-slate-100">
                      <td className="py-2 px-2 text-center text-slate-900 font-medium break-all">{row.email}</td>
                      <td className="py-2 px-2 text-center text-slate-700 break-words">{row.display_name || "-"}</td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={[
                            "inline-flex rounded-full border px-2 py-1 text-xs font-semibold",
                            row.role === "admin"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : row.role === "auditor"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-slate-50 text-slate-700 border-slate-200",
                          ].join(" ")}
                        >
                          {row.role}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <select
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 bg-white"
                          value={draftRole}
                          onChange={(e) =>
                            setDraftRoles((prev) => ({
                              ...prev,
                              [row.user_id]: e.target.value,
                            }))
                          }
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2 text-slate-700 whitespace-nowrap text-center">{formatDateTime(row.last_sign_in_at)}</td>
                      <td className="py-2 px-2 text-center">
                        <Button
                          onClick={() => handleSave(row.user_id)}
                          disabled={savingUserId === row.user_id || !changed}
                          className="h-8 px-3 min-w-[72px]"
                        >
                          저장
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
