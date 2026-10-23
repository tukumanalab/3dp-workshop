"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

type Joined = { loginId: string; displayName: string };

export function JoinForm({ slug, initialCode, initialLoginId = "" }: { slug: string; initialCode: string; initialLoginId?: string }) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [loginId, setLoginId] = useState(initialLoginId);
  const [loginPin, setLoginPin] = useState("");
  const [error, setError] = useState("");
  const [errorFor, setErrorFor] = useState<"join" | "login">("join");
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<Joined | null>(null);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch(`/3dp/api/workshops/${slug}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    const j = (await res.json().catch(() => ({}))) as { error?: string; participant?: Joined };
    if (!res.ok || !j.participant) {
      setError(j.error || S.common.failed);
      return null;
    }
    return j.participant;
  }

  if (joined) {
    return (
      <div className={`${ui.card} ${ui.stack}`}>
        <h2>{S.join.done}</h2>
        <p>{joined.displayName}</p>
        <p>{S.join.yourLoginId}</p>
        <span className={ui.code}>{joined.loginId}</span>
        <p className={ui.muted}>{S.join.keepLoginId}</p>
        <button
          className={ui.primary}
          type="button"
          onClick={() => {
            router.push(`/${slug}`);
            router.refresh();
          }}
        >
          {S.join.continue}
        </button>
      </div>
    );
  }

  // ID カードの QR（?id=）から来たときはログインを先に出す
  const joinCard = (
    <form
      className={`${ui.card} ${ui.stack}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setErrorFor("join");
        const p = await post({ joinCode, displayName, pin: pin || undefined });
        if (p) setJoined(p);
      }}
    >
      <label className={ui.field}>
        {S.join.joinCode}
        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} required autoCapitalize="characters" />
      </label>
      <label className={ui.field}>
        {S.join.displayName}
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} />
      </label>
      <label className={ui.field}>
        {S.join.pin}
        <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" pattern="\d{4}" maxLength={4} />
        <small>{S.join.pinHelp}</small>
      </label>
      {error && errorFor === "join" ? <p className={ui.error}>{error}</p> : null}
      <button className={ui.primary} type="submit" disabled={busy}>
        {S.join.submit}
      </button>
    </form>
  );
  const reloginCard = (
    <form
      className={`${ui.card} ${ui.stack}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setErrorFor("login");
        const p = await post({ loginId, pin: loginPin || undefined });
        if (p) {
          router.push(`/${slug}`);
          router.refresh();
        }
      }}
    >
      <h2>{S.join.relogin}</h2>
      <label className={ui.field}>
        {S.join.loginId}
        <input value={loginId} onChange={(e) => setLoginId(e.target.value)} required />
      </label>
      <label className={ui.field}>
        PIN
        <input value={loginPin} onChange={(e) => setLoginPin(e.target.value)} inputMode="numeric" maxLength={4} />
      </label>
      {error && errorFor === "login" ? <p className={ui.error}>{error}</p> : null}
      <button className={ui.secondary} type="submit" disabled={busy}>
        {S.join.reloginSubmit}
      </button>
    </form>
  );
  return (
    <div className={ui.stack}>
      {initialLoginId ? reloginCard : joinCard}
      {initialLoginId ? joinCard : reloginCard}
      <Link href={`/${slug}`} className={ui.muted}>
        {S.common.back}
      </Link>
    </div>
  );
}
