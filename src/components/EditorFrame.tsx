"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

const BASE = "/3dp";
const MSG = {
  idUpdated: "3dp-workshop:project-id-updated",
  saveRequest: "3dp-workshop:save-request",
  saveAck: "3dp-workshop:save-ack",
  saveResult: "3dp-workshop:save-result",
  renamed: "3dp-workshop:project-renamed",
} as const;

type SaveOutcome = { ok: boolean; saved: boolean };

export function EditorFrame(props: {
  slug: string;
  projectId?: string;
  sessionId?: number;
  mode?: "remix";
  readonly?: boolean;
  title: string;
  editorBase: string;
  /** 作品ページへ戻るときに引き継ぐ、元の一覧の条件 */
  back?: string | null;
}) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const projectIdRef = useRef<string | undefined>(props.projectId);
  const savingRef = useRef<Promise<SaveOutcome> | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | undefined>(props.projectId);
  const [title, setTitle] = useState(props.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  // iframe の src は初回のみ決める（以後 project-id-updated で変わっても再読込しない）
  const src = useMemo(() => {
    if (!origin) return null;
    const u = new URL(props.editorBase, origin);
    u.searchParams.set("workshop", "1");
    u.searchParams.set("api", origin + BASE);
    u.searchParams.set("slug", props.slug);
    if (props.projectId) {
      u.searchParams.set("project_id", props.projectId);
      // サイトで付けたタイトルをエディタの作品名にする（.lyl 内の名前より優先）
      u.searchParams.set("title", props.title);
    }
    if (props.sessionId) u.searchParams.set("session_id", String(props.sessionId));
    if (props.mode === "remix") u.searchParams.set("mode", "remix");
    if (props.readonly) u.searchParams.set("readonly", "1");
    return u.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);

  /** エディタに保存を依頼する。ack 5 秒 / result 30 秒。ack が無ければ保存対象なしとみなす。 */
  const requestSave = useCallback((): Promise<SaveOutcome> => {
    if (props.readonly) return Promise.resolve({ ok: true, saved: false });
    if (savingRef.current) return savingRef.current;
    const target = iframeRef.current?.contentWindow;
    if (!target) return Promise.resolve({ ok: true, saved: false });
    const requestId = crypto.randomUUID();
    const p = new Promise<SaveOutcome>((resolve) => {
      const timers: { ack?: ReturnType<typeof setTimeout>; result?: ReturnType<typeof setTimeout> } = {};
      const finish = (r: SaveOutcome) => {
        window.removeEventListener("message", onMessage);
        clearTimeout(timers.ack);
        clearTimeout(timers.result);
        resolve(r);
      };
      const onMessage = (ev: MessageEvent) => {
        if (ev.origin !== window.location.origin || ev.source !== target) return;
        const d = ev.data as { type?: string; requestId?: string; ok?: boolean; saved?: boolean } | null;
        if (!d || d.requestId !== requestId) return;
        if (d.type === MSG.saveAck) {
          clearTimeout(timers.ack);
          timers.result = setTimeout(() => finish({ ok: false, saved: false }), 30_000);
        } else if (d.type === MSG.saveResult) {
          finish({ ok: !!d.ok, saved: !!d.saved });
        }
      };
      window.addEventListener("message", onMessage);
      timers.ack = setTimeout(() => finish({ ok: true, saved: false }), 5_000);
      target.postMessage({ type: MSG.saveRequest, requestId }, window.location.origin);
    }).finally(() => {
      savingRef.current = null;
    });
    savingRef.current = p;
    return p;
  }, [props.readonly]);

  // editor -> parent: 新規保存で作品 ID が決まったら URL を差し替える（iframe は再読込しない）
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || ev.source !== iframeRef.current?.contentWindow) return;
      const d = ev.data as { type?: string; projectId?: string; title?: string } | null;
      if (d?.type === MSG.renamed && typeof d.title === "string" && d.title.trim()) {
        setTitle(d.title.trim().slice(0, 200));
        return;
      }
      if (!d || d.type !== MSG.idUpdated || typeof d.projectId !== "string" || !/^[A-Za-z0-9_-]+$/.test(d.projectId)) return;
      projectIdRef.current = d.projectId;
      setCurrentId(d.projectId);
      window.history.replaceState(window.history.state, "", `${BASE}/${props.slug}/projects/${d.projectId}/editor`);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [props.slug]);

  // タブが非表示になるとき保存を依頼
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void requestSave();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [requestSave]);

  async function goBack() {
    setBusy(true);
    setError("");
    const r = await requestSave();
    setBusy(false);
    if (!r.ok) {
      setError(S.editor.saveFailed);
      return;
    }
    const id = projectIdRef.current;
    router.push(id ? `/${props.slug}/projects/${id}${props.back ? `?back=${encodeURIComponent(props.back)}` : ""}` : `/${props.slug}`);
    router.refresh();
  }

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <div className="flex min-h-12 items-center gap-3 border-b border-line bg-surface px-3">
        <button type="button" className={ui.secondary} onClick={goBack} disabled={busy}>
          <ArrowLeft size={16} />
          <span>{busy ? S.editor.saving : S.editor.back}</span>
        </button>
        <span className="min-w-0 flex-1 truncate font-bold">{title}</span>
        {error ? <span className={ui.error}>{error}</span> : null}
      </div>
      {src ? (
        <iframe
          ref={iframeRef}
          className="min-h-0 w-full flex-1 border-0 bg-white"
          src={src}
          title={currentId ? `editor ${currentId}` : "editor"}
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      ) : (
        <p className={`${ui.muted} p-5`}>{S.editor.loading}</p>
      )}
    </div>
  );
}
