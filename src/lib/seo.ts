// Adapted from the MIT upstream JSON-LD builders. Only emitted facts are supplied by site configuration or article data.
import { config, siteUrl, siteName, description } from './config';
import { absoluteUrl, homeUrl, escapeXml } from './url';
import type { Page, WikiArticle } from './content';

export function pageTitle(title: string, locale: string): string {
  if (title.includes(config.gameName)) return title;
  return `${title} — ${title.length > 50 ? config.shortName : siteName(locale)}`;
}
export function organizationJsonLd() {
  return { '@context': 'https://schema.org', '@type': 'Organization', '@id': `${siteUrl}/#organization`, name: config.siteName, url: siteUrl, logo: absoluteUrl(config.logo) };
}
export function websiteJsonLd(locale: string) {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: siteName(locale), url: absoluteUrl(homeUrl(locale)), description: description(locale), inLanguage: locale };
}
export function videoGameJsonLd() {
  return { '@context': 'https://schema.org', '@type': 'VideoGame', name: config.gameName, description: config.description, image: absoluteUrl(config.seo.image), gamePlatform: config.platform, genre: config.genre, ...(config.officialUrl ? { url: config.officialUrl } : {}) };
}
export function articleJsonLd(entry: WikiArticle) {
  return { '@context': 'https://schema.org', '@type': 'Article', headline: entry.data.title, description: entry.data.description, image: absoluteUrl(entry.data.cover ?? config.seo.image), datePublished: entry.data.date, dateModified: entry.data.lastModified, inLanguage: entry.locale, publisher: { '@id': `${siteUrl}/#organization` }, mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(entry.path) } };
}
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absoluteUrl(item.path) })) };
}
export function itemListJsonLd(name: string, entries: WikiArticle[]) {
  return { '@context': 'https://schema.org', '@type': 'ItemList', name, itemListElement: entries.map((entry, index) => ({ '@type': 'ListItem', position: index + 1, name: entry.data.title, url: absoluteUrl(entry.path) })) };
}
export function sitemapXml(pages: Page[]) {
  const indexable = pages.filter(page => !page.noindex);
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${indexable.map(page => `<url><loc>${escapeXml(absoluteUrl(page.path))}</loc><lastmod>${page.lastModified}</lastmod>${indexable.filter(other => other.key === page.key).map(other => `<xhtml:link rel="alternate" hreflang="${escapeXml(other.locale)}" href="${escapeXml(absoluteUrl(other.path))}"/>`).join('')}</url>`).join('')}</urlset>`;
}
