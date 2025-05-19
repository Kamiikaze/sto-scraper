import puppeteer, { Browser, Page } from "puppeteer";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const website = process.argv[2];
const limit = process.argv[3] || 0;
const headless = process.argv[4] || false;

// Stops the script after the first X pages have been scraped
// Set to 0 to scrape all pages
const firstXPages = limit ? parseInt(limit) : 0;

const NAV_SELECTOR = ".hosterSiteDirectNav.pagination ul";
const ROW_SELECTOR = "table tbody tr";
const TITLE_SELECTOR = "td:nth-child(1) > a";
const INFO_SELECTOR = "td:nth-child(2) > a > strong";
const TIME_SELECTOR = "td:nth-child(3)";

const isHeadless = process.env.HEADLESS
  ? process.env.HEADLESS === "true"
  : headless === "true";
const dontLoadStyles = process.env.DONT_LOAD_STYLES === "true";
const doScreenshots = process.env.DO_SCREENSHOTS === "true";

const searchUrl = `https://${website}/account/watched/`;
const loginUrl = `https://${website}/login`;
const movieTitles: {
  [title: string]: {
    seasonCount: number;
    totalEpisodesCount: number;
    seasons: {
      [seasonNumber: string]: {
        episodeCount: number;
        episodes: {
          [episodeNumber: string]: {
            title: string;
            seenAt: string;
          };
        };
      };
    };
  };
} = {};

async function fillCredentials(page: Page) {
  // Fill in login credentials
  await page.waitForSelector('input[name="email"]');
  await page.type('input[name="email"]', process.env.PAGE_USERNAME || "");
  await page.type('input[name="password"]', process.env.PAGE_PASSWORD || "");
}

function createOuputDir() {
  const outputDir = "./dist/";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
    console.log("Created output directory");
  }
  return outputDir;
}

async function doPageLogin(browser: Browser, outputDir: string) {
  const loginPage = await browser.newPage();
  await loginPage.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
  );
  await loginPage.goto(loginUrl);

  console.log("Logging in...");

  // Fill in login credentials and submit the form
  await fillCredentials(loginPage);
  const [response] = await Promise.all([
    loginPage.waitForNavigation({ waitUntil: "networkidle2" }),
    loginPage.keyboard.press("Enter"),
  ]);

  // Take a screenshot of the logged in page
  await loginPage.screenshot({ path: outputDir + "login.png" });

  // Check if the login was successful or not by checking the URL
  const url = response!.url();
  const loggedIn = url.includes("/account");
  process.stdout.clearLine(0);

  // check if path has changed
  if (!loggedIn) {
    process.stdout.write("Login failed.");
    const captcha = await loginPage.$(".messageAlert.danger");
    if (captcha) {
      if (isHeadless) {
        console.log("Captcha detected, please set headless to false in .env");
        process.exit(1);
      } else {
        console.log("Captcha detected, please solve it manually");
        await fillCredentials(loginPage);
      }
    }
  }

  process.stdout.write("Logged in successfully");

  await loginPage.close();
}

async function launchWithCloudflareDoH(headless = true): Promise<Browser> {
  return await puppeteer.launch({
    headless,
    args: [
      // Enable the DoH feature under a trial group
      '--enable-features=DnsOverHttps<DoHTrial',
      // Activate that trial group
      '--force-fieldtrials=DoHTrial/Group1',
      // Konfiguriere die Cloudflare‐DoH‐Templates (POST‐Methode)
      '--force-fieldtrial-params=DoHTrial.Group1:Fallback/true/Templates/https://cloudflare-dns.com/dns-query'
    ]
  });
}


const scrapeMovies = async () => {
  // Create output directory
  const outputDir = createOuputDir();

  // Launch the browser
  const browser = await launchWithCloudflareDoH();

  // Login to the page
  await doPageLogin(browser, outputDir);

  // Create a new page for scraping movies
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
  );

  // Block unnecessary resources to speed up page loading
  if (dontLoadStyles) {
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

  // Navigate to the search URL
  await page.goto(searchUrl + "1");

  // Recursive function to loop through all pages of the search results
  const loopPages = async () => {
    const rows = await page.$$(ROW_SELECTOR);

    const lastPageNum = async () => {
      for (let i = 3; i > 0; i--) {
        const lastPage = await page.$(
          NAV_SELECTOR + ` li:nth-last-child(${i}) a`,
        );
        const lastPageNum = await lastPage?.evaluate((el) => el.textContent);
        // check if lastPageNum is a number
        if (lastPageNum && !isNaN(parseInt(lastPageNum))) {
          return parseInt(lastPageNum);
        }
      }
    };

    for (const row of rows) {
      const entry = await row.$eval(
        TITLE_SELECTOR,
        (el) => el.textContent?.trim() || "",
      );
      const title = entry.split(" - ")[0];
      const [season, episode] = entry
        .split(" - ")[1]
        .split(" ")
        .map((v) => parseInt(v.substring(1)));
      const seasonNumber = season > 0 ? season : "Movie";
      const info = await row.$eval(
        INFO_SELECTOR,
        (el) => el.textContent?.trim(),
      );
      const date = await row.$eval(
        TIME_SELECTOR,
        (el) => el.textContent?.trim(),
      );

      // Extract the episode title from the info string
      const episodeTitle = info || "";

      // Add the data to the movies object
      if (!movieTitles[title]) {
        movieTitles[title] = {
          seasonCount: 0,
          totalEpisodesCount: 0,
          seasons: {},
        };
      }

      if (!movieTitles[title].seasons[seasonNumber]) {
        movieTitles[title].seasons[seasonNumber] = {
          episodeCount: 0,
          episodes: {},
        };
        movieTitles[title].seasonCount++;
      }

      movieTitles[title].totalEpisodesCount++;
      movieTitles[title].seasons[seasonNumber].episodeCount++;
      movieTitles[title].seasons[seasonNumber].episodes[episode] = {
        title: episodeTitle,
        seenAt: date || "",
      };
    }

    // Check if the current page is the last page
    const currentPageLink = page.url().split("/").pop();
    const currentPage = currentPageLink ? parseInt(currentPageLink) : NaN;

    const nextPage = currentPage + 1;
    const lastPage = await lastPageNum();

    if (currentPage === lastPage) {
      console.log("Reached the last page");
      return;
    }

    if (doScreenshots)
      await page.screenshot({ path: outputDir + `page-${currentPage}.png` });

    // Navigate to the next page
    await Promise.all([
      page.goto(searchUrl + nextPage),
      new Promise((r) => setTimeout(r, 100)),
    ]);

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`Progress: ${currentPage + 1} / ${lastPage}`);

    if (firstXPages > 0 && currentPage === firstXPages) return;

    // Recursively loop through the remaining pages
    await loopPages();
  };

  await loopPages();

  const totalMovies = Object.keys(movieTitles).length;

  console.dir(movieTitles, { colors: true, maxArrayLength: null });
  console.log(`Found ${totalMovies} unique movie titles`);

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

  const filePath = "./public/data/" + `${website}_${datestring}.json`;

  fs.writeFile(
    filePath,
    JSON.stringify({ totalMovies, movieTitles }, null, 2),
    (err) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(`Movie data saved to ${filePath}`);
    },
  );

  await browser.close();
  return;
};

scrapeMovies();
