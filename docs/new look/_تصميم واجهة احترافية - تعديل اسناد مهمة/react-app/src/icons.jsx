// Lightweight inline stroke icons (no dependency). Each accepts { size, className, strokeWidth }.
import React from 'react';

const S = ({ size = 18, sw = 1.7, className = '', children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const Grid = (p) => (
  <S {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></S>
);
export const Clipboard = (p) => (
  <S {...p}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h6" /></S>
);
export const ClipCheck = (p) => (
  <S {...p}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></S>
);
export const List = (p) => (
  <S {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></S>
);
export const Activity = (p) => (
  <S {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></S>
);
export const Pin = (p) => (
  <S {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></S>
);
export const Key = (p) => (
  <S {...p}><circle cx="7.5" cy="15.5" r="5.5" /><path d="m11.5 11.5 9.5-9.5M15.5 7.5l3 3" /></S>
);
export const Alert = (p) => (
  <S {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></S>
);
export const Clock = (p) => (
  <S {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></S>
);
export const Book = (p) => (
  <S {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></S>
);
export const Monitor = (p) => (
  <S {...p}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></S>
);
export const BarChart = (p) => (
  <S {...p}><path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" /></S>
);
export const TrendUp = (p) => (
  <S {...p}><path d="M22 7 13.5 15.5l-5-5L2 17" /><path d="M16 7h6v6" /></S>
);
export const Wallet = (p) => (
  <S {...p}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></S>
);
export const Database = (p) => (
  <S {...p}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></S>
);
export const Settings = (p) => (
  <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></S>
);
export const Search = (p) => (
  <S {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></S>
);
export const ChevronLeft = (p) => (
  <S {...p}><path d="m15 18-6-6 6-6" /></S>
);
export const ChevronRight = (p) => (
  <S {...p}><path d="m9 18 6-6-6-6" /></S>
);
export const ChevronDown = (p) => (
  <S {...p}><path d="m6 9 6 6 6-6" /></S>
);
export const Download = (p) => (
  <S {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></S>
);
export const Bell = (p) => (
  <S {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></S>
);
export const Logout = (p) => (
  <S {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></S>
);
export const Plus = (p) => (
  <S {...p}><path d="M12 5v14M5 12h14" /></S>
);
export const Building = (p) => (
  <S {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></S>
);
export const Layers = (p) => (
  <S {...p}><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></S>
);
export const CheckCircle = (p) => (
  <S {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></S>
);
