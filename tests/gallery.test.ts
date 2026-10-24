import { describe, expect, it } from "vitest";
import {
  galleryBackHref,
  galleryBackParam,
  groupProjectsByAuthor,
  normalizeSearchText,
  parseProjectSort,
  parseSearchQuery,
  projectHref,
  projectsDigest,
  searchProjects,
  sortProjects,
  type ProjectCard,
} from "@/lib/gallery";

const card = (id: string, authorKey: string, authorName: string, day: number): ProjectCard => ({
  id,
  title: id,
  description: "",
  sessionId: 1,
  sessionName: "A",
  authorKey,
  authorName,
  isShared: true,
  isTeachingMaterial: false,
  mine: false,
  thumbnailUrl: null,
  updatedAt: new Date(Date.UTC(2026, 0, day)),
  isRemixOfUid: null,
  statuses: [],
});

const cards = [
  card("u1", "p:1", "うえだ", 1),
  card("a1", "p:2", "あべ", 2),
  card("u2", "p:1", "うえだ", 9),
  card("a2", "p:2", "あべ", 5),
  card("i1", "p:3", "いとう", 7),
  card("a3", "p:4", "あべ", 8), // 同名の別人
];

describe("groupProjectsByAuthor", () => {
  it("各人の作品を更新日時の新しい順に並べる", () => {
    const g = groupProjectsByAuthor(cards, "name");
    expect(g.find((x) => x.key === "p:1")!.projects.map((p) => p.id)).toEqual(["u2", "u1"]);
    expect(g.find((x) => x.key === "p:2")!.projects.map((p) => p.id)).toEqual(["a2", "a1"]);
  });

  it("名前順（五十音）で、同名は最新更新の新しい人が先", () => {
    expect(groupProjectsByAuthor(cards, "name").map((x) => x.key)).toEqual(["p:4", "p:2", "p:3", "p:1"]);
  });

  it("更新が新しい順", () => {
    const g = groupProjectsByAuthor(cards, "recent");
    expect(g.map((x) => x.key)).toEqual(["p:1", "p:4", "p:3", "p:2"]);
    expect(g[0].latest).toEqual(new Date(Date.UTC(2026, 0, 9)));
  });

  it("作品が無ければ空", () => {
    expect(groupProjectsByAuthor([], "name")).toEqual([]);
  });
});

describe("sortProjects", () => {
  const items = [
    { ...card("x1", "p:1", "a", 9), title: "ロケット10" },
    { ...card("x2", "p:1", "a", 3), title: "あひる" },
    { ...card("x3", "p:2", "b", 5), title: "ロケット2" },
    { ...card("x4", "p:3", "c", 7), title: "あひる" },
  ];

  it("更新が新しい順", () => {
    expect(sortProjects(items, "recent").map((p) => p.id)).toEqual(["x1", "x4", "x3", "x2"]);
  });

  it("タイトル順（数字は数値で比べ、同じタイトルは更新が新しい方が先）", () => {
    expect(sortProjects(items, "title").map((p) => p.id)).toEqual(["x4", "x2", "x3", "x1"]);
  });

  it("元の配列は変えない", () => {
    sortProjects(items, "title");
    expect(items.map((p) => p.id)).toEqual(["x1", "x2", "x3", "x4"]);
  });

  it("不明な sort は更新順", () => {
    expect(parseProjectSort(undefined)).toBe("recent");
    expect(parseProjectSort("bogus")).toBe("recent");
    expect(parseProjectSort("title")).toBe("title");
  });
});

describe("search", () => {
  const items = [
    { ...card("s1", "p:1", "やまだ", 1), title: "ロケット", description: "宇宙へ飛ぶ" },
    { ...card("s2", "p:2", "Tanaka", 2), title: "あひるのボート", description: "" },
    { ...card("s3", "p:3", "すずき", 3), title: "車", description: "タイヤが4つのクルマ" },
  ];
  const ids = (q: string) => searchProjects(items, parseSearchQuery(q)).map((p) => p.id);

  it("全角半角・大文字小文字・カタカナとひらがなを同一視する", () => {
    expect(normalizeSearchText("ＡＢＣ１２３ ロケット")).toBe("abc123 ろけっと");
  });

  it("空白（全角を含む）で語に分け、10 語まで", () => {
    expect(parseSearchQuery(undefined)).toEqual([]);
    expect(parseSearchQuery("  　 ")).toEqual([]);
    expect(parseSearchQuery("ろけっと　宇宙 ")).toEqual(["ろけっと", "宇宙"]);
    expect(parseSearchQuery(Array.from({ length: 12 }, (_, i) => `w${i}`).join(" "))).toHaveLength(10);
  });

  it("タイトル・作者名・説明のどれでもヒットする", () => {
    expect(ids("ろけっと")).toEqual(["s1"]);
    expect(ids("TANAKA")).toEqual(["s2"]);
    expect(ids("たいや")).toEqual(["s3"]);
  });

  it("複数の語はすべて含むものだけ（AND）", () => {
    expect(ids("ロケット 宇宙")).toEqual(["s1"]);
    expect(ids("ロケット 車")).toEqual([]);
  });

  it("語が無ければ全件、元の配列は変えない", () => {
    expect(ids("")).toEqual(["s1", "s2", "s3"]);
    searchProjects(items, ["車"]);
    expect(items).toHaveLength(3);
  });
});

describe("projectsDigest", () => {
  it("ignores order but notices status changes", () => {
    const d = projectsDigest(cards);
    expect(projectsDigest([...cards].reverse())).toBe(d);
    const changed = cards.map((c, i) =>
      i === 0 ? { ...c, statuses: [{ labelId: 1, labelName: "進捗", optionId: 2, optionName: "完成" }] } : c,
    );
    expect(projectsDigest(changed)).not.toBe(d);
  });
});

describe("back to the gallery", () => {
  const fb = "/demo?session=1";

  it("keeps only gallery keys and skips session-only queries", () => {
    expect(galleryBackParam(new URLSearchParams("session=2&status=3,none:1&sort=title&x=1"))).toBe("session=2&sort=title&status=3%2Cnone%3A1");
    expect(galleryBackParam(new URLSearchParams("q=箱"))).toBe("q=%E7%AE%B1");
    expect(galleryBackParam(new URLSearchParams("session=2"))).toBeNull();
    expect(galleryBackParam(new URLSearchParams(""))).toBeNull();
  });

  it("builds the return path inside the workshop only", () => {
    expect(galleryBackHref("demo", "status=3&sort=title", fb)).toBe("/demo?sort=title&status=3");
    expect(galleryBackHref("demo", undefined, fb)).toBe(fb);
    expect(galleryBackHref("demo", "", fb)).toBe(fb);
    expect(galleryBackHref("demo", "//evil.com", fb)).toBe(fb);
    expect(galleryBackHref("demo", "https://evil.com/?status=1", fb)).toBe(fb);
    expect(galleryBackHref("demo", "x=1&y=2", fb)).toBe(fb);
  });

  it("returns to the people page at the author's section", () => {
    expect(galleryBackParam(new URLSearchParams("view=people&sort=recent&author=p:12&status=1"))).toBe("view=people&sort=recent&author=p%3A12");
    expect(galleryBackParam(new URLSearchParams("view=people&sort=name&author=x"))).toBe("view=people");
    expect(galleryBackHref("demo", "view=people&sort=recent&author=p:12", fb)).toBe("/demo/people?sort=recent#author-p-12");
    expect(galleryBackHref("demo", "view=people&author=u:3", fb)).toBe("/demo/people#author-u-3");
    expect(galleryBackHref("demo", "view=people&author=%22%3E%3Cscript", fb)).toBe("/demo/people");
  });

  it("carries back on project links", () => {
    expect(projectHref("demo", "abc", null)).toBe("/demo/projects/abc");
    expect(projectHref("demo", "abc", "status=3")).toBe("/demo/projects/abc?back=status%3D3");
    expect(projectHref("demo", "abc", "status=3", "/editor?mode=remix")).toBe("/demo/projects/abc/editor?mode=remix&back=status%3D3");
  });
});
