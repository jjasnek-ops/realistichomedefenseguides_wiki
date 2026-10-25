import { config } from '../lib/config';
const english: Record<string, string> = {
  home: 'Overview', search: 'Search the wiki', searchHint: 'Search guides, items, bosses…', navigation: 'Wiki navigation',
  explore: 'EXPLORE THE WIKI', resources: 'RESOURCES', allGuides: 'All guides', recent: 'Recent updates',
  featured: 'Featured guides', readGuide: 'Read guide', viewAll: 'View all', articles: 'guides',
  updated: 'Updated', published: 'Published', readTime: 'min read', onThisPage: 'On this page', related: 'Keep exploring',
  demo: 'DEMO WIKI', demoNotice: 'Independent, unofficial game wiki.',
  about: 'About this wiki', privacy: 'Privacy', terms: 'Terms', unofficial: 'An independent, unofficial game wiki.',
  theme: 'Switch color theme', menu: 'Open navigation', close: 'Close', skip: 'Skip to content',
  languages: 'Language', unavailable: 'This page has no other translations yet.',
  faq: 'Frequently asked questions', active: 'Active codes', expired: 'Expired codes', verified: 'Last verified',
  code: 'Code', reward: 'Reward', copy: 'Copy code', copied: 'Copied!', copyFailed: 'Select the code and copy manually.',
  boss: 'BOSS INTELLIGENCE', hp: 'Health', weakness: 'Weakness', resistant: 'Resistance', location: 'Location', level: 'Recommended level',
  rewards: 'Rewards', ranking: 'Ranking basis', item: 'Item details', acquisition: 'How to get it', equipment: 'Equipment', skills: 'Skills', scenario: 'Best for',
  filter: 'Filter guides', all: 'All', noResults: 'No matching guides. Try another search.', expandImage: 'Expand image',
  notFound: 'You have wandered off the map.', notFoundDesc: 'This page does not exist. Find your way back to a guide or search the wiki.',
  backHome: 'Back to the wiki', searchUnavailable: 'Search is temporarily unavailable. Please try again.',
  noindex: 'Reference note · excluded from search engines', translated: 'Available translations', latest: 'LATEST FIELD NOTES',
  featuredLabel: 'EDITOR’S PICKS', noData: 'No published guides yet.',
  software: 'Software licenses', map: 'World map', markers: 'Map markers',
  brandTagline: 'WIKI & FIELD GUIDE', wiki: 'WIKI', jumpInto: 'JUMP INTO', startHere: 'START HERE',
  quickStartNote: 'Less guesswork. More discovery.', conceptArt: 'REALISTIC HOME DEFENSE · ROBLOX',
  aboutGameEyebrow: 'ABOUT THE GAME', fieldGuide: 'YOUR FIELD GUIDE', privateSearch: 'Private, on-device search',
  results: 'results', activeDemo: 'Active', expiredDemo: 'Expired'
};
export function t(locale: string, key: string): string { return config.ui[locale]?.[key] ?? english[key] ?? key; }
export function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
