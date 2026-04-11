#!/usr/bin/env node
/**
 * Optimize images in artwork/ by generating AVIF + WebP siblings alongside
 * existing PNGs/JPEGs. Idempotent: skips files whose sibling already exists
 * and is newer than the source.
 *
 * Usage:
 *   node scripts/optimize-images.mjs           # process default dirs
 *   node scripts/optimize-images.mjs --force   # rebuild all, ignore cache
 *   node scripts/optimize-images.mjs path/a    # process specific dirs
 *
 * Requirements: `sharp` must be resolvable. It is listed in devDependencies
 * so a plain `pnpm install` (or the `make optimize-images` target) is enough.
 */
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
try {
	sharp = require('sharp');
} catch (e) {
	console.error('ERROR: could not load sharp. Install it with:');
	console.error('  pnpm add -D sharp');
	console.error('or run: make optimize-images');
	process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DEFAULT_DIRS = ['artwork'];
const MAX_WIDTH = 1600; // AVIF/WebP siblings are capped at this width
const AVIF_QUALITY = 55; // AVIF at 55 looks visually indistinguishable at this size
const WEBP_QUALITY = 80;

// File types we will look for as source images. Favicons and existing
// optimized siblings are skipped further below.
const SOURCE_RE = /\.(png|jpe?g)$/i;

const args = process.argv.slice(2);
const force = args.includes('--force');
const explicitDirs = args.filter((a) => !a.startsWith('--'));
const dirs = (explicitDirs.length ? explicitDirs : DEFAULT_DIRS).map((d) =>
	path.resolve(PROJECT_ROOT, d)
);

async function* walk(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(full);
		} else if (SOURCE_RE.test(entry.name)) {
			yield full;
		}
	}
}

async function mtimeOrZero(p) {
	try {
		const s = await fs.stat(p);
		return s.mtimeMs;
	} catch {
		return 0;
	}
}

async function processOne(sourcePath) {
	const base = sourcePath.replace(SOURCE_RE, '');
	const avifPath = `${base}.avif`;
	const webpPath = `${base}.webp`;

	const srcMtime = await mtimeOrZero(sourcePath);
	const avifMtime = await mtimeOrZero(avifPath);
	const webpMtime = await mtimeOrZero(webpPath);

	const needAvif = force || avifMtime < srcMtime;
	const needWebp = force || webpMtime < srcMtime;

	if (!needAvif && !needWebp) {
		return { skipped: true };
	}

	// Read metadata once to decide on resize
	const source = sharp(sourcePath, { failOnError: false });
	const meta = await source.metadata();
	const shouldResize = (meta.width ?? 0) > MAX_WIDTH;

	const pipeline = () => {
		const p = sharp(sourcePath, { failOnError: false });
		return shouldResize ? p.resize({ width: MAX_WIDTH, withoutEnlargement: true }) : p;
	};

	const results = {};
	if (needAvif) {
		await pipeline().avif({ quality: AVIF_QUALITY, effort: 4 }).toFile(avifPath);
		results.avifBytes = (await fs.stat(avifPath)).size;
	}
	if (needWebp) {
		await pipeline().webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(webpPath);
		results.webpBytes = (await fs.stat(webpPath)).size;
	}

	results.sourceBytes = (await fs.stat(sourcePath)).size;
	return results;
}

function formatKB(n) {
	return `${(n / 1024).toFixed(0)} KB`;
}

(async () => {
	let totalSource = 0;
	let totalAvif = 0;
	let totalWebp = 0;
	let processed = 0;
	let skipped = 0;
	let errors = 0;

	for (const dir of dirs) {
		try {
			await fs.access(dir);
		} catch {
			console.warn(`skip: ${dir} (not found)`);
			continue;
		}
		console.log(`\nscanning: ${path.relative(PROJECT_ROOT, dir)}`);
		for await (const sourcePath of walk(dir)) {
			try {
				const r = await processOne(sourcePath);
				if (r.skipped) {
					skipped++;
					continue;
				}
				processed++;
				totalSource += r.sourceBytes ?? 0;
				totalAvif += r.avifBytes ?? 0;
				totalWebp += r.webpBytes ?? 0;
				const rel = path.relative(PROJECT_ROOT, sourcePath);
				console.log(
					`  ${rel}  ${formatKB(r.sourceBytes ?? 0)} \u2192 avif ${formatKB(
						r.avifBytes ?? 0
					)}, webp ${formatKB(r.webpBytes ?? 0)}`
				);
			} catch (e) {
				errors++;
				console.error(`  ERROR ${path.relative(PROJECT_ROOT, sourcePath)}: ${e.message}`);
			}
		}
	}

	console.log('\n--- summary ---');
	console.log(`processed: ${processed}`);
	console.log(`skipped:   ${skipped} (already up to date)`);
	if (errors) console.log(`errors:    ${errors}`);
	if (processed) {
		console.log(`total source:       ${formatKB(totalSource)}`);
		if (totalAvif) {
			const avifPct = ((totalAvif / totalSource) * 100).toFixed(1);
			console.log(`total AVIF output:  ${formatKB(totalAvif)}  (${avifPct}% of source)`);
		}
		if (totalWebp) {
			const webpPct = ((totalWebp / totalSource) * 100).toFixed(1);
			console.log(`total WebP output:  ${formatKB(totalWebp)}  (${webpPct}% of source)`);
		}
	}
})();
