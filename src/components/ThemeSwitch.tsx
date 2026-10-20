"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { S } from "@/lib/strings";

type Pref = "system" | "light" | "dark";
const KEY = "layerling-workshop.theme";

function apply(pref: Pref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function ThemeSwitch() {
  const [pref, setPref] = useState<Pref>("system");

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      setPref(v === "light" || v === "dark" ? v : "system");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const next = (): Pref => (pref === "system" ? "light" : pref === "light" ? "dark" : "system");
  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : Monitor;

  return (
    <div>
      <button
        type="button"
        className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
        aria-label={`${S.theme.label}: ${S.theme[pref]}`}
        title={`${S.theme.label}: ${S.theme[pref]}`}
        onClick={() => {
          const n = next();
          setPref(n);
          try {
            localStorage.setItem(KEY, n);
          } catch {
            /* ignore */
          }
          apply(n);
        }}
      >
        <Icon size={16} />
        <span className="hidden sm:inline">{S.theme[pref]}</span>
      </button>
    </div>
  );
}
