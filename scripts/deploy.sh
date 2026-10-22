#!/usr/bin/env bash
# 3dp-workshop のデプロイ (ローカルでビルド → rsync → migrate → PM2 再起動 → health check)。
# 2GB RAM のサーバではビルドしない。実行前に必ず内容を確認すること。
#
# 必須: DEPLOY_HOST (例: tukumana.si.aoyama.ac.jp)
# 任意: DEPLOY_USER (ssh ユーザー), DEPLOY_PATH (既定 /opt/3dp-workshop),
#       PM2_NAME (既定 3dp-workshop), HEALTH_URL, EDITOR_DIST (tukumana-layerling の static export 出力), EDITOR_REMOTE_PATH
set -euo pipefail

: "${DEPLOY_HOST:?DEPLOY_HOST を設定してください}"
DEPLOY_USER="${DEPLOY_USER:-}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/3dp-workshop}"
PM2_NAME="${PM2_NAME:-3dp-workshop}"
HEALTH_URL="${HEALTH_URL:-https://${DEPLOY_HOST}/3dp-workshop/api/health}"
EDITOR_DIST="${EDITOR_DIST:-}"
EDITOR_REMOTE_PATH="${EDITOR_REMOTE_PATH:-/var/www/3dp-workshop-editor}"
TARGET="${DEPLOY_USER:+${DEPLOY_USER}@}${DEPLOY_HOST}"

cd "$(dirname "$0")/.."

echo "==> install & build (local)"
npm ci
npm run build

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
mkdir -p "$STAGE/scripts"
cp scripts/create-admin.mjs "$STAGE/scripts/"
# migrate deploy 用の prisma CLI は standalone に含まれないため、tools/ に別 package.json を置いてサーバ側で入れる
PRISMA_VERSION="$(node -p "require('./package.json').devDependencies.prisma.replace(/^[^0-9]*/, '')")"
mkdir -p "$STAGE/tools"
printf '{"private":true,"dependencies":{"prisma":"%s"}}\n' "$PRISMA_VERSION" > "$STAGE/tools/package.json"

echo "==> rsync to ${TARGET}:${DEPLOY_PATH}"
rsync -az --delete \
  --exclude '.env' --exclude 'data' --exclude 'tools/node_modules' \
  "$STAGE/" "${TARGET}:${DEPLOY_PATH}/"

echo "==> prisma migrate deploy (server)"
# サーバの ${DEPLOY_PATH}/.env に DATABASE_URL 等を置いておくこと
ssh "$TARGET" "cd '${DEPLOY_PATH}/tools' && npm install --omit=dev --no-audit --no-fund && set -a && . '${DEPLOY_PATH}/.env' && set +a && npx prisma migrate deploy --schema ../prisma/schema.prisma"

if [ -n "$EDITOR_DIST" ]; then
  echo "==> sync editor static export"
  rsync -az --delete "${EDITOR_DIST%/}/" "${TARGET}:${EDITOR_REMOTE_PATH}/"
fi

echo "==> pm2 restart"
ssh "$TARGET" "cd '${DEPLOY_PATH}' && (pm2 describe '${PM2_NAME}' >/dev/null 2>&1 && pm2 restart '${PM2_NAME}' --update-env || pm2 start ecosystem.config.cjs) && pm2 save"

echo "==> health check: ${HEALTH_URL}"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "$HEALTH_URL" >/dev/null; then echo "OK"; exit 0; fi
  sleep 2
done
echo "health check failed" >&2
exit 1
