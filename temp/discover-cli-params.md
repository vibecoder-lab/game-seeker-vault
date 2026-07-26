# 新規タイトル発見バッチ CLIパラメータ一覧

`updater/main.py` に今回の実装で追加された4つのパラメータ。

| パラメータ | 意味 | 実行に必要なもの |
|---|---|---|
| `--discover <STEAM_WEB_API_KEY>` | Stage 1本体。Steam全カタログを取得し、前回スナップショットとの差分から新規App IDを検出、デモ/サントラの事前フィルタ、レビューゲートチェック、通過分のSteam+ITADフル取得を行い、PR用の候補ファイルを書き出す。**KVへの書き込みは一切行わない**。 | ITAD APIキー(第1引数)+ Steam Web APIキー |
| `--seed-only` | `--discover` と併用するサブオプション。カタログ取得とスナップショット保存だけ行って終了する。日次スケジュールを有効化する**前に一度だけ**実行し、初回差分が全カタログにならないようにするためのもの。 | `--discover` と同じ |
| `--force-include <appid>` | 指定したApp IDを保留リスト(pending)に強制的に追加し、次回 `--discover` 実行時に未チェック扱いとして再取得・再評価させる。誤って除外されたタイトルの救済用。 | ITAD APIキー不要(ローカルファイル操作のみ) |
| `--apply-pending <path>` | Stage 2本体。承認された `candidates.json` をKVに反映する。`apply-new-games.yml`(PRマージ時トリガー)から呼ばれる。 | ITAD/Steam Web APIキー不要、KVアクセス情報のみ |

## 使用例

```bash
# 初回シード(スケジュール有効化前に一度だけ)
python3 updater/main.py <ITAD_API_KEY> --discover <STEAM_WEB_API_KEY> --seed-only

# 日次実行(GitHub Actionsが自動実行)
python3 updater/main.py <ITAD_API_KEY> --discover <STEAM_WEB_API_KEY> [--regions JP,US,EU]

# 誤って除外されたタイトルの救済
python3 updater/main.py --force-include <appid>

# 承認済み候補のKV反映(GitHub Actionsが自動実行)
python3 updater/main.py --apply-pending <path>
```

`--regions` は今回追加したものではなく、既存の差分更新機能から流用しているオプション(`--discover` でも指定可能、省略時は `DEFAULT_REGIONS`)。
