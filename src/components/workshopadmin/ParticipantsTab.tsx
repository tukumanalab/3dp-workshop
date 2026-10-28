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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "name">("newest");
  // id は autoincrement なので、id の降順が登録の新しい順になる
  const sorted = [...props.participants].sort((a, b) =>
    sort === "name" ? a.displayName.localeCompare(b.displayName, "ja") || a.loginId.localeCompare(b.loginId) : b.id - a.id,
  );
  // 削除された参加者が選択に残らないよう、いまの一覧との共通部分だけを使う。印刷も一覧と同じ順に並ぶよう、この順で渡す
  const selectedIds = sorted.filter((p) => selected.has(p.id)).map((p) => p.id);
  const q = query.trim().toLowerCase();
  const shown = q ? sorted.filter((p) => p.displayName.toLowerCase().includes(q) || p.loginId.toLowerCase().includes(q)) : sorted;
  const shownSelected = shown.filter((p) => selected.has(p.id)).length;
  const allShownSelected = shown.length > 0 && shownSelected === shown.length;

  /** 表示中の参加者だけを選択・解除する（絞り込みで隠れている人の選択はそのまま）。 */
  function setShown(on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      for (const p of shown) {
        if (on) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }

  function toggle(id: number, on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

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
            selectedIds.length > 0 ? (
              <Link className={ui.secondary} href={`/${props.slug}/admin/print?kind=cards&ids=${selectedIds.join(",")}`} target="_blank" rel="noopener">
                <Printer size={16} />
                <span>{T.printSelected(selectedIds.length)}</span>
              </Link>
            ) : (
              <button type="button" className={ui.secondary} disabled title={T.selectToPrint}>
                <Printer size={16} />
                <span>{S.admin.printCards}</span>
              </button>
            )
          ) : null}
        </div>
        {props.participants.length === 0 ? (
          <p className={ui.muted}>{T.none}</p>
        ) : (
          <>
            <p className={`${ui.muted} text-sm`}>{T.selectToPrint}</p>
            <div className={ui.row}>
              <label className={`${ui.field} min-w-48 flex-1`}>
                <span className="sr-only">{T.search}</span>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T.search} />
              </label>
              <label className={ui.field}>
                <span className="sr-only">{T.sort}</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "name")}>
                  <option value="newest">{T.sortNewest}</option>
                  <option value="name">{T.sortName}</option>
                </select>
              </label>
            </div>
            {q ? <p className={`${ui.muted} text-sm`}>{T.searchCount(shown.length, props.participants.length)}</p> : null}
          </>
        )}
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            {shown.length > 0 ? (
              <thead>
                <tr>
                  <th className="w-px border-b border-line px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label={q ? T.selectShown : T.selectAll}
                      checked={allShownSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = shownSelected > 0 && !allShownSelected;
                      }}
                      onChange={(e) => setShown(e.target.checked)}
                    />
                  </th>
                  <th colSpan={4} className="border-b border-line px-2 py-2 text-left text-sm font-normal">
                    {q ? T.selectShown : T.selectAll}
                  </th>
                </tr>
              </thead>
            ) : null}
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td className="w-px">
                    <input type="checkbox" aria-label={T.selectOne(p.displayName)} checked={selected.has(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />
                  </td>
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
