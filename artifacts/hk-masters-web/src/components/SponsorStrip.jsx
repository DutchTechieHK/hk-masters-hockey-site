import { useState, useEffect } from "react";
import { Link } from "wouter";
import { API_BASE } from "../utils/api";
import { cloudinaryResize } from "../utils/cloudinary";

const TIER_ORDER = ["Gold", "Silver", "Bronze"];

function SponsorCard({ sponsor }) {
  const [imgFailed, setImgFailed] = useState(false);
  const displayUrl = cloudinaryResize(sponsor.logoUrl, 400);

  const inner = (
    <div
      className="bg-white border border-[#D9C9A8] rounded-xl shadow-sm flex items-center justify-center py-6 px-5 min-h-[100px] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
    >
      {displayUrl && !imgFailed ? (
        <img
          src={displayUrl}
          alt={sponsor.name}
          className="max-h-16 max-w-[180px] object-contain"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="text-[#5A4F45] font-semibold text-sm text-center px-2">{sponsor.name}</span>
      )}
    </div>
  );

  if (sponsor.websiteUrl) {
    return (
      <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }
  return inner;
}

function useSponsors() {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/sponsors`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setSponsors(Array.isArray(data) ? data : []))
      .catch(() => setSponsors([]))
      .finally(() => setLoading(false));
  }, []);

  return { sponsors, loading };
}

export default function SponsorStrip() {
  const { sponsors, loading } = useSponsors();

  const activeSponsors = sponsors.filter((s) => s.active);
  const sorted = TIER_ORDER.flatMap((tier) =>
    activeSponsors.filter((s) => s.tier === tier)
  );

  return (
    <section className="bg-[#EDE0C4] py-12 border-t border-[#D9C9A8]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[10px] font-semibold text-[#8A7A6A] uppercase tracking-[0.22em] mb-8 reveal">
          Our Sponsors
        </p>

        {loading ? (
          <div className="flex justify-center">
            <p className="text-[#8A7A6A] text-sm tracking-widest uppercase">Loading…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex justify-center">
            <p className="text-[#8A7A6A] text-sm">Sponsors coming soon.</p>
          </div>
        ) : (
          <div
            className={`reveal grid gap-4 ${
              sorted.length === 1
                ? "grid-cols-1 max-w-xs mx-auto"
                : sorted.length === 2
                ? "grid-cols-1 sm:grid-cols-2 max-w-lg mx-auto"
                : "grid-cols-2 sm:grid-cols-3"
            }`}
            style={{ animationDelay: "0.12s" }}
          >
            {sorted.map((s) => (
              <SponsorCard key={s.id} sponsor={s} />
            ))}
          </div>
        )}

        <div className="text-center mt-8">
          <Link
            href="/sponsors"
            className="text-sm font-semibold text-[#5A4F45] hover:text-[#1E3A6E] tracking-wide transition-colors duration-150"
          >
            View all sponsors →
          </Link>
        </div>
      </div>
    </section>
  );
}
