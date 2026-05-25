import { useState, useEffect } from "react";
import { cloudinaryResize } from "../utils/cloudinary.js";
import { API_BASE, resolveMediaUrl } from "../utils/api";

const TIER_ORDER = ["Gold", "Silver", "Bronze"];

const TIER_BADGE = {
  Gold:   { bg: "#FFF3CD", text: "#92650A", border: "#F0C040" },
  Silver: { bg: "#F2F2F5", text: "#5A5A70", border: "#BCBCCC" },
  Bronze: { bg: "#FDF0E6", text: "#8B4513", border: "#D9996A" },
};

const TIER_COLS = {
  Gold:   { one: "max-w-md mx-auto", multi: "grid-cols-1 sm:grid-cols-2" },
  Silver: { one: "max-w-md mx-auto", multi: "grid-cols-2 sm:grid-cols-3" },
  Bronze: { one: "max-w-md mx-auto", multi: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" },
};

const sponsorshipEmail = "sponsorship@hkmastershockey.com";

function SponsorCard({ sponsor }) {
  const [imgFailed, setImgFailed] = useState(false);
  const displayUrl = cloudinaryResize(resolveMediaUrl(sponsor.logoUrl), 600);
  const badge = TIER_BADGE[sponsor.tier] || TIER_BADGE.Bronze;

  const card = (
    <div className="group bg-white border border-[#D9C9A8] rounded-2xl flex flex-col items-center justify-center py-6 px-4 sm:py-10 sm:px-8 gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center justify-center w-full h-16 sm:h-28">
        {displayUrl && !imgFailed ? (
          <img
            src={displayUrl}
            alt={sponsor.name}
            className="max-h-full max-w-full object-contain"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="text-center px-4">
            <p className="text-[#1E3A6E] font-bold text-xl tracking-wide">{sponsor.name}</p>
            <p className="text-[#8A7A6A] text-xs mt-1 tracking-widest uppercase">Logo coming soon</p>
          </div>
        )}
      </div>
      {sponsor.websiteUrl && (
        <p className="text-[#8A7A6A] text-xs tracking-wide sm:tracking-widest uppercase truncate w-full text-center">
          {sponsor.websiteUrl.replace(/^https?:\/\//, "")}
        </p>
      )}
    </div>
  );

  if (sponsor.websiteUrl) {
    return (
      <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="block">
        {card}
      </a>
    );
  }
  return card;
}

export default function Sponsors() {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/sponsors`)
      .then((res) => res.json())
      .then((data) => setSponsors(Array.isArray(data) ? data : []))
      .catch(() => setSponsors([]))
      .finally(() => setLoading(false));
  }, []);

  const activeSponsors = sponsors.filter((s) => s.active);
  const tierGroups = TIER_ORDER.map((name) => ({
    name,
    sponsors: activeSponsors.filter((s) => s.tier === name),
  })).filter((t) => t.sponsors.length > 0);
  const hasSponsors = tierGroups.length > 0;

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#1E3A6E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold mb-3">Our Sponsors</h1>
          <p className="text-[#BFD9F5] text-lg max-w-xl">
            We are grateful to our sponsors for making Hong Kong Masters Hockey possible.
          </p>
        </div>
      </div>

      {/* Sponsor showcase */}
      {loading ? (
        <section className="bg-[#EDE0C4] py-24 text-center">
          <p className="text-[#8A7A6A] text-sm tracking-widest uppercase">Loading…</p>
        </section>
      ) : hasSponsors ? (
        <section className="bg-[#EDE0C4] py-10 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-[#D9C9A8]">
          <div className="max-w-5xl mx-auto space-y-10 sm:space-y-16">
            {tierGroups.map(({ name, sponsors }) => {
              const badge = TIER_BADGE[name] || TIER_BADGE.Bronze;
              const cols  = TIER_COLS[name]  || TIER_COLS.Bronze;
              return (
                <div key={name} className="reveal">
                  <div className="flex items-center gap-4 mb-5 sm:mb-10">
                    <div className="h-px flex-1 bg-[#D9C9A8]" />
                    <span
                      className="text-xs font-bold tracking-widest uppercase px-5 py-2 rounded-full border"
                      style={{ color: badge.text, borderColor: badge.border, backgroundColor: badge.bg }}
                    >
                      {name} Sponsors
                    </span>
                    <div className="h-px flex-1 bg-[#D9C9A8]" />
                  </div>

                  <div className={`grid gap-5 ${sponsors.length === 1 ? cols.one : cols.multi}`}>
                    {sponsors.map((sponsor) => (
                      <SponsorCard key={sponsor.id} sponsor={sponsor} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="bg-[#EDE0C4] py-24 text-center px-4">
          <p className="text-[#5A4F45] text-lg font-medium mb-2">Sponsor announcements coming soon</p>
          <p className="text-[#8A7A6A] text-sm">
            We're finalising our sponsorship packages for the 2026 season. Check back shortly.
          </p>
        </section>
      )}

      {/* Become a Sponsor CTA */}
      <section className="bg-[#1E3A6E] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-white mb-4">Become a Sponsor</h2>
            <p className="text-[#D6E8F7] leading-relaxed mb-4">
              Partnering with Hong Kong Masters Hockey gives your brand access to a community of
              active, affluent, and engaged professionals aged 35 and above. We compete at the
              highest levels of international masters hockey and carry your brand with us.
            </p>
            <p className="text-[#D6E8F7] leading-relaxed mb-8">
              Whether you're looking for kit branding, event sponsorship, social media exposure, or
              hospitality opportunities, we have a sponsorship package to match your goals.
              Get in touch and let's build something great together.
            </p>
            <a
              href={`mailto:${sponsorshipEmail}`}
              className="btn-shimmer inline-block bg-[#DE2910] text-white font-bold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
            >
              Contact Us About Sponsorship
            </a>
            <p className="text-[#8FBDE8] text-sm mt-3">{sponsorshipEmail}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
