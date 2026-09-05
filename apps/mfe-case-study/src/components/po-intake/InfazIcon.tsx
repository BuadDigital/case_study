"use client";

/** Line icons for the Infath upload assistant. */

import type { InfazIconName } from "./property-detail-enfath-upload-state";

export function InfazIcon({
  name,
  className,
}: {
  name: InfazIconName;
  className?: string;
}) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "copy":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "paperclip":
      return (
        <svg {...common}>
          <path d="m16 6-8.5 8.5a3 3 0 1 0 4.24 4.24L20.24 10a5 5 0 0 0-7.07-7.07L5.5 10.5" />
        </svg>
      );
    case "expand":
      return (
        <svg {...common}>
          <path d="M15 3h6v6" />
          <path d="m21 3-7 7" />
          <path d="M9 21H3v-6" />
          <path d="m3 21 7-7" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...common}>
          <path d="M4 14h6v6" />
          <path d="m10 20-7-7" />
          <path d="M20 10h-6V4" />
          <path d="m14 4 7 7" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      );
    case "appraisal":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2Z" />
          <path d="M9 4v14" />
          <path d="M15 6v14" />
        </svg>
      );
    case "photo":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m21 17-5-5-4 4-2-2-5 5" />
        </svg>
      );
    case "plan":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M4 10h16" />
          <path d="M10 4v16" />
        </svg>
      );
    case "deed":
      return (
        <svg {...common}>
          <path d="M12 3 4 7v6c0 4.4 3.6 8 8 8s8-3.6 8-8V7Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="4" />
          <path d="m11.5 12.5 9.5 10.5" />
          <path d="M13 8h5" />
          <path d="M16 5v6" />
        </svg>
      );
    default:
      return null;
  }
}
