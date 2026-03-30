import { Link } from "wouter";
import content from "../content/home.json";
import eventsContent from "../content/events.json";

function PhotoPlaceholder({ label }) {
  return (
    <div className="w-full h-full bg-[#004A2A] flex flex-col items-center justify-center gap-2 text-green-400 rounded-xl">
      <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-xs text-green-500 opacity-60 text-center px-4">{label}</p>
    </div>
  );
}

export default function Home() {
  const hasHeroImage = content.hero_image && content.hero_image.trim() !== "";
  const hasGallery = content.gallery_images && content.gallery_images.length > 0;

  return (
    <div>
      {/* Hero Section — two-column on desktop */}
      <section className="relative bg-[#006B3C] text-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

            {/* Left: Text */}
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
                {content.hero_title}
              </h1>
              <p className="text-lg sm:text-xl text-green-100 mb-3 font-medium">
                {content.hero_tagline}
              </p>
              <p className="text-green-200 mb-8 max-w-xl leading-relaxed">
                {content.hero_intro}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/rotterdam-2026"
                  className="inline-block bg-[#DE2910] text-white font-semibold px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
                >
                  Rotterdam 2026 &rarr;
                </Link>
                <Link
                  href="/about"
                  className="inline-block bg-white/10 border border-white/30 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/20 transition-colors duration-150"
                >
                  About the Club
                </Link>
              </div>
            </div>

            {/* Right: Hero Photo */}
            <div className="hidden lg:block">
              <div className="h-80 w-full rounded-2xl overflow-hidden shadow-2xl">
                {hasHeroImage ? (
                  <img
                    src={content.hero_image}
                    alt="HK Masters Hockey team"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <PhotoPlaceholder label="Add your team photo via CMS → Home Page → Hero Photo" />
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Photo Gallery Strip */}
      <section className="bg-[#005030] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {hasGallery ? (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {content.gallery_images.slice(0, 5).map((img, i) => (
                <div key={i} className="h-28 rounded-lg overflow-hidden">
                  <img src={img.url} alt={img.caption || "Club photo"} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-28 rounded-lg overflow-hidden">
                  <PhotoPlaceholder label={i === 2 ? "Add photos via CMS → Home Page → Gallery" : ""} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Welcome Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{content.welcome_heading}</h2>
          <p className="text-gray-600 leading-relaxed text-lg">
            {content.welcome_text}
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {content.stats.map((item) => (
              <div key={item.label} className="bg-green-50 rounded-xl p-6">
                <p className="text-4xl font-extrabold text-[#006B3C]">{item.stat}</p>
                <p className="text-gray-600 mt-1 text-sm font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Events Strip */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
            <Link href="/events" className="text-[#006B3C] font-medium hover:text-green-800 transition-colors duration-150 text-sm">
              View all events &rarr;
            </Link>
          </div>
          {eventsContent.upcoming_events.length === 0 ? (
            <p className="text-gray-400 text-sm">No upcoming events yet — add them via CMS → Events Page.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {eventsContent.upcoming_events.slice(0, 3).map((event) => (
                <div key={event.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-150">
                  <span className="inline-block bg-green-100 text-[#006B3C] text-xs font-semibold px-2 py-1 rounded-full mb-3">
                    {event.date}
                  </span>
                  <h3 className="font-bold text-gray-900 mb-1">{event.name}</h3>
                  <p className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {event.location}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">{event.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Sponsor Logos Strip */}
      <section className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-widest mb-8">
            Our Sponsors
          </p>
          <div className="flex flex-wrap justify-center gap-8 items-center">
            <div className="bg-gray-100 rounded-lg px-8 py-4 text-gray-400 font-medium text-sm">
              Sponsor logos managed via CMS &rarr; Sponsors section
            </div>
          </div>
          <div className="text-center mt-6">
            <Link href="/sponsors" className="text-[#006B3C] text-sm font-medium hover:text-green-800 transition-colors duration-150">
              Become a sponsor &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
