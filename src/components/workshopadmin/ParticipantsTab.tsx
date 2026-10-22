"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiButton } from "../ApiButton";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { workshopApi, wsCall } from "./api";

type Row = { id: number; loginId: string; displayName: string; hasPin: boolean; projectCount: number };
type BulkResult = { created: { loginId: string; displayName: string; pin: string | null }[]; skipped: { line: number; reason: string }[] };

const T = S.admin.participantsTab;

/** 「表示名」または「表示名,ログイン ID,PIN」の行を解析する（タブ区切りも可）。 */
function parseBulk(text: string) {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      const [displayName = "", loginId = "", pin = ""] = l.split(/[,\t]/).map((c) => c.trim());
      return { displayName, loginId: loginId || undefined, pin: pin || undefined };
    });
}

export function ParticipantsTab(props: { slug: string; participants: Row[] }) {
  const router = useRouter();
  const api = workshopApi(props.slug);
  const [displayName, setDisplayName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [bulk, setBulk] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Record<number, string>>({});

  async function register(rows: { displayName: string; loginId?: string; pin?: string }[]) {
    setError("");
    setResult(null);
    const r = await wsCall<BulkResult>(`${api}/participants`, "POST", { participants: rows });
    if (!r.ok) {
      setError(r.error || S.common.failed);
      return false;
    }
    setResult(r.data);
    router.refresh();
    return r.data.skipped.length === 0;
  }

  async function patch(id: number, body: Record<string, unknown>) {
    const r = await wsCall<{ pin?: string }>(`${api}/participants/${id}`, "PATCH", body);
    if (!r.ok) {
      setNotice((n) => ({ ...n, [id]: r.error || S.common.failed }));
      return;
    }
    setNotice((n) => ({ ...n, [id]: r.data.pin ? `${S.admin.newPin}: ${r.data.pin}` : S.project.saved }));
    router.refresh();
  }

  return (
    <div className={ui.stack}>
      <section className={`${ui.card} ${ui.stack}`}>
        <h2>{T.add}</h2>
        <form
          className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await register([{ displayName, loginId: loginId || undefined, pin: pin || undefined }])) {
              setDisplayName("");
              setLoginId("");
              setPin("");
            }
          }}
        >
          <label className={ui.field}>
            {T.displayName}
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} />
          </label>
          <label className={ui.field}>
            {T.loginId}
            <input value={loginId} onChange={(e) => setLoginId(e.target.value)} maxLength={32} pattern="[A-Za-z0-9_\-]{2,32}" autoCapitalize="none" />
          </label>
          <label className={ui.field}>
            {T.pin}
            <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" pattern="\d{4}" maxLength={4} />
          </label>
          <button className={ui.primary} type="submit">
            {T.addOne}
          </button>
        </form>
        <details className="grid gap-3">
          <summary className="cursor-pointer text-sm font-semibold">{T.bulk}</summary>
          <form
            className="mt-3 grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const rows = parseBulk(bulk);
              if (rows.length && (await register(rows))) setBulk("");
            }}
          >
            <label className={ui.field}>
              <small>{T.bulkHelp}</small>
              <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={6} placeholder={"たろう\nはなこ,hanako,1234"} />
            </label>
            <div>
              <button className={ui.secondary} type="submit">
                {T.bulkSubmit}
              </button>
            </div>
          </form>
        </details>
        {error ? <p className={ui.error}>{error}</p> : null}
        {result ? (
          <div className="grid gap-1 text-sm">
            <p className={ui.ok}>{T.created(result.created.length)}</p>
            {result.created.some((c) => c.pin) ? <p className={ui.muted}>{T.createdPins}</p> : null}
            {result.created.length > 0 ? (
              <ul className="grid gap-0.5">
                {result.created.map((c) => (
                  <li key={c.loginId}>
                    {c.displayName} — <code>{c.loginId}</code>
                    {c.pin ? ` / PIN ${c.pin}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {result.skipped.map((s) => (
              <p key={s.line} className={ui.error}>
                {T.skipped(s.line, s.reason)}
              </p>
            ))}
          </div>
        ) : null}
      </section>

      <section className={`${ui.card} ${ui.stack}`}>
        <div className={ui.row}>
          <h2 className="mr-auto">
            {S.admin.participants} ({props.participants.length})
          </h2>
          {props.participants.length > 0 ? (
            <Link className={ui.secondary} href={`/${props.slug}/admin/print?kind=cards`}>
              <Printer size={16} />
              <span>{S.admin.printCards}</span>
            </Link>
          ) : null}
        </div>
        {props.participants.length === 0 ? <p className={ui.muted}>{T.none}</p> : null}
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <tbody>
              {props.participants.map((p) => (
                <tr key={p.id}>
                  <td>{p.displayName}</td>
                  <td>
                    <code>{p.loginId}</code>
                  </td>
                  <td>{p.hasPin ? T.hasPin : ""}</td>
                  <td>
                    {S.workshop.projects} {p.projectCount}
                  </td>
                  <td>
                    <div className={ui.row}>
                      <button
                        type="button"
                        className={ui.secondary}
                        onClick={() => {
                          const v = window.prompt(T.pinPrompt);
                          if (v !== null) void patch(p.id, { pin: v.trim() });
                        }}
                      >
                        {T.setPin}
                      </button>
                      <button type="button" className={ui.secondary} onClick={() => patch(p.id, { resetPin: true })}>
                        {S.admin.resetPin}
                      </button>
                      {p.hasPin ? (
                        <button type="button" className={ui.secondary} onClick={() => patch(p.id, { clearPin: true })}>
                          {T.clearPin}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={ui.secondary}
                        onClick={() => {
                          const v = window.prompt(T.renamePrompt, p.displayName);
                          if (v !== null && v.trim()) void patch(p.id, { displayName: v.trim() });
                        }}
                      >
                        {T.rename}
                      </button>
                      <ApiButton url={`${api}/participants/${p.id}`} method="DELETE" confirm={T.removeConfirm}>
                        {S.admin.remove}
                      </ApiButton>
                      {notice[p.id] ? <span className={ui.ok}>{notice[p.id]}</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
