import React, { useId } from "react";

/**
 * Gcome 3D-inspired glossy SVG icon set and layered wave backdrops
 * matching the 3-screen SaaS visual design without external image dependencies.
 */

export function GcomeMenuMoonIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`moonG-${uid}`} x1="6" y1="4" x2="22" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      <path
        d="M19.8 17.6A7.8 7.8 0 0 1 10.4 8.2a7.9 7.9 0 0 1 .9-3.6A8.6 8.6 0 1 0 23.4 16.7a7.8 7.8 0 0 1-3.6.9Z"
        fill={`url(#moonG-${uid})`}
      />
      <path
        d="M19.5 6.2L20.3 8.1L22.2 8.9L20.3 9.7L19.5 11.6L18.7 9.7L16.8 8.9L18.7 8.1L19.5 6.2Z"
        fill="#A855F7"
      />
    </svg>
  );
}

export function GcomeMenuPlusIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`plusG-${uid}`} x1="5" y1="4" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect x="10.7" y="4" width="4.6" height="18" rx="2.3" fill={`url(#plusG-${uid})`} />
      <rect x="4" y="10.7" width="18" height="4.6" rx="2.3" fill={`url(#plusG-${uid})`} />
    </svg>
  );
}

export function GcomeMenuTeamIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`teamFront-${uid}`} x1="5" y1="6" x2="18" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id={`teamBack-${uid}`} x1="13" y1="8" x2="24" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <circle cx="19" cy="10.5" r="3" fill={`url(#teamBack-${uid})`} />
      <path d="M14.5 21.5C14.5 18 16.7 16 19.3 16C21.9 16 24 18 24 21.5V22.5H14.5V21.5Z" fill={`url(#teamBack-${uid})`} />
      <circle cx="11" cy="9.5" r="3.6" fill={`url(#teamFront-${uid})`} />
      <path d="M4.5 22C4.5 17.8 7.3 15.2 11 15.2C14.7 15.2 17.5 17.8 17.5 22V23H4.5V22Z" fill={`url(#teamFront-${uid})`} />
    </svg>
  );
}

export function GcomeMenuTruckIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`truckBody-${uid}`} x1="3" y1="7" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect x="3" y="8" width="14" height="11" rx="2.8" fill={`url(#truckBody-${uid})`} />
      <path d="M17 11H21.2C22.2 11 23 11.6 23.4 12.5L24.8 15.4V19H17V11Z" fill="#2563EB" />
      <path d="M18.6 12.6H21.4L22.5 15H18.6V12.6Z" fill="#DBEAFE" />
      <circle cx="8" cy="20.2" r="2.6" fill="#1E293B" stroke="#FFFFFF" strokeWidth="1.2" />
      <circle cx="20.5" cy="20.2" r="2.6" fill="#1E293B" stroke="#FFFFFF" strokeWidth="1.2" />
    </svg>
  );
}

export function GcomeMenuBagIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="23" height="23" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`roseBag-${uid}`} x1="6" y1="8" x2="22" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
      </defs>
      <path d="M10.2 10.2V8.5C10.2 6.4 11.9 4.8 14 4.8C16.1 4.8 17.8 6.4 17.8 8.5V10.2" stroke="#BE123C" strokeWidth="2.3" strokeLinecap="round" />
      <rect x="5.5" y="9.8" width="17" height="14" rx="4" fill={`url(#roseBag-${uid})`} />
      <path d="M10.5 13.8C10.5 15.6 12.1 17 14 17C15.9 17 17.5 15.6 17.5 13.8" stroke="#FFE4E6" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function GcomeMenuReturnIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="23" height="23" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`retG-${uid}`} x1="5" y1="5" x2="23" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
      </defs>
      <path
        d="M9.2 10.5H15.8C19.3 10.5 22 13.2 22 16.5C22 19.8 19.3 22.4 15.8 22.4H10.5"
        stroke={`url(#retG-${uid})`}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path d="M11.6 6.4L6.2 10.5L11.6 14.6V6.4Z" fill={`url(#retG-${uid})`} />
    </svg>
  );
}

export function GcomeMenuSheetIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="23" height="23" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sheetG-${uid}`} x1="6" y1="4" x2="22" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <path d="M7.5 4.2H16.8L21.5 8.9V22.2C21.5 23.3 20.6 24.2 19.5 24.2H7.5C6.4 24.2 5.5 23.3 5.5 22.2V6.2C5.5 5.1 6.4 4.2 7.5 4.2Z" fill={`url(#sheetG-${uid})`} />
      <path d="M16.8 4.2V8.9H21.5L16.8 4.2Z" fill="#A7F3D0" />
      <rect x="8.8" y="12.2" width="9.4" height="7.6" rx="1.2" fill="#FFFFFF" fillOpacity="0.92" />
      <path d="M8.8 15.8H18.2M13.5 12.2V19.8" stroke="#059669" strokeWidth="1.3" />
    </svg>
  );
}

export function GcomeMenuAiIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="23" height="23" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`aiG-${uid}`} x1="5" y1="4" x2="23" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FDE047" />
        </linearGradient>
      </defs>
      <path
        d="M14.2 4.5L16.3 10.4L22.2 12.5L16.3 14.6L14.2 20.5L12.1 14.6L6.2 12.5L12.1 10.4L14.2 4.5Z"
        fill={`url(#aiG-${uid})`}
      />
      <circle cx="21" cy="20" r="2.2" fill="#FDE047" />
      <circle cx="7.5" cy="19.5" r="1.4" fill="#FFFFFF" fillOpacity="0.9" />
    </svg>
  );
}

export function GcomeKpiChartIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`kChart-${uid}`} x1="4" y1="6" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#4C1D95" />
        </linearGradient>
      </defs>
      <rect x="4" y="14" width="3.8" height="7" rx="1.4" fill={`url(#kChart-${uid})`} fillOpacity="0.65" />
      <rect x="10.2" y="10.5" width="3.8" height="10.5" rx="1.4" fill={`url(#kChart-${uid})`} fillOpacity="0.82" />
      <path d="M5 13.5L11.5 8L15.2 11L21 5.2" stroke={`url(#kChart-${uid})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.8 5.2H21.2V9.6" stroke={`url(#kChart-${uid})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GcomeKpiBellIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`kBell-${uid}`} x1="7" y1="4" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path
        d="M13 4.2C9.6 4.2 7.2 6.8 7.2 10.3V14.2L5.3 17.2C5 17.7 5.3 18.3 5.9 18.3H20.1C20.7 18.3 21 17.7 20.7 17.2L18.8 14.2V10.3C18.8 6.8 16.4 4.2 13 4.2Z"
        fill={`url(#kBell-${uid})`}
      />
      <circle cx="13" cy="20.4" r="2.1" fill="#D97706" />
    </svg>
  );
}

export function GcomeKpiCheckIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`kCheck-${uid}`} x1="4" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="10.5" fill={`url(#kCheck-${uid})`} />
      <path d="M9.4 14.4L12.6 17.5L18.8 10.9" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GcomeKpiWalletIcon() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width="23" height="23" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`kWal-${uid}`} x1="4" y1="6" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect x="4" y="7" width="20" height="14" rx="4" fill={`url(#kWal-${uid})`} />
      <rect x="4" y="10.5" width="20" height="2.6" fill="#93C5FD" fillOpacity="0.45" />
      <circle cx="14" cy="15.8" r="3" fill="#EFF6FF" fillOpacity="0.95" />
      <path d="M14 14.2V17.4M12.9 15.2H15.1" stroke="#1D4ED8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function GcomeWhatsAppLogo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#16A34A" />
      <path d="M6.2 19.6L7.4 15.8A7.6 7.6 0 1 1 10 18.4L6.2 19.6Z" fill="#16A34A" />
      <path
        d="M9.3 8.2C9.5 7.7 9.9 7.7 10.2 7.7C10.5 7.7 10.7 8.1 10.9 8.5C11.1 8.9 11.4 9.5 11.2 9.8C11 10.1 10.6 10.4 10.6 10.7C10.6 11 11.3 12 12.1 12.6C12.9 13.3 13.7 13.6 14 13.6C14.3 13.6 14.6 13.1 14.9 12.8C15.2 12.5 15.5 12.6 15.8 12.8C16.1 13 17 13.4 17.2 13.6C17.4 13.8 17.4 14.5 17 15.1C16.6 15.7 15.5 16.2 14.6 16C13.3 15.7 11.6 14.8 10.4 13.6C9.2 12.4 8.3 10.9 8.1 9.8C8 8.9 8.9 8.5 9.3 8.2Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function GcomeShellWaves() {
  const uid = useId().replace(/:/g, "");
  return (
    <div className="gcome-backdrop-waves" aria-hidden="true">
      <svg className="gcome-wave-bg-top" viewBox="0 0 430 200" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id={`wtPurple-${uid}`} x1="0" y1="0" x2="290" y2="160" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6D28D9" stopOpacity="0.88" />
            <stop offset="52%" stopColor="#9333EA" stopOpacity="0.62" />
            <stop offset="100%" stopColor="#C084FC" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`wtGold-${uid}`} x1="0" y1="90" x2="430" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FACC15" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#EC4899" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        <path d="M0 0H265C220 48 158 55 102 104C58 142 26 166 0 178V0Z" fill={`url(#wtPurple-${uid})`} />
        <path d="M0 125C48 112 92 78 135 45C178 12 225 4 275 0H185C130 28 84 62 38 92C18 105 8 112 0 116V125Z" fill={`url(#wtGold-${uid})`} />
        <path d="M275 0H430V116C390 88 358 64 316 42C292 29 282 14 275 0Z" fill={`url(#wtGold-${uid})`} fillOpacity="0.72" />
      </svg>

      <svg className="gcome-wave-bg-bottom" viewBox="0 0 430 165" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id={`wbMain-${uid}`} x1="0" y1="165" x2="430" y2="25" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.92" />
            <stop offset="28%" stopColor="#EC4899" stopOpacity="0.82" />
            <stop offset="68%" stopColor="#6D28D9" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#4C1D95" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id={`wbAccent-${uid}`} x1="0" y1="90" x2="430" y2="155" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" stopOpacity="0.86" />
            <stop offset="45%" stopColor="#A855F7" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#5B21B6" stopOpacity="0.88" />
          </linearGradient>
        </defs>
        <path d="M0 74C75 34 152 62 228 86C305 110 368 84 430 34V165H0V74Z" fill={`url(#wbMain-${uid})`} />
        <path d="M0 108C85 138 175 88 265 72C340 58 392 86 430 105V165H0V108Z" fill={`url(#wbAccent-${uid})`} />
      </svg>
    </div>
  );
}

export function GcomeMenuWaves() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg className="gcome-menu-wave-svg" viewBox="0 0 430 155" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`mwPurple-${uid}`} x1="180" y1="15" x2="430" y2="145" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.18" />
          <stop offset="45%" stopColor="#7C3AED" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#4C1D95" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={`mwGold-${uid}`} x1="200" y1="0" x2="430" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#F59E0B" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#EA580C" stopOpacity="0.65" />
        </linearGradient>
      </defs>
      <path d="M210 155C265 112 316 86 372 48C398 30 416 14 430 0V155H210Z" fill={`url(#mwGold-${uid})`} />
      <path d="M242 155C302 108 358 98 430 68V155H242Z" fill={`url(#mwPurple-${uid})`} />
      <path d="M0 0H120C82 34 45 48 0 64V0Z" fill="#7C3AED" fillOpacity="0.22" />
    </svg>
  );
}
