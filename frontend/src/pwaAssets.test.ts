import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pwaOptions } from '../pwa.config';

const root = path.resolve(__dirname, '..');
const PNG_SIGNATURE = '89504e470d0a1a0a';

const pngSize = (file: string): { w: number; h: number } => {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};

// "/icons/a.png" -> frontend/public/icons/a.png
const publicFile = (src: string): string => path.join(root, 'public', src.replace(/^\//, ''));

describe('PWA manifest assets', () => {
  const manifest = pwaOptions.manifest as Exclude<typeof pwaOptions.manifest, false | undefined>;

  it('has the fields needed for installability', () => {
    for (const key of ['name', 'short_name', 'description', 'id', 'start_url', 'scope', 'display', 'theme_color', 'background_color', 'lang']) {
      expect(manifest[key as keyof typeof manifest], key).toBeTruthy();
    }
  });

  it('references only icon files that exist, with the declared size', () => {
    const icons = manifest.icons ?? [];
    expect(icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(true);
    expect(icons.some((i) => i.purpose === 'any' && i.sizes === '512x512')).toBe(true);
    for (const icon of icons) {
      const file = publicFile(icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [w, h] = (icon.sizes ?? '').split('x').map(Number);
      expect(pngSize(file)).toEqual({ w, h });
    }
  });

  it('shortcut icons and includeAssets exist', () => {
    for (const s of manifest.shortcuts ?? []) {
      for (const icon of s.icons ?? []) expect(existsSync(publicFile(icon.src)), icon.src).toBe(true);
    }
    for (const a of pwaOptions.includeAssets as string[]) expect(existsSync(path.join(root, 'public', a)), a).toBe(true);
  });

  it('index.html links only existing local icons and matches the theme colour', () => {
    const html = readFileSync(path.join(root, 'index.html'), 'utf8');
    const hrefs = [...html.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon)"[^>]+href="(\/[^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    for (const href of hrefs) expect(existsSync(publicFile(href)), href).toBe(true);
    expect(html).toContain(`<meta name="theme-color" content="${manifest.theme_color}"`);
  });
});
