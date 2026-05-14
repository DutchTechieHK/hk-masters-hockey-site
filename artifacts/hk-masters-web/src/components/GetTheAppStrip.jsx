import { Link } from "wouter";

export default function GetTheAppStrip() {
  return (
    <div className="bg-[#16305D] border-t border-[#2A5298]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-3 3h3" />
              </svg>
            </div>
            <p className="text-white text-sm font-medium">
              Install the HK Masters app on your phone —{" "}
              <span className="text-[#BFD9F5]">no App Store needed, works on iPhone &amp; Android.</span>
            </p>
          </div>
          <Link
            href="/get-the-app"
            className="shrink-0 inline-flex items-center gap-1.5 bg-white text-[#1E3A6E] text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#EEF4FB] transition-colors duration-150 whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            How to install &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
