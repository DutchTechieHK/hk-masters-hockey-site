import content from "../content/events.json";

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
      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{event.description}</p>
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
              {content.upcoming_events.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.upcoming_events.map((event) => (
              <EventCard key={event.name} event={event} type="upcoming" />
            ))}
          </div>
        </section>

        {/* Past Events */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Past Events</h2>
          {content.past_events.length === 0 ? (
            <p className="text-gray-400 text-sm">No past events yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.past_events.map((event) => (
                <EventCard key={event.name} event={event} type="past" />
              ))}
            </div>
          )}
        </section>

        {/* Tournament Archive */}
        {content.tournament_archive.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Tournament Archive</h2>
            <div className="space-y-4">
              {content.tournament_archive.map((tournament) => (
                <div
                  key={tournament.name}
                  className="bg-[#006B3C]/5 border border-[#006B3C]/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center"
                >
                  <div className="w-14 h-14 bg-[#006B3C] rounded-xl flex items-center justify-center shrink-0 text-white">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      <span className="bg-[#DE2910] text-white text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                        {tournament.date}
                      </span>
                      <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {tournament.location}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-gray-900 mb-2">{tournament.name}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4 whitespace-pre-line">{tournament.description}</p>
                    {tournament.notion_url && (
                      <a
                        href={tournament.notion_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#006B3C] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-green-800 transition-colors duration-150 text-sm"
                      >
                        View Full Tournament Site
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
