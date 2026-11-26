import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../utils/api";
import {
  LADIES_SOURCE_URL, LADIES_TEAMS, ladiesTeamForSource, isUnconfirmed, splitLadiesFixtures,
} from "../content/leagueTeams";

const TZ = "Asia/Hong_Kong";
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
const fmtChecked = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });

export function LadiesFixtureCard({ fixture, sourceUrl, past = false }) {
  const team = ladiesTeamForSource(fixture.teamName);
  const flagged = isUnconfirmed(fixture);
  return (
    <article
      data-testid={`card-ladies-fixture-${fixture.id}`}
      className={`rounded-2xl border bg-white p-5 shadow-sm ${flagged ? "border-amber-400 border-dashed" : past ? "border-[#D9C9A8] opacity-90" : "border-[#D9C9A8]"}`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="rounded-full bg-[#1E3A6E] px-2.5 py-1 text-xs font-bold text-white">
          {team ? team.label : fixture.teamName}
        </span>
        <span className="text-xs font-semibold text-[#5A4F45]">{team?.division || fixture.division}</span>
        {flagged && (
          <span data-testid={`status-ladies-source-${fixture.id}`} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
            {fixture.isInactive ? "Inactive" : "Not confirmed"}{fixture.sourceStatus ? `: ${fixture.sourceStatus}` : ""}
          </span>
        )}
        {past && !flagged && (
          <span className="rounded-full bg-[#EDE0C4] px-2.5 py-1 text-xs font-bold text-[#5A4F45]">Past fixture</span>
        )}
      </div>
      <p className="text-sm font-bold text-[#1E3A6E]">
        <time dateTime={fixture.kickoffAt}>{fmtDate(fixture.kickoffAt)} · {fmtTime(fixture.kickoffAt)}</time>
      </p>
      <p className="mt-1 text-lg font-extrabold text-gray-900">
        {fixture.homeTeam} <span className="font-semibold text-gray-400">v</span> {fixture.awayTeam}
      </p>
      {fixture.venue && <p className="mt-1 text-sm text-gray-600">{fixture.venue}</p>}
      {(flagged || past) && (
        <a
          href={sourceUrl || LADIES_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[#1E3A6E] underline underline-offset-2 hover:text-[#DE2910]"
        >
          {flagged ? "Check official schedule" : "View official schedule"}
        </a>
      )}
    </article>
  );
}

function Group({ title, note, items, sourceUrl, past }) {
  if (!items.length) return null;
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-xl font-bold text-[#1E3A6E]">{title}</h3>
        <span className="rounded-full bg-[#1E3A6E] px-2.5 py-0.5 text-xs font-bold text-white">{items.length}</span>
      </div>
      {note && <p className="mb-4 text-sm text-gray-600">{note}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => <LadiesFixtureCard key={f.id} fixture={f} sourceUrl={sourceUrl} past={past} />)}
      </div>
    </div>
  );
}

export default function LadiesFixtures({ teamSlug = "all" }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(`${API_BASE}/api/league-fixtures/ladies`)
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then((data) => {
        if (!data || !Array.isArray(data.fixtures) || !Number.isFinite(Date.parse(data.fetchedAt))) {
          throw new Error("Invalid fixture response");
        }
        setState({ loading: false, error: null, data });
      })
      .catch((e) => setState({ loading: false, error: e.message, data: null }));
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = LADIES_TEAMS.find((t) => t.slug === teamSlug);
  const heading = selected ? `${selected.label} · ${selected.division}` : "Ladies Masters";
  const { loading, error, data } = state;

  return (
    <section aria-labelledby="ladies-fixtures-heading" className="mb-16" data-testid="section-ladies-fixtures">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#D9C9A8] pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#DE2910]">League fixtures</p>
          <h2 id="ladies-fixtures-heading" className="text-3xl font-extrabold text-[#1E3A6E]">{heading}</h2>
        </div>
        <p className="text-xs text-gray-600 max-w-sm">
          Source:{" "}
          <a href={data?.sourceUrl || LADIES_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1E3A6E] underline">
            Hong Kong Hockey Association
          </a>
          {data?.fetchedAt && <> · Last checked {fmtChecked(data.fetchedAt)} HKT</>}
          {data?.season && <> · {data.season}</>}
        </p>
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading Ladies fixtures">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 rounded-2xl border border-[#D9C9A8] bg-white/70 motion-safe:animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 flex flex-wrap items-center gap-3">
          <span>Ladies fixtures are unavailable right now. Please check the official schedule.</span>
          <button type="button" onClick={load} data-testid="button-retry-ladies" className="min-h-10 rounded-lg bg-white px-3 font-semibold text-[#1E3A6E] border border-red-200 hover:bg-red-100">
            Retry
          </button>
          <a href={LADIES_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Official schedule</a>
        </div>
      ) : (
        <LadiesBody data={data} teamSlug={teamSlug} />
      )}
    </section>
  );
}

function LadiesBody({ data, teamSlug }) {
  const selected = LADIES_TEAMS.find((t) => t.slug === teamSlug);
  const all = Array.isArray(data?.fixtures) ? data.fixtures : [];
  const fixtures = selected ? all.filter((f) => f.teamName === selected.sourceTeamName) : all;
  const { upcoming, flagged, past } = splitLadiesFixtures(fixtures);
  const sourceUrl = data?.sourceUrl;

  return (
    <>
      {data?.stale && (
        <p role="status" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Showing previously saved fixtures because the official source could not be reached. Details may be out of date.
        </p>
      )}
      {fixtures.length === 0 ? (
        <div className="rounded-2xl border border-[#D9C9A8] bg-white p-10 text-center">
          <p className="font-semibold text-[#1E3A6E]">No Ladies fixtures published yet</p>
          <p className="mt-1 text-sm text-gray-600">Fixtures appear here once the league publishes them.</p>
        </div>
      ) : (
        <>
          <Group title="Upcoming fixtures" items={upcoming} sourceUrl={sourceUrl} />
          <Group title="Inactive or flagged by source" note="These fixtures are not confirmed. Check the official schedule before travelling." items={flagged} sourceUrl={sourceUrl} />
          <details className="rounded-2xl border border-[#D9C9A8] bg-white/40 p-5">
            <summary className="min-h-10 cursor-pointer text-lg font-bold text-[#1E3A6E]">
              Past fixtures ({past.length})
            </summary>
            <div className="mt-4">
              <Group title="Past fixtures" note="This is a fixture schedule only; match results are not supplied by this feed." items={past} sourceUrl={sourceUrl} past />
            </div>
          </details>
        </>
      )}
    </>
  );
}
