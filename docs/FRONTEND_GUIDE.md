# フロントエンド開発ガイド

## 概要

このドキュメントは、Game Seeker VaultのフロントエンドUIの構成、コンポーネント、状態管理、i18n実装を説明します。

**対象読者**: フロントエンド開発者

---

## 目次

- [技術スタック](#技術スタック)
- [ディレクトリ構成](#ディレクトリ構成)
- [主要コンポーネント](#主要コンポーネント)
- [状態管理](#状態管理)
- [i18n実装](#i18n実装)
- [IndexedDB操作](#indexeddb操作)
- [スタイリング](#スタイリング)
- [開発フロー](#開発フロー)

---

## 技術スタック

| 技術 | バージョン | 用途 |
|------|----------|------|
| **React** | 19.1.1 | UIフレームワーク |
| **Vite** | 最新 | ビルドツール・開発サーバー |
| **Tailwind CSS** | 3.4.18 | ユーティリティファーストCSS |
| **@dnd-kit** | 6.3.1 | ドラッグ&ドロップ |
| **@tanstack/react-virtual** | 3.13.12 | 仮想スクロール |
| **IndexedDB** | ブラウザ標準 | クライアント側ストレージ |

---

## ディレクトリ構成

```
app/src/
├── main.jsx                # アプリケーションエントリーポイント
├── index.css               # グローバルCSS
│
├── components/             # Reactコンポーネント
│   ├── Header.jsx          # ヘッダー（ロゴ、ボタン群）
│   ├── GameCard.jsx        # ゲームカード（一覧表示）
│   ├── AdminPanel.jsx      # 管理パネル（フィードバック管理）
│   └── modals/             # モーダルコンポーネント
│       ├── CollectionModal.jsx      # コレクション管理
│       ├── SettingsModal.jsx        # 設定
│       ├── HelpModal.jsx            # ヘルプ・免責事項
│       ├── ImportExportModal.jsx    # インポート/エクスポート
│       ├── MobileFilterModal.jsx    # モバイル用フィルタ
│       ├── MobileGenreModal.jsx     # モバイル用ジャンル選択
│       ├── VideoModal.jsx           # トレーラー再生
│       ├── FeedbackModal.jsx        # フィードバック送信
│       └── LanguageRegionModal.jsx  # 言語・リージョン切り替え
│
├── db/                     # IndexedDB操作
│   ├── index.js            # DB操作のエクスポート
│   ├── init.js             # DB初期化・マイグレーション
│   ├── folders.js          # フォルダCRUD操作
│   ├── collection.js       # コレクションCRUD操作
│   └── settings.js         # 設定読み書き
│
├── i18n/                   # 多言語化
│   ├── index.js            # i18nヘルパー関数
│   └── translations.js     # 翻訳辞書（en/ja）
│
├── constants/              # 定数定義
│   ├── index.js            # 共通定数（DB名、設定、テーマ）
│   ├── genres.js           # ジャンルマッピング
│   └── reviews.js          # レビュースコアマッピング
│
├── utils/                  # ユーティリティ関数
│   ├── format.js           # フォーマット関数
│   └── steam.js            # Steam関連ヘルパー
│
└── assets/                 # 静的アセット（アイコン等）
```

---

## 主要コンポーネント

### 1. `main.jsx` - メインアプリケーション

**コンポーネント**: `SteamPriceFilter`

**役割**: アプリケーション全体の状態管理とレンダリング

**主要なState**:

```javascript
const [rawGames, setRawGames] = React.useState([]);           // 全ゲームデータ
const [selectedGenres, setSelectedGenres] = React.useState({  // ジャンル選択
  include: [],
  exclude: []
});
const [searchTitle, setSearchTitle] = React.useState("");     // タイトル検索
const [minPrice, setMinPrice] = React.useState(100);          // 最低価格
const [maxPrice, setMaxPrice] = React.useState(3000);         // 最高価格
const [priceMode, setPriceMode] = React.useState("current");  // 価格モード
const [onlyJP, setOnlyJP] = React.useState(false);            // 日本語対応のみ
const [onlySale, setOnlySale] = React.useState(false);        // セール中のみ
const [currentTheme, setCurrentTheme] = React.useState("default"); // テーマ
const [locale, setLocaleState] = React.useState("en");        // 言語
```

**データ取得**:

```javascript
React.useEffect(() => {
  fetch('/api/games-data')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setRawGames(data.data.games);
        setMetaData(data.data.meta);
      }
    });
}, []);
```

---

### 2. `Header.jsx` - ヘッダーコンポーネント

**役割**: ロゴ、コレクションボタン、フォルダ選択、各種設定ボタン

**Props**:

```typescript
interface HeaderProps {
  theme: Theme;
  locale: string;
  onCollectionClick: () => void;
  onImportExportClick: () => void;
  onHelpClick: () => void;
  onSettingsClick: () => void;
  onLocaleToggle: () => void;
  onThemeToggle: () => void;
  // ... その他
}
```

**レイアウト**:

```
┌────────────────────────────────────────────────┐
│ [ロゴ] [★コレクション] [📁フォルダ] [...ボタン]  │
└────────────────────────────────────────────────┘
```

---

### 3. `GameCard.jsx` - ゲームカードコンポーネント

**役割**: 個別ゲームの表示カード

**Props**:

```typescript
interface GameCardProps {
  game: Game;
  theme: Theme;
  locale: string;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onVideoClick: (videoUrl: string) => void;
  // ... その他
}
```

**カード構成**:

```
┌────────────────────────┐
│   ゲーム画像           │ ← ホバーで全体表示
│                        │
│ タイトル               │
│ ジャンル | タグ        │
│ ¥2,550 (-50%)         │ ← 価格・割引率
│ ⭐️ 好評               │ ← レビュースコア
└────────────────────────┘
```

**インタラクション**:
- ホバー → 画像拡大表示
- Shift + ホバー → 詳細情報表示
- ⭐️クリック → コレクション追加
- ▶️クリック → トレーラー再生

---

### 4. `CollectionModal.jsx` - コレクション管理

**役割**: フォルダ管理、ゲーム整理、ドラッグ&ドロップ

**主要機能**:

#### フォルダ管理

```javascript
// フォルダ追加
const handleAddFolder = async (name) => {
  const id = await dbHelper.addFolder(name);
  setFolders([...folders, { id, name, createdAt, sortOrder }]);
};

// フォルダ削除
const handleDeleteFolder = async (folderId) => {
  await dbHelper.deleteFolder(folderId);
  setFolders(folders.filter(f => f.id !== folderId));
};
```

#### ドラッグ&ドロップ（@dnd-kit使用）

```javascript
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

const handleDragEnd = (event) => {
  const { active, over } = event;
  if (active.id !== over?.id) {
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const newOrder = arrayMove(items, oldIndex, newIndex);
    // sortOrder更新
  }
};
```

**レイアウト**:

```
┌───────────────────────────────────┐
│ コレクション                      │
│                                   │
│ 📁 気になるリスト (5)     [編集]  │ ← 固定フォルダ
│ 📁 セール待ち (3)         [編集]  │ ← ドラッグ可能
│ 📁 購入予定 (10)          [編集]  │
│ 📁 所有リスト (50)        [編集]  │ ← 固定フォルダ
│                                   │
│ [新規フォルダ]                    │
│                                   │
│ ゲーム一覧:                       │
│ ┌──────────────────┐              │
│ │ Portal 2         │              │ ← ドラッグ可能
│ │ ¥590            │              │
│ └──────────────────┘              │
│                                   │
│ [セール中のみ] [日本語のみ]       │
└───────────────────────────────────┘
```

---

### 5. `AdminPanel.jsx` - 管理パネル

**役割**: フィードバック管理、アクセス制御

**主要機能**:
- シークレットキー認証
- フィードバック一覧表示
- フィードバック削除
- タイムスタンプでソート

**認証フロー**:

```javascript
const handleAuth = async (secret) => {
  const res = await fetch(`/api/feedback-admin?secret=${secret}`);
  const data = await res.json();
  if (data.success) {
    setIsAuthed(true);
    setFeedbackList(data.feedbacks);
  }
};
```

---

### 6. モーダルコンポーネント群

#### `SettingsModal.jsx` - 設定モーダル

**設定項目**:

```javascript
{
  removePriceLimit: boolean,      // 価格上限引き上げ
  showTotalPrice: boolean,        // 合計金額表示
  alwaysShowStarIcon: boolean,    // スターアイコン常時表示
  theme: 'default' | 'steam',     // テーマ
  locale: 'en' | 'ja',            // 言語
  region: 'JPY' | 'USD',          // 価格表示リージョン
  // ... その他
}
```

#### `ImportExportModal.jsx` - インポート/エクスポート

**機能**:
- 全フォルダエクスポート → `steam-collection_YYYY-MMDD-HHMM.json`
- 特定フォルダエクスポート
- JSONファイルインポート

#### `HelpModal.jsx` - ヘルプ・免責事項

**タブ**:
- 免責事項タブ
- 使い方ガイドタブ

#### `VideoModal.jsx` - 動画再生モーダル

**役割**: ゲームトレーラー再生、スクリーンショット表示

**主要機能**:
- 複数動画の切り替え（サムネイル表示）
- ホバーで動画リスト表示（下100pxは除外）
- 自動再生
- 動画がない場合はスクリーンショット表示
- モーダルclose時に動画クリーンアップ

**Props**:

```typescript
interface VideoModalProps {
  game: Game;              // ゲームオブジェクト（movies配列含む）
  theme: Theme;
  isClosing: boolean;
  onClose: () => void;
}
```

**クリーンアップ処理**:

```javascript
useEffect(() => {
  return () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.load();
    }
  };
}, []);
```

#### `FeedbackModal.jsx` - フィードバック送信モーダル

**役割**: ユーザーフィードバック送信

**主要機能**:
- カテゴリ選択（バグ報告、機能要望、その他）
- タイトル入力
- 詳細入力
- メールアドレス入力（任意）
- Pages Functions経由でKVに保存、MailChannels経由でメール送信

**送信フロー**:

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category,
      title,
      description,
      email,
      timestamp: Date.now()
    })
  });
  const data = await res.json();
  if (data.success) {
    // 成功メッセージ表示
  }
};
```

#### `LanguageRegionModal.jsx` - 言語・リージョン切り替えモーダル

**役割**: UIの言語と価格表示リージョンの切り替え

**主要機能**:
- 言語選択（日本語/English）
- リージョン選択（JPY/USD）
- 設定の保存（IndexedDB）

**Props**:

```typescript
interface LanguageRegionModalProps {
  theme: Theme;
  currentLocale: string;
  currentRegion: string;
  onLocaleChange: (locale: string) => void;
  onRegionChange: (region: string) => void;
  isClosing: boolean;
  onClose: () => void;
}
```

---

## 状態管理

### React Hooks使用

Game Seeker Vaultは**Redux不使用**。全てReact Hooksで管理。

#### 主要なカスタムフック

なし（全て組み込みhooks使用）

#### useState使用例

```javascript
// ゲームデータ
const [rawGames, setRawGames] = React.useState([]);

// フィルタリング結果（useMemo）
const games = React.useMemo(() => {
  return rawGames
    .filter(game => {
      // ジャンルフィルタ
      if (selectedGenres.include.length > 0) {
        const hasInclude = selectedGenres.include.every(g =>
          game.genres.includes(g)
        );
        if (!hasInclude) return false;
      }

      // 価格フィルタ（現在選択中のリージョン）
      const price = game.deal[currentRegion].price;
      if (price < minPrice || price > maxPrice) return false;

      return true;
    })
    .sort((a, b) => {
      const priceA = a.deal[currentRegion].price;
      const priceB = b.deal[currentRegion].price;
      return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
    });
}, [rawGames, selectedGenres, minPrice, maxPrice, sortOrder, currentRegion]);
```

#### useEffect使用例

```javascript
// データ取得
React.useEffect(() => {
  fetch('/api/games-data')
    .then(res => res.json())
    .then(data => setRawGames(data.data.games));
}, []);

// スクロール位置監視
React.useEffect(() => {
  const handleScroll = () => {
    setShowScrollTop(window.scrollY > 300);
  };
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

---

## i18n実装

### ファイル: `i18n/translations.js`

**構造**:

```javascript
const translations = {
  en: {
    'header.title': 'Game Seeker Vault',
    'price.free': 'Free',
    'genre.action': 'Action',
    // ... 約300キー
  },
  ja: {
    'header.title': 'Game Seeker Vault',
    'price.free': '無料',
    'genre.action': 'アクション',
    // ... 約300キー
  }
};
```

---

### ファイル: `i18n/index.js`

**ヘルパー関数**:

#### `t(key, locale)` - 翻訳取得

```javascript
import { t } from './i18n/index.js';

// 使用例
<button>{t('button.close', locale)}</button>
// → locale='en': "Close"
// → locale='ja': "閉じる"
```

#### `formatPrice(price, currency)` - 価格フォーマット

**シグネチャ**: `formatPrice(price: number, currency: 'JPY' | 'USD'): string`

```javascript
// マルチリージョン対応版
formatPrice(2550, 'JPY')  // → "¥2,550"
formatPrice(17.99, 'USD') // → "$17.99"

// 無料ゲーム
formatPrice(0, 'JPY')     // → "無料" (locale='ja'の場合)
formatPrice(0, 'USD')     // → "Free" (locale='en'の場合)
```

**実装**:

```javascript
import { t } from './i18n/index.js';

export const formatPrice = (price, currency, locale) => {
  if (price === 0) return t('price.free', locale);

  if (currency === 'JPY') {
    return `¥${Math.floor(price).toLocaleString('ja-JP')}`;
  } else {
    return `$${price.toFixed(2)}`;
  }
};
```

#### `translateGenre(genre, locale)` - ジャンル翻訳

```javascript
translateGenre('Action', 'ja')  // → "アクション"
translateGenre('Action', 'en')  // → "Action"
```

#### `translateReview(review, locale)` - レビュー翻訳

```javascript
translateReview('Very Positive', 'ja')  // → "非常に好評"
translateReview('Very Positive', 'en')  // → "Very Positive"
```

---

### 言語検出フロー

```mermaid
graph TD
    A[アプリ起動] --> B[detectLocale実行]
    B --> C{設定保存済み?}
    C -->|Yes| D[保存された言語を使用]
    C -->|No| E{ブラウザ言語?}
    E -->|ja| F[日本語]
    E -->|en| G[英語]
    E -->|その他| H[/api/detect-locale<br/>Cloudflare Geo]
    H --> I{国コード?}
    I -->|JP| F
    I -->|その他| G
```

**実装**:

```javascript
const detectLocale = async () => {
  // 1. 設定ストアから取得
  const settings = await loadSettings();
  if (settings.locale && translations[settings.locale]) {
    return settings.locale;
  }

  // 2. ブラウザ言語
  const browserLang = navigator.language.split('-')[0];
  if (translations[browserLang]) {
    return browserLang;
  }

  // 3. Cloudflare Geo API
  try {
    const res = await fetch('/api/detect-locale');
    const data = await res.json();
    return data.suggestedLang || 'en';
  } catch {
    return 'en';
  }
};
```

---

## IndexedDB操作

### dbHelper API

**ファイル**: `db/index.js`

#### フォルダ操作

```javascript
// フォルダ一覧取得
const folders = await dbHelper.getFolders();

// フォルダ追加
const folderId = await dbHelper.addFolder('セール待ち', sortOrder);

// フォルダ名変更
await dbHelper.updateFolderName(folderId, '新しい名前');

// フォルダ削除
await dbHelper.deleteFolder(folderId);

// ソート順更新
await dbHelper.updateFolderOrder(folderId, newSortOrder);
```

#### コレクション操作

```javascript
// コレクション一覧取得
const items = await dbHelper.getCollectionItems();

// ゲーム追加
await dbHelper.addToCollection(folderId, gameId);

// ゲーム削除
await dbHelper.removeFromCollection(itemId);

// フォルダ間移動
await dbHelper.moveToFolder(itemId, newFolderId);

// ソート順更新
await dbHelper.updateCollectionOrder(itemId, newSortOrder);
```

#### 設定操作

```javascript
// 設定読み込み
const settings = await dbHelper.loadSettings();

// 設定保存
await dbHelper.saveSettings({ ...settings, theme: 'steam' });
```

---

## スタイリング

### Tailwind CSS

**設定ファイル**: `tailwind.config.js`

**カスタムカラー**:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'steam-blue': '#1b2838',
        'steam-blue-lighter': '#66c0f4',
      }
    }
  }
}
```

---

### テーマシステム

**ファイル**: `constants/index.js`

**テーマ定義**:

```javascript
export const THEMES = {
  default: {
    name: 'デフォルト',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    cardBg: 'bg-white',
    // ... 約15プロパティ
  },
  steam: {
    name: 'Steam',
    bg: 'bg-slate-800',
    text: 'text-slate-200',
    cardBg: 'bg-slate-700',
    // ... 約15プロパティ
  }
};
```

**使用例**:

```javascript
const theme = THEMES[currentTheme];

<div className={`${theme.bg} ${theme.text}`}>
  <div className={`${theme.cardBg} ${theme.cardShadow}`}>
    ゲームカード
  </div>
</div>
```

---

### レスポンシブデザイン

**ブレークポイント**:

| サイズ | Tailwind | 用途 |
|--------|----------|------|
| < 640px | デフォルト | モバイル |
| >= 640px | `sm:` | タブレット縦 |
| >= 768px | `md:` | タブレット横 |
| >= 1024px | `lg:` | デスクトップ |

**例**:

```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* モバイル: 1列、タブレット: 2列、デスクトップ: 3列 */}
</div>
```

---

## 開発フロー

### 開発サーバー起動

```bash
cd app
npm install
npm run dev
```

**アクセス**: `http://localhost:5173`

---

### ビルド

```bash
npm run build
```

**出力**: `app/dist/`

---

### プレビュー

```bash
npm run preview
```

---

### 新しいコンポーネント追加

1. `app/src/components/` に`.jsx`ファイル作成

```javascript
export function MyComponent({ prop1, prop2 }) {
  return (
    <div>
      {/* コンポーネント内容 */}
    </div>
  );
}
```

2. `main.jsx` でインポート

```javascript
import { MyComponent } from './components/MyComponent.jsx';
```

3. 使用

```jsx
<MyComponent prop1={value1} prop2={value2} />
```

---

### 新しい翻訳キー追加

1. `i18n/translations.js` に追加

```javascript
const translations = {
  en: {
    // ... 既存
    'new.key': 'New Text',
  },
  ja: {
    // ... 既存
    'new.key': '新しいテキスト',
  }
};
```

2. 使用

```jsx
{t('new.key', locale)}
```

---

## パフォーマンス最適化

### 仮想スクロール

**ライブラリ**: `@tanstack/react-virtual`

**使用箇所**: ゲーム一覧表示（10,000件以上のゲームを高速表示）

```javascript
import { useWindowVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useWindowVirtualizer({
  count: games.length,
  estimateSize: () => 300,  // カード高さ
  overscan: 5,
});

const items = virtualizer.getVirtualItems();

return (
  <div style={{ height: virtualizer.getTotalSize() }}>
    {items.map(virtualRow => (
      <div
        key={virtualRow.index}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualRow.start}px)`,
        }}
      >
        <GameCard game={games[virtualRow.index]} />
      </div>
    ))}
  </div>
);
```

---

### useMemo活用

```javascript
// ゲームフィルタリング（重い処理）
const filteredGames = React.useMemo(() => {
  return rawGames.filter(/* フィルタ条件 */);
}, [rawGames, selectedGenres, minPrice, maxPrice]);

// タグ一覧集計
const allTags = React.useMemo(() => {
  const tagSet = new Set();
  games.forEach(g => g.tags.forEach(t => tagSet.add(t)));
  return Array.from(tagSet).sort();
}, [games]);
```

---

## デバッグ

### React DevTools

ブラウザ拡張機能をインストール:
- [Chrome](https://chrome.google.com/webstore/detail/react-developer-tools/)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

### IndexedDB確認

**Chrome DevTools**:
1. F12 → Application タブ
2. Storage → IndexedDB → GameSeekerVaultDB
3. folders / collection / settings を確認

### Console Logging

```javascript
// ゲームデータ確認
console.log('Filtered games:', filteredGames.length);

// State確認
console.log('Current locale:', locale);
console.log('Selected genres:', selectedGenres);
```

---

## 関連ドキュメント

- [ARCHITECTURE.md](./ARCHITECTURE.md) - システム全体構成
- [DATA_STRUCTURE.md](./DATA_STRUCTURE.md) - データ構造仕様
- [BATCH_PROCESSING.md](./BATCH_PROCESSING.md) - バッチ処理ガイド
