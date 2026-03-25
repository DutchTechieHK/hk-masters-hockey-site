// TODO: Replace all placeholder text and headshots with real content

// TODO: Replace this list with actual committee members (name, role, image path)
const committee = [
  { id: 1, name: "John Chan", role: "Club President", image: null },
  { id: 2, name: "Sarah Wong", role: "Vice President", image: null },
  { id: 3, name: "Michael Lee", role: "Honorary Secretary", image: null },
  { id: 4, name: "Emily Tse", role: "Treasurer", image: null },
  { id: 5, name: "David Lam", role: "Men's Captain (O35)", image: null },
  { id: 6, name: "Grace Ho", role: "Women's Captain", image: null },
];

// TODO: Replace with actual club history milestones
const timeline = [
  {
    year: "2003",
    event: "Club Founded",
    detail: "Hong Kong Masters Hockey was established by a group of passionate former players determined to keep competing after 35.",
  },
  {
    year: "2008",
    event: "First International Tour",
    detail: "The club competed in its first overseas tournament in Singapore, finishing runner-up in the Over-45 category.",
  },
  {
    year: "2012",
    event: "Women's Squad Formed",
    detail: "A women's masters squad was added, broadening the club's reach and competing in regional tournaments.",
  },
  {
    year: "2018",
    event: "World Masters Cup, Barcelona",
    detail: "HK Masters sent three squads to Spain, achieving best-ever results with a bronze medal in O45.",
  },
  {
    year: "2022",
    event: "Club Rebrand",
    detail: "Refreshed club identity, updated kit design, and launched a new development programme for players aged 35–40.",
  },
  {
    year: "2026",
    event: "Rotterdam World Masters Cup",
    detail: "Four squads are preparing to represent Hong Kong at the World Masters Cup in Rotterdam, Netherlands.",
  },
];

export default function About() {
  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold mb-3">About Us</h1>
          <p className="text-green-200 text-lg max-w-xl">
            Learn about our club, our people, and the journey that brought us here.
          </p>
        </div>
      </div>

      {/* Mission Statement */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
          {/*
            TODO: Replace the paragraph below with the club's actual mission statement.
            Keep it concise — 3–5 sentences is ideal.
          */}
          <p className="text-gray-600 leading-relaxed text-lg mb-4">
            Hong Kong Masters Hockey exists to provide a high-quality, inclusive, and competitive
            environment for field hockey players aged 35 and above. We believe that age is no barrier
            to sporting excellence, and we are committed to fostering camaraderie, physical fitness,
            and the lifelong love of hockey.
          </p>
          <p className="text-gray-600 leading-relaxed text-lg">
            We represent Hong Kong with pride on the international stage while building a strong
            local community of masters players. Whether you're a seasoned international or returning
            to the sport, there is a place for you here.
          </p>
        </div>
      </section>

      {/* Committee Grid */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Club Committee &amp; Leadership</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {committee.map((person) => (
              <div key={person.id} className="text-center">
                {/* Headshot placeholder — TODO: replace with <img src={person.image} ... /> */}
                <div className="w-20 h-20 rounded-full bg-[#006B3C]/10 border-2 border-[#006B3C]/20 mx-auto mb-3 flex items-center justify-center text-[#006B3C] font-bold text-lg">
                  {person.name.split(" ").map(n => n[0]).join("")}
                </div>
                <p className="font-semibold text-gray-900 text-sm">{person.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{person.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* History Timeline */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-10">Club History</h2>
        <div className="relative">
          {/* Timeline vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-green-200 hidden sm:block" />
          <div className="space-y-8">
            {timeline.map((item, index) => (
              <div key={index} className="sm:pl-12 relative">
                {/* Year dot */}
                <div className="hidden sm:flex absolute left-0 top-1 w-8 h-8 rounded-full bg-[#006B3C] items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-white" />
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-[#DE2910] text-white text-xs font-bold px-2 py-0.5 rounded">
                      {item.year}
                    </span>
                    <h3 className="font-bold text-gray-900">{item.event}</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
