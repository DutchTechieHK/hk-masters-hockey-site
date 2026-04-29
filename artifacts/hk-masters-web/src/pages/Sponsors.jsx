import { useState, useEffect } from "react";
import FundraisingThermometer from "../components/FundraisingThermometer";
import PledgeForm from "../components/PledgeForm";

const TIER_STYLES = {
  Gold: {
    color: "from-yellow-400 to-yellow-500",
    textColor: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    description:
      "Our Gold sponsors receive maximum visibility — logo on all playing kits, website homepage banner, and exclusive hospitality at tournaments.",
  },
  Silver: {
    color: "from-gray-300 to-gray-400",
    textColor: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    description:
      "Silver sponsors receive website listing, social media recognition, and prominent branding at club events.",
  },
  Bronze: {
    color: "from-orange-400 to-orange-500",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    description:
      "Bronze sponsors are acknowledged on our website and in club communications throughout the season.",
  },
};

const TIER_ORDER = ["Gold", "Silver", "Bronze"];

const sponsorshipEmail = "sponsorship@hkmastershockey.com";

function SponsorLogo({ sponsor }) {
  const inner = sponsor.logoUrl ? (
    <img
      src={sponsor.logoUrl}
      alt={sponsor.name}
      className="max-h-16 max-w-[180px] object-contain"
    />
  ) : (
    <div className="text-center">
      <p className="text-gray-400 font-medium text-sm">{sponsor.name}</p>
      <p className="text-gray-300 text-xs mt-0.5">Logo coming soon</p>
    </div>
  );

  if (sponsor.websiteUrl) {
    return (
      <a
        href={sponsor.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center justify-center min-h-[100px] hover:shadow-md transition-shadow"
      >
        {inner}
      </a>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center justify-center min-h-[100px]">
      {inner}
    </div>
  );
}

export default function Sponsors() {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sponsors")
      .then((res) => res.json())
      .then((data) => {
        setSponsors(Array.isArray(data) ? data : []);
      })
      .catch(() => setSponsors([]))
      .finally(() => setLoading(false));
  }, []);

  const activeSponsors = sponsors.filter((s) => s.active);

  const tierGroups = TIER_ORDER.map((tierName) => ({
    name: tierName,
    sponsors: activeSponsors.filter((s) => s.tier === tierName),
    ...TIER_STYLES[tierName],
  })).filter((t) => t.sponsors.length > 0);

  const hasSponsors = tierGroups.length > 0;

  return (
    <div>
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold mb-3">Our Sponsors</h1>
          <p className="text-green-200 text-lg max-w-xl">
            We are grateful to our sponsors for making Hong Kong Masters Hockey possible.
          </p>
        </div>
      </div>

      {loading ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="bg-gray-50 rounded-2xl p-12">
            <p className="text-gray-400 text-sm">Loading sponsors...</p>
          </div>
        </section>
      ) : hasSponsors ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
          {tierGroups.map((tier) => (
            <div key={tier.name}>
              <div className="flex items-center gap-3 mb-6">
                <span
                  className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r ${tier.color} text-white`}
                >
                  {tier.name} Sponsors
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-6 max-w-2xl">{tier.description}</p>
              <div
                className={`grid gap-4 ${
                  tier.name === "Gold"
                    ? "grid-cols-1 sm:grid-cols-2"
                    : tier.name === "Silver"
                    ? "grid-cols-2 sm:grid-cols-3"
                    : "grid-cols-2 sm:grid-cols-4"
                }`}
              >
                {tier.sponsors.map((sponsor, i) => (
                  <SponsorLogo key={sponsor.id ?? i} sponsor={sponsor} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="bg-gray-50 rounded-2xl p-12">
            <p className="text-gray-500 text-lg font-medium mb-2">Sponsor announcements coming soon</p>
            <p className="text-gray-400 text-sm">
              We're finalising our sponsorship packages for the 2026 season. Check back shortly.
            </p>
          </div>
        </section>
      )}

      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Rotterdam 2026 Fundraising</h2>
            <p className="text-gray-600 text-sm mb-6">
              Help Hong Kong Masters Hockey reach their goal for the 2026 World Masters Cup in Rotterdam.
            </p>
            <FundraisingThermometer />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pledge Your Support</h2>
          <p className="text-gray-600 text-sm mb-8">
            Make a pledge toward Hong Kong's 2026 World Masters Hockey campaign. No payment is taken
            now — a team member will follow up with you directly.
          </p>
          <PledgeForm />
        </div>
      </section>

      <section className="bg-[#006B3C] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-white mb-4">Become a Sponsor</h2>
            <p className="text-green-100 leading-relaxed mb-4">
              Partnering with Hong Kong Masters Hockey gives your brand access to a community of
              active, affluent, and engaged professionals aged 35 and above. We compete at the
              highest levels of international masters hockey and carry your brand with us.
            </p>
            <p className="text-green-100 leading-relaxed mb-8">
              Whether you're looking for kit branding, event sponsorship, social media exposure, or
              hospitality opportunities, we have a sponsorship package to match your goals.
              Get in touch and let's build something great together.
            </p>
            <a
              href={`mailto:${sponsorshipEmail}`}
              className="inline-block bg-[#DE2910] text-white font-bold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
            >
              Contact Us About Sponsorship
            </a>
            <p className="text-green-300 text-sm mt-3">{sponsorshipEmail}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
