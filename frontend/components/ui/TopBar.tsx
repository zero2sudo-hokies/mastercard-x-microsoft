"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHealth, USE_MOCK } from "@/lib/api";
import type { Health } from "@/lib/types";

type Status = { color: string; label: string };

function describe(h: Health | null, failed: boolean): Status {
  if (failed) return { color: "bg-red-500", label: "API down" };
  if (!h) return { color: "bg-gray-300", label: "Checking API..." };
  const sources = `Areas: ${h.data_source.areas}. Frustration: ${h.data_source.frustration}. AI: ${h.ai_configured ? "configured" : "not configured"}.`;
  if (USE_MOCK) return { color: "bg-amber-400", label: `Mock data. ${sources}` };
  const real = h.data_source.areas === "pipeline" && h.data_source.frustration === "pipeline";
  return { color: real ? "bg-emerald-500" : "bg-amber-400", label: sources };
}

export default function TopBar() {
  const [health, setHealth] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () =>
      getHealth()
        .then((h) => {
          if (alive) {
            setHealth(h);
            setFailed(false);
          }
        })
        .catch(() => alive && setFailed(true));
    check();
    const id = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const status = describe(health, failed);
  return (
    <header className="flex items-center gap-3 border-b border-line bg-white px-6 py-3">
      <Link href="/" className="text-lg font-semibold tracking-tight text-navy">
        Navigator
      </Link>
      <span className="rounded-full border border-accent/60 bg-accent/10 px-2 py-0.5 text-xs font-medium text-navy">
        Prototype
      </span>
      <div className="ml-auto flex items-center gap-2 text-xs text-muted" title={status.label}>
        <span className={`h-2.5 w-2.5 rounded-full ${status.color}`} aria-hidden />
        <span>{failed ? "API down" : USE_MOCK ? "Mock data" : health ? "API live" : "Checking..."}</span>
        <span className="sr-only">{status.label}</span>
      </div>
    </header>
  );
}
