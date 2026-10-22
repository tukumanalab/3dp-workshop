import { FileText, Link2 } from "lucide-react";
import type { serializeMaterial } from "@/lib/materials";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

type Material = ReturnType<typeof serializeMaterial>;

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** ギャラリーに出す資料の一覧（閲覧者に見えるものだけを渡すこと）。 */
export function MaterialList({ materials }: { materials: Material[] }) {
  if (materials.length === 0) return null;
  return (
    <section className={`${ui.card} mb-5 gap-2`} aria-label={S.materials.title}>
      <h2>{S.materials.title}</h2>
      <ul className="grid gap-1.5">
        {materials.map((m) => (
          <li key={m.id} className="flex min-w-0 items-center gap-2 text-sm">
            {m.type === "LINK" ? <Link2 size={16} className="shrink-0 text-muted" /> : <FileText size={16} className="shrink-0 text-muted" />}
            <a className="truncate font-semibold" href={m.url ?? "#"} {...(m.type === "LINK" ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {m.title}
            </a>
            {m.type === "FILE" ? <span className="shrink-0 text-muted">{formatBytes(m.byteSize)}</span> : null}
            {m.audience === "STAFF" ? <span className="shrink-0 text-muted">({S.materials.audience.STAFF})</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
