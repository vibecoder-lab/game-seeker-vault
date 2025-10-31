# APIテストケース

## 📋 概要

このドキュメントは、Cloudflare Pages Functions APIの自動テストケースを定義します。

**対象**: `app/functions/api/` 配下のすべてのPages Functions

**テストフレームワーク**: Vitest + Miniflare

**優先テスト対象**:
1. /api/games-data エンドポイント
2. /api/detect-locale エンドポイント
3. /api/submit-feedback エンドポイント

---

## 🎯 テストカテゴリ

### 1. /api/games-data テスト
### 2. /api/detect-locale テスト
### 3. /api/feedback テスト
### 4. /api/feedback-admin テスト

---

## 🎮 1. /api/games-data テスト

### API-GAMES-001: 正常レスポンス

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- KVに games-data が保存されている

**テスト内容**
- GET /api/games-data を呼び出し
- ゲームデータを取得

**期待結果（正常系）**
- ステータスコード: 200
- レスポンス形式: `{ success: true, data: { meta: {}, games: [] } }`
- games配列に10,000件程度のデータ

**異常系**
- KVが空の場合: 500エラー

**実装例**

```javascript
// app/functions/__tests__/games-data.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../api/games-data';

describe('API-GAMES-001: /api/games-data 正常レスポンス', () => {
  beforeEach(() => {
    // KVモックデータを設定
    const mockGamesData = [
      {
        id: '730',
        title: 'Counter-Strike 2',
        deal: {
          JPY: { price: 0 },
          USD: { price: 0 }
        },
        genres: ['Action', 'FPS'],
        reviewScore: 'Very Positive'
      }
    ];
    
    env.GSV_GAMES.put('games-data', JSON.stringify(mockGamesData));
  });

  it('正常系: ゲームデータが取得できる', async () => {
    // Arrange
    const request = new Request('http://localhost/api/games-data');
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.games).toBeInstanceOf(Array);
    expect(data.data.games.length).toBeGreaterThan(0);
    expect(data.data.games[0].id).toBe('730');
  });

  it('異常系: KVが空の場合', async () => {
    // Arrange
    await env.GSV_GAMES.delete('games-data');
    const request = new Request('http://localhost/api/games-data');
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    // Assert
    expect(response.status).toBe(500);
  });
});
```

---

### API-GAMES-002: KV読み取りエラー

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- KVへのアクセスが失敗する状況

**テスト内容**
- KV読み取りエラーを模擬
- エラーハンドリングを確認

**期待結果（正常系）**
- ステータスコード: 500
- エラーメッセージが返され��

**実装例**

```javascript
describe('API-GAMES-002: KV読み取りエラー', () => {
  it('異常系: KV読み取りエラー時', async () => {
    // Arrange
    env.GSV_GAMES.get = () => Promise.reject(new Error('KV Error'));
    const request = new Request('http://localhost/api/games-data');
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });
});
```

---

### API-GAMES-003: データ形式検証

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- KVにゲームデータが保存されている

**テスト内容**
- レスポンスデータの形式を検証
- 必須フィールドの存在確認

**期待結果（正常系）**
- 各ゲームに必須フィールドが含まれる
  - id, title, deal, genres, reviewScore

**実装例**

```javascript
describe('API-GAMES-003: データ形式検証', () => {
  it('正常系: 必須フィールドが含まれる', async () => {
    // Arrange
    const mockGamesData = [
      {
        id: '730',
        title: 'Counter-Strike 2',
        deal: {
          JPY: { price: 0, storeLow: 0 },
          USD: { price: 0, storeLow: 0 }
        },
        genres: ['Action'],
        reviewScore: 'Very Positive',
        platforms: { windows: true, mac: true }
      }
    ];
    
    await env.GSV_GAMES.put('games-data', JSON.stringify(mockGamesData));
    const request = new Request('http://localhost/api/games-data');
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    const data = await response.json();
    const game = data.data.games[0];

    // Assert
    expect(game.id).toBeDefined();
    expect(game.title).toBeDefined();
    expect(game.deal).toBeDefined();
    expect(game.deal.JPY).toBeDefined();
    expect(game.deal.USD).toBeDefined();
    expect(game.genres).toBeInstanceOf(Array);
    expect(game.reviewScore).toBeDefined();
  });
});
```

---

## 🌐 2. /api/detect-locale テスト

### API-LOCALE-001: ロケール検出（日本）

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- Cloudflare Geo情報がJPを返す

**テスト内容**
- GET /api/detect-locale を呼び出し
- 日本のIPからのアクセスを模擬

**期待結果（正常系）**
- ステータスコード: 200
- suggestedLang: 'ja'

**実装例**

```javascript
// app/functions/__tests__/detect-locale.test.js
import { describe, it, expect } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../api/detect-locale';

describe('API-LOCALE-001: ロケール検出（日本）', () => {
  it('正常系: 日本からのアクセス', async () => {
    // Arrange
    const request = new Request('http://localhost/api/detect-locale', {
      headers: {
        'CF-IPCountry': 'JP'
      }
    });
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.suggestedLang).toBe('ja');
    expect(data.country).toBe('JP');
  });
});
```

---

### API-LOCALE-002: ロケール検出（フォールバック）

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- Cloudflare Geo情報が取得できない

**テスト内容**
- CF-IPCountryヘッダーなし
- デフォルト言語にフォールバック

**期待結果（正常系）**
- ステータスコード: 200
- suggestedLang: 'en'

**実装例**

```javascript
describe('API-LOCALE-002: ロケール検出（フォールバック）', () => {
  it('正常系: Geoヘッダーなしの場合', async () => {
    // Arrange
    const request = new Request('http://localhost/api/detect-locale');
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.suggestedLang).toBe('en');
  });
});
```

---

## 💬 3. /api/feedback テスト

### API-FEEDBACK-001: フィードバック送信（正常系）

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- FEEDBACK_KVが設定されている
- MAILCHANNELS_API_KEYが設定されている

**テスト内容**
- POST /api/feedback にデータを送信
- フィードバックがKVに保存される
- メール通知が送信される

**期待結果（正常系）**
- ステータスコード: 200
- success: true
- message: 'Feedback submitted successfully'

**実装例**

```javascript
// app/functions/__tests__/feedback.test.js
import { describe, it, expect, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../api/feedback';

describe('API-FEEDBACK-001: フィードバック送信（正常系）', () => {
  it('正常系: フィードバックが保存される', async () => {
    // Arrange
    const feedbackData = {
      category: 'bug',
      title: 'テストバグ',
      description: 'テスト詳細',
      email: 'test@example.com',
      timestamp: Date.now()
    };

    const request = new Request('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackData)
    });
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Feedback submitted successfully');

    // KVに保存されているか確認
    const savedData = await env.FEEDBACK_KV.get(`feedback:${feedbackData.timestamp}`);
    expect(savedData).toBeDefined();
  });
});
```

---

### API-FEEDBACK-002: バリデーションエラー

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- なし

**テスト内容**
- 不正なデータでPOST送信
- バリデーションエラーが返される

**期待結果（正常系）**
- ステータスコード: 400
- エラーメッセージが返される

**実装例**

```javascript
describe('API-FEEDBACK-002: バリデーションエラー', () => {
  it('異常系: タイトルが空', async () => {
    // Arrange
    const feedbackData = {
      category: 'bug',
      title: '',
      description: 'テスト詳細'
    };

    const request = new Request('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackData)
    });
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('title');
  });

  it('異常系: 詳細が空', async () => {
    // Arrange
    const feedbackData = {
      category: 'bug',
      title: 'テストバグ',
      description: ''
    };

    const request = new Request('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackData)
    });
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('description');
  });
});
```

---

## 🔐 4. /api/feedback-admin テスト

### API-ADMIN-001: フィードバック一覧取得（正常系）

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- FEEDBACK_KVにフィードバックデータが保存されている
- FEEDBACK_ADMIN_SECRETが設定されている

**テスト内容**
- GET /api/feedback-admin?secret=XXX でフィードバック一覧を取得

**期待結果（正常系）**
- ステータスコード: 200
- success: true
- feedbacks配列が返される

**実装例**

```javascript
// app/functions/__tests__/feedback-admin.test.js
import { describe, it, expect } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../api/feedback-admin';

describe('API-ADMIN-001: フィードバック一覧取得（正常系）', () => {
  it('正常系: フィードバック一覧が取得できる', async () => {
    // Arrange
    const timestamp = Date.now();
    const feedbackData = {
      timestamp,
      category: 'bug',
      title: 'テストバグ',
      description: 'テスト詳細',
      email: 'test@example.com',
      userAgent: 'Mozilla/5.0',
      locale: 'ja'
    };

    await env.FEEDBACK_KV.put(`feedback:${timestamp}`, JSON.stringify(feedbackData));

    const request = new Request('http://localhost/api/feedback-admin?secret=test-secret');
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.feedbacks).toBeInstanceOf(Array);
    expect(data.feedbacks.length).toBeGreaterThan(0);
    expect(data.feedbacks[0].title).toBe('テストバグ');
  });
});
```

---

### API-ADMIN-002: 認証エラー

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- なし

**テスト内容**
- シークレットキーなし、または誤ったシークレットキーでアクセス

**期待結果（正常系）**
- ステータスコード: 401
- エラーメッセージが返される

**実装例**

```javascript
describe('API-ADMIN-002: 認証エラー', () => {
  it('異常系: シークレットキーなし', async () => {
    // Arrange
    const request = new Request('http://localhost/api/feedback-admin');
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid secret key');
  });

  it('異常系: 誤ったシークレットキー', async () => {
    // Arrange
    const request = new Request('http://localhost/api/feedback-admin?secret=wrong-secret');
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid secret key');
  });
});
```

---

### API-ADMIN-003: フィードバック削除

**優先度**: Medium
**ステータス**: ⬜ 未実装

**前提条件**
- FEEDBACK_KVにフィードバックデータが保存されている
- FEEDBACK_ADMIN_SECRETが設定されている

**テスト内容**
- DELETE /api/feedback-admin でフィードバックを削除

**期待結果（正常系）**
- ステータスコード: 200
- success: true
- KVからデータが削除される

**実装例**

```javascript
describe('API-ADMIN-003: フィードバック削除', () => {
  it('正常系: フィードバックが削除される', async () => {
    // Arrange
    const timestamp = Date.now();
    const feedbackData = {
      timestamp,
      category: 'bug',
      title: 'テストバグ',
      description: 'テスト詳細'
    };

    await env.FEEDBACK_KV.put(`feedback:${timestamp}`, JSON.stringify(feedbackData));

    const request = new Request('http://localhost/api/feedback-admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: 'test-secret',
        timestamp
      })
    });
    const ctx = createExecutionContext();

    // Act
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // KVから削除されているか確認
    const deletedData = await env.FEEDBACK_KV.get(`feedback:${timestamp}`);
    expect(deletedData).toBeNull();
  });
});
```

---

## 📊 テスト実装状況サマリー

### /api/games-data
- [ ] API-GAMES-001: 正常レスポンス
- [ ] API-GAMES-002: KV読み取りエラー
- [ ] API-GAMES-003: データ形式検証

### /api/detect-locale
- [ ] API-LOCALE-001: ロケール検出（日本）
- [ ] API-LOCALE-002: ロケール検出（フォールバック）

### /api/feedback
- [ ] API-FEEDBACK-001: フィードバック送信（正常系）
- [ ] API-FEEDBACK-002: バリデーションエラー

### /api/feedback-admin
- [ ] API-ADMIN-001: フィードバック一覧取得（正常系）
- [ ] API-ADMIN-002: 認証エラー
- [ ] API-ADMIN-003: フィードバック削除

---

## 🚀 テスト実行方法

```bash
cd app

# すべてのAPIテスト実行
npm run test:api

# 特定のテストのみ
npm run test:api -- games-data.test.js

# 詳細出力
npm run test:api -- -v
```

---

## 📚 参考資料

- [Vitest Documentation](https://vitest.dev/)
- [Miniflare Documentation](https://miniflare.dev/)
- [Cloudflare Workers Testing](https://developers.cloudflare.com/workers/testing/)
