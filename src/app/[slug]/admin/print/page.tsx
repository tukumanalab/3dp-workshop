import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/PrintButton";
import { isWorkshopStaff } from "@/lib/access";
import { config } from "@/lib/env";
import { prisma } from "@/lib/db";
import { loadWorkshopPage } from "@/lib/pages";
import { getSiteSettings } from "@/lib/siteSettings";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

const T = S.admin.print;

/** 自前で生成した QR の SVG 文字列（入力は URL のみ）。 */
const qrSvg = (text: string) => QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

/** "1,2,3" を正の整数の配列にする（不正な要素は捨てる）。 */
const parseIds = (raw: string | undefined) =>
  (raw ?? "")
    .split(",")
    .map((v) => Number(v))
    .filter((n) => Number.isSafeInteger(n) && n > 0);

function Qr({ svg, className }: { svg: string; className: string }) {
  return <div className={`${className} [&_svg]:h-full [&_svg]:w-full`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kind?: string; ids?: string }>;
}) {
  const { slug } = await params;
  const { kind, ids: rawIds } = await searchParams;
  const ids = parseIds(rawIds);
  const { viewer, workshop } = await loadWorkshopPage(slug);
  if (!isWorkshopStaff(workshop, viewer)) {
    const next = kind === "cards" ? `kind=cards${ids.length ? `&ids=${ids.join(",")}` : ""}` : "kind=join";
    if (!viewer.user) redirect(`/login?next=${encodeURIComponent(`/${slug}/admin/print?${next}`)}`);
    notFound();
  }
  const base = `${config.appOrigin}/3dp/${slug}/join`;
  // 印刷画面は管理画面から別タブで開くので「戻る」は付けない
  const toolbar = (
    <div className={`${ui.row} print:hidden`}>
      <PrintButton />
    </div>
  );

  if (kind === "cards") {
    const site = await getSiteSettings();
    const participants = await prisma.participant.findMany({
      where: { workshopId: workshop.id, deletedAt: null, ...(ids.length ? { id: { in: ids } } : {}) },
      orderBy: { id: "asc" },
    });
    // ids があれば、その順（管理画面の一覧の並び）で印刷する
    if (ids.length) participants.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    const cards = await Promise.all(
      participants.map(async (p) => ({ ...p, svg: await qrSvg(`${base}?id=${encodeURIComponent(p.loginId)}`) })),
    );
    return (
      <main className="min-h-dvh bg-white p-4 text-black print:p-0">
        <div className="mx-auto grid max-w-4xl gap-4">
          {toolbar}
          <p className="text-sm print:hidden">{T.cardsHint}</p>
          {cards.length === 0 ? <p>{T.noParticipants}</p> : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-black/40 p-3 break-inside-avoid">
                <Qr svg={c.svg} className="h-28 w-28 shrink-0" />
                <div className="grid min-w-0 gap-1">
                  <span className="truncate text-xs">
                    {site.effectiveName} / {workshop.title}
                  </span>
                  <span className="truncate text-lg font-bold">{c.displayName}</span>
                  <span className="text-xs">{S.join.loginId}</span>
                  <span className="font-mono text-xl font-extrabold tracking-wider">{c.loginId}</span>
                  <span className="break-all font-mono text-[10px]">{base}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const joinUrl = workshop.joinCode ? `${base}?code=${workshop.joinCode}` : base;
  const svg = await qrSvg(joinUrl);
  return (
    <main className="min-h-dvh bg-white p-4 text-black print:p-0">
      <div className="mx-auto grid max-w-2xl gap-6">
        {toolbar}
        <div className="grid justify-items-center gap-5 text-center">
          <h1 className="text-3xl font-extrabold">{workshop.title}</h1>
          <h2 className="text-xl font-bold">{T.joinTitle}</h2>
          <Qr svg={svg} className="aspect-square w-72 max-w-full" />
          <ol className="grid list-decimal gap-2 pl-6 text-left">
            <li>{T.joinStep1}</li>
            <li>{T.joinStep2}</li>
          </ol>
          <p className="break-all font-mono text-sm">{joinUrl}</p>
          {workshop.joinCode ? (
            <div className="grid gap-1">
              <span className="text-sm">{S.admin.joinCode}</span>
              <span className="font-mono text-4xl font-extrabold tracking-widest">{workshop.joinCode}</span>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
