# 開発ガイド

## 404エラーが出る場合

### 問題: `/api/*` にアクセスすると404エラー

**原因**: `npm run dev` (Vite) では Cloudflare Pages Functions が動作しません。

**解決策**: Wranglerを使用してください。

## ローカル開発環境のセットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.dev.vars` ファイルを作成:

```bash
ADMIN_PASSWORD=your-secure-password
ADMIN_EMAIL=your-email@example.com
```

## 開発サーバーの起動方法

### オプション1: フロントエンドのみ (推奨: UI開発時)

```bash
npm run dev
```

**特徴**:
- ✅ 高速リロード（HMR）
- ✅ UI開発に最適
- ❌ **APIエンドポイント (`/api/*`) は404エラー**

**使用タイミング**: UI/UXの開発、スタイリング、コンポーネント開発時

### オプション2: フル機能 (推奨: API開発・テスト時)

```bash
npm run dev:full
```

**特徴**:
- ✅ APIエンドポイントも動作
- ✅ 本番環境に近い動作
- ❌ ホットリロードなし（変更のたびに再ビルド必要）

**使用タイミング**: フィードバック機能のテスト、管理画面の開発時

### オプション3: ビルド後にPages Dev起動

```bash
npm run build
npm run dev:pages
```

**特徴**:
- ✅ APIエンドポイントも動作
- ✅ ビルドを手動で制御できる
- ❌ ホットリロードなし

## API開発の注意事項

### Pages Functionsのルーティング

ファイルパス → URL対応:

```
app/functions/api/submit-feedback.ts  →  /api/submit-feedback
app/functions/api/admin/list-feedback.ts  →  /api/admin/list-feedback
```

### ローカルでのKV動作

#### デフォルト設定（現在）

`npm run dev:full` または `npm run dev:pages` を使用すると、**ローカルKV**が自動的に作成されます。

**保存先**: `.wrangler/state/v3/kv/FEEDBACK_KV.sqlite3`

**特徴**:
- ✅ 本番KVに影響しない
- ❌ サーバー再起動時にデータが消える
- ❌ 永続化されない

#### 本番KVを使いたい場合

`wrangler.jsonc` の FEEDBACK_KV に `"remote": true` を追加:

```jsonc
{
  "binding": "FEEDBACK_KV",
  "id": "60e75ed5209d480894702e57641eee35",
  "remote": true  // ← 追加
}
```

**特徴**:
- ✅ データが永続化される
- ✅ 本番と同じデータを参照できる
- ⚠️ **開発中のテストデータが本番KVに保存される**

**推奨**: 開発時は `remote: false`（デフォルト）、本番データを確認したい場合のみ `remote: true`

## トラブルシューティング

### Q: フィードバックフォームを送信すると404エラーが出る

**A**: `npm run dev:full` を使用していますか？`npm run dev` ではAPIが動作しません。

### Q: 管理画面が表示されない

**A**:
1. `/admin?password=your-password` にアクセスしていますか？
2. `.dev.vars` に `ADMIN_PASSWORD` を設定していますか？

### Q: KVエラーが出る

**A**:
1. `npm run dev:full` を使用していますか？
2. `wrangler.jsonc` の設定を確認してください
3. `.dev.vars` ファイルが存在するか確認してください

## デプロイ

### 本番環境へのデプロイ

```bash
npm run build
```

ビルド後、`dist` フォルダが生成されます。Cloudflare Pagesに自動デプロイされます。

### デプロイ前の確認事項

1. **`_redirects` ファイルが含まれているか確認**:
   ```bash
   ls -la dist/_redirects
   cat dist/_redirects
   ```

   正しい内容:
   ```
   # SPA routing - redirect all non-API requests to index.html
   /api/* 200
   /admin /index.html 200
   /* /index.html 200
   ```

2. **環境変数が設定されているか確認**:
   - Cloudflare Dashboard → Pages → gameseekervault → Settings → Environment variables
   - `ADMIN_PASSWORD` と `ADMIN_EMAIL` が設定されているか

### デプロイ後の確認

1. **通常ページ**: `https://gameseekervault.pages.dev/` にアクセス
2. **管理画面**: `https://gameseekervault.pages.dev/admin?password=xxx` にアクセス
3. **API**: ブラウザの開発者ツールでフィードバック送信テスト

### 環境変数の設定（本番）

Cloudflare Dashboard → Pages → gameseekervault → Settings → Environment variables

必須:
- `ADMIN_PASSWORD`: 管理画面パスワード
- `ADMIN_EMAIL`: メール通知先

## 参考ドキュメント

- [FEEDBACK_FEATURE.md](../docs/FEEDBACK_FEATURE.md) - フィードバック機能の詳細仕様
- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - システム全体のアーキテクチャ
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
