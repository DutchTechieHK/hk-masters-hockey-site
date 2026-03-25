import { Link } from "wouter";

// TODO: Replace squad descriptions, player lists, and photos with real data

const squads = [
  {
    id: "men-o35",
    name: "Men's Over-35",
    shortName: "M35",
    description:
      "Our Men's Over-35 squad is the largest and most competitive squad in the club. Drawing from a deep pool of experienced local and expat players, the M35 team competes in regional Asia-Pacific tournaments and the World Masters Cup.",
    // TODO: Replace with actual squad photo path, e.g., "/images/teams/men-o35.jpg"
    photo: null,
    playerCount: 22,
    coach: "Mark Davidson", // TODO: Replace with real coach name
    captain: "David Lam",   // TODO: Replace with real captain name
  },
  {
    id: "men-o45",
    name: "Men's Over-45",
    shortName: "M45",
    description:
      "The Men's Over-45 squad combines deep experience with enduring passion for the game. This squad has achieved our club's best international results, including a bronze medal at the 2018 World Masters Cup in Barcelona.",
    photo: null,
    playerCount: 18,
    coach: "Peter Hughes",  // TODO: Replace with real coach name
    captain: "Robert Ng",   // TODO: Replace with real captain name
  },
  {
    id: "men-o55",
    name: "Men's Over-55",
    shortName: "M55",
    description:
      "Our newest competitive squad, the Men's Over-55 team was formed in 2023 and competes in selected regional and international tournaments. If you're 55 or above and want to lace up again, this squad is for you.",
    photo: null,
    playerCount: 14,
    coach: "Alan Chow",    // TODO: Replace with real coach name
    captain: "Richard Yip", // TODO: Replace with real captain name
  },
  {
    id: "women",
    name: "Women's Team",
    shortName: "W35+",
    description:
      "Open to women aged 35 and above, our Women's team has grown significantly since its formation in 2012. The squad competes in the Over-35 category internationally and is looking to expand its tournament schedule in 2026 and beyond.",
    photo: null,
    playerCount: 16,
    coach: "Linda Siu",    // TODO: Replace with real coach name
    captain: "Grace Ho",   // TODO: Replace with real captain name
  },
];

export default function Teams() {
  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold mb-3">Our Squads</h1>
          <p className="text-green-200 text-lg max-w-xl">
            Four squads, one club — representing Hong Kong Masters Hockey on the world stage.
          </p>
        </div>
      </div>

      {/* Squads */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-16">
          {squads.map((squad, index) => (
            <div
              key={squad.id}
              className={`flex flex-col ${index % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-10 items-center`}
            >
              {/* Squad Photo */}
              <div className="w-full lg:w-1/2 shrink-0">
                {squad.photo ? (
                  // TODO: When a real photo is available, this <img> will render
                  <img
                    src={squad.photo}
                    alt={`${squad.name} squad photo`}
                    className="rounded-2xl w-full h-72 object-cover shadow-md"
                  />
                ) : (
                  /* Placeholder — TODO: replace with squad.photo above */
                  <div className="rounded-2xl w-full h-72 bg-[#006B3C]/10 border-2 border-dashed border-[#006B3C]/30 flex flex-col items-center justify-center text-[#006B3C]">
                    <div className="text-4xl font-extrabold opacity-30">{squad.shortName}</div>
                    <p className="text-sm opacity-40 mt-1">Squad photo coming soon</p>
                    {/* TODO: Replace this placeholder with: <img src="/images/teams/YOUR_PHOTO.jpg" ... /> */}
                  </div>
                )}
              </div>

              {/* Squad Info */}
              <div className="w-full lg:w-1/2">
                <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
                  {squad.shortName}
                </span>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-3">{squad.name}</h2>
                <p className="text-gray-600 leading-relaxed mb-5">{squad.description}</p>

                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-[#006B3C]">{squad.playerCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Players</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    {/* TODO: Replace with real coach */}
                    <p className="text-sm font-semibold text-gray-800">{squad.coach}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Coach</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    {/* TODO: Replace with real captain */}
                    <p className="text-sm font-semibold text-gray-800">{squad.captain}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Captain</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Join the Team CTA */}
      <section className="bg-[#006B3C] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">Join the Team</h2>
          {/* TODO: Update joining criteria, eligibility, and contact details below */}
          <p className="text-green-100 max-w-xl mx-auto mb-6 leading-relaxed">
            Are you 35 or above and passionate about field hockey? We welcome players of all abilities.
            Trials are held at the start of each season — get in touch to find out more.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
          >
            Contact Us to Join
          </Link>
        </div>
      </section>
    </div>
  );
}
