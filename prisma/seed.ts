// 開発用シード: デモ開催者 + 共同運営者 + デモワークショップ (参加コード DEMO01) + セッション 2 つ + 資料 1 件 + 状態の種類 2 つ。
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hash(secret: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(secret, salt, 32).toString("hex")}`;
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: { email: "demo@example.com", name: "デモ開催者", role: "admin", passwordHash: hash("demo-password") },
  });
  const staff = await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: { email: "staff@example.com", name: "デモ共同運営者", role: "organizer", passwordHash: hash("staff-password") },
  });
  const existing = await prisma.workshop.findUnique({ where: { slug: "demo" } });
  if (existing) {
    await seedStatusLabels(existing.id);
    console.log("demo workshop already exists");
    return;
  }
  const demo = await prisma.workshop.create({
    data: {
      uid: "demo-workshop",
      slug: "demo",
      title: "デモワークショップ",
      description: "Layerling で自由にデザインしてみましょう。",
      visibility: "PUBLIC",
      joinCode: "DEMO01",
      ownerId: user.id,
      staff: { create: [{ userId: staff.id }] },
      materials: {
        create: [{ uid: "demo-material-1", type: "LINK", title: "Layerling の使い方", url: "https://example.com/", audience: "EVERYONE" }],
      },
      sessions: {
        create: [
          { name: "午前の部", visibility: "PUBLIC", defaultShared: true, order: 0 },
          { name: "午後の部", visibility: "PUBLIC", defaultShared: false, order: 1 },
        ],
      },
    },
  });
  await seedStatusLabels(demo.id);
  console.log("seeded: demo@example.com / demo-password, staff@example.com / staff-password, workshop /demo (join code DEMO01)");
}

// 状態の種類がまだ無いときだけ例を入れる（既存のデモにも後から足せるように）
async function seedStatusLabels(workshopId: number) {
  if ((await prisma.statusLabel.count({ where: { workshopId } })) > 0) return;
  const labels = [
    { name: "進捗", options: ["作成中", "完成"] },
    { name: "印刷", options: ["未印刷", "印刷待ち", "印刷済み"] },
  ];
  for (const [order, l] of labels.entries()) {
    await prisma.statusLabel.create({
      data: { workshopId, name: l.name, order, options: { create: l.options.map((name, i) => ({ name, order: i })) } },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
