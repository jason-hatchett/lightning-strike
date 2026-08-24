/* ============================================================
   Sprite renderer — composites the 6 part layers and applies the
   scheme palette-swap on a canvas. Browser-only (uses <canvas>).
   Sprite data (window.SPRITES) comes from assets/sprites.js, imported
   for its side effect so it is populated before SPR is read below.
   ============================================================ */
import '../assets/sprites.js';
import { SCHEMES, SMASTER } from './schemes.js';

export const SPR = window.SPRITES || {}, FRAME = 64, DRAWORDER = ['backpack', 'legs', 'larm', 'core', 'head', 'rarm'];
export const ENEMY_KEY2SLOT = { weapon: 'rarm', core: 'core', backpack: 'backpack', head: 'head', legs: 'legs', larm: 'larm' };

const _hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const _key = (r, g, b) => r << 16 | g << 8 | b;
function _lut(scheme) {
  const s = SCHEMES[scheme] || SCHEMES.Vanguard, m = new Map();
  SMASTER.base.forEach((h, i) => m.set(_key(..._hx(h)), _hx(s.base[i])));
  SMASTER.sec.forEach((h, i) => m.set(_key(..._hx(h)), _hx(s.sec[i])));
  SMASTER.trim.forEach((h, i) => m.set(_key(..._hx(h)), _hx(s.trim[i])));
  m.set(_key(..._hx(SMASTER.glow)), _hx(s.trim[1])); return m;
}
const _imgs = {}; let _spritesReady = false;
export function preloadSprites(cb) {
  const ks = Object.keys(SPR); if (!ks.length) { _spritesReady = true; cb && cb(); return; }
  let done = 0; ks.forEach(k => { const im = new Image(); im.onload = im.onerror = () => { _imgs[k] = im; if (++done >= ks.length) { _spritesReady = true; cb && cb(); } }; im.src = SPR[k].uri; });
}
const _rc = {};
function _recolored(k, scheme) {
  const ck = k + '|' + scheme; if (_rc[ck]) return _rc[ck];
  const im = _imgs[k], c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0);
  const L = _lut(scheme), d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { if (p[i + 3] === 0) continue; const r = L.get(_key(p[i], p[i + 1], p[i + 2])); if (r) { p[i] = r[0]; p[i + 1] = r[1]; p[i + 2] = r[2]; } }
  x.putImageData(d, 0, 0); _rc[ck] = c; return c;
}
function _frameIndex(k, tag) { const m = SPR[k]; return (m && m.tags && m.tags[tag] != null) ? m.tags[tag] : 0; }
export function drawMech(canvas, loadout, scheme, scale) {
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height); if (!_spritesReady) return;
  for (const slot of DRAWORDER) {
    const id = loadout[slot]; if (!id) continue; const key = slot + '/' + id; if (!_imgs[key]) continue;
    const sheet = _recolored(key, scheme), fi = _frameIndex(key, 'idle');
    ctx.drawImage(sheet, fi * FRAME, 0, FRAME, FRAME, 0, 0, FRAME * scale, FRAME * scale);
  }
}
export function mkMechCanvas(scale) {
  const c = document.createElement('canvas'); c.width = FRAME * scale; c.height = FRAME * scale;
  c.style.width = (FRAME * scale) + 'px'; c.style.imageRendering = 'pixelated'; return c;
}
export function schemeOf(m) { return m.scheme || 'Vanguard'; }
export function drawMechTags(canvas, loadout, scheme, tags, latched, scale) {
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height); if (!_spritesReady) return;
  for (const slot of DRAWORDER) {
    const id = loadout[slot]; if (!id) continue; const key = slot + '/' + id; if (!_imgs[key]) continue;
    const tag = (latched && latched[slot]) || (tags && tags[slot]) || 'idle';
    const sheet = _recolored(key, scheme), fi = _frameIndex(key, tag);
    ctx.drawImage(sheet, fi * FRAME, 0, FRAME, FRAME, 0, 0, FRAME * scale, FRAME * scale);
  }
}
export function drawMonoSprite(canvas, monoId, scheme, scale) {
  const key = 'mono/' + monoId, ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height); if (!_spritesReady || !_imgs[key]) return;
  const m = SPR[key], sz = Array.isArray(m.size) ? m.size : [m.size, m.size], sheet = _recolored(key, scheme);
  ctx.drawImage(sheet, 0, 0, sz[0], sz[1], 0, 0, sz[0] * scale, sz[1] * scale);
}
// Compose a mech, crop to its non-transparent content box, and render it scaled to fill `canvas`.
export function drawMechCropped(canvas, loadout, scheme, scale, pad) {
  scale = scale || 3; pad = pad == null ? 1 : pad;
  const off = document.createElement('canvas'); off.width = FRAME; off.height = FRAME;
  drawMechTags(off, loadout, scheme, null, null, 1);
  let x0 = FRAME, y0 = FRAME, x1 = 0, y1 = 0, any = false;
  if (_spritesReady) {
    const d = off.getContext('2d').getImageData(0, 0, FRAME, FRAME).data;
    for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) { if (d[(y * FRAME + x) * 4 + 3]) { any = true; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  }
  if (!any) { x0 = 0; y0 = 0; x1 = FRAME - 1; y1 = FRAME - 1; }
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(FRAME - 1, x1 + pad); y1 = Math.min(FRAME - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1; canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, x0, y0, w, h, 0, 0, w * scale, h * scale);
}
