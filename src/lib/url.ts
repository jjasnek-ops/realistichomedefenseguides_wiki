// Adapted from the upstream central URL builders; every page uses one trailing-slash policy.
import { defaultLocale, type Locale } from '../i18n/routing';
import { siteUrl, homeFor } from './config';
export function localizePath(path: string, locale: Locale): string {
  const clean = `/${path.replace(/^\/+|\/+$/g, '')}`;
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return `${prefix}${clean === '/' ? '' : clean}/`;
}
export const homeUrl = (locale: Locale = defaultLocale) => localizePath('/', homeFor(locale) ? locale : defaultLocale);
export const listPath = (category: string, locale: Locale = defaultLocale) => localizePath(category, locale);
export const detailPath = (category: string, slug: string, locale: Locale = defaultLocale) => localizePath(`${category}/${slug}`, locale);
export const absoluteUrl = (path: string) => new URL(path, siteUrl).href;
export const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);
