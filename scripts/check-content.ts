import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config, homeConfig } from '../src/lib/config';
import { sourceArticles } from './content-source';
import { homeUrl, listPath, localizePath } from '../src/lib/url';
import { checkArticleImport } from './import-files';

checkArticleImport(process.cwd(), config);
const articles = sourceArticles();
const published = articles.filter(entry => !entry.data.draft);
const routes = new Set(published.map(entry => entry.path));
for (const locale of config.languages) {
  const home = locale === config.defaultLanguage ? homeConfig : homeConfig.translations[locale];
  if (home) {
    routes.add(homeUrl(locale));
  }
  if (locale === config.defaultLanguage || config.legal.translations[locale]) for (const page of ['about', 'privacy', 'terms']) routes.add(localizePath(page, locale));
  const entries = published.filter(entry => entry.locale === locale && !entry.data.noindex);
  if (entries.length) routes.add(localizePath('recent', locale));
  for (const category of new Set(entries.map(entry => entry.category))) routes.add(listPath(category, locale));
}
const errors: string[] = [];
function checkAsset(path: string, context: string) {
  if (!path.startsWith('/')) { errors.push(`${context}: asset must be root-relative.`); return; }
  const resolved = resolve('public', `.${path}`);
  if (!resolved.startsWith(`${resolve('public')}/`) && !resolved.startsWith(`${resolve('public')}\\`)) { errors.push(`${context}: asset escapes public/.`); return; }
  if (!existsSync(resolved)) errors.push(`${context}: missing asset ${path}`);
}
function checkLink(path: string, context: string) {
  if (path.startsWith('https://')) return;
  const pathname = path.split(/[?#]/)[0];
  if (!routes.has(pathname)) errors.push(`${context}: link has no published page: ${path}`);
}
function walk(value: unknown, context: string) {
  if (Array.isArray(value)) { value.forEach((item, index) => walk(item, `${context}[${index}]`)); return; }
  if (!value || typeof value !== 'object') return;
  const obj = value as Record<string, unknown>;
  // Hidden home modules do not need destinations until enabled.
  if (obj.enabled === false) return;
  for (const [key, item] of Object.entries(obj)) {
    if (typeof item === 'string') {
      if (['image','cover','logo','favicon'].includes(key)) checkAsset(item, `${context}.${key}`);
      if (key === 'href') checkLink(item, `${context}.${key}`);
    } else walk(item, `${context}.${key}`);
  }
}
walk(config, 'site.config.json'); walk(homeConfig, 'home.json');
checkAsset(config.seo.image, 'site.config.json.seo.image');
for (const locale of Object.keys(homeConfig.translations)) if (!config.languages.includes(locale)) errors.push(`home.translations.${locale}: language is not enabled.`);
const translationKeys = new Set<string>();
for (const entry of published) {
  const key = `${entry.locale}:${entry.key}`;
  if (translationKeys.has(key)) errors.push(`${entry.file}: duplicate translationKey ${key}`);
  translationKeys.add(key);
  walk(entry.data, entry.file);
  for (const key of entry.data.related) if (!published.some(other => other.locale === entry.locale && !other.data.noindex && other.key === key && other.id !== entry.id)) errors.push(`${entry.file}: related entry ${key} is missing, self-referencing or not indexable in this language.`);
  for (const path of entry.data.item?.guides ?? []) checkLink(path, `${entry.file}.item.guides`);
}
for (const locale of config.languages) {
  const home = locale === config.defaultLanguage ? homeConfig : homeConfig.translations[locale];
  if (!home) continue;
  for (const key of home.featuredGuides) if (!published.some(entry => entry.locale === locale && !entry.data.noindex && entry.key === key)) errors.push(`home[${locale}].featuredGuides: ${key} has no indexable article in this locale.`);
  const ids = home.explore?.modules.map(module => module.id) ?? [];
  if (new Set(ids).size !== ids.length) errors.push(`home[${locale}].explore: module IDs must be unique.`);
}
if (!config.demo && /(?:^|\.)(?:example\.com|example\.org|example\.net)$/.test(config.domain)) errors.push('Set a real domain before turning demo mode off.');
if (errors.length) throw new Error(`Content checks failed:\n${errors.map(error => `  ${error}`).join('\n')}`);
console.log(`Content OK: ${articles.length} MDX files, ${published.length} published (${published.filter(entry => entry.data.noindex).length} noindex), ${config.languages.length} languages. Config, categories, references and assets valid.`);
