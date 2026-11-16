import { describe, expect, it } from "vitest";
import { matchesForPlayer } from "./playerMatches";

const matches = [{ id: 1, teamId: 5 }, { id: 2, teamId: 4 }];

describe("player portal match audience", () => {
  it("shows current-squad matches instead of historical-team matches", () => {
    expect(matchesForPlayer(matches, { teamId: 4, currentSquadTeamId: 5 })).toEqual([matches[0]]);
  });

  it("falls back to the legacy team when no active squad is assigned", () => {
    expect(matchesForPlayer(matches, { teamId: 4, currentSquadTeamId: null })).toEqual([matches[1]]);
  });

  it("shows the fixtures of every squad the member is in", () => {
    const three = [...matches, { id: 3, teamId: 9 }];
    expect(matchesForPlayer(three, { teamId: 4, currentSquadTeamId: 5, currentSquadTeamIds: [5, 9] }))
      .toEqual([three[0], three[2]]);
  });

  it("ignores an empty squad list and falls back as before", () => {
    expect(matchesForPlayer(matches, { teamId: 4, currentSquadTeamId: null, currentSquadTeamIds: [] })).toEqual([matches[1]]);
  });

  it("shows available fixtures to a player with no team", () => {
    expect(matchesForPlayer(matches, { teamId: null, currentSquadTeamId: null })).toEqual(matches);
  });
});