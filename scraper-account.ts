import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

const TITLE_SELECTOR = 'table tr td:nth-child(1) > a';
const searchUrl = 'https://s.to/account/watched/1';
const loginUrl = 'https://s.to/login';
const movieTitles: {[title: string]: number} = {};

const scrapeMovies = async (url: string) => {
    const browser = await puppeteer.launch({ headless: true });

    // Create a new page for logging in
    const loginPage = await browser.newPage();
    await loginPage.goto(loginUrl);

    console.log('Logging in...');

    // Fill in login credentials and submit the form
    await loginPage.type('input[name="email"]', process.env.PAGE_USERNAME || '');
    await loginPage.type('input[name="password"]', process.env.PAGE_PASSWORD || '');
    await Promise.all([
                          loginPage.keyboard.press('Enter'),
                          loginPage.waitForNavigation(),
                      ]);

    // Take a screenshot of the logged in page (optional)
    await loginPage.screenshot({ path: 'login.png' });

    console.log('Logged in successfully');



    // Create a new page for scraping movies
    const page = await browser.newPage();

    // Block unnecessary resources to speed up page loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        if (request.resourceType() === 'stylesheet' || request.resourceType() === 'font') {
            request.abort();
        } else {
            request.continue();
        }
    });

    // Navigate to the search URL
    await page.goto(url);



    // Recursive function to loop through all pages of the search results
    const loopPages = async () => {
        const newTitles = await page.$$eval(TITLE_SELECTOR, (titles) =>
            titles.map((title) => title.textContent?.split(' - ')[0]?.trim())
        );

        // Add new titles to the movie titles array
        newTitles.forEach((title) => {
            if (title) {
                movieTitles[title] = (movieTitles[title] || 0) + 1;
            }
        });

        // Find the last page number, if available
        const lastPageLink = await page.$('.hosterSiteDirectNav li:last-child a');
        const lastPage = lastPageLink
            ? parseInt(await lastPageLink.evaluate((el) => el.textContent))
            : NaN;

        // Check if the current page is the last page
        const currentPageLink = await page.url().split('/').pop();
        const currentPage = currentPageLink ? parseInt(currentPageLink) : NaN;

        const nextPage = currentPage + 1;

        if (currentPage === lastPage) {
            console.log('Reached the last page');
            return;
        }

        // Navigate to the next page and wait for the title selector to appear
        await Promise.all([
                              page.goto(`https://s.to/account/watched/${nextPage}`),
                              page.waitForSelector(TITLE_SELECTOR),
                          ]);

        console.log(`Page ${currentPage + 1} loaded successfully`);

        // Recursively loop through the remaining pages
        await loopPages();
    };

    await loopPages();

    console.dir(movieTitles, { colors: true, maxArrayLength: null });
    console.log(`Found ${movieTitles.length} unique movie titles`);

    await browser.close();
};

scrapeMovies(searchUrl);
