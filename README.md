# STO Scraper v2

A modernized web scraper for **s.to** and **aniworld.to** that extracts your viewing history with a beautiful standalone viewer.

## ✨ What's New in v2

- **🔄 Split Scrapers**: Separate scrapers for s.to and aniworld.to (different layouts)
- **📱 Standalone Viewer**: Self-contained HTML file with Vue 3 + Vuetify 3
- **🌙 Dark Mode**: Beautiful dark theme by default (toggleable)
- **📊 Better Data**: Metadata included (scrape date, site, stats)
- **🎯 TypeScript**: Fully typed codebase with proper structure

---

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/Kamiikaze/sto-scraper.git
cd sto-scraper

# Install dependencies
npm install

# Set up your credentials
cp .env.example .env
# Edit .env with your credentials
```

### 2. Configure Environment

Edit `.env` file:

```env
PAGE_USERNAME=your_email@example.com
PAGE_PASSWORD=your_password

HEADLESS=true              # Set to false to see browser during scraping
DONT_LOAD_STYLES=true      # Speeds up scraping
DO_SCREENSHOTS=false       # Set to true to save debug screenshots
```

### 3. Scrape Your History

### Note: If you have different credentials for s.to and aniworld.to, you need to change the credentials in `.env` before running the scraper. (Will be fixed soon)

```bash
# Scrape s.to (all pages)
npm run scrape:sto

# Scrape aniworld.to (all pages)
npm run scrape:aniworld

# Scrape first 5 pages only (for testing)
npm run scrape:sto:limit
npm run scrape:aniworld:limit
```
Or use the interactive `scrape.bat`

Results are saved to `data/` as JSON files.

### 4. View Your History

Simply **run `npm run webviewer` and open http://localhost:8080 in your browser**.

---

## 📁 Project Structure

```
sto-scraper-v2/
├── src/
│   ├── types.ts                      # Shared TypeScript types
│   └── scrapers/
│       ├── scraper-utils.ts          # Shared scraping utilities
│       ├── scraper-sto.ts            # s.to scraper
│       └── scraper-aniworld.ts       # aniworld.to scraper
├── data/                             # Viewer + Scraped JSON files (gitignored)
│   └── index.html                    # Standalone viewer (Vue 3 + Vuetify 3)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 🛠️ How It Works

### Scrapers

Each site has its own scraper class:

- **`scraper-sto.ts`**
- **`scraper-aniworld.ts`**

Both scrapers:
1. Log in with your credentials
2. Navigate through all history pages
3. Extract series, seasons, episodes, and watch times
4. Save structured JSON to `data/`

### Data Format

```json
{
  "totalMovies": 42,
  "totalEpisodesCount": 4986,
  "site": "aniworld.to",
  "scrapedAt": "2026-04-21T10:30:00.000Z",
  "movieTitles": {
    "Attack on Titan": {
      "seasonCount": 4,
      "totalEpisodesCount": 87,
      "seasons": {
        "1": {
          "episodeCount": 25,
          "episodes": {
            "1": {
              "title": "To You, in 2000 Years",
              "seenAt": "21.04.2026 15:30:00 Uhr vor 2 Tagen"
            }
          }
        }
      }
    }
  }
}
```

### Viewer

The `index.html` is a **completely standalone file**:

- Uses CDN-hosted Vue 3 + Vuetify 3
- Reads the `*_latest.json` files
- Dark mode by default
- Fully responsive design

---

## 🎨 Viewer Features

### Series Display
- Episode tables with:
  - Episode number badges
  - Episode titles
  - Watch timestamps
- Stats chips showing:
  - Total series count
  - Total episodes count
  - Site name
  - Scrape date

### Theme
- Dark mode by default (easy on the eyes)
- Toggle to light mode via sun/moon icon
- Consistent Material Design 3 styling

---

## 📊 Advanced Usage

### Custom Scrape Limits

Run scrapers with custom page limits:

```bash
# Scrape first 10 pages of s.to
npx ts-node src/scrapers/scraper-sto.ts 10

# Scrape first 20 pages of aniworld.to
npx ts-node src/scrapers/scraper-aniworld.ts 20
```

---

## 🐛 Troubleshooting

### "Login failed"
- Check your credentials in `.env`
- Try with `HEADLESS=false` to see what's happening
- Site might have captcha - solve it manually with headless=false

### "No data in viewer"
- Make sure JSON files are in `data/` folder
- Check browser console for errors

### "Module not found"
- Run `npm install` to install dependencies
- Make sure you're in the project directory

---

## 📝 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🙏 Credits

- Original project by **Kamiikaze**
- Modernized with Vue 3, Vuetify 3, and TypeScript
- Built with ❤️ for tracking your anime/series history

---

## 🔮 Future Ideas

- [ ] Merge multiple scrapes into unified view
- [ ] Export to CSV/Excel
- [ ] Support exports to other platforms (e.g. MyAnimeList, IMDB)

---

**Enjoy your modernized viewing history tracker! 🎉**
