import Link from "next/link";
import type { ProjectCard as Card } from "@/lib/gallery";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export function ProjectCardView({
  slug,
  p,
  showSession = false,
  hideAuthor = false,
}: {
  slug: string;
  p: Card;
  /** セッションを横断して並べるとき、どのセッションの作品かを出す */
  showSession?: boolean;
  /** 作者ごとの見出しの下に並べるとき、作者名を省く */
  hideAuthor?: boolean;
}) {
  const meta = [
    hideAuthor ? null : p.authorName,
    showSession ? p.sessionName : null,
    p.mine && !p.isShared ? S.workshop.private : null,
    p.isRemixOfUid ? S.workshop.remix : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className={ui.cardItem}>
      <Link className={ui.cardLink} href={`/${slug}/projects/${p.id}`}>
        <span className={ui.stage} aria-hidden="true">
          {p.thumbnailUrl ? (
            <img className={ui.thumb} src={p.thumbnailUrl} alt="" loading="lazy" />
          ) : (
            <>
              <span className={ui.emptyMark}>{S.workshop.noSnapshot}</span>
            </>
          )}
        </span>
        <span className={ui.cardTitle}>{p.title}</span>
        <span className={ui.cardMeta}>
          {meta}
        </span>
        {p.statuses.length > 0 ? (
          <span className={ui.statusBadges}>
            {p.statuses.map((st) => (
              <span key={st.labelId} className={ui.statusBadge} title={`${st.labelName}: ${st.optionName}`}>
                {st.optionName}
              </span>
            ))}
          </span>
        ) : null}
      </Link>
    </article>
  );
}
