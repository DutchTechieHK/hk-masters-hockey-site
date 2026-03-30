// Upcoming events — managed via CMS (src/content/events folder)
// These are placeholder entries until CMS content is added

const upcomingEvents = [
  {
    id: 1,
    name: "Pre-Season Training Camp",
    date: "April 5–6, 2026",
    location: "HKFC Hockey Pitch, Happy Valley",
    description:
      "Two-day intensive training camp open to all squads. Focus on fitness, team structures, and Rotterdam preparation. Attendance strongly encouraged for Rotterdam-bound players.",
  },
  {
    id: 2,
    name: "Friendly vs Singapore Masters",
    date: "April 18, 2026",
    location: "Siu Sai Wan Sports Ground, HK",
    description:
      "International friendly match against Singapore Masters. All four squads in action over a full day of competitive hockey.",
  },
  {
    id: 3,
    name: "Annual Club Dinner",
    date: "May 2, 2026",
    location: "The Harbourview Hotel, Hong Kong",
    description:
      "Our annual club dinner and awards night. Celebrating the season's achievements and bidding farewell to the Rotterdam-bound squads.",
  },
  {
    id: 4,
    name: "Rotterdam 2026 World Masters Cup",
    date: "May 23 – June 6, 2026",
    location: "Rotterdam, Netherlands",
    description:
      "The premier masters field hockey tournament in the world. HK Masters sends four squads to compete against nations from across the globe.",
  },
];

const pastEvents = [
  {
    id: 5,
    name: "Asia Pacific Masters Championship",
    date: "October 12–16, 2025",
    location: "Kuala Lumpur, Malaysia",
    result: "M35: Semi-finalists | M45: Champions | W35: Group stage",
    description:
      "Outstanding performance from our M45 squad who claimed gold, while M35 reached the semi-finals. A memorable tournament for the club.",
  },
  {
    id: 6,
    name: "HK Club Championship",
    date: "September 6–7, 2025",
    location: "Siu Sai Wan Sports Ground, HK",
    result: "M35: Runners-up | M45: Winners",
    description:
      "The annual Hong Kong Club Championship brought all local masters clubs together for a weekend of great hockey.",
  },
];

// November 2025 HK tournament — full site available via Notion
const hkTournament2025 = {
  name: "HK Masters Hockey Tournament 2025",
  date: "November 2025",
  location: "Hong Kong",
  description:
    "Our home tournament — a full international masters hockey event hosted in Hong Kong. Featuring match schedules, visitor information, results, and more.",
  notionUrl: "NOTION_URL_HERE", // Replace with your real Notion public link
};

function EventCard({ event, type }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow duration-150">
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
          type === "upcoming"
            ? "bg-green-100 text-[#006B3C]"
            : "bg-gray-100 text-gray-500"
        }`}>
          {event.date}
        </span>
        {event.result && (
          <span className="text-xs bg-[#DE2910]/10 text-[#DE2910] font-semibold px-2.5 py-0.5 rounded-full">
            Results: {event.result}
          </span>
        )}
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-1">{event.name}</h3>
      <p className="text-sm text-gray-500 flex items-center gap-1 mb-3">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {event.location}
      </p>
      <p className="text-sm text-gray-600 leading-relaxed">{event.description}</p>
    </div>
  );
}

export default function Events() {
  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold mb-3">Events</h1>
          <p className="text-green-200 text-lg max-w-xl">
            Upcoming fixtures, tournaments, social events, and past results.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Upcoming Events */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
            <span className="bg-[#006B3C] text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {upcomingEvents.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} type="upcoming" />
            ))}
          </div>
        </section>

        {/* Past Events */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Past Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pastEvents.map((event) => (
              <EventCard key={event.id} event={event} type="past" />
            ))}
          </div>
        </section>

        {/* Past Tournaments — Featured Archive */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Tournament Archive</h2>
          <div className="bg-[#006B3C]/5 border border-[#006B3C]/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Icon */}
            <div className="w-14 h-14 bg-[#006B3C] rounded-xl flex items-center justify-center shrink-0 text-white">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span className="bg-[#DE2910] text-white text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                  {hkTournament2025.date}
                </span>
                <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {hkTournament2025.location}
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">{hkTournament2025.name}</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                {hkTournament2025.description}
              </p>
              <a
                href={hkTournament2025.notionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#006B3C] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-green-800 transition-colors duration-150 text-sm"
              >
                View Full Tournament Site
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
