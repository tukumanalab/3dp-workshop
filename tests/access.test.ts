import { describe, expect, it } from "vitest";
import {
  canAdministerSite,
  canCreateProject,
  canManageStaff,
  canManageStatusLabels,
  canSetProjectStatus,
  canSetTeachingMaterial,
  canViewMaterial,
  isMaterialAudience,
  canEditProject,
  canManageProject,
  canViewProject,
  canViewSession,
  canViewWorkshop,
  isUserRole,
  isUserStatus,
  type Viewer,
} from "@/lib/access";

const w = (visibility: string) => ({ id: 1, ownerId: 10, visibility, staff: [{ userId: 11 }] });
const s = (visibility: string) => ({ workshopId: 1, visibility });
const p = (isShared: boolean) => ({ workshopId: 1, participantId: 100, userId: null, isShared });

const anon: Viewer = { participants: [] };
const other: Viewer = { participants: [{ participantId: 200, workshopId: 1 }] };
const author: Viewer = { participants: [{ participantId: 100, workshopId: 1 }] };
const owner: Viewer = { user: { userId: 10, role: "organizer" }, participants: [] };
const coStaff: Viewer = { user: { userId: 11, role: "organizer" }, participants: [] };
const admin: Viewer = { user: { userId: 99, role: "admin" }, participants: [] };
const strangerOrganizer: Viewer = { user: { userId: 55, role: "organizer" }, participants: [] };
const otherWorkshopParticipant: Viewer = { participants: [{ participantId: 100, workshopId: 2 }] };

describe("canViewProject (spec §5.2 table)", () => {
  // [WS vis, isShared, session vis, anon, other participant, author, staff]
  const rows: [string, boolean, string, boolean, boolean, boolean, boolean][] = [
    ["PUBLIC", false, "PUBLIC", false, false, true, true],
    ["PRIVATE", false, "PUBLIC", false, false, true, true],
    ["PUBLIC", true, "PUBLIC", true, true, true, true],
    ["UNLISTED", true, "PUBLIC", true, true, true, true],
    ["PUBLIC", true, "PRIVATE", false, true, true, true],
    ["UNLISTED", true, "PRIVATE", false, true, true, true],
    ["PRIVATE", true, "PUBLIC", false, true, true, true],
    ["PRIVATE", true, "PRIVATE", false, true, true, true],
  ];
  for (const [wv, shared, sv, a, o, au, st] of rows) {
    it(`WS=${wv} shared=${shared} session=${sv}`, () => {
      expect(canViewProject(w(wv), s(sv), p(shared), anon)).toBe(a);
      expect(canViewProject(w(wv), s(sv), p(shared), other)).toBe(o);
      expect(canViewProject(w(wv), s(sv), p(shared), author)).toBe(au);
      expect(canViewProject(w(wv), s(sv), p(shared), owner)).toBe(st);
      expect(canViewProject(w(wv), s(sv), p(shared), coStaff)).toBe(st);
    });
  }

  it("participant of another workshop and unrelated organizer are treated as anonymous", () => {
    expect(canViewProject(w("PUBLIC"), s("PUBLIC"), p(false), otherWorkshopParticipant)).toBe(false);
    expect(canViewProject(w("PUBLIC"), s("PRIVATE"), p(true), strangerOrganizer)).toBe(false);
  });

  it("site admin can reach shared works but not unshared ones", () => {
    expect(canViewProject(w("PRIVATE"), s("PRIVATE"), p(true), admin)).toBe(true);
    expect(canViewProject(w("PRIVATE"), s("PRIVATE"), p(false), admin)).toBe(false);
  });
});

describe("workshop / session gates", () => {
  it("PRIVATE workshop hides from anon, shows to participants", () => {
    expect(canViewWorkshop(w("PRIVATE"), anon)).toBe(false);
    expect(canViewWorkshop(w("PRIVATE"), other)).toBe(true);
    expect(canViewWorkshop(w("UNLISTED"), anon)).toBe(true);
  });
  it("private session needs membership", () => {
    expect(canViewSession(w("PUBLIC"), s("PRIVATE"), anon)).toBe(false);
    expect(canViewSession(w("PUBLIC"), s("PRIVATE"), other)).toBe(true);
    expect(canViewSession(w("PUBLIC"), s("PUBLIC"), anon)).toBe(true);
  });
});

describe("edit / manage / create", () => {
  it("only the author edits; staff manage but cannot edit", () => {
    const ws = w("PUBLIC");
    expect(canEditProject(ws, p(true), author)).toBe(true);
    expect(canEditProject(ws, p(true), owner)).toBe(false);
    expect(canEditProject(ws, p(true), other)).toBe(false);
    expect(canManageProject(ws, p(true), owner)).toBe(true);
    expect(canManageProject(ws, p(true), other)).toBe(false);
  });
  it("closed workshop blocks editing and creating", () => {
    const closed = { ...w("PUBLIC"), isOpen: false };
    expect(canEditProject(closed, p(true), author)).toBe(false);
    expect(canCreateProject(closed, author)).toBe(false);
    expect(canCreateProject(w("PUBLIC"), author)).toBe(true);
    expect(canCreateProject(w("PUBLIC"), anon)).toBe(false);
  });
});

describe("site admin helpers", () => {
  it("canAdministerSite is true only for role=admin", () => {
    expect(canAdministerSite(admin)).toBe(true);
    expect(canAdministerSite(owner)).toBe(false);
    expect(canAdministerSite(anon)).toBe(false);
  });
  it("type guards accept only known values", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("organizer")).toBe(true);
    expect(isUserRole("root")).toBe(false);
    expect(isUserRole(1)).toBe(false);
    expect(isUserStatus("APPROVED")).toBe(true);
    expect(isUserStatus("SUSPENDED")).toBe(true);
    expect(isUserStatus("PENDING")).toBe(false);
  });
});

describe("workshop management", () => {
  it("only the owner manages staff; co-staff can set teaching material", () => {
    const ws = w("PUBLIC");
    expect(canManageStaff(ws, owner)).toBe(true);
    expect(canManageStaff(ws, coStaff)).toBe(false);
    expect(canManageStaff(ws, admin)).toBe(false);
    expect(canSetTeachingMaterial(ws, coStaff)).toBe(true);
    expect(canSetTeachingMaterial(ws, author)).toBe(false);
    expect(canSetTeachingMaterial(ws, admin)).toBe(false);
  });

  describe("canViewMaterial", () => {
    const m = (audience: string) => ({ workshopId: 1, audience });
    // [WS vis, session vis | null, audience, anon, participant, staff, admin]
    const rows: [string, string | null, string, boolean, boolean, boolean, boolean][] = [
      ["PUBLIC", null, "EVERYONE", true, true, true, true],
      ["PUBLIC", null, "PARTICIPANT", false, true, true, true],
      ["PUBLIC", null, "STAFF", false, false, true, false],
      ["PRIVATE", null, "EVERYONE", false, true, true, true],
      ["PUBLIC", "PRIVATE", "EVERYONE", false, true, true, true],
      ["PUBLIC", "PUBLIC", "EVERYONE", true, true, true, true],
      ["PUBLIC", "PUBLIC", "STAFF", false, false, true, false],
    ];
    for (const [wv, sv, aud, a, pa, st, ad] of rows) {
      it(`WS=${wv} session=${sv} audience=${aud}`, () => {
        const sess = sv ? s(sv) : null;
        expect(canViewMaterial(w(wv), sess, m(aud), anon)).toBe(a);
        expect(canViewMaterial(w(wv), sess, m(aud), other)).toBe(pa);
        expect(canViewMaterial(w(wv), sess, m(aud), coStaff)).toBe(st);
        expect(canViewMaterial(w(wv), sess, m(aud), admin)).toBe(ad);
      });
    }
    it("rejects materials of another workshop and unknown audiences", () => {
      expect(canViewMaterial(w("PUBLIC"), null, { workshopId: 2, audience: "EVERYONE" }, owner)).toBe(false);
      expect(isMaterialAudience("STAFF")).toBe(true);
      expect(isMaterialAudience("NOBODY")).toBe(false);
    });
  });
});

describe("project statuses", () => {
  it("staff define labels; author and staff set statuses", () => {
    expect(canManageStatusLabels(w("PUBLIC"), owner)).toBe(true);
    expect(canManageStatusLabels(w("PUBLIC"), coStaff)).toBe(true);
    expect(canManageStatusLabels(w("PUBLIC"), author)).toBe(false);
    expect(canManageStatusLabels(w("PUBLIC"), admin)).toBe(false);
    expect(canSetProjectStatus(w("PUBLIC"), p(true), author)).toBe(true);
    expect(canSetProjectStatus(w("PUBLIC"), p(true), coStaff)).toBe(true);
    expect(canSetProjectStatus(w("PUBLIC"), p(true), other)).toBe(false);
    expect(canSetProjectStatus(w("PUBLIC"), p(true), anon)).toBe(false);
    expect(canSetProjectStatus(w("PUBLIC"), p(true), admin)).toBe(false);
    expect(canSetProjectStatus(w("PUBLIC"), p(true), otherWorkshopParticipant)).toBe(false);
  });

  it("authors can still set statuses after the workshop closes", () => {
    const closed = { ...w("PUBLIC"), isOpen: false };
    expect(canEditProject(closed, p(true), author)).toBe(false);
    expect(canSetProjectStatus(closed, p(true), author)).toBe(true);
  });
});
