import { useState, useEffect } from "react";
import { cloudinaryResize } from "../utils/cloudinary.js";
import { API_BASE } from "../utils/api";

const TIER_ORDER = ["Gold", "Silver", "Bronze"];

const TIER_GLOW = {
  Gold:   "255,200,50",
  Silver: "180,180,200",
  Bronze: "220,130,40",
};

const TIER_LABEL = {
  Gold:   { text: "#f59e0b", border: "rgba(245,158,11,0.4)"  },
  Silver: { text: "#9ca3af", border: "rgba(156,163,175,0.4)" },
  Bronze: { text: "#f97316", border: "rgba(249,115,22,0.4)"  },
};

const TIER_COLS = {
  Gold:   { one: "max-w-md mx-auto", multi: "grid-cols-1 sm:grid-cols-2" },
  Silver: { one: "max-w-md mx-auto", multi: "grid-cols-2 sm:grid-cols-3" },
  Bronze: { one: "max-w-md mx-auto", multi: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" },
};

const sponsorshipEmail = "sponsorship@hkmastershockey.com";

function SponsorCard({ sponsor }) {
  const [imgFailed, setImgFailed] = useState(false);
  const displayUrl = cloudinaryResize(sponsor.logoUrl, 600);
  const glow  = TIER_GLOW[sponsor.tier]  || TIER_GLOW.Bronze;
  const label = TIER_LABEL[sponsor.tier] || TIER_LABEL.Bronze;

  const logoArea = displayUrl && !imgFailed ? (
    <img
      src={displayUrl}
      alt={sponsor.name}
      className="max-h-28 max-w-xs object-contain"
      onError={() => setImgFailed(true)}
    />
  ) : (
    <div className="text-center px-4">
      <p className="text-white font-bold text-xl tracking-wide">{sponsor.name}</p>
      <p style={{ color: label.text }} className="text-xs mt-1 tracking-widest uppercase">Logo coming soon</p>
    </div>
  );

  const card = (
    <div className="group relative">
      {/* Hover glow halo */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ boxShadow: `0 0 60px 10px rgba(${glow},0.3)` }}
      />
      {/* Glass card */}
      <div
        className="relative rounded-2xl flex flex-col items-center justify-center py-10 px-8 gap-5 overflow-hidden min-h-[180px]"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
          border: `1px solid rgba(${glow},0.25)`,
          boxShadow: `0 0 30px rgba(${glow},0.08), inset 0 1px 0 rgba(255,255,255,0.07)`,
        }}
      >
        {/* Radial glow behind logo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(${glow},0.13) 0%, transparent 68%)` }}
        />
        <div className="relative z-10 flex items-center justify-center">
          {logoArea}
        </div>
        {sponsor.websiteUrl && (
          <p className="relative z-10 text-white/35 text-xs tracking-widest uppercase">
            {sponsor.websiteUrl.replace(/^https?:\/\//, "")}
          </p>
        )}
      </div>
    </div>
  );

  if (sponsor.websiteUrl) {
    return (
      <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="block">
        {card}
      </a>
    );
  }
  return card;
}

export default function Sponsors() {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/sponsors`)
      .then((res) => res.json())
      .then((data) => setSponsors(Array.isArray(data) ? data : []))
      .catch(() => setSponsors([]))
      .finally(() => setLoading(false));
  }, []);

  const activeSponsors = sponsors.filter((s) => s.active);
  const tierGroups = TIER_ORDER.map((name) => ({
    name,
    sponsors: activeSponsors.filter((s) => s.tier === name),
  })).filter((t) => t.sponsors.length > 0);
  const hasSponsors = tierGroups.length > 0;

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold mb-3">Our Sponsors</h1>
          <p className="text-green-200 text-lg max-w-xl">
            We are grateful to our sponsors for making Hong Kong Masters Hockey possible.
          </p>
        </div>
      </div>

      {/* ── Sponsor showcase ────────────────────────────────────── */}
      {loading ? (
        <section
          className="py-24 text-center"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
        >
          <p className="text-white/30 text-sm tracking-widest uppercase">Loading…</p>
        </section>
      ) : hasSponsors ? (
        <section
          className="py-20 px-4 sm:px-6 lg:px-8"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
        >
          <div className="max-w-5xl mx-auto space-y-20">
            {tierGroups.map(({ name, sponsors }) => {
              const glow = TIER_GLOW[name] || TIER_GLOW.Bronze;
              const lbl  = TIER_LABEL[name] || TIER_LABEL.Bronze;
              const cols = TIER_COLS[name]  || TIER_COLS.Bronze;
              return (
                <div key={name}>
                  {/* Tier divider */}
                  <div className="flex items-center gap-4 mb-10">
                    <div className="h-px flex-1" style={{ background: `rgba(${glow},0.3)` }} />
                    <span
                      className="text-xs font-bold tracking-widest uppercase px-5 py-2 rounded-full border"
                      style={{
                        color: lbl.text,
                        borderColor: lbl.border,
                        background: `rgba(${glow},0.08)`,
                      }}
                    >
                      {name} Sponsors
                    </span>
                    <div className="h-px flex-1" style={{ background: `rgba(${glow},0.3)` }} />
                  </div>

                  {/* Logo grid */}
                  <div className={`grid gap-6 ${sponsors.length === 1 ? cols.one : cols.multi}`}>
                    {sponsors.map((sponsor) => (
                      <SponsorCard key={sponsor.id} sponsor={sponsor} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section
          className="py-24 text-center px-4"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
        >
          <p className="text-white/50 text-lg font-medium mb-2">Sponsor announcements coming soon</p>
          <p className="text-white/25 text-sm">
            We're finalising our sponsorship packages for the 2026 season. Check back shortly.
          </p>
        </section>
      )}

      {/* ── Become a Sponsor CTA ────────────────────────────────── */}
      <section className="bg-[#006B3C] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-white mb-4">Become a Sponsor</h2>
            <p className="text-green-100 leading-relaxed mb-4">
              Partnering with Hong Kong Masters Hockey gives your brand access to a community of
              active, affluent, and engaged professionals aged 35 and above. We compete at the
              highest levels of international masters hockey and carry your brand with us.
            </p>
            <p className="text-green-100 leading-relaxed mb-8">
              Whether you're looking for kit branding, event sponsorship, social media exposure, or
              hospitality opportunities, we have a sponsorship package to match your goals.
              Get in touch and let's build something great together.
            </p>
            <a
              href={`mailto:${sponsorshipEmail}`}
              className="inline-block bg-[#DE2910] text-white font-bold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
            >
              Contact Us About Sponsorship
            </a>
            <p className="text-green-300 text-sm mt-3">{sponsorshipEmail}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
