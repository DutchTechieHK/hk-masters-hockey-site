import { useState, useEffect } from "react";
import { Link } from "wouter";
import { API_BASE } from "../utils/api";

function useSponsors() {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/sponsors`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setSponsors(Array.isArray(data) ? data : []))
      .catch(() => setSponsors([]))
      .finally(() => setLoading(false));
  }, []);

  return { sponsors, loading };
}

const TIER_ORDER = ["Gold", "Silver", "Bronze"];

function SponsorCard({ sponsor, size }) {
  const inner = sponsor.logoUrl ? (
    <img
      src={sponsor.logoUrl}
      alt={sponsor.name}
      className={`object-contain ${size === "gold" ? "max-h-20 max-w-[220px]" : "max-h-12 max-w-[140px]"}`}
    />
  ) : (
    <span className={`font-semibold text-gray-500 ${size === "gold" ? "text-sm" : "text-xs"}`}>
      {sponsor.name}
    </span>
  );

  const cardClass = `flex items-center justify-center rounded-xl border border-gray-100 shadow-sm bg-white transition-shadow hover:shadow-md ${
    size === "gold" ? "p-6 min-h-[100px]" : "p-4 min-h-[72px]"
  }`;

  if (sponsor.websiteUrl) {
    return (
      <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className={cardClass}>
        {inner}
      </a>
    );
  }
  return <div className={cardClass}>{inner}</div>;
}

export default function SponsorStrip({ borderTop = true }) {
  const { sponsors, loading } = useSponsors();

  const activeSponsors = sponsors.filter((s) => s.active);
  const grouped = TIER_ORDER.map((tier) => ({
    tier,
    items: activeSponsors.filter((s) => s.tier === tier),
  })).filter((g) => g.items.length > 0);

  const borderClass = borderTop ? "border-t border-gray-100" : "";

  if (loading || grouped.length === 0) {
    return (
      <section className={`py-12 ${borderClass}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-widest mb-8">
            Our Sponsors
          </p>
          {loading ? (
            <div className="flex justify-center">
              <div className="text-gray-300 text-sm">Loading…</div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-8 items-center">
              <div className="bg-gray-100 rounded-lg px-8 py-4 text-gray-400 font-medium text-sm">
                Sponsor logos managed via CMS &rarr; Sponsors section
              </div>
            </div>
          )}
          <div className="text-center mt-6">
            <Link href="/sponsors" className="text-[#006B3C] text-sm font-medium hover:text-green-800 transition-colors duration-150">
              Become a sponsor &rarr;
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const goldGroup = grouped.find((g) => g.tier === "Gold");
  const otherGroups = grouped.filter((g) => g.tier !== "Gold");

  return (
    <section className={`py-12 ${borderClass}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-widest mb-8">
          Our Sponsors
        </p>

        {goldGroup && (
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 text-white uppercase tracking-wide">
                Gold
              </span>
            </div>
            <div className={`grid gap-5 mx-auto max-w-3xl ${
              goldGroup.items.length === 1 ? "grid-cols-1 max-w-xs" : "grid-cols-1 sm:grid-cols-2"
            }`}>
              {goldGroup.items.map((s, i) => (
                <SponsorCard key={s.id ?? i} sponsor={s} size="gold" />
              ))}
            </div>
          </div>
        )}

        {otherGroups.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4">
            {otherGroups.flatMap((g) =>
              g.items.map((s, i) => (
                <div key={`${g.tier}-${s.id ?? i}`} className="w-36 sm:w-44">
                  <SponsorCard sponsor={s} size="small" />
                </div>
              ))
            )}
          </div>
        )}

        <div className="text-center mt-8">
          <Link href="/sponsors" className="text-[#006B3C] text-sm font-medium hover:text-green-800 transition-colors duration-150">
            View all sponsors &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
