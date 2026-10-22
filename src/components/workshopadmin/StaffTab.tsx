"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiButton } from "../ApiButton";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { workshopApi, wsCall } from "./api";

type Member = { userId: number; name: string; email: string };
type Candidate = { id: number; name: string; email: string };

export function StaffTab(props: { slug: string; canManage: boolean; owner: Member; staff: Member[] }) {
  const router = useRouter();
  const api = workshopApi(props.slug);
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState("");

  // 入力が止まってから候補を検索する
  useEffect(() => {
    if (!props.canManage) return;
    const term = q.trim();
    if (term.length < 2) {
      setCandidates(null);
      return;
    }
    const t = setTimeout(async () => {
      const r = await wsCall<{ users: Candidate[] }>(`${api}/staff/candidates?q=${encodeURIComponent(term)}`);
      setCandidates(r.ok ? r.data.users : []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, api, props.canManage]);

  async function add(userId: number) {
    setError("");
    const r = await wsCall(`${api}/staff`, "POST", { userId });
    if (!r.ok) {
      setError(r.error || S.common.failed);
      return;
    }
    setQ("");
    setCandidates(null);
    router.refresh();
  }

  return (
    <div className={ui.stack}>
      <section className={`${ui.card} ${ui.stack}`}>
        <h2>{S.admin.tabs.staff}</h2>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <tbody>
              <tr>
                <td>{props.owner.name}</td>
                <td className="text-muted">{props.owner.email}</td>
                <td>{S.admin.staff.owner}</td>
                <td />
              </tr>
              {props.staff.map((m) => (
                <tr key={m.userId}>
                  <td>{m.name}</td>
                  <td className="text-muted">{m.email}</td>
                  <td>{S.admin.staff.coOrganizer}</td>
                  <td>
                    {props.canManage ? (
                      <div className={ui.row}>
                        <ApiButton url={`${api}/owner`} body={{ userId: m.userId }} confirm={S.admin.staff.transferConfirm}>
                          {S.admin.staff.transfer}
                        </ApiButton>
                        <ApiButton url={`${api}/staff/${m.userId}`} method="DELETE" confirm={S.admin.staff.removeConfirm}>
                          {S.admin.staff.remove}
                        </ApiButton>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!props.canManage ? <p className={ui.muted}>{S.admin.staff.ownerOnly}</p> : null}
      </section>

      {props.canManage ? (
        <section className={`${ui.card} ${ui.stack}`}>
          <h2>{S.admin.staff.add}</h2>
          <label className={ui.field}>
            {S.admin.staff.searchLabel}
            <input value={q} onChange={(e) => setQ(e.target.value)} type="search" autoComplete="off" />
          </label>
          {candidates && candidates.length === 0 ? <p className={ui.muted}>{S.admin.staff.noCandidates}</p> : null}
          {candidates && candidates.length > 0 ? (
            <ul className="grid gap-2">
              {candidates.map((c) => (
                <li key={c.id} className={ui.row}>
                  <span className="font-semibold">{c.name}</span>
                  <span className={ui.muted}>{c.email}</span>
                  <button type="button" className={ui.secondary} onClick={() => add(c.id)}>
                    {S.admin.staff.addButton}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className={ui.error}>{error}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
