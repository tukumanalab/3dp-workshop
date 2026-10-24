"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiButton } from "../ApiButton";
import { MAX_STATUS_NAME, MAX_STATUS_OPTIONS } from "@/lib/statusLimits";
import type { StatusLabelView } from "@/lib/statuses";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { workshopApi, wsCall } from "./api";

type Row = StatusLabelView & { usage: number };
type OptionDraft = { key: string; id?: number; name: string };
const T = S.statuses;

function LabelEditor({ api, l, onDone }: { api: string; l: Row; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(l.name);
  const [options, setOptions] = useState<OptionDraft[]>(l.options.map((o) => ({ key: String(o.id), id: o.id, name: o.name })));
  const [nextKey, setNextKey] = useState(0);
  const [error, setError] = useState("");

  const update = (i: number, v: string) => setOptions(options.map((o, j) => (j === i ? { ...o, name: v } : o)));
  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOptions(next);
  };

  return (
    <form
      className="grid gap-3 py-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await wsCall(`${api}/status-labels/${l.id}`, "PATCH", {
          name,
          options: options.map((o) => (o.id === undefined ? { name: o.name } : { id: o.id, name: o.name })),
        });
        if (!r.ok) {
          setError(r.error || S.common.failed);
          return;
        }
        onDone();
        router.refresh();
      }}
    >
      <label className={ui.field}>
        {T.labelName}
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={MAX_STATUS_NAME} />
      </label>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-semibold">{T.options}</legend>
        {options.map((o, i) => (
          <div key={o.key} className="flex items-center gap-2">
            <input
              className="min-h-10 w-full min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-base"
              aria-label={T.optionName}
              value={o.name}
              onChange={(e) => update(i, e.target.value)}
              required
              maxLength={MAX_STATUS_NAME}
              // 「状態を追加」で増えた行にすぐ入力できるように
              autoFocus={o.id === undefined}
            />
            <button type="button" className={ui.secondary} aria-label={T.up} title={T.up} disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              className={ui.secondary}
              aria-label={T.down}
              title={T.down}
              disabled={i === options.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className={ui.secondary}
              aria-label={T.removeOption}
              title={T.removeOption}
              disabled={options.length <= 1}
              onClick={() => setOptions(options.filter((_, j) => j !== i))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <div className={ui.row}>
          <button
            type="button"
            className={ui.secondary}
            disabled={options.length >= MAX_STATUS_OPTIONS}
            onClick={() => {
              setOptions([...options, { key: `new-${nextKey}`, name: "" }]);
              setNextKey(nextKey + 1);
            }}
          >
            <Plus size={16} />
            <span>{T.addOption}</span>
          </button>
          <span className={ui.muted}>{T.removeOptionNote}</span>
        </div>
      </fieldset>
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

export function StatusLabelsTab(props: { slug: string; labels: Row[]; maxLabels: number }) {
  const router = useRouter();
  const api = workshopApi(props.slug);
  const [editing, setEditing] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newOptions, setNewOptions] = useState("");
  const [error, setError] = useState("");

  async function move(index: number, delta: number) {
    const ids = props.labels.map((l) => l.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    const r = await wsCall(`${api}/status-labels/reorder`, "PATCH", { ids });
    if (!r.ok) setError(r.error || S.common.failed);
    router.refresh();
  }

  return (
    <section className={`${ui.card} ${ui.stack}`}>
      <div>
        <h2>{T.labels}</h2>
        <p className={ui.muted}>{T.labelsHelp}</p>
      </div>
      {props.labels.length === 0 ? (
        <p className={ui.muted}>{T.noLabels}</p>
      ) : (
        <ul className="grid divide-y divide-line">
          {props.labels.map((l, i) => (
            <li key={l.id} className="py-2">
              {editing === l.id ? (
                <LabelEditor api={api} l={l} onDone={() => setEditing(null)} />
              ) : (
                <div className={ui.row}>
                  <div className="mr-auto grid min-w-0 gap-1">
                    <span className="font-semibold">{l.name}</span>
                    <span className="flex flex-wrap gap-1">
                      {l.options.map((o) => (
                        <span key={o.id} className={ui.statusBadge}>
                          {o.name}
                        </span>
                      ))}
                    </span>
                  </div>
                  <span className={ui.muted}>{T.usage(l.usage)}</span>
                  <button type="button" className={ui.secondary} aria-label={T.up} title={T.up} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className={ui.secondary}
                    aria-label={T.down}
                    title={T.down}
                    disabled={i === props.labels.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button type="button" className={ui.secondary} onClick={() => setEditing(l.id)}>
                    {T.edit}
                  </button>
                  <ApiButton url={`${api}/status-labels/${l.id}`} method="DELETE" confirm={T.removeConfirm}>
                    {S.admin.remove}
                  </ApiButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {props.labels.length < props.maxLabels ? (
        <form
          className="grid gap-3 border-t border-line pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const options = newOptions.split("\n").map((s) => s.trim()).filter(Boolean);
            const r = await wsCall(`${api}/status-labels`, "POST", { name: newName, options });
            if (r.ok) {
              setNewName("");
              setNewOptions("");
              router.refresh();
            } else setError(r.error || S.common.failed);
          }}
        >
          <h2>{T.addLabel}</h2>
          <label className={ui.field}>
            {T.labelName}
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required maxLength={MAX_STATUS_NAME} placeholder="進捗" />
          </label>
          <label className={ui.field}>
            <span>
              {T.options} <small>（{T.optionsHelp}）</small>
            </span>
            <textarea value={newOptions} onChange={(e) => setNewOptions(e.target.value)} rows={4} required placeholder={"作成中\n完成"} />
          </label>
          <div className={ui.row}>
            <button className={ui.primary} type="submit">
              {T.addLabel}
            </button>
          </div>
        </form>
      ) : null}
      {error ? <p className={ui.error}>{error}</p> : null}
    </section>
  );
}
