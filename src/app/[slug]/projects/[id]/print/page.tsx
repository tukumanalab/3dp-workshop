import { PrintButton } from "@/components/PrintButton";
import { Qr } from "@/components/Qr";
import { prisma } from "@/lib/db";
import { projectPageUrl, thumbnailUrl } from "@/lib/gallery";
import { loadProjectPage } from "@/lib/pages";
import { qrSvg } from "@/lib/qr";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** デザインの情報を A6 縦 1 枚にまとめて印刷するカード。デザインページから別タブで開く。 */
export default async function ProjectCardPrintPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { ctx } = await loadProjectPage(slug, id);
  const { project } = ctx;
  const full = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { participant: { select: { displayName: true } }, user: { select: { name: true } } },
  });
  const author = full.participant?.displayName ?? full.user?.name ?? "";
  const url = projectPageUrl(slug, project.uid);
  const svg = await qrSvg(url);

  return (
    <main className="grid min-h-dvh grid-cols-[minmax(0,1fr)] justify-items-center content-start gap-4 bg-white p-4 text-black print:block print:min-h-0 print:p-0">
      {/* A6 縦。Chromium は @page の size に A6 という名前を使えないので寸法で書く。body の min-h-dvh が残ると 2 ページ目以降が出る */}
      <style>{"@page { size: 105mm 148mm; margin: 0 } @media print { body { min-height: 0 } }"}</style>
      <div className="grid justify-items-center gap-2 print:hidden">
        <div className={ui.row}>
          <PrintButton />
        </div>
        {!project.isShared ? <p className="max-w-[105mm] text-sm">{S.project.notShared}</p> : null}
      </div>
      <article className="flex h-[148mm] w-[105mm] max-w-full flex-col gap-[3mm] overflow-hidden border border-black/40 bg-white p-[7mm] break-inside-avoid print:max-w-none print:border-0">
        <header className="shrink-0">
          <h1 className="line-clamp-2 text-xl leading-tight font-extrabold break-words">{project.title}</h1>
          <p className="mt-[1mm] truncate text-sm">
            {S.workshop.by}: {author}
          </p>
        </header>
        {project.hasThumbnail ? (
          <div className="relative min-h-0 flex-[3] border border-black/20">
            <img
              className="absolute inset-0 h-full w-full object-contain p-[1mm]"
              src={thumbnailUrl(project.uid, project.headVersionTs)}
              alt={project.title}
            />
          </div>
        ) : null}
        {/* 行の途中で切れないよう、題名が 2 行でも収まる行数で省略する。伸縮は外側の箱で受ける（段落が伸びると省略した先の行が見える） */}
        <div className="min-h-0 flex-[2] overflow-hidden">
          <p
            className={`text-sm leading-snug break-words whitespace-pre-wrap ${
              project.hasThumbnail ? "line-clamp-6" : "line-clamp-[16]"
            }`}
          >
            {project.description}
          </p>
        </div>
        <footer className="flex shrink-0 items-center gap-[3mm]">
          <Qr svg={svg} className="h-[25mm] w-[25mm] shrink-0" />
          <p className="min-w-0 font-mono text-[9px] leading-snug break-all">{url}</p>
        </footer>
      </article>
    </main>
  );
}
