# 🎮 Game Seeker Vault

**Game Seeker Vault** is a web application that allows users to **browse, search, and collect Steam games**  
using data sourced primarily from the **official Steam Web API**,  
and enriched with **price and deal information from IsThereAnyDeal (ITAD)**.

The project consists of:
- A **web application** (React via CDN + Cloudflare Pages Functions) deployed on Cloudflare Pages
- An **automated data pipeline** that periodically fetches and rebuilds Steam game data
  via **Python scripts** and **GitHub Actions**, storing results in **Cloudflare Workers KV**

---

## 🌐 Overview

### Data Sources
- 🧩 **Steam Web API** — Provides all core game data (AppID, title, metadata, genres, etc.)  
  - [https://api.steampowered.com/ISteamApps/GetAppList/v2/](https://api.steampowered.com/ISteamApps/GetAppList/v2/)
  - [https://store.steampowered.com/api/appdetails](https://store.steampowered.com/api/appdetails)
- 💰 **IsThereAnyDeal API (ITAD)** — Provides price and deal information only (for lowest price display)

### Key Features
- Search and browse all Steam games
- View the latest prices and discounts (via ITAD)
- Save favorite games to a local "Collection" (stored in IndexedDB as `GameSeekerVaultDB`)
- Fully client-side functionality — no login required
- Automatically refreshed game data (via backend automation)
- Multi-language support (English & Japanese) with automatic detection based on:
  - User's saved preference (localStorage)
  - Browser language settings
  - Geographic location (via Cloudflare's IP geolocation)

---

## 🧩 Repository Structure

```
game-seeker-vault/
├── app/                        # Web application (Cloudflare Pages)
│   ├── public/                 # Static assets and application
│   │   └── index.html          # Single-page React application (CDN-based)
│   ├── functions/              # Cloudflare Pages Functions (API)
│   │   └── api/
│   │       ├── games-data.ts   # Games data API endpoint
│   │       └── detect-locale.ts # Locale detection API endpoint
│   └── wrangler.jsonc          # Cloudflare configuration
│
├── updater/                    # Data pipeline (GitHub Actions)
│   ├── main.py                 # CLI entry point
│   ├── game_data_builder.py    # Business logic layer
│   ├── steam_client.py         # Steam API client
│   ├── itad_client.py          # ITAD API client
│   ├── kv_helper.py            # Cloudflare KV operations
│   ├── constants.py            # Shared constants
│   ├── requirements.txt        # Python dependencies
│   ├── data/                   # Data storage (local only)
│   │   ├── current/            # Latest data files
│   │   │   ├── games.json      # Game data
│   │   │   └── id-map.json     # ID mapping
│   │   ├── refs/               # Reference data
│   │   │   └── game_title_list.txt
│   │   ├── tmp/                # Temporary files
│   │   │   └── games_rebuilt.json
│   │   └── backups/            # Backup files
│   │       └── games_*.json
│   ├── log/                    # Execution logs
│   │   └── rebuild.log
│   └── README.md               # Detailed updater documentation
│
├── docs/                       # Project documentation
│   ├── overview.md
│   └── coding_rules.md
│
├── .github/
│   └── workflows/
│       ├── kv-updater.yml      # Daily data update job
│       └── deploy.yml          # Cloudflare Pages deployment
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🔄 Automated Data Pipeline

The data pipeline runs automatically via GitHub Actions:

1. **Fetch game information from Steam Web API**
   - Game details, metadata, genres, platforms, prices, and reviews
2. **Fetch historical price data from ITAD API**
   - Lowest prices and current deals for each game
3. **Build combined dataset**
   - Merges Steam data with ITAD pricing information
4. **Upload to Cloudflare Workers KV**
   - `games-data` key contains the full game catalog
   - `id-map` key contains Steam AppID ↔ ITAD ID mappings
5. **Runs daily via GitHub Actions**
   - Scheduled workflow: `.github/workflows/kv-updater.yml`
   - Manual trigger: Add new games via `--new-only` mode

See [updater/README.md](updater/README.md) for detailed usage and data flow.

---

## ⚙️ Local Development

### Requirements
- **Python 3.13+** — for data pipeline scripts
- **Wrangler CLI** — for Cloudflare Pages Functions testing and deployment

### Web Application (app/)

The application is a single-page React app loaded via CDN (no build step required).

```bash
cd app

# Test locally with Wrangler (includes Pages Functions)
npx wrangler pages dev public

# Deploy to Cloudflare Pages
npx wrangler pages deploy public
```

### Data Pipeline (updater/)

```bash
# Install Python dependencies
cd updater
pip install -r requirements.txt

# Run full data update (local files)
python3 main.py <ITAD_API_KEY>

# Add new games only
python3 main.py <ITAD_API_KEY> --new-only

# Test with KV (requires Wrangler setup)
python3 main.py <ITAD_API_KEY> --kv
```

See [updater/README.md](updater/README.md) for detailed options and usage.

---

## 🔐 GitHub Secrets

Required secrets for GitHub Actions workflows:

| Secret Name | Description | Used By |
|------------|-------------|---------|
| `ITAD_API_KEY` | IsThereAnyDeal API key | Data pipeline (updater) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers KV write access | Data pipeline (updater) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | Data pipeline (updater) |
| `KV_NAMESPACE_ID` | Cloudflare Workers KV Namespace ID | Data pipeline (updater) |

---

## 🕒 GitHub Actions Workflows

### Daily Data Update (`.github/workflows/kv-updater.yml`)
- **Schedule**: Runs daily at UTC midnight
- **Trigger**: Can also be manually triggered via workflow dispatch
- **Steps**:
  1. Set up Python environment
  2. Install dependencies from `updater/requirements.txt`
  3. Run `python3 updater/main.py` with ITAD API key
  4. Upload `games-data` and `id-map` to Cloudflare Workers KV

### Deployment (`.github/workflows/deploy.yml`)
- **Trigger**: Push to main branch or manual dispatch
- **Target**: Cloudflare Pages
- **Deploy**: `app/public/` directory (includes index.html and Pages Functions)

---

## ⚠️ Disclaimer

**Game Seeker Vault** is an independent, fan-made project.  
It is **not affiliated with, endorsed, or sponsored by Valve Corporation (Steam) or IsThereAnyDeal.com**.  
All data is obtained through their publicly available APIs  
and used in accordance with their respective terms of service.

---

## 🧾 License
Released under the [MIT License](LICENSE).
