"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

async function send(url: string, method: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error || S.common.failed;
}

export function ProfileForm({ name: initialName, email }: { name: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk(false);
    const err = await send("/3dp/api/account", "PATCH", { name });
    setBusy(false);
    if (err) setError(err);
    else {
      setOk(true);
      router.refresh();
    }
  }

  return (
    <form className={ui.card} onSubmit={submit}>
      <h2>{S.account.profile}</h2>
      <div className={ui.field}>
        {S.account.email}
        <span className="font-normal">{email}</span>
      </div>
      <label className={ui.field}>
        {S.account.nameLabel}
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
        <small>{S.account.nameHint}</small>
      </label>
      {error ? <p className={ui.error}>{error}</p> : null}
      {ok ? <p className={ui.ok}>{S.account.saved}</p> : null}
      <div className={ui.row}>
        <button className={ui.primary} type="submit" disabled={busy || !name.trim()}>
          {S.common.save}
        </button>
      </div>
    </form>
  );
}

export function PasswordForm({ email, hasPassword: initialHas }: { email: string; hasPassword: boolean }) {
  const [hasPassword, setHasPassword] = useState(initialHas);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk(false);
    if (next !== confirm) {
      setError(S.account.errors.mismatch);
      return;
    }
    setBusy(true);
    const err = await send("/3dp/api/account/password", "POST", { currentPassword: current, newPassword: next });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setOk(true);
    setHasPassword(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <form className={ui.card} onSubmit={submit}>
      <h2>{S.account.password}</h2>
      <p className={ui.muted}>{hasPassword ? S.account.passwordLead : S.account.passwordUnset}</p>
      {/* パスワードマネージャがどのアカウントか判別できるようにする */}
      <input type="email" value={email} autoComplete="username" readOnly hidden />
      {hasPassword ? (
        <label className={ui.field}>
          {S.account.currentPassword}
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        </label>
      ) : null}
      <label className={ui.field}>
        {S.account.newPassword}
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} maxLength={200} autoComplete="new-password" />
        <small>{S.account.newPasswordHint}</small>
      </label>
      <label className={ui.field}>
        {S.account.confirmPassword}
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} maxLength={200} autoComplete="new-password" />
      </label>
      {error ? <p className={ui.error}>{error}</p> : null}
      {ok ? <p className={ui.ok}>{S.account.passwordChanged}</p> : null}
      <div className={ui.row}>
        <button className={ui.primary} type="submit" disabled={busy}>
          {hasPassword ? S.account.changePassword : S.account.setPassword}
        </button>
      </div>
    </form>
  );
}
