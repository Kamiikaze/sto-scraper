import puppeteer from 'puppeteer';

const TITLE_SELECTOR = '.coverListItem h3';
const searchUrl = 'https://s.to/user/profil/kamikaze/watched';

const scrollToBottom = async (page: puppeteer.Page) => {
    const SCROLL_HEIGHT = 2500;
    let lastPosition = -1;
    let height = await page.evaluate('document.body.scrollHeight');

    while (lastPosition < height) {
        lastPosition = await page.evaluate('window.pageYOffset');
        console.log(`Scrolling to position ${lastPosition + SCROLL_HEIGHT}, last position was ${lastPosition}`);
        await page.evaluate(`window.scrollTo(0, ${lastPosition + SCROLL_HEIGHT})`);
        await page.waitForTimeout(100);
        height = await page.evaluate('document.body.scrollHeight');
        if (lastPosition + SCROLL_HEIGHT > 281600) {
            break;
        }
    }
};

const scrapeMovies = async (url: string) => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        if (request.resourceType() === 'stylesheet' || request.resourceType() === 'font') {
            request.abort();
        } else {
            request.continue();
        }
    });

    await page.goto(url);
    console.log('Page loaded successfully');
    await scrollToBottom(page);
    console.log('Finished scrolling to bottom of page');
    const movieTitles = await page.$$eval(TITLE_SELECTOR, (titles) =>
        titles.map((title) => title.textContent?.trim())
    );
    const movieCount: {[title: string]: number} = {}; // initialize movie count
    movieTitles.forEach((title) => {
        if (title) {
            movieCount[title] = (movieCount[title] || 0) + 1; // increment count
        }
    });
    console.log(movieCount);
    // count all entries in movieCount
    const totalMovies = Object.values(movieCount).reduce((a, b) => a + b, 0);
    console.log(`Total movies: ${totalMovies}`);
    console.log(`Found ${Object.keys(movieCount).length} unique movie titles`);
    await browser.close();
};

scrapeMovies(searchUrl);
