"use client";

import Link from "next/link";
import { ApiButton } from "../ApiButton";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

type Row = {
  id: string;
  title: string;
  authorName: string;
  sessionName: string;
  isShared: boolean;
  isTeachingMaterial: boolean;
  updatedAt: string;
};
const T = S.admin.projectsTab;

export function ProjectsTab(props: { slug: string; projects: Row[] }) {
  if (props.projects.length === 0) {
    return (
      <section className={ui.card}>
        <p className={ui.muted}>{T.none}</p>
      </section>
    );
  }
  return (
    <section className={`${ui.card} ${ui.stack}`}>
      <h2>
        {S.admin.tabs.projects} ({props.projects.length})
      </h2>
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-2 py-1">{T.title}</th>
              <th className="px-2 py-1">{T.author}</th>
              <th className="px-2 py-1">{T.session}</th>
              <th className="px-2 py-1">{T.state}</th>
              <th className="px-2 py-1">{T.updated}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {props.projects.map((p) => {
              const api = `/3dp/api/projects/${p.id}`;
              return (
                <tr key={p.id}>
                  <td className="max-w-60 truncate">
                    <Link href={`/${props.slug}/projects/${p.id}`}>{p.title}</Link>
                  </td>
                  <td>{p.authorName}</td>
                  <td>{p.sessionName}</td>
                  <td>
                    {p.isShared ? S.workshop.shared : S.workshop.private}
                    {p.isTeachingMaterial ? ` · ${S.workshop.teaching}` : ""}
                  </td>
                  <td>{p.updatedAt}</td>
                  <td>
                    <div className={ui.row}>
                      <ApiButton url={`${api}/${p.isShared ? "unshare" : "share"}`}>{p.isShared ? S.project.unshare : S.project.share}</ApiButton>
                      <ApiButton url={api} method="PATCH" body={{ isTeachingMaterial: !p.isTeachingMaterial }}>
                        {p.isTeachingMaterial ? S.project.unsetTeaching : S.project.setTeaching}
                      </ApiButton>
                      <ApiButton url={api} method="DELETE" confirm={S.project.deleteConfirm}>
                        <span className={ui.danger}>{S.common.delete}</span>
                      </ApiButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
