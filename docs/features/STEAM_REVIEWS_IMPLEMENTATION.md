# Steam ユーザーレビュー機能 実装ガイド

## 概要

このドキュメントでは、Game Seeker VaultにSteam ユーザーレビュー表示機能を追加する際の実装方法について説明します。

### 目的

- カードやモーダルからゲームのユーザーレビュー（本文、評価、プレイ時間など）を表示
- レビュー情報によりユーザーのゲーム選択をサポート

### 背景

- 現在は `reviewScore`（"Very Positive"など）のみ表示
- 個別のユーザーレビュー本文は未実装
- Steam APIのレート制限（200回/5分）への対策が必要

---

## Steam Review API 仕様

### エンドポイント

```
https://store.steampowered.com/appreviews/{appid}?json=1
```

### パラメータ

| パラメータ | 説明 | デフォルト | 例 |
|-----------|------|-----------|-----|
| `json` | JSON形式で返す（必須） | - | `1` |
| `language` | レビュー言語 | `all` | `english`, `japanese`, `all` |
| `num_per_page` | 取得件数 | `20` | `1~100` |
| `filter` | フィルター | `all` | `recent`, `updated`, `all` |
| `review_type` | 評価タイプ | `all` | `positive`, `negative`, `all` |
| `purchase_type` | 購入タイプ | `all` | `steam`, `non_steam_purchase`, `all` |
| `cursor` | ページネーション用カーソル | - | レスポンスの`cursor`値 |
| `day_range` | 期間フィルター（日数） | - | `30`, `90`, `365` |

### レスポンスフォーマット

```json
{
  "success": 1,
  "query_summary": {
    "num_reviews": 3,
    "review_score": 8,
    "review_score_desc": "Very Positive",
    "total_positive": 2100939,
    "total_negative": 327125,
    "total_reviews": 2428064
  },
  "reviews": [
    {
      "recommendationid": "208004323",
      "author": {
        "steamid": "76561198040154331",
        "num_games_owned": 184,
        "num_reviews": 22,
        "playtime_forever": 4090,
        "playtime_last_two_weeks": 1116,
        "playtime_at_review": 4090,
        "last_played": 1761868667
      },
      "language": "english",
      "review": "Shoot gun have fun",
      "timestamp_created": 1761868699,
      "timestamp_updated": 1761868699,
      "voted_up": true,
      "votes_up": 0,
      "votes_funny": 0,
      "weighted_vote_score": 0.5,
      "comment_count": 0,
      "steam_purchase": false,
      "received_for_free": false,
      "written_during_early_access": false,
      "primarily_steam_deck": false
    }
  ],
  "cursor": "AoJwwv/gm5oDeKC8mQY="
}
```

### 主要フィールド

| フィールド | 説明 |
|-----------|------|
| `query_summary.review_score_desc` | レビュースコア（"Very Positive" など） |
| `query_summary.total_positive` | 好評の総数 |
| `query_summary.total_negative` | 不評の総数 |
| `query_summary.total_reviews` | 総レビュー数 |
| `reviews[].review` | レビュー本文 |
| `reviews[].voted_up` | 推奨/非推奨（true=推奨、false=非推奨） |
| `reviews[].author.playtime_forever` | 総プレイ時間（分） |
| `reviews[].author.playtime_at_review` | レビュー時点のプレイ時間（分） |
| `reviews[].votes_up` | helpful投票数 |
| `reviews[].language` | レビュー言語 |
| `reviews[].timestamp_created` | 投稿日時（Unixタイムスタンプ） |
| `cursor` | 次ページ取得用カーソル |

### レート制限

- **制限**: 200回 / 5分
- **単位**: IPアドレスベース
- **認証**: 不要（公開API）

---

## 実装パターン比較

### パターンA: フロントエンドから直接Steam APIを呼ぶ

#### 構成

```
[ブラウザ]
  ↓ fetch('https://store.steampowered.com/appreviews/...')
[Steam API]
```

#### メリット

- サーバーサイド実装不要
- リアルタイムデータ取得
- ユーザーごとに独立したレート制限（ユーザーのIPで分散）

#### デメリット

- **CORS制限**: Steam APIは`Access-Control-Allow-Origin`ヘッダーを返さない
  - **ブラウザから直接呼び出し不可**
- レート制限がユーザーに直接影響
- フロントエンドにAPI URLが露出

#### 実装可能性

**✗ 不可** - CORSエラーにより実装不可能

---

### パターンB: Cloudflare Pages Functionsを経由（推奨）

#### 構成

```
[ブラウザ]
  ↓ fetch('/api/reviews/730')
[Pages Function: /api/reviews/[appid].ts]
  ├─ Cache API確認（1時間TTL）
  ├─ KV確認（24時間TTL）
  └─ Steam API呼び出し（キャッシュミス時のみ）
      ↓
[Steam API]
  ↓ Response
[Pages Function]
  ├─ Cache API保存
  ├─ KV保存
  └─ Response返却
      ↓
[ブラウザ]
```

#### メリット

- CORS問題を回避
- サーバーサイドでキャッシュ可能
- レスポンスの加工・フィルタリングが可能
- エラーハンドリングを集中管理
- リアルタイムデータ取得可能

#### デメリット

- Pages Functionsの実装が必要
- レート制限がPages Functions単位で共有
- 全ユーザーからのリクエストが同一IPから送信される

#### キャッシュ戦略

1. **Cloudflare Cache API**
   - HTTP Cache-Control ヘッダーベース
   - CDNエッジでキャッシュ
   - **TTL: 1時間推奨**
   - レイテンシ: 最小

2. **Cloudflare Workers KV**
   - Key: `reviews:{appid}:{language}:{num}:{filter}`
   - **TTL: 24時間推奨**
   - 読み取り: 制限なし（実質無制限）
   - 書き込み: 1000回/日（無料プラン）
   - レイテンシ: 低

#### レート制限対策

- キャッシュにより実際のSteam APIへのリクエストを大幅削減
- 1ゲームあたり1時間に1回のみSteam APIを呼ぶ
- **試算**:
  - 同時アクセス: 100ユーザー
  - キャッシュヒット率: 90%
  - 実際のAPI呼び出し: 10回/分
  - 5分間: 50回 → **200回/5分以内に収まる**

#### 実装可能性

**✓ 推奨** - 最もバランスの取れた実装方法

---

### パターンC: バッチ処理で事前取得

#### 構成

```
[GitHub Actions - Daily Batch]
  ↓ 全ゲームのレビュー取得（上位10件など）
  ↓
[Cloudflare KV: reviews-data]
  ↓
[Pages Function: /api/games-data]
  ↓ ゲームデータ + レビューデータ
[ブラウザ]
```

#### メリット

- リアルタイムのSteam API呼び出し不要
- レート制限の影響を受けない
- レビューデータをゲームデータに統合可能
- 既存の日次バッチに統合可能

#### デメリット

- レビューデータが古くなる（最大24時間）
- **データサイズが増加**
  - 現在: 約10,762ゲーム × 平均10KB = 約100MB
  - レビュー追加: 10,762ゲーム × 10件 × 1KB = 約100MB増加
  - **合計: 約200MB** （KV 1GB制限内）
- **バッチ処理時間の増加**
  - 10,762ゲーム × 1.2秒/リクエスト = 約3.6時間

#### 最適化案

- レビュー件数を制限（上位3~5件のみ）
- 人気ゲームのみ（reviewScoreが一定以上）
- 段階的取得（優先度が高いゲームから順に）

#### 実装可能性

**△ 可能だがデータ量大** - リアルタイム性が不要な場合のみ検討

---

## 推奨実装アーキテクチャ

### パターンB（Pages Functions + Cache API + KV）を採用

#### アーキテクチャ図

```
┌─────────┐
│ブラウザ │
└────┬────┘
     │ GET /api/reviews/730?language=japanese&num_per_page=10
     ↓
┌────────────────────────────────┐
│Pages Function                  │
│/api/reviews/[appid].ts         │
├────────────────────────────────┤
│1. Cache API確認                │
│   ├─ HIT → レスポンス返却      │
│   └─ MISS → 次へ               │
│                                │
│2. KV確認                       │
│   ├─ HIT & 有効期限内          │
│   │   ├─ Cache API保存         │
│   │   └─ レスポンス返却        │
│   └─ MISS → 次へ               │
│                                │
│3. Steam API呼び出し            │
│   ├─ レスポンス取得            │
│   ├─ KV保存（24h TTL）         │
│   ├─ Cache API保存（1h TTL）   │
│   └─ レスポンス返却            │
└────┬───────────────────────────┘
     │
     ↓
┌────────────────┐
│Steam API       │
│/appreviews/730 │
└────────────────┘
```

#### データフロー

**初回リクエスト（キャッシュミス）**:
1. ブラウザ → Pages Function
2. Cache API確認 → MISS
3. KV確認 → MISS
4. Steam API呼び出し
5. レスポンス取得
6. KV保存（24時間TTL）
7. Cache API保存（1時間TTL）
8. ブラウザへ返却

**2回目以降（キャッシュヒット）**:
1. ブラウザ → Pages Function
2. Cache API確認 → **HIT**
3. ブラウザへ返却（高速）

**1時間後（Cache期限切れ、KV有効）**:
1. ブラウザ → Pages Function
2. Cache API確認 → MISS
3. KV確認 → **HIT**
4. Cache API再保存
5. ブラウザへ返却

---

## 実装手順

### Phase 1: Pages Function作成

#### ファイル: `app/functions/api/reviews/[appid].ts`

```typescript
interface Env {
  GSV_REVIEWS: KVNamespace;
}

interface ReviewsCache {
  data: any;
  timestamp: number;
}

export async function onRequest(context): Promise<Response> {
  const { params, env, request } = context;
  const appid = params.appid as string;
  const url = new URL(request.url);

  // パラメータ取得
  const language = url.searchParams.get('language') || 'all';
  const numPerPage = parseInt(url.searchParams.get('num_per_page') || '10');
  const filter = url.searchParams.get('filter') || 'all';

  // CORS対応
  const corsHeaders = {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Cache API確認
  const cache = caches.default;
  const cacheKey = new Request(
    `https://api.internal/reviews/${appid}?lang=${language}&num=${numPerPage}&filter=${filter}`
  );
  let response = await cache.match(cacheKey);

  if (response) {
    console.log(`Cache HIT for appid: ${appid}`);
    return new Response(response.body, {
      headers: { ...Object.fromEntries(response.headers), ...corsHeaders }
    });
  }

  // KV確認
  const kvKey = `reviews:${appid}:${language}:${numPerPage}:${filter}`;
  const cached = await env.GSV_REVIEWS.get(kvKey, 'json') as ReviewsCache | null;

  if (cached && (Date.now() - cached.timestamp < 3600000)) { // 1時間
    console.log(`KV HIT for appid: ${appid}`);
    response = new Response(JSON.stringify(cached.data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders
      }
    });
    await cache.put(cacheKey, response.clone());
    return response;
  }

  // Steam APIから取得
  try {
    const steamUrl = new URL(`https://store.steampowered.com/appreviews/${appid}`);
    steamUrl.searchParams.set('json', '1');
    steamUrl.searchParams.set('language', language);
    steamUrl.searchParams.set('num_per_page', numPerPage.toString());
    steamUrl.searchParams.set('filter', filter);

    console.log(`Fetching from Steam API for appid: ${appid}`);
    const steamResponse = await fetch(steamUrl.toString());

    if (!steamResponse.ok) {
      throw new Error(`Steam API error: ${steamResponse.status}`);
    }

    const data = await steamResponse.json();

    // KVに保存（24時間TTL）
    await env.GSV_REVIEWS.put(kvKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }), { expirationTtl: 86400 });

    // Cache APIに保存（1時間TTL）
    response = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders
      }
    });
    await cache.put(cacheKey, response.clone());

    return response;

  } catch (error) {
    console.error('Error fetching reviews:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch reviews',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
```

---

### Phase 2: KV Namespace作成

#### 1. KV Namespaceを作成

```bash
# 新しいKV Namespace作成
wrangler kv:namespace create "GSV_REVIEWS"

# 出力例:
# 🌀 Creating namespace with title "game-seeker-vault-GSV_REVIEWS"
# ✨ Success!
# Add the following to your wrangler.toml:
# { binding = "GSV_REVIEWS", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

#### 2. `wrangler.toml`または`wrangler.jsonc`に追加

```toml
[[kv_namespaces]]
binding = "GSV_REVIEWS"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 実際のIDに置き換え
```

または

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "GSV_GAMES",
      "id": "existing_games_namespace_id"
    },
    {
      "binding": "GSV_REVIEWS",
      "id": "new_reviews_namespace_id"  // 実際のIDに置き換え
    }
  ]
}
```

#### 3. 環境変数の型定義（TypeScript）

```typescript
// app/functions/types.d.ts
interface Env {
  GSV_GAMES: KVNamespace;
  GSV_REVIEWS: KVNamespace;  // 追加
}
```

---

### Phase 3: フロントエンド実装

#### 1. レビュー取得ユーティリティ

**ファイル**: `app/src/utils/reviews.js`

```javascript
/**
 * Fetch reviews for a specific game
 * @param {string} appid - Steam App ID
 * @param {Object} options - Fetch options
 * @param {string} options.language - Review language ('all', 'english', 'japanese')
 * @param {number} options.numPerPage - Number of reviews per page (1-100)
 * @param {string} options.filter - Filter type ('all', 'recent', 'updated')
 * @returns {Promise<Object|null>} Review data or null on error
 */
export const fetchReviews = async (appid, options = {}) => {
  const {
    language = 'all',
    numPerPage = 10,
    filter = 'all'
  } = options;

  try {
    const params = new URLSearchParams({
      language,
      num_per_page: numPerPage.toString(),
      filter
    });

    const url = `/api/reviews/${appid}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return null;
  }
};

/**
 * Format playtime in hours
 * @param {number} minutes - Playtime in minutes
 * @returns {string} Formatted playtime
 */
export const formatPlaytime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  if (hours < 1) {
    return `${minutes}分`;
  }
  return `${hours.toLocaleString()}時間`;
};

/**
 * Format review timestamp
 * @param {number} timestamp - Unix timestamp
 * @param {string} locale - Locale ('ja' or 'en')
 * @returns {string} Formatted date
 */
export const formatReviewDate = (timestamp, locale = 'ja') => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
```

#### 2. レビューモーダルコンポーネント

**ファイル**: `app/src/components/modals/ReviewsModal.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import { fetchReviews, formatPlaytime, formatReviewDate } from '../../utils/reviews.js';
import { t, currentLocale } from '../../i18n/index.js';

export function ReviewsModal({ game, theme, onClose }) {
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const locale = currentLocale();

  useEffect(() => {
    const loadReviews = async () => {
      setLoading(true);
      setError(null);

      const data = await fetchReviews(game.id, {
        language: locale === 'ja' ? 'japanese' : 'english',
        numPerPage: 10,
        filter: 'recent'
      });

      if (data && data.success === 1) {
        setReviews(data);
      } else {
        setError('Failed to load reviews');
      }

      setLoading(false);
    };

    loadReviews();
  }, [game.id, locale]);

  if (loading) {
    return (
      <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]`} onClick={onClose}>
        <div className={`${theme.cardBg} rounded-2xl p-6 max-w-2xl w-full mx-4`} onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">{t('common.loading', locale)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !reviews) {
    return (
      <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]`} onClick={onClose}>
        <div className={`${theme.cardBg} rounded-2xl p-6 max-w-2xl w-full mx-4`} onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-4">{game.title}</h2>
          <p className={theme.subText}>{t('reviews.error', locale)}</p>
          <button onClick={onClose} className={`mt-4 px-4 py-2 rounded ${theme.buttonBg}`}>
            {t('common.close', locale)}
          </button>
        </div>
      </div>
    );
  }

  const { query_summary, reviews: reviewsList } = reviews;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4`} onClick={onClose}>
      <div className={`${theme.cardBg} rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col ${theme.cardShadow}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex justify-between items-center px-6 py-4 border-b ${theme.border}`}>
          <h2 className="text-xl font-bold">{game.title} - {t('reviews.title', locale)}</h2>
          <button onClick={onClose} className={`p-1 rounded ${theme.modalHover}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Review Summary */}
        <div className={`px-6 py-4 border-b ${theme.border} ${theme.bg}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className={`text-sm ${theme.subText}`}>{t('reviews.score', locale)}</div>
              <div className="font-bold">{query_summary.review_score_desc}</div>
            </div>
            <div>
              <div className={`text-sm ${theme.subText}`}>{t('reviews.total', locale)}</div>
              <div className="font-bold">{query_summary.total_reviews.toLocaleString()}</div>
            </div>
            <div>
              <div className={`text-sm ${theme.subText}`}>{t('reviews.positive', locale)}</div>
              <div className="font-bold text-blue-500">{query_summary.total_positive.toLocaleString()}</div>
            </div>
            <div>
              <div className={`text-sm ${theme.subText}`}>{t('reviews.negative', locale)}</div>
              <div className="font-bold text-red-500">{query_summary.total_negative.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Reviews List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {reviewsList && reviewsList.length > 0 ? (
            <div className="space-y-4">
              {reviewsList.map((review) => (
                <div key={review.recommendationid} className={`p-4 rounded-lg ${theme.buttonBg}`}>
                  {/* Review Header */}
                  <div className="flex items-center gap-4 mb-2">
                    <span className={`text-2xl ${review.voted_up ? 'text-blue-500' : 'text-red-500'}`}>
                      {review.voted_up ? '👍' : '👎'}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span>{formatPlaytime(review.author.playtime_forever)}</span>
                        <span className={theme.subText}>•</span>
                        <span>{formatReviewDate(review.timestamp_created, locale)}</span>
                      </div>
                    </div>
                    {review.votes_up > 0 && (
                      <div className={`text-sm ${theme.subText}`}>
                        👏 {review.votes_up} {t('reviews.helpful', locale)}
                      </div>
                    )}
                  </div>

                  {/* Review Text */}
                  <p className="whitespace-pre-wrap">{review.review}</p>

                  {/* Review Footer */}
                  <div className={`flex gap-3 mt-2 text-xs ${theme.subText}`}>
                    {review.steam_purchase && (
                      <span>✓ Steam {t('reviews.purchased', locale)}</span>
                    )}
                    {review.received_for_free && (
                      <span>{t('reviews.free', locale)}</span>
                    )}
                    {review.written_during_early_access && (
                      <span>{t('reviews.earlyAccess', locale)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-center ${theme.subText}`}>{t('reviews.noReviews', locale)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### 3. 翻訳追加

**ファイル**: `app/src/i18n/translations.js`

```javascript
// 英語
'reviews.title': 'User Reviews',
'reviews.score': 'Review Score',
'reviews.total': 'Total Reviews',
'reviews.positive': 'Positive',
'reviews.negative': 'Negative',
'reviews.helpful': 'helpful',
'reviews.purchased': 'purchased',
'reviews.free': 'Received for free',
'reviews.earlyAccess': 'Early Access',
'reviews.noReviews': 'No reviews available',
'reviews.error': 'Failed to load reviews',

// 日本語
'reviews.title': 'ユーザーレビュー',
'reviews.score': 'レビュースコア',
'reviews.total': '総レビュー数',
'reviews.positive': '好評',
'reviews.negative': '不評',
'reviews.helpful': '参考になった',
'reviews.purchased': '購入済み',
'reviews.free': '無料で入手',
'reviews.earlyAccess': 'アーリーアクセス',
'reviews.noReviews': 'レビューがありません',
'reviews.error': 'レビューの読み込みに失敗しました',
```

---

### Phase 4: GameCardへの統合

#### ファイル: `app/src/components/GameCard.jsx`

```javascript
import { ReviewsModal } from './modals/ReviewsModal.jsx';

// コンポーネント内に追加
const [showReviewsModal, setShowReviewsModal] = useState(false);

// レビューボタンを追加（例: カード下部のアクションボタン領域）
<button
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowReviewsModal(true);
  }}
  className={`px-3 py-1 rounded text-sm ${theme.buttonBg} ${theme.text}`}
  title={t('reviews.viewReviews', currentLocale)}
>
  💬 {t('reviews.viewReviews', currentLocale)}
</button>

// モーダルのレンダリング
{showReviewsModal && (
  <ReviewsModal
    game={g}
    theme={theme}
    onClose={() => setShowReviewsModal(false)}
  />
)}
```

---

## データ量とコスト試算

### レビューデータサイズ

- **1レビュー**: 約500バイト（本文平均100文字 + メタデータ）
- **10レビュー**: 約5KB
- **キャッシュされるゲーム数**: 想定1,000ゲーム（人気タイトル）
- **合計KV使用量**: 1,000 × 5KB = **約5MB**

### KV制限（Cloudflare Workers KV）

| プラン | ストレージ上限 | 読み取り/日 | 書き込み/日 |
|-------|--------------|-----------|-----------|
| 無料 | 1GB | 100,000 | 1,000 |
| Paid | 無制限 | 10,000,000 | 1,000,000 |

### 現在の使用量

- **games-data**: 約100MB
- **reviews キャッシュ**: 約5MB（想定）
- **合計**: 約105MB
- **余裕**: 1GB制限に対し、**約90%の余裕あり**

### コスト試算（無料プランの場合）

- **読み取り**: キャッシュヒット時のみ → 1日あたり約10,000回（制限内）
- **書き込み**: キャッシュミス時のみ → 1日あたり約100回（制限内）
- **Pages Functions実行**: 100,000リクエスト/月（無料枠内）

**結論**: 無料プランで十分運用可能

---

## パフォーマンス最適化

### 1. Cache API活用

- エッジサーバーでキャッシュ（低レイテンシ）
- TTL: 1時間
- グローバルに分散

### 2. KVストレージ活用

- Cache API期限切れ時のバックアップ
- TTL: 24時間
- 長期キャッシュ

### 3. レスポンス圧縮

- Pages Functionsが自動的にgzip/brotli圧縮
- データ転送量削減

### 4. 遅延読み込み

- レビューモーダルを開いた時のみAPIリクエスト
- 初回ページロードに影響なし

---

## エラーハンドリング

### 1. Steam API障害時

```typescript
if (!steamResponse.ok) {
  // フォールバック: 既存のreviewScoreのみ表示
  return new Response(JSON.stringify({
    error: 'Steam API unavailable',
    fallback: true,
    reviewScore: game.reviewScore // 既存データ
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}
```

### 2. レート制限エラー（429）

```typescript
if (steamResponse.status === 429) {
  // KVにキャッシュされたデータを返す（古くても許容）
  const cached = await env.GSV_REVIEWS.get(kvKey, 'json');
  if (cached) {
    return new Response(JSON.stringify(cached.data), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
```

### 3. フロントエンドでのエラー表示

```javascript
if (!reviews) {
  return (
    <div className="error-message">
      <p>{t('reviews.error', locale)}</p>
      <p className="text-sm">{t('reviews.tryAgainLater', locale)}</p>
    </div>
  );
}
```

---

## セキュリティ考慮事項

### 1. CORS設定

- `Origin`ヘッダーを検証
- 許可されたオリジンのみ許可
- `OPTIONS`プリフライトリクエストに対応

### 2. レート制限

- Pages Functions側でリクエスト数を監視
- 過度なリクエストをブロック

### 3. データサニタイゼーション

- レビュー本文のXSS対策（React自動エスケープ）
- HTMLタグの削除

---

## 監視とログ

### 1. Pages Functionsログ

```typescript
console.log(`Cache HIT for appid: ${appid}`);
console.log(`KV HIT for appid: ${appid}`);
console.log(`Fetching from Steam API for appid: ${appid}`);
```

### 2. キャッシュヒット率の監視

- Cloudflare Analytics でキャッシュヒット率を確認
- 目標: 90%以上

### 3. エラーログ

```typescript
console.error('Error fetching reviews:', error);
```

---

## 既存実装との整合性

### 1. 既存のreviewScore機能

- **現在**: `steam_client.py` で `reviewScore` を取得し、games.jsonに保存
- **レビュー機能追加後**:
  - `reviewScore` は引き続き表示（軽量・高速）
  - 詳細レビューは別モーダルで表示（オンデマンド）

### 2. 既存のAPI構造

- **games-data API**: 変更なし
- **新規API追加**: `/api/reviews/[appid]` を追加

### 3. フロントエンドコンポーネント

- **GameCard**: レビューボタン追加
- **ReviewsModal**: 新規コンポーネント
- 既存機能への影響なし

---

## 今後の拡張案

### 1. ページネーション

- `cursor` パラメータを使用して次ページを取得
- 「もっと見る」ボタンで追加読み込み

### 2. フィルタリング機能

- 言語フィルター
- 評価フィルター（推奨のみ/非推奨のみ）
- 期間フィルター（最近30日など）

### 3. ソート機能

- 参考になった順
- 新しい順
- プレイ時間順

### 4. レビュー統計

- 評価分布グラフ
- プレイ時間別の評価傾向

---

## 参考情報

### Steam API ドキュメント

- **Store API**: https://partner.steamgames.com/doc/webapi_overview
- **Reviews Endpoint**: `https://store.steampowered.com/appreviews/{appid}`

### Cloudflare ドキュメント

- **Pages Functions**: https://developers.cloudflare.com/pages/functions/
- **Workers KV**: https://developers.cloudflare.com/kv/
- **Cache API**: https://developers.cloudflare.com/workers/runtime-apis/cache/

### 既存実装参照

- **Steam APIクライアント**: `updater/steam_client.py`
- **レビュースコア取得**: `steam_client.py` の `_extract_review_score()` メソッド
- **既存API**: `app/functions/api/games-data.ts`

---

## まとめ

### 推奨実装方法

**Cloudflare Pages Functions + Cache API + KV のハイブリッドキャッシュ**

### 主要な利点

1. ✅ CORS問題を回避
2. ✅ リアルタイムデータ取得可能
3. ✅ キャッシュによりレート制限を回避（キャッシュヒット率90%目標）
4. ✅ 既存アーキテクチャとの整合性
5. ✅ 無料プランで運用可能
6. ✅ スケーラブル

### 実装優先度

1. **Phase 1**: Pages Function作成（`/api/reviews/[appid].ts`）
2. **Phase 2**: KV Namespace作成（`GSV_REVIEWS`）
3. **Phase 3**: フロントエンド実装（`ReviewsModal.jsx`、`reviews.js`）
4. **Phase 4**: GameCardへの統合

### 想定工数

- **Phase 1-2**: 2-3時間（Pages Function + KV設定）
- **Phase 3**: 3-4時間（UI実装 + 翻訳）
- **Phase 4**: 1時間（統合とテスト）
- **合計**: 約1日

---

**ドキュメント作成日**: 2025-01-31
**最終更新日**: 2025-01-31
**ステータス**: 保留中（実装待機）
