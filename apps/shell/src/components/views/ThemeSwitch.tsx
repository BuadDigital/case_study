"use client";

import { useEffect, useState } from "react";
import { cn } from "@platform/design-system";

type ThemeName = "navy" | "dark";

function applyTheme(name: ThemeName) {
  const root = document.documentElement;
  if (name === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  try {
    localStorage.setItem("ejada_theme", name);
  } catch {
    /* ignore */
  }
}

function ThemeSwatch({
  label,
  active,
  bars,
  onClick,
  variant,
}: {
  label: string;
  active: boolean;
  bars: [string, string, string];
  onClick: () => void;
  variant: "menu" | "sidebar";
}) {
  const sidebar = variant === "sidebar";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 cursor-pointer flex-col gap-1.5 rounded-[9px] border p-[7px] transition-[border-color,box-shadow]",
        sidebar
          ? active
            ? "border-[#c2a878] shadow-[0_0_0_2px_rgba(194,168,120,0.28)]"
            : "border-white/15 hover:border-white/35"
          : active
            ? "border-gold shadow-[0_0_0_2px_color-mix(in_srgb,var(--gold)_28%,transparent)]"
            : "border-border-md hover:border-text-3",
      )}
    >
      <span className="flex h-6 overflow-hidden rounded-md">
        {bars.map((b, i) => (
          <span key={i} className="flex-1" style={{ background: b }} />
        ))}
      </span>
      <span
        className={cn(
          "text-[11.5px] font-bold",
          sidebar
            ? active
              ? "text-[#c2a878]"
              : "text-white/65"
            : active
              ? "text-gold-d"
              : "text-text-2",
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function ThemeSwitch({
  variant = "menu",
}: {
  variant?: "menu" | "sidebar";
}) {
  const [theme, setTheme] = useState<ThemeName>("navy");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("ejada_theme");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync initial UI with the persisted theme after mount.
    setTheme(saved === "dark" ? "dark" : "navy");
  }, []);

  function choose(name: ThemeName) {
    setTheme(name);
    applyTheme(name);
  }

  const sidebar = variant === "sidebar";

  return (
    <div className={cn(sidebar ? "px-1 pb-1 pt-1.5" : "px-1.5 pb-1 pt-1")}>
      <div
        className={cn(
          "px-2.5 pb-1.5 pt-1 text-[11px] font-bold",
          sidebar ? "text-[#6f7b90]" : "text-text-3",
        )}
      >
        ثيم النظام
      </div>
      <div className="flex gap-2 px-1">
        <ThemeSwatch
          label="فاتح"
          active={theme === "navy"}
          bars={["#ffffff", "#102b4e", "#a4906f"]}
          variant={variant}
          onClick={() => choose("navy")}
        />
        <ThemeSwatch
          label="داكن"
          active={theme === "dark"}
          bars={["#161d2a", "#122844", "#c2a878"]}
          variant={variant}
          onClick={() => choose("dark")}
        />
      </div>
    </div>
  );
}
