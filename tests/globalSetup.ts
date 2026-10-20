import { execSync } from "child_process";
import { mkdtempSync } from "fs";
import os from "os";
import path from "path";

/** テスト用の一時 SQLite と一時ストレージを作り、マイグレーションを適用する。 */
export default function setup() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "lw-test-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
  process.env.STORAGE_DIR = path.join(dir, "storage");
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-0000";
  execSync("npx prisma migrate deploy", { env: process.env, stdio: "pipe" });
}
