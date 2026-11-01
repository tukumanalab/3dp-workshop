#!/usr/bin/env bash
# 本番用のバンドル (.deploy/3dp-workshop-app.tar.gz) を作る。GitHub Actions (.github/workflows/deploy.yml) から呼ばれる。
# 2GB RAM のサーバではビルドしない。サーバ側は deploy/server-deploy.sh がこの tar を取得して入れ替える。
#
# 任意: BUILD_COMMIT (既定 $GITHUB_SHA、無ければ git rev-parse HEAD)
set -euo pipefail

cd "$(dirname "$0")/.."

BUILD_COMMIT="${BUILD_COMMIT:-${GITHUB_SHA:-$(git rev-parse HEAD)}}"

echo "==> build"
npm run build

# 親ディレクトリに lockfile があると (例: .claude/worktrees/ の worktree)、Next がそこをトレースのルートにして
# server.js を standalone の奥に置く。そのまま配置すると本番の server.js が消えて 502 になる。
if [ ! -f .next/standalone/server.js ]; then
  echo "error: .next/standalone/server.js がありません。worktree ではなく、リポジトリの clone から実行してください" >&2
  exit 1
fi

STAGE=".deploy/stage"
rm -rf .deploy && mkdir -p "$STAGE"
# standalone は server.js と必要な node_modules を含む。static / public は別途コピーが必要。
cp -R .next/standalone/. "$STAGE/"
mkdir -p "$STAGE/.next"
cp -R .next/static "$STAGE/.next/static"
cp -R public "$STAGE/public"
cp -R prisma "$STAGE/prisma"
rm -f "$STAGE"/prisma/*.db "$STAGE"/prisma/*.db-journal
cp deploy/ecosystem.config.cjs "$STAGE/ecosystem.config.cjs"
mkdir -p "$STAGE/deploy"
cp deploy/server-deploy.sh "$STAGE/deploy/"
mkdir -p "$STAGE/scripts"
cp scripts/create-admin.mjs "$STAGE/scripts/"
# migrate deploy 用の prisma CLI は standalone に含まれないため、tools/ に別 package.json を置いてサーバ側で入れる
PRISMA_VERSION="$(node -p "require('./package.json').devDependencies.prisma.replace(/^[^0-9]*/, '')")"
mkdir -p "$STAGE/tools"
printf '{"private":true,"dependencies":{"prisma":"%s"}}\n' "$PRISMA_VERSION" > "$STAGE/tools/package.json"
# /api/health が返し、サーバ側でも成果物の取り違えを確認するのに使う
echo "$BUILD_COMMIT" > "$STAGE/BUILD_COMMIT"

echo "==> package"
tar -czf .deploy/3dp-workshop-app.tar.gz -C "$STAGE" .
(cd .deploy && sha256sum 3dp-workshop-app.tar.gz > 3dp-workshop-app.tar.gz.sha256 2>/dev/null \
  || shasum -a 256 3dp-workshop-app.tar.gz > 3dp-workshop-app.tar.gz.sha256)
echo "OK: .deploy/3dp-workshop-app.tar.gz ($BUILD_COMMIT)"
