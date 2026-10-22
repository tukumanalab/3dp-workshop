"use client";

import { ArrowDown, ArrowUp, FileText, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiButton } from "../ApiButton";
import { formatBytes } from "../MaterialList";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { workshopApi, wsCall } from "./api";

export type AdminMaterial = {
  id: number;
  sessionId: number | null;
  type: string;
  title: string;
  url: string | null;
  fileName: string | null;
  byteSize: number;
  audience: string;
};
const T = S.admin.materialsTab;
const AUDIENCES = ["EVERYONE", "PARTICIPANT", "STAFF"] as const;

function AudienceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      aria-label={T.audience}
      className="min-h-10 rounded-lg border border-line bg-canvas px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {AUDIENCES.map((a) => (
        <option key={a} value={a}>
          {S.materials.audience[a]}
        </option>
      ))}
    </select>
  );
}

/** 1 つの対象（ワークショップ全体 = sessionId null、またはセッション）の資料の一覧・追加・変更・削除。 */
export function MaterialsEditor(props: { slug: string; sessionId: number | null; maxBytes: number; materials: AdminMaterial[] }) {
  const router = useRouter();
  const api = workshopApi(props.slug);
  const [mode, setMode] = useState<"FILE" | "LINK" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState("PARTICIPANT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function update(id: number, body: Record<string, unknown>) {
    setError("");
    const r = await wsCall(`${api}/materials/${id}`, "PATCH", body);
    if (!r.ok) setError(r.error || S.common.failed);
    router.refresh();
  }

  async function move(index: number, delta: number) {
    const ids = props.materials.map((m) => m.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    setError("");
    const r = await wsCall(`${api}/materials/reorder`, "PATCH", { sessionId: props.sessionId, ids });
    if (!r.ok) setError(r.error || S.common.failed);
    router.refresh();
  }

  function reset() {
    setMode(null);
    setFile(null);
    setTitle("");
    setUrl("");
  }

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-bold">{props.sessionId === null ? T.workshopTitle : T.sessionTitle}</h3>
      {props.materials.length === 0 ? <p className={ui.muted}>{T.none}</p> : null}
      {props.materials.length > 0 ? (
        <ul className="grid divide-y divide-line">
          {props.materials.map((m, i) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="mr-auto flex min-w-0 items-center gap-2">
                {m.type === "LINK" ? <Link2 size={16} className="shrink-0 text-muted" /> : <FileText size={16} className="shrink-0 text-muted" />}
                <a className="truncate font-semibold" href={m.url ?? "#"} {...(m.type === "LINK" ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  {m.title}
                </a>
                {m.type === "FILE" ? <span className="shrink-0 text-sm text-muted">{formatBytes(m.byteSize)}</span> : null}
              </span>
              <AudienceSelect value={m.audience} onChange={(v) => update(m.id, { audience: v })} />
              <button type="button" className={ui.secondary} aria-label={T.up} title={T.up} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className={ui.secondary}
                aria-label={T.down}
                title={T.down}
                disabled={i === props.materials.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <ApiButton url={`${api}/materials/${m.id}`} method="DELETE" confirm={T.removeConfirm}>
                {S.admin.remove}
              </ApiButton>
            </li>
          ))}
        </ul>
      ) : null}

      {mode === null ? (
        <div className={ui.row}>
          <button type="button" className={ui.secondary} onClick={() => setMode("FILE")}>
            <FileText size={16} />
            <span>{T.addFile}</span>
          </button>
          <button type="button" className={ui.secondary} onClick={() => setMode("LINK")}>
            <Link2 size={16} />
            <span>{T.addLink}</span>
          </button>
        </div>
      ) : (
        <form
          className="grid gap-3 rounded-xl border border-line p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            let body: FormData | Record<string, unknown>;
            if (mode === "FILE") {
              if (!file) return setBusy(false);
              const fd = new FormData();
              fd.set("file", file);
              fd.set("title", title);
              fd.set("audience", audience);
              if (props.sessionId !== null) fd.set("sessionId", String(props.sessionId));
              body = fd;
            } else {
              body = { title, url, audience, sessionId: props.sessionId };
            }
            const r = await wsCall(`${api}/materials`, "POST", body);
            setBusy(false);
            if (!r.ok) {
              setError(r.error || S.common.failed);
              return;
            }
            reset();
            router.refresh();
          }}
        >
          {mode === "FILE" ? (
            <label className={ui.field}>
              {T.file}
              <input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <small>{T.maxSize(Math.floor(props.maxBytes / 1024 / 1024))}</small>
            </label>
          ) : null}
          <label className={ui.field}>
            {T.titleLabel}
            <input value={title} onChange={(e) => setTitle(e.target.value)} required={mode === "LINK"} maxLength={100} />
            {mode === "FILE" ? <small>{T.fileTitleHelp}</small> : null}
          </label>
          {mode === "LINK" ? (
            <label className={ui.field}>
              {T.url}
              <input value={url} onChange={(e) => setUrl(e.target.value)} required type="url" placeholder="https://" />
            </label>
          ) : null}
          <label className={ui.field}>
            {T.audience}
            <AudienceSelect value={audience} onChange={setAudience} />
          </label>
          <div className={ui.row}>
            <button className={ui.primary} type="submit" disabled={busy || (mode === "FILE" && !file)}>
              {T.add}
            </button>
            <button className={ui.secondary} type="button" onClick={reset}>
              {S.common.cancel}
            </button>
          </div>
        </form>
      )}
      {error ? <p className={ui.error}>{error}</p> : null}
    </div>
  );
}
