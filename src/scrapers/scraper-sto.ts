import { Page } from "puppeteer";
import { SeriesData } from "../types";
import { ScraperUtils } from "./scraper-utils";

const STO_CONFIG = {
  website: "s.to",
  loginUrl: "https://s.to/login",
  searchUrl: "https://s.to/account/watch-history",
  selectors: {
    card: ".card",
    title: "h2 a",
    info: "p a",
    time: "span.float-end",
  },
};

export class StoScraper {
  private utils: ScraperUtils;
  private config: typeof STO_CONFIG;
  private movieTitles: { [title: string]: SeriesData } = {};
  private limit: number;

  constructor(limit: number = 0) {
    this.config = STO_CONFIG as typeof STO_CONFIG;
    this.utils = new ScraperUtils(this.config);
    this.limit = limit;
  }

  formatSeenDate(dateString: string) {
    const clean = dateString.split(" Uhr")[0];

    const [datePart, timePart] = clean.split(" ");
    const [year, month, day] = datePart.split("-");

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
      console.log(`\nFound ${totalMovies} unique series on s.to`);

      await this.utils.saveToFile(this.movieTitles, "s.to");
    } finally {
      await browser.close();
    }
  }

  private async scrapePages(page: Page): Promise<void> {
    let currentPage = 1;
    let cursor: string | null = null;

    while (true) {
      const { hasMorePages, nextCursor } = await this.scrapePage(
        page,
        currentPage,
        cursor,
      );

      if (!hasMorePages || (this.limit > 0 && currentPage >= this.limit)) {
        break;
      }

      cursor = nextCursor;
      currentPage++;
      await page.goto(this.config.searchUrl + `?cursor=` + cursor);
    }
  }

  private async scrapePage(
    page: Page,
    pageNum: number,
    cursor: string | null,
  ): Promise<{ hasMorePages: boolean; nextCursor: string | null }> {
    try {
      const sel = this.config.selectors;
      const cardData = await page.$$eval(
        sel.card,
        (cards, s) =>
          cards.map((c) => ({
            title: c.querySelector(s.title)?.textContent?.trim() ?? "",
            info: (c.querySelector(s.info) as HTMLElement)?.innerText?.trim() ?? "",
            date: c.querySelector(s.time)?.textContent?.trim() ?? "",
          })),
        sel,
      );

      if (cardData.length === 0) {
        return {
          hasMorePages: false,
          nextCursor: null,
        };
      }

      for (const data of cardData) {
        this.processCard(data);
      }

      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`Progress: ${pageNum} / ?`);

      const nextPage = await page.$eval(
        "ul.pagination :nth-child(2) a",
        (el: Element) => {
          const isDisabled = el.classList.contains("disabled");
          const nextUrl = new URL(el.getAttribute("href")!);
          const cursor = nextUrl.searchParams.get("cursor");
          return { hasMorePages: !isDisabled, nextCursor: cursor || null };
        },
      );

      return {
        hasMorePages: nextPage.hasMorePages,
        nextCursor: nextPage.nextCursor,
      };
    } catch (error) {
      console.error(`Error scraping page ${pageNum}:`, error);
      return {
        hasMorePages: false,
        nextCursor: null,
      };
    }
  }

  private processCard(data: { title: string; info: string; date: string }): void {
    try {
      const [seasonEpisode, episodeTitle] = data.info.split(" – ");
      const [seasonNumber, episodeNumber] = seasonEpisode
        .split(" ")
        .map((v: string) => parseInt(v.substring(1)) || 0);

      if (!this.movieTitles[data.title]) {
        this.movieTitles[data.title] = {
          seasonCount: 0,
          totalEpisodesCount: 0,
          seasons: {},
        };
      }

      if (!this.movieTitles[data.title].seasons[seasonNumber]) {
        this.movieTitles[data.title].seasons[seasonNumber] = {
          episodeCount: 0,
          episodes: {},
        };
        this.movieTitles[data.title].seasonCount++;
      }

      this.movieTitles[data.title].totalEpisodesCount++;
      this.movieTitles[data.title].seasons[seasonNumber].episodeCount++;
      this.movieTitles[data.title].seasons[seasonNumber].episodes[episodeNumber] = {
        title: episodeTitle,
        seenAt: this.formatSeenDate(data.date),
      };
    } catch (error) {
      console.error("Error processing card:", error);
    }
  }
}

// CLI execution
if (require.main === module) {
  const limit = parseInt(process.argv[2]) || 0;
  const scraper = new StoScraper(limit);
  scraper.scrape().catch(console.error);
}
