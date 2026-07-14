// Shared team color theming used by fixture cards across the public site and player portal.
const TEAM_THEME = {
  MO40: { gradient: "from-[#DE2910] to-[#B8210C]", ring: "ring-[#DE2910]/20", chip: "bg-[#DE2910]" },
  MO50: { gradient: "from-[#1E3A6E] to-[#2E5490]", ring: "ring-[#1E3A6E]/20", chip: "bg-[#1E3A6E]" },
};

const DEFAULT_THEME = TEAM_THEME.MO40;

export function themeFor(category) {
  return TEAM_THEME[category] || DEFAULT_THEME;
}
