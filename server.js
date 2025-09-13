import express from 'express';
import sharp from 'sharp';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 8080;

// ---------- makeSvg: centered title, up to 5 lines, smaller font ----------
const makeSvg = (w, h, rawTitle, rawSource) => {
  const esc = (s='') => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const title = (rawTitle || '').trim();
  const source = (rawSource || '').trim();

  // etwas kleinere Schriftgröße
  const base = Math.min(w, h);
  const fsTitle = Math.round(base * 0.05);      // vorher 0.06 → kleiner
  const fsSrc   = Math.round(base * 0.028);     // Quelle leicht kleiner
  const lineH   = Math.round(fsTitle * 1.12);
  const topPad  = Math.round(h * 0.08);
  const sidePad = Math.round(w * 0.08);
  const maxLines = 5;   // vorher 4 → jetzt 5

  // Zeichenbreite abschätzen
  const estCharsPerLine = Math.max(10, Math.floor((w - 2*sidePad) / (fsTitle * 0.60)));

  const words = title.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (test.length > estCharsPerLine) {
      if (line) lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  // Ellipsis wenn abgeschnitten
  const usedAllWords = (lines.join(' ').trim().length >= title.trim().length);
  if (!usedAllWords || lines.length > maxLines) {
    let last = lines[Math.min(lines.length, maxLines) - 1] || '';
    const maxForLast = estCharsPerLine - 1;
    if (last.length > maxForLast) last = last.slice(0, Math.max(0, maxForLast)) + '…';
    else if (!usedAllWords) last = last.replace(/\.*$/,'') + '…';
    lines.length = Math.min(lines.length, maxLines);
    lines[lines.length - 1] = last;
  }

  const blockH = lines.length * lineH;
  const startY = Math.max(topPad, Math.round(topPad + fsTitle * 0.2));

  const topBandH = Math.min(Math.round(blockH + fsTitle * 1.2), Math.round(h * 0.5));
  const bottomBandH = Math.round(h * 0.22);

  const strokeTitle = Math.max(1, Math.round(fsTitle*0.05));
  const strokeSrc   = Math.max(1, Math.round(fsSrc*0.08));

  return `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="gBot" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#000" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Balken oben/unten für Lesbarkeit -->
  <rect x="0" y="0" width="${w}" height="${topBandH}" fill="url(#gTop)"/>
  <rect x="0" y="${h - bottomBandH}" width="${w}" height="${bottomBandH}" fill="url(#gBot)"/>

  <!-- Titel (zentriert, bis 5 Zeilen, mit Outline) -->
  <g font-family="-apple-system,Segoe UI,Roboto,Arial"
     font-weight="800"
     font-size="${fsTitle}"
     text-anchor="middle"
     style="fill:#fff; stroke:#000; stroke-width:${strokeTitle}px; paint-order:stroke fill;">
    ${lines.map((ln, i) =>
      `<text x="${Math.round(w/2)}" y="${startY + i*lineH}">${esc(ln)}</text>`
    ).join('\n    ')}
  </g>

  <!-- Quelle unten rechts -->
  <text x="${w - sidePad}" y="${h - Math.round(bottomBandH*0.35)}"
        font-family="-apple-system,Segoe UI,Roboto,Arial"
        font-weight="700" font-size="${fsSrc}"
        text-anchor="end"
        style="fill:#fff; stroke:#000; stroke-width:${strokeSrc}px; paint-order:stroke fill;">
    ${esc(source)}
  </text>
</svg>`;
};
app.get('/overlay', async (req, res) => {
  try {
    const img = req.query.img;                 // public Supabase-URL
    const title = (req.query.title||'').slice(0,140);
    const source = (req.query.source||'').slice(0,80);
    const W = Number(req.query.w || 1080), H = Number(req.query.h || 1350);
    if (!img) return res.status(400).json({ error: 'img required' });

    const resp = await fetch(img);
    if (!resp.ok) throw new Error('fetch image failed');
    const buf = Buffer.from(await resp.arrayBuffer());

    const svg = Buffer.from(makeSvg(W, H, title, source));
    const out = await sharp(buf).resize(W, H, { fit: 'cover' })
      .composite([{ input: svg, top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.send(out);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => console.log(`overlay up on ${PORT}`));