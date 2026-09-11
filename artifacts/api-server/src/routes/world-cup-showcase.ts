import { Router, type IRouter } from "express";
import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  eventsTable,
  matchesTable,
  teamsTable,
  worldCupPlayerSnapshotsTable,
  worldCupTeamSnapshotsTable,
} from "@workspace/db";
import { GetWorldCup2026ShowcaseResponse } from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";

type Snapshot = Record<string, unknown>;

const router: IRouter = Router();

function asSnapshot(value: unknown): Snapshot {
  return value != null && typeof value === "object"
    ? (value as Snapshot)
    : {};
}

function text(snapshot: Snapshot, key: string): string {
  const value = snapshot[key];
  return typeof value === "string" ? value.trim() : "";
}

function money(snapshot: Snapshot, key: string): number {
  const value = Number(snapshot[key]);
  return Number.isFinite(value) ? value : 0;
}

function historicTeamLabel(name: string | undefined, teamId: number): string {
  if (!name || name === "Awaiting Selection") {
    return `Archived squad ${teamId}`;
  }
  return name;
}

router.get(
  "/world-cup-2026",
  requireAdminAccess,
  async (_req, res): Promise<void> => {
  const [playerRows, teamSnapshotRows, eventRows, matchRows] = await Promise.all([
    db
      .select({ snapshot: worldCupPlayerSnapshotsTable.snapshot })
      .from(worldCupPlayerSnapshotsTable),
    db
      .select({
        teamId: worldCupTeamSnapshotsTable.teamId,
        snapshot: worldCupTeamSnapshotsTable.snapshot,
      })
      .from(worldCupTeamSnapshotsTable),
    db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.operationalScope, "world_cup_2026"))
      .orderBy(asc(eventsTable.startsAt)),
    db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.operationalScope, "world_cup_2026"))
      .orderBy(asc(matchesTable.kickoffAt)),
  ]);

  const snapshots = playerRows.map(({ snapshot }) => asSnapshot(snapshot));
  const teamCounts = new Map<number, number>();
  for (const snapshot of snapshots) {
    const teamId = Number(snapshot["team_id"]);
    if (Number.isInteger(teamId)) {
      teamCounts.set(teamId, (teamCounts.get(teamId) ?? 0) + 1);
    }
  }

  const teamIds = [...teamCounts.keys()];
  const currentTeamRows =
    teamIds.length === 0
      ? []
      : await db
          .select({
            id: teamsTable.id,
            name: teamsTable.name,
            category: teamsTable.category,
          })
          .from(teamsTable)
          .where(inArray(teamsTable.id, teamIds));
  const currentTeams = new Map(
    currentTeamRows.map((team) => [team.id, team]),
  );
  const archivedTeams = new Map(
    teamSnapshotRows.map(({ teamId, snapshot }) => [
      teamId,
      asSnapshot(snapshot),
    ]),
  );

  const feesDue = snapshots.reduce(
    (sum, snapshot) => sum + money(snapshot, "payment_amount_due"),
    0,
  );
  const feesPaid = snapshots.reduce(
    (sum, snapshot) => sum + money(snapshot, "payment_amount_paid"),
    0,
  );
  const paidPlayers = snapshots.filter((snapshot) => {
    const due = money(snapshot, "payment_amount_due");
    return due > 0 && money(snapshot, "payment_amount_paid") >= due;
  }).length;

  const teams = teamIds
    .sort((a, b) => a - b)
    .map((teamId) => {
      const archived = archivedTeams.get(teamId) ?? {};
      const current = currentTeams.get(teamId);
      const archivedName = text(archived, "name");
      const archivedCategory = text(archived, "category");
      const members = snapshots.filter(
        (snapshot) => Number(snapshot["team_id"]) === teamId,
      );
      return {
        id: teamId,
        name: historicTeamLabel(archivedName || current?.name, teamId),
        category:
          archivedCategory ||
          (current?.category === "Awaiting Selection"
            ? "Historical archive"
            : current?.category) ||
          "Historical archive",
        playerCount: teamCounts.get(teamId) ?? 0,
        paidPlayers: members.filter((snapshot) => {
          const due = money(snapshot, "payment_amount_due");
          return (
            due > 0 && money(snapshot, "payment_amount_paid") >= due
          );
        }).length,
      };
    });

  const schedule = [
    ...eventRows.map((event) => ({
      id: event.id,
      type: "event" as const,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      location: event.location ?? "",
      score: null,
    })),
    ...matchRows.map((match) => ({
      id: match.id,
      type: "fixture" as const,
      title: `HK Masters vs ${match.opponent}`,
      startsAt: match.kickoffAt.toISOString(),
      location: match.venue ?? "",
      score:
        match.ourScore == null || match.theirScore == null
          ? null
          : `${match.ourScore}-${match.theirScore}`,
    })),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const response = {
    historical: true,
    tournament: {
      name: "Masters Hockey World Cup 2026",
      location: "Rotterdam, Netherlands",
      seasonSlug: "rotterdam-2026",
    },
    overview: {
      playerCount: snapshots.length,
      teamCount: teams.length,
      completedFixtures: matchRows.filter(
        (match) =>
          match.status === "completed" ||
          (match.ourScore != null && match.theirScore != null),
      ).length,
      scheduledItems: schedule.length,
    },
    teams,
    schedule,
    travel: {
      arrivalConfirmed: snapshots.filter(
        (snapshot) =>
          text(snapshot, "flight_arrival_date_time") ||
          text(snapshot, "outbound_flight_number"),
      ).length,
      departureConfirmed: snapshots.filter(
        (snapshot) =>
          text(snapshot, "flight_departure_date_time") ||
          text(snapshot, "return_flight_number"),
      ).length,
      accommodationConfirmed: snapshots.filter((snapshot) =>
        Boolean(text(snapshot, "accommodation_name")),
      ).length,
      totalPlayers: snapshots.length,
    },
    fees: {
      due: feesDue,
      paid: feesPaid,
      outstanding: Math.max(0, feesDue - feesPaid),
      paidPlayers,
      totalPlayers: snapshots.length,
    },
    readiness: [
      {
        label: "Passport copy held",
        complete: snapshots.filter((snapshot) =>
          Boolean(text(snapshot, "passport_copy_url")),
        ).length,
        total: snapshots.length,
      },
      {
        label: "Insurance details held",
        complete: snapshots.filter((snapshot) =>
          Boolean(text(snapshot, "insurance_provider")),
        ).length,
        total: snapshots.length,
      },
      {
        label: "Travel details held",
        complete: snapshots.filter(
          (snapshot) =>
            text(snapshot, "flight_arrival_date_time") ||
            text(snapshot, "outbound_flight_number"),
        ).length,
        total: snapshots.length,
      },
      {
        label: "Playing kit size held",
        complete: snapshots.filter((snapshot) =>
          Boolean(text(snapshot, "shirt_size")),
        ).length,
        total: snapshots.length,
      },
    ],
  };

    res.json(GetWorldCup2026ShowcaseResponse.parse(response));
  },
);

export default router;