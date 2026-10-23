import { describe, expect, it } from "vitest";
import {
  groupProjectsByAuthor,
  normalizeSearchText,
  parseProjectSort,
  parseSearchQuery,
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
