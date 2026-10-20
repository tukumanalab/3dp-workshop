"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ui } from "@/lib/ui";

/** API を叩いて router.refresh() / 遷移するだけの小さなボタン。 */
export function ApiButton({
  url,
  method = "POST",
  body,
  confirm,
  redirectTo,
  className = ui.secondary,
  children,
}: {
  url: string;
  method?: string;
  body?: unknown;
  confirm?: string;
  redirectTo?: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError("");
          try {
            const res = await fetch(url, {
              method,
              headers: body !== undefined ? { "content-type": "application/json" } : undefined,
              body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string };
              setError(j.error || "失敗しました");
            } else if (redirectTo) {
              router.push(redirectTo);
              router.refresh();
            } else {
              router.refresh();
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
      </button>
      {error ? <span className={ui.error}>{error}</span> : null}
    </>
  );
}
