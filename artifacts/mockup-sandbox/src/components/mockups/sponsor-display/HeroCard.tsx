const WALLEM_LOGO = "https://res.cloudinary.com/djyvdrhal/image/upload/f_auto/Wallem-Wordmark-Light_1_.jpg";

const sponsors = [
  { id: "1", name: "Wallem", logoUrl: WALLEM_LOGO, websiteUrl: "https://wallem.com", tier: "Bronze" as const },
];

type Tier = "Gold" | "Silver" | "Bronze";

const TIER_CONFIG: Record<Tier, { pill: string; gradient: string; labelColor: string }> = {
  Gold: {
    pill: "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white",
    gradient: "from-yellow-50 to-white",
    labelColor: "text-yellow-600",
  },
  Silver: {
    pill: "bg-gradient-to-r from-gray-300 to-gray-400 text-white",
    gradient: "from-gray-50 to-white",
    labelColor: "text-gray-500",
  },
  Bronze: {
    pill: "bg-gradient-to-r from-orange-400 to-orange-500 text-white",
    gradient: "from-orange-50 to-white",
    labelColor: "text-orange-600",
  },
};

function SponsorHeroCard({ name, logoUrl, websiteUrl, tier }: {
  name: string; logoUrl?: string; websiteUrl?: string; tier: Tier;
}) {
  const cfg = TIER_CONFIG[tier];
  const inner = (
    <div
      className={`relative bg-gradient-to-br ${cfg.gradient} rounded-2xl border border-gray-100 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 overflow-hidden`}
    >
      {/* Subtle corner accent */}
      <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${cfg.pill.replace("text-white","")}`} />
      <div className="pl-6 pr-8 py-8 flex items-center justify-center min-h-[180px]">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            className="max-h-24 max-w-xs object-contain drop-shadow-sm"
          />
        ) : (
          <div className="text-center">
            <p className={`${cfg.labelColor} font-bold text-2xl`}>{name}</p>
            <p className="text-gray-400 text-xs mt-1">Logo coming soon</p>
          </div>
        )}
      </div>
      {websiteUrl && (
        <div className="border-t border-gray-100 px-8 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">{websiteUrl.replace(/^https?:\/\//, "")}</span>
          <span className="text-xs text-gray-400">→</span>
        </div>
      )}
    </div>
  );

  if (websiteUrl) {
    return (
      <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }
  return inner;
}

export function HeroCard() {
  const tierGroups = [
    { name: "Gold" as Tier, sponsors: sponsors.filter(s => s.tier === "Gold"), cols: "grid-cols-1 sm:grid-cols-2" },
    { name: "Silver" as Tier, sponsors: sponsors.filter(s => s.tier === "Silver"), cols: "grid-cols-2 sm:grid-cols-3" },
    { name: "Bronze" as Tier, sponsors: sponsors.filter(s => s.tier === "Bronze"), cols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" },
  ].filter(g => g.sponsors.length > 0);

  return (
    <div className="min-h-screen bg-white p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-14">
        {tierGroups.map(({ name, sponsors, cols }) => (
          <div key={name}>
            <div className="flex items-center gap-3 mb-6">
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold ${TIER_CONFIG[name].pill}`}>
                {name} Sponsors
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className={`grid gap-5 ${sponsors.length === 1 ? "max-w-sm" : cols}`}>
              {sponsors.map(s => (
                <SponsorHeroCard key={s.id} name={s.name} logoUrl={s.logoUrl} websiteUrl={s.websiteUrl} tier={s.tier} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
