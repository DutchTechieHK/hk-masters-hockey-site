import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import content from "../content/home.json";
import eventsContent from "../content/events.json";
import teamsContent from "../content/teams.json";
import rotterdamContent from "../content/rotterdam.json";
import SquadModal from "../components/SquadModal";

const ROTTERDAM_START = new Date("2026-07-22T09:00:00");
const ROTTERDAM_MODE_END = new Date("2026-09-15T00:00:00");
const isRotterdamMode = () => Date.now() < ROTTERDAM_MODE_END.getTime();

function useCountdown(target) {
  const calc = () => {
    const diff = target - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, over: true };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      over: false,
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function CountdownUnit({ value, label }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white/10 border border-white/20 rounded-xl sm:rounded-2xl px-3 py-3 sm:px-6 sm:py-4 min-w-[62px] sm:min-w-[100px] text-center shadow-inner">
        <span className="text-3xl sm:text-6xl font-extrabold text-white tabular-nums leading-none tracking-tight">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="mt-2 text-[10px] sm:text-sm font-semibold text-green-300 uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

function CountdownSeparator() {
  return (
    <span className="text-2xl sm:text-5xl font-extrabold text-white/40 pb-6 select-none">:</span>
  );
}

function RotterdamCountdown() {
  const countdown = useCountdown(ROTTERDAM_START);
  return (
    <section className="bg-[#004A2A] py-12 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-[#DE2910] text-sm sm:text-base font-bold uppercase tracking-widest mb-2">
          Rotterdam 2026 Masters World Cup
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">
          {countdown.over ? "The tournament has begun!" : "The clock is ticking…"}
        </h2>
        {!countdown.over && (
          <div className="flex items-end justify-center gap-3 sm:gap-5">
            <CountdownUnit value={countdown.days} label="Days" />
            <CountdownSeparator />
            <CountdownUnit value={countdown.hours} label="Hours" />
            <CountdownSeparator />
            <CountdownUnit value={countdown.minutes} label="Minutes" />
            <CountdownSeparator />
            <CountdownUnit value={countdown.seconds} label="Seconds" />
          </div>
        )}
        <p className="mt-8 text-green-400 text-sm">
          22 July – 1 August 2026 &nbsp;·&nbsp; Rotterdam, Netherlands
        </p>
        <Link
          href="/rotterdam-2026"
          className="inline-block mt-5 bg-[#DE2910] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-red-700 transition-colors duration-150"
        >
          Tournament details &rarr;
        </Link>
      </div>
    </section>
  );
}

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
  const [activePhoto, setActivePhoto] = useState(hasHeroImage ? content.hero_image : null);
  const [openSquad, setOpenSquad] = useState(null);
  const stripRef = useRef(null);

  const scrollStrip = (dir) => {
    if (stripRef.current) {
      stripRef.current.scrollLeft += dir * 480;
    }
  };

  return (
    <div>
      {/* Hero Section — two-column on desktop */}
      <section className="relative bg-[#006B3C] text-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

            {/* Left: Text — Rotterdam mode until 15 Sep 2026, then standard */}
            {isRotterdamMode() ? (
              <div>
                <span className="inline-block bg-[#DE2910] text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
                  Rotterdam 2026 · World Masters Cup
                </span>
                <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
                  Three Teams Representing Hong Kong
                </h1>
                <p className="text-lg sm:text-xl text-green-100 mb-3 font-medium">
                  W35 · M40 · M50 &mdash; at the World Masters Hockey World Cup
                </p>
                <p className="text-green-200 mb-8 max-w-xl leading-relaxed">
                  Hong Kong Masters Hockey is proud to send three squads to Rotterdam this July. Three categories, one city, one flag — competing on the world stage from 22 July to 1 August 2026.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/rotterdam-2026#squads"
                    className="inline-block bg-[#DE2910] text-white font-semibold px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
                  >
                    Meet the Squads &rarr;
                  </Link>
                </div>
              </div>
            ) : (
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
                    About HK Masters
                  </Link>
                </div>
              </div>
            )}

            {/* Right: Hero Photo */}
            <div>
              <div className="h-56 sm:h-72 lg:h-80 w-full rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
                {activePhoto ? (
                  <img
                    src={activePhoto}
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
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Left Arrow */}
          {hasGallery && (
            <button
              onClick={() => scrollStrip(-1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white w-8 h-14 flex items-center justify-center rounded-r-lg"
              aria-label="Scroll left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Strip */}
          {hasGallery ? (
            <div
              ref={stripRef}
              className="flex flex-row gap-2 overflow-x-auto"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {content.gallery_images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(img.url)}
                  className={`h-28 w-44 flex-shrink-0 rounded-lg overflow-hidden focus:outline-none ${
                    activePhoto === img.url
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#005030]"
                      : "opacity-75 hover:opacity-100"
                  }`}
                >
                  <img src={img.url} alt={img.caption || "Club photo"} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-row gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-28 w-44 flex-shrink-0 rounded-lg overflow-hidden">
                  <PhotoPlaceholder label={i === 3 ? "Add photos via CMS → Home Page → Gallery" : ""} />
                </div>
              ))}
            </div>
          )}

          {/* Right Arrow */}
          {hasGallery && (
            <button
              onClick={() => scrollStrip(1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white w-8 h-14 flex items-center justify-center rounded-l-lg"
              aria-label="Scroll right"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

        </div>

        {/* Stats Bar */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-green-600">
          {content.stats.map((item) => (
            <div key={item.label} className="text-center py-3">
              <p className="text-3xl font-extrabold text-white">{item.stat}</p>
              <p className="text-green-300 text-xs font-medium mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

      </section>

      {/* Rotterdam Countdown */}
      <RotterdamCountdown />

      {/* Welcome / Rotterdam Squads Section */}
      {isRotterdamMode() ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Tournament context */}
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">About the Tournament</h2>
            <p className="text-gray-600 leading-relaxed text-lg">
              The FIH Masters Hockey World Cup is the world's premier tournament for masters-age field hockey players. Rotterdam 2026 will bring together nations from across the globe, competing across multiple age categories. For HK Masters, this is our biggest tournament in years — with three squads making the trip to the Netherlands to fly the Hong Kong flag on the world stage.
            </p>
          </div>

          {/* Squad cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {teamsContent.squads.map((squad) => {
              const rotterdamSquad = rotterdamContent.squads.find(s => s.category === squad.short_name);
              return (
              <div key={squad.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-[#DE2910] text-white text-sm font-bold px-3 py-1 rounded-full">
                    {squad.short_name}
                  </span>
                  <h3 className="font-bold text-gray-900">{squad.name}</h3>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-5">
                  {squad.description}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-4">
                  <span>{squad.player_count} players</span>
                  <button
                    onClick={() => setOpenSquad({ squad: rotterdamSquad || { name: squad.name, category: squad.short_name, player_list: [] }, teamInfo: squad })}
                    className="text-[#006B3C] font-semibold text-xs hover:text-green-800 transition-colors"
                  >
                    View Squad →
                  </button>
                </div>
              </div>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/rotterdam-2026"
              className="inline-block bg-[#006B3C] text-white font-semibold px-8 py-3 rounded-lg hover:bg-green-800 transition-colors duration-150"
            >
              Full Rotterdam 2026 details &rarr;
            </Link>
          </div>
        </section>
      ) : (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{content.welcome_heading}</h2>
            <p className="text-gray-600 leading-relaxed text-lg">
              {content.welcome_text}
            </p>
          </div>
        </section>
      )}

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

      {openSquad && (
        <SquadModal
          squad={openSquad.squad}
          teamInfo={openSquad.teamInfo}
          onClose={() => setOpenSquad(null)}
        />
      )}
    </div>
  );
}
