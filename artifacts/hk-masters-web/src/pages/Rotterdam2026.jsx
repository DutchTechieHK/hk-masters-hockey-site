import { Link } from "wouter";

// TODO: Update all key dates, travel info, and squad details with real information

const keyDates = [
  { date: "March 31, 2026", event: "Final squad registration deadline with World Hockey" },
  { date: "April 5–6, 2026", event: "Pre-season training camp, Hong Kong" },
  { date: "April 18, 2026", event: "Friendly vs Singapore Masters (home)" },
  { date: "May 1, 2026", event: "Kit and equipment collection" },
  { date: "May 20, 2026", event: "Departure flight from Hong Kong International Airport" },
  { date: "May 23, 2026", event: "Tournament opening ceremony, Rotterdam" },
  { date: "May 24 – June 5, 2026", event: "Pool matches and knockout stages" },
  { date: "June 6, 2026", event: "Finals day and closing ceremony" },
  { date: "June 7–8, 2026", event: "Return travel to Hong Kong" },
];

const squads = [
  {
    name: "Men's Over-35",
    category: "M35",
    players: 16, // TODO: Replace with actual squad size
    poolGroup: "Pool A", // TODO: Replace with actual pool group once draw is completed
    firstMatch: "May 24 vs Australia", // TODO: Replace with actual fixture
  },
  {
    name: "Men's Over-45",
    category: "M45",
    players: 16,
    poolGroup: "Pool B",
    firstMatch: "May 24 vs Germany",
  },
  {
    name: "Men's Over-55",
    category: "M55",
    players: 14,
    poolGroup: "Pool C",
    firstMatch: "May 25 vs Canada",
  },
  {
    name: "Women's Over-35",
    category: "W35",
    players: 16,
    poolGroup: "Pool A",
    firstMatch: "May 24 vs New Zealand",
  },
];

export default function Rotterdam2026() {
  // TODO: Update this URL if the team management app path changes
  const teamManagementUrl = "/";

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            May – June 2026
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">Rotterdam 2026</h1>
          <p className="text-green-200 text-lg max-w-2xl">
            World Masters Hockey Cup &mdash; Rotterdam, Netherlands
          </p>
        </div>
      </div>

      {/* Tournament Overview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">About the Tournament</h2>
            {/*
              TODO: Replace with your own tournament overview paragraph.
              Include the tournament format, number of nations, venue details, etc.
            */}
            <p className="text-gray-600 leading-relaxed mb-4">
              The World Masters Hockey Cup is the premier international field hockey tournament for
              masters-age players, held every four years and organised by World Hockey. Rotterdam 2026
              will see over 50 nations compete across seven age categories, from Over-35 to Over-70,
              at the world-class facilities of the Hockeyclub Rotterdam.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Hong Kong Masters Hockey is proud to be sending four squads &mdash; our largest-ever
              representation at a World Masters Cup. Years of preparation, fundraising, and training
              have gone into building squads that we believe can genuinely challenge for medals.
            </p>
            {/*
              TODO: Add any additional tournament context, venue address, spectator information, etc.
            */}
            <p className="text-gray-600 leading-relaxed">
              For full tournament details including draw results, match schedules, and live scoring,
              visit the official World Hockey website once the tournament begins.
            </p>
          </div>

          {/* Quick Facts */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="font-bold text-gray-900 mb-4">Quick Facts</h3>
            <dl className="space-y-3">
              {[
                { label: "Tournament", value: "World Masters Hockey Cup 2026" },
                { label: "Location", value: "Rotterdam, Netherlands" },
                { label: "Dates", value: "23 May – 6 June 2026" },
                { label: "HK Squads", value: "4 teams" },
                { label: "Organiser", value: "World Hockey" },
                // TODO: Add real venue name
                { label: "Venue", value: "Hockeyclub Rotterdam (TBC)" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* HK Squads */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Hong Kong Squads</h2>
          {/*
            TODO: Update each squad's pool group and first match once the tournament draw is complete.
            Player counts should also be updated when final selections are made.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {squads.map((squad) => (
              <div key={squad.category} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-[#DE2910] text-white text-xs font-bold px-2 py-0.5 rounded">
                    {squad.category}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-3">{squad.name}</h3>
                <dl className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Players</dt>
                    <dd className="font-medium text-gray-800">{squad.players}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Pool</dt>
                    <dd className="font-medium text-gray-800">{squad.poolGroup}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 text-sm mt-2">
                    <dt className="text-gray-500">First match</dt>
                    <dd className="font-medium text-gray-800">{squad.firstMatch}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Dates */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Key Dates</h2>
        {/* TODO: Update dates as plans are confirmed */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {keyDates.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="py-3 px-4 font-medium text-[#006B3C] whitespace-nowrap rounded-l-lg w-48">
                    {item.date}
                  </td>
                  <td className="py-3 px-4 text-gray-700 rounded-r-lg">{item.event}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Travel & Logistics */}
      <section className="bg-[#006B3C]/5 border-y border-[#006B3C]/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Travel &amp; Logistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/*
              TODO: Replace each section with actual travel, accommodation, and kit information
              once arrangements are confirmed.
            */}
            {[
              {
                icon: "✈️",
                title: "Flights",
                body: "Group flights from Hong Kong International Airport are being arranged via [Travel Agent Name]. Individual bookings must be approved by the team manager. Details to be confirmed by March 1, 2026.",
              },
              {
                icon: "🏨",
                title: "Accommodation",
                body: "The club has secured a block booking at [Hotel Name] in central Rotterdam. All squad members are expected to stay together. Room-sharing arrangements will be communicated by the team manager.",
              },
              {
                icon: "👕",
                title: "Kit & Equipment",
                body: "Official HK Masters playing kit will be provided to all registered players. Players are responsible for their own sticks, shin guards, and footwear. Kit collection event: May 1, 2026.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-6 shadow-sm border border-[#006B3C]/10">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Management App CTA — for registered team members */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-[#006B3C] rounded-2xl p-8 text-white text-center">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Team Members Only
          </span>
          <h2 className="text-2xl font-bold mb-3">Team Management Portal</h2>
          <p className="text-green-100 max-w-lg mx-auto mb-6 leading-relaxed">
            If you are a registered player travelling to Rotterdam, access the team management
            app for squad lists, schedules, fundraising updates, kit assignments, and logistics details.
          </p>
          {/*
            TODO: Update this href to point to the correct URL of the team management application.
            Currently pointing to the root path ("/") where the team management app is deployed.
          */}
          <a
            href={teamManagementUrl}
            className="inline-block bg-white text-[#006B3C] font-bold px-8 py-3 rounded-lg hover:bg-green-50 transition-colors duration-150"
          >
            Go to Team App &rarr;
          </a>
          <p className="text-green-300 text-xs mt-3">
            You will need your club login credentials to access this portal.
          </p>
        </div>
      </section>
    </div>
  );
}
