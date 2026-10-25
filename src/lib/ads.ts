import { config } from '~/lib/config';

export type AdProvider = 'adsense' | 'adsterra';

const configuredProvider = import.meta.env.NEXT_PUBLIC_AD_PROVIDER?.trim().toLowerCase();
const isAdProvider = (value: string | undefined): value is AdProvider => value === 'adsense' || value === 'adsterra';

export const activeAdProvider: AdProvider = isAdProvider(configuredProvider)
  ? configuredProvider
  : config.integrations.ads
    ? 'adsense'
    : 'adsterra';

interface AdsterraSlot {
  key: string;
  format: 'native' | 'iframe';
  width: number;
  height: number;
}

const adsterraSlots: Record<string, AdsterraSlot> = {
  'native-banner': { key: import.meta.env.NEXT_PUBLIC_AD_NATIVE_BANNER ?? '', format: 'native', width: 0, height: 0 },
  'home-banner': { key: import.meta.env.NEXT_PUBLIC_AD_BANNER_728X90 ?? '', format: 'iframe', width: 728, height: 90 },
  'home-rectangle': { key: import.meta.env.NEXT_PUBLIC_AD_BANNER_300X250 ?? '', format: 'iframe', width: 300, height: 250 },
  'article-bottom': { key: import.meta.env.NEXT_PUBLIC_AD_BANNER_468X60 ?? '', format: 'iframe', width: 468, height: 60 },
  'article-sidebar': { key: import.meta.env.NEXT_PUBLIC_AD_SIDEBAR_160X600 ?? '', format: 'iframe', width: 160, height: 600 },
  'article-sidebar-compact': { key: import.meta.env.NEXT_PUBLIC_AD_SIDEBAR_160X300 ?? '', format: 'iframe', width: 160, height: 300 },
  'mobile-banner': { key: import.meta.env.NEXT_PUBLIC_AD_MOBILE_320X50 ?? '', format: 'iframe', width: 320, height: 50 }
};

export function getAdsterraSlot(slot: string): AdsterraSlot | null {
  if (activeAdProvider !== 'adsterra') return null;
  const ad = adsterraSlots[slot];
  return ad?.key ? ad : null;
}
