"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export function LoginForm({ googleEnabled, passwordEnabled, next }: { googleEnabled: boolean; passwordEnabled: boolean; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/layerling-workshop/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push(next);
      router.refresh();
    } else {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error || S.common.failed);
    }
  }

  return (
    <div className={ui.stack}>
      {googleEnabled ? (
        <a className={ui.primary} href={`/layerling-workshop/api/auth/google/start?next=${encodeURIComponent(next)}`}>
          {S.auth.google}
        </a>
      ) : (
        <p className={ui.muted}>{S.auth.googleUnavailable}</p>
      )}
      {passwordEnabled ? (
        <form className={`${ui.card} ${ui.stack}`} onSubmit={submit}>
          <h2>{S.auth.password}</h2>
          <label className={ui.field}>
            {S.auth.email}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </label>
          <label className={ui.field}>
            {S.auth.passwordLabel}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          {error ? <p className={ui.error}>{error}</p> : null}
          <button className={ui.primary} type="submit" disabled={busy}>
            {S.auth.submit}
          </button>
        </form>
      ) : null}
    </div>
  );
}
