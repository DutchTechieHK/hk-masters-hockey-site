// Variant A – Dark Prestige
import React from "react";
// Rich dark stage, logo large with a glowing radial halo, metallic tier label

const WALLEM_LOGO = "https://res.cloudinary.com/djyvdrhal/image/upload/f_auto/Wallem-Wordmark-Light_1_.jpg";

// Styled placeholder that mimics the Wallem dark-navy logo for mockup fidelity
function WallemPlaceholder({ large = false }: { large?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded"
      style={{
        background: "#1b2f5e",
        padding: large ? "20px 40px" : "12px 24px",
        minWidth: large ? 260 : 160,
      }}
    >
      <div
        style={{
          color: "#fff",
          fontFamily: "'Arial', sans-serif",
          fontWeight: 700,
          letterSpacing: "0.2em",
          fontSize: large ? 28 : 18,
          textTransform: "uppercase",
        }}
      >
        WALLEM
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 2, width: large ? 28 : 18, background: "#c0392b", borderRadius: 1 }} />
        ))}
      </div>
      <div
        style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: large ? 10 : 8,
          letterSpacing: "0.15em",
          marginTop: 4,
        }}
      >
        EST. 1903
      </div>
    </div>
  );
}

function SponsorLogo({ logoUrl, name, large }: { logoUrl?: string; name: string; large?: boolean }) {
  const [failed, setFailed] = React.useState(false);
  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={large ? "max-h-28 max-w-xs object-contain" : "max-h-16 max-w-[200px] object-contain"}
        onError={() => setFailed(true)}
      />
    );
  }
  return <WallemPlaceholder large={large} />;
}

type Tier = "Gold" | "Silver" | "Bronze";

const TIER_GLOW: Record<Tier, string> = {
  Gold: "255,200,50",
  Silver: "180,180,200",
  Bronze: "220,130,40",
};
const TIER_LABEL: Record<Tier, { text: string; border: string }> = {
  Gold: { text: "#f59e0b", border: "rgba(245,158,11,0.4)" },
  Silver: { text: "#9ca3af", border: "rgba(156,163,175,0.4)" },
  Bronze: { text: "#f97316", border: "rgba(249,115,22,0.4)" },
};

const sponsors = [
  { id: "1", name: "Wallem", logoUrl: WALLEM_LOGO, websiteUrl: "https://wallem.com", tier: "Bronze" as Tier },
];

export function Spotlight() {
  const groups = (["Gold", "Silver", "Bronze"] as Tier[])
    .map(t => ({ tier: t, list: sponsors.filter(s => s.tier === t) }))
    .filter(g => g.list.length > 0);

  return (
    <div
      className="min-h-screen p-10"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
    >
      <div className="max-w-3xl mx-auto space-y-16">
        {groups.map(({ tier, list }) => {
          const glow = TIER_GLOW[tier];
          const lbl = TIER_LABEL[tier];
          return (
            <div key={tier}>
              {/* Tier label — understated metallic */}
              <div className="flex items-center gap-4 mb-10">
                <div
                  className="h-px flex-1"
                  style={{ background: `rgba(${glow},0.3)` }}
                />
                <span
                  className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full border"
                  style={{ color: lbl.text, borderColor: lbl.border, background: `rgba(${glow},0.08)` }}
                >
                  {tier} Sponsors
                </span>
                <div
                  className="h-px flex-1"
                  style={{ background: `rgba(${glow},0.3)` }}
                />
              </div>

              {/* Sponsor cards */}
              <div className={`grid gap-8 ${list.length === 1 ? "grid-cols-1 max-w-sm mx-auto" : list.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {list.map(s => (
                  <a
                    key={s.id}
                    href={s.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group relative"
                  >
                    {/* Glow halo */}
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ boxShadow: `0 0 60px 10px rgba(${glow},0.25)` }}
                    />
                    {/* Card */}
                    <div
                      className="relative rounded-2xl flex flex-col items-center justify-center py-10 px-8 gap-5 overflow-hidden"
                      style={{
                        background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
                        border: `1px solid rgba(${glow},0.2)`,
                        boxShadow: `0 0 30px rgba(${glow},0.1), inset 0 1px 0 rgba(255,255,255,0.06)`,
                      }}
                    >
                      {/* Subtle radial glow behind logo */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(ellipse at 50% 50%, rgba(${glow},0.12) 0%, transparent 70%)`,
                        }}
                      />
                      <div className="relative z-10">
                        <SponsorLogo logoUrl={s.logoUrl} name={s.name} large />
                      </div>
                      <div className="relative z-10 text-center">
                        <p className="text-white/40 text-xs tracking-widest uppercase">{s.websiteUrl?.replace(/^https?:\/\//, "")}</p>
                      </div>
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
