import { Footer, Topbar } from "@/components/Topbar";
import { JoinForm } from "@/components/JoinForm";
import { loadWorkshopPage } from "@/lib/pages";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { workshop } = await loadWorkshopPage(slug, { requireView: false });
  return (
    <main className={ui.shell}>
      <Topbar center={workshop.title} />
      <div>
        <div className={ui.narrow}>
          <h1 className={ui.h1}>{S.join.title}</h1>
          <p className={ui.muted}>{workshop.title}</p>
          <JoinForm slug={slug} initialCode={sp.code ?? ""} />
          <Footer />
        </div>
      </div>
    </main>
  );
}
