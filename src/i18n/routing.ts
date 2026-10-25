import { config } from '../lib/config';
export const locales = config.languages;
export const defaultLocale = config.defaultLanguage;
export type Locale = string;
export const LOCALE_LABELS = config.localeLabels;
export const OG_LOCALE_MAP: Record<string, string> = { en: 'en_US', de: 'de_DE', 'pt-br': 'pt_BR', ja: 'ja_JP' };
export const isLocale = (value: string): value is Locale => locales.includes(value);
export const isDefaultLocale = (value: string) => value === defaultLocale;
