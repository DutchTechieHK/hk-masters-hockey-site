const WALLEM_LOGO = "https://res.cloudinary.com/djyvdrhal/image/upload/f_auto/Wallem-Wordmark-Light_1_.jpg";

const sponsors = [
  { id: "1", name: "Wallem", logoUrl: WALLEM_LOGO, websiteUrl: "https://wallem.com", tier: "Bronze" as const },
];

type Tier = "Gold" | "Silver" | "Bronze";

const TIER_PILL: Record<Tier, string> = {
  Gold: "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white",
  Silver: "bg-gradient-to-r from-gray-300 to-gray-400 text-white",
  Bronze: "bg-gradient-to-r from-orange-400 to-orange-500 text-white",
};

const TIER_BG: Record<Tier, string> = {
  Gold: "bg-yellow-50 border-yellow-200",
  Silver: "bg-gray-50 border-gray-200",
  Bronze: "bg-orange-50 border-orange-200",
};

function SponsorBanner({ name, logoUrl, websiteUrl, tier }: {
  name: string; logoUrl?: string; websiteUrl?: string; tier: Tier;
}) {
  const inner = (
    <div className={`flex items-center gap-8 bg-white border ${TIER_BG[tier]} rounded-xl px-8 py-6 shadow-sm hover:shadow-md transition-shadow duration-200`}>
      <div className="flex-1 flex items-center justify-center py-2">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="max-h-20 max-w-[280px] object-contain" />
        ) : (
          <span className="text-gray-600 font-bold text-lg">{name}</span>
        )}
      </div>
      <div className="hidden sm:block w-px h-12 bg-gray-200" />
      <div className="hidden sm:flex flex-col items-end gap-1 min-w-[140px]">
        <p className="text-gray-800 font-semibold text-sm">{name}</p>
        {websiteUrl && (
          <span className="text-xs text-gray-400">{websiteUrl.replace(/^https?:\/\//, "")}</span>
        )}
      </div>
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

export function Banner() {
  const tierGroups = [
    { name: "Gold" as Tier, sponsors: sponsors.filter(s => s.tier === "Gold") },
    { name: "Silver" as Tier, sponsors: sponsors.filter(s => s.tier === "Silver") },
    { name: "Bronze" as Tier, sponsors: sponsors.filter(s => s.tier === "Bronze") },
  ].filter(g => g.sponsors.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-12">
        {tierGroups.map(({ name, sponsors }) => (
          <div key={name}>
            <div className="flex items-center gap-3 mb-5">
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold ${TIER_PILL[name]}`}>
                {name} Sponsors
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-3">
              {sponsors.map(s => (
                <SponsorBanner key={s.id} name={s.name} logoUrl={s.logoUrl} websiteUrl={s.websiteUrl} tier={s.tier} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
