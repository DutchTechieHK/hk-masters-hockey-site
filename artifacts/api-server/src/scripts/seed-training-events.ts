import { db, eventsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const TRAINING_EVENTS = [
  { title: "Pitch Training",     startsAt: "2026-06-22T19:00:00+08:00", endsAt: "2026-06-22T21:00:00+08:00" },
  { title: "Pitch Training",     startsAt: "2026-06-26T19:00:00+08:00", endsAt: "2026-06-26T22:00:00+08:00" },
  { title: "Pitch Training",     startsAt: "2026-06-27T08:30:00+08:00", endsAt: "2026-06-27T10:30:00+08:00" },
  { title: "Pitch Training",     startsAt: "2026-06-29T19:00:00+08:00", endsAt: "2026-06-29T21:00:00+08:00" },
  { title: "Pitch Training",     startsAt: "2026-07-03T19:00:00+08:00", endsAt: "2026-07-03T22:00:00+08:00" },
  { title: "Pitch Training",     startsAt: "2026-07-04T08:30:00+08:00", endsAt: "2026-07-04T10:30:00+08:00" },
  { title: "Pitch Training",     startsAt: "2026-07-06T19:00:00+08:00", endsAt: "2026-07-06T21:00:00+08:00" },
  { title: "Pitch Training",     startsAt: "2026-07-10T19:00:00+08:00", endsAt: "2026-07-10T22:00:00+08:00" },
  { title: "1/2 Pitch Training", startsAt: "2026-07-11T08:30:00+08:00", endsAt: "2026-07-11T10:30:00+08:00" },
  { title: "1/2 Pitch Training", startsAt: "2026-07-13T19:00:00+08:00", endsAt: "2026-07-13T21:00:00+08:00" },
  { title: "1/2 Pitch Training", startsAt: "2026-07-17T19:00:00+08:00", endsAt: "2026-07-17T22:00:00+08:00" },
];

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const ev of TRAINING_EVENTS) {
    const startsAt = new Date(ev.startsAt);
    const endsAt = new Date(ev.endsAt);

    const existing = await db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(and(eq(eventsTable.title, ev.title), eq(eventsTable.startsAt, startsAt)))
      .limit(1);

    if (existing.length > 0) {
      console.log(`SKIP  ${ev.title} @ ${ev.startsAt} (id=${existing[0].id})`);
      skipped++;
      continue;
    }

    const [row] = await db.insert(eventsTable).values({
      kind: "training",
      title: ev.title,
      startsAt,
      endsAt,
      location: "HKFC",
      description: null,
      teamId: null,
      isPublic: false,
    }).returning({ id: eventsTable.id });

    console.log(`OK    ${ev.title} @ ${ev.startsAt} → id=${row.id}`);
    inserted++;
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
