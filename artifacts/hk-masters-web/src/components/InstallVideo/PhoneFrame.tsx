import { ReactNode } from 'react';

interface PhoneFrameProps {
  variant?: 'ios' | 'android';
  children: ReactNode;
  className?: string;
}

export function PhoneFrame({ variant = 'ios', children, className = '' }: PhoneFrameProps) {
  const isIos = variant === 'ios';

  return (
    <div className={`relative ${className}`} style={{ width: 300, height: 620 }}>
      <svg
        viewBox="0 0 300 620"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        style={{ filter: 'drop-shadow(0 32px 64px rgba(0,0,0,0.7))' }}
      >
        <rect x="1" y="1" width="298" height="618" rx="47" ry="47"
          fill={isIos ? '#1a1a1e' : '#1e1e24'}
          stroke={isIos ? '#3a3a45' : '#2e2e38'}
          strokeWidth="2"
        />
        <rect x="1" y="60" width="2.5" height="80" rx="1.25" fill="#4a4a55" />
        <rect x="1" y="160" width="2.5" height="120" rx="1.25" fill="#4a4a55" />
        <rect x="1" y="300" width="2.5" height="120" rx="1.25" fill="#3a3a45" />
        <rect x="296.5" y="120" width="2.5" height="70" rx="1.25" fill="#4a4a55" />
        <rect x="10" y="10" width="280" height="600" rx="40" ry="40"
          fill={isIos ? '#0a0a0f' : '#0e0e14'}
        />
        <rect x="10" y="10" width="280" height="600" rx="40" ry="40"
          fill="url(#gloss)"
          opacity="0.04"
        />
        <rect x="12" y="12" width="276" height="596" rx="38" ry="38"
          fill="transparent"
        />
        {isIos ? (
          <>
            <rect x="108" y="20" width="84" height="28" rx="14" fill="#0a0a0f" />
            <circle cx="176" cy="34" r="5" fill="#1a1a20" />
            <circle cx="176" cy="34" r="3" fill="#111115" />
            <circle cx="177" cy="33" r="1" fill="#2a2a30" opacity="0.6" />
          </>
        ) : (
          <circle cx="150" cy="28" r="9" fill="#0a0a0f" />
        )}
        {isIos ? (
          <rect x="115" y="598" width="70" height="4" rx="2" fill="#ffffff" opacity="0.25" />
        ) : (
          <rect x="130" y="600" width="40" height="3" rx="1.5" fill="#ffffff" opacity="0.18" />
        )}
        <defs>
          <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="60%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div
        className="absolute overflow-hidden"
        style={{ top: 12, left: 12, right: 12, bottom: 12, borderRadius: 38 }}
      >
        {children}
      </div>
    </div>
  );
}
