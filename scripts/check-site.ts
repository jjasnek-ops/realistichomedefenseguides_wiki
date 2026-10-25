import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { load, type CheerioAPI } from 'cheerio';
import { config, siteUrl, homeConfig } from '../src/lib/config';
import { sourceArticles } from './content-source';
import { checkArticleImport } from './import-files';

checkArticleImport(process.cwd(), config);
const errors: string[] = [];
const source = sourceArticles();
const searchablePaths = new Set(source.filter(entry => !entry.data.draft && !entry.data.noindex).map(entry => entry.path));
const htmlFiles: string[] = [];
function walk(directory: string) { for (const file of readdirSync(directory, { withFileTypes: true })) { const path = join(directory, file.name); if (file.isDirectory()) walk(path); else if (file.name.endsWith('.html')) htmlFiles.push(path); } }
walk('dist');
const documents = new Map<string, CheerioAPI>();
for (const file of htmlFiles) {
  const path = relative('dist', file).replaceAll('\\', '/');
  documents.set(path === 'index.html' ? '/' : path === '404.html' ? '/404/' : `/${path.replace(/index\.html$/, '')}`, load(readFileSync(file, 'utf8')));
}
const check = (condition: unknown, message: string) => { if (!condition) errors.push(message); };
const noindexPaths = new Set<string>();
const pageTitles = new Set<string>();
let linksChecked = 0;
let alternatesChecked = 0;
for (const [path, $] of documents) {
  const html = $.html();
  const title = $('title').text();
  check(title && !pageTitles.has(title), `${path}: title missing or duplicated.`); pageTitles.add(title);
  check($('h1').length === 1, `${path}: expected exactly one H1, got ${$('h1').length}.`);
  check($('meta[name="description"]').attr('content'), `${path}: missing description.`);
  check($('link[rel="canonical"]').attr('href') === `${siteUrl}${path}`, `${path}: canonical does not match the generated URL.`);
  for (const selector of ['meta[property="og:title"]','meta[property="og:description"]','meta[property="og:image"]','meta[property="og:image:alt"]','meta[property="og:url"]','meta[name="twitter:card"]']) check($(selector).attr('content'), `${path}: missing ${selector}.`);
  const locale = $('html').attr('lang')!;
  check(config.languages.includes(locale), `${path}: invalid html language.`);
  const isNoindex = $('meta[name="robots"]').attr('content')?.includes('noindex');
  if (isNoindex) { noindexPaths.add(path); check(!$('[data-pagefind-body]').length && $('html').attr('data-pagefind-ignore') === 'all', `${path}: noindex is not excluded from Pagefind.`); }
  else check($('[data-pagefind-body]').length === (searchablePaths.has(path) ? 1 : 0), `${path}: Pagefind should index published articles only.`);
  $('img').each((_, image) => { const node = $(image); check(node.attr('alt') !== undefined, `${path}: image missing alt.`); check(node.attr('width') && node.attr('height'), `${path}: image missing intrinsic dimensions.`); });
  const ids = new Set<string>();
  $('[id]').each((_, element) => { const id = $(element).attr('id')!; check(!ids.has(id), `${path}: duplicate ID ${id}`); ids.add(id); });
  $('a[href],link[rel="alternate"],img[src],script[src],link[rel="stylesheet"]').each((_, element) => {
    const node = $(element); const attr = node.attr('href') ?? node.attr('src')!;
    if (!attr || /^(?:mailto:|tel:|data:)/.test(attr)) return;
    const url = new URL(attr, `${siteUrl}${path}`);
    if (url.origin !== siteUrl) return;
    linksChecked++;
    const target = decodeURIComponent(url.pathname);
    if (documents.has(target)) {
      if (url.hash) check(documents.get(target)!(`[id="${decodeURIComponent(url.hash.slice(1)).replaceAll('"', '\\"')}"]`).length, `${path}: broken anchor ${attr}`);
    } else check(existsSync(join('dist', target)), `${path}: broken internal link or asset ${attr}`);
  });
  $('link[rel="alternate"][hreflang]').each((_, element) => {
    const language = $(element).attr('hreflang')!;
    const targetPath = new URL($(element).attr('href')!).pathname;
    const target = documents.get(targetPath);
    alternatesChecked++;
    check(!isNoindex, `${path}: noindex page advertises alternate languages.`);
    check(target && !target('meta[name="robots"]').attr('content')?.includes('noindex'), `${path}: alternate points at absent or noindex page ${targetPath}.`);
    if (target && language !== 'x-default') { check(target('html').attr('lang') === language, `${path}: alternate language mismatch.`); check(target(`link[hreflang="${locale}"]`).attr('href') === `${siteUrl}${path}`, `${path}: alternate is not reciprocal.`); }
  });
  $('script[type="application/ld+json"]').each((_, node) => {
    try { const data = JSON.parse($(node).text()); const list = Array.isArray(data) ? data : [data]; check(list.every(item => item['@type']), `${path}: JSON-LD missing @type.`); check(!/"(?:aggregateRating|review|offers)"/.test(JSON.stringify(data)), `${path}: unsupported ratings, reviews or offers.`); } catch { errors.push(`${path}: invalid JSON-LD.`); }
  });
  check(!/(?:Anvil Quest|Emberfang|Voidforge|Frostbound Monarch|VV[: ]?\s*ULTIMATUM|anvil\.wiki|GameForge)/i.test($('body').text()), `${path}: upstream identity leaked into the UI.`);
  check(!html.includes('hidden-copper-draft'), `${path}: draft text leaked.`);
  check(!html.includes('__VITE_PRELOAD__'), `${path}: unresolved Vite dynamic-import placeholder would break search.`);
}
const sitemap = load(readFileSync('dist/sitemap.xml', 'utf8'), { xmlMode: true });
const sitemapPaths = new Set<string>();
sitemap('url').each((_, url) => {
  const node = sitemap(url); const path = new URL(node.find('loc').text()).pathname;
  const document = documents.get(path);
  check(document && !noindexPaths.has(path), `Sitemap includes missing or noindex URL: ${path}`);
  check(!sitemapPaths.has(path), `Sitemap URL duplicated: ${path}`); sitemapPaths.add(path);
  check(/^\d{4}-\d{2}-\d{2}$/.test(node.find('lastmod').text()), `${path}: missing stable lastmod.`);
  if (document) {
    const inHead = new Set(document('link[rel="alternate"][hreflang]').toArray().filter(element => document(element).attr('hreflang') !== 'x-default').map(element => document(element).attr('href')));
    const inMap = new Set(node.find('xhtml\\:link').toArray().map(element => sitemap(element).attr('href')));
    check(JSON.stringify([...inHead].sort()) === JSON.stringify([...inMap].sort()), `${path}: sitemap hreflang differs from HTML.`);
  }
});
for (const path of documents.keys()) if (!noindexPaths.has(path)) check(sitemapPaths.has(path), `Indexable page absent from sitemap: ${path}`);
for (const entry of source) {
  if (entry.data.draft) { check(!documents.has(entry.path), `Draft route generated: ${entry.path}`); continue; }
  const document = documents.get(entry.path); check(document, `Published article missing: ${entry.path}`);
  if (!entry.data.noindex) {
    const mapEntry = sitemap('url').toArray().find(node => sitemap(node).find('loc').text() === `${siteUrl}${entry.path}`);
    check(mapEntry && sitemap(mapEntry).find('lastmod').text() === entry.data.lastModified, `${entry.path}: lastmod differs from MDX.`);
  }
}
for (const locale of config.languages) {
  const localized = source.filter(entry => entry.locale === locale && !entry.data.draft && !entry.data.noindex);
  for (const nav of config.navigation) if (!localized.some(entry => entry.category === nav.slug)) {
    const path = `/${locale === config.defaultLanguage ? '' : `${locale}/`}${nav.slug}/`;
    check(!documents.has(path), `Empty category generated: ${path}`);
  }
}
check(existsSync('dist/pagefind/pagefind.js'), 'Pagefind index missing.');
check(readFileSync('dist/robots.txt', 'utf8').includes(`${siteUrl}/sitemap.xml`), 'robots.txt sitemap is wrong.');
check(!existsSync('dist/_worker.js'), 'Unexpected SSR Worker output; expected static SSG.');
for (const module of homeConfig.explore?.modules ?? []) if (!module.enabled) check(!documents.get('/')!('h3').toArray().some(node => documents.get('/')!(node).text() === module.title), `Disabled module rendered: ${module.id}`);
const result = { pages: documents.size, indexablePages: sitemapPaths.size, noindexPages: [...noindexPaths], linksChecked, alternatesChecked, errors };
mkdirSync('validation', { recursive: true }); writeFileSync('validation/site-check.json', JSON.stringify(result, null, 2));
if (errors.length) throw new Error(`Site checks failed (${errors.length}):\n${errors.join('\n')}`);
console.log(`Site OK: ${documents.size} HTML pages; ${sitemapPaths.size} indexable; ${linksChecked} links/assets; ${alternatesChecked} alternates. SEO, anchors, sitemap dates, draft/noindex, languages, disabled modules, brands and Pagefind files valid.`);
