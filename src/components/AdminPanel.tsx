"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiButton } from "./ApiButton";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

type SessionRow = { id: number; name: string; visibility: string; defaultShared: boolean; projectCount: number };
type ParticipantRow = { id: number; loginId: string; displayName: string; hasPin: boolean; projectCount: number };

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as { error?: string; pin?: string };
  return { ok: res.ok, ...j };
}

export function AdminPanel(props: {
  slug: string;
  origin: string;
  isOwner: boolean;
  workshop: { title: string; description: string; visibility: string; joinCode: string; isOpen: boolean };
  sessions: SessionRow[];
  participants: ParticipantRow[];
}) {
  const router = useRouter();
  const api = `/3dp-workshop/api/workshops/${props.slug}`;
  const [title, setTitle] = useState(props.workshop.title);
  const [description, setDescription] = useState(props.workshop.description);
  const [visibility, setVisibility] = useState(props.workshop.visibility);
  const [isOpen, setIsOpen] = useState(props.workshop.isOpen);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [newSession, setNewSession] = useState("");
  const [newSessionShared, setNewSessionShared] = useState(false);
  const [pinNotice, setPinNotice] = useState<Record<number, string>>({});
  const joinUrl = `${props.origin}/3dp-workshop/${props.slug}/join?code=${props.workshop.joinCode}`;

  return (
    <div className={ui.stack}>
      <section className={`${ui.card} ${ui.stack}`}>
        <h2>{S.admin.joinCode}</h2>
        <div className={ui.row}>
          <span className={ui.code}>{props.workshop.joinCode}</span>
          <ApiButton url={api} method="PATCH" body={{ regenerateJoinCode: true }}>
            {S.admin.regenerate}
          </ApiButton>
        </div>
        <p className={ui.muted}>
          {S.admin.joinUrl}: <code className="break-all">{joinUrl}</code>
        </p>
      </section>

      <form
        className={`${ui.card} ${ui.stack}`}
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg("");
          setError("");
          const r = await call(api, "PATCH", { title, description, visibility, isOpen });
          if (r.ok) {
            setMsg(S.project.saved);
            router.refresh();
          } else setError(r.error || S.common.failed);
        }}
      >
        <h2>{S.admin.settings}</h2>
        <label className={ui.field}>
          {S.dashboard.titleLabel}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} />
        </label>
        <label className={ui.field}>
          {S.dashboard.descriptionLabel}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label className={ui.field}>
          {S.dashboard.visibilityLabel}
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="PUBLIC">{S.visibility.PUBLIC}</option>
            <option value="UNLISTED">{S.visibility.UNLISTED}</option>
            <option value="PRIVATE">{S.visibility.PRIVATE}</option>
          </select>
        </label>
        <label className={ui.row}>
          <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
          <span>{S.admin.open}</span>
        </label>
        <div className={ui.row}>
          <button className={ui.primary} type="submit">
            {S.admin.saveSettings}
          </button>
          {msg ? <span className={ui.ok}>{msg}</span> : null}
          {error ? <span className={ui.error}>{error}</span> : null}
        </div>
      </form>

      <section className={`${ui.card} ${ui.stack}`}>
        <h2>{S.admin.sessions}</h2>
        <div className={ui.tableWrap}><table className={ui.table}>
          <tbody>
            {props.sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.visibility === "PUBLIC" ? S.visibility.sessionPUBLIC : S.visibility.sessionPRIVATE}</td>
                <td>{s.defaultShared ? S.admin.defaultShared : ""}</td>
                <td>{S.workshop.projects} {s.projectCount}</td>
                <td>
                  <ApiButton url={`${api}/sessions/${s.id}`} method="PATCH" body={{ visibility: s.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC" }}>
                    {s.visibility === "PUBLIC" ? S.visibility.sessionPRIVATE : S.visibility.sessionPUBLIC}
                  </ApiButton>
                </td>
                <td>
                  <ApiButton url={`${api}/sessions/${s.id}`} method="DELETE" confirm={S.project.deleteConfirm}>
                    {S.admin.remove}
                  </ApiButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <form
          className={ui.row}
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await call(`${api}/sessions`, "POST", { name: newSession, defaultShared: newSessionShared });
            if (r.ok) {
              setNewSession("");
              router.refresh();
            } else setError(r.error || S.common.failed);
          }}
        >
          <label className={ui.field}>
            {S.admin.sessionName}
            <input value={newSession} onChange={(e) => setNewSession(e.target.value)} required maxLength={60} />
          </label>
          <label className={ui.row}>
            <input type="checkbox" checked={newSessionShared} onChange={(e) => setNewSessionShared(e.target.checked)} />
            <span>{S.admin.defaultShared}</span>
          </label>
          <button className={ui.primary} type="submit">
            {S.admin.addSession}
          </button>
        </form>
      </section>

      <section className={`${ui.card} ${ui.stack}`}>
        <h2>{S.admin.participants} ({props.participants.length})</h2>
        <div className={ui.tableWrap}><table className={ui.table}>
          <tbody>
            {props.participants.map((p) => (
              <tr key={p.id}>
                <td>{p.displayName}</td>
                <td><code>{p.loginId}</code></td>
                <td>{p.hasPin ? "PIN" : ""}</td>
                <td>{S.workshop.projects} {p.projectCount}</td>
                <td>
                  <button
                    type="button"
                    className={ui.secondary}
                    onClick={async () => {
                      const r = await call(`${api}/participants/${p.id}`, "PATCH", { resetPin: true });
                      if (r.ok && r.pin) {
                        setPinNotice((n) => ({ ...n, [p.id]: `${S.admin.newPin}: ${r.pin}` }));
                        router.refresh();
                      }
                    }}
                  >
                    {S.admin.resetPin}
                  </button>
                  {pinNotice[p.id] ? <span className={ui.ok}> {pinNotice[p.id]}</span> : null}
                </td>
                <td>
                  <ApiButton url={`${api}/participants/${p.id}`} method="DELETE" confirm={S.project.deleteConfirm}>
                    {S.admin.remove}
                  </ApiButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      {props.isOwner ? (
        <section className={ui.card}>
          <ApiButton url={api} method="DELETE" confirm={S.admin.deleteWorkshopConfirm} redirectTo="/dashboard">
            <span className={ui.danger}>{S.admin.deleteWorkshop}</span>
          </ApiButton>
        </section>
      ) : null}
    </div>
  );
}
