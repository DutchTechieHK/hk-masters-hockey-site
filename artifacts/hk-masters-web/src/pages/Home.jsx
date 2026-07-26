import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import content from "../content/home.json";
import RichText from "../components/RichText";
import { cloudinaryResize } from "../utils/cloudinary";
import { API_BASE } from "../utils/api";
import teamsContent from "../content/teams.json";
import rotterdamContent from "../content/rotterdam.json";
import SquadModal from "../components/SquadModal";
import SponsorStrip from "../components/SponsorStrip";

function useSiteContent() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/site-content`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, []);
  return data;
}

const ROTTERDAM_START   = new Date("2026-07-22T09:00:00+02:00");
const ROTTERDAM_MODE_END = new Date("2026-09-15T00:00:00");
const isRotterdamMode = () => Date.now() < ROTTERDAM_MODE_END.getTime();


function useCountdown(target) {
  const calc = () => {
    const diff = target - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, over: true };
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
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

function CountdownUnit({ value, label, pulse = false }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`bg-white/10 border border-white/20 rounded-xl sm:rounded-2xl px-3 py-3 sm:px-6 sm:py-4 min-w-[62px] sm:min-w-[100px] text-center shadow-inner ${pulse ? "countdown-seconds" : ""}`}>
        <span className="text-3xl sm:text-6xl font-extrabold text-white tabular-nums leading-none tracking-tight">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="mt-2 text-[10px] sm:text-sm font-semibold text-[#8FBDE8] uppercase tracking-widest">
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
    <section className="bg-[#16305D] py-12 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="reveal text-[#DE2910] text-sm sm:text-base font-bold uppercase tracking-widest mb-2">
          Rotterdam 2026 Masters World Cup
        </p>
        <h2 className="reveal text-2xl sm:text-3xl font-extrabold text-white mb-8">
          {countdown.over ? "The tournament has begun!" : "The clock is ticking…"}
        </h2>
        {!countdown.over && (
          <div className="reveal flex items-end justify-center gap-3 sm:gap-5">
            <CountdownUnit value={countdown.days}    label="Days" />
            <CountdownSeparator />
            <CountdownUnit value={countdown.hours}   label="Hours" />
            <CountdownSeparator />
            <CountdownUnit value={countdown.minutes} label="Minutes" />
            <CountdownSeparator />
            <CountdownUnit value={countdown.seconds} label="Seconds" pulse />
          </div>
        )}
        <p className="mt-8 text-[#5B9FE0] text-sm">
          22 July – 1 August 2026 &nbsp;·&nbsp; Rotterdam, Netherlands
        </p>
        <Link
          href="/rotterdam-2026"
          className="btn-shimmer inline-block mt-5 bg-[#DE2910] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-red-700 transition-colors duration-150"
        >
          Tournament details &rarr;
        </Link>
        <p className="mt-6 text-[#8FBDE8] text-sm">
          Got a match report or photos?{" "}
          <Link href="/journal" className="text-white font-semibold underline hover:text-[#BFD9F5] transition-colors duration-150">
            Share it in the HK Masters Journal &rarr;
          </Link>
        </p>
      </div>
    </section>
  );
}

function PhotoPlaceholder({ label }) {
  return (
    <div className="w-full h-full bg-[#16305D] flex flex-col items-center justify-center gap-2 text-[#5B9FE0] rounded-xl">
      <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-xs text-[#5B9FE0] opacity-60 text-center px-4">{label}</p>
    </div>
  );
}

function useLatestNews() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/news`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setPosts((data.posts || []).slice(0, 3)))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return { posts, loading };
}

function proxyNotionImage(url) {
  if (!url) return null;
  // Relative paths (e.g. /api/news/serve-image/...) must be prefixed with
  // API_BASE so they resolve to the API server in production.
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  if (
    url.includes("amazonaws.com") ||
    url.includes("notion.so") ||
    url.includes("file.notion")
  ) {
    return `${API_BASE}/api/news/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function LatestNewsSection() {
  const { posts, loading } = useLatestNews();
  if (loading || posts.length === 0) return null;

  return (
    <section className="bg-white border-t border-gray-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="reveal flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#1E3A6E]">Latest from the team</h2>
          <Link
            href="/news"
            className="text-[#2A5298] font-medium hover:text-[#1E3A6E] transition-colors duration-150 text-sm"
          >
            See all news &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {posts.map((post) => {
            const cover = proxyNotionImage(post.coverImage);
            const dateStr = post.publishedAt
              ? format(parseISO(post.publishedAt), "d MMM yyyy")
              : null;
            return (
              <Link
                key={post.id}
                href={`/news/${post.slug}`}
                className="reveal bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                {cover ? (
                  <div className="aspect-[16/9] overflow-hidden bg-gray-100">
                    <img
                      src={cover}
                      alt={post.title}
                      loading="lazy"
                      className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-[#16305D] flex items-center justify-center">
                    <span className="text-[#5B9FE0] text-xs font-semibold uppercase tracking-widest opacity-60">
                      HK Masters
                    </span>
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {post.category && (
                      <span className="text-xs font-semibold bg-[#EEF4FB] text-[#1E3A6E] px-2 py-0.5 rounded-full">
                        {post.category}
                      </span>
                    )}
                    {dateStr && <span className="text-xs text-gray-400">{dateStr}</span>}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 leading-snug mb-1">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function useLatestJournalArticle() {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/contributions/approved`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const articles = data.filter(
          (c) => c.contentType === "article" || c.contentType === "both"
        );
        setArticle(articles.length > 0 ? articles[0] : null);
      })
      .catch(() => setArticle(null))
      .finally(() => setLoading(false));
  }, []);

  return { article, loading };
}

function LatestJournalCard() {
  const { article, loading } = useLatestJournalArticle();
  if (loading || !article) return null;

  const excerpt = article.articleBody
    ? article.articleBody.slice(0, 200).trimEnd() + (article.articleBody.length > 200 ? "…" : "")
    : null;

  return (
    <section className="bg-[#F2E8D5] border-t border-[#E5D5BC] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="reveal flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#1E3A6E]">Latest from the Journal</h2>
          <Link
            href="/journal"
            className="text-[#2A5298] font-medium hover:text-[#1E3A6E] transition-colors duration-150 text-sm"
          >
            All Journal articles &rarr;
          </Link>
        </div>
        <div className="reveal tilt-card bg-white rounded-2xl border border-[#E5D5BC] overflow-hidden flex flex-col sm:flex-row gap-0">
          <Link href={`/journal/${article.id}`} className="sm:w-64 sm:flex-shrink-0 h-48 sm:h-auto overflow-hidden">
            {article.photoUrls && article.photoUrls.length > 0 ? (
              <img
                src={cloudinaryResize(article.photoUrls[0], 600, 400)}
                alt={article.title}
                className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full min-h-[192px] bg-[#16305D] flex flex-col items-center justify-center gap-2">
                <svg className="w-10 h-10 text-[#5B9FE0] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V8a2 2 0 012-2h3l2-3h4l2 3h3a2 2 0 012 2v10a2 2 0 01-2 2z" />
                  <circle cx="12" cy="13" r="3" strokeWidth={1.5} />
                </svg>
                <span className="text-[#5B9FE0] text-xs font-semibold uppercase tracking-widest opacity-60">HK Masters</span>
              </div>
            )}
          </Link>
          <div className="p-6 sm:p-8 flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-semibold bg-[#F2E8D5] text-[#2A5298] px-2.5 py-1 rounded-full border border-[#E5D5BC]">
                {article.contentType === "photo" ? "Photos" : article.contentType === "both" ? "Article + Photos" : "Article"}
              </span>
              <span className="text-xs text-[#8A7A6A]">
                {format(parseISO(article.createdAt), "d MMM yyyy")}
              </span>
            </div>
            <h3 className="text-xl font-bold text-[#1E3A6E] mb-1 leading-snug">
              {article.title}
            </h3>
            <p className="text-sm text-[#2A5298] font-semibold mb-3">
              By {article.authorName}
            </p>
            {excerpt && (
              <p className="text-sm text-[#5A4F45] leading-relaxed mb-4">
                {excerpt}
              </p>
            )}
            <Link
              href={`/journal/${article.id}`}
              className="self-start text-sm font-semibold text-[#2A5298] hover:text-[#1E3A6E] transition-colors duration-150"
            >
              Read this article &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const siteContent = useSiteContent();

  // Prefer API-served photos; fall back to static JSON values
  // When API has responded (siteContent !== null), trust it completely.
  // When API hasn't responded yet or failed, fall back to static JSON.
  const heroImage = siteContent !== null
    ? (siteContent.heroImage || content.hero_image || null)
    : (content.hero_image || null);

  // If API responded, use its gallery (may be empty if admin cleared it).
  // If API hasn't responded yet, fall back to static JSON.
  const galleryImages = siteContent !== null
    ? (siteContent.galleryImages || [])
    : (content.gallery_images || []);

  const hasHeroImage = Boolean(heroImage);
  const hasGallery   = galleryImages.length > 0;

  // Track which gallery image the user has explicitly clicked.
  // When null, we follow the hero image from the API/static.
  const [userSelectedPhoto, setUserSelectedPhoto] = useState(null);
  const activePhoto = userSelectedPhoto || heroImage;

  const [openSquad, setOpenSquad] = useState(null);
  const stripRef = useRef(null);

  const scrollStrip = (dir) => {
    if (stripRef.current) stripRef.current.scrollLeft += dir * 480;
  };

  return (
    <div>
      {/* ── Hero Section ──────────────────────────────────────── */}
      <section className="relative bg-[#1E3A6E] text-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

            {isRotterdamMode() ? (
              <div>
                <span className="inline-block bg-[#DE2910] text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
                  Rotterdam 2026 Masters World Cup
                </span>
                <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
                  Two Teams Representing<br />Hong Kong
                </h1>
                <p className="text-lg sm:text-xl text-[#D6E8F7] mb-3 font-medium">
                  MO40 · MO50 &mdash; at the World Masters Hockey World Cup
                </p>
                <p className="text-[#BFD9F5] mb-8 max-w-xl leading-relaxed">
                  Hong Kong Masters Hockey is proud to send two squads to Rotterdam this July. Two categories, one city, one flag — competing on the world stage from 22 July to 1 August 2026.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/rotterdam-2026#squads"
                    className="btn-shimmer inline-block bg-[#DE2910] text-white font-semibold px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
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
                <p className="text-lg sm:text-xl text-[#D6E8F7] mb-3 font-medium">
                  {content.hero_tagline}
                </p>
                <RichText content={content.hero_intro} className="text-[#BFD9F5] mb-8 max-w-xl leading-relaxed" />
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/rotterdam-2026"
                    className="btn-shimmer inline-block bg-[#DE2910] text-white font-semibold px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
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

            {/* Hero Photo */}
            <div>
              <div className="h-56 sm:h-72 lg:h-80 w-full rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
                {activePhoto ? (
                  <img
                    src={cloudinaryResize(activePhoto, 1200, 640)}
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

      {/* ── Photo Gallery Strip ───────────────────────────────── */}
      <section className="bg-[#16305D] py-4">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

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

          {hasGallery ? (
            <div
              ref={stripRef}
              className="flex flex-row gap-2 overflow-x-auto"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {galleryImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setUserSelectedPhoto(img.url)}
                  className={`h-28 w-44 flex-shrink-0 rounded-lg overflow-hidden focus:outline-none ${
                    activePhoto === img.url
                      ? "ring-2 ring-[#5B9FE0] ring-offset-2 ring-offset-[#16305D]"
                      : "opacity-75 hover:opacity-100"
                  }`}
                >
                  <img src={cloudinaryResize(img.url, 400, 250)} alt={img.caption || "Club photo"} className="w-full h-full object-cover" />
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
        <div className="mt-4 grid grid-cols-3 divide-x divide-[#5B9FE0]/20 max-w-sm mx-auto">
          {content.stats.map((item, i) => (
            <div key={item.label} className="reveal text-center py-3" style={{ animationDelay: `${i * 0.12}s` }}>
              <p className="text-3xl font-extrabold text-white">{item.stat}</p>
              <p className="text-[#8FBDE8] text-xs font-medium mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Rotterdam Countdown ───────────────────────────────── */}
      <RotterdamCountdown />

      {/* ── Welcome / Rotterdam Squads ────────────────────────── */}
      {isRotterdamMode() ? (
        <section className="bg-[#F2E8D5] py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <p className="reveal text-xs font-bold uppercase tracking-[0.18em] text-[#5B9FE0] mb-3">
                Rotterdam 2026 Masters World Cup
              </p>
              <h2 className="reveal text-3xl font-bold text-[#1E3A6E] mb-4">About the Tournament</h2>
              <p className="reveal text-[#5A4F45] leading-relaxed text-lg">
                The FIH Masters Hockey World Cup is the world's premier tournament for masters-age field hockey players. Rotterdam 2026 will bring together nations from across the globe, competing across multiple age categories. For HK Masters, this is our biggest tournament in years — with two squads making the trip to the Netherlands to fly the Hong Kong flag on the world stage.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {teamsContent.squads.map((squad, i) => {
                const rotterdamSquad = rotterdamContent.squads.find(s => s.category === squad.short_name)
                  || { name: squad.name, category: squad.short_name, player_list: [] };
                return (
                  <div key={squad.id} className="tilt-card reveal scale-in bg-white rounded-xl border border-[#E5D5BC] shadow-sm p-6 flex flex-col" style={{ animationDelay: `${i * 0.15}s` }}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="bg-[#DE2910] text-white text-sm font-bold px-3 py-1 rounded-full">
                        {squad.short_name}
                      </span>
                      <h3 className="font-bold text-[#1E3A6E]">{squad.name}</h3>
                    </div>
                    <p className="text-[#5A4F45] text-sm leading-relaxed flex-1 mb-5">
                      {squad.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-[#8A7A6A] border-t border-[#E5D5BC] pt-4">
                      <span>{squad.player_count} players</span>
                      <button
                        onClick={() => setOpenSquad({ category: squad.short_name, teamInfo: squad })}
                        className="text-[#2A5298] font-semibold text-xs hover:text-[#1E3A6E] transition-colors"
                      >
                        View Squad →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-[#F2E8D5] py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="reveal text-3xl font-bold text-[#1E3A6E] mb-4">{content.welcome_heading}</h2>
              <RichText content={content.welcome_text} className="text-[#5A4F45] leading-relaxed text-lg" />
            </div>
          </div>
        </section>
      )}

      {/* Latest News (from Notion) */}
      <LatestNewsSection />

      {/* Latest Journal Article */}
      <LatestJournalCard />


      {/* Sponsor Logos Strip */}
      <SponsorStrip />

      {openSquad && (
        <SquadModal
          category={openSquad.category}
          teamInfo={openSquad.teamInfo}
          fallback={rotterdamContent.squads.find(s => s.category === openSquad.category)?.player_list || []}
          onClose={() => setOpenSquad(null)}
        />
      )}
    </div>
  );
}
