# E2Eテストケース

## 📋 概要

このドキュメントは、Game Seeker Vaultのエンドツーエンド（E2E）テストケースを定義します。

**テストフレームワーク**: Playwright

**優先テスト対象**:
1. コレクション機能の一連のフロー
2. フィルタ・検索の統合テスト

---

## 🎯 テストシナリオ

### 1. コレクション機能の完全フロー
### 2. フィルタ・検索の統合テスト
### 3. インポート/エクスポートフロー
### 4. クロスブラウザテスト
### 5. モバイルテスト

---

## 📦 1. コレクション機能の完全フロー

### E2E-COL-001: ゲーム追加からフォルダ管理まで

**優先度**: High
**ステータス**: ⬜ 未実装

**シナリオ**
1. ページにアクセス
2. ゲームを検索
3. コレクションに追加
4. 新しいフォルダを作成
5. ゲームを移動
6. フォルダを削除

**期待結果**
- すべての操作が正常に完了する
- データがIndexedDBに永続化される

**実装例**

```javascript
// app/e2e/collection-full-flow.spec.js
import { test, expect } from '@playwright/test';

test('E2E-COL-001: コレクション機能の完全フロー', async ({ page }) => {
  // 1. ページアクセス
  await page.goto('/');
  await expect(page).toHaveTitle(/Game Seeker Vault/);
  
  // 2. ゲーム検索
  await page.getByPlaceholder('タイトルで検索').fill('Portal');
  await page.waitForTimeout(500); // デバウンス待機
  
  // 3. 最初のゲームカードの★アイコンをクリック
  const firstCard = page.locator('.game-card').first();
  await firstCard.locator('[aria-label*="お気に入りに追加"]').click();
  
  // 4. コレクションモーダルを開く
  await page.getByRole('button', { name: 'コレクション' }).click();
  await expect(page.getByText('気になるリスト')).toBeVisible();
  
  // 5. ゲームが追加されていることを確認
  await page.getByText('気になるリスト').click();
  await expect(page.locator('.collection-item')).toHaveCount(1);
  
  // 6. 新しいフォルダを作成
  await page.getByRole('button', { name: '新規フォルダ' }).click();
  await page.getByPlaceholder('フォルダ名を入力').fill('テストフォルダ');
  await page.getByRole('button', { name: '追加' }).click();
  await expect(page.getByText('テストフォルダ')).toBeVisible();
  
  // 7. ゲームを新しいフォルダに移動
  const gameItem = page.locator('.collection-item').first();
  await gameItem.hover();
  await gameItem.getByRole('button', { name: 'フォルダ移動' }).click();
  await page.getByRole('option', { name: 'テストフォルダ' }).click();
  
  // 8. テストフォルダを開いて確認
  await page.getByText('テストフォルダ').click();
  await expect(page.locator('.collection-item')).toHaveCount(1);
  
  // 9. フォルダを削除
  await page.getByText('テストフォルダ').hover();
  await page.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText('テストフォルダ')).not.toBeVisible();
  
  // 10. IndexedDB確認
  const db = await page.evaluate(async () => {
    const request = indexedDB.open('GameSeekerVaultDB');
    return new Promise((resolve) => {
      request.onsuccess = (event) => {
        const db = event.target.result;
        const tx = db.transaction(['collection'], 'readonly');
        const store = tx.objectStore('collection');
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      };
    });
  });
  
  expect(db.length).toBe(0); // ゲームはフォルダ削除時に削除される
});
```

---

### E2E-COL-002: ドラッグ&ドロップでのフォルダ並び替え

**優先度**: Medium
**ステータス**: ⬜ 未実装

**シナリオ**
1. コレクションモーダルを開く
2. フォルダを作成（2つ）
3. フォルダをドラッグ&ドロップで並び替え
4. 順序が保存されることを確認

**期待結果**
- フォルダの順序が入れ替わる
- sortOrderが更新される

**実装例**

```javascript
test('E2E-COL-002: フォルダのドラッグ&ドロップ並び替え', async ({ page }) => {
  await page.goto('/');
  
  // コレクションモーダルを開く
  await page.getByRole('button', { name: 'コレクション' }).click();
  
  // 2つのフォルダを作成
  await page.getByRole('button', { name: '新規フォルダ' }).click();
  await page.getByPlaceholder('フォルダ名を入力').fill('フォルダA');
  await page.getByRole('button', { name: '追加' }).click();
  
  await page.getByRole('button', { name: '新規フォルダ' }).click();
  await page.getByPlaceholder('フォルダ名を入力').fill('フォルダB');
  await page.getByRole('button', { name: '追加' }).click();
  
  // フォルダBをフォルダAの上にドラッグ
  const folderB = page.getByText('フォルダB');
  const folderA = page.getByText('フォルダA');
  
  await folderB.dragTo(folderA);
  
  // 順序確認
  const folders = page.locator('.folder-item');
  await expect(folders.nth(0)).toContainText('フォルダB');
  await expect(folders.nth(1)).toContainText('フォルダA');
  
  // ページリロード後も順序が保持されているか確認
  await page.reload();
  await page.getByRole('button', { name: 'コレクション' }).click();
  await expect(folders.nth(0)).toContainText('フォルダB');
  await expect(folders.nth(1)).toContainText('フォルダA');
});
```

---

## 🔍 2. フィルタ・検索の統合テスト

### E2E-FIL-001: 複合フィルタリング

**優先度**: High
**ステータス**: ⬜ 未実装

**シナリオ**
1. ジャンル「Action」を選択
2. 価格範囲を500円～2000円に設定
3. 「日本語対応のみ」をON
4. タイトル検索で「Portal」を入力

**期待結果**
- すべての条件を満たすゲームのみが表示される
- AND条件で絞り���まれる

**実装例**

```javascript
test('E2E-FIL-001: 複合フィルタリング', async ({ page }) => {
  await page.goto('/');
  
  // 1. ジャンルフィルタ
  await page.getByLabel('Action').check();
  await page.waitForTimeout(300);
  
  // 2. 価格範囲
  await page.getByLabel('最小').fill('500');
  await page.getByLabel('最大').fill('2000');
  await page.waitForTimeout(300);
  
  // 3. 日本語対応のみ
  await page.getByLabel('日本語対応').check();
  await page.waitForTimeout(300);
  
  // 4. タイトル検索
  await page.getByPlaceholder('タイトルで検索').fill('Portal');
  await page.waitForTimeout(500);
  
  // 結果確認
  const cards = page.locator('.game-card');
  const count = await cards.count();
  
  expect(count).toBeGreaterThan(0);
  
  // 各カードが条件を満たすか確認
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const title = await card.locator('.game-title').textContent();
    expect(title.toLowerCase()).toContain('portal');
    
    // ジャンルにActionが含まれるか確認
    const genres = await card.locator('.game-genres').textContent();
    expect(genres).toContain('Action');
  }
});
```

---

### E2E-FIL-002: フィルタのクリア

**優先度**: Medium
**ステータス**: ⬜ 未実装

**シナリオ**
1. 複数のフィルタを適用
2. 「クリア」ボタンをクリック
3. すべてのフィルタがリセットされる

**期待結果**
- フィルタがすべて解除される
- 全ゲームが再表示される

**実装例**

```javascript
test('E2E-FIL-002: フィルタのクリア', async ({ page }) => {
  await page.goto('/');
  
  // フィルタを適用
  await page.getByLabel('Action').check();
  await page.getByLabel('日本語対応').check();
  await page.getByPlaceholder('タイトルで検索').fill('Test');
  
  // 結果件数を確認
  const initialCount = await page.locator('.game-card').count();
  expect(initialCount).toBeLessThan(10000);
  
  // クリア
  await page.getByRole('button', { name: 'クリア' }).click();
  
  // すべてのフィルタが解除されたことを確認
  await expect(page.getByLabel('Action')).not.toBeChecked();
  await expect(page.getByLabel('日本語対応')).not.toBeChecked();
  await expect(page.getByPlaceholder('タイトルで検索')).toHaveValue('');
  
  // 全ゲームが表示される
  const clearedCount = await page.locator('.game-card').count();
  expect(clearedCount).toBeGreaterThan(initialCount);
});
```

---

## 📤 3. インポート/エクスポートフロー

### E2E-EXPORT-001: エクスポートからインポートまでの完全フロー

**優先度**: High
**ステータス**: ⬜ 未実装

**シナリオ**
1. コレクションにゲームを追加
2. エクスポート
3. すべてのデータを削除
4. インポート
5. データが復元されることを確認

**期待結果**
- エクスポートされたJSONファイルが正しい
- インポート後にデータが完全に復元される

**実装例**

```javascript
test('E2E-EXPORT-001: エクスポート→インポートフロー', async ({ page }) => {
  await page.goto('/');
  
  // 1. ゲーム追加
  const firstCard = page.locator('.game-card').first();
  await firstCard.locator('[aria-label*="お気に入りに追加"]').click();
  
  // 2. エクスポート
  await page.getByRole('button', { name: 'インポート/エクスポート' }).click();
  
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '全フォルダをエクスポート' }).click();
  const download = await downloadPromise;
  
  const path = await download.path();
  const fs = require('fs');
  const exportedData = JSON.parse(fs.readFileSync(path, 'utf-8'));
  
  // エクスポートデータの検証
  expect(exportedData.folders).toBeDefined();
  expect(exportedData.games).toBeDefined();
  expect(exportedData.games.length).toBe(1);
  
  // 3. データ削除
  await page.getByRole('button', { name: '設定' }).click();
  await page.getByRole('button', { name: 'すべてのデータを削除' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  
  // 4. インポート
  await page.getByRole('button', { name: 'インポート/エクスポート' }).click();
  await page.setInputFiles('input[type="file"]', path);
  await page.getByRole('button', { name: 'インポート' }).click();
  
  // 5. データ復元確認
  await page.getByRole('button', { name: 'コレクション' }).click();
  await page.getByText('気になるリスト').click();
  await expect(page.locator('.collection-item')).toHaveCount(1);
});
```

---

## 🌐 4. クロスブラウザテスト

### E2E-CROSS-001: Chrome での動作確認

**優先度**: High
**ステータス**: ⬜ 未実装

**テスト内容**
- すべての主要機能がChromeで動作する

**実装例**

```javascript
test.use({ browserName: 'chromium' });

test('E2E-CROSS-001: Chrome での動作確認', async ({ page }) => {
  await page.goto('/');
  
  // 基本機能テスト
  await expect(page).toHaveTitle(/Game Seeker Vault/);
  await expect(page.locator('.game-card')).toHaveCount({ timeout: 10000 }, { min: 100 });
  
  // コレクション機能
  const firstCard = page.locator('.game-card').first();
  await firstCard.locator('[aria-label*="お気に入りに追加"]').click();
  await page.getByRole('button', { name: 'コレクション' }).click();
  await expect(page.getByText('気になるリスト')).toBeVisible();
});
```

---

### E2E-CROSS-002: Safari での動作確認

**優先度**: High
**ステータス**: ⬜ 未実装

**テスト内容**
- すべての主要機能がSafariで動作する

**実装例**

```javascript
test.use({ browserName: 'webkit' });

test('E2E-CROSS-002: Safari での動作確認', async ({ page }) => {
  await page.goto('/');
  
  // 基本機能テスト
  await expect(page).toHaveTitle(/Game Seeker Vault/);
  
  // IndexedDBサポート確認
  const hasIndexedDB = await page.evaluate(() => {
    return 'indexedDB' in window;
  });
  expect(hasIndexedDB).toBe(true);
});
```

---

### E2E-CROSS-003: Firefox での動作確認

**優先度**: High
**ステータス**: ⬜ 未実装

**テスト内容**
- すべての主要機能がFirefoxで動作する

**実装例**

```javascript
test.use({ browserName: 'firefox' });

test('E2E-CROSS-003: Firefox での動作確認', async ({ page }) => {
  await page.goto('/');
  
  // 基本機能テスト
  await expect(page).toHaveTitle(/Game Seeker Vault/);
  await expect(page.locator('.game-card')).toHaveCount({ timeout: 10000 }, { min: 100 });
});
```

---

## 📱 5. モバイルテスト

### E2E-MOBILE-001: モバイルでの基本操作

**優先度**: Medium
**ステータス**: ⬜ 未実装

**シナリオ**
1. モバイルデバイスでアクセス
2. ゲーム一覧が正しく表示される
3. タップ操作が正常に動作する

**実装例**

```javascript
test.use({ 
  ...devices['iPhone 14 Pro'],
});

test('E2E-MOBILE-001: モバイルでの基本操作', async ({ page }) => {
  await page.goto('/');
  
  // ページ表示確認
  await expect(page).toHaveTitle(/Game Seeker Vault/);
  
  // カード表示確認（1カラム）
  const cards = page.locator('.game-card');
  await expect(cards.first()).toBeVisible();
  
  // タップ操作
  await cards.first().tap();
  
  // モバイルフィルタボタン
  await expect(page.getByRole('button', { name: 'フィルター' })).toBeVisible();
});
```

---

## 📊 テスト実装状況サマリー

### コレクション機能
- [ ] E2E-COL-001: ゲーム追加からフォルダ管理まで
- [ ] E2E-COL-002: ドラッグ&ドロップでのフォルダ並び替え

### フィルタ・検索
- [ ] E2E-FIL-001: 複合フィルタリン���
- [ ] E2E-FIL-002: フィルタのクリア

### インポート/エクスポート
- [ ] E2E-EXPORT-001: エクスポートからインポートまでの完全フロー

### クロスブラウザ
- [ ] E2E-CROSS-001: Chrome での動作確認
- [ ] E2E-CROSS-002: Safari での動作確認
- [ ] E2E-CROSS-003: Firefox での動作確認

### モバイル
- [ ] E2E-MOBILE-001: モバイルでの基本操作

---

## 🚀 テスト実行方法

```bash
cd app

# すべてのE2Eテスト実行
npm run test:e2e

# 特定のブラウザのみ
npm run test:e2e -- --project=chromium

# UIモード（デバッグ）
npm run test:e2e:ui

# ヘッドレスモード無効
npm run test:e2e -- --headed

# 特定のテストのみ
npm run test:e2e -- collection-full-flow.spec.js
```

---

## 📚 参考資料

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
