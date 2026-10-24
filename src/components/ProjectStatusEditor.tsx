"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyProjectsChanged } from "./LiveRefresh";
import type { StatusLabelView } from "@/lib/statuses";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

/** 作品の状態を種類ごとに選ぶ。選んだ時点で保存する。 */
export function ProjectStatusEditor({
  id,
  slug,
  labels,
  selected,
}: {
  id: string;
  slug: string;
  labels: StatusLabelView[];
  /** labelId -> optionId */
  selected: Record<number, number>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(selected);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function change(labelId: number, optionId: number | null) {
    const next = { ...values };
    if (optionId === null) delete next[labelId];
    else next[labelId] = optionId;
    setBusy(true);
    setMsg("");
    setError("");
    const res = await fetch(`/3dp/api/projects/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ statuses: Object.values(next) }),
    });
    setBusy(false);
    if (res.ok) {
      setValues(next);
      setMsg(S.statuses.saved);
      notifyProjectsChanged(slug);
      router.refresh();
    } else {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error || S.common.failed);
    }
  }

  return (
    <div className={`${ui.card} ${ui.stack}`}>
      <div>
        <h2>{S.statuses.editTitle}</h2>
        <p className={ui.muted}>{S.statuses.editHelp}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {labels.map((l) => (
          <label key={l.id} className={ui.field}>
            {l.name}
            <select
              value={values[l.id] ?? ""}
              disabled={busy}
              onChange={(e) => change(l.id, e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">{S.statuses.unset}</option>
              {l.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {msg || error ? (
        <p className={error ? ui.error : ui.ok} role="status">
          {error || msg}
        </p>
      ) : null}
    </div>
  );
}
