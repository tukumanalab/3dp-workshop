#!/bin/bash
# 3dp-workshop の本番デプロイ (サーバ側)。
# GitHub Actions でビルドした成果物 (artifact) を取得して入れ替える。サーバ上では next build をしない (2GB RAM)。
#
# 使い方:
#   deploy/server-deploy.sh <app|editor> <commit-sha(40桁)> [run-id]
#
#   app:    3dp-workshop 本体。APP_DIR を入れ替え → prisma migrate deploy → PM2 再起動 → health check。
#           health check に失敗したらファイルを前の版に戻して再起動する (DB のマイグレーションは戻らない)。
#   editor: エディタ (tukumanalab/layerling workshop-mode の static export)。EDITOR_DIR を入れ替える。
#           sha はエディタ側 (layerling) のコミット。
#
# /api/deploy (GitHub Actions からの Webhook) から自動で呼ばれる。
# 手動デプロイ・ロールバックはアプリの実行ユーザーで実行する:
#   sudo -u webapps -H /opt/3dp-workshop/deploy/server-deploy.sh app <commit-sha>
#
# 環境変数で上書きできる: APP_DIR, EDITOR_DIR, REPO, PM2_NAME, HEALTH_URL, GITHUB_API_URL
# 検証用: ARTIFACT_DIR (GitHub から取得せず、このディレクトリの tar.gz / .sha256 を使う), PM2_BIN

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/3dp-workshop}"
EDITOR_DIR="${EDITOR_DIR:-/var/www/3dp-workshop-editor}"
REPO="${REPO:-tukumanalab/3dp-workshop}"
PM2_NAME="${PM2_NAME:-3dp-workshop}"
PM2_BIN="${PM2_BIN:-pm2}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8010/3dp/api/health}"
GITHUB_API="${GITHUB_API_URL:-https://api.github.com}"
STATE_DIR="$APP_DIR/.deploy-state"
# APP_DIR の中で、入れ替え対象にしないもの (サーバ固有の設定・ログ・状態)
APP_EXCLUDES=(--exclude /.env --exclude /logs --exclude /.deploy-state --exclude /tools/node_modules)

log_info() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
}

log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >&2
}

github_api() {
  curl -fsSL \
    -H "Authorization: Bearer $GITHUB_ARTIFACT_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@"
}

# .env から値を読み込む (環境変数で指定されていればそちらを優先)
read_env_value() {
  local key="$1"
  if [ -n "${!key:-}" ]; then
    echo "${!key}"
    return
  fi
  if [ -f "$APP_DIR/.env" ]; then
    grep -E "^${key}=" "$APP_DIR/.env" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
  fi
}

sha256_check() {
  if command -v sha256sum > /dev/null; then sha256sum -c "$1"; else shasum -a 256 -c "$1"; fi
}

# 成果物を取得・検証し、$2 に展開する
fetch_artifact() {
  local name="$1" dest="$2" sha="$3" run_id="$4" tmp_dir="$5"
  local src="$tmp_dir/artifact"
  mkdir -p "$src"

  if [ -n "${ARTIFACT_DIR:-}" ]; then
    cp "$ARTIFACT_DIR/$name.tar.gz" "$ARTIFACT_DIR/$name.tar.gz.sha256" "$src/"
  else
    GITHUB_ARTIFACT_TOKEN="$(read_env_value GITHUB_ARTIFACT_TOKEN)"
    if [ -z "$GITHUB_ARTIFACT_TOKEN" ]; then
      log_error "GITHUB_ARTIFACT_TOKEN が設定されていません ($APP_DIR/.env を確認してください)"
      return 1
    fi
    local artifact_id
    artifact_id="$(github_api "$GITHUB_API/repos/$REPO/actions/artifacts?name=$name-$sha" \
      | node -e '
        let s = "";
        process.stdin.on("data", (d) => (s += d)).on("end", () => {
          const runId = process.argv[1];
          const artifacts = JSON.parse(s).artifacts.filter((a) => !a.expired);
          const artifact = artifacts.find((a) => String(a.workflow_run?.id) === runId) || artifacts[0];
          if (artifact) console.log(artifact.id);
        });
      ' "$run_id")"
    if [ -z "$artifact_id" ]; then
      log_error "$name-$sha が見つかりません (ビルド未完了か、保存期間切れの可能性があります)"
      return 1
    fi
    github_api -o "$tmp_dir/artifact.zip" "$GITHUB_API/repos/$REPO/actions/artifacts/$artifact_id/zip"
    python3 -m zipfile -e "$tmp_dir/artifact.zip" "$src/"
  fi

  (cd "$src" && sha256_check "$name.tar.gz.sha256")
  mkdir -p "$dest"
  tar --no-same-owner -xzf "$src/$name.tar.gz" -C "$dest"
  if [ "$(cat "$dest/BUILD_COMMIT" 2>/dev/null)" != "$sha" ]; then
    log_error "成果物のコミット (BUILD_COMMIT) が $sha と一致しません"
    return 1
  fi
}

# restart だと呼び出し元の環境変数 (HOSTNAME など) が ecosystem の env より優先され、127.0.0.1 以外で
# 待ち受けたり起動に失敗したりする。start なら ecosystem の env が優先されるので、毎回 delete → start する。
# .env は起動のたびに --env-file で読み直される。
restart_app() {
  "$PM2_BIN" delete "$PM2_NAME" > /dev/null 2>&1 || true
  "$PM2_BIN" start "$APP_DIR/ecosystem.config.cjs" || return 1
  "$PM2_BIN" save
}

# 新しいプロセスが応答し、デプロイしたコミットを返すまで待つ
health_check() {
  local sha="$1" i
  for i in $(seq 1 15); do
    if curl -fsS "$HEALTH_URL" 2>/dev/null | grep -q "\"commit\":\"$sha\""; then
      return 0
    fi
    log_info "ヘルスチェック待機中... ($i/15)"
    sleep 2
  done
  return 1
}

# migrate deploy 用の prisma CLI (tools/) を、package.json が変わったときだけ入れ直す
install_tools_if_changed() {
  if [ -d "$APP_DIR/tools/node_modules" ] && cmp -s "$APP_DIR/tools/package.json" "$STATE_DIR/tools-package.json"; then
    log_info "tools/package.json に変更がないため npm install をスキップします"
    return
  fi
  log_info "prisma CLI をインストールしています (tools/)..."
  (cd "$APP_DIR/tools" && npm install --omit=dev --no-audit --no-fund) || return 1
  cp "$APP_DIR/tools/package.json" "$STATE_DIR/tools-package.json"
}

# || の中で呼ばれると set -e が効かないため、各コマンドを && でつなぐ
migrate() {
  (
    cd "$APP_DIR/tools" &&
    set -a &&
    # shellcheck disable=SC1091
    . "$APP_DIR/.env" &&
    set +a &&
    ./node_modules/.bin/prisma migrate deploy --schema ../prisma/schema.prisma
  )
}

rollback_app() {
  local reason="$1"
  log_error "$reason。前の版に戻します (DB のマイグレーションは戻りません)"
  rm -rf "$STATE_DIR/failed"
  rsync -a --no-owner --no-group --delete "${APP_EXCLUDES[@]}" "$APP_DIR/" "$STATE_DIR/failed/"
  rsync -a --no-owner --no-group --delete "${APP_EXCLUDES[@]}" "$STATE_DIR/prev/" "$APP_DIR/"
  restart_app || true
  log_error "ロールバックしました。原因は pm2 logs $PM2_NAME と $STATE_DIR/failed を確認してください"
  exit 1
}

deploy_app() {
  local sha="$1" run_id="$2" tmp_dir="$3"

  log_info "1. ビルド成果物を取得しています..."
  fetch_artifact 3dp-workshop-app "$tmp_dir/extract" "$sha" "$run_id" "$tmp_dir"

  log_info "2. 現在の版を退避しています ($STATE_DIR/prev)..."
  rsync -a --no-owner --no-group --delete "${APP_EXCLUDES[@]}" "$APP_DIR/" "$STATE_DIR/prev/"

  log_info "3. ファイルを入れ替えています..."
  rsync -a --no-owner --no-group --delete "${APP_EXCLUDES[@]}" "$tmp_dir/extract/" "$APP_DIR/"

  log_info "4. DB のマイグレーション (prisma migrate deploy)..."
  install_tools_if_changed || rollback_app "prisma CLI のインストールに失敗しました"
  migrate || rollback_app "マイグレーションに失敗しました"

  log_info "5. 再起動しています..."
  restart_app || rollback_app "PM2 の再起動に失敗しました"

  log_info "6. ヘルスチェック中 ($HEALTH_URL)..."
  health_check "$sha" || rollback_app "ヘルスチェックに失敗しました"
}

deploy_editor() {
  local sha="$1" run_id="$2" tmp_dir="$3"

  log_info "1. ビルド成果物を取得しています..."
  fetch_artifact 3dp-workshop-editor "$tmp_dir/extract" "$sha" "$run_id" "$tmp_dir"
  if [ ! -f "$tmp_dir/extract/index.html" ]; then
    log_error "成果物に index.html がありません"
    exit 1
  fi

  log_info "2. 現在の版を退避しています ($STATE_DIR/editor-prev)..."
  mkdir -p "$EDITOR_DIR"
  rsync -a --no-owner --no-group --delete "$EDITOR_DIR/" "$STATE_DIR/editor-prev/"

  log_info "3. ファイルを入れ替えています ($EDITOR_DIR)..."
  if ! rsync -a --no-owner --no-group --delete "$tmp_dir/extract/" "$EDITOR_DIR/"; then
    log_error "入れ替えに失敗しました。前の版に戻します"
    rsync -a --no-owner --no-group --delete "$STATE_DIR/editor-prev/" "$EDITOR_DIR/"
    exit 1
  fi
}

main() {
  local component="${1:-}" sha="${2:-}" run_id="${3:-}"

  if [[ ! "$component" =~ ^(app|editor)$ ]] || [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "使い方: $0 <app|editor> <commit-sha(40桁)> [run-id]" >&2
    exit 1
  fi

  # アプリのディレクトリの所有者 (= PM2 を動かしているユーザー) で実行されているか確認
  local owner
  owner="$(stat -c %U "$APP_DIR" 2>/dev/null || stat -f %Su "$APP_DIR")"
  if [ "$(id -un)" != "$owner" ]; then
    log_error "このスクリプトは $owner ユーザーで実行してください"
    echo "  sudo -u $owner -H $0 $*" >&2
    exit 1
  fi

  mkdir -p "$STATE_DIR"
  # 同時に複数のデプロイが動かないようにロックを取る
  exec 9> "$STATE_DIR/lock"
  if ! flock -n 9; then
    log_info "他のデプロイが実行中のため、終了を待っています..."
    flock 9
  fi

  log_info "========================================="
  log_info "デプロイを開始します: $component $sha ${run_id:+(run $run_id)}"
  log_info "========================================="

  local tmp_dir
  tmp_dir="$(mktemp -d "$STATE_DIR/tmp.XXXXXX")"
  # local 変数は終了時には参照できないため、trap 設定時に展開しておく
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp_dir'" EXIT

  "deploy_$component" "$sha" "$run_id" "$tmp_dir"

  echo "$sha" > "$STATE_DIR/$component-commit"

  log_info "========================================="
  log_info "デプロイが完了しました: $component $sha"
  log_info "========================================="
}

# 入れ替えでこのファイル自体が書き換わっても影響しないよう、関数として全体を読み込んでから実行する
main "$@"
exit
