import { Link } from "wouter";
import content from "../content/teams.json";
import RichText from "../components/RichText";
import { usePageTexts } from "../utils/pageTexts";
import { LADIES_TEAMS, MEN_TEAM, fixturesHref } from "../content/leagueTeams";

function TeamCard({ label, division, slug, linkLabel, accent }) {
  return (
    <Link
      href={fixturesHref(slug)}
      data-testid={`link-fixtures-${slug}`}
      className="group flex flex-col justify-between rounded-2xl border border-[#D9C9A8] bg-white p-6 shadow-sm transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A6E]"
    >
      <div>
        <div className={`mb-4 h-1 w-12 rounded-full ${accent}`} />
        <p className="text-xs font-bold uppercase tracking-widest text-[#DE2910]">{division}</p>
        <h3 className="mt-1 text-2xl font-extrabold text-[#1E3A6E]">{label}</h3>
      </div>
      <span className="mt-5 inline-flex min-h-10 items-center gap-1 text-sm font-bold text-[#1E3A6E] group-hover:text-[#DE2910]">
        {linkLabel}
        <svg aria-hidden="true" className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}

function Fee({ amount, name, description }) {
  return (
    <div className="rounded-xl border border-[#D9C9A8] bg-[#FFFDF8] p-5">
      <p className="mb-2 text-3xl font-extrabold text-[#DE2910]">{amount}</p>
      <h4 className="mb-2 text-lg font-bold text-[#1E3A6E]">{name}</h4>
      {description && <p className="leading-relaxed text-[#5A4F45]">{description}</p>}
    </div>
  );
}

export default function Teams() {
  const t = usePageTexts("teams", content);
  const linkLabel = t.fixtures_link_label || "View fixtures";

  return (
    <div>
      <div className="bg-[#1E3A6E] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="mb-4 inline-block rounded-full bg-[#DE2910] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {t.header_badge}
          </span>
          <h1 className="mb-3 text-4xl font-extrabold sm:text-5xl">{t.header_title}</h1>
          <p className="max-w-3xl text-lg text-[#BFD9F5]">{t.league_header_subtitle}</p>
        </div>
      </div>

      <section className="bg-[#F2E8D5] pt-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="max-w-3xl border-l-4 border-[#5B9FE0] pl-5 text-xl leading-relaxed text-[#1E3A6E]" data-testid="text-league-intro">
            {t.league_intro}
          </p>
        </div>
      </section>

      {/* Ladies Masters */}
      <section id="ladies" aria-labelledby="ladies-heading" className="bg-[#F2E8D5] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="mb-4 inline-block rounded-full bg-[#DE2910] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {t.ladies_badge}
          </span>
          <h2 id="ladies-heading" className="mb-4 text-3xl font-extrabold text-[#1E3A6E] sm:text-4xl">{t.league_ladies_heading}</h2>
          <p className="mb-8 max-w-3xl text-lg leading-relaxed text-[#5A4F45]">{t.ladies_league_text}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {LADIES_TEAMS.map((team) => (
              <TeamCard key={team.slug} label={team.label} division={team.division} slug={team.slug} linkLabel={linkLabel} accent="bg-[#DE2910]" />
            ))}
          </div>
        </div>
      </section>

      {/* Men's Masters */}
      <section id="men" aria-labelledby="men-heading" className="bg-[#EDE0C4] py-14">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="lg:col-span-2">
            <span className="mb-4 inline-block rounded-full bg-[#1E3A6E] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              {MEN_TEAM.label}
            </span>
            <h2 id="men-heading" className="mb-4 text-3xl font-extrabold text-[#1E3A6E] sm:text-4xl">{t.league_mens_heading}</h2>
            <RichText content={t.mens_text} preserveLineBreaks className="text-lg leading-relaxed text-[#5A4F45]" />
          </div>
          <TeamCard label={MEN_TEAM.label} division={MEN_TEAM.division} slug={MEN_TEAM.slug} linkLabel={linkLabel} accent="bg-[#5B9FE0]" />
        </div>
      </section>

      {/* Shared fees */}
      <section aria-labelledby="fees-heading" className="bg-[#F2E8D5] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#D9C9A8] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-5 h-1 w-12 rounded-full bg-[#5B9FE0]" />
            <h2 id="fees-heading" className="mb-2 text-2xl font-bold text-[#1E3A6E]">{t.fees_heading}</h2>
            <p className="mb-6 text-[#5A4F45]">{t.league_fees_note}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Fee amount={t.registration_fee_amount} name={t.registration_fee_name} description={t.registration_fee_description} />
              <Fee amount={t.active_fee_amount} name={t.active_fee_name} />
              <Fee amount={t.division_one_fee_amount} name={t.league_squad_fee_name} description={t.league_squad_fee_description} />
            </div>
          </div>
        </div>
      </section>

      {/* Join CTA */}
      <section className="bg-[#1E3A6E] py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-extrabold text-white">{t.league_join_heading}</h2>
          <p className="mx-auto mb-6 max-w-xl leading-relaxed text-[#D6E8F7]">{t.league_join_text}</p>
          <a
            href={t.join_url}
            data-testid="link-join"
            className="btn-shimmer inline-flex min-h-12 items-center rounded-lg bg-[#DE2910] px-8 py-3 font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t.join_button_label}
          </a>
        </div>
      </section>
    </div>
  );
}
