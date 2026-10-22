"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiButton } from "../ApiButton";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { workshopApi, wsCall } from "./api";

type Row = { id: number; name: string; visibility: string; defaultShared: boolean; projectCount: number };
const T = S.admin.sessionsTab;

function SessionEditor({ api, s, onDone }: { api: string; s: Row; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(s.name);
  const [visibility, setVisibility] = useState(s.visibility);
  const [defaultShared, setDefaultShared] = useState(s.defaultShared);
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-3 py-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await wsCall(`${api}/sessions/${s.id}`, "PATCH", { name, visibility, defaultShared });
        if (!r.ok) {
          setError(r.error || S.common.failed);
          return;
        }
        onDone();
        router.refresh();
      }}
    >
      <label className={ui.field}>
        {S.admin.sessionName}
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
      </label>
      <label className={ui.field}>
        {T.visibility}
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="PUBLIC">{S.visibility.sessionPUBLIC}</option>
          <option value="PRIVATE">{S.visibility.sessionPRIVATE}</option>
        </select>
      </label>
      <label className={ui.row}>
        <input type="checkbox" checked={defaultShared} onChange={(e) => setDefaultShared(e.target.checked)} />
        <span>{S.admin.defaultShared}</span>
      </label>
      <div className={ui.row}>
        <button className={ui.primary} type="submit">
          {T.save}
        </button>
        <button className={ui.secondary} type="button" onClick={onDone}>
          {T.cancel}
        </button>
        {error ? <span className={ui.error}>{error}</span> : null}
      </div>
    </form>
  );
}

export function SessionsTab(props: { slug: string; sessions: Row[] }) {
  const router = useRouter();
  const api = workshopApi(props.slug);
  const [editing, setEditing] = useState<number | null>(null);
  const [newSession, setNewSession] = useState("");
  const [newSessionShared, setNewSessionShared] = useState(false);
  const [error, setError] = useState("");

  async function move(index: number, delta: number) {
    const ids = props.sessions.map((s) => s.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    const r = await wsCall(`${api}/sessions/reorder`, "PATCH", { ids });
    if (!r.ok) setError(r.error || S.common.failed);
    router.refresh();
  }

  return (
    <section className={`${ui.card} ${ui.stack}`}>
      <h2>{S.admin.sessions}</h2>
      <ul className="grid divide-y divide-line">
        {props.sessions.map((s, i) => (
          <li key={s.id} className="py-2">
            {editing === s.id ? (
              <SessionEditor api={api} s={s} onDone={() => setEditing(null)} />
            ) : (
              <div className={ui.row}>
                <span className="mr-auto min-w-0 font-semibold">{s.name}</span>
                <span className={ui.muted}>{s.visibility === "PUBLIC" ? S.visibility.sessionPUBLIC : S.visibility.sessionPRIVATE}</span>
                {s.defaultShared ? <span className={ui.muted}>{S.admin.defaultShared}</span> : null}
                <span className={ui.muted}>
                  {S.workshop.projects} {s.projectCount}
                </span>
                <button type="button" className={ui.secondary} aria-label={T.up} title={T.up} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className={ui.secondary}
                  aria-label={T.down}
                  title={T.down}
                  disabled={i === props.sessions.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button type="button" className={ui.secondary} onClick={() => setEditing(s.id)}>
                  {T.edit}
                </button>
                <ApiButton url={`${api}/sessions/${s.id}`} method="DELETE" confirm={T.removeConfirm}>
                  {S.admin.remove}
                </ApiButton>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form
        className={ui.row}
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await wsCall(`${api}/sessions`, "POST", { name: newSession, defaultShared: newSessionShared });
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
      {error ? <p className={ui.error}>{error}</p> : null}
    </section>
  );
}
