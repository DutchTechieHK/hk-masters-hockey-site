export default function GetTheApp() {
  const videoUrl = `${window.location.origin}/pwa-install-video/`;

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#1E3A6E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold mb-3">Get the App</h1>
          <p className="text-[#BFD9F5] text-lg max-w-xl">
            Install the HK Masters Hockey player portal on your phone — no App Store required.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {/* Intro blurb */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1E3A6E]/10 mb-4">
            <svg className="w-7 h-7 text-[#1E3A6E]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-3 3h3" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#1E3A6E] mb-3">Install in seconds — works on iPhone &amp; Android</h2>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
            The HK Masters portal is a Progressive Web App (PWA). That means you can add it directly to your home screen
            from your browser — it opens instantly, works offline, and feels just like a native app.
            Watch the short video below to see exactly how it's done.
          </p>
        </div>

        {/* Video embed */}
        <div className="rounded-2xl overflow-hidden border border-[#D9C9A8] shadow-lg mb-8 bg-[#1E3A6E]">
          <div className="relative" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={videoUrl}
              title="How to Install the HK Masters App"
              className="absolute inset-0 w-full h-full border-0"
              allow="autoplay"
              loading="lazy"
            />
          </div>
        </div>

        {/* Direct link */}
        <div className="text-center mb-14">
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#1E3A6E] hover:text-[#16305D] hover:underline transition-colors duration-150"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open full-screen install guide
          </a>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: "1",
              title: "Open in your browser",
              body: "Visit the player portal in Safari (iPhone) or Chrome (Android). Make sure you're using the browser, not a social media in-app browser.",
            },
            {
              step: "2",
              title: "Tap Share / Menu",
              body: "On iPhone, tap the Share icon at the bottom of Safari. On Android, tap the three-dot menu in Chrome.",
            },
            {
              step: "3",
              title: "Add to Home Screen",
              body: "Select \"Add to Home Screen\", give it a name, and tap Add. The app icon will appear on your home screen ready to launch.",
            },
          ].map(({ step, title, body }) => (
            <div key={step} className="bg-[#EEF4FB] rounded-xl p-6 border border-[#BFD9F5]">
              <div className="w-9 h-9 rounded-full bg-[#1E3A6E] text-white text-sm font-bold flex items-center justify-center mb-4">
                {step}
              </div>
              <h3 className="font-semibold text-[#1E3A6E] mb-2">{title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* CTA to portal */}
        <div className="mt-14 text-center">
          <a
            href={`${import.meta.env.BASE_URL}login`}
            className="btn-shimmer inline-flex items-center gap-2 bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
          >
            Go to the Player Portal
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
