// src/components/AdminAuditLogsPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import { fetchAuditLogs } from "../api/admin";

function cardClass() {
  return "rounded-2xl border border-slate-200 bg-white p-5";
}

function formatDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("ko-KR");
}

function jsonText(v) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch (_e) {
    return "{}";
  }
}

export default function AdminAuditLogsPanel({ reloadKey }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);

  const [actionKeyword, setActionKeyword] = useState("");
  const [actorEmailKeyword, setActorEmailKeyword] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const rows = await fetchAuditLogs({
        limit: 30,
        action: actionKeyword,
        actorEmail: actorEmailKeyword,
      });
      setLogs(rows);
    } catch (e) {
      console.error(e);
      setError(e.message || "감사 로그를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [reloadKey]);

  const stats = useMemo(() => {
    const uniqueActors = new Set(logs.map((x) => x.actor_email).filter(Boolean)).size;
    const uniqueActions = new Set(logs.map((x) => x.action).filter(Boolean)).size;

    return {
      total: logs.length,
      uniqueActors,
      uniqueActions,
    };
  }, [logs]);

  return (
    <div className="space-y-5">
      <div className={cardClass()}>
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:justify-between">
          <div>
            <div className="text-lg font-bold text-slate-900">감사 로그</div>
            <div className="text-sm text-slate-500 mt-1">관리자만 조회할 수 있습니다.</div>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="action 검색"
              value={actionKeyword}
              onChange={(e) => setActionKeyword(e.target.value)}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="actor email 검색"
              value={actorEmailKeyword}
              onChange={(e) => setActorEmailKeyword(e.target.value)}
            />
            <Button onClick={load}>조회</Button>
          </div>
        </div>

        {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={cardClass()}>
          <div className="text-xs text-slate-500">총 로그 건수</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{stats.total}</div>
        </div>
        <div className={cardClass()}>
          <div className="text-xs text-slate-500">행위자 수</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{stats.uniqueActors}</div>
        </div>
        <div className={cardClass()}>
          <div className="text-xs text-slate-500">행위 유형 수</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{stats.uniqueActions}</div>
        </div>
      </div>

      <div className={cardClass()}>
        {loading ? (
          <div className="text-slate-600">감사 로그를 불러오는 중...</div>
        ) : logs.length === 0 ? (
          <div className="text-slate-500">조회된 로그가 없습니다.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-3 pr-3">일시</th>
                  <th className="py-3 pr-3">행위자</th>
                  <th className="py-3 pr-3">Action</th>
                  <th className="py-3 pr-3">Target Type</th>
                  <th className="py-3 pr-3">Target ID</th>
                  <th className="py-3 pr-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => {
                  const expanded = expandedId === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr className="border-b border-slate-100 align-top">
                        <td className="py-3 pr-3 whitespace-nowrap text-slate-700">{formatDateTime(row.created_at)}</td>
                        <td className="py-3 pr-3">
                          <div className="font-medium text-slate-900">{row.actor_email || "-"}</div>
                          <div className="text-xs text-slate-500 break-all">{row.actor_user_id || "-"}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                            {row.action}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-slate-700">{row.target_type || "-"}</td>
                        <td className="py-3 pr-3 text-slate-700 break-all">{row.target_id || "-"}</td>
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            className="text-blue-600 underline"
                            onClick={() => setExpandedId(expanded ? null : row.id)}
                          >
                            {expanded ? "닫기" : "보기"}
                          </button>
                        </td>
                      </tr>

                      {expanded ? (
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td colSpan={6} className="p-4">
                            <pre className="text-xs whitespace-pre-wrap break-words">{jsonText(row.detail)}</pre>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
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