import { useState, useEffect } from "react";
import { Link } from "wouter";
import { API_BASE } from "../utils/api";
import { cloudinaryResize } from "../utils/cloudinary";

const TIER_ORDER = ["Gold", "Silver", "Bronze"];

const TIER_GLOW = {
  Gold:   "255,200,50",
  Silver: "180,180,200",
  Bronze: "220,130,40",
};

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

function GlassCard({ sponsor }) {
  const [imgFailed, setImgFailed] = useState(false);
  const glow = TIER_GLOW[sponsor.tier] || TIER_GLOW.Bronze;
  const displayUrl = cloudinaryResize(sponsor.logoUrl, 400);

  const logoArea = displayUrl && !imgFailed ? (
    <img
      src={displayUrl}
      alt={sponsor.name}
      className="max-h-20 max-w-[200px] object-contain"
      onError={() => setImgFailed(true)}
    />
  ) : (
    <span className="text-white font-semibold text-sm text-center px-4">{sponsor.name}</span>
  );

  const inner = (
    <div className="group relative">
      {/* Hover halo */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ boxShadow: `0 0 60px 10px rgba(${glow},0.35)` }}
      />
      {/* Glass card */}
      <div
        className="relative rounded-2xl flex items-center justify-center py-8 px-6 min-h-[120px] overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
          border: `1px solid rgba(${glow},0.25)`,
          boxShadow: `0 0 30px rgba(${glow},0.08), inset 0 1px 0 rgba(255,255,255,0.07)`,
        }}
      >
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(${glow},0.13) 0%, transparent 68%)` }}
        />
        <div className="relative z-10 flex items-center justify-center">
          {logoArea}
        </div>
      </div>
    </div>
  );

  if (sponsor.websiteUrl) {
    return (
      <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }
  return inner;
}

export default function SponsorStrip() {
  const { sponsors, loading } = useSponsors();

  const activeSponsors = sponsors.filter((s) => s.active);
  const sorted = TIER_ORDER.flatMap((tier) =>
    activeSponsors.filter((s) => s.tier === tier)
  );

  return (
    <section
      className="py-16"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold text-white/30 uppercase tracking-[0.2em] mb-10">
          Our Sponsors
        </p>

        {loading ? (
          <div className="flex justify-center">
            <p className="text-white/20 text-sm tracking-widest uppercase">Loading…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex justify-center">
            <p className="text-white/20 text-sm">Sponsors coming soon.</p>
          </div>
        ) : (
          <div className={`grid gap-5 ${
            sorted.length === 1
              ? "grid-cols-1 max-w-xs mx-auto"
              : sorted.length === 2
              ? "grid-cols-1 sm:grid-cols-2 max-w-xl mx-auto"
              : "grid-cols-2 sm:grid-cols-3"
          }`}>
            {sorted.map((s) => (
              <GlassCard key={s.id} sponsor={s} />
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            href="/sponsors"
            className="text-sm font-medium text-white/40 hover:text-white/70 tracking-wide transition-colors duration-150"
          >
            View all sponsors →
          </Link>
        </div>
      </div>
    </section>
  );
}
