import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, ChevronRight, Download, FileDown, FilterX, Info, LockKeyhole, RefreshCw, SlidersHorizontal, UsersRound, Wallet, CreditCard } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { useCurrentReports, type CurrentReportsData, type CurrentSession } from "@/hooks/use-current-reports";
import { downloadReportCSV, downloadReportPDF, type ExportTable } from "@/lib/current-report-export";

type Kind = "members" | "fees" | "payments" | "training" | "matches";
type Row = Record<string, string>;
type Column = { key: string; label: string };

const reports: { id: Kind; title: string; subtitle: string; icon: typeof UsersRound }[] = [
  { id: "members", title: "Members", subtitle: "Current roster and membership", icon: UsersRound },
  { id: "fees", title: "Fees", subtitle: "Dues, payments and balances", icon: Wallet },
  { id: "payments", title: "Payment methods", subtitle: "Transactions by channel", icon: CreditCard },
  { id: "training", title: "Training attendance", subtitle: "Session RSVP responses", icon: CalendarDays },
  { id: "matches", title: "Match attendance", subtitle: "Match RSVP responses", icon: BarChart3 },
];
const columns: Record<Kind, Column[]> = {
  members: [
    { key: "name", label: "Member" }, { key: "email", label: "Email" },
    { key: "memberStatus", label: "Status" }, { key: "section", label: "Section" },
    { key: "tier", label: "Tier" }, { key: "teamName", label: "Team" },
  ],
  fees: [
    { key: "name", label: "Member" }, { key: "teamName", label: "Team" },
    { key: "section", label: "Section" }, { key: "tier", label: "Tier" },
    { key: "due", label: "Due (HKD)" }, { key: "paid", label: "Paid (HKD)" },
    { key: "balance", label: "Balance (HKD)" }, { key: "feeStatus", label: "Status" },
    { key: "lastPaymentDate", label: "Last paid (HKT)" },
  ],
  payments: [
    { key: "playerName", label: "Member" }, { key: "teamName", label: "Team" },
    { key: "method", label: "Method" }, { key: "amount", label: "Amount (HKD)" },
    { key: "paymentDate", label: "Paid on (HKT)" }, { key: "notes", label: "Notes" },
  ],
  training: [
    { key: "session", label: "Session" }, { key: "date", label: "Date (HKT)" },
    { key: "playerName", label: "Member" }, { key: "teamName", label: "Team" },
    { key: "status", label: "RSVP" }, { key: "respondedAt", label: "Responded (HKT)" },
  ],
  matches: [
    { key: "session", label: "Match" }, { key: "date", label: "Date (HKT)" },
    { key: "playerName", label: "Member" }, { key: "teamName", label: "Team" },
    { key: "status", label: "RSVP" }, { key: "respondedAt", label: "Responded (HKT)" },
  ],
};
const defaults: Record<Kind, string[]> = Object.fromEntries(
  Object.entries(columns).map(([kind, cols]) => [kind, cols.map(column => column.key)])
) as Record<Kind, string[]>;

const money = (amount: number) => new Intl.NumberFormat("en-HK", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(amount);
const readable = (value: string | null | undefined) => value ? value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Not specified";
const rsvpLabel = (value: string) => value === "yes" ? "Going" : value === "no" ? "Not going" : value === "none" ? "No response" : "Maybe";
const hktDate = (value: string | null | undefined, includeTime = false) => {
  if (!value) return "—";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+08:00` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong", day: "2-digit", month: "short", year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(date);
};
const hktISODate = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const teamKey = (id: number | null, name: string | null) => id == null ? (name ? `name:${name}` : "unassigned") : `id:${id}`;
type DetailedRow = Row & { _team: string; _section: string; _status: string; _method: string; _date: string; _sessionId?: string };
type SessionSummary = { id: number; title: string; date: string; teamName: string; yes: number; maybe: number; no: number; noResponse: number; invited: number };

function buildRows(data: CurrentReportsData, kind: Kind): DetailedRow[] {
  if (kind === "members" || kind === "fees") return data.members.map(member => ({
    name: member.name, email: member.email || "—", memberStatus: readable(member.memberStatus),
    section: readable(member.section), tier: readable(member.tier), teamName: member.teamName || "Unassigned",
    due: member.due == null ? "—" : money(member.due), paid: money(member.paid),
    balance: member.due == null ? "—" : money(Math.max(0, member.due - member.paid)),
    feeStatus: member.feePaid ? "Paid" : "Unpaid",
    lastPaymentDate: hktDate(member.lastPaymentDate),
    _team: teamKey(member.teamId, member.teamName), _section: member.section || "",
    _status: kind === "fees" ? (member.feePaid ? "Paid" : "Unpaid") : (member.memberStatus || ""),
    _method: "", _date: member.lastPaymentDate ? hktISODate(member.lastPaymentDate) : "",
  }));
  if (kind === "payments") return data.payments.map(payment => ({
    playerName: payment.playerName, teamName: payment.teamName || "Unassigned",
    method: payment.method?.trim() ? readable(payment.method) : "Unspecified", amount: money(payment.amount), paymentDate: hktDate(payment.paymentDate),
    notes: payment.notes || "—",
    _team: teamKey(payment.teamId, payment.teamName), _section: "", _status: "",
    _method: payment.method?.trim() || "", _date: hktISODate(payment.paymentDate),
  }));
  const sessions: CurrentSession[] = kind === "training" ? data.training : data.matches;
  return sessions.flatMap(session => session.responses.map(response => ({
    session: session.title, date: hktDate(session.date), playerName: response.playerName,
    teamName: response.teamName || session.teamName || "Unassigned",
    status: rsvpLabel(response.status),
    respondedAt: hktDate(response.respondedAt, true),
    _team: teamKey(null, response.teamName || session.teamName),
    _section: "", _status: response.status, _method: "", _date: hktISODate(session.date), _sessionId: String(session.id),
  })));
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-[130px] border-l-2 border-[#d8aa78] pl-3" data-testid={`stat-${label.toLowerCase().replace(/\W+/g, "-")}`}>
    <div className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6b7888]">{label}</div>
    <div className="mt-1 font-display text-[25px] font-semibold leading-none tracking-tight text-[#1d314a]">{value}</div>
    {detail && <div className="mt-1 text-[11px] text-[#778392]">{detail}</div>}
  </div>;
}

export default function CurrentReports() {
  const { data, isLoading, isError, error, refetch, isFetching } = useCurrentReports();
  const [kind, setKind] = useState<Kind>("members");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");
  const [section, setSection] = useState("all");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chosen, setChosen] = useState<Record<Kind, string[]>>(defaults);
  const [showColumns, setShowColumns] = useState(false);

  const allRows = useMemo(() => data ? buildRows(data, kind) : [], [data, kind]);
  const isAttendance = kind === "training" || kind === "matches";
  const sessions = useMemo(() => data && isAttendance ? (kind === "training" ? data.training : data.matches) : [], [data, isAttendance, kind]);
  const teamOptions = useMemo(() => [...new Map([
    ...allRows.map(row => [row._team, row.teamName] as [string, string]),
    ...sessions.map(session => [teamKey(null, session.teamName), session.teamName || "Unassigned"] as [string, string]),
  ])].sort((a, b) => a[1].localeCompare(b[1])), [allRows, sessions]);
  const statuses = useMemo(() => [...new Map(allRows.map(row => [row._status, kind === "members" ? row.memberStatus : kind === "fees" ? row.feeStatus : row.status]))
    .entries()].filter(([value]) => value).sort((a, b) => a[1].localeCompare(b[1])), [allRows, kind]);
  const sections = useMemo(() => [...new Map(allRows.map(row => [row._section, row.section])).entries()]
    .filter(([value]) => value).sort((a, b) => a[1].localeCompare(b[1])), [allRows]);
  const methods = useMemo(() => [...new Map(allRows.map(row => [row._method, row.method])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])), [allRows]);
  const filtered = useMemo(() => allRows.filter(row =>
    (team === "all" || row._team === team || (team.startsWith("name:") && row.teamName === team.slice(5))) &&
    (status === "all" || row._status === status) &&
    (section === "all" || row._section === section) &&
    (method === "all" || row._method === method) &&
    (!from || row._date >= from) && (!to || row._date <= to)
  ), [allRows, team, status, section, method, from, to]);
  const activeColumns = columns[kind].filter(col => chosen[kind].includes(col.key));
  const sessionSummaries = useMemo<SessionSummary[]>(() => sessions.filter(session => {
    const sessionTeam = teamKey(null, session.teamName);
    return (!from || hktISODate(session.date) >= from) && (!to || hktISODate(session.date) <= to) &&
      (team === "all" || sessionTeam === team || filtered.some(row => row._sessionId === String(session.id)));
  }).map(session => {
    // Counts always come from the same filtered player rows as the detail/export,
    // rather than unfiltered API counts (which cannot reflect status/team filters).
    const rows = filtered.filter(row => row._sessionId === String(session.id));
    return {
      id: session.id, title: session.title, date: hktDate(session.date),
      teamName: session.teamName || "Unassigned", invited: rows.length,
      yes: rows.filter(row => row._status === "yes").length,
      maybe: rows.filter(row => row._status === "maybe").length,
      no: rows.filter(row => row._status === "no").length,
      noResponse: rows.filter(row => row._status === "none").length,
    };
  }), [sessions, team, from, to, filtered]);
  const count = (value: string) => filtered.filter(row => row._status === value).length;
  const amount = (field: string) => filtered.reduce((sum, row) => sum + (Number((row[field] || "").replace(/,/g, "")) || 0), 0);
  const paymentGroups = useMemo(() => kind === "payments" ? [...new Map(filtered.map(row => [row._method, row.method])).entries()].map(([key, label]) => {
    const group = filtered.filter(row => row._method === key);
    return { key, label, count: group.length, total: group.reduce((sum, row) => sum + (Number(row.amount.replace(/,/g, "")) || 0), 0) };
  }).sort((a, b) => b.total - a.total) : [], [filtered, kind]);
  const activeFilters = team !== "all" || status !== "all" || section !== "all" || method !== "all" || !!from || !!to;
  const resetFilters = () => { setTeam("all"); setStatus("all"); setSection("all"); setMethod("all"); setFrom(""); setTo(""); };
  const selectKind = (next: Kind) => { setKind(next); resetFilters(); setShowColumns(false); };
  const summary = kind === "fees"
    ? `${filtered.length} members | Due HKD ${money(amount("due"))} | Paid HKD ${money(amount("paid"))} | Balance HKD ${money(amount("balance"))}`
    : kind === "payments" ? `${filtered.length} payments | Total HKD ${money(amount("amount"))} | ${paymentGroups.map(group => `${group.label}: ${group.count} / HKD ${money(group.total)}`).join("; ")}`
    : isAttendance ? `${filtered.length} invitations | Going ${count("yes")} | Maybe ${count("maybe")} | Not going ${count("no")} | No response ${count("none")}`
    : `${filtered.length} members`;
  const scope = [
    team === "all" ? "All teams" : teamOptions.find(([key]) => key === team)?.[1] || "Selected team",
    status !== "all" ? `Status: ${readable(status)}` : "",
    section !== "all" ? `Section: ${readable(section)}` : "",
    method !== "all" ? `Method: ${method ? readable(method) : "Unspecified"}` : "",
    from ? `From ${from} HKT` : "", to ? `To ${to} HKT` : "",
  ].filter(Boolean).join(" / ");
  const exportTable = (): ExportTable => ({
    title: reports.find(report => report.id === kind)!.title,
    season: data?.season || "2026/27",
    headers: activeColumns.map(col => col.label),
    rows: filtered.map(row => activeColumns.map(col => row[col.key] || "")),
    sections: isAttendance ? [
      {
        title: `${kind === "training" ? "Training sessions" : "Matches"} — RSVP summary`,
        headers: ["Session", "Date (HKT)", "Team", "Invited", "Going", "Maybe", "Not going", "No response"],
        rows: sessionSummaries.map(session => [
          session.title, session.date, session.teamName, String(session.invited),
          String(session.yes), String(session.maybe), String(session.no), String(session.noResponse),
        ]),
      },
      { title: "Per-player RSVP detail", headers: activeColumns.map(col => col.label), rows: filtered.map(row => activeColumns.map(col => row[col.key] || "")) },
    ] : undefined,
    notes: isAttendance ? [
      "RSVP responses are not physical attendance. No response means no RSVP was recorded.",
      "Current-season audience and team assignments; historical invitations and rosters may differ.",
    ] : ["Current-season audience and team assignments; historical rosters may differ."],
    summary, scope,
    filename: `hk-masters-${(data?.season || "2026/27").replace(/\W+/g, "-")}-${kind}`,
  });

  return <PageLayout>
    <div className="mx-auto max-w-[1180px] pb-16">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[#d4dde4] pb-7">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#a5643f]">League & Socials <span className="mx-2 text-[#aeb9c2]">/</span> Committee workspace</p>
          <h1 className="font-display text-[36px] font-semibold leading-tight tracking-tight text-[#192f4a] sm:text-[44px]">Reports<span className="text-[#bc805b]">.</span></h1>
          <p className="mt-1 text-sm text-[#68798a]">A clear view of the current season, ready for committee decisions.</p>
        </div>
        <div className="rounded-xl border border-[#d5dfe6] bg-[#eef3f5] px-4 py-2 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#748597]">Current season</p>
          <p className="font-display text-lg font-semibold text-[#233d59]" data-testid="text-report-season">{data?.season || "2026/27"}</p>
        </div>
      </div>

      {isLoading ? <div className="space-y-4" aria-label="Loading current reports" data-testid="status-reports-loading">
        <div className="h-20 animate-pulse rounded-xl bg-[#e3eaee]" />
        <div className="h-56 animate-pulse rounded-xl bg-[#e3eaee]" />
        <div className="h-72 animate-pulse rounded-xl bg-[#e3eaee]" />
      </div> : isError ? <div className="rounded-2xl border border-[#e8c6b4] bg-[#fbf1ea] px-6 py-8" role="alert" data-testid="status-reports-error">
        <h2 className="font-display text-xl font-semibold text-[#743f31]">Reports are unavailable</h2>
        <p className="mt-2 text-sm text-[#805b4e]">{error instanceof Error ? error.message : "Please try again."}</p>
        <button data-testid="button-retry-reports" onClick={() => refetch()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#233d59] px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={15} /> Retry</button>
      </div> : data && <>
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="self-start rounded-2xl border border-[#d9e2e8] bg-[#edf2f4] p-3 lg:sticky lg:top-6">
            <p className="px-3 pb-3 pt-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#75879a]">Select report</p>
            <div className="space-y-1">
              {reports.map(report => {
                const Icon = report.icon;
                return <button key={report.id} data-testid={`button-report-${report.id}`} onClick={() => selectKind(report.id)} aria-current={kind === report.id ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${kind === report.id ? "bg-[#263f5d] text-[#f5f7f8] shadow-sm" : "text-[#50667a] hover:bg-[#dfe9ee]"}`}>
                  <Icon size={18} className="shrink-0" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-5">{report.title}</span><span className={`block truncate text-[11px] ${kind === report.id ? "text-[#b9c9d5]" : "text-[#8998a5]"}`}>{report.subtitle}</span></span>
                  <ChevronRight size={14} className="shrink-0 opacity-60" />
                </button>;
              })}
            </div>
            <div className="mx-3 mt-5 border-t border-[#d4dfe5] pt-4 text-xs leading-relaxed text-[#768999]">Source: live current-season records. Exports reflect the visible filters and columns.</div>
          </aside>

          <div className="min-w-0 space-y-5">
            <div className="overflow-hidden rounded-2xl border border-[#d9e2e8] bg-[#f9faf9] shadow-[0_6px_28px_rgba(28,52,73,.04)]">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e2e8ec] bg-[#f2f6f7] px-5 py-5 sm:px-7">
                <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#ae7958]">Report / 0{reports.findIndex(report => report.id === kind) + 1}</p>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-[#1c344f]">{reports.find(report => report.id === kind)?.title}</h2>
                  <p className="mt-1 text-sm text-[#7c8b97]">{reports.find(report => report.id === kind)?.subtitle}</p></div>
                <div className="flex flex-wrap gap-2">
                  <button data-testid="button-export-report-csv" disabled={(!filtered.length && !sessionSummaries.length) || !activeColumns.length} onClick={() => downloadReportCSV(exportTable())}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#cbd8df] bg-[#f9faf9] px-3.5 py-2 text-xs font-bold text-[#2a4560] transition-colors hover:bg-[#eaf0f3] disabled:cursor-not-allowed disabled:opacity-40"><Download size={15} /> CSV</button>
                  <button data-testid="button-export-report-pdf" disabled={(!filtered.length && !sessionSummaries.length) || !activeColumns.length} onClick={() => downloadReportPDF(exportTable())}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#263f5d] px-3.5 py-2 text-xs font-bold text-[#f7f9f8] transition-colors hover:bg-[#385779] disabled:cursor-not-allowed disabled:opacity-40"><FileDown size={15} /> Download PDF</button>
                </div>
              </div>

              <div className="px-5 py-5 sm:px-7">
                <div className="mb-3 flex items-center justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6d7f8e]">Refine the report</p>
                  {activeFilters && <button data-testid="button-clear-report-filters" onClick={resetFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-[#a56646] hover:underline"><FilterX size={13} /> Clear filters</button>}</div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="text-xs font-semibold text-[#52687c]">Team
                    <select data-testid="select-report-team" value={team} onChange={e => setTeam(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#cfdae1] bg-[#fdfdfb] px-3 py-2.5 text-sm font-normal text-[#1c344f] outline-none focus:border-[#446781]"><option value="all">All teams</option>{teamOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                  </label>
                  {(kind === "members" || kind === "fees" || isAttendance) && <label className="text-xs font-semibold text-[#52687c]">{isAttendance ? "RSVP" : "Status"}
                    <select data-testid="select-report-status" value={status} onChange={e => setStatus(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#cfdae1] bg-[#fdfdfb] px-3 py-2.5 text-sm font-normal text-[#1c344f] outline-none focus:border-[#446781]"><option value="all">All statuses</option>{statuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                  </label>}
                  {(kind === "members" || kind === "fees") && <label className="text-xs font-semibold text-[#52687c]">Section
                    <select data-testid="select-report-section" value={section} onChange={e => setSection(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#cfdae1] bg-[#fdfdfb] px-3 py-2.5 text-sm font-normal text-[#1c344f] outline-none focus:border-[#446781]"><option value="all">All sections</option>{sections.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                  </label>}
                  {kind === "payments" && <label className="text-xs font-semibold text-[#52687c]">Method
                    <select data-testid="select-report-method" value={method} onChange={e => setMethod(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#cfdae1] bg-[#fdfdfb] px-3 py-2.5 text-sm font-normal text-[#1c344f] outline-none focus:border-[#446781]"><option value="all">All methods</option>{methods.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                  </label>}
                  {(kind === "payments" || isAttendance) && <>
                    <label className="text-xs font-semibold text-[#52687c]">From date <span className="font-normal text-[#8b9aa5]">HKT</span><input data-testid="input-report-date-from" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#cfdae1] bg-[#fdfdfb] px-3 py-2 text-sm font-normal text-[#1c344f] outline-none focus:border-[#446781]" /></label>
                    <label className="text-xs font-semibold text-[#52687c]">To date <span className="font-normal text-[#8b9aa5]">HKT</span><input data-testid="input-report-date-to" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#cfdae1] bg-[#fdfdfb] px-3 py-2 text-sm font-normal text-[#1c344f] outline-none focus:border-[#446781]" /></label>
                  </>}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-5 border-t border-[#e2e8ec] bg-[#f4f7f7] px-5 py-5 sm:px-7">
                <Stat label={isAttendance ? "Invitations" : kind === "payments" ? "Payments" : "Members"} value={String(filtered.length)} detail="In filtered view" />
                {kind === "fees" && <><Stat label="Due" value={`$${money(amount("due"))}`} detail="HKD" /><Stat label="Paid" value={`$${money(amount("paid"))}`} detail="HKD" /><Stat label="Balance" value={`$${money(amount("balance"))}`} detail="HKD" /></>}
                {kind === "payments" && <><Stat label="Total received" value={`$${money(amount("amount"))}`} detail="HKD" /><Stat label="Methods" value={String(paymentGroups.length)} detail="In filtered view" /></>}
                {isAttendance && <><Stat label="Going" value={String(count("yes"))} /><Stat label="Maybe" value={String(count("maybe"))} /><Stat label="Not going" value={String(count("no"))} /><Stat label="No response" value={String(count("none"))} /></>}
              </div>
            </div>

            {kind === "payments" && paymentGroups.length > 0 && <div className="rounded-2xl border border-[#d9e2e8] bg-[#f9faf9] px-5 py-5 sm:px-7">
              <h3 className="font-display text-base font-semibold text-[#263f5d]">By payment method</h3>
              <div className="mt-3 divide-y divide-[#e4eaed]">{paymentGroups.map(group => <div key={group.key} className="flex items-center justify-between gap-3 py-2.5 text-sm" data-testid={`row-payment-group-${group.key}`}>
                <span className="font-medium text-[#3d5369]">{group.label} <span className="ml-2 text-xs text-[#8997a3]">{group.count} transaction{group.count === 1 ? "" : "s"}</span></span><strong className="font-semibold tabular-nums text-[#223d58]">HK$ {money(group.total)}</strong>
              </div>)}</div>
            </div>}

            {isAttendance && <div className="overflow-hidden rounded-2xl border border-[#d9e2e8] bg-[#f9faf9]" data-testid="section-session-summary">
              <div className="border-b border-[#e2e8ec] px-5 py-4 sm:px-7"><h3 className="font-display text-lg font-semibold text-[#263f5d]">{kind === "training" ? "Training sessions" : "Matches"} / RSVP summary</h3><p className="mt-0.5 text-xs text-[#8796a2]">{sessionSummaries.length} {kind === "training" ? (sessionSummaries.length === 1 ? "session" : "sessions") : (sessionSummaries.length === 1 ? "match" : "matches")} in scope · counts reflect the filtered player detail below</p></div>
              {sessionSummaries.length ? <div className="max-h-[380px] overflow-auto"><table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-[#edf2f4]"><tr>{["Session", "Date (HKT)", "Team", "Invited", "Going", "Maybe", "Not going", "No response"].map(header => <th key={header} className="whitespace-nowrap border-b border-[#d8e2e7] px-4 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-[#64798b]">{header}</th>)}</tr></thead>
                <tbody className="divide-y divide-[#edf0f1]">{sessionSummaries.map(session => <tr key={session.id} data-testid={`row-session-summary-${session.id}`} className="hover:bg-[#f1f5f5]">
                  <td className="px-4 py-3 font-semibold text-[#284158]">{session.title}</td><td className="whitespace-nowrap px-4 py-3 text-[#526779]">{session.date}</td><td className="px-4 py-3 text-[#526779]">{session.teamName}</td>
                  {[session.invited, session.yes, session.maybe, session.no, session.noResponse].map((value, index) => <td key={index} className="px-4 py-3 tabular-nums text-[#344c62]">{value}</td>)}
                </tr>)}</tbody>
              </table></div> : <div className="px-5 py-8 text-center text-sm text-[#82919c]" data-testid="status-session-summary-empty">No {kind === "training" ? "sessions" : "matches"} match this team and date range.</div>}
            </div>}

            <div className="overflow-hidden rounded-2xl border border-[#d9e2e8] bg-[#f9faf9]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8ec] px-5 py-4 sm:px-7">
                <div><h3 className="font-display text-lg font-semibold text-[#263f5d]">{isAttendance ? "Per-player RSVP detail" : "Preview"}</h3><p className="text-xs text-[#8796a2]" data-testid="text-report-row-count">{filtered.length} row{filtered.length === 1 ? "" : "s"} · {isFetching ? "Refreshing…" : "Current data"}</p></div>
                <button data-testid="button-customize-report-columns" onClick={() => setShowColumns(value => !value)} aria-expanded={showColumns} className="inline-flex items-center gap-2 rounded-lg border border-[#d1dde3] px-3 py-2 text-xs font-semibold text-[#3b5871] hover:bg-[#edf3f5]"><SlidersHorizontal size={14} /> Columns</button>
              </div>
              {showColumns && <div className="flex flex-wrap gap-x-5 gap-y-3 border-b border-[#e2e8ec] bg-[#f3f6f7] px-5 py-4 sm:px-7">
                {columns[kind].map(column => <label key={column.key} className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#3e5368]"><input data-testid={`checkbox-report-column-${column.key}`} type="checkbox" checked={chosen[kind].includes(column.key)} onChange={() => setChosen(previous => ({ ...previous, [kind]: previous[kind].includes(column.key) ? previous[kind].filter(key => key !== column.key) : [...previous[kind], column.key] }))} className="accent-[#294a68]" />{column.label}</label>)}
                {!activeColumns.length && <p className="w-full text-xs text-[#a56646]">Select a column to preview or export.</p>}
              </div>}
              {!filtered.length ? <div className="px-6 py-14 text-center" data-testid="status-report-empty">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e9f0f2] text-[#6c8191]"><FilterX size={22} /></div>
                <h4 className="font-display text-lg font-semibold text-[#304961]">{sessionSummaries.length ? "No player responses in this view" : allRows.length ? "No rows match these filters" : "Nothing to report yet"}</h4>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[#82919c]">{sessionSummaries.length ? "The session summary above includes events with zero invited players and reflects these filters." : allRows.length ? "Try a different team, status or date range." : "Current-season records will appear here as they are added."}</p>
                {activeFilters && <button data-testid="button-reset-empty-filters" onClick={resetFilters} className="mt-4 text-sm font-semibold text-[#a56646] hover:underline">Clear filters</button>}
              </div> : activeColumns.length > 0 && <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[580px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#edf2f4]"><tr>{activeColumns.map(col => <th key={col.key} className="whitespace-nowrap border-b border-[#d8e2e7] px-5 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-[#64798b]">{col.label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-[#edf0f1]">{filtered.map((row, index) => <tr key={index} className="hover:bg-[#f1f5f5]" data-testid={`row-report-${index}`}>{activeColumns.map(col => <td key={col.key} className="max-w-[220px] truncate whitespace-nowrap px-5 py-3 text-[#344c62]" title={row[col.key]}>{row[col.key] || "—"}</td>)}</tr>)}</tbody>
                </table>
              </div>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {isAttendance && <div className="flex gap-3 rounded-xl border border-[#d5e1e4] bg-[#edf4f4] p-4 text-xs leading-relaxed text-[#526d75]"><Info size={17} className="mt-0.5 shrink-0 text-[#4f7d86]" /><p><strong className="text-[#2c5861]">RSVP is not physical attendance.</strong> These are invitation responses, not a record of who actually attended. “No response” means no RSVP was recorded.</p></div>}
              <div className={`flex gap-3 rounded-xl border border-[#d5e1e4] bg-[#edf4f4] p-4 text-xs leading-relaxed text-[#526d75] ${!isAttendance ? "sm:col-span-2" : ""}`}><Info size={17} className="mt-0.5 shrink-0 text-[#4f7d86]" /><p><strong className="text-[#2c5861]">Roster context.</strong> This report uses the current-season audience and current team assignments. Historical invitations and past rosters may differ from today’s membership.</p></div>
            </div>
            <div className="flex gap-3 rounded-xl border border-[#ead6c3] bg-[#faf4ec] p-4 text-xs leading-relaxed text-[#805c42]"><LockKeyhole size={17} className="mt-0.5 shrink-0 text-[#a56843]" /><p><strong className="text-[#75482f]">Private export.</strong> CSV and PDF may contain member names, email addresses, payment notes and payment information. Download only when needed, store securely and share only with authorised committee staff.</p></div>
          </div>
        </div>
      </>}
    </div>
  </PageLayout>;
}