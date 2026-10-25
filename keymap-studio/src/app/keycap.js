/*
 * Keycap legend layout shared by the SVG board and the Canvas reference image.
 * Sizes are fractions of the keycap side k (DESIGN.md §5): main glyph 0.44k,
 * Shift/AltGr corners 0.25k, hold band 0.27k tall with 0.21k text, and no text
 * smaller than max(0.20k, minPx). Text is measured with the same font the
 * renderer uses, so nothing is drawn wider than its zone.
 */
(function (KS) {
  'use strict';
  const A = KS.app = KS.app || {};

  let T = null;
  function tokens() {
    if (T) return T;
    const cs = getComputedStyle(document.documentElement);
    const v = name => cs.getPropertyValue(name).trim();
    T = {
      app: v('--surface-app'), panel: v('--surface-panel'), keycap: v('--keycap'), inherited: v('--keycap-inherited'),
      band: v('--keycap-band'), emptyLine: v('--keycap-empty-line'), text: v('--text'), muted: v('--text-muted'),
      shift: v('--level-shift'), altgr: v('--level-altgr'), unknown: v('--status-unknown'), warning: v('--status-warning'),
      accent: v('--accent'), focus: v('--focus-key'), line: v('--line'),
      fontLegend: v('--font-legend'), fontCode: v('--font-code'), fontUi: v('--font-ui')
    };
    return T;
  }

  function hex(c) {
    const m = /^#([0-9a-f]{6})$/i.exec(String(c).trim());
    if (!m) return [128, 128, 128];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(fg, alpha, bg) {
    const a = hex(fg), b = hex(bg);
    return '#' + a.map((x, i) => Math.round(x * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
  }

  /* ---------- measuring ---------- */
  let mctx = null;
  const cache = new Map();
  function measure(text, size, weight, family) {
    const key = `${weight}|${size.toFixed(2)}|${family}|${text}`;
    let m = cache.get(key);
    if (!m) {
      if (!mctx) mctx = document.createElement('canvas').getContext('2d');
      mctx.font = `${weight} ${size}px ${family}`;
      const r = mctx.measureText(text);
      m = {w: r.width, asc: r.actualBoundingBoxAscent || 0, desc: r.actualBoundingBoxDescent || 0};
      if (cache.size > 8000) cache.clear();
      cache.set(key, m);
    }
    return m;
  }
  function fit(text, max, min, width, weight, family) {
    if (max < min) max = min;
    const step = Math.max(0.25, max / 80);
    for (let s = max; s >= min - 1e-9; s -= step) if (measure(text, s, weight, family).w <= width) return s;
    return measure(text, min, weight, family).w <= width ? min : null;
  }
  function truncate(text, size, width, weight, family) {
    const cps = Array.from(text);
    let lo = 0, hi = cps.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measure(cps.slice(0, mid).join('') + '\u2026', size, weight, family).w <= width) lo = mid; else hi = mid - 1;
    }
    return cps.slice(0, lo).join('') + '\u2026';
  }
  function graphemes(text) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) return Array.from(new Intl.Segmenter('et', {granularity: 'grapheme'}).segment(text)).length;
    return Array.from(text.normalize('NFC')).length;
  }

  const ABBREVIATIONS = [
    [/^Backspace$/i, 'Bksp'], [/^Delete$/i, 'Del'], [/^Escape$/i, 'Esc'], [/^Insert$/i, 'Ins'],
    [/^Page ?Up$/i, 'PgUp'], [/^Page ?Down$/i, 'PgDn'], [/^Print ?Screen$/i, 'PrtSc'], [/^Caps ?Lock$/i, 'Caps'],
    [/^Scroll ?Lock$/i, 'ScrLk'], [/^Num ?Lock$/i, 'NumLk'], [/^Application$/i, 'Menu'], [/^Calculator$/i, 'Calc'],
    [/^Volume ?Up\b/i, 'Vol +'], [/^Volume ?Down\b/i, 'Vol \u2212'], [/^Brightness ?Up\b/i, 'Bright +'], [/^Brightness ?Down\b/i, 'Bright \u2212'],
    [/^Right Alt \/ AltGr$/i, 'AltGr'], [/^Right Alt$/i, 'AltGr'], [/^Right (Ctrl|Shift|Super|Gui)$/i, 'R $1'], [/^Left (Ctrl|Shift|Alt|Super|Gui)$/i, '$1'],
    [/^Mouse (Up|Down|Left|Right)$/i, m => 'Mouse ' + {up: '\u2191', down: '\u2193', left: '\u2190', right: '\u2192'}[m.split(' ')[1].toLowerCase()]]
  ];
  function abbreviate(text) {
    for (const [re, short] of ABBREVIATIONS) if (re.test(text)) return typeof short === 'function' ? short(text) : text.replace(re, short);
    return null;
  }
  function split2(text) {
    const plus = text.lastIndexOf(' + ');
    if (plus > 0) return [text.slice(0, plus) + ' +', text.slice(plus + 3)];
    const mid = text.length / 2;
    let best = -1;
    for (let i = 1; i < text.length - 1; i++) if (' -/_'.includes(text[i]) && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    if (best < 0) return null;
    const cut = text[best] === ' ' ? best : best + 1;
    return [text.slice(0, cut).trim(), text.slice(cut).trim()];
  }

  /* ---------- semantic parts from the legend model ---------- */
  const up = s => s.toLocaleUpperCase('et');
  const FN_SHORT = {TG: 'toggle', TO: 'switch to', OSL: 'next key', TT: 'tap-toggle', DF: 'default', PDF: 'default'};
  function parts(legend, opt) {
    const p = {main: null, code: false, shift: null, altgr: null, tag: null, tagTone: 'muted', qualifier: null, band: null,
      dead: false, approx: false, unknown: false, inherited: !!legend.inherited, empty: false, tintLayer: null, kind: legend.kind};
    const kind = legend.kind;
    if (legend.unknown || kind === 'raw') {
      p.unknown = !!legend.unknown;
      p.main = String(legend.code !== undefined ? legend.code : legend.main);
      p.code = true;
      if (p.unknown) { p.tag = 'Unknown'; p.tagTone = 'unknown'; }
    } else if (kind === 'none' || !legend.main) {
      p.empty = true;
    } else {
      p.main = legend.main;
      if (kind === 'char') {
        if (legend.shift && legend.shift !== up(p.main)) p.shift = legend.shift;
        if (legend.altgr && legend.altgr !== p.main) p.altgr = legend.altgr;
        p.dead = !!legend.dead;
      }
      if (kind === 'shortcut') {
        const i = p.main.lastIndexOf(' + ');
        if (i > 0) { p.tag = p.main.slice(0, i) + ' +'; p.main = p.main.slice(i + 3); }
      }
      if (kind === 'layer' && Number.isInteger(legend.layer) && !legend.hold) {
        p.tintLayer = legend.layer;
        const a = opt.parse ? opt.parse(legend.code) : null;
        if (a && a.k === 'layer' && a.fn === 'MO') p.band = {text: `hold ${a.layer}`, layer: a.layer};
        else if (a && a.k === 'layermod') p.band = {text: `hold ${a.layer} + mods`, layer: a.layer};
        else if (a && a.k === 'layer') p.qualifier = `${FN_SHORT[a.fn] || a.fn} ${a.layer}`;
        else if (legend.detail) p.qualifier = legend.detail;
      }
      if (kind === 'modifier' && opt.parse) { const a = opt.parse(legend.code); if (a && a.k === 'osm') p.tag = 'One-shot'; }
      if ((kind === 'shortcut' || kind === 'layer') && legend.hold && opt.tapLegend && opt.tapLegend.kind === 'char') {
        const tl = opt.tapLegend;
        if (tl.shift && tl.shift !== up(tl.main)) p.shift = tl.shift;
        if (tl.altgr) p.altgr = tl.altgr;
        p.dead = !!tl.dead;
      }
      if (kind === 'macro' || kind === 'tapdance') {
        const a = opt.parse ? opt.parse(legend.code) : null;
        if (a && a.k === 'macro') p.tag = 'M' + a.index;
        if (a && a.k === 'tapdance') p.tag = 'TD' + a.index;
        if (legend.approximate) p.approx = true;
      }
    }
    if (legend.hold && legend.hold.text) p.band = {text: legend.hold.text, layer: legend.hold.kind === 'layer' && Number.isInteger(legend.hold.layer) ? legend.hold.layer : null};
    if (opt.label) { p.main = opt.label; p.code = false; p.empty = false; p.dead = false; }
    if (p.inherited && opt.inheritedName) {
      const mark = '\u2193 ' + opt.inheritedName;
      if (!p.band) p.qualifier = mark;
      else if (!p.tag && !p.shift) p.tag = p.altgr || p.approx ? '\u2193' : mark;
    }
    return p;
  }

  /* ---------- geometry of the legend runs ---------- */
  function layout(p, k, o) {
    const t = tokens();
    const fam = t.fontLegend, codeFam = t.fontCode;
    const pad = 0.06 * k, inner = k - 2 * pad, h = k / 2;
    const min = Math.max(0.2 * k, (o && o.minPx) || 0);
    const res = {runs: [], dots: [], bandH: 0, mainSize: 0};
    const topH = (p.shift || p.altgr || p.tag || p.approx) ? 0.27 * k : 0;
    const bandH = p.band ? 0.27 * k : 0;
    const qualH = (!p.band && p.qualifier) ? 0.25 * k : 0;
    const bottom = h - pad - bandH - qualH;
    res.bandH = bandH;

    function run(list, text, x, y, size, weight, family, color, anchor, role) {
      const m = measure(text, size, weight, family);
      const x0 = anchor === 'start' ? x : anchor === 'end' ? x - m.w : x - m.w / 2;
      list.push({text, x, y, size, weight, family, color, anchor, role, box: [x0, y - m.asc, x0 + m.w, y + m.desc]});
    }
    const overlaps = (a, b) => a.box[0] < b.box[2] && b.box[0] < a.box[2] && a.box[1] < b.box[3] && b.box[1] < a.box[3];

    function placeMain(regionTop) {
      const out = [], dots = [];
      let size = 0;
      const color = o.mainColor;
      const avail = Math.max(bottom - regionTop, 0.2 * k);
      const cy = (regionTop + bottom) / 2;
      if (!p.main) return {out, dots, size};
      if (p.code) {
        size = min;
        const cw = measure('M', size, 400, codeFam).w || size * 0.6;
        const per = Math.max(3, Math.floor(inner / cw));
        const maxLines = Math.max(1, Math.min(3, Math.floor(avail / (size * 1.2))));
        const lines = [];
        let rest = p.main;
        while (rest.length && lines.length < maxLines) {
          if (rest.length <= per) { lines.push(rest); rest = ''; break; }
          let cut = per;
          for (let i = per; i > per * 0.5; i--) if ('_(,'.includes(rest[i - 1])) { cut = i; break; }
          lines.push(rest.slice(0, cut)); rest = rest.slice(cut);
        }
        if (rest.length) lines[lines.length - 1] = truncate(lines[lines.length - 1] + rest, size, inner, 400, codeFam);
        const gap = size * 1.2;
        lines.forEach((line, i) => run(out, line, 0, cy + (i - (lines.length - 1) / 2) * gap + size * 0.36, size, 400, codeFam, color, 'middle', 'main'));
        return {out, dots, size};
      }
      const text = p.main;
      if (graphemes(text) <= 2 && !/\s/.test(text)) {
        if (p.dead) {
          size = 0.62 * k;
          let rr = 0.12 * k;
          let m = measure(text, size, 600, fam);
          let block = (m.asc + m.desc) + 0.05 * k + 2 * rr;
          if (block > avail) { const f = avail / block; size = Math.max(min, size * f); rr *= f; m = measure(text, size, 600, fam); block = (m.asc + m.desc) + 0.05 * k + 2 * rr; }
          const top = cy - block / 2;
          run(out, text, 0, top + m.asc, size, 600, fam, color, 'middle', 'main');
          const ccy = top + (m.asc + m.desc) + 0.05 * k + rr;
          for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; dots.push({cx: Math.cos(a) * rr, cy: ccy + Math.sin(a) * rr, r: Math.max(0.6, 0.016 * k), color}); }
          return {out, dots, size};
        }
        size = 0.44 * k;
        let m = measure(text, size, 600, fam);
        if (m.w > inner) { size = Math.max(min, size * inner / m.w); m = measure(text, size, 600, fam); }
        const ink = m.asc + m.desc;
        if (ink > avail * 0.94) { size = Math.max(min, size * avail * 0.94 / ink); m = measure(text, size, 600, fam); }
        run(out, text, 0, cy + (m.asc - m.desc) / 2, size, 600, fam, color, 'middle', 'main');
        return {out, dots, size};
      }
      const one = s => { const m = measure(s.text, s.size, 600, fam); run(out, s.text, 0, cy + (m.asc - m.desc) / 2, s.size, 600, fam, color, 'middle', 'main'); };
      let s1 = fit(text, Math.min(0.32 * k, avail * 0.8), min, inner, 600, fam);
      if (s1) { one({text, size: s1}); return {out, dots, size: s1}; }
      const lines = split2(text);
      if (lines && avail >= min * 2.3) {
        const sizes = lines.map(l => fit(l, Math.min(0.26 * k, avail / 2.4), min, inner, 600, fam));
        if (sizes.every(Boolean)) {
          const s2 = Math.min(...sizes), gap = s2 * 1.18;
          lines.forEach((l, i) => run(out, l, 0, cy + (i - 0.5) * gap + s2 * 0.36, s2, 600, fam, color, 'middle', 'main'));
          return {out, dots, size: s2};
        }
      }
      const short = abbreviate(text);
      if (short) { s1 = fit(short, Math.min(0.32 * k, avail * 0.8), min, inner, 600, fam); if (s1) { one({text: short, size: s1}); return {out, dots, size: s1}; } }
      one({text: truncate(text, min, inner, 600, fam), size: min});
      return {out, dots, size: min};
    }

    function placeTop(mainSize) {
      const out = [];
      const cap = Math.max(min, Math.min(0.25 * k, mainSize || 0.25 * k));
      const corner = (text, anchor, color, width) => {
        let size = fit(text, cap, min, width, 600, fam);
        let shown = text;
        if (!size) { size = min; shown = truncate(text, min, width, 600, fam); }
        const m = measure(shown, size, 600, fam);
        run(out, shown, anchor === 'start' ? -h + pad : h - pad, -h + pad + m.asc, size, 600, fam, color, anchor, 'corner');
      };
      const rightText = p.altgr || (p.approx ? '?' : null);
      if (p.shift) corner(p.shift, 'start', t.shift, inner * 0.46);
      if (rightText) corner(rightText, 'end', p.altgr ? t.altgr : t.warning, inner * 0.46);
      if (p.tag && !p.shift) {
        const edge = 0.035 * k;
        const width = rightText ? inner * 0.6 : k - 2 * edge;
        const tcap = Math.max(min, Math.min(0.21 * k, mainSize || 0.21 * k));
        let weight = 600, size = fit(p.tag, tcap, min, width, weight, fam), shown = p.tag;
        if (!size) { weight = 400; size = fit(p.tag, tcap, min, width, weight, fam); }
        if (!size) { size = min; shown = truncate(p.tag, min, width, weight, fam); }
        const m = measure(shown, size, weight, fam);
        run(out, shown, -h + edge, -h + pad + m.asc, size, weight, fam, p.tagTone === 'unknown' ? t.unknown : t.muted, 'start', 'tag');
      }
      return out;
    }

    let main = placeMain(-h + pad + topH * 0.45);
    let top = placeTop(main.size);
    if (top.length && main.out.some(r => top.some(c => overlaps(r, c)))) {
      main = placeMain(-h + pad + topH);
      top = placeTop(main.size);
    }
    res.runs.push(...top, ...main.out);
    res.dots.push(...main.dots);
    res.mainSize = main.size;

    const capMain = main.size || 0.21 * k;
    if (p.band) {
      const bcap = Math.max(min, Math.min(0.21 * k, capMain));
      let shown = p.band.text, size = fit(shown, bcap, min, inner, 700, fam);
      if (!size) { const short = abbreviate(shown); if (short) { shown = short; size = fit(shown, bcap, min, inner, 700, fam); } }
      if (!size) { size = min; shown = truncate(shown, min, inner, 700, fam); }
      const m = measure(shown, size, 700, fam);
      run(res.runs, shown, 0, h - bandH / 2 + (m.asc - m.desc) / 2, size, 700, fam, t.text, 'middle', 'band');
    } else if (p.qualifier) {
      let shown = p.qualifier;
      if (measure(shown, min, 700, fam).w > inner) shown = truncate(shown, min, inner, 700, fam);
      const m = measure(shown, min, 700, fam);
      run(res.runs, shown, 0, h - pad - m.desc, min, 700, fam, t.muted, 'middle', 'qualifier');
    }
    return res;
  }

  /* ---------- key model: paint + runs ---------- */
  function model(legend, opt) {
    const t = tokens();
    const k = opt.k;
    const p = parts(legend, opt);
    const layerHex = opt.layerHex || t.accent;
    const tint = p.tintLayer !== null && opt.colorOf ? opt.colorOf(p.tintLayer) : null;
    let mainColor = layerHex, fill = t.keycap, stroke = layerHex, strokeWidth = 0.024 * k, dash = null;
    if (p.inherited) { mainColor = t.muted; fill = t.inherited; stroke = t.muted; dash = [0.07 * k, 0.05 * k]; }
    else if (p.unknown) { mainColor = t.unknown; stroke = t.unknown; strokeWidth = 0.03 * k; dash = [0.015 * k, 0.045 * k]; }
    else if (tint) { mainColor = tint; fill = mix(tint, 0.14, t.app); stroke = tint; strokeWidth = 0.036 * k; }
    else if (p.empty) { fill = t.app; stroke = t.emptyLine; strokeWidth = 0.02 * k; }
    const lay = layout(p, k, {minPx: opt.minPx || 0, mainColor});
    let bandFill = null;
    if (p.band) {
      bandFill = p.band.layer !== null && opt.colorOf ? mix(opt.colorOf(p.band.layer), 0.3, fill) : t.band;
    }
    const label = opt.label ? `${opt.label} (sheet label). ` : '';
    const inh = p.inherited && opt.inheritedName ? ` Inherited from ${opt.inheritedName}.` : '';
    return {k, fill, stroke, strokeWidth, dash, bandH: lay.bandH, bandFill, runs: lay.runs, dots: lay.dots, mainSize: lay.mainSize,
      parts: p, a11y: label + (legend.a11y || p.main || 'No action') + inh};
  }

  function bandPath(k, bh) {
    const h = k / 2, r = Math.min(0.1 * k, bh);
    return `M ${-h} ${h - bh} L ${h} ${h - bh} L ${h} ${h - r} A ${r} ${r} 0 0 1 ${h - r} ${h} L ${-h + r} ${h} A ${r} ${r} 0 0 1 ${-h} ${h - r} Z`;
  }

  /* ---------- SVG ---------- */
  function svg(m, attrs) {
    const {s} = A.dom;
    const k = m.k, h = k / 2;
    const g = s('g', attrs);
    g.append(s('rect', {class: 'ring', x: -h - 0.08 * k, y: -h - 0.08 * k, width: k * 1.16, height: k * 1.16, rx: 0.15 * k, fill: 'none', 'stroke-width': Math.max(2, 0.05 * k)}));
    g.append(s('rect', {class: 'cap', x: -h, y: -h, width: k, height: k, rx: 0.1 * k, fill: m.fill, stroke: m.stroke,
      'stroke-width': m.strokeWidth, 'stroke-dasharray': m.dash ? m.dash.map(n => n.toFixed(2)).join(' ') : undefined, 'stroke-linecap': m.dash ? 'round' : undefined}));
    if (m.bandH) g.append(s('path', {d: bandPath(k, m.bandH), fill: m.bandFill}));
    for (const d of m.dots) g.append(s('circle', {cx: d.cx.toFixed(2), cy: d.cy.toFixed(2), r: d.r.toFixed(2), fill: d.color}));
    for (const r of m.runs) {
      g.append(s('text', {x: r.x.toFixed(2), y: r.y.toFixed(2), 'font-size': r.size.toFixed(2), 'font-weight': r.weight,
        'font-family': r.family, fill: r.color, 'text-anchor': r.anchor, 'data-role': r.role}, r.text));
    }
    g.append(s('rect', {class: 'sel', x: -h + 0.025 * k, y: -h + 0.025 * k, width: k * 0.95, height: k * 0.95, rx: 0.085 * k, fill: 'none', 'stroke-width': Math.max(2, 0.045 * k)}));
    return g;
  }

  /* ---------- Canvas ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function draw(ctx, m, x, y, angle, log) {
    const k = m.k, h = k / 2;
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle * Math.PI / 180);
    roundRect(ctx, -h, -h, k, k, 0.1 * k);
    ctx.fillStyle = m.fill; ctx.fill();
    ctx.lineWidth = m.strokeWidth; ctx.strokeStyle = m.stroke;
    ctx.setLineDash(m.dash || []); ctx.lineCap = m.dash ? 'round' : 'butt';
    ctx.stroke(); ctx.setLineDash([]);
    if (m.bandH) { ctx.fillStyle = m.bandFill; ctx.fill(new Path2D(bandPath(k, m.bandH))); }
    for (const d of m.dots) { ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2); ctx.fillStyle = d.color; ctx.fill(); }
    ctx.textBaseline = 'alphabetic';
    const id = log ? (log.keys = (log.keys || 0) + 1) : 0;
    for (const r of m.runs) {
      ctx.font = `${r.weight} ${r.size}px ${r.family}`;
      ctx.fillStyle = r.color;
      ctx.textAlign = r.anchor === 'start' ? 'left' : r.anchor === 'end' ? 'right' : 'center';
      ctx.fillText(r.text, r.x, r.y);
      if (log) log.push({text: r.text, size: r.size, k, role: r.role, box: r.box, key: id});
    }
    ctx.restore();
  }

  A.keycap = {tokens, mix, measure, fit, truncate, parts, layout, model, svg, draw, roundRect};
})(globalThis.KyriaStudio = globalThis.KyriaStudio || {});
