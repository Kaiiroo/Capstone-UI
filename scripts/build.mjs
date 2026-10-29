// Copies only the public website files into dist/ for Cloudflare Pages.
// Anything not listed here (.env, server.py, supabase/, Prescription-Images/) is never deployed.
import { cpSync, readdirSync, rmSync } from 'node:fs';

const OUTPUT_DIR = 'dist';
const PUBLIC_DIRS = ['assets', 'js'];

rmSync(OUTPUT_DIR, { recursive: true, force: true });

const publicFiles = readdirSync('.').filter((name) => name.endsWith('.html') || name === 'styles.css');
for (const name of publicFiles) {
  cpSync(name, `${OUTPUT_DIR}/${name}`);
}
for (const name of PUBLIC_DIRS) {
  cpSync(name, `${OUTPUT_DIR}/${name}`, { recursive: true });
}

console.log(`Built ${OUTPUT_DIR}/ with ${publicFiles.length} files plus ${PUBLIC_DIRS.join(', ')}/`);
