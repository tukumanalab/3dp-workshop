"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { forgetLogin, loadSavedLogins, rememberLogin, type SavedLogin } from "@/lib/savedLogins";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

type Joined = { loginId: string; displayName: string; hasPin: boolean };

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
  const [saved, setSaved] = useState<SavedLogin[]>([]);
  const pinRef = useRef<HTMLInputElement>(null);

  // localStorage はマウント後に読む（SSR との差異を避ける）
  useEffect(() => setSaved(loadSavedLogins(slug)), [slug]);

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
    const p = j.participant;
    setSaved(rememberLogin(slug, { loginId: p.loginId, displayName: p.displayName, hasPin: !!p.hasPin }));
    return p;
  }

  async function relogin(id: string, pinValue: string) {
    setErrorFor("login");
    const p = await post({ loginId: id, pin: pinValue || undefined });
    if (p) {
      router.push(`/${slug}`);
      router.refresh();
    }
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

  // ID カードの QR（?id=）から来たとき、またはこの端末に記録した ID があるときはログインを先に出す
  // （参加コード付きのリンクから来たときは参加を先に出す）
  const reloginFirst = !!initialLoginId || (saved.length > 0 && !initialCode);
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
      onSubmit={(e) => {
        e.preventDefault();
        void relogin(loginId, loginPin);
      }}
    >
      <h2>{S.join.relogin}</h2>
      {saved.length ? (
        <div className={ui.stack}>
          <p className={ui.muted}>{S.join.savedLogins}</p>
          <ul className="grid gap-2">
            {saved.map((l) => (
              <li key={l.loginId} className="flex flex-wrap items-center gap-2">
                <button
                  className={`${ui.secondary} min-w-0 flex-1 justify-start`}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setLoginId(l.loginId);
                    if (l.hasPin) {
                      setErrorFor("login");
                      setError(S.join.pinRequired);
                      pinRef.current?.focus();
                    } else {
                      void relogin(l.loginId, "");
                    }
                  }}
                >
                  <span className="truncate">{l.displayName}</span>
                  <span className="font-mono text-muted">{l.loginId}</span>
                </button>
                <button
                  className={`${ui.muted} cursor-pointer underline-offset-2 hover:text-ink hover:underline`}
                  type="button"
                  onClick={() => setSaved(forgetLogin(slug, l.loginId))}
                >
                  {S.join.forget}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <label className={ui.field}>
        {S.join.loginId}
        <input value={loginId} onChange={(e) => setLoginId(e.target.value)} required />
      </label>
      <label className={ui.field}>
        PIN
        <input ref={pinRef} value={loginPin} onChange={(e) => setLoginPin(e.target.value)} inputMode="numeric" maxLength={4} />
      </label>
      {error && errorFor === "login" ? <p className={ui.error}>{error}</p> : null}
      <button className={ui.secondary} type="submit" disabled={busy}>
        {S.join.reloginSubmit}
      </button>
    </form>
  );
  return (
    <div className={ui.stack}>
      {reloginFirst ? reloginCard : joinCard}
      {reloginFirst ? joinCard : reloginCard}
      <Link href={`/${slug}`} className={ui.muted}>
        {S.common.back}
      </Link>
    </div>
  );
}
