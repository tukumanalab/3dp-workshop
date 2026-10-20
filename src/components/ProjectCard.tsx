import Link from "next/link";
import type { ProjectCard as Card } from "@/lib/gallery";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export function ProjectCardView({ slug, p }: { slug: string; p: Card }) {
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
          {p.authorName}
          {p.mine && !p.isShared ? ` · ${S.workshop.private}` : ""}
          {p.isRemixOfUid ? ` · ${S.workshop.remix}` : ""}
        </span>
      </Link>
    </article>
  );
}
