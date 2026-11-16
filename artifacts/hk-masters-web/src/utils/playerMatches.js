// The portal's legacy teamId may refer to a historical team, not this season's squad.
// A member can be in several squads in one season: show the fixtures of all of them.
export function matchesForPlayer(matches, player) {
  const squadTeamIds = Array.isArray(player.currentSquadTeamIds) ? player.currentSquadTeamIds : [];
  if (squadTeamIds.length > 0) return matches.filter((match) => squadTeamIds.includes(match.teamId));
  const teamId = player.currentSquadTeamId ?? player.teamId;
  return teamId == null ? matches : matches.filter((match) => match.teamId === teamId);
}
