---
name: workshop-verify
description: 3dp-workshop の変更を「完了」と報告する前の検証チェックリスト（型・lint・テスト、dev ログ確認、ブラウザでの主要導線とレスポンシブ確認）。UI・API・認証・エディタ連携を変更したあと、コミット前、ユーザーに「できました」と言う前に必ず使う。
---

# 完了前の検証チェックリスト

「ビルドが通った」「スクリーンショットが撮れた」だけでは完了ではない。過去に、画面は表示されるのに裏で全 API が 500 になっていて、「新しく作る」が動かないまま報告してしまったことがある。

## 1. 静的チェック（毎回）
```bash
npm run typecheck && npm run lint && npm test
```
失敗したら直す。直せない場合は失敗内容をそのまま報告する。

## 2. dev サーバのログ（毎回、ブラウザ確認の前後）
- `preview_logs`（level=error）か、ターミナルの出力を見る。
- `⨯`、`Error`、`Unexpected end of JSON input`、Prisma のエラーが 1 件でもあれば、先に解消する（スキル `workshop-dev-env`）。
- 画面が表示されていても、ログのエラーは無視しない。

## 3. ブラウザでの主要導線（UI・認証・API を触ったとき）
ローカルの dev 環境（シードのテスト値）で、次を実際に操作して確認する。
1. `/3dp-workshop/login` から `demo@example.com` / `demo-password` でログインする。トップバーに主催者名が出ること。
2. `/3dp-workshop/demo` でギャラリーが出ること。
   - サムネイルは、スクリーンショットではなく `img.naturalWidth > 0` で判定する。lazy 読み込みのため、撮影のタイミングによっては空に写る。
3. 「新しく作る」でエディタ iframe が開くこと。iframe 内のコンソールにアセットの 404 が無いこと。
4. エディタ連携を触った場合は次も確認する。
   - 形状を追加して Ctrl+S で保存すると、URL が `/projects/<id>/editor` に変わること。
   - 「戻る」で詳細画面に遷移し、サムネイルが出ること。
5. 参加者の導線を触った場合は、別のコンテキスト（cookie を分ける）で `/demo/join` から参加コード `DEMO01` で参加して確認する。
- 確認には API の応答コードも使う。例: `fetch('/3dp-workshop/api/auth/me')` が 200 であること。

## 4. レスポンシブ（UI を触ったとき）
- 幅 375px（mobile）、768px（tablet）、1600px で確認する。
- 横スクロールが出ないこと（`document.documentElement.scrollWidth === innerWidth`）。
- ギャラリーの列数が幅に応じて増減すること。
- ボタンやラベルが崩れないこと。
- 確認後、ビューポートのエミュレーションを desktop に戻す。

## 5. ライセンス（CSS・アセット・依存を触ったとき）
- `grep -rIn -i "agpl\|layerling-logo" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.next-dev --exclude-dir=.git --exclude-dir=.claude --exclude-dir=.agents . | grep -v AGENTS.md` が何も出さないこと（`package-lock.json` のルート `license` もこれで検出できる。実際に AGPL が残っていたことがある）。
- 追加した依存のライセンスが MIT と両立すること。

## 6. 報告
- 実施した項目と結果を書く。
- **実施しなかった項目は「未確認」と明記する。**
- 未コミットの変更があることも書く。
