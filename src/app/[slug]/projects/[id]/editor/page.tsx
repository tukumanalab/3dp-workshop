import { notFound } from "next/navigation";
import { EditorFrame } from "@/components/EditorFrame";
import { Topbar } from "@/components/Topbar";
import { canCreateProject, canEditProject } from "@/lib/access";
import { config } from "@/lib/env";
import { editorAvailable } from "@/lib/editor";
import { loadProjectPage } from "@/lib/pages";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ProjectEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ mode?: string; readonly?: string }>;
}) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { viewer, ctx } = await loadProjectPage(slug, id);
  if (!editorAvailable()) return <EditorHint />;

  const canEdit = canEditProject(ctx.workshop, ctx.project, viewer);
  const canRemix = canCreateProject(ctx.workshop, viewer);
  let mode: "remix" | undefined;
  let readonly = false;
  if (sp.readonly === "1") readonly = true;
  else if (sp.mode === "remix" && canRemix) mode = "remix";
  else if (!canEdit) {
    if (canRemix) mode = "remix";
    else readonly = true;
  }
  if (!ctx.project.headVersionTs) notFound();

  return (
    <EditorFrame
      slug={slug}
      projectId={ctx.project.uid}
      mode={mode}
      readonly={readonly}
      title={ctx.project.title}
      editorBase={config.editorBaseUrl}
    />
  );
}

function EditorHint() {
  return (
    <main className={ui.shell}>
      <Topbar />
      <div className={ui.hint}>{S.editor.devHint}</div>
    </main>
  );
}
