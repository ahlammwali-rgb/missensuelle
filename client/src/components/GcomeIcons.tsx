import React, { useId } from "react";

/**
 * Gcome 3D-inspired glossy SVG icon set and layered wave backdrops
 * matching all 3 mockup screens in light and dark modes.
 */

export function GcomeMenuMoonIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="25" height="25" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`moonG-${uid}`} x1="5" y1="3" x2="23" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="50%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#4C1D95" />
        </linearGradient>
      </defs>
      <path
        d="M20.4 17.8A8.2 8.2 0 0 1 10.2 7.6a8.4 8.4 0 0 1 .9-3.6A9.1 9.1 0 1 0 24 16.9a8.4 8.4 0 0 1-3.6.9Z"
        fill={`url(#moonG-${uid})`}
      />
      <path
        d="M9.4 7.8A9 9 0 0 0 12.2 19.6"
        stroke="#DDD6FE"
        strokeOpacity="0.45"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GcomeMenuPlusIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`plusG-${uid}`} x1="5" y1="4" x2="23" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect x="11.4" y="4.5" width="5.2" height="19" rx="2.6" fill={`url(#plusG-${uid})`} />
      <rect x="4.5" y="11.4" width="19" height="5.2" rx="2.6" fill={`url(#plusG-${uid})`} />
      <rect x="12.4" y="5.6" width="1.6" height="6" rx="0.8" fill="#BBF7D0" fillOpacity="0.55" />
    </svg>
  );
}

export function GcomeMenuTeamIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="25" height="25" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`teamFront-${uid}`} x1="4" y1="5" x2="18" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id={`teamBack-${uid}`} x1="13" y1="7" x2="25" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
      <circle cx="19" cy="10.2" r="3.2" fill={`url(#teamBack-${uid})`} />
      <path d="M14.2 21.8C14.2 18.2 16.5 16 19.3 16C22.1 16 24.4 18.2 24.4 21.8V22.8H14.2V21.8Z" fill={`url(#teamBack-${uid})`} />
      <circle cx="10.8" cy="9.4" r="3.9" fill={`url(#teamFront-${uid})`} />
      <path d="M4 22.4C4 18 7 15.2 10.8 15.2C14.6 15.2 17.6 18 17.6 22.4V23.4H4V22.4Z" fill={`url(#teamFront-${uid})`} />
    </svg>
  );
}

export function GcomeMenuTruckIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`truckBody-${uid}`} x1="2" y1="7" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect x="2.6" y="7.6" width="14.6" height="11.6" rx="3" fill={`url(#truckBody-${uid})`} />
      <path d="M17.2 10.6H21.6C22.6 10.6 23.4 11.2 23.8 12.1L25.4 15.4V19.2H17.2V10.6Z" fill="#2563EB" />
      <path d="M18.8 12.2H21.8L23 14.9H18.8V12.2Z" fill="#DBEAFE" />
      <circle cx="8" cy="20.2" r="2.7" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.4" />
      <circle cx="20.8" cy="20.2" r="2.7" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.4" />
    </svg>
  );
}

export function GcomeMenuBagIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="25" height="25" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`roseBag-${uid}`} x1="5" y1="8" x2="23" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
      </defs>
      <path d="M10 10.2V8.2C10 6 11.8 4.4 14 4.4C16.2 4.4 18 6 18 8.2V10.2" stroke="#BE123C" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="5" y="9.6" width="18" height="14.6" rx="4.2" fill={`url(#roseBag-${uid})`} />
      <path d="M10.4 13.8C10.4 15.8 12 17.2 14 17.2C16 17.2 17.6 15.8 17.6 13.8" stroke="#FFE4E6" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export function GcomeMenuReturnIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="25" height="25" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`retG-${uid}`} x1="4" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
      </defs>
      <path
        d="M8.5 9.2A8.5 8.5 0 1 1 6.2 17.5"
        stroke={`url(#retG-${uid})`}
        strokeWidth="3.3"
        strokeLinecap="round"
      />
      <path d="M5.4 6.2L11.8 6.8L8.2 12.2L5.4 6.2Z" fill={`url(#retG-${uid})`} />
    </svg>
  );
}

export function GcomeMenuSheetIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="25" height="25" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sheetG-${uid}`} x1="5" y1="3" x2="23" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <path d="M7.2 4H17L22 9V22.5C22 23.6 21.1 24.5 20 24.5H7.2C6.1 24.5 5.2 23.6 5.2 22.5V6C5.2 4.9 6.1 4 7.2 4Z" fill={`url(#sheetG-${uid})`} />
      <path d="M17 4V9H22L17 4Z" fill="#A7F3D0" />
      <rect x="8.6" y="12.2" width="10" height="8" rx="1.4" fill="#FFFFFF" fillOpacity="0.95" />
      <path d="M8.6 16H18.6M13.6 12.2V20.2" stroke="#059669" strokeWidth="1.4" />
    </svg>
  );
}

export function GcomeMenuAiIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`aiG-${uid}`} x1="6" y1="4" x2="22" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      <path
        d="M14.2 4.2L16.6 10.6L23 13L16.6 15.4L14.2 21.8L11.8 15.4L5.4 13L11.8 10.6L14.2 4.2Z"
        fill={`url(#aiG-${uid})`}
      />
      <circle cx="21.5" cy="20.5" r="2.3" fill="#A855F7" />
    </svg>
  );
}

export function GcomeKpiChartIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`kChart-${uid}`} x1="3" y1="6" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#4C1D95" />
        </linearGradient>
      </defs>
      <rect x="3.8" y="14.2" width="4" height="7" rx="1.4" fill={`url(#kChart-${uid})`} fillOpacity="0.6" />
      <rect x="10.2" y="10.5" width="4" height="10.7" rx="1.4" fill={`url(#kChart-${uid})`} fillOpacity="0.82" />
      <path d="M4.6 13.6L11.4 7.8L15.4 10.8L21.4 5" stroke={`url(#kChart-${uid})`} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.8 5H21.6V9.8" stroke={`url(#kChart-${uid})`} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GcomeKpiBellIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`kBell-${uid}`} x1="7" y1="4" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path
        d="M13 4C9.5 4 7 6.7 7 10.3V14.3L5.1 17.3C4.8 17.8 5.1 18.5 5.8 18.5H20.2C20.9 18.5 21.2 17.8 20.9 17.3L19 14.3V10.3C19 6.7 16.5 4 13 4Z"
        fill={`url(#kBell-${uid})`}
      />
      <circle cx="13" cy="20.6" r="2.2" fill="#D97706" />
    </svg>
  );
}

export function GcomeKpiCheckIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`kCheck-${uid}`} x1="4" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="11" fill={`url(#kCheck-${uid})`} />
      <path d="M9.2 14.4L12.6 17.6L19 10.8" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GcomeKpiWalletIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="25" height="25" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`kWal-${uid}`} x1="3" y1="6" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect x="3.5" y="6.8" width="21" height="14.4" rx="4.2" fill={`url(#kWal-${uid})`} />
      <rect x="3.5" y="10.3" width="21" height="2.6" fill="#93C5FD" fillOpacity="0.45" />
      <circle cx="14" cy="15.8" r="3.2" fill="#EFF6FF" fillOpacity="0.96" />
      <path d="M14 14.1V17.5M12.8 15.2H15.2" stroke="#1D4ED8" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function GcomeWhatsAppLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#16A34A" />
      <path d="M6.2 19.6L7.4 15.8A7.6 7.6 0 1 1 10 18.4L6.2 19.6Z" fill="#16A34A" />
      <path
        d="M9.3 8.2C9.5 7.7 9.9 7.7 10.2 7.7C10.5 7.7 10.7 8.1 10.9 8.5C11.1 8.9 11.4 9.5 11.2 9.8C11 10.1 10.6 10.4 10.6 10.7C10.6 11 11.3 12 12.1 12.6C12.9 13.3 13.7 13.6 14 13.6C14.3 13.6 14.6 13.1 14.9 12.8C15.2 12.5 15.5 12.6 15.8 12.8C16.1 13 17 13.4 17.2 13.6C17.4 13.8 17.4 14.5 17 15.1C16.6 15.7 15.5 16.2 14.6 16C13.3 15.7 11.6 14.8 10.4 13.6C9.2 12.4 8.3 10.9 8.1 9.8C8 8.9 8.9 8.5 9.3 8.2Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function GcomeBottomWaveBar() {
  const uid = useId().replace(/:/g, "");
  return (
    <div className="gcome-bottom-wave-backdrop" aria-hidden="true">
      <svg className="gcome-wave-bg-bottom" viewBox="0 0 430 110" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id={`wbSoft-${uid}`} x1="0" y1="0" x2="430" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DDD6FE" stopOpacity="0.22" />
            <stop offset="50%" stopColor="#C4B5FD" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#DDD6FE" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <path d="M0 45C95 18 190 48 295 34C360 25 400 32 430 42V110H0V45Z" fill={`url(#wbSoft-${uid})`} />
      </svg>
    </div>
  );
}

export function GcomeMenuWaves() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg className="gcome-menu-wave-svg" viewBox="0 0 430 165" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`mwPeach-${uid}`} x1="165" y1="15" x2="365" y2="145" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.58" />
          <stop offset="55%" stopColor="#FB923C" stopOpacity="0.68" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id={`mwPurple-${uid}`} x1="210" y1="75" x2="430" y2="165" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333EA" stopOpacity="0.25" />
          <stop offset="48%" stopColor="#6D28D9" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#4C1D95" stopOpacity="0.96" />
        </linearGradient>
        <linearGradient id={`mwTopMist-${uid}`} x1="0" y1="0" x2="220" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#F5F3FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Left soft lilac corner whisper */}
      <path d="M0 0H185C120 48 62 72 0 105V0Z" fill={`url(#mwTopMist-${uid})`} />
      {/* Warm sweeping peach/gold arc matching right screen top */}
      <path d="M180 165C228 112 268 78 332 52C374 34 406 20 430 0V165H180Z" fill={`url(#mwPeach-${uid})`} />
      {/* Bold royal violet wave crest rising from lower-right edge */}
      <path d="M235 165C298 114 352 104 430 62V165H235Z" fill={`url(#mwPurple-${uid})`} />
      <path d="M206 165C264 134 326 122 396 140C412 144 422 152 430 165H206Z" fill="#DDD6FE" fillOpacity="0.45" />
    </svg>
  );
}
