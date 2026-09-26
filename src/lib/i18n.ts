import te from '@/i18n/te.json';
import teWeb from '@/i18n/te-web.json';

/** English or Telugu, like the doctor app. The Telugu words are the app's own (src/i18n/te.json, synced). */
export type Lang = 'en' | 'te';

const dict: Record<string, string> = { ...(te as Record<string, string>), ...(teWeb as Record<string, string>) };

/**
 * `t(lang, 'Book {0}', ['Dr. Rao'])` → "Book Dr. Rao" / "Dr. Rao ని బుక్ చేయండి". A text without Telugu is
 * shown in English (never blank). Same keys as the app's .tr / .trf.
 */
export function t(lang: Lang, text: string, args?: ReadonlyArray<string | number>): string {
  let out = lang === 'te' ? (dict[text] ?? text) : text;
  args?.forEach((a, i) => {
    out = out.split(`{${i}}`).join(String(a));
  });
  return out;
}

/** A translator bound to one language, for components. */
export const translator = (lang: Lang) => (text: string, args?: ReadonlyArray<string | number>) => t(lang, text, args);
export type T = ReturnType<typeof translator>;
