import Link from "next/link";
import { ExternalLink, ListFilter, X } from "lucide-react";
import { noneToken, toggleStatusFilter, type StatusFilterToken, type StatusLabelView } from "@/lib/statuses";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

/** ギャラリーの状態での絞り込み。ふだんは閉じておき、絞り込み中だけ開いた状態で出す。 */
export function StatusFilter({
  labels,
  tokens,
  hrefFor,
}: {
  labels: StatusLabelView[];
  /** 有効な（定義に存在する）トークンだけ */
  tokens: StatusFilterToken[];
  hrefFor: (tokens: StatusFilterToken[]) => string;
}) {
  const active = tokens.length > 0;
  const chip = (token: StatusFilterToken, label: string) => {
    const on = tokens.includes(token);
    return (
      <Link
        key={token}
        className={on ? ui.chipActive : ui.chip}
        aria-pressed={on}
        href={hrefFor(toggleStatusFilter(labels, tokens, token))}
        scroll={false}
      >
        {label}
      </Link>
    );
  };
  return (
    <details className={ui.filterBox} open={active}>
      <summary className={ui.filterSummary}>
        <ListFilter size={16} aria-hidden="true" />
        <span>{S.statuses.filter}</span>
        {active ? <span className="text-xs font-normal text-muted">{S.statuses.filterCount(tokens.length)}</span> : null}
      </summary>
      <div className="grid gap-2.5 pt-3">
        {labels.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-1.5" role="group" aria-label={l.name}>
            <span className="mr-1 text-xs font-bold text-muted">{l.name}</span>
            {l.options.map((o) => chip(String(o.id), o.name))}
            {chip(noneToken(l.id), S.statuses.unset)}
          </div>
        ))}
        <p className={ui.muted}>
          {S.statuses.filterHelp}
          {active ? ` ${S.statuses.liveHelp}` : ""}
        </p>
        {active ? (
          <div className={ui.row}>
            <Link className={`${ui.chip} inline-flex items-center gap-1`} href={hrefFor([])} scroll={false}>
              <X size={14} aria-hidden="true" />
              <span>{S.statuses.filterClear}</span>
            </Link>
            {/* 同じ条件の一覧を別タブで開いたままにしておける（どのタブでも自動で更新される） */}
            <Link className={`${ui.chip} inline-flex items-center gap-1`} href={hrefFor(tokens)} target="_blank" rel="noopener">
              <ExternalLink size={14} aria-hidden="true" />
              <span>{S.statuses.openInNewTab}</span>
            </Link>
          </div>
        ) : null}
      </div>
    </details>
  );
}
