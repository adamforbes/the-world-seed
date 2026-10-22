// Renders a scene from art/scenes/ to a looping MP4 and a WebP still per theme.
//
//   npm run render -- hero-map                 → assets/media/hero-map-{light,dark}.{mp4,webp}
//   npm run render -- hero-map --stills 0,96   → PNGs of those frames in art/out/, no video
//   npm run render -- hero-map --theme dark    → one theme only
//   npm run render -- glyph-map --poster       → just the WebP stills, for scenes the site plays live
//
// Frames are drawn in headless Chrome (the installed Google Chrome) and piped
// to ffmpeg. Videos are silent H.264, tagged as sRGB so the paper colour
// matches the page.

import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const opt = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
if (!name) {
  console.error('Usage: npm run render -- <scene> [--stills 0,96] [--poster] [--theme light|dark] [--crf 24]');
  process.exit(1);
}

const sceneUrl = pathToFileURL(path.join(here, 'scenes', `${name}.html`)).href + '?export';
const mediaDir = path.join(here, '..', 'assets', 'media');
const outDir = path.join(here, 'out');
const crf = opt('--crf') || '24';

const browser = await chromium.launch({ channel: 'chrome' });
const scene = await browser.newPage();
await scene.goto(sceneUrl);
await scene.waitForFunction(() => window.SCENE?.ready);
const meta = await scene.evaluate(() => {
  const { name, width, height, fps, frames, themes, poster } = window.SCENE;
  return { name, width, height, fps, frames, themes, poster };
});
const themes = opt('--theme') ? [opt('--theme')] : meta.themes;
const grab = async (frame, theme, type = 'image/png', quality) => {
  const url = await scene.evaluate(([f, t, ty, q]) => window.SCENE.renderFrame(f, t, ty, q), [frame, theme, type, quality]);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};

if (opt('--stills')) {
  await mkdir(outDir, { recursive: true });
  for (const theme of themes) {
    for (const frame of opt('--stills').split(',').map(Number)) {
      const file = path.join(outDir, `${name}-${theme}-${frame}.png`);
      await writeFile(file, await grab(frame, theme));
      console.log(file);
    }
  }
  await browser.close();
  process.exit(0);
}

await mkdir(mediaDir, { recursive: true });
if (args.includes('--poster')) {
  for (const theme of themes) {
    const file = path.join(mediaDir, `${name}-${theme}.webp`);
    await writeFile(file, await grab(meta.poster, theme, 'image/webp', 0.9));
    console.log(file);
  }
  await browser.close();
  process.exit(0);
}
for (const theme of themes) {
  const base = path.join(mediaDir, `${name}-${theme}`);
  const ffmpeg = spawn(ffmpegPath, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(meta.fps), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-tune', 'animation',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv',
    '-movflags', '+faststart', '-an',
    `${base}.mp4`,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve())));

  for (let frame = 0; frame < meta.frames; frame++) {
    if (!ffmpeg.stdin.write(await grab(frame, theme))) await new Promise((r) => ffmpeg.stdin.once('drain', r));
    if (frame % meta.fps === 0) process.stdout.write(`\r${theme}: frame ${frame}/${meta.frames}`);
  }
  ffmpeg.stdin.end();
  await done;
  await writeFile(`${base}.webp`, await grab(meta.poster, theme, 'image/webp', 0.9));
  const kb = async (f) => Math.round((await stat(f)).size / 1024);
  console.log(`\r${theme}: ${base}.mp4 (${await kb(`${base}.mp4`)} KB), .webp (${await kb(`${base}.webp`)} KB)`);
}
await browser.close();
