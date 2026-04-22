@echo off
set /p website=Welche Website? (aniworld oder sto):

if /i "%website%"=="aniworld" (
    npm run scrape:aniworld
) else if /i "%website%"=="sto" (
    npm run scrape:sto
) else (
    echo Ungültige Website!
)

pause
