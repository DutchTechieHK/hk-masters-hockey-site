// Variant B – Editorial Split
import React from "react";
// Crisp full-width card: HK green panel on left with tier/headline, white panel on right with large logo

const WALLEM_LOGO = "/api/site-content/image/objects/uploads/2cd28042-c81d-476e-9117-168e528578bb";

function WallemPlaceholder({ large = false }: { large?: boolean }) {
  return (
    <div
      style={{
        background: "#1b2f5e",
        padding: large ? "20px 44px" : "12px 24px",
        borderRadius: 6,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ color: "#fff", fontWeight: 700, letterSpacing: "0.2em", fontSize: large ? 30 : 18, textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif" }}>
        WALLEM
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 2, width: large ? 30 : 18, background: "#c0392b", borderRadius: 1 }} />
        ))}
      </div>
      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, letterSpacing: "0.15em", marginTop: 4 }}>
        EST. 1903
      </div>
    </div>
  );
}

type Tier = "Gold" | "Silver" | "Bronze";

const TIER_ACCENT: Record<Tier, { bg: string; pill: string }> = {
  Gold: { bg: "#92400e", pill: "from-yellow-400 to-amber-500" },
  Silver: { bg: "#374151", pill: "from-slate-400 to-slate-500" },
  Bronze: { bg: "#006B3C", pill: "from-green-700 to-green-800" },
};

function LogoPanel({ logoUrl, name }: { logoUrl?: string; name: string }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className="flex-1 bg-white flex items-center justify-center px-12 py-8">
      {logoUrl && !failed ? (
        <img
          src={logoUrl}
          alt={name}
          className="max-h-24 max-w-[300px] object-contain group-hover:scale-105 transition-transform duration-300"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="group-hover:scale-105 transition-transform duration-300">
          <WallemPlaceholder large />
        </div>
      )}
    </div>
  );
}

const sponsors = [
  { id: "1", name: "Wallem", logoUrl: WALLEM_LOGO, websiteUrl: "https://wallem.com", tier: "Bronze" as Tier },
];

export function Banner() {
  const groups = (["Gold", "Silver", "Bronze"] as Tier[])
    .map(t => ({ tier: t, list: sponsors.filter(s => s.tier === t) }))
    .filter(g => g.list.length > 0);

  return (
    <div className="min-h-screen bg-gray-100 p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {groups.map(({ tier, list }) => {
          const acc = TIER_ACCENT[tier];
          return (
            <div key={tier} className="space-y-4">
              <div className="space-y-3">
                {list.map(s => (
                  <a
                    key={s.id}
                    href={s.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 block group"
                    style={{ minHeight: 200 }}
                  >
                    {/* LEFT: dark brand panel */}
                    <div
                      className="flex flex-col items-start justify-between p-8 shrink-0"
                      style={{ background: acc.bg, width: 220 }}
                    >
                      <div>
                        <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-2">
                          Proud Supporter
                        </p>
                        <p className="text-white font-extrabold text-2xl leading-tight">
                          {tier}<br />Sponsor
                        </p>
                      </div>
                      <div>
                        <div className="w-8 h-0.5 bg-white/30 mb-1" />
                        <p className="text-white/40 text-xs tracking-wide">
                          {s.websiteUrl?.replace(/^https?:\/\//, "")}
                        </p>
                      </div>
                    </div>

                    {/* RIGHT: white logo panel */}
                    <LogoPanel logoUrl={s.logoUrl} name={s.name} />
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
