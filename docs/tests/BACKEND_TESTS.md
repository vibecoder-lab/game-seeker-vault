# バックエンドテストケース（Python）

## 📋 概要

このドキュメントは、Game Seeker VaultのPythonデータパイプラインの自動テストケースを定義します。

**対象**: `updater/` 配下のすべてのPythonモジュール

**テストフレームワーク**: pytest + pytest-mock + requests-mock

**優先テスト対象**:
1. Steam API連携
2. ITAD API連携
3. データ変換・構築ロジック
4. Cloudflare KV連携

---

## 🎯 テストカテゴリ

### 1. Steam API クライアントテスト
### 2. ITAD API クライアントテスト
### 3. ゲームデータ構築テスト
### 4. KVヘルパーテスト

---

## 🌐 1. Steam API クライアントテスト

### BE-STEAM-001: アプリ一覧取得

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- requests-mockが設定されている

**テスト内容**
- Steam API `/ISteamApps/GetAppList/v2/` から全アプリIDを取得
- レスポンスをパースして辞書形式に変換

**期待結果（正常系）**
- 10万件以上のアプリID辞書が返される
- 各エントリに `appid` と `name` が含まれる

**異常系**
- ネットワークエラー時にリトライ（最大3回）
- レスポンスが不正な場合は空辞書を返す

**実装例**

```python
# updater/tests/test_steam_client.py
import pytest
import requests_mock
from steam_client import SteamClient

@pytest.fixture
def steam_client():
    return SteamClient()

def test_get_app_list_success(steam_client):
    """BE-STEAM-001: 正常系 - アプリ一覧取得成功"""
    # Arrange
    mock_response = {
        "applist": {
            "apps": [
                {"appid": 440, "name": "Team Fortress 2"},
                {"appid": 570, "name": "Dota 2"},
            ]
        }
    }
    
    with requests_mock.Mocker() as m:
        m.get(
            'https://api.steampowered.com/ISteamApps/GetAppList/v2/',
            json=mock_response
        )
        
        # Act
        result = steam_client.get_app_list()
        
        # Assert
        assert len(result) == 2
        assert result[440] == "Team Fortress 2"
        assert result[570] == "Dota 2"

def test_get_app_list_network_error(steam_client):
    """BE-STEAM-001: 異常系 - ネットワークエラー"""
    # Arrange
    with requests_mock.Mocker() as m:
        m.get(
            'https://api.steampowered.com/ISteamApps/GetAppList/v2/',
            exc=requests.exceptions.ConnectionError
        )
        
        # Act & Assert
        with pytest.raises(requests.exceptions.ConnectionError):
            steam_client.get_app_list()
```

---

### BE-STEAM-002: ゲーム詳細取得（日本）

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- 有効なSteam AppIDが存在

**テスト内容**
- `/api/appdetails?appids={appid}&cc=jp&l=japanese` からゲーム詳細を取得
- 日本語タイトル、価格、ジャンル、プラットフォームを抽出

**期待結果（正常系）**
- ゲーム詳細辞書が返される
- 必須フィールド: `name`, `price`, `genres`, `platforms`

**異常系**
- AppIDが存在しない場合: None を返す
- APIレート制限: 429エラー時に3秒待機してリトライ

**実装例**

```python
def test_get_game_details_jp_success(steam_client):
    """BE-STEAM-002: 正常系 - 日本のゲーム詳細取得"""
    # Arrange
    mock_response = {
        "123456": {
            "success": True,
            "data": {
                "name": "テストゲーム",
                "price_overview": {
                    "final": 2550,
                    "currency": "JPY"
                },
                "genres": [{"description": "Action"}],
                "platforms": {"windows": True, "mac": False}
            }
        }
    }
    
    with requests_mock.Mocker() as m:
        m.get(
            'https://store.steampowered.com/api/appdetails',
            json=mock_response
        )
        
        # Act
        result = steam_client.get_game_details("123456", cc="jp", lang="japanese")
        
        # Assert
        assert result is not None
        assert result["name"] == "テストゲーム"
        assert result["price"] == 2550
        assert result["genres"] == ["Action"]

def test_get_game_details_rate_limit(steam_client):
    """BE-STEAM-002: 異常系 - レート制限"""
    # Arrange
    with requests_mock.Mocker() as m:
        m.get(
            'https://store.steampowered.com/api/appdetails',
            status_code=429
        )
        
        # Act & Assert
        with pytest.raises(Exception):
            steam_client.get_game_details("123456", cc="jp", lang="japanese")
```

---

### BE-STEAM-003: ゲーム詳細取得（アメリカ）

**優先度**: High
**ステータス**: ⬜ 未実装

**テスト内容**
- `/api/appdetails?appids={appid}&cc=us&l=english` からゲーム詳細を取得
- 英語タイトル、USD価格を抽出

**期待結果（正常系）**
- 英語のゲーム詳細が返される
- 価格がUSD

**実装例**

```python
def test_get_game_details_us_success(steam_client):
    """BE-STEAM-003: 正常系 - アメリカのゲーム詳細取得"""
    # Arrange
    mock_response = {
        "123456": {
            "success": True,
            "data": {
                "name": "Test Game",
                "price_overview": {
                    "final": 1999,
                    "currency": "USD"
                }
            }
        }
    }
    
    with requests_mock.Mocker() as m:
        m.get(
            'https://store.steampowered.com/api/appdetails',
            json=mock_response
        )
        
        # Act
        result = steam_client.get_game_details("123456", cc="us", lang="english")
        
        # Assert
        assert result["name"] == "Test Game"
        assert result["price"] == 19.99  # セント→ドル変換
```

---

## 💰 2. ITAD API クライアントテスト

### BE-ITAD-001: ゲームIDマッピング取得

**優先度**: High
**ステータス**: ⬜ 未実装

**前提条件**
- ITAD API キーが設定されている

**テスト内容**
- ITAD APIでSteam AppID → ITAD IDのマッピングを取得

**期待結果（正常系）**
- マッピング辞書が返される
- `{steam_appid: itad_plain}`

**異常系**
- APIキーが無効: 401エラー
- ゲームが見つからない: 空文字列を返す

**実装例**

```python
# updater/tests/test_itad_client.py
import pytest
import requests_mock
from itad_client import ITADClient

@pytest.fixture
def itad_client():
    return ITADClient(api_key="test_api_key")

def test_get_id_mapping_success(itad_client):
    """BE-ITAD-001: 正常系 - IDマッピング取得"""
    # Arrange
    mock_response = {
        "data": {
            "found": True,
            "plain": "testgame"
        }
    }
    
    with requests_mock.Mocker() as m:
        m.get(
            'https://api.isthereanydeal.com/v02/game/plain/',
            json=mock_response
        )
        
        # Act
        result = itad_client.get_plain_id("app/123456")
        
        # Assert
        assert result == "testgame"

def test_get_id_mapping_not_found(itad_client):
    """BE-ITAD-001: 異常系 - ゲームが見つからない"""
    # Arrange
    mock_response = {"data": {"found": False}}
    
    with requests_mock.Mocker() as m:
        m.get(
            'https://api.isthereanydeal.com/v02/game/plain/',
            json=mock_response
        )
        
        # Act
        result = itad_client.get_plain_id("app/999999")
        
        # Assert
        assert result == ""
```

---

### BE-ITAD-002: 価格情報取得（日本円）

**優先度**: High
**ステータス**: ⬜ 未実装

**テスト内容**
- ITAD APIで現在価格と最安値を取得（JPY）

**期待結果（正常系）**
- 価格辞書が返される
- `price`, `storeLow`, `historicalLow`

**実装例**

```python
def test_get_price_jpy_success(itad_client):
    """BE-ITAD-002: 正常系 - 日本円価格取得"""
    # Arrange
    mock_response = {
        "data": {
            "testgame": {
                "price": 2550,
                "storeLow": 1990,
                "historicalLow": 1500
            }
        }
    }
    
    with requests_mock.Mocker() as m:
        m.get(
            'https://api.isthereanydeal.com/v01/game/prices/',
            json=mock_response
        )
        
        # Act
        result = itad_client.get_prices("testgame", country="JP")
        
        # Assert
        assert result["price"] == 2550
        assert result["storeLow"] == 1990
        assert result["historicalLow"] == 1500
```

---

### BE-ITAD-003: 価格情報取得（USD）

**優先度**: High
**ステータス**: ⬜ 未実装

**テスト内容**
- ITAD APIで現在価格と最安値を取得（USD）

**期待結果（正常系）**
- USD価格辞書が返される

**実装例**

```python
def test_get_price_usd_success(itad_client):
    """BE-ITAD-003: 正常系 - USD価格取得"""
    # Arrange
    mock_response = {
        "data": {
            "testgame": {
                "price": 19.99,
                "storeLow": 14.99,
                "historicalLow": 9.99
            }
        }
    }
    
    with requests_mock.Mocker() as m:
        m.get(
            'https://api.isthereanydeal.com/v01/game/prices/',
            json=mock_response
        )
        
        # Act
        result = itad_client.get_prices("testgame", country="US")
        
        # Assert
        assert result["price"] == 19.99
```

---

## 🔧 3. ゲームデータ構築テスト

### BE-BUILD-001: ゲームデータの統合

**優先度**: High
**ステータス**: ⬜ 未実装

**テスト内容**
- Steam APIとITAD APIのデータを統合
- 必須フィールドを含む完全なゲームオブジェクトを生成

**期待結果（正常系）**
- 統合されたゲームデータ辞書
- JPYとUSDの両方の価格情報を含む

**実装例**

```python
# updater/tests/test_game_data_builder.py
import pytest
from game_data_builder import GameDataBuilder

@pytest.fixture
def builder():
    return GameDataBuilder()

def test_build_game_data_success(builder, mocker):
    """BE-BUILD-001: 正常系 - ゲームデータ統合"""
    # Arrange
    mock_steam_data = {
        "name": "Test Game",
        "genres": ["Action"],
        "platforms": {"windows": True}
    }
    mock_itad_jpy = {"price": 2550, "storeLow": 1990}
    mock_itad_usd = {"price": 19.99, "storeLow": 14.99}
    
    # Act
    result = builder.build_game_data(
        appid="123456",
        steam_data=mock_steam_data,
        itad_jpy=mock_itad_jpy,
        itad_usd=mock_itad_usd
    )
    
    # Assert
    assert result["id"] == "123456"
    assert result["title"] == "Test Game"
    assert result["deal"]["JPY"]["price"] == 2550
    assert result["deal"]["USD"]["price"] == 19.99
    assert result["genres"] == ["Action"]
```

---

### BE-BUILD-002: フィルタリング（価格範囲）

**優先度**: High
**ステータス**: ⬜ 未実装

**テスト内容**
- 3,000円以下のゲームのみフィルタリング

**期待結果（正常系）**
- 3,000円を超えるゲームは除外される

**実装例**

```python
def test_filter_by_price_range(builder):
    """BE-BUILD-002: 正常系 - 価格範囲フィルタ"""
    # Arrange
    games = [
        {"id": "1", "deal": {"JPY": {"price": 2000}}},
        {"id": "2", "deal": {"JPY": {"price": 4000}}},
        {"id": "3", "deal": {"JPY": {"price": 1000}}},
    ]
    
    # Act
    result = builder.filter_by_price(games, max_price=3000)
    
    # Assert
    assert len(result) == 2
    assert result[0]["id"] == "1"
    assert result[1]["id"] == "3"
```

---

### BE-BUILD-003: フィルタリング（レビュースコア）

**優先度**: High
**ステータス**: ⬜ 未実装

**テスト内容**
- レビュー総数100以上、「非常に好評」以上のゲームのみフィルタリング

**期待結果（正常系）**
- 条件を満たすゲームのみが返される

**実装例**

```python
def test_filter_by_review_score(builder):
    """BE-BUILD-003: 正常系 - レビュースコアフィルタ"""
    # Arrange
    games = [
        {"id": "1", "reviewScore": "Very Positive", "reviewCount": 500},
        {"id": "2", "reviewScore": "Mixed", "reviewCount": 200},
        {"id": "3", "reviewScore": "Overwhelmingly Positive", "reviewCount": 1000},
    ]
    
    # Act
    result = builder.filter_by_review(games, min_count=100, min_score="Very Positive")
    
    # Assert
    assert len(result) == 2
    assert result[0]["id"] == "1"
    assert result[1]["id"] == "3"
```

---

## ☁️ 4. KVヘルパーテスト

### BE-KV-001: KVへのデータアップロード

**優先度**: High
**ステータス**: ⬜ 未実装

**テスト内容**
- Cloudflare KVにgames-dataをアップロード

**期待結果（正常系）**
- 正常にアップロードされる
- レスポンスステータス200

**実装例**

```python
# updater/tests/test_kv_helper.py
import pytest
import requests_mock
from kv_helper import KVHelper

@pytest.fixture
def kv_helper():
    return KVHelper(
        account_id="test_account",
        namespace_id="test_namespace",
        api_token="test_token"
    )

def test_upload_games_data_success(kv_helper):
    """BE-KV-001: 正常系 - KVアップロード成功"""
    # Arrange
    games_data = [{"id": "123", "title": "Test Game"}]
    
    with requests_mock.Mocker() as m:
        m.put(
            'https://api.cloudflare.com/client/v4/accounts/test_account/storage/kv/namespaces/test_namespace/values/games-data',
            json={"success": True}
        )
        
        # Act
        result = kv_helper.upload_games_data(games_data)
        
        # Assert
        assert result is True
```

---

## 📊 テスト実装状況サマリー

### Steam APIクライアント
- [ ] BE-STEAM-001: アプリ一覧取得
- [ ] BE-STEAM-002: ゲーム詳細取得（日本）
- [ ] BE-STEAM-003: ゲーム詳細取得（アメリカ）

### ITAD APIクライアント
- [ ] BE-ITAD-001: ゲームIDマッピング取得
- [ ] BE-ITAD-002: 価格情報取得（日本円）
- [ ] BE-ITAD-003: 価格情報取得（USD）

### ゲームデータ構築
- [ ] BE-BUILD-001: ゲームデータの統合
- [ ] BE-BUILD-002: フィルタリング（価格範囲）
- [ ] BE-BUILD-003: フィルタリング（レビュースコア）

### KVヘルパー
- [ ] BE-KV-001: KVへのデータアップロード

---

## 🚀 テスト実行方法

```bash
cd updater

# すべてのテスト実行
pytest

# カバレッジ付き
pytest --cov=. --cov-report=html

# 特定のテストのみ
pytest tests/test_steam_client.py

# 詳細出力
pytest -v -s
```

---

## 📚 参考資料

- [pytest Documentation](https://docs.pytest.org/)
- [requests-mock Documentation](https://requests-mock.readthedocs.io/)
- [Steam Web API Documentation](https://steamapi.xpaw.me/)
- [ITAD API Documentation](https://docs.isthereanydeal.com/)
