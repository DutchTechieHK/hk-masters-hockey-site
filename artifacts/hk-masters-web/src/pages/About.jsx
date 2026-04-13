import content from "../content/about.json";
import AutoLink from "../components/AutoLink";

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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
          <p className="text-gray-600 leading-relaxed text-lg mb-4 whitespace-pre-line">
            <AutoLink text={content.mission_p1} />
          </p>
          <p className="text-gray-600 leading-relaxed text-lg whitespace-pre-line">
            <AutoLink text={content.mission_p2} />
          </p>
        </div>
      </section>

      {/* History Timeline */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Club History</h2>
        {content.history_intro && (
          <p className="text-gray-600 leading-relaxed text-lg mb-10 max-w-3xl whitespace-pre-line">
            <AutoLink text={content.history_intro} />
          </p>
        )}
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-green-200 hidden sm:block" />
          <div className="space-y-8">
            {content.timeline.map((item, index) => (
              <div key={index} className="sm:pl-12 relative">
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

      {/* Committee Grid */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Club Committee &amp; Leadership</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {content.committee.map((person) => (
              <div key={person.name} className="text-center">
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
    </div>
  );
}
