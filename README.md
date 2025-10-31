# 🎮 Game Seeker Vault

**Game Seeker Vault** is a web application that allows users to **browse, search, and collect Steam games**  
using data sourced primarily from the **official Steam Web API**,  
and enriched with **price and deal information from IsThereAnyDeal (ITAD)**.

The project consists of:
- A **web application** (React + Vite + Cloudflare Pages Functions) deployed on Cloudflare Pages
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
- Search and browse a curated collection of Steam games
- View the latest prices and discounts (via ITAD)
- **Multi-region pricing support** — View prices in both JPY (Japan) and USD (United States)
- Save favorite games to a local "Collection" (stored in IndexedDB as `GameSeekerVaultDB`)
- **Video playback** — Watch game trailers directly in the app with embedded YouTube player
- Fully client-side functionality — no login required
- Automatically refreshed game data (via backend automation)
- Multi-language support (English & Japanese) with automatic detection based on:
  - User's saved preference (localStorage)
  - Browser language settings
  - Geographic location (via Cloudflare's IP geolocation)
- **Feedback system** — Submit feedback directly from the app (admin panel for review)

---

## 🧩 Repository Structure

```
game-seeker-vault/
├── app/                        # Web application (Cloudflare Pages)
│   ├── src/                    # React source files
│   │   ├── main.jsx            # Application entry point
│   │   ├── index.css           # Global styles
│   │   ├── components/         # React components
│   │   │   ├── GameCard.jsx    # Game card component
│   │   │   ├── Header.jsx      # Header component
│   │   │   ├── AdminPanel.jsx  # Admin panel component
│   │   │   └── modals/         # Modal components
│   │   │       ├── CollectionModal.jsx
│   │   │       ├── VideoModal.jsx
│   │   │       ├── FeedbackModal.jsx
│   │   │       └── LanguageRegionModal.jsx
│   │   ├── constants/          # Application constants
│   │   │   ├── index.js        # General constants
│   │   │   ├── genres.js       # Genre mappings
│   │   │   └── reviews.js      # Review score mappings
│   │   ├── db/                 # IndexedDB operations
│   │   │   ├── index.js        # DB exports
│   │   │   ├── init.js         # DB initialization
│   │   │   ├── favorites.js    # Favorites operations
│   │   │   ├── folders.js      # Folders operations
│   │   │   └── settings.js     # Settings operations
│   │   ├── i18n/               # Internationalization
│   │   │   ├── index.js        # i18n helper functions
│   │   │   └── translations.js # Translation dictionaries
│   │   ├── utils/              # Utility functions
│   │   │   ├── format.js       # Formatting utilities
│   │   │   └── steam.js        # Steam-specific helpers
│   │   └── assets/             # Static assets (images, icons, etc.)
│   ├── public/                 # Public static files
│   ├── functions/              # Cloudflare Pages Functions (API)
│   │   └── api/
│   │       ├── games-data.ts   # Games data API endpoint
│   │       ├── detect-locale.ts # Locale detection API endpoint
│   │       ├── feedback.ts     # Feedback submission endpoint
│   │       └── feedback-admin.ts # Feedback admin endpoint
│   ├── index.html              # Development HTML entry point
│   ├── package.json            # Node.js dependencies
│   ├── vite.config.js          # Vite configuration
│   ├── tailwind.config.js      # Tailwind CSS configuration
│   ├── postcss.config.js       # PostCSS configuration
│   ├── eslint.config.js        # ESLint configuration
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
│   ├── ARCHITECTURE.md         # System architecture
│   ├── FRONTEND_GUIDE.md       # Frontend development guide
│   ├── DATA_STRUCTURE.md       # Data structure specification
│   ├── BATCH_PROCESSING.md     # Batch processing guide
│   ├── features/               # Feature documentation
│   │   ├── VIDEO_PLAYBACK.md
│   │   ├── MULTI_REGION_PRICING.md
│   │   └── STEAM_REVIEWS_IMPLEMENTATION.md
│   ├── tests/                  # Test documentation
│   │   ├── FRONTEND_TESTS.md
│   │   └── API_TESTS.md
│   └── tmp/                    # Documentation drafts
│       ├── overview.md
│       └── coding_rules.md
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
- **Node.js 18+** — for web application development
- **Python 3.13+** — for data pipeline scripts
- **Wrangler CLI** — for Cloudflare Pages Functions testing and deployment

### Web Application (app/)

The application is built with React and Vite.

```bash
cd app

# Install dependencies
npm install

# Run development server (includes Pages Functions and updater data proxy)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy to Cloudflare Pages (deploys dist/ directory)
npx wrangler pages deploy dist
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
| `MAILCHANNELS_API_KEY` | MailChannels API key for email notifications | Feedback system |
| `FEEDBACK_ADMIN_SECRET` | Secret key for accessing feedback admin panel | Feedback system |

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
- **Deploy**: `app/dist/` directory (Vite build output including Pages Functions)

---

## ⚠️ Disclaimer

**Game Seeker Vault** is an independent, fan-made project.  
It is **not affiliated with, endorsed, or sponsored by Valve Corporation (Steam) or IsThereAnyDeal.com**.  
All data is obtained through their publicly available APIs  
and used in accordance with their respective terms of service.

---

## 🧾 License
Released under the [MIT License](LICENSE).
