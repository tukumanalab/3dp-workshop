import { notFound, redirect } from "next/navigation";
import { EditorFrame } from "@/components/EditorFrame";
import { Topbar } from "@/components/Topbar";
import { canCreateProject, canViewSession } from "@/lib/access";
import { config } from "@/lib/env";
import { editorAvailable } from "@/lib/editor";
import { loadWorkshopPage } from "@/lib/pages";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { viewer, workshop, sessions } = await loadWorkshopPage(slug);
  if (!canCreateProject(workshop, viewer)) redirect(viewer.user ? `/${slug}` : `/${slug}/join`);
  const requested = sp.sessionId ? sessions.find((s) => String(s.id) === sp.sessionId) : undefined;
  if (sp.sessionId && (!requested || !canViewSession(workshop, requested, viewer))) notFound();
  const session = requested ?? sessions[0];
  if (!session) notFound();
  if (!editorAvailable()) {
    return (
      <main className={ui.shell}>
        <Topbar />
        <div className={ui.hint}>{S.editor.devHint}</div>
      </main>
    );
  }
  return <EditorFrame slug={slug} sessionId={session.id} title={S.editor.newTitle} editorBase={config.editorBaseUrl} />;
}
