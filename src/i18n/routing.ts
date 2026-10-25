import { config } from '../lib/config';
export const locales = config.languages;
export const defaultLocale = config.defaultLanguage;
export type Locale = string;
export const LOCALE_LABELS = config.localeLabels;
export const OG_LOCALE_MAP: Record<string, string> = { en: 'en_US', zh: 'zh_CN', ja: 'ja_JP', de: 'de_DE', fr: 'fr_FR', ko: 'ko_KR', es: 'es_ES', pt: 'pt_BR' };
export const isLocale = (value: string): value is Locale => locales.includes(value);
export const isDefaultLocale = (value: string) => value === defaultLocale;
