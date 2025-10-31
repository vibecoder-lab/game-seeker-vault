# 動画再生機能 (Video Playback)

## 概要

このドキュメントは、Game Seeker Vaultの動画再生機能の実装詳細を説明します。

**対象読者**: この機能を理解・修正する開発者

---

## 目次

- [機能概要](#機能概要)
- [実装詳細](#実装詳細)
- [コンポーネント構成](#コンポーネント構成)
- [データ構造](#データ構造)
- [UI/UX仕様](#uiux仕様)
- [技術的な実装ポイント](#技術的な実装ポイント)
- [トラブルシューティング](#トラブルシューティング)

---

## 機能概要

### 主要機能

1. **ゲームトレーラー再生**
   - Steam APIから取得した動画データ（WebM/MP4）を再生
   - 複数動画がある場合は切り替え可能

2. **スクリーンショット表示**
   - 動画がない場合はスクリーンショットを表示

3. **動画リスト表示**
   - サムネイルをホバーで表示
   - 下100pxは動画コントロールエリアとして確保（ホバー反応なし）

4. **ビデオクリーンアップ**
   - モーダルclose時に動画を適切に停止・クリーンアップ

---

## 実装詳細

### ファイル構成

```
app/src/
├── components/
│   └── modals/
│       └── VideoModal.jsx    # 動画再生モーダル
└── main.jsx                  # VideoModalの呼び出し元
```

---

### VideoModal.jsx の実装

**場所**: [app/src/components/modals/VideoModal.jsx](../../app/src/components/modals/VideoModal.jsx)

**Props**:

```typescript
interface VideoModalProps {
  game: Game;                // ゲームオブジェクト
  theme: Theme;              // テーマオブジェクト
  isClosing: boolean;        // モーダルclose中フラグ
  onClose: () => void;       // close時のコールバック
}
```

**主要State**:

```javascript
const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);  // 選択中の動画インデックス
const [isHovered, setIsHovered] = useState(false);                // ホバー状態
const videoRef = useRef(null);                                    // video要素のref
const hoverAreaRef = useRef(null);                                // ホバー検出エリアのref
```

---

## コンポーネント構成

### 1. モーダル全体構造

```jsx
<div className="fixed inset-0 ...">  {/* 背景オーバーレイ */}
  <div className="modal-content">
    {/* ヘッダー */}
    <div className="header">
      <h2>{game.title}</h2>
      <button onClick={onClose}>×</button>
    </div>

    {/* コンテンツ */}
    <div className="content">
      {/* 動画プレーヤー or スクリーンショット */}
      {hasMovies ? <video /> : <img />}

      {/* 動画リストオーバーレイ */}
      {hasMovies && game.movies.length > 1 && (
        <>
          <div ref={hoverAreaRef} />  {/* ホバー検出エリア */}
          <div className="video-list">  {/* サムネイルリスト */}
            {game.movies.map((movie, index) => (
              <button onClick={() => setSelectedVideoIndex(index)}>
                <img src={movie.thumbnail} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  </div>
</div>
```

---

### 2. ビデオプレーヤー部分

```jsx
{hasMovies ? (
  <div className="aspect-video bg-black rounded-lg overflow-hidden">
    <video
      ref={videoRef}
      key={currentMovie.id}
      controls
      autoPlay
      className="w-full h-full"
      poster={currentMovie.thumbnail}
    >
      <source src={currentMovie.webm} type="video/webm" />
      <source src={currentMovie.mp4} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  </div>
) : hasScreenshot ? (
  <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
    <img
      src={currentScreenshot.full}
      alt={`${game.title} screenshot`}
      className="max-w-full max-h-full object-contain"
    />
  </div>
) : (
  <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
    <p className={theme.subText}>No media available</p>
  </div>
)}
```

**ポイント**:
- `key={currentMovie.id}` で動画切り替え時にvideo要素を再マウント
- `controls` で標準コントロールを表示
- `autoPlay` で自動再生
- `poster` でサムネイルを表示

---

### 3. 動画リストオーバーレイ

```jsx
{/* ホバー検出エリア（下100pxは除外） */}
<div
  ref={hoverAreaRef}
  className="absolute top-0 right-0 w-32 pointer-events-auto"
  style={{ height: 'calc(100% - 100px)' }}
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
/>

{/* 動画リストオーバーレイ（全体の高さ） */}
<div
  className={`absolute top-0 right-0 h-full w-32 flex flex-col gap-2 p-2 overflow-y-auto transition-opacity duration-200 bg-black bg-opacity-50 rounded-r-lg ${
    isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
  }`}
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
>
  {game.movies.map((movie, index) => (
    <button
      key={index}
      onClick={() => setSelectedVideoIndex(index)}
      className={`relative rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
        selectedVideoIndex === index
          ? 'border-blue-500'
          : `border-transparent ${theme.modalHover}`
      }`}
    >
      <img src={movie.thumbnail} alt={movie.name} className="w-full aspect-video object-cover" />
      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
        <svg>{/* Play icon */}</svg>
      </div>
    </button>
  ))}
</div>
```

**ポイント**:
- ホバー検出エリアは `height: calc(100% - 100px)` で下100pxを除外
- 動画リストオーバーレイは `h-full` で全体の高さを確保
- `isHovered` stateで表示/非表示を切り替え

---

### 4. ビデオクリーンアップ

```javascript
useEffect(() => {
  return () => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        videoRef.current.load();
      } catch (e) {
        // Ignore errors if element is already removed
      }
    }
  };
}, []);
```

**ポイント**:
- `useEffect` のクリーンアップ関数でビデオを停止
- `pause()` で再生停止
- `currentTime = 0` で先頭に戻す
- `load()` でリソース解放
- try-catch で要素が既に削除されている場合のエラーを無視

---

## データ構造

### Game.movies

```typescript
interface Movie {
  id: number;           // 動画ID
  name: string;         // 動画名
  thumbnail: string;    // サムネイルURL
  webm: string;         // WebM URL (480p)
  mp4: string;          // MP4 URL (480p)
}
```

**例**:

```json
{
  "movies": [
    {
      "id": 256712345,
      "name": "Trailer",
      "thumbnail": "https://steamcdn-a.akamaihd.net/steam/apps/256712345/movie.293x165.jpg",
      "webm": "https://steamcdn-a.akamaihd.net/steam/apps/256712345/movie480.webm",
      "mp4": "https://steamcdn-a.akamaihd.net/steam/apps/256712345/movie480.mp4"
    }
  ]
}
```

---

### Game.screenshot

```typescript
interface Screenshot {
  full: string;         // フルサイズURL
}
```

**例**:

```json
{
  "screenshot": {
    "full": "https://steamcdn-a.akamaihd.net/steam/apps/1794680/ss_abc123.1920x1080.jpg"
  }
}
```

---

## UI/UX仕様

### モーダル表示

**トリガー**:
- GameCardの動画アイコンクリック
- CollectionModalの動画アイコンクリック

**動作**:
1. VideoModalが表示される
2. 最初の動画が自動再生される
3. 複数動画がある場合、右側にサムネイルリストが表示される

---

### 動画切り替え

**操作**:
1. 右側エリア（下100pxを除く）にホバー
2. サムネイルリストが表示される
3. サムネイルをクリック
4. 選択した動画に切り替わる

**ホバーエリア**:
- 上部: 0px ~ (100% - 100px) → ホバー反応あり
- 下部: (100% - 100px) ~ 100% → ホバー反応なし（動画コントロールエリア）

---

### モーダルclose

**トリガー**:
- ×ボタンクリック
- 背景オーバーレイクリック

**動作**:
1. `isClosing` フラグが立つ
2. フェードアウトアニメーション（300ms）
3. ビデオクリーンアップ実行
4. モーダル削除

---

## 技術的な実装ポイント

### 1. 重複モーダル問題の解決

**問題**:
- 以前はmain.jsxとCollectionModal.jsx両方にVideoModalを配置
- 2つのVideoModalが同時に存在し、バックグラウンド再生が発生

**解決策**:
- main.jsxのVideoModalのみ使用
- CollectionModalからVideoModalを削除
- CollectionModalは`showVideoModal` propsで非表示化

**実装** ([app/src/components/modals/CollectionModal.jsx:514,517](../../app/src/components/modals/CollectionModal.jsx#L514)):

```javascript
// 背景オーバーレイ
<div className={`fixed inset-0 ${showVideoModal ? 'invisible' : ''}`}>

// モーダルコンテンツ
<div className={`modal-content ${showVideoModal ? 'invisible' : ''}`}>
```

---

### 2. ホバーエリアの分離

**問題**:
- 動画コントロールエリア（下100px）にもホバー反応してしまう
- コントロールバーをクリックできない

**解決策**:
- ホバー検出エリアと表示エリアを分離
- ホバー検出エリア: `height: calc(100% - 100px)`
- 表示エリア: `height: 100%`

**実装** ([app/src/components/modals/VideoModal.jsx:88-103](../../app/src/components/modals/VideoModal.jsx#L88-L103)):

```javascript
{/* ホバー検出エリア（下100pxは除外） */}
<div
  ref={hoverAreaRef}
  className="absolute top-0 right-0 w-32"
  style={{ height: 'calc(100% - 100px)' }}
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
/>

{/* 動画リストオーバーレイ（全体の高さ） */}
<div
  className={`absolute top-0 right-0 h-full ...`}
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
>
```

---

### 3. 動画のリソース管理

**問題**:
- モーダルclose時に動画が再生し続ける
- メモリリーク

**解決策**:
- `useEffect` のクリーンアップ関数でビデオを停止
- `pause()`, `currentTime = 0`, `load()` で完全クリーンアップ

**実装** ([app/src/components/modals/VideoModal.jsx:10-22](../../app/src/components/modals/VideoModal.jsx#L10-L22)):

```javascript
useEffect(() => {
  return () => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        videoRef.current.load();
      } catch (e) {
        // Ignore errors if element is already removed
      }
    }
  };
}, []);
```

---

### 4. 動画切り替え時の再マウント

**実装**:

```javascript
<video key={currentMovie.id} />
```

**理由**:
- `key` を変更することでReactがvideo要素を再マウント
- 動画ソースの切り替えが確実に行われる
- 前の動画のバッファがクリアされる

---

## トラブルシューティング

### 問題1: 動画がバックグラウンドで再生され続ける

**原因**: クリーンアップ処理が実行されていない

**確認**:
1. VideoModalのuseEffectクリーンアップ関数が実行されているか
2. 複数のVideoModalが存在していないか

**解決**:
- main.jsxのVideoModalのみ使用
- CollectionModalのVideoModalを削除済み

---

### 問題2: 動画リストが動画コントロールを覆ってしまう

**原因**: ホバーエリアが全体をカバーしている

**確認**:
1. ホバー検出エリアの高さが `calc(100% - 100px)` になっているか

**解決**:
- ホバー検出エリアと表示エリアを分離
- ホバー検出エリアは下100pxを除外

---

### 問題3: 動画が切り替わらない

**原因**: `key` propsが正しく設定されていない

**確認**:
1. video要素に `key={currentMovie.id}` が設定されているか
2. `selectedVideoIndex` stateが更新されているか

**解決**:
- `key` propsを `currentMovie.id` に設定
- `setSelectedVideoIndex(index)` が実行されることを確認

---

### 問題4: スクリーンショットが表示されない

**原因**: `game.screenshot.full` が未定義

**確認**:
```javascript
console.log('Screenshot:', game.screenshot);
```

**解決**:
- Steam APIから取得したスクリーンショットデータを確認
- バッチ処理で正しくスクリーンショットデータが取得されているか確認

---

## 関連ファイル

- [app/src/components/modals/VideoModal.jsx](../../app/src/components/modals/VideoModal.jsx) - VideoModalコンポーネント
- [app/src/components/modals/CollectionModal.jsx](../../app/src/components/modals/CollectionModal.jsx) - CollectionModalコンポーネント
- [app/src/main.jsx](../../app/src/main.jsx) - VideoModal呼び出し元
- [docs/DATA_STRUCTURE.md](../DATA_STRUCTURE.md) - データ構造仕様
- [docs/FRONTEND_GUIDE.md](../FRONTEND_GUIDE.md) - フロントエンド開発ガイド
