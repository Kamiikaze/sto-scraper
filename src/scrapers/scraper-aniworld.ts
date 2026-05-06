import { Page } from "puppeteer";
import { ScraperConfig, ScraperOutput, SeriesData } from "../types";
import { ScraperUtils } from "./scraper-utils";

const ANIWORLD_CONFIG: ScraperConfig = {
  website: "aniworld.to",
  loginUrl: "https://aniworld.to/login",
  searchUrl: "https://aniworld.to/account/watched/",
  selectors: {
    nav: ".hosterSiteDirectNav.pagination ul",
    row: "table tbody tr",
    title: "td:nth-child(1) > a",
    info: "td:nth-child(2) > a > strong",
    time: "td:nth-child(3)",
  },
};

export class AniworldScraper {
  private utils: ScraperUtils;
  private config: ScraperConfig;
  private movieTitles: { [title: string]: SeriesData } = {};
  private limit: number;

  constructor(limit: number = 0) {
    this.config = ANIWORLD_CONFIG;
    this.utils = new ScraperUtils(this.config);
    this.limit = limit;
  }

  formatSeenDate(dateString: string) {
    const clean = dateString.split(" Uhr")[0];

    const [datePart, timePart] = clean.split(" ");
    const [day, month, year] = datePart.split(".");

    const isoString = `${year}-${month}-${day}T${timePart}`;
    return new Date(isoString);
  }

  async scrape(): Promise<void> {
    const browser = await this.utils.launchBrowser();

    try {
      await this.utils.performLogin(browser);
      const page = await this.utils.setupPage(browser);
      await page.goto(this.config.searchUrl);

      await this.scrapePages(page);

      const totalMovies = Object.keys(this.movieTitles).length;
      console.log(`\nFound ${totalMovies} unique series on aniworld.to`);

      await this.utils.saveToFile(this.movieTitles, "aniworld.to");
    } finally {
      await browser.close();
    }
  }

  private async scrapePages(page: Page): Promise<void> {
    let currentPage = 1;
    const lastPageNum = await this.getLastPageNumber(page);

    while (true) {
      const hasMorePages = await this.scrapePage(
        page,
        currentPage,
        lastPageNum,
      );

      if (!hasMorePages || (this.limit > 0 && currentPage >= this.limit)) {
        break;
      }

      currentPage++;
      await page.goto(this.config.searchUrl + currentPage);
    }
  }

  private async scrapePage(
    page: Page,
    pageNum: number,
    lastPageNum: number | null,
  ): Promise<boolean> {
    try {
      const sel = this.config.selectors;
      const rowData = await page.$$eval(
        sel.row,
        (rows, s) =>
          rows.map((r) => ({
            entry: r.querySelector(s.title)?.textContent?.trim() ?? "",
            info: r.querySelector(s.info)?.textContent?.trim() ?? "",
            date: r.querySelector(s.time)?.textContent?.trim() ?? "",
          })),
        sel,
      );

      if (rowData.length === 0) {
        return false;
      }

      for (const data of rowData) {
        this.processRow(data);
      }

      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`Progress: ${pageNum} / ${lastPageNum || "?"}`);

      return pageNum < (lastPageNum || pageNum);
    } catch (error) {
      console.error(`Error scraping page ${pageNum}:`, error);
      return false;
    }
  }

  private processRow(data: { entry: string; info: string; date: string }): void {
    try {
      const title = data.entry.split(" - ")[0];
      const [season, episode] = data.entry
        .split(" - ")[1]
        .split(" ")
        .map((v: string) => parseInt(v.substring(1)));

      const seasonNumber = season > 0 ? season.toString() : "Movie";

      if (!this.movieTitles[title]) {
        this.movieTitles[title] = {
          seasonCount: 0,
          totalEpisodesCount: 0,
          seasons: {},
        };
      }

      if (!this.movieTitles[title].seasons[seasonNumber]) {
        this.movieTitles[title].seasons[seasonNumber] = {
          episodeCount: 0,
          episodes: {},
        };
        this.movieTitles[title].seasonCount++;
      }

      this.movieTitles[title].totalEpisodesCount++;
      this.movieTitles[title].seasons[seasonNumber].episodeCount++;
      this.movieTitles[title].seasons[seasonNumber].episodes[
        episode.toString()
      ] = {
        title: data.info,
        seenAt: this.formatSeenDate(data.date),
      };
    } catch (error) {
      console.error("Error processing row:", error);
    }
  }

  private async getLastPageNumber(page: Page): Promise<number | null> {
    try {
      const lastPage = await page.$(
        `${this.config.selectors.nav} li:last-child a`,
      );
      const lastPageNum = await lastPage?.evaluate((el) => {
        const url = el.href;
        return url.split("/").pop()?.replace("#", "");
      });

      if (lastPageNum && !isNaN(parseInt(lastPageNum))) {
        return parseInt(lastPageNum);
      }
    } catch (error) {
      console.error("Error getting last page number:", error);
    }
    return null;
  }
}

// CLI execution
if (require.main === module) {
  const limit = parseInt(process.argv[2]) || 0;
  const scraper = new AniworldScraper(limit);
  scraper.scrape().catch(console.error);
}
