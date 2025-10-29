# デプロイチェックリスト

## 問題: `/admin` にアクセスしても通常ページが表示される

### 原因
Single Page Application (SPA) のルーティング設定が不足しています。

Cloudflare Pagesは静的ホスティングサービスであり、`/admin` にアクセスすると：
1. サーバーが `admin.html` または `admin/index.html` を探す
2. 見つからない → **404エラー**
3. Reactアプリが読み込まれない

### 解決方法

## ステップ1: `_redirects` ファイルの追加

✅ **完了**: `app/public/_redirects` が作成済み

内容:
```
# SPA routing - redirect all non-API requests to index.html
/api/* 200
/admin /index.html 200
/* /index.html 200
```

**説明**:
- `/api/*`: APIリクエストはそのまま通す（Pages Functionsにルーティング）
- `/admin`: 管理画面は index.html を返す（React Routerが処理）
- `/*`: その他全てのパスも index.html を返す（SPA標準動作）

## ステップ2: ビルド確認

```bash
cd app
npm run build
ls -la dist/_redirects  # ファイルが存在するか確認
cat dist/_redirects     # 内容を確認
```

## ステップ3: Gitにコミット

```bash
git add app/public/_redirects
git commit -m "Add SPA routing for admin panel"
git push
```

## ステップ4: デプロイ確認

1. **Cloudflare Dashboardで確認**:
   - Pages → gameseekervault → Deployments
   - 最新のデプロイを開く
   - 「View build log」で `_redirects` がコピーされたか確認

2. **動作確認**:
   ```
   https://gameseekervault.pages.dev/       ← 通常ページ
   https://gameseekervault.pages.dev/admin  ← 管理画面（ログインフォーム）
   ```

## ステップ5: 環境変数の設定

Cloudflare Dashboard → Pages → gameseekervault → Settings → Environment variables

必須の環境変数:
- `ADMIN_PASSWORD`: 管理画面のパスワード（任意の文字列）
- `ADMIN_EMAIL`: メール通知の送信先アドレス

**注意**: 環境変数を追加/変更した後は再デプロイが必要です。

## トラブルシューティング

### Q1: デプロイしたが管理画面に入れない

**確認1**: ブラウザのキャッシュをクリア
- Cmd+Shift+R (Mac) または Ctrl+Shift+R (Windows)

**確認2**: URLが正しいか
- ❌ `https://gameseekervault.pages.dev/admin/`（末尾のスラッシュ）
- ✅ `https://gameseekervault.pages.dev/admin`

**確認3**: `_redirects` が含まれているか
```bash
# ローカルで確認
cat dist/_redirects

# Cloudflare Dashboardで確認
Pages → Deployments → 最新 → Functions
```

### Q2: パスワードを入れても「認証に失敗しました」

**確認1**: 環境変数が設定されているか
- Cloudflare Dashboard → Pages → Settings → Environment variables
- `ADMIN_PASSWORD` が設定されているか

**確認2**: 再デプロイしたか
- 環境変数を追加/変更した後は、必ず再デプロイが必要

**確認3**: ブラウザの開発者ツールでエラー確認
- Network タブで `/api/admin/list-feedback` のレスポンスを確認
- 401 Unauthorized → パスワードが間違っている
- 500 Internal Server Error → KVバインディングの問題

### Q3: フィードバックが送信できない

ローカル開発の場合:
```bash
npm run dev:full  # Viteではなく、Wranglerを使用
```

本番環境の場合:
- ブラウザの開発者ツール → Console でエラー確認
- Network タブで `/api/submit-feedback` のステータス確認

## デプロイフロー（推奨）

1. ローカルでビルドテスト:
   ```bash
   npm run build
   cat dist/_redirects  # 確認
   ```

2. コミット:
   ```bash
   git add .
   git commit -m "Add feedback feature"
   git push
   ```

3. Cloudflare Pagesが自動ビルド・デプロイ

4. デプロイ完了後、動作確認:
   - 通常ページ
   - 管理画面（パスワード入力）
   - フィードバック送信テスト

## 参考ドキュメント

- [FEEDBACK_FEATURE.md](../docs/FEEDBACK_FEATURE.md) - 機能の詳細仕様
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 開発ガイド
- [Cloudflare Pages - Single Page Apps](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-app-spa-rendering)
