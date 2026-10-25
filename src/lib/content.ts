import { getCollection } from 'astro:content';
import { config, homeFor } from './config';
import { parseEntryId, selectRelatedEntries } from './content-utils';
import { detailPath, homeUrl, listPath, localizePath } from './url';

export async function articles() {
  const entries = await getCollection('wiki');
  return entries.filter(entry => !entry.data.draft).map(entry => {
    const parts = parseEntryId(entry.id);
    if (!parts) throw new Error(`Invalid content path: ${entry.id}`);
    if (parts.category !== entry.data.category) throw new Error(`${entry.id}: category must match its directory.`);
    return { ...entry, ...parts, path: detailPath(parts.category, parts.slug, parts.locale), key: entry.data.translationKey ?? `${parts.category}/${parts.slug}` };
  }).sort((a, b) => b.data.lastModified.localeCompare(a.data.lastModified) || a.id.localeCompare(b.id));
}
export type WikiArticle = Awaited<ReturnType<typeof articles>>[number];
export const visible = (pool: WikiArticle[], locale: string) => pool.filter(entry => entry.locale === locale && !entry.data.noindex);
export function related(pool: WikiArticle[], current: WikiArticle) {
  const candidates = visible(pool, current.locale).filter(entry => entry.id !== current.id);
  const explicit = current.data.related.map(key => candidates.find(entry => entry.key === key)).filter((entry): entry is WikiArticle => !!entry);
  const toSortable = (entry: WikiArticle) => ({ ...entry, data: { ...entry.data, date: new Date(entry.data.lastModified) } });
  const picked = selectRelatedEntries(candidates.map(toSortable), toSortable(current), 3);
  const ids = [...new Set([...explicit.map(entry => entry.id), ...picked.map(entry => entry.id)])].slice(0, 3);
  return ids.map(id => candidates.find(entry => entry.id === id)!);
}
export type Page = { path: string; locale: string; key: string; type: 'home' | 'category' | 'article' | 'recent' | 'legal'; title?: string; category?: string; entry?: WikiArticle; lastModified: string; noindex?: boolean; legal?: 'about' | 'privacy' | 'terms' };
export function pagesFor(pool: WikiArticle[]): Page[] {
  const pages: Page[] = [];
  for (const locale of config.languages) {
    const entries = visible(pool, locale);
    const home = homeFor(locale);
    if (home) pages.push({ path: homeUrl(locale), locale, key: 'home', type: 'home', lastModified: [home.lastModified, ...entries.map(entry => entry.data.lastModified)].sort().at(-1)! });
    const categories = [...new Set(entries.map(entry => entry.category))];
    for (const category of categories) pages.push({ path: listPath(category, locale), locale, key: `category:${category}`, type: 'category', category, lastModified: entries.filter(entry => entry.category === category)[0].data.lastModified });
    if (entries.length) pages.push({ path: localizePath('/recent', locale), locale, key: 'recent', type: 'recent', lastModified: entries[0].data.lastModified });
    if (locale === config.defaultLanguage || config.legal.translations[locale]) for (const legal of ['about', 'privacy', 'terms'] as const) pages.push({ path: localizePath(`/${legal}`, locale), locale, key: `legal:${legal}`, type: 'legal', legal, lastModified: config.legal.lastModified });
  }
  for (const entry of pool) pages.push({ path: entry.path, locale: entry.locale, key: `article:${entry.key}`, type: 'article', entry, lastModified: entry.data.lastModified, noindex: entry.data.noindex });
  return pages;
}
export const alternatesFor = (page: Page, pages: Page[]) => page.noindex ? [] : pages.filter(other => other.key === page.key && !other.noindex).map(other => ({ locale: other.locale, path: other.path }));
