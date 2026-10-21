"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WORKSHOP_VISIBILITIES } from "@/lib/access";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { adminCall } from "./api";

type WorkshopRow = {
  slug: string;
  title: string;
  visibility: string;
  isOpen: boolean;
  owner: { id: number; name: string; email: string };
  participantCount: number;
  projectCount: number;
  isMember: boolean;
};

const inputCls = "min-h-9 rounded-lg border border-line bg-canvas px-2";

export function WorkshopsPanel() {
  const t = S.siteAdmin.workshops;
  const [rows, setRows] = useState<WorkshopRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useState("");
  const [error, setError] = useState("");
  const [ownerFor, setOwnerFor] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [keepPrev, setKeepPrev] = useState(false);

  const load = useCallback(async () => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (visibility) sp.set("visibility", visibility);
    const r = await adminCall<{ workshops: WorkshopRow[] }>(`/workshops?${sp}`);
    if (r.ok) setRows(r.data.workshops);
    else setError(r.error || S.common.failed);
    setLoaded(true);
  }, [q, visibility]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(path: string, method: string, body?: unknown) {
    setError("");
    const r = await adminCall(path, method, body);
    if (!r.ok) setError(r.error || S.common.failed);
    await load();
    return r.ok;
  }

  return (
    <section className={`${ui.card} ${ui.stack}`}>
      <div className={ui.controls}>
        <input className="min-h-10 rounded-lg border border-line bg-canvas px-3 text-base" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} />
        <select className="min-h-10 rounded-lg border border-line bg-canvas px-3 text-base" value={visibility} onChange={(e) => setVisibility(e.target.value)} aria-label={t.visibility}>
          <option value="">{t.allVisibilities}</option>
          {WORKSHOP_VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {S.visibility[v]}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className={ui.error}>{error}</p> : null}
      {rows.length === 0 ? (
        <p className={ui.muted}>{loaded ? t.empty : S.common.loading}</p>
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr className="text-left text-muted">
                <td>{t.title}</td>
                <td>{t.owner}</td>
                <td>{t.visibility}</td>
                <td>{t.open}</td>
                <td>{t.counts}</td>
                <td />
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.slug}>
                  <td>
                    <Link href={`/${w.slug}`}>{w.title}</Link> <span className={ui.muted}>/{w.slug}</span>
                  </td>
                  <td>
                    {w.owner.name} <span className={ui.muted}>{w.owner.email}</span>
                  </td>
                  <td>
                    <select className={inputCls} value={w.visibility} aria-label={t.visibility} onChange={(e) => run(`/workshops/${w.slug}`, "PATCH", { visibility: e.target.value })}>
                      {WORKSHOP_VISIBILITIES.map((v) => (
                        <option key={v} value={v}>
                          {S.visibility[v]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button type="button" className={ui.secondary} onClick={() => run(`/workshops/${w.slug}`, "PATCH", { isOpen: !w.isOpen })}>
                      {w.isOpen ? t.opened : t.closed}
                    </button>
                  </td>
                  <td>
                    {w.participantCount} / {w.projectCount}
                  </td>
                  <td>
                    <span className={ui.row}>
                      <button
                        type="button"
                        className={ui.secondary}
                        onClick={() => {
                          setOwnerFor(ownerFor === w.slug ? null : w.slug);
                          setOwnerEmail("");
                          setKeepPrev(false);
                        }}
                      >
                        {t.changeOwner}
                      </button>
                      <button
                        type="button"
                        className={ui.secondary}
                        onClick={async () => {
                          if (window.confirm(t.deleteConfirm)) await run(`/workshops/${w.slug}`, "DELETE");
                        }}
                      >
                        <span className={ui.danger}>{t.delete}</span>
                      </button>
                    </span>
                    {ownerFor === w.slug ? (
                      <form
                        className={`${ui.row} mt-2`}
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!window.confirm(t.changeOwnerConfirm)) return;
                          if (await run(`/workshops/${w.slug}/owner`, "POST", { email: ownerEmail, keepPreviousOwnerAsStaff: keepPrev })) setOwnerFor(null);
                        }}
                      >
                        <input className={inputCls} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder={t.ownerEmail} aria-label={t.ownerEmail} required />
                        <label className={ui.row}>
                          <input type="checkbox" checked={keepPrev} onChange={(e) => setKeepPrev(e.target.checked)} />
                          <span>{t.keepPrevious}</span>
                        </label>
                        <button className={ui.primary} type="submit">
                          {t.changeOwner}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
