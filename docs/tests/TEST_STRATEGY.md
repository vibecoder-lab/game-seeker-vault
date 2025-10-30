# テスト戦略・方針

## 📋 概要

このドキュメントは、Game Seeker Vaultプロジェクト全体のテスト戦略、方針、およびテストフレームワークの選定理由を説明します。

---

## 🎯 テスト戦略

### テストの目的

1. **品質保証**: コードの正確性と信頼性を保証
2. **リグレッション防止**: 新機能追加時の既存機能の破壊を防ぐ
3. **リファクタリングの安全性**: コード改善時の安全ネットを提供
4. **ドキュメント化**: テストコードが仕様書として機能

### テストレベル

| レベル | 対象 | 目的 | 実行頻度 |
|--------|------|------|----------|
| **Unit Test** | 個別の関数・コンポーネント | ロジックの正確性 | 毎回のコミット |
| **Integration Test** | 複数モジュールの統合 | モジュール間の連携 | 毎回のコミット |
| **API Test** | Pages Functions | APIの動作保証 | 毎回のコミット |
| **E2E Test** | ユーザーシナリオ | 実際の使用フロー | プルリクエスト時 |

---

## 🛠️ テストフレームワーク選定

### フロントエンド: Vitest + React Testing Library

**選定理由**
- Viteとのシームレスな統合
- Jestとの互換性（移行が容易）
- 高速な実行速度
- React Testing Libraryはユーザー視点のテストを推奨

**インストール**
```bash
cd app
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**設定ファイル**: `app/vitest.config.js`
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.js',
      ],
    },
  },
});
```

---

### バックエンド: pytest

**選定理由**
- Pythonのデファクトスタンダード
- 豊富なプラグインエコシステム
- パラメータ化テストが容易
- モックが簡単

**インストール**
```bash
cd updater
pip install pytest pytest-cov pytest-mock requests-mock
```

**設定ファイル**: `updater/pytest.ini`
```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    --verbose
    --cov=.
    --cov-report=html
    --cov-report=term-missing
```

---

### API: Vitest + Miniflare

**選定理由**
- Cloudflare Workers環境のローカルエミュレーション
- KVストレージのモック
- Pages Functionsのテストに最適

**インストール**
```bash
cd app
npm install -D miniflare @cloudflare/vitest-pool-workers
```

---

### E2E: Playwright

**選定理由**
- クロスブラウザ対応（Chromium、Firefox、WebKit）
- 自動待機機能（flaky test削減）
- スクリーンショット・動画記録
- デバッグツールが強力

**インストール**
```bash
cd app
npm install -D @playwright/test
npx playwright install
```

**設定ファイル**: `app/playwright.config.js`
```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 📊 テストカバレッジ目標

### 目標カバレッジ

| レイヤー | 目標カバレッジ | 優先度 |
|---------|---------------|--------|
| **ユーティリティ関数** | 90%以上 | High |
| **ビジネスロジック** | 80%以上 | High |
| **UIコンポーネント** | 70%以上 | Medium |
| **API** | 80%以上 | High |
| **E2E** | 主要フロー100% | High |

### 優先テスト対象

#### High Priority
- コレクション機能（CRUD操作）
- フィルタ・検索ロジック
- 価格計算・表示
- データパイプライン（Steam/ITAD API連携）
- 認証（管理画面）

#### Medium Priority
- i18n（多言語対応）
- テーマ切り替え
- インポート/エクスポート
- モバイルUI

#### Low Priority
- アニメーション
- ツールチップ
- 非機能的なUI要素

---

## 🔄 CI/CD統合

### GitHub Actions ワークフロー

**ファイル**: `.github/workflows/test.yml`

```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd app
          npm ci
      - name: Run unit tests
        run: |
          cd app
          npm run test:unit
      - name: Run coverage
        run: |
          cd app
          npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      - name: Install dependencies
        run: |
          cd updater
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-mock requests-mock
      - name: Run tests
        run: |
          cd updater
          pytest --cov=. --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd app
          npm ci
      - name: Install Playwright
        run: |
          cd app
          npx playwright install --with-deps
      - name: Run E2E tests
        run: |
          cd app
          npm run test:e2e
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: app/playwright-report/
```

---

## 📁 ディレクトリ構造

```
game-seeker-vault/
├── app/
│   ├── src/
│   │   ├── components/
│   │   │   └── __tests__/          # コンポーネントテスト
│   │   ├── utils/
│   │   │   └── __tests__/          # ユーティリティテスト
│   │   ├── db/
│   │   │   └── __tests__/          # IndexedDBテスト
│   │   └── test/
│   │       ├── setup.js            # テストセットアップ
│   │       ├── mocks/              # モックデータ
│   │       └── helpers/            # テストヘルパー
│   ├── e2e/                        # E2Eテスト
│   │   ├── collection.spec.js
│   │   ├── filter.spec.js
│   │   └── fixtures/
│   └── functions/
│       └── __tests__/              # Pages Functionsテスト
│
├── updater/
│   ├── tests/                      # Pytestテスト
│   │   ├── test_steam_client.py
│   │   ├── test_itad_client.py
│   │   ├── test_game_data_builder.py
│   │   ├── conftest.py             # Pytest fixtures
│   │   └── fixtures/               # テストデータ
│   └── pytest.ini
│
└── docs/
    └── tests/
        ├── TEST_STRATEGY.md        # このドキュメント
        ├── FRONTEND_TESTS.md
        ├── BACKEND_TESTS.md
        ├── API_TESTS.md
        └── E2E_TESTS.md
```

---

## 🚀 テスト実行コマンド

### フロントエンド

```bash
cd app

# すべてのユニットテスト実行
npm run test:unit

# 監視モード（開発中）
npm run test:watch

# カバレッジレポート生成
npm run test:coverage

# 特定ファイルのみテスト
npm run test:unit -- src/components/__tests__/CollectionModal.test.jsx
```

### バックエンド

```bash
cd updater

# すべてのテスト実行
pytest

# 特定のテストファイル実行
pytest tests/test_steam_client.py

# カバレッジレポート生成
pytest --cov=. --cov-report=html

# 詳細出力
pytest -v
```

### API

```bash
cd app

# Pages Functionsテスト
npm run test:api
```

### E2E

```bash
cd app

# すべてのE2Eテスト実行
npm run test:e2e

# UIモードで実行（デバッグ用）
npm run test:e2e:ui

# 特定のブラウザのみ
npm run test:e2e -- --project=chromium

# ヘッドレスモード無効（ブラウザ表示）
npm run test:e2e -- --headed
```

---

## 🔍 テストのベストプラクティス

### 1. テストの独立性
- 各テストは他のテストに依存しない
- テスト前後で状態をクリーンアップ
- 共有状態を避ける

### 2. 明確なテスト名
- テストケースIDを付与（例: FE-COL-001）
- 何をテストしているか一目で分かる命名
- Given-When-Then形式を推奨

```javascript
// Good
test('FE-COL-001: should add game to collection when star icon is clicked', () => {
  // ...
});

// Bad
test('test1', () => {
  // ...
});
```

### 3. AAA パターン
- **Arrange**: テストデータとモックを準備
- **Act**: 実際の操作を実行
- **Assert**: 結果を検証

```javascript
test('should filter games by genre', () => {
  // Arrange
  const games = [
    { id: 1, genres: ['Action'] },
    { id: 2, genres: ['RPG'] },
  ];
  
  // Act
  const filtered = filterByGenre(games, ['Action']);
  
  // Assert
  expect(filtered).toHaveLength(1);
  expect(filtered[0].id).toBe(1);
});
```

### 4. モックの適切な使用
- 外部依存（API、DB）は必ずモック
- モックは最小限に
- モックの振る舞いは明示的に

### 5. エラーケースのテスト
- 正常系だけでなく異常系も必ずテスト
- エッジケースを考慮
- エラーメッセージの検証

---

## 📈 テスト実装の優先順位

### Phase 1: 基盤構築（1週間）
- [ ] テストフレームワークのセットアップ
- [ ] CI/CD統合
- [ ] モックデータの準備
- [ ] テストヘルパー関数の作成

### Phase 2: コア機能のテスト（2週間）
- [ ] コレクション機能のユニットテスト
- [ ] フィルタ・検索ロジックのテスト
- [ ] IndexedDB操作のテスト
- [ ] データパイプラインのテスト

### Phase 3: 統合テスト（1週間）
- [ ] APIテスト
- [ ] コンポーネント統合テスト
- [ ] Steam/ITAD API連携テスト

### Phase 4: E2Eテスト（1週間）
- [ ] 主要ユーザーフローのE2E
- [ ] クロスブラウザテスト
- [ ] モバイルテスト

---

## 🐛 テストデバッグ

### フロントエンド
```bash
# デバッグモード
npm run test:debug

# 特定のテストのみデバッグ
npm run test:debug -- CollectionModal.test.jsx
```

### E2E
```bash
# UIモード（ステップバイステップ実行）
npx playwright test --ui

# トレース表示
npx playwright show-trace trace.zip
```

---

## 📚 参考資料

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Pytest Documentation](https://docs.pytest.org/)
- [Playwright Documentation](https://playwright.dev/)
- [Miniflare Documentation](https://miniflare.dev/)

---

## 🔄 継続的改善

### テストメトリクス
- テストカバレッジ率（週次確認）
- テスト実行時間（目標: 5分以内）
- Flaky test率（目標: 1%以下）
- バグ検出率

### レビュープロセス
- 新機能追加時は必ずテストも追加
- PRレビューでテストカバレッジを確認
- テストが失敗したらマージしない

---

## ✅ チェックリスト

新機能追加時のテストチェックリスト：

- [ ] ユニットテストを追加した
- [ ] 異常系テストを追加した
- [ ] カバレッジが目標値以上
- [ ] CIが通過している
- [ ] E2Eテストが必要な場合は追加した
- [ ] テストドキュメントを更新した
