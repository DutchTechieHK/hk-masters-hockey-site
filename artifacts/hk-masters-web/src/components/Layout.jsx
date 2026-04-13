import { useState } from "react";
import { Link, useLocation } from "wouter";
import contactContent from "../content/contact.json";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/teams", label: "Teams" },
  { href: "/events", label: "Events" },
  { href: "/rotterdam-2026", label: "Rotterdam 2026" },
  { href: "/media", label: "Media" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/contact", label: "Contact" },
];

function NavLink({ href, label, onClick }) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`nav-link text-base font-medium transition-colors duration-150 hover:text-red-600 ${
        isActive ? "text-red-600 active" : "text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="bg-[#006B3C] shadow-md sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-20 w-20 rounded-lg bg-white shrink-0 overflow-hidden flex items-center justify-center">
                <img
                  src={`${import.meta.env.BASE_URL}logo.png`}
                  alt="HK Masters Hockey logo"
                  className="w-full h-full object-contain scale-150"
                />
              </div>
              <div className="leading-tight">
                <p className="text-white font-extrabold text-lg sm:text-xl leading-none">Hong Kong</p>
                <p className="text-green-200 text-sm font-semibold leading-none mt-1">Masters Hockey</p>
                <p className="text-[#DE2910] text-xs font-semibold italic leading-none mt-3 tracking-wide">— Hockey For Life —</p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.href} href={link.href} label={link.label} />
              ))}
            </div>

            {/* Mobile Hamburger */}
            <button
              className="lg:hidden p-2 text-white focus:outline-none"
              aria-label="Toggle navigation menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          {menuOpen && (
            <div className="lg:hidden border-t border-green-600 py-3 pb-4">
              <div className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    onClick={() => setMenuOpen(false)}
                  />
                ))}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#004A2A] text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Club Info */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-12 w-12 rounded-lg bg-white shrink-0 overflow-hidden flex items-center justify-center">
                  <img
                    src={`${import.meta.env.BASE_URL}logo.png`}
                    alt="HK Masters Hockey logo"
                    className="w-full h-full object-contain scale-150"
                  />
                </div>
                <span className="font-bold text-white">Hong Kong Masters Hockey</span>
              </div>
              <p className="text-[#DE2910] text-sm font-semibold italic mb-2">Hockey For Life</p>
              <p className="text-green-200 text-sm leading-relaxed">
                Promoting field hockey excellence and sportsmanship among masters-age players in Hong Kong.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-white mb-3">Quick Links</h3>
              <div className="grid grid-cols-2 gap-x-4">
                {[NAV_LINKS.slice(0, 4), NAV_LINKS.slice(4)].map((col, ci) => (
                  <ul key={ci} className="space-y-1">
                    {col.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="text-green-200 text-sm hover:text-white transition-colors duration-150">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>

            {/* Contact & Social */}
            <div>
              <h3 className="font-semibold text-white mb-3">Get in Touch</h3>
              <a href={`mailto:${contactContent.email}`} className="text-green-200 text-sm hover:text-white transition-colors duration-150 block mb-3">
                {contactContent.email}
              </a>
              <div className="flex gap-3">
                {contactContent.social.facebook && (
                  <a href={contactContent.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-green-200 hover:text-white transition-colors duration-150">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
                    </svg>
                  </a>
                )}
                {contactContent.social.instagram && (
                  <a href={contactContent.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-green-200 hover:text-white transition-colors duration-150">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"/>
                    </svg>
                  </a>
                )}
                {contactContent.social.twitter && (
                  <a href={contactContent.social.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter/X" className="text-green-200 hover:text-white transition-colors duration-150">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                )}
                {contactContent.social.youtube && (
                  <a href={contactContent.social.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-green-200 hover:text-white transition-colors duration-150">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-green-700 text-center">
            <p className="text-white font-bold italic text-base mb-2 tracking-wide">Hockey For Life</p>
            <p className="text-green-300 text-xs">
              &copy; 2026 Hong Kong Masters Hockey. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
