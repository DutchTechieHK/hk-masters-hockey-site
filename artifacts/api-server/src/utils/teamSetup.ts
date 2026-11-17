import {
  db, teamCategoriesTable, teamStaffTable, teamsTable, playersTable, membershipCategoriesTable,
} from "@workspace/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

/**
 * Team definition beyond its name:
 *  - the membership categories a team draws its squad from (team_categories)
 *  - the member who fills each staff role (team_staff), one person per role
 *
 * The text columns on teams (manager_name, coach_name, ...) stay in place and
 * are filled from the linked member, so older screens and the public site
 * keep working without knowing about the links.
 */

export const TEAM_ROLES = ["manager", "assistant_manager", "coach", "captain"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export type TeamStaffLinks = Record<TeamRole, number | null>;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Pick<typeof db, "select">;

// ---------------------------------------------------------------------------
// Storage safety net (same idea as utils/squads.ts): if the tables are
// missing, teams behave exactly as before (typed names, whole section eligible).
// ---------------------------------------------------------------------------
let storageReady = false;
let lastStorageCheck = 0;
const STORAGE_RECHECK_MS = 60_000;

export function teamSetupStorageReady(): boolean {
  return storageReady;
}

/** Idempotent. Mirrors lib/db/src/schema/team-setup.ts exactly. */
export async function ensureTeamSetupStorage(force = false): Promise<boolean> {
  if (storageReady) return true;
  const now = Date.now();
  if (!force && now - lastStorageCheck < STORAGE_RECHECK_MS) return false;
  lastStorageCheck = now;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS team_categories (
        id serial PRIMARY KEY,
        team_id integer NOT NULL,
        category_key text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT team_categories_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        CONSTRAINT team_categories_category_key_membership_categories_key_fk FOREIGN KEY (category_key) REFERENCES membership_categories(key)
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS team_categories_team_category_unique ON team_categories (team_id, category_key)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS team_staff (
        id serial PRIMARY KEY,
        team_id integer NOT NULL,
        role text NOT NULL,
        player_id integer NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT team_staff_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        CONSTRAINT team_staff_player_id_players_id_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS team_staff_team_role_unique ON team_staff (team_id, role)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS team_staff_player_idx ON team_staff (player_id)`);
  } catch (error) {
    console.error("[team-setup] could not create the team setup tables; continuing with typed staff names:", error);
  }
  try {
    const result = await db.execute(sql`
      SELECT to_regclass('public.team_categories') IS NOT NULL AND to_regclass('public.team_staff') IS NOT NULL AS present
    `);
    storageReady = (result.rows[0] as { present?: boolean } | undefined)?.present === true;
  } catch (error) {
    console.error("[team-setup] could not check for the team setup tables:", error);
    storageReady = false;
  }
  if (!storageReady) console.error("[team-setup] team setup tables unavailable: typed staff names and whole-section squads until they exist");
  return storageReady;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------
const noLinks = (): TeamStaffLinks => ({ manager: null, assistant_manager: null, coach: null, captain: null });

/** Categories each team draws from. Teams without rows are absent from the map. */
export async function teamCategoryKeys(teamIds: number[], reader: Reader = db): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (!storageReady || teamIds.length === 0) return result;
  const rows = await reader.select({ teamId: teamCategoriesTable.teamId, key: teamCategoriesTable.categoryKey })
    .from(teamCategoriesTable).where(inArray(teamCategoriesTable.teamId, teamIds)).orderBy(asc(teamCategoriesTable.id));
  for (const row of rows) result.set(row.teamId, [...(result.get(row.teamId) ?? []), row.key]);
  return result;
}

/** The linked member per role, per team. */
export async function teamStaffLinks(teamIds: number[], reader: Reader = db): Promise<Map<number, TeamStaffLinks>> {
  const result = new Map<number, TeamStaffLinks>();
  if (!storageReady || teamIds.length === 0) return result;
  const rows = await reader.select({ teamId: teamStaffTable.teamId, role: teamStaffTable.role, playerId: teamStaffTable.playerId })
    .from(teamStaffTable).where(inArray(teamStaffTable.teamId, teamIds));
  for (const row of rows) {
    if (!(TEAM_ROLES as readonly string[]).includes(row.role)) continue;
    const links = result.get(row.teamId) ?? noLinks();
    links[row.role as TeamRole] = row.playerId;
    result.set(row.teamId, links);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------
export class TeamSetupError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/** Replace the list of categories a team draws from. Statuses (Awaiting Selection, Trials) are not categories. */
export async function setTeamCategories(tx: Transaction, teamId: number, keys: readonly string[]) {
  if (!storageReady) return;
  const wanted = [...new Set(keys)];
  if (wanted.length) {
    const known = await tx.select({ key: membershipCategoriesTable.key, protected: membershipCategoriesTable.protected })
      .from(membershipCategoriesTable).where(inArray(membershipCategoriesTable.key, wanted));
    if (known.length !== wanted.length || known.some((row) => row.protected))
      throw new TeamSetupError(400, "Choose membership categories from the list. Awaiting Selection and Trials cannot be chosen for a team.");
  }
  await tx.delete(teamCategoriesTable).where(and(
    eq(teamCategoriesTable.teamId, teamId),
    wanted.length ? sql`${teamCategoriesTable.categoryKey} NOT IN (${sql.join(wanted.map((key) => sql`${key}`), sql`, `)})` : undefined,
  ));
  if (wanted.length) {
    await tx.insert(teamCategoriesTable).values(wanted.map((categoryKey) => ({ teamId, categoryKey }))).onConflictDoNothing();
  }
}

/** The text columns on teams that mirror each role's linked member. */
function textColumnsFor(role: TeamRole, member: { name: string; email: string; phone: string | null } | null) {
  switch (role) {
    case "manager":
      return { managerName: member?.name ?? "", managerEmail: member?.email ?? "", managerPhone: member?.phone ?? "" };
    case "assistant_manager":
      return { assistantManagerName: member?.name ?? null, assistantManagerContact: member ? member.phone || member.email || null : null };
    case "coach":
      return { coachName: member?.name ?? null };
    case "captain":
      return { captainName: member?.name ?? null };
  }
}

/**
 * Link (playerId) or unlink (null) the member for the given roles. Roles not
 * mentioned are left alone. The team's text columns follow: filled from the
 * member when linked, cleared when a link is removed.
 */
export async function setTeamStaff(tx: Transaction, teamId: number, changes: Partial<TeamStaffLinks>) {
  if (!storageReady) return;
  for (const role of TEAM_ROLES) {
    const playerId = changes[role];
    if (playerId === undefined) continue;
    const [existing] = await tx.select().from(teamStaffTable)
      .where(and(eq(teamStaffTable.teamId, teamId), eq(teamStaffTable.role, role)));
    if (playerId === null) {
      // Only a removed link clears the text; a typed name that was never linked stays.
      if (!existing) continue;
      await tx.delete(teamStaffTable).where(eq(teamStaffTable.id, existing.id));
      await tx.update(teamsTable).set(textColumnsFor(role, null)).where(eq(teamsTable.id, teamId));
      continue;
    }
    const [member] = await tx.select({
      id: playersTable.id, name: playersTable.name, email: playersTable.email, phone: playersTable.phone, memberStatus: playersTable.memberStatus,
    }).from(playersTable).where(eq(playersTable.id, playerId));
    if (!member || member.memberStatus === "archived") throw new TeamSetupError(400, "Choose a current member for this role.");
    if (existing) await tx.update(teamStaffTable).set({ playerId }).where(eq(teamStaffTable.id, existing.id));
    else await tx.insert(teamStaffTable).values({ teamId, role, playerId });
    await tx.update(teamsTable).set(textColumnsFor(role, member)).where(eq(teamsTable.id, teamId));
  }
}

/** After a member's name, email or phone changed: refresh the teams where they hold a role. */
export async function refreshTeamStaffText(executor: Pick<typeof db, "select" | "update">, playerId: number) {
  if (!storageReady) return;
  const roles = await executor.select({ teamId: teamStaffTable.teamId, role: teamStaffTable.role })
    .from(teamStaffTable).where(eq(teamStaffTable.playerId, playerId));
  if (roles.length === 0) return;
  const [member] = await executor.select({ name: playersTable.name, email: playersTable.email, phone: playersTable.phone })
    .from(playersTable).where(eq(playersTable.id, playerId));
  if (!member) return;
  for (const row of roles) {
    if (!(TEAM_ROLES as readonly string[]).includes(row.role)) continue;
    await executor.update(teamsTable).set(textColumnsFor(row.role as TeamRole, member)).where(eq(teamsTable.id, row.teamId));
  }
}

/**
 * One-time help, run at start-up: a staff name that was typed in before and
 * matches exactly one current member is linked to that member. Names that
 * match nobody, or more than one member, stay as typed text. Never overwrites
 * an existing link and never changes the typed text.
 */
export async function autoLinkTypedStaffNames(): Promise<number> {
  if (!storageReady) return 0;
  const linked = await db.execute(sql`
    WITH typed AS (
      SELECT id AS team_id, 'manager' AS role, manager_name AS typed_name FROM ${teamsTable} WHERE NOT is_internal
      UNION ALL SELECT id, 'assistant_manager', assistant_manager_name FROM ${teamsTable} WHERE NOT is_internal
      UNION ALL SELECT id, 'coach', coach_name FROM ${teamsTable} WHERE NOT is_internal
      UNION ALL SELECT id, 'captain', captain_name FROM ${teamsTable} WHERE NOT is_internal
    ), matched AS (
      SELECT typed.team_id, typed.role, min(member.id) AS player_id
      FROM typed
      JOIN ${playersTable} member
        ON lower(regexp_replace(trim(member.name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(typed.typed_name), '\\s+', ' ', 'g'))
       AND member.member_status <> 'archived'
      WHERE typed.typed_name IS NOT NULL AND trim(typed.typed_name) <> ''
      GROUP BY typed.team_id, typed.role
      HAVING count(*) = 1
    )
    INSERT INTO ${teamStaffTable} (team_id, role, player_id)
    SELECT team_id, role, player_id FROM matched
    ON CONFLICT DO NOTHING
  `);
  const count = (linked as { rowCount?: number | null }).rowCount ?? 0;
  if (count > 0) console.log(`[team-setup] linked ${count} typed staff name(s) to their member record`);
  return count;
}
