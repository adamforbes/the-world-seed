// Era Cards page hero: the Great Shuffle. All 52 Era cards (four decks of
// thirteen) lie scattered across the table, in the spirit of Balatro and a
// tarot reading. Each card's face and back are drawn in the site's glyph
// tiles: pips for the number cards, a figure for the courts and a radiant pip
// for the Ace, all inside a tarot frame. Each Era's deck has its own back in
// its own colour.
//
// Unlike the tile scenes, the cards move freely and smoothly: they sway at
// rest, lift and lean toward the pointer, squash and pop when flipped. Now and
// then the table gathers itself up: every card flips face down, then they all
// jump home at once and stack, bottom card first, into four piles (♥ Myth,
// ♦ Antiquity, ♣ Ruin, ♠ Promise), and the top card of each turns up. Then a
// sweep scatters them again. A card always lands on top of the ones already
// down, so none slides through another, and none ever leaves the frame.
//
//   hover      a card lifts and turns face up
//   click      flip it, with a burst of its Era's colour
//   on a pile  deal that Era out in a fan
//   the table  gather everything up now, or scatter it
//
// Decorative only. Preview with art/scenes/shuffle.html (?live to play).

(function () {
  const { TAU, clamp, lerp } = SceneKit;
  const { rnd, sprite } = GlyphKit;

  const W = 2552, H = 788, FPS = 24, FRAMES = FPS * 12, TICK = 4;
  const STEP_MS = (1000 * TICK) / FPS;
  const CW = 112, CH = 176;          // a card, in canvas pixels
  const REACH = 106;                 // furthest a tilted card reaches from its centre
  const TOP = REACH + 22, BOTTOM = H - REACH - 14;   // where a card's centre may go

  const PALETTES = {
    dark: { paper: '#1b1a17', shadow: 'rgba(0, 0, 0, 0.5)', puff: '#b1c9c3', glow: ['#e07a90', '#e0b155', '#a7b56f', '#86a6e0'] },
    light: { paper: '#f7f3ea', shadow: 'rgba(40, 30, 20, 0.24)', puff: '#7c8f8a', glow: ['#b4415a', '#a8741a', '#5f6b3a', '#3d5f9a'] },
  };

  // The cards are physical: the same in both themes.
  const FACE = '#fbf6ea', EDGE = '#2a2620', GOLD = '#e9c46a', SKIN = '#f0c9a0';
  const DECKS = [
    { suit: 'heart', ink: '#b4415a', back: '#5a1f2e', lattice: '#a8445e' },
    { suit: 'crystal', ink: '#a8741a', back: '#4f3a10', lattice: '#b8892c' },
    { suit: 'club', ink: '#4f5e2a', back: '#2c3519', lattice: '#6f8040' },
    { suit: 'spade', ink: '#3d5f9a', back: '#1c2d4f', lattice: '#4f74b8' },
  ];
  const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
  const CARDS = [0, 1, 2, 3].flatMap((era) => RANKS.map((rank, k) => ({ era, rank, k })))
    .map((c, id) => ({ ...c, id, phase: rnd('sway', id) * TAU, hover: 0, popAt: -1e9, tw: null, rest: null }));

  // ---------- Drawing a card ----------

  const blankCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  function glyph(x, name, fg, dt, cx, cy, scale = 2, flip = false) {
    const img = sprite(name, fg, dt || fg), w = 8 * scale, h = 12 * scale;
    x.save();
    x.translate(Math.round(cx), Math.round(cy));
    if (flip) x.scale(1, -1);
    x.drawImage(img, -w / 2, -h / 2, w, h);
    x.restore();
  }
  const outline = (x) => { x.beginPath(); x.roundRect(1, 1, CW - 2, CH - 2, 10); };
  function frame(x, ink) {
    x.strokeStyle = ink;
    x.lineWidth = 2;
    x.strokeRect(7, 7, CW - 14, CH - 14);
    x.fillStyle = ink;
    for (let i = 14; i < CW - 13; i += 4) { x.fillRect(i, 12, 1, 1); x.fillRect(i, CH - 13, 1, 1); }
    for (let j = 14; j < CH - 13; j += 4) { x.fillRect(12, j, 1, 1); x.fillRect(CW - 13, j, 1, 1); }
    for (const [cx, cy] of [[8, 8], [CW - 8, 8], [8, CH - 8], [CW - 8, CH - 8]]) glyph(x, 'star', ink, ink, cx, cy + 1, 1);
  }

  // Pips where a real deck puts them: columns L, M, R and rows 0 (top) to 6.
  const PIPS = {
    2: [['M', 0], ['M', 6]],
    3: [['M', 0], ['M', 3], ['M', 6]],
    4: [['L', 0], ['R', 0], ['L', 6], ['R', 6]],
    5: [['L', 0], ['R', 0], ['M', 3], ['L', 6], ['R', 6]],
    6: [['L', 0], ['R', 0], ['L', 3], ['R', 3], ['L', 6], ['R', 6]],
    7: [['L', 0], ['R', 0], ['M', 1.5], ['L', 3], ['R', 3], ['L', 6], ['R', 6]],
    8: [['L', 0], ['R', 0], ['M', 1.5], ['L', 3], ['R', 3], ['M', 4.5], ['L', 6], ['R', 6]],
    9: [['L', 0], ['R', 0], ['L', 2], ['R', 2], ['M', 3], ['L', 4], ['R', 4], ['L', 6], ['R', 6]],
    10: [['L', 0], ['R', 0], ['M', 1], ['L', 2], ['R', 2], ['L', 4], ['R', 4], ['M', 5], ['L', 6], ['R', 6]],
  };
  const COLX = { L: 34, M: 56, R: 78 };
  const rowY = (n) => 38 + n * (100 / 6);
  const COURT = { J: 'jack', Q: 'queen', K: 'king' };

  const textures = new Map();
  function face(card) {
    const k = 'f' + card.id;
    if (textures.has(k)) return textures.get(k);
    const c = blankCanvas(CW, CH), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const d = DECKS[card.era];
    outline(x);
    x.fillStyle = FACE;
    x.fill();
    x.lineWidth = 2;
    x.strokeStyle = EDGE;
    x.stroke();
    frame(x, d.ink);
    glyph(x, d.suit, d.ink, d.ink, 21, 24, 1);
    glyph(x, d.suit, d.ink, d.ink, CW - 21, CH - 24, 1, true);
    if (typeof card.rank === 'number') {
      for (const [col, row] of PIPS[card.rank]) glyph(x, d.suit, d.ink, d.ink, COLX[col], rowY(row), 2, row > 3);
    } else if (card.rank === 'A') {
      // A single great pip in a ring of rays, like a tarot sun.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        glyph(x, i % 2 ? 'dot' : 'star', d.ink, d.ink, 56 + Math.cos(a) * 36, 90 + Math.sin(a) * 40, 1);
      }
      glyph(x, d.suit, d.ink, d.ink, 56, 92, 5);
    } else {
      // A court figure standing in a tinted arch.
      x.globalAlpha = 0.13;
      x.fillStyle = d.ink;
      x.fillRect(24, 40, 64, 96);
      x.globalAlpha = 1;
      x.strokeStyle = d.ink;
      x.lineWidth = 1;
      x.strokeRect(24.5, 40.5, 63, 95);
      glyph(x, COURT[card.rank], d.ink, SKIN, 56, 92, 4);
      for (const [cx, cy, flip] of [[32, 50, false], [80, 50, false], [32, 126, true], [80, 126, true]]) glyph(x, d.suit, d.ink, d.ink, cx, cy, 1, flip);
    }
    textures.set(k, c);
    return c;
  }
  function back(era) {
    const k = 'b' + era;
    if (textures.has(k)) return textures.get(k);
    const c = blankCanvas(CW, CH), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const d = DECKS[era];
    outline(x);
    x.fillStyle = d.back;
    x.fill();
    x.lineWidth = 2;
    x.strokeStyle = EDGE;
    x.stroke();
    x.save();
    outline(x);
    x.clip();
    x.fillStyle = d.lattice;
    for (let r = 0, y = 14; y < CH - 12; y += 8, r++) for (let i = 14 + (r % 2) * 5; i < CW - 12; i += 10) x.fillRect(i, y, 2, 2);
    x.restore();
    frame(x, GOLD);
    x.beginPath();
    x.arc(CW / 2, CH / 2, 25, 0, TAU);
    x.fillStyle = d.back;
    x.fill();
    x.lineWidth = 2;
    x.strokeStyle = GOLD;
    x.stroke();
    glyph(x, d.suit, GOLD, GOLD, CW / 2, CH / 2 + 2, 3);
    textures.set(k, c);
    return c;
  }

  // ---------- Where the cards go ----------

  // Scattered: a jittered 13 × 4 grid, so they cover the table and overlap,
  // every card well inside the frame.
  function scattered(cycle) {
    const slots = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 13; i++) slots.push([i, j]);
    const order = slots.map((s, k) => [rnd('slot', cycle, k), s]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    return CARDS.map((card, k) => {
      const [i, j] = order[k];
      return {
        x: clamp(150 + i * 188 + (j % 2) * 94 + (rnd('jx', cycle, k) - 0.5) * 90, REACH, W - REACH),
        y: clamp(lerp(TOP + 8, BOTTOM - 8, j / 3) + (rnd('jy', cycle, k) - 0.5) * 30, TOP, BOTTOM),
        a: (rnd('ja', cycle, k) - 0.5) * 0.9,
        face: rnd('jf', cycle, k) < 0.45,
        z: rnd('jz', cycle, k),
      };
    });
  }
  // Sorted: four piles across the middle, each card a little higher than the
  // one under it and a touch askew, so the stack shows its edges.
  const pileX = (era) => W / 2 + (era - 1.5) * 250;
  const piled = (card, face = false) => ({
    x: pileX(card.era) + card.k * 0.8 + (rnd('px', card.id) - 0.5) * 4,
    y: H / 2 + 26 - card.k * 3.4 + (rnd('py', card.id) - 0.5) * 2,
    a: (rnd('pa', card.id) - 0.5) * 0.12, face, z: 1 + card.k * 0.001,
  });
  const isTop = (card) => card.k === RANKS.length - 1;
  // Fanned: one Era's deck spread in an arc over the piles.
  function fanned(card) {
    const a = lerp(-0.42, 0.42, card.k / (RANKS.length - 1)), R = 760;
    return { x: W / 2 + Math.sin(a) * R, y: H / 2 + 720 - Math.cos(a) * R, a, face: true, z: 2 + card.k * 0.001 };
  }

  // ---------- Motion ----------

  const easeOut = (u) => 1 - (1 - u) ** 3;
  function pose(card, t) {
    const tw = card.tw;
    if (tw && t < tw.start + tw.dur) {
      if (t < tw.start) return { ...tw.from, sx: 1, sy: 1, flying: false };
      const u = clamp((t - tw.start) / tw.dur), e = easeOut(u), turning = tw.from.face !== tw.to.face;
      return {
        x: lerp(tw.from.x, tw.to.x, e),
        y: lerp(tw.from.y, tw.to.y, e) - Math.sin(u * Math.PI) * tw.arc,
        a: lerp(tw.from.a, tw.to.a, e) + tw.spin * Math.sin(u * Math.PI),
        face: turning ? (u < 0.5 ? tw.from.face : tw.to.face) : tw.to.face,
        sx: turning ? Math.max(0.04, Math.abs(Math.cos(u * Math.PI))) : 1, sy: 1,
        z: tw.to.z, flying: tw.travels, arrive: tw.start + tw.dur,
      };
    }
    // Landed: a wobble and a squash, then stillness.
    const since = tw ? t - tw.start - tw.dur : 1e9, r = card.rest;
    return {
      x: r.x, y: r.y,
      a: r.a + (since < 700 ? Math.exp(-since / 150) * Math.sin(since / 42) * (tw?.travels ? 0.09 : 0.03) : 0),
      face: r.face, sx: 1, sy: since < 320 && tw?.travels ? 1 - 0.08 * Math.exp(-since / 70) : 1,
      z: r.z, flying: false,
    };
  }
  function move(card, to, t, dur, arc = 0, spin = 0, thunk = false) {
    const from = pose(card, t);
    const travels = Math.hypot(to.x - from.x, to.y - from.y) > 4;
    // Keep the top of the arc inside the frame.
    const apex = Math.min(from.y, to.y) - TOP;
    card.tw = {
      from: { x: from.x, y: from.y, a: from.a, face: from.face, z: from.z }, to, start: t,
      dur: state.calm ? Math.min(dur, 90) : dur, arc: state.calm ? 0 : clamp(arc, 0, apex), spin: state.calm ? 0 : spin, thunk, travels,
    };
    card.rest = to;
  }
  const flipIn = (card, face, t, dur = 300) => move(card, { ...card.rest, face }, t, dur, 10);

  // ---------- The table's cycle ----------

  const state = {};
  function reset(t) {
    Object.assign(state, { time: t, last: t, phase: 'scatter', until: t + 9000, cycle: 0, fanEra: -1, pointer: null, hovered: null, particles: [], drawn: [], calm: false, topZ: 1 });
    const layout = scattered(0);
    CARDS.forEach((c, i) => { c.tw = null; c.rest = layout[i]; c.hover = 0; c.popAt = -1e9; });
  }
  reset(0);

  // Gathering is two quick beats: every card flips face down, then they all
  // jump at once. They land a few milliseconds apart, bottom card first, so
  // each lands on top of the last.
  function turnDown(t) {
    for (const c of CARDS) if (c.rest.face) flipIn(c, false, t + rnd('td', c.id) * 60, 220);
    state.phase = 'turn';
    state.until = t + 340;
  }
  function stack(t) {
    const order = [...CARDS].sort((a, b) => a.k - b.k || a.era - b.era);
    order.forEach((c, i) => move(c, piled(c), t, 380 + i * 6, 40 + rnd('ga', c.id) * 50, (rnd('gs', c.id) - 0.5) * 0.8, true));
    state.phase = 'stack';
    state.until = t + 380 + order.length * 6 + 250;
  }
  function revealTops(t) {
    CARDS.filter(isTop).forEach((c, i) => flipIn(c, true, t + i * 60, 240));
    state.phase = 'sorted';
    state.until = t + 5600;
  }
  // Scattering: whichever card arrives last sits on top of the rest.
  function scatter(t) {
    state.cycle++;
    const layout = scattered(state.cycle);
    const flights = CARDS.map((c, i) => ({ c, to: layout[i], start: t + rnd('sd', c.id, state.cycle) * 100, dur: 460 + rnd('sl', c.id) * 220 }));
    flights.sort((a, b) => a.start + a.dur - b.start - b.dur).forEach((f, i) => { f.to.z = i * 0.001; });
    for (const f of flights) move(f.c, f.to, f.start, f.dur, 110 + rnd('sa', f.c.id) * 130, (rnd('ss', f.c.id) - 0.5) * 4);
    state.topZ = flights.length * 0.001;
    state.phase = 'burst';
    state.until = t + 900;
    state.fanEra = -1;
  }
  function fan(era, t) {
    CARDS.filter((c) => c.era === era).forEach((c) => move(c, fanned(c), t + (RANKS.length - 1 - c.k) * 38, 460, 40, 0));
    state.phase = 'fan';
    state.fanEra = era;
    state.until = t + 7000;
  }
  function unfan(t) {
    CARDS.filter((c) => c.era === state.fanEra).forEach((c) => move(c, piled(c, isTop(c)), t + c.k * 30, 420, 30, 0, true));
    state.phase = 'sorted';
    state.fanEra = -1;
    state.until = t + 3500;
  }
  function advance(t) {
    if (t < state.until) return;
    if (state.phase === 'scatter' && !state.calm) turnDown(t);
    else if (state.phase === 'turn') stack(t);
    else if (state.phase === 'stack') revealTops(t);
    else if (state.phase === 'sorted' && !state.calm) scatter(t);
    else if (state.phase === 'burst') { state.phase = 'scatter'; state.until = t + 14000; }
    else if (state.phase === 'fan') unfan(t);
  }

  // ---------- Sparkle ----------

  function burst(x, y, era, t) {
    for (let i = 0; i < 16 && !state.calm; i++) {
      const a = (i / 16) * TAU + rnd('ba', t, i), v = 0.22 + rnd('bv', t, i) * 0.35;
      state.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.1, born: t, life: 650, era, g: i % 3 ? 'dot' : 'star' });
    }
  }
  function puff(x, y, t) {
    for (let i = 0; i < 4 && !state.calm; i++) {
      const s = i < 2 ? -1 : 1;
      state.particles.push({ x: x + s * 30, y, vx: s * (0.05 + rnd('pv', t, i) * 0.08), vy: -0.03 - rnd('pu', t, i) * 0.05, born: t, life: 320, era: -1, g: 'dot' });
    }
    if (state.particles.length > 240) state.particles.splice(0, state.particles.length - 240);
  }

  // ---------- Input ----------

  // The card under a point: the top one drawn, tested in its own frame.
  function cardAt(x, y) {
    for (let i = state.drawn.length - 1; i >= 0; i--) {
      const { card, p } = state.drawn[i];
      const dx = x - p.x, dy = y - p.y, ca = Math.cos(-p.a), sa = Math.sin(-p.a);
      if (Math.abs(dx * ca - dy * sa) < (CW / 2) * p.s && Math.abs(dx * sa + dy * ca) < (CH / 2) * p.s) return card;
    }
    return null;
  }
  const busy = () => ['turn', 'stack', 'burst'].includes(state.phase);
  // A card you touch on the table comes to the top, and stays there.
  const raise = (card) => {
    if (state.phase === 'scatter') card.rest = { ...card.rest, z: (state.topZ += 0.001) };
  };
  function hover(x, y) {
    state.pointer = x === null ? null : { x, y };
  }
  function click(x, y) {
    const t = state.time, card = cardAt(x, y);
    if (busy()) return;
    if (!card) { if (state.phase === 'scatter') turnDown(t); else scatter(t); return; }
    if (state.phase === 'sorted') return fan(card.era, t);
    if (state.phase === 'fan' && card.era !== state.fanEra) { unfan(t); return fan(card.era, t + 200); }
    const p = pose(card, t);
    raise(card);
    move(card, { ...card.rest, face: !p.face }, t, 340, 22);
    card.popAt = t;
    burst(p.x, p.y, card.era, t);
  }
  const cursor = () => (state.pointer && cardAt(state.pointer.x, state.pointer.y) ? 'pointer' : '');

  // ---------- Drawing ----------

  function drawCard(ctx, P, card, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    // Its shadow, further off the higher it is.
    const lift = p.lift || 0;
    ctx.fillStyle = P.shadow;
    ctx.beginPath();
    ctx.roundRect(-CW / 2 * p.s * p.sx + 5 + lift * 8, -CH / 2 * p.s + 7 + lift * 10, CW * p.s * p.sx, CH * p.s, 10);
    ctx.fill();
    ctx.scale(p.s * p.sx, p.s * p.sy);
    ctx.drawImage(p.face ? face(card) : back(card.era), -CW / 2, -CH / 2);
    ctx.restore();
  }

  function render(ctx, step, theme, { calm = false, time } = {}) {
    const P = PALETTES[theme];
    const t = time ?? step * STEP_MS;
    if (t < state.last - 1000) reset(t);
    const dt = clamp(t - state.last, 0, 100);
    state.time = t;
    state.last = t;
    state.calm = calm;
    advance(t);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, W, H);

    // Pose every card: where it's going, its breath at rest, the pointer's pull.
    const hovered = state.pointer ? cardAt(state.pointer.x, state.pointer.y) : null;
    if (hovered !== state.hovered) { state.hovered = hovered; if (hovered) raise(hovered); }
    const resting = state.phase === 'scatter' || state.phase === 'sorted' || state.phase === 'fan';
    if (hovered && state.phase === 'scatter' && !hovered.rest.face && !(hovered.tw && t < hovered.tw.start + hovered.tw.dur)) flipIn(hovered, true, t, 260);
    const posed = CARDS.map((card) => {
      const p = pose(card, t);
      if (card.tw?.thunk && !card.tw.landed && t >= card.tw.start + card.tw.dur) { card.tw.landed = true; puff(p.x, p.y + CH / 2 - 6, t); }
      card.hover += ((card === hovered && resting ? 1 : 0) - card.hover) * Math.min(1, dt / 90);
      if (!calm && !p.flying && state.phase === 'scatter') {
        p.a += 0.022 * Math.sin(t / 950 + card.phase);
        p.y += 2.6 * Math.sin(t / 1300 + card.phase * 1.3);
      }
      const pop = t - card.popAt < 400 ? 0.1 * Math.exp(-(t - card.popAt) / 110) : 0;
      p.lift = card.hover;
      p.s = 1 + 0.1 * card.hover + pop;
      p.y -= 12 * card.hover;
      if (state.pointer && card.hover > 0.01) p.a = lerp(p.a, clamp((state.pointer.x - p.x) / 500, -0.22, 0.22), card.hover * 0.5);
      return { card, p };
    });
    // Resting cards by height; cards in the air above them, the last to
    // arrive on top; the hovered card above all.
    posed.sort((a, b) => (a.p.flying - b.p.flying) || (a.p.flying ? a.p.arrive - b.p.arrive : a.p.z - b.p.z) || (a.card === hovered) - (b.card === hovered));
    const lifted = posed.findIndex((d) => d.card === hovered);
    if (lifted >= 0 && !posed[lifted].p.flying) posed.push(...posed.splice(lifted, 1));
    state.drawn = posed;
    ctx.imageSmoothingEnabled = true;
    for (const { card, p } of posed) drawCard(ctx, P, card, p);

    ctx.imageSmoothingEnabled = false;
    state.particles = state.particles.filter((q) => t - q.born < q.life);
    for (const q of state.particles) {
      const age = t - q.born, x = q.x + q.vx * age, y = q.y + q.vy * age + 0.0006 * age * age;
      const color = q.era < 0 ? P.puff : P.glow[q.era];
      ctx.globalAlpha = 1 - age / q.life;
      ctx.drawImage(sprite(q.g, color, color), x - 8, y - 12, 16, 24);
    }
    ctx.globalAlpha = 1;
  }

  SceneKit.register({
    name: 'shuffle', width: W, height: H, fps: FPS, frames: FRAMES, tick: TICK, poster: 40, smooth: true,
    backgrounds: { light: PALETTES.light.paper, dark: PALETTES.dark.paper },
    draw: (ctx, frame, theme) => render(ctx, Math.floor(frame / TICK), theme, { time: (frame * 1000) / FPS }),
    render, hover, click, cursor, state,
  });
})();
