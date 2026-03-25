/*
  CONTENT GUIDE — Sponsors Page
  ==============================
  SPONSOR LOGOS:
  - In each tier's `sponsors` array, set `logo` to the path of the sponsor's logo image.
  - Example: logo: "/images/sponsors/sponsor-name.png"
  - When `logo` is set, the <img> will render; otherwise a name placeholder is shown.
  - Recommended logo size: ~300×120px, transparent background preferred.

  CONTACT EMAIL:
  - Replace "sponsorship@hkmastershockey.com" below with the real sponsorship contact.
*/

const tiers = [
  {
    name: "Gold",
    color: "from-yellow-400 to-yellow-500",
    textColor: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    description: "Our Gold sponsors receive maximum visibility — logo on all playing kits, website homepage banner, and exclusive hospitality at tournaments.",
    // TODO: Replace with real Gold sponsors (name and logo path)
    sponsors: [
      { id: 1, name: "Gold Sponsor A", logo: null },
      { id: 2, name: "Gold Sponsor B", logo: null },
    ],
  },
  {
    name: "Silver",
    color: "from-gray-300 to-gray-400",
    textColor: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    description: "Silver sponsors receive website listing, social media recognition, and prominent branding at club events.",
    // TODO: Replace with real Silver sponsors
    sponsors: [
      { id: 3, name: "Silver Sponsor A", logo: null },
      { id: 4, name: "Silver Sponsor B", logo: null },
      { id: 5, name: "Silver Sponsor C", logo: null },
    ],
  },
  {
    name: "Bronze",
    color: "from-orange-400 to-orange-500",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    description: "Bronze sponsors are acknowledged on our website and in club communications throughout the season.",
    // TODO: Replace with real Bronze sponsors
    sponsors: [
      { id: 6, name: "Bronze Sponsor A", logo: null },
      { id: 7, name: "Bronze Sponsor B", logo: null },
      { id: 8, name: "Bronze Sponsor C", logo: null },
      { id: 9, name: "Bronze Sponsor D", logo: null },
    ],
  },
];

// TODO: Replace with real sponsorship contact email
const sponsorshipEmail = "sponsorship@hkmastershockey.com";

function SponsorLogo({ sponsor }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center justify-center min-h-[100px]">
      {sponsor.logo ? (
        /* Real logo — rendered when logo path is set */
        <img
          src={sponsor.logo}
          alt={sponsor.name}
          className="max-h-16 max-w-[180px] object-contain"
        />
      ) : (
        /* Placeholder — TODO: set sponsor.logo path to display the real logo */
        <div className="text-center">
          <p className="text-gray-400 font-medium text-sm">{sponsor.name}</p>
          <p className="text-gray-300 text-xs mt-0.5">Logo placeholder</p>
          {/* TODO: Replace with: <img src="/images/sponsors/YOUR_LOGO.png" alt="..." /> */}
        </div>
      )}
    </div>
  );
}

export default function Sponsors() {
  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold mb-3">Our Sponsors</h1>
          <p className="text-green-200 text-lg max-w-xl">
            We are grateful to our sponsors for making Hong Kong Masters Hockey possible.
          </p>
        </div>
      </div>

      {/* Sponsor Tiers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {tiers.map((tier) => (
          <div key={tier.name}>
            <div className="flex items-center gap-3 mb-6">
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r ${tier.color} text-white`}>
                {tier.name} Sponsors
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-6 max-w-2xl">{tier.description}</p>
            <div className={`grid gap-4 ${tier.name === "Gold" ? "grid-cols-1 sm:grid-cols-2" : tier.name === "Silver" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
              {tier.sponsors.map((sponsor) => (
                <SponsorLogo key={sponsor.id} sponsor={sponsor} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Become a Sponsor CTA */}
      <section className="bg-[#006B3C] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-white mb-4">Become a Sponsor</h2>
            {/*
              TODO: Replace this section with your actual sponsorship pitch.
              Include benefits, brand exposure stats, and why this is a worthwhile investment.
            */}
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
              {/* TODO: Update email above to real sponsorship contact */}
              Contact Us About Sponsorship
            </a>
            <p className="text-green-300 text-sm mt-3">
              {sponsorshipEmail}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
