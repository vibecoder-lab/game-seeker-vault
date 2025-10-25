# API テストケース

## 概要

Cloudflare Pages Functions APIエンドポイントのテストケース集です。

**テスト環境**:
- ローカル: `npm run dev` (Vite + Wrangler)
- 本番: Cloudflare Pages デプロイ後

---

## エンドポイント一覧

| エンドポイント | メソッド | 用途 |
|---------------|---------|------|
| `/api/games-data` | GET | ゲームデータ取得 |
| `/api/detect-locale` | GET | ロケール検出 |

---

## `/api/games-data` テスト

### TC-A001: 正常レスポンス

**目的**: ゲームデータを正常に取得できるか

**手順**:
```bash
curl http://localhost:5173/api/games-data | jq '.' | head -50
```

**期待結果**:
```json
{
  "success": true,
  "data": {
    "meta": {
      "last_updated": "2025-01-25T10:30:00Z",
      "data_version": "1.0.0",
      "source": {
        "steam": true,
        "itad": true
      },
      "build_id": "...",
      "record_count": 10762
    },
    "games": [
      {
        "id": "730",
        "title": "Counter-Strike 2",
        "deal": {
          "JPY": {...},
          "USD": {...}
        },
        ...
      }
    ]
  }
}
```

**確認ポイント**:
- ✅ `success: true`
- ✅ `data.meta` が存在
- ✅ `data.games` が配列
- ✅ ゲーム数が 10,000件程度

---

### TC-A002: レスポンスヘッダー

**目的**: 適切なHTTPヘッダーが返されるか

**手順**:
```bash
curl -I http://localhost:5173/api/games-data
```

**期待結果**:
```
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=3600
```

**確認ポイント**:
- ✅ `Content-Type: application/json`
- ✅ キャッシュヘッダーが適切

---

### TC-A003: USD価格データ確認

**目的**: USD価格が含まれているか

**手順**:
```bash
curl http://localhost:5173/api/games-data | jq '.data.games[0].deal.USD'
```

**期待結果**:
```json
{
  "price": 17,
  "regular": 34,
  "cut": 50,
  "storeLow": 10
}
```

**確認ポイント**:
- ✅ `deal.USD` が存在
- ✅ 4つのフィールド（price, regular, cut, storeLow）

---

### TC-A004: エラーハンドリング（KV取得失敗）

**目的**: KV取得失敗時にエラーレスポンスが返るか

**手順**:
```bash
# KVが利用できない環境で実行
# または、意図的にKV Bindingを無効化
```

**期待結果**:
```json
{
  "success": false,
  "data": null,
  "error": "Failed to fetch games data from KV"
}
```

**確認ポイント**:
- ✅ `success: false`
- ✅ `error` メッセージが含まれる
- ✅ HTTPステータス: 500

---

### TC-A005: レスポンスサイズ

**目的**: レスポンスサイズが適切か

**手順**:
```bash
curl http://localhost:5173/api/games-data -w "%{size_download}\n" -o /dev/null -s
```

**期待結果**:
- ✅ 3-5MB程度（gzip圧縮前）
- ✅ 1-2MB程度（gzip圧縮後）

**確認ポイント**:
- サイズが大きすぎない（Cloudflare Pages Functions の制限内）

---

## `/api/detect-locale` テスト

### TC-A006: 正常レスポンス

**目的**: ロケール情報を正常に取得できるか

**手順**:
```bash
curl http://localhost:5173/api/detect-locale | jq '.'
```

**期待結果**:
```json
{
  "browserLang": "ja",
  "suggestedLang": "ja",
  "country": "JP"
}
```

**確認ポイント**:
- ✅ `browserLang` が存在
- ✅ `suggestedLang` が存在
- ✅ `country` が存在（Cloudflare Geo利用時）

---

### TC-A007: Accept-Languageヘッダー

**目的**: ブラウザ言語を正しく検出できるか

**手順**:
```bash
# 日本語
curl -H "Accept-Language: ja-JP,ja;q=0.9" http://localhost:5173/api/detect-locale | jq '.browserLang'

# 英語
curl -H "Accept-Language: en-US,en;q=0.9" http://localhost:5173/api/detect-locale | jq '.browserLang'
```

**期待結果**:
- ✅ 日本語リクエスト: `"ja"`
- ✅ 英語リクエスト: `"en"`

---

### TC-A008: Cloudflare Geo情報

**目的**: Cloudflare Geoから国情報を取得できるか

**手順**:
```bash
# 本番環境でテスト（ローカルでは取得できない）
curl https://your-site.pages.dev/api/detect-locale | jq '.country'
```

**期待結果**:
- ✅ 日本からアクセス: `"JP"`
- ✅ 米国からアクセス: `"US"`

**ローカル環境**:
- `country` は `undefined` または存在しない

---

### TC-A009: レスポンスヘッダー

**目的**: 適切なHTTPヘッダーが返されるか

**手順**:
```bash
curl -I http://localhost:5173/api/detect-locale
```

**期待結果**:
```
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-cache
```

**確認ポイント**:
- ✅ `Content-Type: application/json`
- ✅ キャッシュなし（ユーザーごとに異なる）

---

## パフォーマンステスト

### TC-A010: レスポンスタイム（games-data）

**目的**: レスポンスが十分高速か

**手順**:
```bash
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:5173/api/games-data
```

**curl-format.txt**:
```
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_starttransfer:  %{time_starttransfer}\n
time_total:  %{time_total}\n
```

**期待結果**:
- ✅ ローカル: < 100ms
- ✅ 本番（初回）: < 500ms
- ✅ 本番（キャッシュ）: < 100ms

---

### TC-A011: 同時リクエスト

**目的**: 同時アクセスに耐えられるか

**手順**:
```bash
# 10並列リクエスト
seq 1 10 | xargs -P 10 -I {} curl -s http://localhost:5173/api/games-data -o /dev/null -w "%{http_code}\n"
```

**期待結果**:
```
200
200
200
...
```

**確認ポイント**:
- ✅ 全て 200 OK
- ✅ エラーなし

---

## セキュリティテスト

### TC-A012: CORS設定

**目的**: CORSヘッダーが適切か

**手順**:
```bash
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -I http://localhost:5173/api/games-data
```

**期待結果**:
```
Access-Control-Allow-Origin: *
```

**確認ポイント**:
- ✅ CORS許可されている（公開API）

---

### TC-A013: HTTPメソッド制限

**目的**: GET以外のメソッドが拒否されるか

**手順**:
```bash
# POST
curl -X POST http://localhost:5173/api/games-data

# PUT
curl -X PUT http://localhost:5173/api/games-data
```

**期待結果**:
- ✅ 405 Method Not Allowed
- または適切なエラーレスポンス

---

## エッジケーステスト

### TC-A014: データなし（空配列）

**目的**: ゲームデータが空の場合の挙動

**手順**:
```bash
# KVに空配列を保存した状態でテスト
```

**期待結果**:
```json
{
  "success": true,
  "data": {
    "meta": {...},
    "games": []
  }
}
```

**確認ポイント**:
- ✅ エラーにならない
- ✅ 空配列が返る

---

### TC-A015: 大量データ

**目的**: 100,000件のゲームでも動作するか

**手順**:
```bash
# テストデータを大量に生成（実際には不要）
```

**期待結果**:
- ✅ レスポンスが返る
- ✅ タイムアウトしない（Cloudflare Pages Functions 制限内）

---

## テスト実行チェックリスト

### ローカル開発時

- [ ] TC-A001: 正常レスポンス
- [ ] TC-A003: USD価格データ確認
- [ ] TC-A006: ロケール検出
- [ ] TC-A007: Accept-Languageヘッダー

### デプロイ前

- [ ] TC-A001: 正常レスポンス
- [ ] TC-A002: レスポンスヘッダー
- [ ] TC-A003: USD価格データ確認
- [ ] TC-A006: ロケール検出
- [ ] TC-A010: レスポンスタイム
- [ ] TC-A012: CORS設定

### 本番デプロイ後

- [ ] TC-A001: 正常レスポンス（本番環境）
- [ ] TC-A003: USD価格データ確認（本番環境）
- [ ] TC-A008: Cloudflare Geo情報
- [ ] TC-A010: レスポンスタイム（本番環境）

---

## 自動テストスクリプト

### 基本テストスクリプト

**`docs/tests/test-api.sh`**:

```bash
#!/bin/bash

BASE_URL="${1:-http://localhost:5173}"

echo "Testing API endpoints at $BASE_URL"
echo "===================================="

# TC-A001: games-data正常レスポンス
echo -n "TC-A001: /api/games-data ... "
RESPONSE=$(curl -s "$BASE_URL/api/games-data")
SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# TC-A003: USD価格確認
echo -n "TC-A003: USD price data ... "
USD=$(echo $RESPONSE | jq -r '.data.games[0].deal.USD')
if [ "$USD" != "null" ]; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# TC-A006: detect-locale
echo -n "TC-A006: /api/detect-locale ... "
LOCALE_RESPONSE=$(curl -s "$BASE_URL/api/detect-locale")
BROWSER_LANG=$(echo $LOCALE_RESPONSE | jq -r '.browserLang')
if [ "$BROWSER_LANG" != "null" ] && [ "$BROWSER_LANG" != "" ]; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

echo "===================================="
echo "Tests completed"
```

**使用方法**:
```bash
chmod +x docs/tests/test-api.sh

# ローカルテスト
./docs/tests/test-api.sh

# 本番テスト
./docs/tests/test-api.sh https://your-site.pages.dev
```

---

## 関連ドキュメント

- [../ARCHITECTURE.md](../ARCHITECTURE.md) - システム全体構成
- [../DATA_STRUCTURE.md](../DATA_STRUCTURE.md) - データ構造仕様
