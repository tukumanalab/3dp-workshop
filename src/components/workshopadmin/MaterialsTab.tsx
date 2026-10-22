"use client";

import { FileText, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiButton } from "../ApiButton";
import { formatBytes } from "../MaterialList";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { workshopApi, wsCall } from "./api";

type Material = {
  id: number;
  sessionId: number | null;
  type: string;
  title: string;
  url: string | null;
  fileName: string | null;
  byteSize: number;
  audience: string;
};
type SessionOption = { id: number; name: string };
const T = S.admin.materialsTab;
const AUDIENCES = ["EVERYONE", "PARTICIPANT", "STAFF"] as const;

function TargetFields(props: {
  sessions: SessionOption[];
  sessionId: string;
  setSessionId: (v: string) => void;
  audience: string;
  setAudience: (v: string) => void;
}) {
  return (
    <>
      <label className={ui.field}>
        {T.session}
        <select value={props.sessionId} onChange={(e) => props.setSessionId(e.target.value)}>
          <option value="">{T.wholeWorkshop}</option>
          {props.sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className={ui.field}>
        {T.audience}
        <select value={props.audience} onChange={(e) => props.setAudience(e.target.value)}>
          {AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {S.materials.audience[a]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function MaterialsTab(props: { slug: string; maxBytes: number; sessions: SessionOption[]; materials: Material[] }) {
  const router = useRouter();
  const api = workshopApi(props.slug);
  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileSession, setFileSession] = useState("");
  const [fileAudience, setFileAudience] = useState("PARTICIPANT");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkSession, setLinkSession] = useState("");
  const [linkAudience, setLinkAudience] = useState("PARTICIPANT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);

  async function update(id: number, body: Record<string, unknown>) {
    setError("");
    const r = await wsCall(`${api}/materials/${id}`, "PATCH", body);
    if (!r.ok) setError(r.error || S.common.failed);
    router.refresh();
  }

  return (
    <div className={ui.stack}>
      <section className={`${ui.card} ${ui.stack}`}>
        <h2>{S.admin.tabs.materials}</h2>
        {props.materials.length === 0 ? <p className={ui.muted}>{T.none}</p> : null}
        <ul className="grid divide-y divide-line">
          {props.materials.map((m) => (
            <li key={m.id} className="grid gap-2 py-2 sm:flex sm:flex-wrap sm:items-center">
              <span className="flex min-w-0 items-center gap-2 sm:mr-auto">
                {m.type === "LINK" ? <Link2 size={16} className="shrink-0 text-muted" /> : <FileText size={16} className="shrink-0 text-muted" />}
                <a className="truncate font-semibold" href={m.url ?? "#"} {...(m.type === "LINK" ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  {m.title}
                </a>
                {m.type === "FILE" ? <span className="shrink-0 text-sm text-muted">{formatBytes(m.byteSize)}</span> : null}
              </span>
              <div className={ui.row}>
                <select
                  aria-label={T.session}
                  className="min-h-10 rounded-lg border border-line bg-canvas px-2 text-sm"
                  value={m.sessionId ?? ""}
                  onChange={(e) => update(m.id, { sessionId: e.target.value || null })}
                >
                  <option value="">{T.wholeWorkshop}</option>
                  {props.sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={T.audience}
                  className="min-h-10 rounded-lg border border-line bg-canvas px-2 text-sm"
                  value={m.audience}
                  onChange={(e) => update(m.id, { audience: e.target.value })}
                >
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>
                      {S.materials.audience[a]}
                    </option>
                  ))}
                </select>
                <ApiButton url={`${api}/materials/${m.id}`} method="DELETE" confirm={T.removeConfirm}>
                  {S.admin.remove}
                </ApiButton>
              </div>
            </li>
          ))}
        </ul>
        {error ? <p className={ui.error}>{error}</p> : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          key={formKey}
          className={`${ui.card} ${ui.stack}`}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file) return;
            setBusy(true);
            setError("");
            const fd = new FormData();
            fd.set("file", file);
            fd.set("title", fileTitle);
            fd.set("audience", fileAudience);
            if (fileSession) fd.set("sessionId", fileSession);
            const r = await wsCall(`${api}/materials`, "POST", fd);
            setBusy(false);
            if (!r.ok) {
              setError(r.error || S.common.failed);
              return;
            }
            setFile(null);
            setFileTitle("");
            setFormKey((k) => k + 1);
            router.refresh();
          }}
        >
          <h2>{T.addFile}</h2>
          <label className={ui.field}>
            {T.file}
            <input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <small>{T.maxSize(Math.floor(props.maxBytes / 1024 / 1024))}</small>
          </label>
          <label className={ui.field}>
            {T.titleLabel}
            <input value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} maxLength={100} />
            <small>{T.fileTitleHelp}</small>
          </label>
          <TargetFields sessions={props.sessions} sessionId={fileSession} setSessionId={setFileSession} audience={fileAudience} setAudience={setFileAudience} />
          <div>
            <button className={ui.primary} type="submit" disabled={busy || !file}>
              {T.add}
            </button>
          </div>
        </form>

        <form
          className={`${ui.card} ${ui.stack}`}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const r = await wsCall(`${api}/materials`, "POST", {
              title: linkTitle,
              url: linkUrl,
              audience: linkAudience,
              sessionId: linkSession || null,
            });
            if (!r.ok) {
              setError(r.error || S.common.failed);
              return;
            }
            setLinkTitle("");
            setLinkUrl("");
            router.refresh();
          }}
        >
          <h2>{T.addLink}</h2>
          <label className={ui.field}>
            {T.titleLabel}
            <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} required maxLength={100} />
          </label>
          <label className={ui.field}>
            {T.url}
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required type="url" placeholder="https://" />
          </label>
          <TargetFields sessions={props.sessions} sessionId={linkSession} setSessionId={setLinkSession} audience={linkAudience} setAudience={setLinkAudience} />
          <div>
            <button className={ui.primary} type="submit">
              {T.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
