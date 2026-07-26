// Variant C – Stage Spotlight
import React from "react";
// White canvas, dramatic spotlight glow radiating from behind the logo centre,
// sponsor name below in refined typography — awards-night presentation feel

const WALLEM_LOGO = "/api/site-content/image/objects/uploads/2cd28042-c81d-476e-9117-168e528578bb";

function WallemPlaceholder() {
  return (
    <div
      style={{
        background: "#1b2f5e",
        padding: "22px 48px",
        borderRadius: 8,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ color: "#fff", fontWeight: 700, letterSpacing: "0.22em", fontSize: 32, textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif" }}>
        WALLEM
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 2.5, width: 32, background: "#c0392b", borderRadius: 2 }} />
        ))}
      </div>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, letterSpacing: "0.2em", marginTop: 5 }}>
        EST. 1903
      </div>
    </div>
  );
}

type Tier = "Gold" | "Silver" | "Bronze";

const TIER_SPOTLIGHT: Record<Tier, { glow: string; ring: string; label: string; pill: string }> = {
  Gold: {
    glow: "rgba(251,191,36,0.18), rgba(245,158,11,0.06)",
    ring: "rgba(251,191,36,0.35)",
    label: "#b45309",
    pill: "bg-gradient-to-r from-yellow-400 to-amber-500 text-white",
  },
  Silver: {
    glow: "rgba(148,163,184,0.18), rgba(100,116,139,0.06)",
    ring: "rgba(148,163,184,0.35)",
    label: "#475569",
    pill: "bg-gradient-to-r from-slate-400 to-slate-500 text-white",
  },
  Bronze: {
    glow: "rgba(249,115,22,0.2), rgba(234,88,12,0.06)",
    ring: "rgba(249,115,22,0.35)",
    label: "#ea580c",
    pill: "bg-gradient-to-r from-orange-400 to-orange-500 text-white",
  },
};

function LogoArea({ logoUrl, name }: { logoUrl?: string; name: string }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className="relative flex items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105">
      {logoUrl && !failed ? (
        <img
          src={logoUrl}
          alt={name}
          className="max-h-28 max-w-[280px] object-contain drop-shadow-lg"
          onError={() => setFailed(true)}
        />
      ) : (
        <WallemPlaceholder />
      )}
    </div>
  );
}

const sponsors = [
  { id: "1", name: "Wallem", logoUrl: WALLEM_LOGO, websiteUrl: "https://wallem.com", tier: "Bronze" as Tier },
];

export function HeroCard() {
  const groups = (["Gold", "Silver", "Bronze"] as Tier[])
    .map(t => ({ tier: t, list: sponsors.filter(s => s.tier === t) }))
    .filter(g => g.list.length > 0);

  return (
    <div className="min-h-screen bg-white p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-16">
        {groups.map(({ tier, list }) => {
          const cfg = TIER_SPOTLIGHT[tier];
          return (
            <div key={tier}>
              {/* Tier header */}
              <div className="flex items-center gap-4 mb-8">
                <span className={`text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full ${cfg.pill}`}>
                  {tier} Sponsors
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <div className={`grid gap-8 ${list.length === 1 ? "grid-cols-1 max-w-lg mx-auto" : list.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {list.map(s => (
                  <a
                    key={s.id}
                    href={s.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <div
                      className="relative rounded-3xl border border-gray-100 overflow-hidden transition-all duration-300 group-hover:border-transparent"
                      style={{
                        boxShadow: "0 2px 20px rgba(0,0,0,0.06)",
                      }}
                    >
                      {/* Spotlight radial glow */}
                      <div
                        className="absolute inset-0 transition-opacity duration-300"
                        style={{
                          background: `radial-gradient(ellipse at 50% 45%, ${cfg.glow}, transparent 70%)`,
                        }}
                      />

                      {/* Outer ring on hover — simulated via box shadow on inner */}
                      <div className="relative flex flex-col items-center justify-center px-10 pt-14 pb-8 gap-6">
                        {/* Logo area */}
                        <LogoArea logoUrl={s.logoUrl} name={s.name} />

                        {/* Divider */}
                        <div className="w-12 h-px" style={{ background: cfg.ring }} />

                        {/* Sponsor name + URL */}
                        <div className="text-center">
                          <p className="font-bold text-gray-800 text-base tracking-wide">{s.name}</p>
                          {s.websiteUrl && (
                            <p className="text-xs mt-1" style={{ color: cfg.label }}>
                              {s.websiteUrl.replace(/^https?:\/\//, "")}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Bottom accent bar */}
                      <div
                        className="h-1 w-full"
                        style={{
                          background: `linear-gradient(to right, transparent, ${cfg.ring}, transparent)`,
                        }}
                      />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
