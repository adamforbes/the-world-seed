// The Game, on the rules page: the game board. It starts as a blank sheet,
// and the rules map's world draws itself in, piece by piece, in the order a
// game would build it:
//
//   Myth ♥        the Seed, the sea, three continents, mountains, forests,
//                 a lake and river, dunes, fungal hills
//   Antiquity ♦   a village, a tower, a pyramid, the volcano, mesas, boats
//   Ruin ♣        the volcano erupts and leaves its scars
//   Promise ♠     a walker, deer and birds, and the Seed's pulse
//
// The pointer is a quill: a click inks
// in the next piece at once, spreading from where you clicked. When the world
// is done it rests a while, then the page wipes clean and it starts again.
// Nothing is erased along the way, as the rules say. Decorative only.

(function () {
  const { TAU, wave, cycle, clamp, smooth, blob } = SceneKit;
  const { rnd, noise, QUD } = GlyphKit;

  const W = 1152, H = 432, FPS = 24, FRAMES = FPS * 12, TICK = 4;
  const COLS = 72, ROWS = 18;
  const { put, centre, cellOf, cellPath, loopPath } = GlyphKit.grid({ cols: COLS, rows: ROWS, ox: 0, oy: 0 });
  const key = (...k) => k.join(',');

  const PALETTES = {
    dark: {
      ...QUD.dark,
      jBg: '#11251a', jBg2: '#0d1d15', dBg: '#29230f', dBg2: '#332a12', fBg: '#25152a', fBg2: '#1e1123', iBg: '#2b2711',
      scorch: '#1e1412', stone: '#9aa3b5', pulse: 0.2,
    },
    light: {
      ...QUD.light,
      jBg: '#e2ead2', jBg2: '#d6e2c3', dBg: '#f1e4c1', dBg2: '#ecdcb0', fBg: '#eedbe8', fBg2: '#e6cfe0', iBg: '#f0e6be',
      scorch: '#ddd0c8', stone: '#5a6274', pulse: 0.22,
    },
  };

  // ---------- The world (the rules map, small) ----------

  const west = blob({ cx: 230, cy: 215, rx: 175, ry: 140, seed: 11, wobble: 0.15, harmonics: 9, n: 120, lobes: [
    { at: 0.8, amount: 0.3, width: 0.14 }, { at: -0.05, amount: -0.16, width: 0.15 }, { at: -2.25, amount: 0.2, width: 0.15 },
    { at: 2.45, amount: -0.12, width: 0.2 }, { at: -1.35, amount: 0.08, width: 0.2 },
  ] });
  const east = blob({ cx: 700, cy: 100, rx: 240, ry: 72, seed: 23, wobble: 0.12, harmonics: 9, n: 120, lobes: [
    { at: Math.PI - 0.22, amount: 0.14, width: 0.13 }, { at: 1.65, amount: -0.2, width: 0.17 }, { at: -0.6, amount: 0.16, width: 0.18 },
  ] });
  const south = blob({ cx: 1000, cy: 370, rx: 330, ry: 150, seed: 37, wobble: 0.1, harmonics: 9, n: 160, lobes: [
    { at: Math.PI + 0.42, amount: 0.22, width: 0.16 }, { at: -1.2, amount: -0.12, width: 0.2 },
  ] });
  const isle = blob({ cx: 470, cy: 232, rx: 40, ry: 24, seed: 41, wobble: 0.1, n: 40 });
  const lake = blob({ cx: 175, cy: 160, rx: 40, ry: 16, seed: 7, wobble: 0.1, n: 30 });

  const tone = noise('tone', 48), clump = noise('clump', 30), biome = noise('biome', 60), seaNoise = noise('sea', 50), edgeNoise = noise('edge', 80);
  const ground = (k, x, y) => (tone(x, y) > 0.55 ? k + '2' : k);
  const SEED = cellOf(470, 232);
  const VOLCANO = cellOf(820, 70), PYRAMID = cellOf(600, 82), TOWER = cellOf(900, 330);
  const MESAS = [cellOf(520, 122), cellOf(880, 132)];
  const HUTS = [cellOf(286, 300), cellOf(310, 312), cellOf(270, 324)];

  // Every cell's finished tile, sorted into the pieces that draw it.
  const sets = { isle: [], sea: [], west: [], east: [], south: [], forest: [], dunes: [], fungus: [], ridges: [], water: [], volcano: [], scars: [] };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const [x, y] = centre(c, r), q = rnd('b', c, r), k = clump(x, y), n = biome(x, y);
    const add = (set, tile) => sets[set].push([c, r, tile]);
    if (isle.contains(x, y)) add('isle', c === SEED[0] && r === SEED[1] ? { bg: 'iBg', g: 'seed', fg: 'G', dt: 'O' } : { bg: 'iBg', g: q < 0.5 ? 'grass' : 'dot', fg: q < 0.5 ? 'G' : 'W' });
    else if (west.contains(x, y)) {
      const bg = ground('jBg', x, y);
      add('west', { bg, g: q < 0.25 ? 'grass' : q < 0.32 ? 'dot' : null, fg: q < 0.25 ? 'g' : 'w' });
      if (lake.contains(x, y)) add('water', { bg, g: 'approx', fg: 'B', water: true });
      else if (k > 0.55 && n > 0.3) add('forest', { bg, g: y < 180 ? 'fir' : 'club', fg: tone(x + 300, y) > 0.5 ? 'G' : 'g', dt: 'w' });
    } else if (east.contains(x, y)) {
      const bg = ground('dBg', x, y);
      add('east', { bg, g: q < 0.4 ? 'dot' : null, fg: 'w' });
      if (Math.abs(c - VOLCANO[0]) <= 1 && Math.abs(r - VOLCANO[1]) <= 1 && !(c === VOLCANO[0] && r === VOLCANO[1]) && r >= VOLCANO[1]) add('volcano', { bg, g: 'mountain', fg: 'r', dt: 'r' });
      else if (n > 0.55 && k > 0.35) add('dunes', { bg, g: 'hill', fg: k > 0.6 ? 'O' : 'W' });
      else if (n < 0.35) add('dunes', { bg, g: 'shade1', fg: 'y' });
      if (Math.hypot(x - 820, y - 90) < 70 && q < 0.5) add('scars', { bg: 'scorch', g: 'shade1', fg: q < 0.25 ? 'R' : 'r' });
    } else if (south.contains(x, y)) {
      const bg = ground('fBg', x, y);
      add('south', { bg, g: q < 0.3 ? 'grass' : q < 0.4 ? 'dot' : null, fg: 'm' });
      if (Math.abs(y - (300 + 14 * Math.sin(x / 45))) < 12 && x > 700) add('ridges', { bg, g: 'mountain', fg: k > 0.5 ? 'M' : 'm', dt: 'Y' });
      else if (Math.hypot(x - 760, y - 370) < 44) add('fungus', { bg, g: q < 0.5 ? 'crystal' : 'shard', fg: 'C', dt: 'M' });
      else if (n > 0.55 && k > 0.45) add('fungus', { bg, g: 'mush', fg: k > 0.65 ? 'M' : 'm', dt: 'y' });
    } else {
      const s = ((x - W / 2) / (W / 2 - 6)) ** 4 + ((y - H / 2) / (H / 2 - 4)) ** 4 + (edgeNoise(x, y) - 0.5) * 0.5;
      if (s < 1) {
        const edge = clamp((1 - s) / 0.5), v = seaNoise(x, y);
        if (v * edge > 0.32) add('sea', { g: v > 0.62 ? 'approx' : v > 0.5 ? 'tilde' : 'dot', fg: v > 0.62 ? 'C' : v > 0.5 ? 'c' : 'K', sea: true, alpha: clamp(edge * 2) });
      }
    }
  }
  // The river runs from the lake to the sea, a cell at a time.
  for (const [c, r] of cellPath([[200, 172], [228, 210], [262, 246], [292, 282], [330, 318]])) if (west.contains(...centre(c, r))) sets.water.push([c, r, { bg: 'jBg', g: 'approx', fg: 'B', water: true }]);
  const tileAt = (cr, tile) => [cr[0], cr[1], tile];

  const LANES = [[[380, 300], [600, 330]], [[520, 168], [640, 196]]].map(([a, b]) => cellPath([a, b]).filter(([c, r]) => !west.contains(...centre(c, r)) && !south.contains(...centre(c, r))));
  const WALKER = loopPath(Array.from({ length: 25 }, (_, i) => [690 + Math.cos((i / 24) * TAU) * 60, 112 + Math.sin((i / 24) * TAU) * 22]));
  const DEER = cellPath([[150, 250], [210, 268], [260, 250]]);

  const PIECES = [
    { era: 0, cells: sets.isle, mode: 'pop' },
    { era: 0, cells: sets.sea, mode: 'spread', rate: 50, from: SEED },
    { era: 0, cells: sets.west, mode: 'spread', rate: 16 },
    { era: 0, cells: sets.east, mode: 'spread', rate: 16 },
    { era: 0, cells: sets.south, mode: 'spread', rate: 22 },
    { era: 0, cells: sets.ridges, mode: 'stroke', rate: 3 },
    { era: 0, cells: sets.forest, mode: 'spread', rate: 5 },
    { era: 0, cells: sets.water, mode: 'stroke', rate: 2 },
    { era: 0, cells: sets.dunes, mode: 'spread', rate: 6 },
    { era: 0, cells: sets.fungus, mode: 'spread', rate: 6 },
    { era: 1, cells: HUTS.map((h) => tileAt(h, { bg: 'jBg', g: 'hut', fg: 'R', dt: 'w' })), mode: 'stroke', rate: 1 },
    { era: 1, cells: [tileAt(TOWER, { bg: 'fBg', g: 'tower', fg: 'y', dt: 'O' })], mode: 'pop' },
    { era: 1, cells: [tileAt(PYRAMID, { bg: 'dBg', g: 'pyramid', fg: 'W', dt: 'r' })], mode: 'pop' },
    { era: 1, cells: [tileAt(VOLCANO, { bg: 'dBg', g: 'volcano', fg: 'r', dt: 'R', volcano: true }), ...sets.volcano], mode: 'pop' },
    { era: 1, cells: MESAS.flatMap((m) => [-1, 0, 1].map((d) => tileAt([m[0] + d, m[1]], { bg: 'dBg', g: 'mesa', fg: 'r', dt: 'R' }))), mode: 'pop' },
    { era: 1, sprite: 'boats' },
    { era: 2, cells: [...sets.scars, tileAt(PYRAMID, { bg: 'scorch', g: 'ruin', fg: 'w' }), tileAt(HUTS[1], { bg: 'scorch', g: 'shade2', fg: 'r' })], mode: 'spread', rate: 3, from: VOLCANO, event: 'erupt' },
    { era: 3, sprite: 'walker' },
    { era: 3, sprite: 'deer' },
    { era: 3, sprite: 'birds' },
    { era: 3, event: 'pulse' },
  ];
  const GAP = 8, HOLD = 60, WIPE = 20;

  // The board's dot grid, fading out toward the edges like the map's sea.
  const GRID = [];
  for (let r = 1; r < ROWS; r += 2) for (let c = 1; c < COLS; c += 2) {
    const [x, y] = centre(c, r);
    const s = ((x - W / 2) / (W / 2)) ** 4 + ((y - H / 2) / (H / 2)) ** 4 + (edgeNoise(x, y) - 0.5) * 0.5;
    if (s < 1) GRID.push([c, r, 0.35 * clamp((1 - s) / 0.5)]);
  }

  // ---------- State ----------

  const state = {};
  function reset(step) {
    Object.assign(state, { step, pointer: null, shown: new Map(), piece: 0, order: null, done: 0, next: step + 6, sprites: new Set(), events: {}, completeAt: null, wipeAt: null, splashes: [] });
  }
  reset(0);

  function begin(step, origin) {
    const p = PIECES[state.piece];
    if (p.event) state.events[p.event] = step;
    if (p.sprite) state.sprites.add(p.sprite);
    if (!p.cells) { state.order = []; return; }
    const from = origin && p.mode === 'spread' && p.cells.some(([c, r]) => c === origin[0] && r === origin[1]) ? origin : p.from;
    const [ox, oy] = from || p.cells.reduce(([a, b], [c, r]) => [a + c / p.cells.length, b + r / p.cells.length], [0, 0]);
    state.order = p.mode === 'spread'
      ? [...p.cells].sort((a, b) => Math.hypot(a[0] - ox, (a[1] - oy) * 1.5) + rnd('jit', a[0], a[1]) * 2 - Math.hypot(b[0] - ox, (b[1] - oy) * 1.5) - rnd('jit', b[0], b[1]) * 2)
      : p.cells;
    state.done = 0;
  }
  function reveal(step, n) {
    for (let i = 0; i < n && state.done < state.order.length; i++, state.done++) {
      const [c, r, tile] = state.order[state.done];
      state.shown.set(key(c, r), { c, r, tile, at: step });
    }
    if (state.done >= state.order.length) {
      state.order = null;
      state.piece++;
      state.next = step + GAP;
      if (state.piece >= PIECES.length) state.completeAt = step;
    }
  }

  function update(step) {
    state.step = step;
    state.splashes = state.splashes.filter((s) => step - s.born < 4);
    if (state.wipeAt !== null) { if (step - state.wipeAt > WIPE) reset(step); return; }
    if (state.completeAt !== null) { if (step - state.completeAt > HOLD) state.wipeAt = step; return; }
    if (!state.order) {
      if (step < state.next) return;
      begin(step);
    }
    const p = PIECES[state.piece];
    reveal(step, p.mode === 'pop' ? Infinity : p.rate || 1);
  }

  function hover(x, y) {
    state.pointer = x === null ? null : cellOf(x, y);
  }
  function click(x, y) {
    const step = state.step, at = cellOf(x, y);
    if (state.wipeAt !== null) return;
    state.splashes.push({ c: at[0], r: at[1], born: step });
    if (state.completeAt !== null) { state.wipeAt = step; return; }
    if (state.order) reveal(step, Infinity);
    else {
      begin(step, at);
      reveal(step, PIECES[state.piece].mode === 'pop' ? Infinity : 1);
    }
  }
  const cursor = () => (state.pointer ? 'none' : '');

  // ---------- Drawing ----------

  function drawShown(ctx, P, step, amb) {
    const wipe = state.wipeAt !== null ? (step - state.wipeAt) * (COLS / WIPE) : -1;
    for (const s of state.shown.values()) {
      if (s.c < wipe) continue;
      const age = step - s.at;
      if (age < 1) { put(ctx, P, s.c, s.r, { g: 'dot', fg: 'W' }); continue; }
      let tile = s.tile;
      if (tile.sea && (s.c * 3 + s.r * 5 + Math.floor(amb / 4)) % 11 === 0) tile = { ...tile, g: tile.g === 'approx' ? 'tilde' : 'approx' };
      if (tile.water) tile = { ...tile, g: (s.c + s.r + Math.floor(amb / 3)) % 3 ? 'approx' : 'tilde' };
      if (tile.volcano) tile = { ...tile, dt: ['R', 'o', 'O'][Math.floor(amb / 3) % 3] };
      put(ctx, P, s.c, s.r, age < 2 ? { ...tile, alpha: (tile.alpha ?? 1) * 0.6 } : tile);
    }
    if (wipe >= 0) for (let r = 0; r < ROWS; r++) put(ctx, P, Math.floor(wipe), r, { g: 'shade2', fg: 'K', alpha: 0.6 });
  }

  function drawLife(ctx, P, step, amb) {
    if (state.wipeAt !== null) return;
    const shown = (c, r) => state.shown.has(key(c, r));
    if (shown(...VOLCANO)) {
      const e = state.events.erupt, k = e !== undefined ? step - e : Infinity;
      if (k < 24) {
        for (let up = 1; up <= Math.min(k + 1, 3); up++) put(ctx, P, VOLCANO[0], VOLCANO[1] - up, { g: up === 3 ? 'shade2' : 'flame', fg: up === 3 ? 'y' : 'R', dt: 'W' });
        for (let i = 0; i < 3; i++) put(ctx, P, VOLCANO[0] + Math.round((rnd('spit', step, i) - 0.5) * 6), VOLCANO[1] - 1 - Math.floor(rnd('spitu', step, i) * 2), { g: 'dot', fg: i ? 'o' : 'W' });
      } else {
        const t = cycle(amb / 48, 1);
        put(ctx, P, VOLCANO[0] + Math.round(t * 2), VOLCANO[1] - 1 - Math.floor(t * 3), { g: 'shade1', fg: 'y', alpha: 0.6 * (1 - t) });
      }
    }
    if (state.sprites.has('boats')) LANES.forEach((lane, i) => {
      if (lane.length < 2) return;
      const span = lane.length - 1, k = (Math.floor(amb / 3) + i * 4) % (span * 2), j = k < span ? k : span * 2 - k;
      put(ctx, P, ...lane[j], { g: 'boat', fg: 'Y', dt: 'w', flip: k >= span });
    });
    if (state.sprites.has('walker')) {
      const [c, r] = WALKER[Math.floor(amb / 2) % WALKER.length];
      put(ctx, P, c, r, { bg: 'dBg', g: 'walker', fg: 'Y', dt: 'o' });
    }
    if (state.sprites.has('deer')) {
      const span = DEER.length - 1, k = Math.floor(amb / 4) % (span * 2), j = k < span ? k : span * 2 - k;
      put(ctx, P, ...DEER[j], { bg: 'jBg', g: k % 3 ? 'deer' : 'deerGraze', fg: 'w', flip: k >= span });
    }
    if (state.sprites.has('birds')) for (let i = 0; i < 3; i++) {
      const a = amb * 0.12 + (i * TAU) / 3;
      put(ctx, P, 14 + Math.round(Math.cos(a) * 4), 4 + Math.round(Math.sin(a)), { g: (amb + i) % 2 ? 'birdUp' : 'birdDown', fg: 'Y' });
    }
    // The finale: the Seed's pulse rolls out over everything drawn.
    const p = state.events.pulse;
    if (p !== undefined && step - p < 30) {
      const k = (step - p) / 30, radius = k * 700, [sx, sy] = centre(...SEED);
      for (const s of state.shown.values()) {
        const [x, y] = centre(s.c, s.r);
        if (Math.abs(Math.hypot(x - sx, y - sy) - radius) < 22) put(ctx, P, s.c, s.r, s.tile.sea ? { g: 'approx', fg: 'O', alpha: 1 - smooth(k) } : { bg: 'O', alpha: P.pulse * (1 - smooth(k)) });
      }
    }
    if (shown(...SEED)) {
      put(ctx, P, ...SEED, { bg: 'O', alpha: 0.2 + 0.2 * wave(amb / 18, 1) });
      put(ctx, P, ...SEED, { g: 'seed', fg: 'G', dt: 'O' });
    }
  }

  function render(ctx, step, theme, { calm = false } = {}) {
    const P = PALETTES[theme];
    const amb = calm ? 0 : step;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, W, H);
    // A blank board: a faint grid of dots that frays out at the edges.
    for (const [c, r, a] of GRID) if (!state.shown.has(key(c, r))) put(ctx, P, c, r, { g: 'dot', fg: 'K', alpha: a });
    drawShown(ctx, P, step, amb);
    drawLife(ctx, P, step, amb);
    for (const s of state.splashes) {
      const k = step - s.born;
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) put(ctx, P, s.c + dc * (k > 1 ? 2 : 1), s.r + dr, { g: 'dot', fg: 'Y', alpha: 1 - k / 4 });
    }
    if (state.pointer) put(ctx, P, ...state.pointer, { g: 'quill', fg: 'Y', dt: 'w' });
  }

  SceneKit.register({
    name: 'board', width: W, height: H, fps: FPS, frames: FRAMES, tick: TICK, poster: 1000,
    backgrounds: { light: PALETTES.light.paper, dark: PALETTES.dark.paper },
    // For previews and the poster, play the world forward to the frame asked for.
    draw: (ctx, frame, theme) => {
      const step = Math.floor(frame / TICK);
      if (step < state.step) reset(0);
      while (state.step < step) update(state.step + 1);
      render(ctx, step, theme);
    },
    render, update, hover, click, cursor, state,
  });
})();
