# バッチ処理 テストケース

## 概要

updater配下のバッチ処理スクリプトのテストケース集です。

**テスト環境**:
- Python 3.13+
- ITAD API Key 必須
- ローカル環境（`--kv` オプションなし）

---

## 事前準備

### テストデータ準備

```bash
# テスト用ゲームタイトルリスト作成
cat > updater/data/refs/game_title_list.txt <<EOF
Portal 2
Vampire Survivors
Hades
EOF

# テスト用削除リスト作成
cat > updater/data/refs/delete_appid_list.txt <<EOF
12345
67890
EOF
```

---

## 基本機能テスト

### TC-B001: 環境確認

**目的**: 必要な環境が揃っているか

**手順**:
```bash
python3 --version
pip list | grep requests
```

**期待結果**:
- ✅ Python 3.13 以上
- ✅ `requests` パッケージがインストール済み

---

### TC-B002: ヘルプ表示

**目的**: スクリプトが正常に動作するか

**手順**:
```bash
cd updater
python3 main.py --help 2>&1 | head -20
```

**期待結果**:
- ✅ Usage が表示される
- ✅ エラーが出ない

---

## 差分更新テスト

### TC-B003: 差分更新（ドライラン）

**目的**: 差分更新が正常に実行されるか

**事前条件**:
- `updater/data/current/games.json` が存在する
- `updater/data/current/id-map.json` が存在する

**手順**:
```bash
cd updater
python3 main.py <ITAD_API_KEY>
```

**期待結果**:
- ✅ `Phase 1: Fetching ITAD deal data` ログが出力される
- ✅ `ITAD batch fetch (JPY) complete: XXXX deals retrieved`
- ✅ `ITAD batch fetch (USD) complete: XXXX deals retrieved`
- ✅ `Phase 2: Building game data...`
- ✅ `✓ KV Update Success` （ローカルファイル更新）
- ✅ `updater/data/current/games.json` が更新される

**ログ確認**:
```bash
tail -100 updater/log/rebuild_*.log
```

**確認ポイント**:
- JPY と USD の取得件数が同じ
- エラーがない

---

### TC-B004: USD価格取得確認

**目的**: USD価格が正しく取得されているか

**手順**:
```bash
# 差分更新実行後
jq '.games[0].deal' updater/data/current/games.json
```

**期待結果**:
```json
{
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
```

**確認ポイント**:
- ✅ `deal.JPY` と `deal.USD` の両方が存在
- ✅ USD の価格が 0 以外（無料ゲーム除く）

---

### TC-B005: ログでUSD取得確認

**目的**: ログからUSD取得を確認できるか

**手順**:
```bash
grep "USD" updater/log/rebuild_*.log | head -20
```

**期待結果**:
```
  → ITAD batch fetch (USD) complete: 8523 deals retrieved
  → Constructed USD deal from Steam API (no ITAD): price=17, regular=34, cut=50
```

**確認ポイント**:
- ✅ `ITAD batch fetch (USD)` が実行されている
- ✅ 取得件数が JPY と同じ

---

## 新規追加テスト

### TC-B006: 新規追加（少量）

**目的**: 新規ゲームを追加できるか

**事前準備**:
```bash
# 3件のテストタイトル
cat > updater/data/refs/game_title_list.txt <<EOF
Portal 2
Vampire Survivors
Hades
EOF
```

**手順**:
```bash
cd updater
python3 main.py <ITAD_API_KEY> --append
```

**期待結果**:
- ✅ `=== Processing Mode: Add new titles`
- ✅ `Normal mode: 3 games (< 1000)`
- ✅ `Fetching ITAD deals for 3 new games...`
- ✅ `ITAD batch fetch (JPY) complete: 3 deals retrieved`
- ✅ `ITAD batch fetch (USD) complete: 3 deals retrieved`
- ✅ `[1/3] Processing App ID: XXXXX...`
- ✅ `✓ Updated successfully`
- ✅ 既存 `games.json` に3件追加される

**追加確認**:
```bash
# 追加前後のゲーム数比較
jq '.games | length' updater/data/current/games.json
```

---

### TC-B007: バッチモード（1000件以上）

**目的**: 1000件以上の追加でバッチモードになるか

**手順**:
```bash
# 1000件のタイトルリストを用意（実際にはスキップ推奨）
# python3 main.py <ITAD_API_KEY> --append
```

**期待結果**:
- ✅ `Batch mode enabled: 1234 games (>= 1000)`
- ✅ チェックポイントファイルが作成される
- ✅ `updater/data/batch/batch_in_progress.lock` 生成

**中断テスト**:
1. Ctrl+C で中断
2. 再度実行
3. チェックポイントから再開されることを確認

---

## 削除テスト

### TC-B008: ゲーム削除

**目的**: 指定したゲームを削除できるか

**事前準備**:
```bash
# 実在するApp IDを記載
cat > updater/data/refs/delete_appid_list.txt <<EOF
730
440
EOF
```

**手順**:
```bash
cd updater
python3 main.py <ITAD_API_KEY> --delete
```

**期待結果**:
- ✅ `=== Delete Games Mode ===`
- ✅ `Delete targets: 2 appids`
- ✅ `Deleted from games-data: 2 games`
- ✅ `Deleted from id-map: 2 entries`
- ✅ 該当ゲームが `games.json` から削除される

**削除確認**:
```bash
# 削除後に該当App IDが存在しないことを確認
jq '.games[] | select(.id == "730")' updater/data/current/games.json
# 出力なし（削除成功）
```

---

## 地域指定テスト

### TC-B009: 地域カスタム指定

**目的**: カスタム地域を指定できるか

**手順**:
```bash
cd updater
python3 main.py <ITAD_API_KEY> --regions JP,US,UK,EU
```

**期待結果**:
- ✅ `Fetch regions: JP, US, UK, EU`
- ✅ Steam APIが4地域分呼ばれる
- ✅ 処理時間が増加する（地域数に比例）

**注**: 現在のデータ構造は JPY/USD のみ対応。UK/EU は取得するが保存されない。

---

## エラーハンドリングテスト

### TC-B010: ITAD APIキー無効

**目的**: APIキー無効時にエラーハンドリングされるか

**手順**:
```bash
cd updater
python3 main.py INVALID_API_KEY
```

**期待結果**:
- ✅ `ITAD API failed to retrieve any deal data`
- ✅ `Exception: ITAD API batch fetch returned 0 results`
- ✅ 処理が中断される

---

### TC-B011: Steam APIレート制限

**目的**: レート制限時にリトライされるか

**確認方法**:
```bash
# ログでリトライを確認
grep "Rate limited" updater/log/rebuild_*.log
```

**期待結果**:
```
Rate limited (429), retrying after 2s (attempt 1/3)
Rate limited (429), retrying after 4s (attempt 2/3)
```

**確認ポイント**:
- ✅ 指数バックオフでリトライ
- ✅ 最大3回リトライ

---

### TC-B012: ネットワークエラー

**目的**: ネットワーク断時の挙動

**手順**:
1. ネットワークを切断
2. バッチ処理実行

**期待結果**:
- ✅ `Request failed after 3 attempts`
- ✅ 処理が中断される

---

## データ整合性テスト

### TC-B013: games.json構造検証

**目的**: 生成されたJSONが正しい構造か

**手順**:
```bash
# 構造確認
jq '.meta' updater/data/current/games.json
jq '.games[0] | keys' updater/data/current/games.json
```

**期待結果**:
```json
// meta
{
  "last_updated": "2025-01-25T10:30:00Z",
  "data_version": "1.0.0",
  "source": {
    "steam": true,
    "itad": true
  },
  "build_id": "...",
  "record_count": 10762
}

// games[0] のキー
[
  "id",
  "itadId",
  "title",
  "storeUrl",
  "imageUrl",
  "movies",
  "reviewScore",
  "deal",
  "genres",
  "tags",
  "releaseDate",
  "developers",
  "publishers",
  "platforms",
  "supportedLanguages"
]
```

---

### TC-B014: id-map.json構造検証

**目的**: id-map.jsonが正しい構造か

**手順**:
```bash
jq '.[0]' updater/data/current/id-map.json
```

**期待結果**:
```json
{
  "id": "730",
  "itadId": "018d937f-7851-7004-b780-3f657a301f9a"
}
```

---

### TC-B015: 重複チェック

**目的**: ゲームIDが重複していないか

**手順**:
```bash
# 重複チェック
jq '[.games[].id] | group_by(.) | map(select(length > 1))' updater/data/current/games.json
```

**期待結果**:
```json
[]
```

**確認ポイント**:
- ✅ 空配列（重複なし）

---

## パフォーマンステスト

### TC-B016: 処理時間計測

**目的**: バッチ処理の実行時間を計測

**手順**:
```bash
time python3 main.py <ITAD_API_KEY>
```

**期待結果**:
- ✅ 差分更新: 5-15分（変更ゲーム数による）
- ✅ 新規追加（3件）: 1-2分
- ✅ フルリビルド（10,000件）: 2-4時間

---

## GitHub Actions連携テスト

### TC-B017: GitHub Actions環境変数

**目的**: GitHub Actions環境でKVが使用されるか

**手順**:
```bash
# ローカルで環境変数を設定してテスト
export GITHUB_ACTIONS=true
export CLOUDFLARE_API_TOKEN=test
export CLOUDFLARE_ACCOUNT_ID=test
export KV_NAMESPACE_ID=test

python3 main.py <ITAD_API_KEY>
```

**期待結果**:
- ✅ `Environment: Github Actions (KV mode)`
- ✅ KVへのアップロード試行（トークンが無効なので失敗）

---

## テスト実行チェックリスト

### リリース前チェック

- [ ] TC-B001: 環境確認
- [ ] TC-B003: 差分更新
- [ ] TC-B004: USD価格取得確認
- [ ] TC-B005: ログでUSD取得確認
- [ ] TC-B006: 新規追加（少量）
- [ ] TC-B013: games.json構造検証
- [ ] TC-B014: id-map.json構造検証

### フルテスト（メジャーリリース前）

- [ ] 全テストケース実行

---

## トラブルシューティング

### テスト失敗時の確認項目

1. **ログファイル確認**
   ```bash
   tail -200 updater/log/rebuild_*.log
   ```

2. **API疎通確認**
   ```bash
   # ITAD API
   curl "https://api.isthereanydeal.com/games/lookup/v1?key=YOUR_KEY&appid=730"

   # Steam API
   curl "https://store.steampowered.com/api/appdetails?appids=730"
   ```

3. **ファイル権限確認**
   ```bash
   ls -la updater/data/current/
   ```

---

## 関連ドキュメント

- [../BATCH_PROCESSING.md](../BATCH_PROCESSING.md) - バッチ処理ガイド
- [../DATA_STRUCTURE.md](../DATA_STRUCTURE.md) - データ構造仕様
