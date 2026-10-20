// 開発用シード: デモ主催者 + デモワークショップ (参加コード DEMO01) + セッション 2 つ。
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
    create: { email: "demo@example.com", name: "デモ主催者", role: "admin", passwordHash: hash("demo-password") },
  });
  const existing = await prisma.workshop.findUnique({ where: { slug: "demo" } });
  if (existing) {
    console.log("demo workshop already exists");
    return;
  }
  await prisma.workshop.create({
    data: {
      uid: "demo-workshop",
      slug: "demo",
      title: "デモワークショップ",
      description: "Layerling で自由にデザインしてみましょう。",
      visibility: "PUBLIC",
      joinCode: "DEMO01",
      ownerId: user.id,
      sessions: {
        create: [
          { name: "午前の部", visibility: "PUBLIC", defaultShared: true, order: 0 },
          { name: "午後の部", visibility: "PUBLIC", defaultShared: false, order: 1 },
        ],
      },
    },
  });
  console.log("seeded: demo@example.com / demo-password, workshop /demo (join code DEMO01)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
