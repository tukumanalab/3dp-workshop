import { notFound } from "next/navigation";
import { EditorFrame } from "@/components/EditorFrame";
import { Topbar } from "@/components/Topbar";
import { canCreateProject, canEditProject } from "@/lib/access";
import { config } from "@/lib/env";
import { editorAvailable, editorModeFor } from "@/lib/editor";
import { galleryBackParam } from "@/lib/gallery";
import { loadProjectPage } from "@/lib/pages";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ProjectEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ mode?: string; readonly?: string; back?: string }>;
}) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { viewer, ctx } = await loadProjectPage(slug, id);
  if (!editorAvailable()) return <EditorHint />;

  const mode = editorModeFor({
    canEdit: canEditProject(ctx.workshop, ctx.project, viewer),
    canRemix: canCreateProject(ctx.workshop, viewer),
    mode: sp.mode,
    readonly: sp.readonly,
  });
  if (!ctx.project.headVersionTs) notFound();

  return (
    <EditorFrame
      slug={slug}
      projectId={ctx.project.uid}
      mode={mode === "remix" ? "remix" : undefined}
      readonly={mode === "readonly"}
      title={ctx.project.title}
      editorBase={config.editorBaseUrl}
      back={galleryBackParam(new URLSearchParams(sp.back ?? ""))}
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
