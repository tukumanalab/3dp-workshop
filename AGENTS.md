# AGENTS.md — Layerling Workshop

AI エージェント（Claude Code / Codex など）向けの作業ガイド。`CLAUDE.md` はこのファイルへのシンボリックリンク。
手順の詳細は `.claude/skills/`（`.agents/skills/` は同じ場所へのリンク）の各スキルを参照すること。

## 概要
- Layerling（3D CAD, `.lyl` 形式）のデザインをワークショップ単位で保存・共有する Web サービス。xcratch-workshop の Layerling 版。
- Next.js 15 App Router / React 19 / TypeScript / Tailwind CSS v4 / Prisma + SQLite。basePath は `/layerling-workshop`。
- エディタは別リポジトリ（tukumana-layerling の `workshop-mode` ブランチ）の static export。同一オリジンの `/layerling-workshop/editor/` で iframe 表示し、保存 API と postMessage で連携する（契約は README「エディタ連携」）。
- 本番は tukumana.si.aoyama.ac.jp（2GB RAM）。PM2 + Nginx、サブパス配信。

## 絶対に守ること

### ライセンス（MIT）
- このリポジトリは MIT。**Layerling（AGPL-3.0）のコード・CSS・ロゴ・画像を一切コピーしない**。Layerling のソースを見て値やマークアップを転記するのも不可。
- Layerling との連携は HTTP API / postMessage / iframe と、公開フォーマットの事実（`.lyl` は zip + `project.json`、`schema` / `formatVersion` / `minimumReaderVersion` / `metadata.projectName`）だけで行う。
- ブランド表記は文字の「Layerling Workshop」と、非公式である旨の注記のみ。Layerling のロゴは使わない。

### 他リポジトリ
- `../tukumana-layerling`（元の checkout）には**ユーザーの未コミット変更がある。触らない**（checkout / stash / commit / ビルドもしない）。
- エディタ側の変更は worktree `../tukumana-layerling-workshop-mode`（ブランチ `workshop-mode`）でのみ行う。こちらは Layerling の fork なので AGPL のまま。
- push・本番デプロイ・Nginx 変更・サーバー上の操作は、必ずユーザーの明示的な許可を得てから行う。

### 開発サーバとビルド（再発防止）
- dev は `.next-dev`、build は `.next` に出力する（`next.config.ts` の `distDir`）。**この分離を消さない。**以前は dev 実行中の `next build` で `.next` が壊れ、全ページが裏で 500 になった（`SyntaxError: Unexpected end of JSON input`）。画面は一見表示されるが、ログインが失敗し「新しく作る」ボタンが出ない、という分かりにくい症状になった。
- 変なエラーが出たら、まず dev サーバのログを見る。復旧手順はスキル `workshop-dev-env` を参照。
- dev サーバは `.claude/launch.json` の `editor` / `workshop` 構成で起動する（Claude Desktop では `preview_start`）。Bash の `&` でバックグラウンド起動して放置しない。

### basePath `/layerling-workshop`
- `next/link`・`router.push`・`redirect()` には basePath を**付けない**（Next が自動付与する）。
- 生の `fetch()`・`<img src>`・`<iframe src>`・cookie の path には basePath を**付ける**（`config.basePath` か `/layerling-workshop/...`）。
- `skipTrailingSlashRedirect: true` は消さない。エディタは `/layerling-workshop/editor/`（末尾スラッシュ付き）で相対パスのアセットを読むため、308 でスラッシュが外れると 404 になる。

### 権限・API
- 閲覧と編集の判定は `src/lib/access.ts` に集約する。ページや API で独自に判定を書かない。見えない作品は 403 ではなく 404 を返す。
- 保存 API（`/api/store/...`）の URL、multipart のフィールド名（`project` / `thumbnail`）、応答 `{id, versionTimestamp}`、postMessage の type 名（`layerling-workshop:*`）はエディタとの契約。変えるときはエディタ側（workshop-mode）も同時に直し、README を更新する。

### git 操作
- 履歴の書き換え（amend / rebase / reset / 孤立ブランチ / `gc --prune`）はユーザーの指示があるときだけ行う。
- 書き換える前に、必ずバックアップの ref を作る（例: `git branch backup/<日付> main`）。結果を検証してから、ユーザーに確認したうえで消す。
- 複数の git コマンドを 1 つのスクリプトで連続実行するときは、各コマンドの成否を確認する（`&&` でつなぐか、`set -e` が確実に効く bash で実行する）。失敗に気付かないまま `reflog expire` や `gc --prune=now` まで進めると、取り返しがつかない。過去に `git cherry-pick -q`（`-q` は存在しないオプション）で失敗したまま gc まで走り、コミットが消えたことがある。

## 作業完了の前に
スキル `workshop-verify` のチェックリストを実施する。最低限は次のとおり。
1. `npm run typecheck && npm run lint && npm test` がすべて通ること。
2. dev サーバのログにエラーが無いこと。画面が表示されていてもログは必ず見る。
3. UI を変えたら、ブラウザで主要導線（ログイン → ギャラリー → 新しく作る → エディタ表示）とスマホ幅（375px）を確認すること。
4. 確認できなかった項目は「未確認」と明記して報告すること。

## よく使うコマンド
```bash
npm run dev            # http://localhost:3010/layerling-workshop （.next-dev）
npm test               # vitest（一時 SQLite / 一時ストレージ）
npm run typecheck && npm run lint
npm run db:seed        # demo@example.com / demo-password、/demo、参加コード DEMO01
node scripts/serve-editor-dev.mjs   # エディタ export を :3020 で配信
```
