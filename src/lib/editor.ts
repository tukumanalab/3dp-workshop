import { config } from "./env";

/** 開発時にエディタが同一オリジンで見られる設定か。本番は Nginx が配信する前提で常に true。 */
export function editorAvailable(): boolean {
  if (config.isProd) return true;
  if (process.env.EDITOR_DEV_URL) return true;
  // 既定(/3dp/editor/)以外が明示されていれば利用可とみなす
  return !!process.env.EDITOR_BASE_URL && process.env.EDITOR_BASE_URL !== "/3dp/editor/";
}

export type EditorMode = "edit" | "remix" | "readonly";

/** エディタをどのモードで開くか。リミックスは明示指定のときだけ。編集できない人の既定は閲覧専用（保存しない）。 */
export function editorModeFor(o: {
  canEdit: boolean;
  canRemix: boolean;
  mode?: string;
  readonly?: string;
}): EditorMode {
  if (o.readonly === "1") return "readonly";
  if (o.mode === "remix" && o.canRemix) return "remix";
  return o.canEdit ? "edit" : "readonly";
}
