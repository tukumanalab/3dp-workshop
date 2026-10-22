"use client";

import { useRouter } from "next/navigation";
import { BookOpen, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiButton } from "./ApiButton";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export function ProjectActions(props: {
  id: string;
  slug: string;
  title: string;
  description: string;
  isShared: boolean;
  isTeachingMaterial: boolean;
  sessionId: number;
  sessions: { id: number; name: string }[];
  canEdit: boolean;
  canManage: boolean;
  canSetTeaching: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(props.title);
  const [description, setDescription] = useState(props.description);
  const [sessionId, setSessionId] = useState(props.sessionId);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const api = `/3dp-workshop/api/projects/${props.id}`;

  return (
    <div className={`${ui.card} ${ui.stack}`}>
      {props.canEdit ? (
        <form
          className={ui.stack}
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg("");
            setError("");
            const res = await fetch(api, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ title, description, sessionId }),
            });
            if (res.ok) {
              setMsg(S.project.saved);
              router.refresh();
            } else {
              setError(((await res.json().catch(() => ({}))) as { error?: string }).error || S.common.failed);
            }
          }}
        >
          <h2>{S.project.editTitle}</h2>
          <label className={ui.field}>
            {S.dashboard.titleLabel}
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </label>
          <label className={ui.field}>
            {S.project.description}
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} />
          </label>
          {props.sessions.length > 1 ? (
            <label className={ui.field}>
              {S.project.session}
              <select value={sessionId} onChange={(e) => setSessionId(Number(e.target.value))}>
                {props.sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className={ui.row}>
            <button className={ui.primary} type="submit">
              {S.common.save}
            </button>
            {msg ? <span className={ui.ok}>{msg}</span> : null}
            {error ? <span className={ui.error}>{error}</span> : null}
          </div>
        </form>
      ) : null}
      {props.canManage ? (
        <div className={ui.row}>
          <ApiButton url={`${api}/${props.isShared ? "unshare" : "share"}`}>
            <Share2 size={16} />
            <span>{props.isShared ? S.project.unshare : S.project.share}</span>
          </ApiButton>
          {props.canSetTeaching ? (
            <ApiButton url={api} method="PATCH" body={{ isTeachingMaterial: !props.isTeachingMaterial }}>
              <BookOpen size={16} />
              <span>{props.isTeachingMaterial ? S.project.unsetTeaching : S.project.setTeaching}</span>
            </ApiButton>
          ) : null}
          <ApiButton url={api} method="DELETE" confirm={S.project.deleteConfirm} redirectTo={`/${props.slug}`}>
            <Trash2 size={16} />
            <span className={ui.danger}>{S.common.delete}</span>
          </ApiButton>
        </div>
      ) : null}
    </div>
  );
}
