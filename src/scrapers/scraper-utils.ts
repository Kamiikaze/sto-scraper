import puppeteer, { Browser, Page } from "puppeteer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { ScraperConfig, ScraperOutput, SeriesData } from "../types";

dotenv.config();

export class ScraperUtils {
  private config: ScraperConfig;
  private headless: boolean;
  private dontLoadStyles: boolean;

  constructor(config: ScraperConfig) {
    this.config = config;
    this.headless = process.env.HEADLESS === "true";
    this.dontLoadStyles = process.env.DONT_LOAD_STYLES === "true";
  }

  async launchBrowser(): Promise<Browser> {
    return await puppeteer.launch({
      headless: this.headless,
      args: [
        "--no-sandbox",
        "--enable-features=DnsOverHttps",
        "--dns-over-https-servers=https://cloudflare-dns.com/dns-query",
        "--dns-over-https-mode=secure",
      ],
    });
  }

  async fillCredentials(page: Page): Promise<void> {
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', process.env.PAGE_USERNAME || "");
    await page.type('input[name="password"]', process.env.PAGE_PASSWORD || "");
  }

  async performLogin(browser: Browser): Promise<void> {
    const loginPage = await browser.newPage();
    await loginPage.setUserAgent({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    });
    await loginPage.goto(this.config.loginUrl);

    console.log("Logging in...");

    await this.fillCredentials(loginPage);
    const [response] = await Promise.all([
      loginPage.waitForNavigation({ waitUntil: "networkidle2" }),
      loginPage.keyboard.press("Enter"),
    ]);

    const url = response!.url();
    const loggedIn = url.includes("/account");

    if (!loggedIn) {
      console.log("Login failed.");
      const captcha = await loginPage.$(".messageAlert.danger");
      if (captcha) {
        if (this.headless) {
          console.log("Captcha detected, please set headless to false in .env");
          process.exit(1);
        } else {
          console.log("Captcha detected, please solve it manually");
          await this.fillCredentials(loginPage);
        }
      }
    } else {
      console.log("Logged in successfully");
    }

    await loginPage.close();
  }

  async setupPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    );

    if (this.dontLoadStyles) {
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (
          request.resourceType() === "stylesheet" ||
          request.resourceType() === "font" ||
          request.resourceType() === "image"
        ) {
          request.abort();
        } else {
          request.continue();
        }
      });
    }

    return page;
  }

  getGlobalEpisodeCount(data: ScraperOutput): number {
    return Object.values(data.movieTitles)
      .flatMap((series) => Object.values(series.seasons))
      .reduce((sum, season) => {
        const count = season.episodes ? Object.keys(season.episodes).length : 0;

        return sum + count;
      }, 0);
  }

  saveToFile(movieTitles: { [p: string]: SeriesData }, site: string): void {
    const dataDir = "./data/";
    const data: ScraperOutput = {} as ScraperOutput;

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const d = new Date();
    const datestring =
      d.getFullYear() +
      "-" +
      ("0" + (d.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + d.getDate()).slice(-2) +
      "_" +
      ("0" + d.getHours()).slice(-2) +
      "-" +
      ("0" + d.getMinutes()).slice(-2) +
      "-" +
      ("0" + d.getSeconds()).slice(-2);

    // Versioned file
    const versionedPath = path.join(dataDir, `${site}_${datestring}.json`);

    // Latest file (always overwritten)
    const latestPath = path.join(dataDir, `${site}_latest.json`);

    // Add metadata
    data.movieTitles = movieTitles;
    data.scrapedAt = new Date().toISOString();
    data.site = site;
    data.totalMovies = Object.keys(movieTitles).length;
    data.totalEpisodesCount = this.getGlobalEpisodeCount(data);

    const json = JSON.stringify(data, null, 2);

    // Save versioned file
    fs.writeFileSync(versionedPath, json);

    // Save/update latest file
    fs.writeFileSync(latestPath, json);

    console.log(`\nData saved to ${versionedPath}`);
    console.log(`Latest updated: ${latestPath}`);
  }
}
