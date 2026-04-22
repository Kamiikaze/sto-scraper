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

      this.utils.saveToFile(this.movieTitles, "aniworld.to");
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
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  private async scrapePage(
    page: Page,
    pageNum: number,
    lastPageNum: number | null,
  ): Promise<boolean> {
    try {
      const rows = await page.$$(this.config.selectors.row);

      if (rows.length === 0) {
        return false;
      }

      for (const row of rows) {
        await this.scrapeRow(row);
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

  private async scrapeRow(row: any): Promise<void> {
    try {
      const entry = await row.$eval(
        this.config.selectors.title,
        (el: Element) => el.textContent?.trim() || "",
      );

      const title = entry.split(" - ")[0];
      const [season, episode] = entry
        .split(" - ")[1]
        .split(" ")
        .map((v: string) => parseInt(v.substring(1)));

      const seasonNumber = season > 0 ? season.toString() : "Movie";

      const info = await row.$eval(
        this.config.selectors.info,
        (el: Element) => el.textContent?.trim() || "",
      );

      const date = await row.$eval(
        this.config.selectors.time,
        (el: Element) => el.textContent?.trim() || "",
      );

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
        title: info,
        seenAt: this.formatSeenDate(date),
      };
    } catch (error) {
      console.error("Error scraping row:", error);
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
