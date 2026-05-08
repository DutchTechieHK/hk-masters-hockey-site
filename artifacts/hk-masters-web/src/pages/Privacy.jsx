export default function Privacy() {
  return (
    <div>
      <section className="bg-[#1E3A6E] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Privacy &amp; Data Handling
          </h1>
          <p className="text-[#BFD9F5] text-lg">
            How Hong Kong Masters Hockey collects, stores and protects information for the
            Rotterdam 2026 Masters World Cup.
          </p>
          <p className="text-[#8FBDE8] text-sm mt-4">Last updated: May 2026</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-gray-700 leading-relaxed [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-2 [&_li]:leading-relaxed [&_a]:text-[#1E3A6E] [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-[#16305D] [&_strong]:text-gray-900">
        <h2>Who we are</h2>
        <p>
          Hong Kong Masters Hockey ("we", "us") is an unincorporated team association
          fielding the MO40 and MO50 squads at the World Masters Hockey Cup,
          Rotterdam, 22 July – 1 August 2026. You can reach us at{" "}
          <a href="mailto:hello@hkmastershockey.com">hello@hkmastershockey.com</a>.
        </p>

        <h2>What we collect</h2>
        <p>
          To run the tour we collect information directly from players, supporters and
          contributors:
        </p>
        <ul>
          <li>
            <strong>Player tour data:</strong> name, contact details, date of birth,
            nationality, passport number and expiry, emergency contact, flight and room
            sharing details, kit sizes, dietary requirements, medical notes, fee
            payment status.
          </li>
          <li>
            <strong>Supporter data:</strong> name, email and pledge amount when you
            submit a pledge or sign up to support the team.
          </li>
          <li>
            <strong>Contributor data:</strong> name and email when you submit a journal
            article, photo or media item.
          </li>
        </ul>

        <h2>Why we collect it</h2>
        <ul>
          <li>To register squads and players with the tournament organisers.</li>
          <li>To coordinate travel, accommodation, kit, fees and emergency response.</li>
          <li>To communicate match details, deadlines and reminders.</li>
          <li>To acknowledge supporters and report on fundraising progress.</li>
        </ul>

        <h2>How we store and protect it</h2>
        <ul>
          <li>
            Player data is stored in a database accessible only to the tour management
            team via an authenticated admin app.
          </li>
          <li>
            Public-facing pages (squad lists, schedule, journal) only show non-sensitive
            information: name, shirt number and role. Passport, contact, flight and
            medical details are never shown publicly.
          </li>
          <li>
            Each player receives a private, single-purpose link to view and update their
            own details. The link can be rotated by the tour manager if it is ever
            shared by mistake.
          </li>
          <li>
            We use Resend for outbound email and Replit for hosting. We do not sell or
            share your data with third parties beyond what is necessary to run the tour
            (e.g. tournament registration, team travel agent).
          </li>
        </ul>

        <h2>How long we keep it</h2>
        <p>
          Player tour data is retained for the duration of the tournament and for up to
          90 days after the closing ceremony for reconciliation, then deleted or
          anonymised. Aggregated, non-identifying records (e.g. final fundraising
          totals, match results, journal articles) may be retained indefinitely as part
          of the team's history.
        </p>
        <p>
          Supporter and contributor records are retained while the team remains active.
          You can ask us to delete your record at any time.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask us to show you, correct or delete the information we hold about
          you at any time by emailing{" "}
          <a href="mailto:hello@hkmastershockey.com">hello@hkmastershockey.com</a>. If
          you are a player, you can also update most fields yourself using your private
          self-edit link.
        </p>

        <h2>Cookies</h2>
        <p>
          The public site uses no marketing or tracking cookies. The admin app stores a
          short-lived session token in your browser to keep you signed in.
        </p>

        <h2>Updates to this notice</h2>
        <p>
          We may update this notice as the tour evolves. Material changes will be flagged
          on this page with a new "Last updated" date.
        </p>
      </section>
    </div>
  );
}
