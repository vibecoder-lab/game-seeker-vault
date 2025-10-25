# データ構造仕様書

## 概要

このドキュメントは、Game Seeker Vaultで使用される全てのデータ構造を定義します。

**対象読者**: データ構造を理解したい開発者

---

## 目次

- [IndexedDB構造](#indexeddb構造)
- [Cloudflare KV構造](#cloudflare-kv構造)
- [API構造](#api構造)
- [ゲームデータ構造](#ゲームデータ構造)
- [価格データ構造](#価格データ構造)

---

## IndexedDB構造

### データベース: `GameSeekerVaultDB`

**バージョン**: 4
**ストア一覧**:
- `folders` - フォルダ管理
- `collection` - コレクションアイテム
- `settings` - ユーザー設定

---

### ストア: `folders`

**用途**: コレクションのフォルダ管理

**スキーマ**:

```typescript
interface Folder {
  id: number;              // Auto-increment primary key
  name: string;            // フォルダ名
  createdAt: string;       // 作成日時 (YYYY-MM-DD HH:MM:SS)
  sortOrder: number;       // ソート順 (v4で追加)
}
```

**インデックス**:
- `name` (unique: false)

**デフォルトフォルダ**:

| sortOrder | name | 説明 |
|-----------|------|------|
| 1 | 気になるリスト | 固定フォルダ（削除不可） |
| 2-N | ユーザー作成フォルダ | ドラッグ&ドロップで並び替え可能 |
| N+1 | 所有リスト | 固定フォルダ（削除不可） |

**サンプルデータ**:

```json
[
  {
    "id": 1,
    "name": "気になるリスト",
    "createdAt": "2025-01-15 10:30:00",
    "sortOrder": 1
  },
  {
    "id": 2,
    "name": "セール待ち",
    "createdAt": "2025-01-16 14:20:00",
    "sortOrder": 2
  },
  {
    "id": 3,
    "name": "所有リスト",
    "createdAt": "2025-01-15 10:30:00",
    "sortOrder": 99
  }
]
```

---

### ストア: `collection`

**用途**: フォルダ内のゲーム管理

**スキーマ**:

```typescript
interface CollectionItem {
  id: number;              // Auto-increment primary key
  folderId: number;        // 所属フォルダID
  gameId: string;          // Steam App ID (文字列)
  addedAt: string;         // 追加日時 (YYYY-MM-DD HH:MM:SS)
  sortOrder: number;       // フォルダ内ソート順
}
```

**インデックス**:
- `folderId` (unique: false)
- `gameId` (unique: false)

**制約**:
- 同一ゲームを複数フォルダに追加可能
- 1フォルダ内に同一ゲームは1つまで

**サンプルデータ**:

```json
[
  {
    "id": 1,
    "folderId": 1,
    "gameId": "1794680",
    "addedAt": "2025-01-20 15:45:00",
    "sortOrder": 1
  },
  {
    "id": 2,
    "folderId": 1,
    "gameId": "620",
    "addedAt": "2025-01-21 09:10:00",
    "sortOrder": 2
  }
]
```

---

### ストア: `settings`

**用途**: ユーザー設定の保存

**スキーマ**:

```typescript
interface Settings {
  key: string;                    // Primary key: 'user-settings'
  removePriceLimit: boolean;      // 価格上限20,000円に引き上げ
  showTotalPrice: boolean;        // 合計金額表示
  alwaysShowStarIcon: boolean;    // スターアイコン常時表示
  permanentDelete: boolean;       // ゴミ箱を使わず完全削除
  theme: 'default' | 'steam';     // テーマ
  useSelectedFolderAsTarget: boolean;  // 選択フォルダを登録先に
  keyboardLayout: 'ansi' | 'iso'; // キーボードレイアウト
  useAlternativeKeys: boolean;    // Z/Xキーを使用
  saveTheme: boolean;             // テーマ設定を保存
  showAllTags: boolean;           // 全タグ表示
  enableScrollAnimation: boolean; // スクロールアニメーション
  hideOwnedTitles: boolean;       // 所有タイトル非表示
  locale: 'en' | 'ja';            // 言語設定
  settingsVersion: number;        // 設定バージョン
}
```

**デフォルト値**:

```json
{
  "key": "user-settings",
  "removePriceLimit": false,
  "showTotalPrice": false,
  "alwaysShowStarIcon": false,
  "permanentDelete": false,
  "theme": "default",
  "useSelectedFolderAsTarget": false,
  "keyboardLayout": "ansi",
  "useAlternativeKeys": false,
  "saveTheme": false,
  "showAllTags": false,
  "enableScrollAnimation": true,
  "hideOwnedTitles": false,
  "locale": "en",
  "settingsVersion": 1
}
```

---

## Cloudflare KV構造

### KV Namespace: `GSV_GAMES`

**用途**: ゲームデータのグローバル配信

---

### Key: `games-data`

**構造**:

```typescript
interface GamesData {
  meta: {
    last_updated: string;        // ISO 8601形式 (e.g., "2025-10-25T07:27:13Z")
    data_version: string;         // バージョン (e.g., "1.0.0")
    source: {
      steam: boolean;             // Steam APIデータ含む
      itad: boolean;              // ITAD APIデータ含む
    };
    build_id: string;             // ビルドID (UUID)
    record_count: number;         // ゲーム数
  };
  games: Game[];                  // ゲームデータ配列
}
```

**サンプル**:

```json
{
  "meta": {
    "last_updated": "2025-10-25T07:27:13Z",
    "data_version": "1.0.0",
    "source": {
      "steam": true,
      "itad": true
    },
    "build_id": "2e2446b8-66ad-4470-842b-3ec842161c8c",
    "record_count": 10762
  },
  "games": [
    { ... }
  ]
}
```

---

### Key: `id-map`

**構造**:

```typescript
interface IdMapEntry {
  id: string;        // Steam App ID
  itadId: string;    // ITAD Game ID (UUID形式)
}

type IdMap = IdMapEntry[];
```

**サンプル**:

```json
[
  {
    "id": "730",
    "itadId": "018d937f-7851-7004-b780-3f657a301f9a"
  },
  {
    "id": "1623730",
    "itadId": "018d937f-50c1-7086-807c-e020c98c72b2"
  }
]
```

**用途**:
- Steam App ID → ITAD ID変換
- ITAD APIでの価格取得時に使用

---

## API構造

### Pages Function: `/api/games-data`

**メソッド**: GET

**レスポンス**:

```typescript
{
  success: boolean;
  data: GamesData | null;     // games-dataの内容
  error?: string;
}
```

**エラー例**:

```json
{
  "success": false,
  "data": null,
  "error": "Failed to fetch games data from KV"
}
```

---

### Pages Function: `/api/detect-locale`

**メソッド**: GET

**レスポンス**:

```typescript
{
  browserLang: string;      // ブラウザ言語 (e.g., "ja", "en")
  suggestedLang: string;    // 推奨言語 (Cloudflare geoから推測)
  country?: string;         // 国コード (e.g., "JP", "US")
}
```

**サンプル**:

```json
{
  "browserLang": "ja",
  "suggestedLang": "ja",
  "country": "JP"
}
```

---

## ゲームデータ構造

### Game オブジェクト

```typescript
interface Game {
  id: string;                    // Steam App ID
  itadId: string | null;         // ITAD ID (なければnull)
  title: string;                 // ゲームタイトル
  storeUrl: string;              // Steam ストアURL
  imageUrl: string;              // ゲーム画像URL (capsule_616x353.jpg)
  movies: Movie[];               // トレーラー動画
  reviewScore: string;           // レビュースコア
  deal: Deal;                    // 価格情報
  genres: string[];              // ジャンル
  tags: string[];                // タグ (上位3つ)
  releaseDate: string;           // リリース日 (YYYY-MM-DD)
  developers: string[];          // 開発者
  publishers: string[];          // パブリッシャー
  platforms: Platform;           // 対応プラットフォーム
  supportedLanguages: string;    // 対応言語
}
```

---

### Movie オブジェクト

```typescript
interface Movie {
  id: number;           // 動画ID
  name: string;         // 動画名
  thumbnail: string;    // サムネイルURL
  webm: string;         // WebM URL (480p)
  mp4: string;          // MP4 URL (480p)
}
```

---

### Platform オブジェクト

```typescript
interface Platform {
  windows: boolean;
  mac: boolean;
  linux: boolean;
}
```

---

## 価格データ構造

### Deal オブジェクト

**v1.0 (旧構造 - JPYのみ)**:

```typescript
interface Deal {
  JPY: PriceData;
}
```

**v2.0 (現在 - JPY + USD対応)**:

```typescript
interface Deal {
  JPY: PriceData;
  USD: PriceData;
}
```

---

### PriceData オブジェクト

```typescript
interface PriceData {
  price: number | string;      // 現在価格 ('-'はデータなし)
  regular: number | string;    // 通常価格 ('-'はデータなし)
  cut: number;                 // 割引率 (0-100)
  storeLow: number | string;   // Steam史上最安値 ('-'はITADデータなし)
  noItadData?: boolean;        // ITADデータなしフラグ (Steam APIのみの場合)
}
```

---

### 価格データの例

#### ケース1: ITAD APIあり（完全なデータ）

```json
{
  "deal": {
    "JPY": {
      "price": 2550,
      "regular": 5100,
      "cut": 50,
      "storeLow": 1530
    },
    "USD": {
      "price": 17,
      "regular": 34,
      "cut": 50,
      "storeLow": 10
    }
  }
}
```

#### ケース2: ITAD APIなし（Steam APIのみ）

```json
{
  "deal": {
    "JPY": {
      "price": 2550,
      "regular": 5100,
      "cut": 50,
      "storeLow": "-",
      "noItadData": true
    },
    "USD": {
      "price": 17,
      "regular": 34,
      "cut": 50,
      "storeLow": "-",
      "noItadData": true
    }
  }
}
```

#### ケース3: 無料ゲーム

```json
{
  "deal": {
    "JPY": {
      "price": 0,
      "regular": 0,
      "cut": 0,
      "storeLow": "-",
      "noItadData": true
    },
    "USD": {
      "price": 0,
      "regular": 0,
      "cut": 0,
      "storeLow": "-",
      "noItadData": true
    }
  }
}
```

---

## データ変換マップ

### Steam Review Score → 日本語

| Steam API値 | 英語表示 | 日本語表示 |
|------------|---------|----------|
| Overwhelmingly Positive | Overwhelmingly Positive | 圧倒的に好評 |
| Very Positive | Very Positive | 非常に好評 |
| Positive | Positive | 好評 |
| Mostly Positive | Mostly Positive | やや好評 |
| Mixed | Mixed | 賛否両論 |
| Mostly Negative | Mostly Negative | やや不評 |
| Negative | Negative | 不評 |
| Very Negative | Very Negative | 非常に不評 |
| Overwhelmingly Negative | Overwhelmingly Negative | 圧倒的に不評 |
| No user reviews | No user reviews | ユーザーレビューなし |

### Steam Genre → 日本語

| Steam API値 | 英語表示 | 日本語表示 |
|------------|---------|----------|
| Action | Action | アクション |
| Adventure | Adventure | アドベンチャー |
| RPG | RPG | RPG |
| Strategy | Strategy | ストラテジー |
| Simulation | Simulation | シミュレーション |
| Casual | Casual | カジュアル |
| Indie | Indie | インディー |
| Free To Play | Free To Play | Free To Play |
| Sports | Sports | スポーツ |
| Racing | Racing | レーシング |
| Massively Multiplayer | MMO | MMO |
| Early Access | Early Access | 早期アクセス |

---

## エクスポート/インポートデータ構造

### エクスポートファイル形式

**ファイル名**: `steam-collection_YYYY-MMDD-HHMM.json`

**構造**:

```typescript
interface ExportData {
  exportedAt: string;              // エクスポート日時
  version: string;                 // データバージョン
  folders: ExportFolder[];         // フォルダ一覧
  games: ExportGame[];             // ゲーム一覧
}

interface ExportFolder {
  name: string;
  createdAt: string;
  sortOrder: number;
}

interface ExportGame {
  folderName: string;              // フォルダ名
  gameId: string;                  // Steam App ID
  addedAt: string;
  sortOrder: number;
}
```

**サンプル**:

```json
{
  "exportedAt": "2025-01-25 14:30:00",
  "version": "1.0",
  "folders": [
    {
      "name": "気になるリスト",
      "createdAt": "2025-01-15 10:30:00",
      "sortOrder": 1
    },
    {
      "name": "セール待ち",
      "createdAt": "2025-01-16 14:20:00",
      "sortOrder": 2
    }
  ],
  "games": [
    {
      "folderName": "気になるリスト",
      "gameId": "1794680",
      "addedAt": "2025-01-20 15:45:00",
      "sortOrder": 1
    }
  ]
}
```

---

## データマイグレーション

### IndexedDB バージョン履歴

| Version | 変更内容 |
|---------|---------|
| 1 | 初期スキーマ |
| 2-3 | (詳細不明) |
| 4 | `folders` に `sortOrder` フィールド追加 |

### KV データバージョン

| Version | 変更内容 |
|---------|---------|
| 1.0 | `deal.JPY` のみ |
| 2.0 | `deal.JPY` + `deal.USD` 対応 |

---

## 関連ドキュメント

- [ARCHITECTURE.md](./ARCHITECTURE.md) - システム全体構成
- [BATCH_PROCESSING.md](./BATCH_PROCESSING.md) - バッチ処理ガイド
- [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) - フロントエンド開発ガイド
