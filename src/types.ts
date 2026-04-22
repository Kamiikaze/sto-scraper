// Shared types for the scraper project

export interface EpisodeData {
  title: string;
  seenAt: Date;
}

export interface SeasonData {
  episodeCount: number;
  episodes: {
    [episodeNumber: string]: EpisodeData;
  };
}

export interface SeriesData {
  seasonCount: number;
  totalEpisodesCount: number;
  seasons: {
    [seasonNumber: string]: SeasonData;
  };
}

export interface ScraperOutput {
  scrapedAt: string;
  site: string;
  totalMovies: number;
  totalEpisodesCount: number;
  movieTitles: {
    [title: string]: SeriesData;
  };
}

export interface ScraperConfig {
  website: string;
  loginUrl: string;
  searchUrl: string;
  selectors: {
    [key: string]: string;
  };
}
