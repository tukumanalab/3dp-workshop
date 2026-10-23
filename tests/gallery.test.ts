import { describe, expect, it } from "vitest";
import { groupProjectsByAuthor, type ProjectCard } from "@/lib/gallery";

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
