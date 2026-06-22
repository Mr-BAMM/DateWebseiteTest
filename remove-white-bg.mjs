#!/usr/bin/env node
/**
 * Removes white backgrounds from all character and option images.
 * Uses BFS flood-fill from the image edges to identify background pixels,
 * then makes them fully transparent. Anti-aliased edge pixels get a soft fade.
 *
 * Usage:
 *   npm install jimp   (first time only)
 *   node remove-white-bg.mjs
 */

import Jimp from 'jimp';
import fs   from 'fs';
import path from 'path';

const IMAGES = [
    'images/frog-happy.png',
    'images/frog-sad.png',
    'images/frogs-peaking.png',
    'images/frogs-together.png',
    'images/option-waterpark.png',
    'images/option-inventing.png',
    'images/option-cozy.png',
    'images/option-spicy.png',
];

const THRESHOLD  = 235; // pixels with all RGB channels above this = "white background"
const EDGE_RANGE = 28;  // alpha fade range for anti-aliased edge pixels

async function removeWhiteBackground(filePath) {
    const img = await Jimp.read(filePath);
    const w   = img.bitmap.width;
    const h   = img.bitmap.height;
    const d   = img.bitmap.data;       // Buffer: [R,G,B,A, R,G,B,A, ...]
    const vis = new Uint8Array(w * h); // 1 = confirmed background pixel

    // Is pixel at array-index `pos` whitish?
    const whitish = pos => {
        const i = pos * 4;
        return d[i] > THRESHOLD && d[i + 1] > THRESHOLD && d[i + 2] > THRESHOLD;
    };

    // ── BFS flood-fill from all four edges ──────────────────────────────────
    const queue = [];
    let   qi    = 0;

    const seed = pos => {
        if (!vis[pos] && whitish(pos)) { vis[pos] = 1; queue.push(pos); }
    };

    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
    for (let y = 1; y < h - 1; y++) { seed(y * w); seed(y * w + w - 1); }

    while (qi < queue.length) {
        const p  = queue[qi++];
        const px = p % w;
        const py = (p / w) | 0;
        if (px > 0   && !vis[p - 1] && whitish(p - 1)) { vis[p - 1] = 1; queue.push(p - 1); }
        if (px < w-1 && !vis[p + 1] && whitish(p + 1)) { vis[p + 1] = 1; queue.push(p + 1); }
        if (py > 0   && !vis[p - w] && whitish(p - w)) { vis[p - w] = 1; queue.push(p - w); }
        if (py < h-1 && !vis[p + w] && whitish(p + w)) { vis[p + w] = 1; queue.push(p + w); }
    }

    // ── Apply transparency ───────────────────────────────────────────────────
    for (let p = 0; p < w * h; p++) {
        const i  = p * 4;
        const px = p % w;
        const py = (p / w) | 0;

        if (vis[p]) {
            d[i + 3] = 0; // fully transparent
        } else {
            // Soft-fade anti-aliased pixels that border a background pixel
            const nearBg =
                (px > 0   && vis[p - 1]) || (px < w - 1 && vis[p + 1]) ||
                (py > 0   && vis[p - w]) || (py < h - 1 && vis[p + w]);
            if (nearBg) {
                const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3;
                if (brightness > THRESHOLD - EDGE_RANGE) {
                    d[i + 3] = Math.round(255 * (THRESHOLD - brightness) / EDGE_RANGE);
                }
            }
        }
    }

    await img.writeAsync(filePath);
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log('Removing white backgrounds...\n');
for (const f of IMAGES) {
    if (!fs.existsSync(f)) { console.log(`  SKIP (not found): ${f}`); continue; }
    process.stdout.write(`  ${f} ... `);
    await removeWhiteBackground(f);
    console.log('done');
}
console.log('\nAll done! Reload date-invite.html to see the result.');
