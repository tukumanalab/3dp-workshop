// 使い方: node --env-file=.env scripts/create-admin.mjs <email> <name> [password]
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const [email, name, passwordArg] = process.argv.slice(2);
  if (!email || !name) {
    console.error("usage: node scripts/create-admin.mjs <email> <name> [password]");
    process.exit(1);
  }
  const password = passwordArg || randomBytes(12).toString("base64url");
  const salt = randomBytes(16);
  const passwordHash = `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 32).toString("hex")}`;
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { role: "admin", status: "APPROVED", name, passwordHash },
    create: { email: email.toLowerCase(), name, role: "admin", passwordHash },
  });
  console.log(`admin ready: ${user.email}`);
  if (!passwordArg) console.log(`generated password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
