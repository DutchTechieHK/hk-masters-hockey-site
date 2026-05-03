import { useEffect } from "react";
import FundraisingThermometer from "../components/FundraisingThermometer";
import PledgeForm from "../components/PledgeForm";

const TIERS = [
  {
    name: "Supporter",
    amount: "HK$500",
    blurb: "Your name added to the team's official supporter wall.",
  },
  {
    name: "Friend of the Team",
    amount: "HK$1,000",
    blurb: "Supporter wall + a personal thank-you from the team captains.",
  },
  {
    name: "Patron",
    amount: "HK$2,500",
    blurb: "Friend benefits + a signed team photo from Rotterdam.",
  },
  {
    name: "Major Sponsor",
    amount: "HK$5,000+",
    blurb: "All of the above + recognition on the public website and team kit (subject to design approval).",
  },
];

const REASONS = [
  {
    title: "Tournament entry & officials",
    body: "Two HK squads competing at the World Masters Hockey Cup — entry fees, umpiring, and tournament administration.",
  },
  {
    title: "Travel & accommodation",
    body: "Flights to Rotterdam, accommodation for ~36 players plus coaches and managers across 11 days of competition.",
  },
  {
    title: "Kit & equipment",
    body: "Match kit, training kit, training equipment, and team merchandise so the squads represent HK with pride.",
  },
];

export default function Support() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Rotterdam 2026
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">
            Support the Team
          </h1>
          <p className="text-green-200 text-lg max-w-2xl leading-relaxed">
            Help send Hong Kong's MO40 and MO50 squads to the World Masters Hockey Cup —
            22 July to 1 August 2026, Rotterdam.
          </p>
        </div>
      </div>

      {/* Thermometer + Pledge */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Where We Are</h2>
            <p className="text-gray-600 text-sm mb-6">
              Real-time fundraising progress for the Rotterdam 2026 campaign.
            </p>
            <FundraisingThermometer />

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
              <h3 className="font-bold text-gray-900 mb-3">Why we're raising funds</h3>
              <ul className="space-y-3">
                {REASONS.map((r) => (
                  <li key={r.title} className="flex gap-3">
                    <div className="w-2 h-2 bg-[#006B3C] rounded-full mt-2 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{r.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pledge Your Support</h2>
            <p className="text-gray-600 text-sm mb-6">
              No payment is taken now — a team member will follow up with you directly with
              bank transfer details.
            </p>
            <PledgeForm />
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="bg-[#006B3C]/5 border-y border-[#006B3C]/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Supporter Tiers</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Every contribution makes a difference. Here's how we'll thank you for backing
              the team.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="bg-white rounded-2xl p-6 border border-[#006B3C]/10 shadow-sm flex flex-col"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-[#006B3C] mb-2">
                  {tier.name}
                </p>
                <p className="text-2xl font-extrabold text-gray-900 mb-3">{tier.amount}</p>
                <p className="text-sm text-gray-600 leading-relaxed flex-1">{tier.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Corporate sponsorship CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-[#006B3C] rounded-2xl p-8 sm:p-10 text-white text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Looking to sponsor the team?
          </h2>
          <p className="text-green-100 max-w-2xl mx-auto mb-6 leading-relaxed">
            We work with corporate partners on tailored sponsorship packages — kit
            branding, event hospitality, and brand exposure across our public channels
            during the Rotterdam 2026 campaign.
          </p>
          <a
            href="mailto:sponsorship@hkmastershockey.com?subject=Rotterdam%202026%20sponsorship"
            className="inline-block bg-white text-[#006B3C] font-bold px-8 py-3 rounded-lg hover:bg-green-50 transition-colors duration-150"
          >
            Talk to us about sponsorship →
          </a>
        </div>
      </section>
    </div>
  );
}
