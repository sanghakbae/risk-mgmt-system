// src/components/AdminAccessPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import { deleteManagedUser, fetchProfiles, fetchUserRoles, upsertUserRole, writeAuditLog } from "../api/admin";

function cardClass() {
  return "rounded-2xl border border-slate-200 bg-white p-4";
}

const ROLE_OPTIONS = ["admin", "viewer"];
const PAGE_SIZE = 20;

function formatDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("ko-KR");
}

function deriveDisplayName(profile) {
  const rawName = String(profile?.display_name ?? "").trim();
  if (rawName) return rawName;

  const email = String(profile?.email ?? "").trim();
  if (!email) return "-";

  return email.split("@")[0] || "-";
}

export default function AdminAccessPanel({ session, reloadKey, onChanged, canManage = false }) {
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const [error, setError] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [draftRoles, setDraftRoles] = useState({});
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    setError("");
    setPage(1);

    try {
      const [profileRows, roleRows] = await Promise.all([fetchProfiles(50), fetchUserRoles(50)]);
      setProfiles(profileRows);
      setRoles(roleRows);

      const nextDraft = {};
      for (const p of profileRows) {
        const matched = roleRows.find((r) => r.user_id === p.user_id);
        nextDraft[p.user_id] = matched?.role ?? "viewer";
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

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  const mergedRows = useMemo(() => {
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
    const userIds = Array.from(
      new Set([
        ...profiles.map((p) => p.user_id),
        ...roles.map((r) => r.user_id),
      ])
    );

    const rows = userIds.map((userId) => {
      const profile = profileMap.get(userId) ?? {};
      const matchedRole = roles.find((r) => r.user_id === userId);

      return {
        ...profile,
        user_id: userId,
        email: profile.email ?? "-",
        display_name: deriveDisplayName(profile),
        role: matchedRole?.role ?? "viewer",
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

  const totalPages = useMemo(() => {
    const count = Math.ceil(mergedRows.length / PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [mergedRows.length]);

  const pagedRows = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return mergedRows.slice(start, start + PAGE_SIZE);
  }, [mergedRows, page, totalPages]);

  async function handleSave(userId) {
    const target = mergedRows.find((x) => x.user_id === userId);
    const nextRole = draftRoles[userId] ?? "viewer";
    const prevRole = target?.role ?? "viewer";

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

  async function handleDelete(userId) {
    const target = mergedRows.find((x) => x.user_id === userId);
    const targetEmail = target?.email ?? userId;

    if (session?.user?.id === userId) {
      alert("현재 로그인한 본인 계정은 여기서 삭제할 수 없습니다.");
      return;
    }

    const confirmed = window.confirm(
      `${targetEmail} 계정의 앱 접근 권한과 사용자 정보를 삭제하시겠습니까?\n실제 Google/Supabase 계정은 삭제되지 않습니다.`
    );

    if (!confirmed) return;

    try {
      setDeletingUserId(userId);
      setError("");

      await deleteManagedUser(userId);

      await writeAuditLog({
        actorUserId: session?.user?.id,
        actorEmail: session?.user?.email,
        action: "managed_user_delete",
        targetType: "profiles",
        targetId: userId,
        detail: {
          target_user_id: userId,
          target_email: target?.email ?? null,
          effect: "remove_app_access_only",
        },
      });

      await load();
      onChanged?.();
      alert("앱 접근 권한과 사용자 정보가 삭제되었습니다. 실제 계정 자체는 삭제되지 않습니다.");
    } catch (e) {
      console.error(e);
      setError(e.message || "계정 삭제에 실패했습니다.");
    } finally {
      setDeletingUserId("");
    }
  }

  return (
    <div className="space-y-4">
      <div className={cardClass()}>
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:justify-between">
          <div>
            <div className="panel-banner-title text-slate-900">권한 관리</div>
            <div className="panel-banner-body text-slate-500">
              {canManage ? "admin / viewer 권한을 관리합니다." : "viewer는 열람만 가능합니다. 수정은 관리자만 할 수 있습니다."}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
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
          <div className="space-y-4">
            <div className="overflow-visible">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-center text-slate-700 font-bold">
                    <th className="py-3 px-2">Email</th>
                    <th className="py-3 px-2">이름</th>
                    <th className="py-3 px-2">현재 Role</th>
                    <th className="py-3 px-2">변경 Role</th>
                    <th className="py-3 px-2">처음 로그인</th>
                    <th className="py-3 px-2">마지막 로그인</th>
                    <th className="py-3 px-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => {
                    const draftRole = draftRoles[row.user_id] ?? row.role ?? "viewer";
                    const changed = draftRole !== (row.role ?? "viewer");

                    return (
                      <tr key={row.user_id} className="border-b border-slate-100">
                        <td className="py-2 px-2 text-center text-slate-900 font-medium break-all">{row.email}</td>
                        <td className="py-2 px-2 text-center text-slate-700 break-words">{row.display_name || "-"}</td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={[
                              "inline-flex min-w-[78px] justify-center rounded-md border px-2 py-1 text-xs font-semibold",
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
                            className="w-[92px] rounded-md border border-slate-200 bg-white px-2 py-2 text-center text-sm outline-none focus:border-slate-400"
                            value={draftRole}
                            disabled={!canManage}
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
                        <td className="py-2 px-2 text-slate-700 whitespace-nowrap text-center">{formatDateTime(row.created_at)}</td>
                        <td className="py-2 px-2 text-slate-700 whitespace-nowrap text-center">{formatDateTime(row.last_sign_in_at)}</td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              onClick={() => handleSave(row.user_id)}
                              disabled={!canManage || savingUserId === row.user_id || deletingUserId === row.user_id || !changed}
                              className="h-7 px-2 min-w-[52px] text-xs"
                            >
                              저장
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => handleDelete(row.user_id)}
                              disabled={!canManage || savingUserId === row.user_id || deletingUserId === row.user_id}
                              className="h-7 px-2 min-w-[52px] text-xs"
                            >
                              {deletingUserId === row.user_id ? "처리 중" : "접근삭제"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {mergedRows.length > PAGE_SIZE ? (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNumber) => {
                  const active = pageNumber === page;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={[
                        "h-9 min-w-[36px] px-3 rounded-md border text-sm font-semibold",
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
