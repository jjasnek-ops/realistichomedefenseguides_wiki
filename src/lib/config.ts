import rawSite from '../../site.config.json';
import rawHome from '../../home.json';
import { siteSchema, homeSchema } from './schema';

function readConfig<T>(name: string, result: { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }): T {
  if (result.success) return result.data;
  throw new Error(`${name} validation failed:\n${result.error.issues.map(issue => `  ${issue.path.join('.')}: ${issue.message}`).join('\n')}`);
}
export const config = readConfig('site.config.json', siteSchema.safeParse(rawSite));
export const homeConfig = readConfig('home.json', homeSchema.safeParse(rawHome));
export const siteUrl = `https://${config.domain}`;
export function homeFor(locale: string) {
  return locale === config.defaultLanguage ? homeConfig : homeConfig.translations[locale];
}
export function siteName(locale: string) { return config.translations[locale]?.siteName ?? config.siteName; }
export function description(locale: string) { return config.translations[locale]?.description ?? config.description; }
export function categoryLabel(category: string, locale: string) {
  const nav = config.navigation.find(item => item.slug === category);
  return nav?.labels[locale] ?? nav?.label ?? category;
}
export function categoryDescription(category: string, locale: string) {
  const nav = config.navigation.find(item => item.slug === category);
  return nav?.descriptions[locale] ?? nav?.description ?? '';
}
