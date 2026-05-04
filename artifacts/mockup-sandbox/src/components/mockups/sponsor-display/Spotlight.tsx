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

const TIER_ACCENT: Record<Tier, string> = {
  Gold: "border-yellow-300 shadow-yellow-100",
  Silver: "border-gray-200 shadow-gray-100",
  Bronze: "border-orange-200 shadow-orange-50",
};

function SponsorSpotlight({ name, logoUrl, websiteUrl, tier }: {
  name: string; logoUrl?: string; websiteUrl?: string; tier: Tier;
}) {
  const card = (
    <div className={`bg-white rounded-2xl border-2 ${TIER_ACCENT[tier]} shadow-xl p-10 flex flex-col items-center justify-center gap-4 min-h-[220px] hover:shadow-2xl transition-shadow duration-200`}>
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="max-h-28 max-w-[320px] object-contain" />
      ) : (
        <div className="text-center">
          <p className="text-gray-700 font-bold text-xl">{name}</p>
          <p className="text-gray-400 text-xs mt-1">Logo coming soon</p>
        </div>
      )}
      {websiteUrl && (
        <span className="text-xs text-gray-400 mt-1">{websiteUrl.replace(/^https?:\/\//, "")}</span>
      )}
    </div>
  );

  if (websiteUrl) {
    return (
      <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="block">
        {card}
      </a>
    );
  }
  return card;
}

export function Spotlight() {
  const tierGroups = [
    { name: "Bronze" as Tier, sponsors: sponsors.filter(s => s.tier === "Bronze") },
    { name: "Silver" as Tier, sponsors: sponsors.filter(s => s.tier === "Silver") },
    { name: "Gold" as Tier, sponsors: sponsors.filter(s => s.tier === "Gold") },
  ].filter(g => g.sponsors.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-14">
        {tierGroups.map(({ name, sponsors }) => (
          <div key={name}>
            <div className="flex items-center gap-3 mb-6">
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold ${TIER_PILL[name]}`}>
                {name} Sponsors
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className={`grid gap-6 ${
              sponsors.length === 1 ? "grid-cols-1 max-w-md mx-auto" :
              sponsors.length === 2 ? "grid-cols-2" :
              "grid-cols-3"
            }`}>
              {sponsors.map(s => (
                <SponsorSpotlight key={s.id} name={s.name} logoUrl={s.logoUrl} websiteUrl={s.websiteUrl} tier={s.tier} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
