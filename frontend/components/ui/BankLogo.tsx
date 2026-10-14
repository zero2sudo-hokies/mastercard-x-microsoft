"use client";

import Image from "next/image";
import { useState } from "react";

export default function BankLogo({ name, website }: { name: string; website?: string | null }) {
  const clientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID?.trim();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  let domain = "";
  try {
    const url = new URL(website?.includes("://") ? website : `https://${website || ""}`);
    if (["https:", "http:"].includes(url.protocol) && url.hostname.includes(".")) {
      domain = url.hostname.replace(/^www\./, "");
    }
  } catch {
    // Missing or invalid bank websites use initials.
  }
  const src = clientId && domain
    ? `https://cdn.brandfetch.io/domain/${encodeURIComponent(domain)}/w/80/h/80/fallback/404/type/icon?c=${encodeURIComponent(clientId)}`
    : null;
  const initials = name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white text-sm font-semibold text-navy">
      {src && src !== failedUrl ? (
        <Image src={src} alt={`${name} logo`} width={40} height={40} unoptimized className="h-10 w-10 object-contain p-1" onError={() => setFailedUrl(src)} />
      ) : (
        <span aria-label={name || "Issuer partner"} role="img">{initials}</span>
      )}
    </span>
  );
}
