import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import Table from "../ui/Table";
import Card, { Badge, Field } from "../ui/Card";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Button from "../ui/Button";

// NOTE: 자산 식별 메뉴 로직/UX는 기존 개발상태를 그대로 옮겨왔습니다.
export default function AssetsPanel({ assets, setAssets }) {
  const [selectedAssetId, setSelectedAssetId] = useState(null);

  // Form state (add/edit)
  const [assetCode, setAssetCode] = useState("");
  const [hostname, setHostname] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [assetType, setAssetType] = useState("서버시스템");
  const [purpose, setPurpose] = useState("");
  const [location, setLocation] = useState("KT-IDC");
  const [dept, setDept] = useState("");
  const [owner, setOwner] = useState("");
  const [admin, setAdmin] = useState("");
  const [status, setStatus] = useState("Active");

  // CIA(1~3) + criticality(C+I+A)
  const [confidentiality, setConfidentiality] = useState(2);
  const [integrity, setIntegrity] = useState(2);
  const [availability, setAvailability] = useState(2);

  const criticality = useMemo(() => Number(confidentiality) + Number(integrity) + Number(availability), [confidentiality, integrity, availability]);
  const criticalityDanger = criticality >= 8;

  const fileRef = useRef(null);

  function nextAssetId(existingIds) {
    const nums = existingIds
      .map((id) => /^SVR-(\d+)$/.exec(String(id)))
      .filter(Boolean)
      .map((m) => Number(m[1]))
      .filter((n) => Number.isFinite(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `SVR-${String(max + 1).padStart(3, "0")}`;
  }

  function resetForm() {
    setSelectedAssetId(null);
    setAssetCode("");
    setHostname("");
    setIpAddress("");
    setAssetType("서버시스템");
    setPurpose("");
    setLocation("KT-IDC");
    setDept("");
    setOwner("");
    setAdmin("");
    setStatus("Active");
    setConfidentiality(2);
    setIntegrity(2);
    setAvailability(2);
  }

  // When selecting an asset, load into the form
  useEffect(() => {
    if (!selectedAssetId) return;
    const a = assets.find((x) => x.id === selectedAssetId);
    if (!a) return;
    setAssetCode(a.assetCode ?? a.id ?? "");
    setHostname(a.hostname ?? "");
    setIpAddress(a.ipAddress ?? a.ip ?? "");
    setAssetType(a.type ?? a.assetType ?? "서버시스템");
    setPurpose(a.purpose ?? "");
    setLocation(a.location ?? "KT-IDC");
    setDept(a.dept ?? a.department ?? "");
    setOwner(a.owner ?? "");
    setAdmin(a.admin ?? "");
    setStatus(a.status ?? "Active");
    setConfidentiality(Number(a.confidentiality ?? 2));
    setIntegrity(Number(a.integrity ?? 2));
    setAvailability(Number(a.availability ?? 2));
  }, [selectedAssetId, assets]);

  function upsertAsset() {
    // 최소 입력
    if (!assetCode.trim() || !hostname.trim() || !ipAddress.trim()) return;

    const base = {
      id: selectedAssetId || assetCode.trim(),
      assetCode: assetCode.trim(),
      hostname: hostname.trim(),
      ipAddress: ipAddress.trim(),
      type: assetType,
      purpose: purpose.trim(),
      location,
      dept: dept.trim(),
      owner: owner.trim(),
      admin: admin.trim(),
      confidentiality: Number(confidentiality),
      integrity: Number(integrity),
      availability: Number(availability),
      criticality,
      status,
    };

    setAssets((prev) => {
      const idx = prev.findIndex((x) => x.id === base.id);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = { ...prev[idx], ...base };
        return copy;
      }
      return [base, ...prev];
    });
  }

  function deleteSelected() {
    if (!selectedAssetId) return;
    setAssets((prev) => prev.filter((x) => x.id !== selectedAssetId));
    resetForm();
  }

  function csvEscape(v) {
    const s = v == null ? "" : String(v);
    const needs = /[\n\r",]/.test(s);
    const quoted = s.replaceAll('"', '""');
    return needs ? `"${quoted}"` : quoted;
  }

  function exportCsv() {
    const headers = [
      ["assetCode", "자산코드"],
      ["hostname", "Hostname"],
      ["ipAddress", "IP"],
      ["type", "유형"],
      ["purpose", "용도"],
      ["location", "위치"],
      ["dept", "부서"],
      ["owner", "담당자"],
      ["admin", "관리자"],
      ["confidentiality", "기밀성"],
      ["integrity", "무결성"],
      ["availability", "가용성"],
      ["criticality", "중요도"],
      ["status", "상태"],
    ];
    const lines = [];
    lines.push(headers.map((h) => csvEscape(h[1])).join(","));
    for (const a of assets) {
      const row = headers.map(([k]) => csvEscape(a[k] ?? ""));
      lines.push(row.join(","));
    }
    const csv = "\ufeff" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "assets.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function parseCsv(text) {
    const input = String(text || "").replace(/^\ufeff/, "");
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;
    const pushCell = () => {
      row.push(cur);
      cur = "";
    };
    const pushRow = () => {
      if (row.length === 1 && row[0] === "") {
        row = [];
        return;
      }
      rows.push(row);
      row = [];
    };
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      const next = input[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        continue;
      }
      if (ch === ",") {
        pushCell();
        continue;
      }
      if (ch === "\n") {
        pushCell();
        pushRow();
        continue;
      }
      if (ch === "\r") continue;
      cur += ch;
    }
    pushCell();
    pushRow();
    if (!rows.length) return { headers: [], rows: [] };
    const headers = rows[0].map((h) => h.trim());
    const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
    return { headers, rows: data };
  }

  async function importCsv(file) {
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    const idx = (name) => headers.findIndex((h) => h === name);

    const map = {
      assetCode: idx("자산코드") >= 0 ? idx("자산코드") : idx("assetCode"),
      hostname: idx("Hostname") >= 0 ? idx("Hostname") : idx("hostname"),
      ipAddress: idx("IP") >= 0 ? idx("IP") : idx("ipAddress"),
      type: idx("유형") >= 0 ? idx("유형") : idx("type"),
      purpose: idx("용도") >= 0 ? idx("용도") : idx("purpose"),
      location: idx("위치") >= 0 ? idx("위치") : idx("location"),
      dept: idx("부서") >= 0 ? idx("부서") : idx("dept"),
      owner: idx("담당자") >= 0 ? idx("담당자") : idx("owner"),
      admin: idx("관리자") >= 0 ? idx("관리자") : idx("admin"),
      confidentiality: idx("기밀성") >= 0 ? idx("기밀성") : idx("confidentiality"),
      integrity: idx("무결성") >= 0 ? idx("무결성") : idx("integrity"),
      availability: idx("가용성") >= 0 ? idx("가용성") : idx("availability"),
      status: idx("상태") >= 0 ? idx("상태") : idx("status"),
    };

    const imported = [];
    for (const r of rows) {
      const assetCodeV = r[map.assetCode] ?? "";
      const hostnameV = r[map.hostname] ?? "";
      const ipV = r[map.ipAddress] ?? "";
      if (!String(assetCodeV).trim()) continue;
      const c = Math.max(1, Math.min(3, Number(r[map.confidentiality] ?? 2)));
      const i = Math.max(1, Math.min(3, Number(r[map.integrity] ?? 2)));
      const a = Math.max(1, Math.min(3, Number(r[map.availability] ?? 2)));
      imported.push({
        id: String(assetCodeV).trim(),
        assetCode: String(assetCodeV).trim(),
        hostname: String(hostnameV).trim(),
        ipAddress: String(ipV).trim(),
        type: String(r[map.type] ?? "서버시스템").trim() || "서버시스템",
        purpose: String(r[map.purpose] ?? "").trim(),
        location: String(r[map.location] ?? "KT-IDC").trim() || "KT-IDC",
        dept: String(r[map.dept] ?? "").trim(),
        owner: String(r[map.owner] ?? "").trim(),
        admin: String(r[map.admin] ?? "").trim(),
        confidentiality: c,
        integrity: i,
        availability: a,
        criticality: c + i + a,
        status: String(r[map.status] ?? "Active").trim() || "Active",
      });
    }
    setAssets((prev) => {
      const byId = new Map(prev.map((x) => [x.id, x]));
      for (const x of imported) byId.set(x.id, x);
      return Array.from(byId.values());
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-600">자산코드 기반으로 관리합니다. (자산명 미사용)</div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} iconLeft={<Upload className="w-4 h-4" />}>
            CSV Import
          </Button>
          <Button variant="outline" onClick={exportCsv} iconLeft={<Download className="w-4 h-4" />}>
            CSV Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <Field label="자산코드(ID)">
          <Input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} placeholder={`예: ${nextAssetId(assets.map((a) => a.id))}`} />
        </Field>
        <Field label="Hostname">
          <Input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="예: web01" />
        </Field>
        <Field label="IP Address">
          <Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="예: 10.0.0.10" />
        </Field>
        <Field label="유형">
          <Select
            value={assetType}
            onChange={setAssetType}
            options={["서버시스템", "DBMS", "어플리케이션", "네트워크장비", "보안시스템", "PC", "소프트웨어", "문서", "부대설비", "저장매체"].map((x) => ({ value: x, label: x }))}
          />
        </Field>

        <Field label="용도">
          <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="예: 운영 웹서비스" />
        </Field>
        <Field label="위치">
          <Select value={location} onChange={setLocation} options={["KT-IDC", "가비아-IDC", "AWS", "기타"].map((x) => ({ value: x, label: x }))} />
        </Field>
        <Field label="부서">
          <Input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="예: 플랫폼팀" />
        </Field>
        <Field label="담당자">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="예: 홍길동" />
        </Field>

        <Field label="관리자">
          <Input value={admin} onChange={(e) => setAdmin(e.target.value)} placeholder="예: 김보안" />
        </Field>
        <Field label="상태">
          <Select value={status} onChange={setStatus} options={["Active", "Inactive"].map((x) => ({ value: x, label: x }))} />
        </Field>
        <Field label="기밀성(C) 1~3">
          <Select value={String(confidentiality)} onChange={(v) => setConfidentiality(Number(v))} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
        </Field>
        <Field label="무결성(I) 1~3">
          <Select value={String(integrity)} onChange={(v) => setIntegrity(Number(v))} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
        </Field>

        <Field label="가용성(A) 1~3">
          <Select value={String(availability)} onChange={(v) => setAvailability(Number(v))} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
        </Field>
        <Field label="중요도(자동 산정)">
          <Input readOnly value={String(criticality)} className={criticalityDanger ? "border-rose-300 bg-rose-50" : ""} />
          <div className="text-xs text-slate-500 mt-1">C+I+A (8 이상은 빨간색)</div>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-slate-500">• 중요도(자동 산정) = 기밀성 + 무결성 + 가용성 (최대 9)</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetForm}>초기화</Button>
          <Button variant="danger" disabled={!selectedAssetId} onClick={deleteSelected}>선택 삭제</Button>
          <Button onClick={upsertAsset}>{selectedAssetId ? "선택 자산 수정" : "자산 추가"}</Button>
        </div>
      </div>

      <Table
        columns={[
          { key: "assetCode", header: "자산코드" },
          { key: "hostname", header: "Hostname" },
          { key: "ipAddress", header: "IP" },
          { key: "type", header: "유형" },
          { key: "purpose", header: "용도" },
          { key: "location", header: "위치" },
          { key: "dept", header: "부서" },
          { key: "owner", header: "담당자" },
          { key: "admin", header: "관리자" },
          {
            key: "criticality",
            header: "중요도",
            render: (r) => (
              <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold ${Number(r.criticality) >= 8 ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-white"}`}>
                {r.criticality}
              </span>
            ),
          },
          {
            key: "status",
            header: "상태",
            render: (r) => <span className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-white">{r.status}</span>,
          },
        ]}
        rows={assets}
        onRowClick={(r) => setSelectedAssetId(r.id)}
      />
      {selectedAssetId ? <div className="text-xs text-slate-500">선택된 자산: {selectedAssetId}</div> : null}
    </div>
  );
}
