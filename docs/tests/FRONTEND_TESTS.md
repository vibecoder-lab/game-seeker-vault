# フロントエンド自動テストケース

## 📋 概要

このドキュメントは、Game Seeker Vaultのフロントエンド（React UI）の自動テストケースを定義します。

**対象**: `app/src/` 配下のすべてのコンポーネント、ユーティリティ、Hooks

**テストフレームワーク**: Vitest + React Testing Library

**優先テスト対象**:
1. コレクション機能（フォルダ管理、ゲーム追加/削除）
2. フィルタ・検索機能

---

## 🎯 テストカテゴリ

### 1. コレクション機能テスト
### 2. フィルタ・検索機能テスト
### 3. IndexedDB操作テスト
### 4. i18n（多言語対応）テスト
### 5. ユーティリティ関数テスト
### 6. 動画再生機能テスト
### 7. フィードバック機能テスト
### 8. マルチリージョン価格テスト

---

## 📦 1. コレクション機能テスト

### FE-COL-001: フォルダ一覧の表示

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- IndexedDBに3つのフォルダが存在する
  - 気になるリスト (id: 1)
  - 購入予定リスト (id: 2)
  - セール待ちリスト (id: 3)

**テスト手順**
1. CollectionModalを開く
2. フォルダ一覧を表示

**期待結果（正常系）**
- 3つのフォルダが表示される
- フォルダ名が正しく表示される
- sortOrder順に並んでいる

**異常系**
- IndexedDBが空の場合、デフォルトフォルダが作成される
- IndexedDB接続エラー時、エラーメッセージが表示される

**実装例**
```javascript
// app/src/components/modals/__tests__/CollectionModal.test.jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CollectionModal } from '../CollectionModal';
import * as dbHelper from '../../../db/index';

describe('FE-COL-001: フォルダ一覧の表示', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常系: フォルダ一覧が正しく表示される', async () => {
    // Arrange
    const mockFolders = [
      { id: 1, name: '気になるリスト', sortOrder: 0 },
      { id: 2, name: '購入予定リスト', sortOrder: 1 },
      { id: 3, name: 'セール待ちリスト', sortOrder: 2 },
    ];
    vi.spyOn(dbHelper.dbHelper, 'getFolders').mockResolvedValue(mockFolders);
    vi.spyOn(dbHelper.dbHelper, 'getCollectionItems').mockResolvedValue([]);

    // Act
    render(
      <CollectionModal
        isOpen={true}
        onClose={() => {}}
        theme={{}}
        locale="ja"
      />
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText('気になるリスト')).toBeInTheDocument();
      expect(screen.getByText('購入予定リスト')).toBeInTheDocument();
      expect(screen.getByText('セール待ちリスト')).toBeInTheDocument();
    });
  });

  it('異常系: IndexedDBが空の場合、デフォルトフォルダが作成される', async () => {
    // Arrange
    vi.spyOn(dbHelper.dbHelper, 'getFolders').mockResolvedValue([]);
    const mockAddFolder = vi.spyOn(dbHelper.dbHelper, 'addFolder').mockResolvedValue(1);
    vi.spyOn(dbHelper.dbHelper, 'getCollectionItems').mockResolvedValue([]);

    // Act
    render(
      <CollectionModal
        isOpen={true}
        onClose={() => {}}
        theme={{}}
        locale="ja"
      />
    );

    // Assert
    await waitFor(() => {
      expect(mockAddFolder).toHaveBeenCalled();
    });
  });
});
```

---

### FE-COL-002: フォルダの追加

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- CollectionModalが開いている

**テスト手順**
1. 「新規フォルダ」ボタンをクリック
2. フォルダ名入力フィールドに「テストフォルダ」を入力
3. 「追加」ボタンをクリック

**期待結果（正常系）**
- 新しいフォルダがリストに追加される
- フォルダ名が「テストフォルダ」として表示される
- dbHelper.addFolder() が呼ばれる

**異常系**
- フォルダ名が空の場合、エラーメッセージが表示される
- フォルダ名が100文字を超える場合、エラーメッセージが表示される
- 同名フォルダが存在する場合、エラーメッセージが表示される

**実装例**
```javascript
// app/src/components/modals/__tests__/CollectionModal.test.jsx
import { userEvent } from '@testing-library/user-event';

describe('FE-COL-002: フォルダの追加', () => {
  it('正常系: 新しいフォルダが追加される', async () => {
    // Arrange
    const user = userEvent.setup();
    vi.spyOn(dbHelper.dbHelper, 'getFolders').mockResolvedValue([]);
    const mockAddFolder = vi.spyOn(dbHelper.dbHelper, 'addFolder').mockResolvedValue(1);
    vi.spyOn(dbHelper.dbHelper, 'getCollectionItems').mockResolvedValue([]);

    render(
      <CollectionModal
        isOpen={true}
        onClose={() => {}}
        theme={{}}
        locale="ja"
      />
    );

    // Act
    const addButton = screen.getByText('新規フォルダ');
    await user.click(addButton);

    const input = screen.getByPlaceholderText(/フォルダ名を入力/i);
    await user.type(input, 'テストフォルダ');

    const confirmButton = screen.getByText('追加');
    await user.click(confirmButton);

    // Assert
    await waitFor(() => {
      expect(mockAddFolder).toHaveBeenCalledWith('テストフォルダ', expect.any(Number));
      expect(screen.getByText('テストフォルダ')).toBeInTheDocument();
    });
  });

  it('異常系: フォルダ名が空の場合エラー', async () => {
    // Arrange
    const user = userEvent.setup();
    vi.spyOn(dbHelper.dbHelper, 'getFolders').mockResolvedValue([]);
    vi.spyOn(dbHelper.dbHelper, 'getCollectionItems').mockResolvedValue([]);

    render(
      <CollectionModal
        isOpen={true}
        onClose={() => {}}
        theme={{}}
        locale="ja"
      />
    );

    // Act
    const addButton = screen.getByText('新規フォルダ');
    await user.click(addButton);

    const confirmButton = screen.getByText('追加');
    await user.click(confirmButton);

    // Assert
    expect(screen.getByText(/フォルダ名を入力してください/i)).toBeInTheDocument();
  });
});
```

---

### FE-COL-003: ゲームをコレクションに追加

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- メインページにゲームカードが表示されている
- フォルダ「気になるリスト」が選択されている

**テスト手順**
1. ゲームカードの⭐アイコンをクリック

**期待結果（正常系）**
- ⭐が塗りつぶされる
- dbHelper.addToCollection() が呼ばれる
- ゲームIDとフォルダIDが正しく渡される

**異常系**
- 既に追加済みのゲームの場合、何も起こらない
- フォルダが選択されていない場合、エラーメッセージが表示される

**実装例**
```javascript
// app/src/components/__tests__/GameCard.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { GameCard } from '../GameCard';
import * as dbHelper from '../../db/index';

describe('FE-COL-003: ゲームをコレクションに追加', () => {
  it('正常系: ゲームがコレクションに追加される', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockGame = {
      id: '123456',
      title: 'Test Game',
      deal: { JPY: { price: 1000 } },
      genres: ['Action'],
      reviewScore: 'Very Positive',
    };
    const mockAddToCollection = vi.spyOn(dbHelper.dbHelper, 'addToCollection').mockResolvedValue(1);
    const onToggleFavorite = vi.fn();

    render(
      <GameCard
        game={mockGame}
        theme={{}}
        locale="ja"
        isFavorited={false}
        onToggleFavorite={onToggleFavorite}
        selectedFolderId={1}
      />
    );

    // Act
    const starIcon = screen.getByRole('button', { name: /お気に入りに追加/i });
    await user.click(starIcon);

    // Assert
    expect(onToggleFavorite).toHaveBeenCalledWith('123456');
  });

  it('異常系: 既に追加済みのゲーム', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockGame = {
      id: '123456',
      title: 'Test Game',
      deal: { JPY: { price: 1000 } },
      genres: ['Action'],
      reviewScore: 'Very Positive',
    };
    const onToggleFavorite = vi.fn();

    render(
      <GameCard
        game={mockGame}
        theme={{}}
        locale="ja"
        isFavorited={true}
        onToggleFavorite={onToggleFavorite}
        selectedFolderId={1}
      />
    );

    // Act
    const starIcon = screen.getByRole('button', { name: /お気に入りから削除/i });
    await user.click(starIcon);

    // Assert
    expect(onToggleFavorite).toHaveBeenCalledWith('123456');
  });
});
```

---

### FE-COL-004: フォルダの削除

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- CollectionModalが開いている
- フォルダ「テストフォルダ」が存在する

**テスト手順**
1. フォルダ「テストフォルダ」の削除ボタンをクリック
2. 確認ダイアログで「削除」をクリック

**期待結果（正常系）**
- フォルダがリストから削除される
- dbHelper.deleteFolder() が呼ばれる
- フォルダ内のゲームも削除される

**異常系**
- デフォルトフォルダ（気になるリスト、所有リスト）は削除できない

**実装例**
```javascript
describe('FE-COL-004: フォルダの削除', () => {
  it('正常系: フォルダが削除される', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockFolders = [
      { id: 1, name: 'テストフォルダ', sortOrder: 0, isDefault: false },
    ];
    vi.spyOn(dbHelper.dbHelper, 'getFolders').mockResolvedValue(mockFolders);
    const mockDeleteFolder = vi.spyOn(dbHelper.dbHelper, 'deleteFolder').mockResolvedValue();
    vi.spyOn(dbHelper.dbHelper, 'getCollectionItems').mockResolvedValue([]);
    window.confirm = vi.fn(() => true);

    render(
      <CollectionModal
        isOpen={true}
        onClose={() => {}}
        theme={{}}
        locale="ja"
      />
    );

    // Act
    await waitFor(() => screen.getByText('テストフォルダ'));
    const deleteButton = screen.getByRole('button', { name: /削除/i });
    await user.click(deleteButton);

    // Assert
    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteFolder).toHaveBeenCalledWith(1);
  });

  it('異常系: デフォルトフォルダは削除できない', async () => {
    // Arrange
    const mockFolders = [
      { id: 1, name: '気になるリスト', sortOrder: 0, isDefault: true },
    ];
    vi.spyOn(dbHelper.dbHelper, 'getFolders').mockResolvedValue(mockFolders);
    vi.spyOn(dbHelper.dbHelper, 'getCollectionItems').mockResolvedValue([]);

    render(
      <CollectionModal
        isOpen={true}
        onClose={() => {}}
        theme={{}}
        locale="ja"
      />
    );

    // Act & Assert
    await waitFor(() => screen.getByText('気になるリスト'));
    expect(screen.queryByRole('button', { name: /削除/i })).not.toBeInTheDocument();
  });
});
```

---

### FE-COL-005: フォルダのドラッグ&ドロップ並び替え

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- CollectionModalが開いている
- 3つのフォルダが存在する

**テスト手順**
1. フォルダ「購入予定リスト」をドラッグ
2. フォルダ「気になるリスト」の上にドロップ

**期待結果（正常系）**
- フォルダの順序が入れ替わる
- dbHelper.updateFolderOrder() が呼ばれる
- sortOrderが更新される

**異常系**
- ドラッグ中にエラーが発生した場合、元の順序に戻る

**実装例**
```javascript
// @dnd-kitのテストはモックが複雑なため、E2Eテストで検証することを推奨
describe('FE-COL-005: フォルダのドラッグ&ドロップ並び替え', () => {
  it('E2Eテストで検証 - E2E-COL-002を参照', () => {
    // E2Eテストで実装
  });
});
```

---

## 🔍 2. フィルタ・検索機能テスト

### FE-FIL-001: ジャンルフィルタ（単一選択）

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- ゲームデータが読み込まれている
- Actionジャンルのゲームが10件存在

**テスト手順**
1. ジャンルフィルタで「Action」を選択

**期待結果（正常系）**
- Actionジャンルのゲームのみが表示される
- 表示件数が10件になる

**異常系**
- 該当ゲームが0件の場合、「ゲームが見つかりません」と表示される

**実装例**
```javascript
// app/src/__tests__/filterLogic.test.js
import { describe, it, expect } from 'vitest';

describe('FE-FIL-001: ジャンルフィルタ（単一選択）', () => {
  it('正常系: Actionジャンルでフィルタされる', () => {
    // Arrange
    const games = [
      { id: '1', title: 'Action Game 1', genres: ['Action'] },
      { id: '2', title: 'RPG Game 1', genres: ['RPG'] },
      { id: '3', title: 'Action Game 2', genres: ['Action'] },
    ];
    const selectedGenres = { include: ['Action'], exclude: [] };

    // Act
    const filtered = games.filter(game => 
      selectedGenres.include.every(g => game.genres.includes(g))
    );

    // Assert
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe('1');
    expect(filtered[1].id).toBe('3');
  });

  it('異常系: 該当ゲームが0件', () => {
    // Arrange
    const games = [
      { id: '1', title: 'Action Game 1', genres: ['Action'] },
    ];
    const selectedGenres = { include: ['Strategy'], exclude: [] };

    // Act
    const filtered = games.filter(game => 
      selectedGenres.include.every(g => game.genres.includes(g))
    );

    // Assert
    expect(filtered).toHaveLength(0);
  });
});
```

---

### FE-FIL-002: ジャンルフィルタ（複数選択・AND条件）

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- ゲームデータが読み込まれている

**テスト手順**
1. ジャンルフィルタで「Action」を選択
2. ジャンルフィルタで「Indie」を選択

**期待結果（正常系）**
- ActionとIndieの両方を持つゲームのみが表示される
- AND条件で絞り込まれる

**異常系**
- 該当ゲームが0件の場合、「ゲームが見つかりません」と表示される

**実装例**
```javascript
describe('FE-FIL-002: ジャンルフィルタ（複数選択・AND条件）', () => {
  it('正常系: ActionとIndieの両方を持つゲームのみ表示', () => {
    // Arrange
    const games = [
      { id: '1', title: 'Action Indie Game', genres: ['Action', 'Indie'] },
      { id: '2', title: 'Action Only Game', genres: ['Action'] },
      { id: '3', title: 'Indie Only Game', genres: ['Indie'] },
    ];
    const selectedGenres = { include: ['Action', 'Indie'], exclude: [] };

    // Act
    const filtered = games.filter(game => 
      selectedGenres.include.every(g => game.genres.includes(g))
    );

    // Assert
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });
});
```

---

### FE-FIL-003: ジャンル除外フィルタ（Shift+クリック）

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- ゲームデータが読み込まれている

**テスト手順**
1. Shiftキーを押しながらジャンル「Action」をクリック

**期待結果（正常系）**
- Actionジャンルを含むゲームが除外される
- チェックボックスに✖︎アイコンが表示される
- テキストが赤色になる

**異常系**
- 除外条件のみでゲームが0件になった場合、「ゲームが見つかりません」と表示される

**実装例**
```javascript
describe('FE-FIL-003: ジャンル除外フィルタ', () => {
  it('正常系: Actionジャンルが除外される', () => {
    // Arrange
    const games = [
      { id: '1', title: 'Action Game 1', genres: ['Action'] },
      { id: '2', title: 'RPG Game 1', genres: ['RPG'] },
    ];
    const selectedGenres = { include: [], exclude: ['Action'] };

    // Act
    const filtered = games.filter(game => 
      !selectedGenres.exclude.some(g => game.genres.includes(g))
    );

    // Assert
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('2');
  });
});
```

---

### FE-FIL-004: タイトル検索

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- ゲームデータが読み込まれている

**テスト手順**
1. 検索窓に「Portal」と入力

**期待結果（正常系）**
- タイトルに「Portal」を含むゲームのみが表示される
- 大文字小文字を区別しない

**異常系**
- 該当ゲームが0件の場合、「ゲームが見つかりません」と表示される
- 特殊文字が含まれる場合もエスケープして検索

**実装例**
```javascript
describe('FE-FIL-004: タイトル検索', () => {
  it('正常系: Portalを含むゲームが表示される', () => {
    // Arrange
    const games = [
      { id: '1', title: 'Portal 2', genres: ['Action'] },
      { id: '2', title: 'Half-Life 2', genres: ['Action'] },
      { id: '3', title: 'Portal Knights', genres: ['RPG'] },
    ];
    const searchTitle = 'Portal';

    // Act
    const filtered = games.filter(game =>
      game.title.toLowerCase().includes(searchTitle.toLowerCase())
    );

    // Assert
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe('1');
    expect(filtered[1].id).toBe('3');
  });

  it('正常系: 大文字小文字を区別しない', () => {
    // Arrange
    const games = [
      { id: '1', title: 'Portal 2', genres: ['Action'] },
    ];
    const searchTitle = 'portal';

    // Act
    const filtered = games.filter(game =>
      game.title.toLowerCase().includes(searchTitle.toLowerCase())
    );

    // Assert
    expect(filtered).toHaveLength(1);
  });
});
```

---

### FE-FIL-005: 価格範囲フィルタ

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- ゲームデータが読み込まれている

**テスト手順**
1. 最低価格を500円に設定
2. 最高価格を2000円に設定

**期待結果（正常系）**
- 500円～2000円のゲームのみが表示される

**異常系**
- 最低価格 > 最高価格の場合、エラーメッセージが表示される

**実装例**
```javascript
describe('FE-FIL-005: 価格範囲フィルタ', () => {
  it('正常系: 500円～2000円のゲームのみ表示', () => {
    // Arrange
    const games = [
      { id: '1', title: 'Game 1', deal: { JPY: { price: 1000 } } },
      { id: '2', title: 'Game 2', deal: { JPY: { price: 3000 } } },
      { id: '3', title: 'Game 3', deal: { JPY: { price: 500 } } },
    ];
    const minPrice = 500;
    const maxPrice = 2000;

    // Act
    const filtered = games.filter(game => {
      const price = game.deal.JPY.price;
      return price >= minPrice && price <= maxPrice;
    });

    // Assert
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe('1');
    expect(filtered[1].id).toBe('3');
  });
});
```

---

## 💾 3. IndexedDB操作テスト

### FE-DB-001: DB初期化

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- IndexedDBが未初期化

**テスト手順**
1. initDB() を呼び出す

**期待結果（正常系）**
- DBが作成される
- 3つのストア（folders, collection, settings）が作成される
- バージョン番号が正しい

**異常系**
- ブラウザがIndexedDBをサポートしていない場合、エラーがスローされる

**実装例**
```javascript
// app/src/db/__tests__/init.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDB } from '../init';
import { DB_NAME, DB_VERSION } from '../../constants/index';

describe('FE-DB-001: DB初期化', () => {
  beforeEach(async () => {
    // DBを削除
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    await new Promise((resolve) => {
      deleteRequest.onsuccess = resolve;
      deleteRequest.onerror = resolve;
    });
  });

  afterEach(async () => {
    // テスト後にDBをクリーンアップ
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    await new Promise((resolve) => {
      deleteRequest.onsuccess = resolve;
      deleteRequest.onerror = resolve;
    });
  });

  it('正常系: DBが正しく初期化される', async () => {
    // Act
    const db = await initDB();

    // Assert
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
    expect(db.objectStoreNames.contains('folders')).toBe(true);
    expect(db.objectStoreNames.contains('collection')).toBe(true);
    expect(db.objectStoreNames.contains('settings')).toBe(true);

    db.close();
  });
});
```

---

### FE-DB-002: フォルダの追加

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- DBが初期化されている

**テスト手順**
1. dbHelper.addFolder('テストフォルダ', 0) を呼び出す

**期待結果（正常系）**
- フォルダIDが返される
- DBにフォルダが保存される

**異常系**
- DBエラーが発生した場合、エラーがスローされる

**実装例**
```javascript
// app/src/db/__tests__/folders.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dbHelper, initDB } from '../index';
import { DB_NAME } from '../../constants/index';

describe('FE-DB-002: フォルダの追加', () => {
  let db;

  beforeEach(async () => {
    db = await initDB();
  });

  afterEach(async () => {
    if (db) db.close();
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    await new Promise((resolve) => {
      deleteRequest.onsuccess = resolve;
      deleteRequest.onerror = resolve;
    });
  });

  it('正常系: フォルダが追加される', async () => {
    // Act
    const folderId = await dbHelper.addFolder('テストフォルダ', 0);

    // Assert
    expect(folderId).toBeGreaterThan(0);

    // 確認: DBから取得
    const folders = await dbHelper.getFolders();
    const addedFolder = folders.find(f => f.id === folderId);
    expect(addedFolder).toBeDefined();
    expect(addedFolder.name).toBe('テストフォルダ');
    expect(addedFolder.sortOrder).toBe(0);
  });
});
```

---

## 🌐 4. i18n（多言語対応）テスト

### FE-I18N-001: 翻訳キーの取得

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- translations.jsに日本語・英語の翻訳が定義されている

**テスト手順**
1. t('header.title', 'ja') を呼び出す
2. t('header.title', 'en') を呼び出す

**期待結果（正常系）**
- 日本語: 'Game Seeker Vault'
- 英語: 'Game Seeker Vault'

**異常系**
- 存在しないキーの場合、キー名がそのまま返される

**実装例**
```javascript
// app/src/i18n/__tests__/index.test.js
import { describe, it, expect } from 'vitest';
import { t } from '../index';

describe('FE-I18N-001: 翻訳キーの取得', () => {
  it('正常系: 日本語翻訳が取得できる', () => {
    // Act
    const result = t('price.free', 'ja');

    // Assert
    expect(result).toBe('無料');
  });

  it('正常系: 英語翻訳が取得できる', () => {
    // Act
    const result = t('price.free', 'en');

    // Assert
    expect(result).toBe('Free');
  });

  it('異常系: 存在しないキーの場合キー名が返される', () => {
    // Act
    const result = t('nonexistent.key', 'ja');

    // Assert
    expect(result).toBe('nonexistent.key');
  });
});
```

---

## 🔧 5. ユーティリティ関数テスト

### FE-UTIL-001: formatPrice() - 価格フォーマット

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- なし

**テスト手順**
1. formatPrice(2550, 'ja') を呼び出す
2. formatPrice(2550, 'en') を呼び出す

**期待結果（正常系）**
- 日本語: '¥2,550'
- 英語: '$17.00' （概算）

**異常系**
- 価格が null の場合、'-' が返される
- 価格が 0 の場合、'無料' が返される

**実装例**
```javascript
// app/src/i18n/__tests__/index.test.js
import { describe, it, expect } from 'vitest';
import { formatPrice } from '../index';

describe('FE-UTIL-001: formatPrice()', () => {
  it('正常系: 日本語の価格フォーマット', () => {
    // Act
    const result = formatPrice(2550, 'ja');

    // Assert
    expect(result).toBe('¥2,550');
  });

  it('正常系: 英語の価格フォーマット', () => {
    // Act
    const result = formatPrice(2550, 'en');

    // Assert
    expect(result).toContain('$');
  });

  it('異常系: 価格がnullの場合', () => {
    // Act
    const result = formatPrice(null, 'ja');

    // Assert
    expect(result).toBe('-');
  });

  it('異常系: 価格が0の場合', () => {
    // Act
    const result = formatPrice(0, 'ja');

    // Assert
    expect(result).toBe('無料');
  });
});
```

---

### FE-UTIL-002: translateGenre() - ジャンル翻訳

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- なし

**テスト手順**
1. translateGenre('Action', 'ja') を呼び出す
2. translateGenre('Action', 'en') を呼び出す

**期待結果（正常系）**
- 日本語: 'アクション'
- 英語: 'Action'

**異常系**
- 存在しないジャンルの場合、元の文字列が返される

**実装例**
```javascript
// app/src/i18n/__tests__/index.test.js
import { describe, it, expect } from 'vitest';
import { translateGenre } from '../index';

describe('FE-UTIL-002: translateGenre()', () => {
  it('正常系: 日本語のジャンル翻訳', () => {
    // Act
    const result = translateGenre('Action', 'ja');

    // Assert
    expect(result).toBe('アクション');
  });

  it('正常系: 英語のジャンル翻訳', () => {
    // Act
    const result = translateGenre('Action', 'en');

    // Assert
    expect(result).toBe('Action');
  });

  it('異常系: 存在しないジャンル', () => {
    // Act
    const result = translateGenre('Unknown Genre', 'ja');

    // Assert
    expect(result).toBe('Unknown Genre');
  });
});
```

---

## 🎥 6. 動画再生機能テスト

### FE-VIDEO-001: VideoModal表示

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- ゲームに動画データ（movies配列）が存在する

**テスト手順**
1. GameCardの動画アイコンをクリック

**期待結果（正常系）**
- VideoModalが表示される
- 最初の動画が自動再生される
- 動画タイトルが表示される

**異常系**
- 動画データが空の場合、スクリーンショットが表示される
- 動画もスクリーンショットもない場合、"No media available"と表示される

**実装例**
```javascript
// app/src/components/modals/__tests__/VideoModal.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoModal } from '../VideoModal';

describe('FE-VIDEO-001: VideoModal表示', () => {
  it('正常系: 動画が表示される', () => {
    // Arrange
    const mockGame = {
      id: '123456',
      title: 'Test Game',
      movies: [
        {
          id: 256712345,
          name: 'Trailer',
          thumbnail: 'https://example.com/thumb.jpg',
          webm: 'https://example.com/video.webm',
          mp4: 'https://example.com/video.mp4'
        }
      ]
    };

    // Act
    render(
      <VideoModal
        game={mockGame}
        theme={{}}
        isClosing={false}
        onClose={() => {}}
      />
    );

    // Assert
    expect(screen.getByText('Test Game')).toBeInTheDocument();
    const video = screen.getByRole('video');
    expect(video).toBeInTheDocument();
  });

  it('異常系: 動画がない場合スクリーンショット表示', () => {
    // Arrange
    const mockGame = {
      id: '123456',
      title: 'Test Game',
      movies: [],
      screenshot: {
        full: 'https://example.com/screenshot.jpg'
      }
    };

    // Act
    render(
      <VideoModal
        game={mockGame}
        theme={{}}
        isClosing={false}
        onClose={() => {}}
      />
    );

    // Assert
    const img = screen.getByAltText(/screenshot/i);
    expect(img).toBeInTheDocument();
  });
});
```

---

### FE-VIDEO-002: 動画切り替え

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- ゲームに複数の動画が存在する

**テスト手順**
1. VideoModalが開いている
2. 右側エリアにホバー
3. 2番目の動画サムネイルをクリック

**期待結果（正常系）**
- 動画リストが表示される
- 2番目の動画に切り替わる
- `selectedVideoIndex` stateが更新される

**実装例**
```javascript
describe('FE-VIDEO-002: 動画切り替え', () => {
  it('正常系: 動画が切り替わる', async () => {
    const user = userEvent.setup();
    const mockGame = {
      id: '123456',
      title: 'Test Game',
      movies: [
        { id: 1, name: 'Trailer 1', thumbnail: 'thumb1.jpg', webm: 'video1.webm', mp4: 'video1.mp4' },
        { id: 2, name: 'Trailer 2', thumbnail: 'thumb2.jpg', webm: 'video2.webm', mp4: 'video2.mp4' }
      ]
    };

    render(
      <VideoModal
        game={mockGame}
        theme={{}}
        isClosing={false}
        onClose={() => {}}
      />
    );

    // ホバーエリアにマウスを移動
    const hoverArea = screen.getByRole('region', { name: /hover area/i });
    await user.hover(hoverArea);

    // 2番目の動画をクリック
    const thumbnail2 = screen.getByAltText('Trailer 2');
    await user.click(thumbnail2);

    // Assert: video要素のkeyが変更されていることを確認
    // 実際の実装ではvideo要素が再マウントされる
  });
});
```

---

### FE-VIDEO-003: 動画クリーンアップ

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- VideoModalが開いており、動画が再生中

**テスト手順**
1. モーダルを閉じる

**期待結果（正常系）**
- 動画が停止する
- `videoRef.current.pause()` が呼ばれる
- `videoRef.current.currentTime = 0` が呼ばれる
- `videoRef.current.load()` が呼ばれる

**実装例**
```javascript
describe('FE-VIDEO-003: 動画クリーンアップ', () => {
  it('正常系: モーダルclose時に動画が停止する', () => {
    const mockGame = {
      id: '123456',
      title: 'Test Game',
      movies: [
        { id: 1, name: 'Trailer', thumbnail: 'thumb.jpg', webm: 'video.webm', mp4: 'video.mp4' }
      ]
    };

    const { unmount } = render(
      <VideoModal
        game={mockGame}
        theme={{}}
        isClosing={false}
        onClose={() => {}}
      />
    );

    // Act: コンポーネントをアンマウント
    const video = screen.getByRole('video');
    const pauseSpy = vi.spyOn(video, 'pause');
    const loadSpy = vi.spyOn(video, 'load');

    unmount();

    // Assert
    expect(pauseSpy).toHaveBeenCalled();
    expect(loadSpy).toHaveBeenCalled();
  });
});
```

---

## 💬 7. フィードバック機能テスト

### FE-FEEDBACK-001: フィードバックモーダル表示

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- なし

**テスト手順**
1. ヘッダーのフィードバックボタンをクリック

**期待結果（正常系）**
- FeedbackModalが表示される
- カテゴリ選択欄が表示される
- タイトル入力欄が表示される
- 詳細入力欄が表示される

**実装例**
```javascript
// app/src/components/modals/__tests__/FeedbackModal.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedbackModal } from '../FeedbackModal';

describe('FE-FEEDBACK-001: フィードバックモーダル表示', () => {
  it('正常系: モーダルが表示される', () => {
    render(
      <FeedbackModal
        isOpen={true}
        onClose={() => {}}
        theme={{}}
        locale="ja"
      />
    );

    expect(screen.getByText(/フィードバック/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/カテゴリ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/タイトル/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/詳細/i)).toBeInTheDocument();
  });
});
```

---

### FE-FEEDBACK-002: フィードバック送信

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- FeedbackModalが開いている

**テスト手順**
1. カテゴリを「バグ報告」に選択
2. タイトルに「テストバグ」を入力
3. 詳細に「テスト詳細」を入力
4. 送信ボタンをクリック

**期待結果（正常系）**
- `/api/feedback` にPOSTリクエストが送信される
- 成功メッセージが表示される
- モーダルが閉じる

**異常系**
- タイトルが空の場合、エラーメッセージが表示される
- 詳細が空の場合、エラーメッセージが表示される

**実装例**
```javascript
describe('FE-FEEDBACK-002: フィードバック送信', () => {
  it('正常系: フィードバックが送信される', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    );

    render(
      <FeedbackModal
        isOpen={true}
        onClose={() => {}}
        theme={{}}
        locale="ja"
      />
    );

    // カテゴリ選択
    const categorySelect = screen.getByLabelText(/カテゴリ/i);
    await user.selectOptions(categorySelect, 'bug');

    // タイトル入力
    const titleInput = screen.getByLabelText(/タイトル/i);
    await user.type(titleInput, 'テストバグ');

    // 詳細入力
    const descriptionInput = screen.getByLabelText(/詳細/i);
    await user.type(descriptionInput, 'テスト詳細');

    // 送信
    const submitButton = screen.getByRole('button', { name: /送信/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('テストバグ')
      }));
      expect(screen.getByText(/送信しました/i)).toBeInTheDocument();
    });
  });
});
```

---

## 💱 8. マルチリージョン価格テスト

### FE-REGION-001: リージョン切り替え

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- ゲームにJPYとUSDの価格データが存在する

**テスト手順**
1. LanguageRegionModalを開く
2. リージョンを「USD」に変更
3. 保存ボタンをクリック

**期待結果（正常系）**
- `currentRegion` stateが「USD」に更新される
- 価格表示が「$17.00」形式に変わる
- IndexedDBに保存される

**実装例**
```javascript
// app/src/components/modals/__tests__/LanguageRegionModal.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { LanguageRegionModal } from '../LanguageRegionModal';
import * as dbHelper from '../../../db/index';

describe('FE-REGION-001: リージョン切り替え', () => {
  it('正常系: リージョンがUSDに切り替わる', async () => {
    const user = userEvent.setup();
    const onRegionChange = vi.fn();
    vi.spyOn(dbHelper.dbHelper, 'saveSettings').mockResolvedValue();

    render(
      <LanguageRegionModal
        isOpen={true}
        onClose={() => {}}
        theme={{}}
        currentLocale="en"
        currentRegion="JPY"
        onLocaleChange={() => {}}
        onRegionChange={onRegionChange}
        isClosing={false}
      />
    );

    // USD選択
    const usdRadio = screen.getByLabelText(/USD/i);
    await user.click(usdRadio);

    // 保存
    const saveButton = screen.getByRole('button', { name: /保存/i });
    await user.click(saveButton);

    // Assert
    await waitFor(() => {
      expect(onRegionChange).toHaveBeenCalledWith('USD');
      expect(dbHelper.dbHelper.saveSettings).toHaveBeenCalled();
    });
  });
});
```

---

### FE-REGION-002: 価格フィルタリング（リージョン別）

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- ゲームにJPYとUSDの価格データが存在する

**テスト手順**
1. リージョンを「USD」に設定
2. 最低価格を$10、最高価格を$30に設定

**期待結果（正常系）**
- USD価格で$10～$30のゲームのみが表示される
- JPY価格ではなくUSD価格でフィルタされる

**実装例**
```javascript
describe('FE-REGION-002: 価格フィルタリング（リージョン別）', () => {
  it('正常系: USD価格でフィルタされる', () => {
    const games = [
      {
        id: '1',
        title: 'Game 1',
        deal: {
          JPY: { price: 1000 },
          USD: { price: 15 }
        }
      },
      {
        id: '2',
        title: 'Game 2',
        deal: {
          JPY: { price: 2000 },
          USD: { price: 50 }
        }
      }
    ];
    const currentRegion = 'USD';
    const minPrice = 10;
    const maxPrice = 30;

    // Act
    const filtered = games.filter(game => {
      const price = game.deal[currentRegion].price;
      return price >= minPrice && price <= maxPrice;
    });

    // Assert
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });
});
```

---

### FE-REGION-003: formatPrice() マルチリージョン対応

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- なし

**テスト手順**
1. formatPrice(2550, 'JPY', 'ja') を呼び出す
2. formatPrice(17.99, 'USD', 'en') を呼び出す

**期待結果（正常系)**
- JPY: '¥2,550'
- USD: '$17.99'

**実装例**
```javascript
describe('FE-REGION-003: formatPrice() マルチリージョン対応', () => {
  it('正常系: JPY価格フォーマット', () => {
    const result = formatPrice(2550, 'JPY', 'ja');
    expect(result).toBe('¥2,550');
  });

  it('正常系: USD価格フォーマット', () => {
    const result = formatPrice(17.99, 'USD', 'en');
    expect(result).toBe('$17.99');
  });

  it('正常系: 無料ゲーム（JPY）', () => {
    const result = formatPrice(0, 'JPY', 'ja');
    expect(result).toBe('無料');
  });

  it('正常系: 無料ゲーム（USD）', () => {
    const result = formatPrice(0, 'USD', 'en');
    expect(result).toBe('Free');
  });
});
```

---

## 📊 テスト実装状況サマリー

### コレクション機能テスト
- [ ] FE-COL-001: フォルダ一覧の表示
- [ ] FE-COL-002: フォルダの追加
- [ ] FE-COL-003: ゲームをコレクションに追加
- [ ] FE-COL-004: フォルダの削除
- [ ] FE-COL-005: フォルダのドラッグ&ドロップ並び替え

### フィルタ・検索機能テスト
- [ ] FE-FIL-001: ジャンルフィルタ（単一選択）
- [ ] FE-FIL-002: ジャンルフィルタ（複数選択・AND条件）
- [ ] FE-FIL-003: ジャンル除外フィルタ（Shift+クリック）
- [ ] FE-FIL-004: タイトル検索
- [ ] FE-FIL-005: 価格範囲フィルタ

### IndexedDB操作テスト
- [ ] FE-DB-001: DB初期化
- [ ] FE-DB-002: フォルダの追加

### i18n（多言語対応）テスト
- [ ] FE-I18N-001: 翻訳キーの取得

### ユーティリティ関数テスト
- [ ] FE-UTIL-001: formatPrice() - 価格フォーマット
- [ ] FE-UTIL-002: translateGenre() - ジャンル翻訳

### 動画再生機能テスト
- [ ] FE-VIDEO-001: VideoModal表示
- [ ] FE-VIDEO-002: 動画切り替え
- [ ] FE-VIDEO-003: 動画クリーンアップ

### フィードバック機能テスト
- [ ] FE-FEEDBACK-001: フィードバックモーダル表示
- [ ] FE-FEEDBACK-002: フィードバック送信

### マルチリージョン価格テスト
- [ ] FE-REGION-001: リージョン切り替え
- [ ] FE-REGION-002: 価格フィルタリング（リージョン別）
- [ ] FE-REGION-003: formatPrice() マルチリージョン対応

---

## 🚀 次のステップ

1. テストセットアップファイルの作成（`app/src/test/setup.js`）
2. モックデータの作成（`app/src/test/mocks/`）
3. 優先度Highのテストから実装開始
4. CI/CD統合

---

## 📚 参考資料

- [Vitest API Reference](https://vitest.dev/api/)
- [React Testing Library Cheatsheet](https://testing-library.com/docs/react-testing-library/cheatsheet)
- [Testing Library User Interactions](https://testing-library.com/docs/user-event/intro)
