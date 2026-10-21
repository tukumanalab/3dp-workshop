"use client";

import { useCallback, useEffect, useState } from "react";
import { USER_ROLES, USER_STATUSES } from "@/lib/access";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { adminCall } from "./api";

type UserRow = {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  hasGoogle: boolean;
  workshopCount: number;
  projectCount: number;
};

const PAGE_SIZE = 50;

export function UsersPanel({ selfId }: { selfId: number }) {
  const t = S.siteAdmin.users;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("organizer");

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q.trim()) sp.set("q", q.trim());
    if (role) sp.set("role", role);
    if (status) sp.set("status", status);
    const r = await adminCall<{ users: UserRow[]; total: number }>(`/users?${sp}`);
    if (r.ok) {
      setUsers(r.data.users);
      setTotal(r.data.total);
    } else setError(r.error || S.common.failed);
    setLoaded(true);
  }, [page, q, role, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(u: UserRow, body: Record<string, string>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError("");
    const r = await adminCall(`/users/${u.id}`, "PATCH", body);
    if (!r.ok) setError(r.error || S.common.failed);
    await load();
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={ui.stack}>
      <form
        className={`${ui.card} ${ui.stack}`}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const r = await adminCall("/users", "POST", { email: newEmail, name: newName, role: newRole });
          if (r.ok) {
            setNewEmail("");
            setNewName("");
            setNewRole("organizer");
            await load();
          } else setError(r.error || S.common.failed);
        }}
      >
        <h2>{t.preregister}</h2>
        <p className={ui.muted}>{t.preregisterHint}</p>
        <div className={ui.row}>
          <label className={ui.field}>
            {t.email}
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required maxLength={254} />
          </label>
          <label className={ui.field}>
            {t.name}
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required maxLength={100} />
          </label>
          <label className={ui.field}>
            {t.role}
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {S.siteAdmin.roles[r]}
                </option>
              ))}
            </select>
          </label>
          <button className={ui.primary} type="submit">
            {t.add}
          </button>
        </div>
      </form>

      <section className={`${ui.card} ${ui.stack}`}>
        <form
          className={ui.controls}
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            void load();
          }}
        >
          <input
            className="min-h-10 rounded-lg border border-line bg-canvas px-3 text-base"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t.search}
            aria-label={t.search}
          />
          <select
            className="min-h-10 rounded-lg border border-line bg-canvas px-3 text-base"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            aria-label={t.role}
          >
            <option value="">{t.allRoles}</option>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {S.siteAdmin.roles[r]}
              </option>
            ))}
          </select>
          <select
            className="min-h-10 rounded-lg border border-line bg-canvas px-3 text-base"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label={t.status}
          >
            <option value="">{t.allStatuses}</option>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {S.siteAdmin.statuses[s]}
              </option>
            ))}
          </select>
        </form>
        {error ? <p className={ui.error}>{error}</p> : null}
        {users.length === 0 ? (
          <p className={ui.muted}>{loaded ? t.empty : S.common.loading}</p>
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr className="text-left text-muted">
                  <td>{t.name}</td>
                  <td>{t.email}</td>
                  <td>{t.role}</td>
                  <td>{t.status}</td>
                  <td>{t.counts}</td>
                  <td />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === selfId;
                  const editing = editId === u.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        {editing ? (
                          <input className="min-h-9 rounded-lg border border-line bg-canvas px-2" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} aria-label={t.name} />
                        ) : (
                          u.name
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input className="min-h-9 rounded-lg border border-line bg-canvas px-2" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} maxLength={254} aria-label={t.email} />
                        ) : (
                          u.email
                        )}
                      </td>
                      <td>
                        <select
                          className="min-h-9 rounded-lg border border-line bg-canvas px-2"
                          value={u.role}
                          disabled={isSelf}
                          aria-label={t.role}
                          onChange={(e) => patch(u, { role: e.target.value }, u.role === "admin" ? t.demoteConfirm : undefined)}
                        >
                          {USER_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {S.siteAdmin.roles[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="min-h-9 rounded-lg border border-line bg-canvas px-2"
                          value={u.status}
                          disabled={isSelf}
                          aria-label={t.status}
                          onChange={(e) => patch(u, { status: e.target.value }, e.target.value === "SUSPENDED" ? t.suspendConfirm : undefined)}
                        >
                          {USER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {S.siteAdmin.statuses[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {u.workshopCount} / {u.projectCount}
                      </td>
                      <td>
                        {isSelf ? (
                          <span className={ui.muted}>{S.siteAdmin.selfRow}</span>
                        ) : (
                          <span className={ui.row}>
                            {editing ? (
                              <button
                                type="button"
                                className={ui.primary}
                                onClick={async () => {
                                  await patch(u, { name: editName, email: editEmail });
                                  setEditId(null);
                                }}
                              >
                                {t.saveEdit}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={ui.secondary}
                                onClick={() => {
                                  setEditId(u.id);
                                  setEditName(u.name);
                                  setEditEmail(u.email);
                                }}
                              >
                                {t.edit}
                              </button>
                            )}
                            <button
                              type="button"
                              className={ui.secondary}
                              onClick={async () => {
                                if (!window.confirm(t.deleteConfirm)) return;
                                setError("");
                                const r = await adminCall(`/users/${u.id}`, "DELETE");
                                if (!r.ok) setError(r.error || S.common.failed);
                                await load();
                              }}
                            >
                              <span className={ui.danger}>{t.delete}</span>
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {lastPage > 1 ? (
          <div className={ui.row}>
            <button type="button" className={ui.secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t.prev}
            </button>
            <span className={ui.muted}>
              {page} / {lastPage}
            </span>
            <button type="button" className={ui.secondary} disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
              {t.next}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
