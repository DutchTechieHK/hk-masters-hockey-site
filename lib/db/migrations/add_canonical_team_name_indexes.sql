-- Keep canonical membership/squad team names unique while preserving historical
-- player.team_id and archived participation references.
DO $$
DECLARE
  canonical_name text;
  keeper_id integer;
  duplicate_team record;
BEGIN
  FOREACH canonical_name IN ARRAY ARRAY['Awaiting Selection', 'Masters Div. 1']
  LOOP
    SELECT min(id) INTO keeper_id FROM teams WHERE name = canonical_name;
    IF keeper_id IS NULL THEN
      CONTINUE;
    END IF;

    FOR duplicate_team IN
      SELECT id FROM teams WHERE name = canonical_name AND id <> keeper_id ORDER BY id
    LOOP
      UPDATE player_participations AS participation
      SET team_id = keeper_id, updated_at = now()
      FROM seasons AS season
      WHERE participation.season_id = season.id
        AND season.slug = 'membership-2026-27'
        AND participation.team_id = duplicate_team.id;

      UPDATE teams
      SET name = canonical_name || ' (legacy duplicate ' || duplicate_team.id || ')',
          is_internal = true
      WHERE id = duplicate_team.id;
    END LOOP;
  END LOOP;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS teams_awaiting_selection_name_unique
  ON teams (name)
  WHERE name = 'Awaiting Selection';

CREATE UNIQUE INDEX IF NOT EXISTS teams_masters_division_one_name_unique
  ON teams (name)
  WHERE name = 'Masters Div. 1';