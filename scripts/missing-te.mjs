// Lists website texts (t('…') calls) that have no Telugu yet in src/i18n/te.json or te-web.json.
// Usage: node scripts/missing-te.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const te = { ...JSON.parse(readFileSync(join(root, 'src/i18n/te.json'), 'utf8')), ...JSON.parse(readFileSync(join(root, 'src/i18n/te-web.json'), 'utf8')) };
const missing = new Set();
const call = /\bt\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
// Texts kept in lists and translated where they are shown.
const listed = /^\s*(?:\[?\s*)?['"]([A-Z][^'"]{1,120})['"]/;

function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f)) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(call)) {
        const k = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
        if (!te[k]) missing.add(k);
      }
      // Labels in constant tables: 'Done', ['off', 'Not available', 'Patients will…'] …
      for (const line of src.split('\n')) {
        if (!/(label|:\s*\[|^\s*\[|: ')/.test(line)) continue;
        for (const m of line.matchAll(/'([A-Z][A-Za-z ,.'’()%–-]{2,120})'/g)) if (!te[m[1]] && !/^[A-Z_]+$/.test(m[1])) missing.add(m[1]);
      }
      void listed;
    }
  }
}
walk(join(root, 'src'));
console.log([...missing].sort().join('\n'));
