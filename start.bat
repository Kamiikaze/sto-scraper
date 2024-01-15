@echo off
set /p website=Enter website (aniworld.to or s.to): 
set /p limit=Enter the limit of pages (0 to get all): 
set /p headless=Headless: 

if /i "%website%"=="aniworld.to" (
    npx ts-node "./src/scraper-account.ts" aniworld.to %limit% %headless%
pause
) else if /i "%website%"=="s.to" (
    npx ts-node "./src/scraper-account.ts" s.to %limit% %headless%
pause
) else (
    echo Invalid website entered.
pause
)
pause
