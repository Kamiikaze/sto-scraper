import puppeteer, {Browser} from 'puppeteer';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Stops the script after the first X pages have been scraped
// Set to 0 to scrape all pages
const firstXPages = 0;

const ROW_SELECTOR = 'table tbody tr';
const TITLE_SELECTOR = 'td:nth-child(1) > a';
const INFO_SELECTOR = 'td:nth-child(2) > a > strong';
const TIME_SELECTOR = 'td:nth-child(3)';

const isHeadless = process.env.HEADLESS === 'true';
const dontLoadStyles = process.env.DONT_LOAD_STYLES === 'true';
const doScreenshots = process.env.DO_SCREENSHOTS === 'true';

const searchUrl = 'https://s.to/account/watched/';
const loginUrl = 'https://s.to/login';
const movieTitles: {[title: string]: {
        seasonCount: number,
        totalEpisodesCount: number,
        seasons: {[seasonNumber: string]: {
                episodeCount: number,
                episodes: {[episodeNumber: string]: {
                        title: string,
                        seenAt: string
                    }}
            }}
    }} = {};

async function doPageLogin( browser: Browser, outputDir: string ) {
    const loginPage = await browser.newPage();
    await loginPage.setUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36' );
    await loginPage.goto( loginUrl );

    console.log( 'Logging in...' );

    // Fill in login credentials and submit the form
    await loginPage.waitForSelector( 'input[name="email"]' );
    await loginPage.type( 'input[name="email"]', process.env.PAGE_USERNAME || '' );
    await loginPage.type( 'input[name="password"]', process.env.PAGE_PASSWORD || '' );
    await Promise.all( [
                           loginPage.keyboard.press( 'Enter' ),
                           loginPage.waitForNavigation(),
                       ] );

    // Take a screenshot of the logged in page (optional)
    if ( doScreenshots ) await loginPage.screenshot( { path: outputDir + 'login.png' } );

    console.log( 'Logged in successfully' );
}

function createOuputDir() {
    const outputDir = './dist/';
    if ( !fs.existsSync( outputDir ) ) {
        fs.mkdirSync( outputDir );
        console.log( 'Created output directory' );
    }
    return outputDir;
}

const scrapeMovies = async () => {
    // Create output directory
    const outputDir = createOuputDir();

    // Launch the browser
    const browser = await puppeteer.launch({ headless: isHeadless });

    // Login to the page
    await doPageLogin( browser, outputDir );

    // Create a new page for scraping movies
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');

    // Block unnecessary resources to speed up page loading
    if (dontLoadStyles) {
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (request.resourceType() === 'stylesheet' || request.resourceType() === 'font') {
                request.abort();
            } else {
                request.continue();
            }
        });
    }

    // Navigate to the search URL
    await page.goto(searchUrl+"1");



    // Recursive function to loop through all pages of the search results
    const loopPages = async () => {
        const rows = await page.$$(ROW_SELECTOR);

        for ( const row of rows ) {
            const entry = await row.$eval(TITLE_SELECTOR, (el) => el.textContent?.trim() || '');
            const title = entry.split(' - ')[0];
            const [season, episode] = entry.split(' - ')[1].split(' E') || [];
            const seasonNumber = season?.replace('S', '');
            const info = await row.$eval(INFO_SELECTOR, (el) => el.textContent?.trim());
            const date = await row.$eval(TIME_SELECTOR, (el) => el.textContent?.trim());

            // Extract the episode title from the info string
            const episodeTitle = info || '';

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
                seenAt: date || '',
            };
        }


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

        if ( doScreenshots ) await page.screenshot( { path: outputDir + `page-${currentPage}.png` } );

        // Navigate to the next page
        await Promise.all([
                              page.goto(searchUrl+nextPage),
                              page.waitForTimeout(100),
                          ]);

        console.log(`Page ${currentPage + 1} loaded successfully`);

        if ( firstXPages > 0 && currentPage === firstXPages ) return;

        // Recursively loop through the remaining pages
        await loopPages();
    };

    await loopPages();

    const totalMovies = Object.keys(movieTitles).length;

    console.dir(movieTitles, { colors: true, maxArrayLength: null });
    console.log(`Found ${totalMovies} unique movie titles`);

    fs.writeFile(outputDir+'movie-data.json', JSON.stringify({totalMovies, movieTitles}, null, 2), (err) => {
        if (err) {
            console.error(err);
            return;
        }

        console.log('Movie data saved to movie-data.json');
    });

    await browser.close();
};

scrapeMovies();
