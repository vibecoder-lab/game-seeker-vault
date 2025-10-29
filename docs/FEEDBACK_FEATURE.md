# フィードバック機能 実装ドキュメント

## 概要

ユーザーからの問い合わせや不具合報告を受け付け、管理画面で管理するための機能です。

## 機能一覧

### ユーザー側機能
- ヘルプモーダルの「フィードバック」タブからフィードバック送信
- カテゴリ選択（お問い合わせ / 不具合報告）
- タイトル・詳細の入力
- メールアドレスの任意入力（返信用）
- フロントエンドバリデーション
- 送信成功/失敗のフィードバック表示

### 管理者側機能
- パスワード認証による管理画面アクセス (`/admin?password=xxx`)
- フィードバック一覧表示（ページネーション付き、20件/ページ）
- カテゴリフィルター（全て / お問い合わせ / 不具合報告）
- 検索機能（タイトル・詳細で検索）
- 詳細表示
- ステータス管理（未対応 / 対応中 / 完了）
- 削除機能
- データエクスポート（CSV / JSON）
- 新規フィードバック受信時のメール通知

## アーキテクチャ

### データフロー

```
[ユーザー]
  ↓ フィードバック送信
[HelpModal - Feedbackタブ]
  ↓ POST /api/submit-feedback
[Cloudflare Workers - submit-feedback.ts]
  ↓ 保存
[Cloudflare KV - FEEDBACK_KV]
  ↓ メール通知
[Cloudflare Email Workers (MailChannels)]
  ↓
[管理者メール]

[管理者]
  ↓ アクセス /admin?password=xxx
[AdminPanel.jsx]
  ↓ GET /api/admin/list-feedback
[Cloudflare Workers - list-feedback.ts]
  ↓ 取得
[Cloudflare KV - FEEDBACK_KV]
```

### ディレクトリ構造

```
app/
├── src/
│   ├── components/
│   │   ├── AdminPanel.jsx           # 管理画面UI
│   │   └── modals/
│   │       └── HelpModal.jsx        # フィードバックタブ追加
│   ├── i18n/
│   │   └── translations.js          # 翻訳追加
│   └── main.jsx                     # ルーティング追加
├── functions/
│   └── api/
│       ├── submit-feedback.ts       # フィードバック送信API
│       └── admin/
│           ├── list-feedback.ts     # 一覧取得API
│           ├── update-status.ts     # ステータス更新API
│           └── delete-feedback.ts   # 削除API
└── wrangler.jsonc                   # KVバインディング設定
```

## データ構造

### KVストレージ

**Key形式**: `feedback:{timestamp}:{uuid}`

例: `feedback:1709876543210:a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Value (JSON)**:
```json
{
  "id": "feedback:1709876543210:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "inquiry" | "bug",
  "title": "タイトル",
  "content": "詳細内容",
  "email": "user@example.com" | null,
  "userAgent": "Mozilla/5.0...",
  "locale": "ja" | "en",
  "timestamp": 1709876543210,
  "ipCountry": "JP",
  "status": "未対応" | "対応中" | "完了"
}
```

### フィールド説明

| フィールド | 型 | 説明 |
|----------|-----|------|
| id | string | ユニークID（KVのキーと同じ） |
| type | string | カテゴリ（inquiry: お問い合わせ, bug: 不具合報告） |
| title | string | タイトル（最大100文字） |
| content | string | 詳細内容（最大2000文字） |
| email | string \| null | ユーザーのメールアドレス（任意） |
| userAgent | string | ユーザーのブラウザ情報 |
| locale | string | 言語設定（Accept-Languageヘッダーから取得） |
| timestamp | number | 送信日時（UNIXタイムスタンプ） |
| ipCountry | string | 送信元の国（CF-IPCountryヘッダーから取得） |
| status | string | ステータス（未対応 / 対応中 / 完了） |

## API仕様

### 1. フィードバック送信API

**エンドポイント**: `POST /api/submit-feedback`

**リクエストボディ**:
```json
{
  "type": "inquiry" | "bug",
  "title": "タイトル",
  "content": "詳細内容",
  "email": "user@example.com" | null
}
```

**バリデーション**:
- `type`: 必須、"inquiry"または"bug"のみ
- `title`: 必須、最大100文字
- `content`: 必須、最大2000文字
- `email`: 任意、形式チェック（正規表現: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`）

**レスポンス**:
```json
{
  "success": true,
  "id": "feedback:1709876543210:a1b2c3d4-..."
}
```

**エラーレスポンス**:
```json
{
  "error": "エラーメッセージ"
}
```

### 2. フィードバック一覧取得API

**エンドポイント**: `GET /api/admin/list-feedback?password=xxx`

**認証**: クエリパラメータ`password`で認証

**レスポンス**:
```json
{
  "items": [
    {
      "id": "...",
      "type": "inquiry",
      "title": "...",
      "content": "...",
      "email": "...",
      "userAgent": "...",
      "locale": "ja",
      "timestamp": 1709876543210,
      "ipCountry": "JP",
      "status": "未対応"
    },
    ...
  ]
}
```

### 3. ステータス更新API

**エンドポイント**: `PUT /api/admin/update-status?password=xxx`

**リクエストボディ**:
```json
{
  "id": "feedback:1709876543210:a1b2c3d4-...",
  "status": "未対応" | "対応中" | "完了"
}
```

**レスポンス**:
```json
{
  "success": true
}
```

### 4. 削除API

**エンドポイント**: `DELETE /api/admin/delete-feedback?password=xxx`

**リクエストボディ**:
```json
{
  "id": "feedback:1709876543210:a1b2c3d4-..."
}
```

**レスポンス**:
```json
{
  "success": true
}
```

## メール通知機能

### 送信方法
Cloudflare Email Workers (MailChannels API) を使用

### 通知タイミング
新規フィードバックが送信されたとき

### メール内容

**件名**: `[Game Seeker Vault] 新規フィードバック: お問い合わせ` または `不具合報告`

**本文**:
```
新しいフィードバックが送信されました。

カテゴリ: お問い合わせ
タイトル: xxxxx
詳細: xxxxx
メールアドレス: user@example.com
送信日時: 2025-03-08 12:34:56
ユーザーエージェント: Mozilla/5.0...
国: JP
言語: ja

管理画面: https://gameseekervault.pages.dev/admin?password=xxxxx
```

### MailChannels API仕様

**エンドポイント**: `https://api.mailchannels.net/tx/v1/send`

**リクエストボディ**:
```json
{
  "personalizations": [
    {
      "to": [{ "email": "admin@example.com" }]
    }
  ],
  "from": {
    "email": "noreply@gameseekervault.pages.dev",
    "name": "Game Seeker Vault"
  },
  "subject": "件名",
  "content": [
    {
      "type": "text/plain",
      "value": "本文"
    }
  ]
}
```

## 環境変数

Cloudflare Pagesの環境変数に以下を設定:

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `ADMIN_PASSWORD` | 管理画面のパスワード | `your-secure-password-123` |
| `ADMIN_EMAIL` | メール通知の送信先 | `admin@example.com` |

### 設定方法

1. Cloudflare Dashboardにログイン
2. Pages → gameseekervault → Settings → Environment variables
3. Production / Preview それぞれに以下を追加:
   - Variable name: `ADMIN_PASSWORD`
   - Value: （任意の安全なパスワード）
   - Variable name: `ADMIN_EMAIL`
   - Value: （通知先メールアドレス）
4. Save

## KVネームスペース

### 作成済み

**Namespace名**: `game-seeker-feedback`
**ID**: `60e75ed5209d480894702e57641eee35`
**Binding**: `FEEDBACK_KV`

### wrangler.jsonc設定

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "GSV_GAMES",
      "id": "d0226a9ed9f44c6ba8bb14bcf4dd7eb8"
    },
    {
      "binding": "FEEDBACK_KV",
      "id": "60e75ed5209d480894702e57641eee35",
      "remote": true
    }
  ],
  "env": {
    "preview": {
      "kv_namespaces": [
        {
          "binding": "GSV_GAMES",
          "id": "24a25926efaf4b1296fc131672054500"
        },
        {
          "binding": "FEEDBACK_KV",
          "id": "60e75ed5209d480894702e57641eee35"
        }
      ]
    }
  }
}
```

## UI/UX

### フィードバックフォーム（ユーザー側）

**場所**: ヘルプモーダル → 「フィードバック」タブ

**レイアウト**:
```
┌─────────────────────────────────────┐
│ フィードバック                        │
├─────────────────────────────────────┤
│ カテゴリ                              │
│ ○ お問い合わせ  ○ 不具合報告         │
│                                      │
│ タイトル                              │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                      │
│ 詳細                                  │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│ 0/2000                               │
│                                      │
│ メールアドレス（任意）                 │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │          送信                    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 管理画面

**URL**: `/admin?password=xxx`

**レイアウト**:
```
┌────────────────────────────────────────────────────┐
│ フィードバック管理           [CSV出力][JSON出力][再読み込み] │
├────────────────────────────────────────────────────┤
│ [検索...                    ][▼すべて]              │
│ 12件のフィードバック                                 │
├─────────────────────┬──────────────────────────────┤
│ 一覧                 │ 詳細                          │
│                     │                              │
│ ┌─────────────────┐ │ カテゴリ: お問い合わせ         │
│ │[お問い合わせ][未対応]│ │ タイトル: xxxxx              │
│ │ タイトル...       │ │ 詳細: xxxxx                  │
│ │ 2025-03-08 12:34 │ │ メールアドレス: user@...      │
│ └─────────────────┘ │ ステータス: [▼未対応]          │
│ ┌─────────────────┐ │ 送信日時: 2025-03-08...       │
│ │[不具合報告][対応中] │ │ 国/言語: JP / ja             │
│ │ タイトル...       │ │ User Agent: Mozilla...       │
│ │ 2025-03-07 10:20 │ │ ID: feedback:...             │
│ └─────────────────┘ │ [削除]                        │
│                     │                              │
│ [前へ] 1/5 [次へ]    │                              │
└─────────────────────┴──────────────────────────────┘
```

## ローカル開発

### 初回セットアップ

1. Wranglerをインストール:
   ```bash
   cd app
   npm install
   ```

2. 環境変数を設定 (`.dev.vars`ファイルを作成):
   ```bash
   ADMIN_PASSWORD=your-password
   ADMIN_EMAIL=your-email@example.com
   ```

### 開発サーバーの起動

**重要**: Pages Functions (API) をローカルでテストするには、Wranglerが必要です。

#### オプション1: フロントエンドのみ開発 (APIは使用できない)
```bash
npm run dev
```
- Vite開発サーバーが起動（高速リロード）
- **APIエンドポイント (`/api/*`) は404エラーになります**

#### オプション2: フル機能で開発 (API含む)
```bash
npm run dev:full
```
- ビルド後、Wrangler Pages Devサーバーが起動
- APIエンドポイントも動作
- ただし、ホットリロードは無効

#### オプション3: ビルド済みで開発
```bash
npm run build
npm run dev:pages
```
- 別途 `npm run build` でビルドした後、Wranglerで起動

### 404エラーが出る場合

**症状**: `/api/submit-feedback` にアクセスすると404

**原因**: `npm run dev` (Vite) では Pages Functions が動作しない

**解決策**: `npm run dev:full` を使用してください

## ローカル開発でのKV動作

### データの保存先

| 設定 | 保存先 | 永続化 | 本番への影響 |
|------|--------|--------|-------------|
| `remote: true` | 本番のCloudflare KV | ✅ あり | ⚠️ **本番データを汚染** |
| `remote: false` または未指定 | ローカル `.wrangler/state/v3/kv` | ❌ なし（再起動で消える） | ✅ なし |

### 現在の設定

**デフォルト**: `remote: false`（ローカルKV使用）

- ローカル開発時は `.wrangler/state/v3/kv` に保存
- サーバー再起動時にデータが消える
- 本番環境には影響しない

### 本番KVを使いたい場合

wrangler.jsoncで `"remote": true` を追加:

```jsonc
{
  "binding": "FEEDBACK_KV",
  "id": "60e75ed5209d480894702e57641eee35",
  "remote": true  // ← 追加
}
```

**注意**: 開発中のテストデータが本番KVに保存されます。

### ローカルKVのデータ確認

```bash
# ローカルKVの場所
ls -la app/.wrangler/state/v3/kv/

# データを確認（sqlite3）
sqlite3 app/.wrangler/state/v3/kv/FEEDBACK_KV.sqlite3
> SELECT * FROM _cf_KV;
```

## セキュリティ

### 認証
- 管理画面はクエリパラメータ`password`で認証
- パスワードは環境変数`ADMIN_PASSWORD`で設定
- 全ての管理APIはパスワード認証必須

### CORS
- 許可オリジン: `gameseekervault.pages.dev`（サブドメイン含む）、`localhost`、`127.0.0.1`
- 許可メソッド: GET, POST, PUT, DELETE, OPTIONS
- 許可ヘッダー: Content-Type

### 入力バリデーション
- フロントエンド: React内でバリデーション
- バックエンド: APIレイヤーで再バリデーション
- XSS対策: ユーザー入力はそのまま保存、表示時にReactが自動エスケープ

### レート制限
- 現時点では未実装
- 必要に応じてCloudflare Rate Limitingを設定可能

## 運用

### データ確認方法

1. **管理画面経由**
   - `/admin?password=xxx` にアクセス
   - 一覧・詳細・フィルター・検索が可能

2. **Cloudflare Dashboard経由**
   - Workers & Pages → KV → game-seeker-feedback
   - キー一覧から直接確認・編集・削除可能

### データエクスポート

管理画面から以下の形式でエクスポート可能:

**CSV形式**:
```csv
ID,カテゴリ,タイトル,詳細,メールアドレス,ステータス,送信日時,国,言語
feedback:...,お問い合わせ,xxxxx,xxxxx,user@...,未対応,2025-03-08 12:34:56,JP,ja
```

**JSON形式**:
```json
[
  {
    "ID": "feedback:...",
    "カテゴリ": "お問い合わせ",
    "タイトル": "xxxxx",
    "詳細": "xxxxx",
    "メールアドレス": "user@...",
    "ステータス": "未対応",
    "送信日時": "2025-03-08 12:34:56",
    "国": "JP",
    "言語": "ja"
  }
]
```

### バックアップ

定期的に以下を実施:
1. 管理画面からJSON形式でエクスポート
2. 外部ストレージに保存

## トラブルシューティング

### フィードバックが送信できない

**症状**: 送信ボタンを押してもエラーになる

**原因1: 環境変数が未設定**
- `FEEDBACK_KV` バインディングが設定されていない
- 確認方法: Cloudflare Dashboard → Pages → gameseekervault → Settings → Functions
- 対処: wrangler.jsoncの設定を確認し、デプロイし直す

**原因2: CORS制限**
- 403 Forbiddenエラーが返される
- ローカル開発時に許可されていないホスト名からアクセスしている
- 対処: `localhost`, `127.0.0.1`, `192.168.*`, `10.*` は許可されている

**原因3: バリデーションエラー**
- 400 Bad Requestエラーが返される
- タイトルが空または100文字超過
- 内容が空または2000文字超過
- メールアドレスの形式が不正
- 対処: 入力内容を確認

**原因4: KVネームスペースが存在しない**
- 500 Internal Server Errorが返される
- KV ID `60e75ed5209d480894702e57641eee35` が実際に存在しない
- 確認方法: Cloudflare Dashboard → Workers & Pages → KV
- 対処: KVネームスペース `game-seeker-feedback` を作成

**デバッグ手順**:
1. ブラウザのコンソールでエラーメッセージを確認
2. ネットワークタブでAPIリクエストのステータスコードを確認
3. レスポンスボディでエラー詳細を確認
4. Cloudflare Workers のログを確認（Dashboard → Pages → gameseekervault → Logs）

### 管理画面にログインできない

#### 症状1: `/admin` にアクセスしても通常ページが表示される

**原因**: SPAルーティングの設定不足

**解決方法**: `_redirects` ファイルが正しくデプロイされているか確認

1. ローカルで確認:
   ```bash
   npm run build
   cat dist/_redirects  # 内容が表示されるか確認
   ```

2. Cloudflare Dashboardで確認:
   - Pages → gameseekervault → Deployments → 最新のデプロイ → Functions
   - `_redirects` ファイルが含まれているか確認

3. 再デプロイ:
   ```bash
   git add app/public/_redirects
   git commit -m "Add SPA routing for admin panel"
   git push
   ```

#### 症状2: パスワードを入力しても「認証に失敗しました」と表示される

**確認事項**:
1. 環境変数`ADMIN_PASSWORD`が正しく設定されているか
2. Cloudflare Pagesの設定を変更した場合、再デプロイが必要
3. ブラウザのキャッシュをクリア

### メール通知が届かない

**症状**: フィードバック送信後、管理者にメールが届かない

**重要**: MailChannels APIを使用するには、以下のDNS設定が必要です:

**必須のDNS設定**:
1. MailChannels認証レコード:
   ```
   タイプ: TXT
   名前: _mailchannels.gameseekervault.pages.dev
   値: v=mc1 cfid=gameseekervault.pages.dev
   ```

2. SPFレコード:
   ```
   タイプ: TXT
   名前: gameseekervault.pages.dev
   値: v=spf1 include:relay.mailchannels.net ~all
   ```

3. DKIM設定（推奨）:
   - MailChannelsのドキュメントを参照

**DNS設定なしの場合の動作**:
- メール送信は失敗するが、フィードバックの保存は成功する
- エラーはコンソールにログ出力されるが、ユーザーには影響しない

**確認事項**:
1. 環境変数`ADMIN_EMAIL`が正しく設定されているか
2. DNS設定が正しく反映されているか（`dig TXT _mailchannels.gameseekervault.pages.dev`で確認）
3. メールの迷惑メールフォルダを確認
4. Cloudflare Workersのログを確認（Dashboard → Pages → gameseekervault → Logs）

**代替案**:
DNS設定が困難な場合、以下の代替サービスを検討:
- **Resend**: 簡単な設定でメール送信可能（月3,000通まで無料）
- **SendGrid**: 老舗のメールサービス（月100通まで無料）
- **AWS SES**: AWS利用者向け

これらのサービスを使用する場合、[submit-feedback.ts](../app/functions/api/submit-feedback.ts)のLine 155-178を変更する必要があります。

### KVに保存されない

**症状**: フィードバック送信は成功するが、管理画面に表示されない

**確認事項**:
1. KVネームスペース`FEEDBACK_KV`が正しくバインドされているか
2. wrangler.jsoncの設定を確認
3. Cloudflare Dashboard → KV → game-seeker-feedback でデータを直接確認

## 今後の拡張案

### 優先度: 高
- [ ] メール返信機能（管理画面からユーザーにメール返信）
- [ ] レート制限の実装（スパム対策）
- [ ] 画像添付機能（スクリーンショット等）

### 優先度: 中
- [ ] 既読/未読フラグ
- [ ] フィードバックへのコメント機能（メモ）
- [ ] タグ付け機能
- [ ] 自動翻訳機能（多言語対応）

### 優先度: 低
- [ ] フィードバックの統計・分析機能
- [ ] Slack/Discord通知連携
- [ ] フィードバックのテンプレート機能

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-10-30 | 1.0.0 | 初版リリース |

## 関連ドキュメント

- [ARCHITECTURE.md](./ARCHITECTURE.md) - システム全体のアーキテクチャ
- [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) - フロントエンド開発ガイド
- [Cloudflare Workers KV Documentation](https://developers.cloudflare.com/kv/)
- [MailChannels API Documentation](https://mailchannels.zendesk.com/hc/en-us/articles/4565898358413-Sending-Email-from-Cloudflare-Workers-using-MailChannels-Send-API)
