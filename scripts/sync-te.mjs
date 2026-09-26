// Copies the app's Telugu dictionary (app/lib/l10n/te.dart) into src/i18n/te.json, so the website and the
// doctor app always use the same words. Runs before `next build`; if the app folder is not next to this one
// (the website's own repo on Vercel), the committed te.json is used as it is.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = process.env.OPFLOW_TE_DART ?? join(here, '..', '..', 'app', 'lib', 'l10n', 'te.dart');
const target = join(here, '..', 'src', 'i18n', 'te.json');

if (!existsSync(source)) {
  console.log(`sync-te: ${source} not found; keeping the committed te.json`);
  process.exit(0);
}

const dart = readFileSync(source, 'utf8');
// One entry per line: 'English': 'Telugu', or "English with an apostrophe": 'Telugu'.
const entry = /^\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,?\s*$/;
const unescape = (s) => s.replace(/\\(['"\\$n])/g, (_, c) => (c === 'n' ? '\n' : c));
const out = {};
for (const line of dart.split(/\r?\n/)) {
  const m = entry.exec(line);
  if (!m) continue;
  out[unescape(m[1] ?? m[2])] = unescape(m[3] ?? m[4]);
}
const count = Object.keys(out).length;
if (count < 100) {
  console.error(`sync-te: only ${count} entries read from ${source}; the format may have changed`);
  process.exit(1);
}
writeFileSync(target, `${JSON.stringify(out, null, 1)}\n`);
console.log(`sync-te: ${count} Telugu texts → src/i18n/te.json`);
