// The portal's legacy teamId may refer to a historical team, not this season's squad.
export function matchesForPlayer(matches, player) {
  const teamId = player.currentSquadTeamId ?? player.teamId;
  return teamId == null ? matches : matches.filter((match) => match.teamId === teamId);
}