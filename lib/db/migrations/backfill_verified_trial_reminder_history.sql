-- Backfill the two RSVP reminder batches sent before reminder history logging
-- was deployed. Only verified production player IDs are stored here; names and
-- email addresses are resolved inside the protected database when the migration
-- runs. This migration only writes audit history; it does not call email code.

BEGIN;

DO $$
DECLARE
  batch RECORD;
  target_blast_id INTEGER;
BEGIN
  FOR batch IN
    SELECT *
    FROM (
      VALUES
        (
          90,
          'Men''s D1 League Team Trial 1',
          'Friday, 18 September 2026',
          TIMESTAMP '2026-09-18 02:09:00',
          13,
          '[31,14,30,43,53,84,87,22,11,83,65,90,15]'
        ),
        (
          91,
          'Men''s D1 League Team Trial 2',
          'Friday, 25 September 2026',
          TIMESTAMP '2026-09-18 02:17:00',
          14,
          '[31,14,30,43,53,84,87,2,22,11,83,65,90,15]'
        )
    ) AS batches(event_id, event_title, event_date, sent_at, expected_count, player_ids)
  LOOP
    SELECT eb.id
      INTO target_blast_id
      FROM email_blasts eb
     WHERE eb.subject = 'Quick reply needed: ' || batch.event_title
       AND eb.audience_type = 'event-rsvp-reminder'
       AND eb.operational_scope = 'local_2026_27'
       AND eb.sent_at = batch.sent_at
     ORDER BY eb.id
     LIMIT 1;

    IF target_blast_id IS NULL THEN
      INSERT INTO email_blasts (
        subject,
        body,
        audience_type,
        team_ids,
        player_ids,
        recipient_count,
        sent_count,
        failed_count,
        sent_by_email,
        sent_at,
        operational_scope
      )
      VALUES (
        'Quick reply needed: ' || batch.event_title,
        'Event RSVP reminder' || E'\n\n'
          || 'Event: ' || batch.event_title || E'\n'
          || 'Date: ' || batch.event_date || E'\n'
          || 'Time: 20:00 HKT' || E'\n'
          || 'Location: HKFC' || E'\n'
          || E'\n'
          || batch.expected_count || ' sent, 0 failed, 0 skipped because no email was on file.',
        'event-rsvp-reminder',
        '[5]',
        batch.player_ids,
        batch.expected_count,
        batch.expected_count,
        0,
        NULL,
        batch.sent_at,
        'local_2026_27'
      )
      RETURNING id INTO target_blast_id;
    END IF;

    INSERT INTO email_blast_recipients (
      blast_id,
      player_id,
      player_name,
      player_email,
      sent,
      error_message
    )
    SELECT
      target_blast_id,
      recipient.player_id,
      snapshot_player.name,
      snapshot_player.email,
      TRUE,
      NULL
    FROM (
      VALUES
        (90, 31), (90, 14), (90, 30), (90, 43), (90, 53),
        (90, 84), (90, 87), (90, 22), (90, 11), (90, 83),
        (90, 65), (90, 90), (90, 15),
        (91, 31), (91, 14), (91, 30), (91, 43), (91, 53),
        (91, 84), (91, 87), (91, 2), (91, 22), (91, 11),
        (91, 83), (91, 65), (91, 90), (91, 15)
    ) AS recipient(event_id, player_id)
    JOIN players snapshot_player
      ON snapshot_player.id = recipient.player_id
    WHERE recipient.event_id = batch.event_id
      AND snapshot_player.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM email_blast_recipients existing
        WHERE existing.blast_id = target_blast_id
          AND existing.player_id = recipient.player_id
      );
  END LOOP;
END $$;

COMMIT;