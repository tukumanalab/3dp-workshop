import { describe, expect, it } from "vitest";
import { editorModeFor } from "@/lib/editor";

describe("editorModeFor", () => {
  it("author opens in edit mode by default", () => {
    expect(editorModeFor({ canEdit: true, canRemix: true })).toBe("edit");
  });

  it("readonly=1 wins even for the author", () => {
    expect(editorModeFor({ canEdit: true, canRemix: true, readonly: "1" })).toBe("readonly");
  });

  it("remix only when explicitly requested and allowed", () => {
    expect(editorModeFor({ canEdit: false, canRemix: true, mode: "remix" })).toBe("remix");
    expect(editorModeFor({ canEdit: true, canRemix: true, mode: "remix" })).toBe("remix");
    expect(editorModeFor({ canEdit: false, canRemix: false, mode: "remix" })).toBe("readonly");
  });

  it("non-editors default to readonly instead of remix", () => {
    expect(editorModeFor({ canEdit: false, canRemix: true })).toBe("readonly");
    expect(editorModeFor({ canEdit: false, canRemix: false })).toBe("readonly");
  });
});
