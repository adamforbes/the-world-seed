// Rules page hero: the world of hero-map drawn as a roguelike tile map in the
// manner of Caves of Qud. Every cell is an 8×12 bitmap glyph in one
// foreground and one detail colour, shown at 2×.
//
// It plays live on the page and stays quiet until the reader plays with it:
//   the sea         ripples follow the pointer; a click raises a sea serpent
//                   that circles for a while and dives
//   the west        birds lift off the groves and deer bolt as the pointer
//                   passes; a click bursts the meadow into bloom, plants a
//                   tree and sends up a flock; the bloom fades back in time
//   the north-east  the walker follows the pointer; a click has him build a
//                   pyramid, and in time the volcano drops lava on each one
//   the south-east  the pointer is a target; a click calls down lightning
//                   and the blasted ground grows back
//   the isle        a click sends the World Seed's pulse out over the world
//
// It's decorative: nothing here is a link or carries meaning. Preview it with
// art/scenes/glyph-map.html (?live to play), which also renders the poster.

(function () {
  const { TAU, wave, cycle, lerp, clamp, smooth, blob } = SceneKit;
  const { rnd, noise, connector, dirTo, QUD } = GlyphKit;

  // The world is 1400×788 (all geography below is in these "world" pixels).
  // It sits in the middle of a wider strip of sea so the page can run it as a
  // full-width banner, cropping the sea's ends to fit the window.
  const SHIFT = 576;                        // sea added each side: 36 whole cells
  const W = 1400 + 2 * SHIFT, H = 788, FPS = 24, FRAMES = FPS * 12;
  const TICK = 4;               // frames per step: the world moves at 6 Hz, like game turns
  const STEPS = FRAMES / TICK;  // 72 steps in the preview loop
  const COLS = 86 + 72, ROWS = 32, OX = 12 - SHIFT, OY = 10;
  const { centre, cellOf, put, cellPath, loopPath } = GlyphKit.grid({ cols: COLS, rows: ROWS, ox: OX, oy: OY });

  const PALETTES = {
    dark: {
      ...QUD.dark,
      jBg: '#11251a', dBg: '#29230f', fBg: '#25152a', iBg: '#2b2711',
      jBg2: '#0d1d15', dBg2: '#332a12', fBg2: '#1e1123',
      scorch: '#160e0e', ash: '#5a4a44', bolt: '#ffffff', glow: '#7fc8ff', flash: 'rgba(255, 255, 255, 0.14)',
      pulse: 0.2,
    },
    light: {
      ...QUD.light,
      jBg: '#e2ead2', dBg: '#f1e4c1', fBg: '#eedbe8', iBg: '#f0e6be',
      jBg2: '#d6e2c3', dBg2: '#ecdcb0', fBg2: '#e6cfe0',
      scorch: '#d8c8c0', ash: '#9a877e', bolt: '#3b3fb8', glow: '#b3bfff', flash: 'rgba(255, 255, 255, 0.6)',
      pulse: 0.22,
    },
  };

  const blank = '........';
  GlyphKit.define({
    bomb: [blank, blank, blank, '..####..', '.#dddd#.', '.#dddd#.', '..####..', blank, blank, blank, blank, blank],
  });

  // ---------- Noise ----------

  const biomeNoise = noise('biome', 70);
  const seaNoise = noise('sea', 55);
  const edgeNoise = noise('edge', 90);
  const clump = noise('clump', 26);
  const tone = noise('tone', 48);
  // Ground comes in two tones, in patches, so the land reads as a quilt.
  const ground = (key, x, y) => (tone(x, y) > 0.55 ? key + '2' : key);

  // ---------- Geography ----------
  // The hero-map world, enlarged to fill the long banner: Greenwood (west) and
  // Sunreach (north-east) at about 1.6×, and Rosemount (south-east) at about
  // 3×, running off the frame's right and bottom edges. Greenwood's and
  // Sunreach's landmarks were placed on the old map, so they're carried over
  // with the same stretch as their continent.

  const stretch = (from, to, kx, ky) => ([x, y]) => [to[0] + (x - from[0]) * kx, to[1] + (y - from[1]) * ky];
  const toWest = stretch([334, 378], [250, 392], 1.7, 1.35);
  const toEast = stretch([978, 222], [1110, 206], 1.6, 1.2);

  const west = blob({ cx: 250, cy: 392, rx: 205 * 1.7, ry: 218 * 1.35, seed: 11, wobble: 0.15, harmonics: 9, n: 160, lobes: [
    { at: 0.8, amount: 0.3, width: 0.14 },
    { at: -0.05, amount: -0.16, width: 0.15 },
    { at: -2.25, amount: 0.2, width: 0.15 },
    { at: 2.45, amount: -0.12, width: 0.2 },
    { at: -1.35, amount: 0.08, width: 0.2 },
  ] });
  const east = blob({ cx: 1110, cy: 206, rx: 252 * 1.6, ry: 126 * 1.2, seed: 23, wobble: 0.12, harmonics: 9, n: 160, lobes: [
    { at: Math.PI - 0.22, amount: 0.14, width: 0.13 },
    { at: 1.65, amount: -0.2, width: 0.17 },
    { at: -0.6, amount: 0.16, width: 0.18 },
  ] });
  const south = blob({ cx: 1560, cy: 720, rx: 560, ry: 300, seed: 37, wobble: 0.1, harmonics: 9, n: 200, lobes: [
    { at: Math.PI + 0.42, amount: 0.22, width: 0.16 },  // an arm reaching towards the World Seed
    { at: -1.2, amount: -0.12, width: 0.2 },            // a bay in the north shore
    { at: Math.PI - 0.3, amount: -0.1, width: 0.2 },
  ] });
  const seedIsle = blob({ cx: 700, cy: 408, rx: 60, ry: 40, seed: 41, wobble: 0.1, n: 48 });
  const islets = [[-300, 210], [-450, 560], [-130, 690], [640, 140], [860, 480], [1690, 110], [1880, 330], [610, 730], [960, 700]];
  const lake = blob({ cx: toWest([290, 292])[0], cy: toWest([290, 292])[1], rx: 48 * 1.7, ry: 22 * 1.35, seed: 7, wobble: 0.1, n: 40 });
  const pond = blob({ cx: toEast([965, 290])[0], cy: toEast([965, 290])[1], rx: 26 * 1.6, ry: 12 * 1.2, seed: 8, wobble: 0.1, n: 40 });

  const SEED = { x: 700, y: 404 };
  const VILLAGE = toWest([392, 548]);
  const HILLS_BELOW = toWest([0, 236])[1], PINES_BELOW = toWest([0, 372])[1];   // Greenwood's north is hills and pines
  const VOLCANO = toEast([1085, 150]), PYRAMID = toEast([854, 160]);
  const MESAS = [toEast([771, 262]), toEast([1176, 270]), toEast([1020, 120])];
  const HOME = cellOf(...toEast([1000, 214]));   // where the walker waits
  // Rosemount: two mountain ranges, crystal fields and two towers.
  const RIDGES = [
    { from: 1150, to: 1990, y: (x) => 560 + 22 * Math.sin(x / 50) },
    { from: 1260, to: 1840, y: (x) => 700 + 18 * Math.sin(x / 41 + 2) },
  ];
  const CRYSTALS = [[1060, 650, 50], [1730, 630, 44], [1930, 760, 40], [1380, 760, 36]];
  const TOWERS = [[1440, 620], [1880, 660]];

  // The sea is a long squarish plate that frays into the page at its rim.
  const PLATE = { cx: 700, cy: H / 2, a: W / 2 - 16, b: 380, n: 4 };
  const plate = (x, y) => Math.abs((x - PLATE.cx) / PLATE.a) ** PLATE.n + Math.abs((y - PLATE.cy) / PLATE.b) ** PLATE.n;

  const near = (x, y, [px, py], d) => Math.hypot(x - px, y - py) < d;
  const key = (c, r) => c + ',' + r;

  const RIVER = new Set(cellPath([[320, 304], [352, 352], [404, 392], [436, 444], [472, 486], [520, 520]].map(toWest)).map(([c, r]) => key(c, r)));

  // ---------- Tiles ----------
  // `tree` and `solid` cells can't be planted on; `block` cells can't be walked.

  function westTile(x, y, c, r, coast) {
    const n = biomeNoise(x, y), k = clump(x, y), q = rnd('w', c, r), bg = ground('jBg', x, y);
    if (lake.contains(x, y) || RIVER.has(key(c, r))) return { anim: 'water', bg };
    if (near(x, y, VILLAGE, 50)) return q < 0.6 ? { g: 'hut', fg: 'R', dt: 'w', bg, solid: true } : { g: 'dot', fg: 'w', bg };
    if (coast) return { g: q < 0.4 ? 'grass' : q < 0.7 ? 'dot' : null, fg: q < 0.4 ? 'g' : 'w', bg };
    // Groves, with open meadow between them to plant in.
    if (k > 0.62 && n > 0.36 && q > 0.15) {
      const fg = tone(x + 300, y) > 0.5 ? 'G' : 'g';
      if (y < HILLS_BELOW) return { g: 'fir', fg, dt: 'w', bg, tree: true };
      return { g: y < PINES_BELOW + 80 * (k - 0.5) ? 'fir' : 'club', fg, dt: 'w', bg, tree: true };
    }
    if (y < HILLS_BELOW && q < 0.3) return { g: 'hill', fg: 'g', bg, solid: true };
    return { g: q < 0.28 ? 'grass' : q < 0.36 ? 'shade1' : null, fg: 'g', bg };
  }

  function eastTile(x, y, c, r, coast) {
    const n = biomeNoise(x, y), k = clump(x, y), q = rnd('e', c, r);
    const [vc, vr] = cellOf(...VOLCANO), [pc, pr] = cellOf(...PYRAMID);
    if (c === vc && r === vr) return { anim: 'volcano', bg: 'dBg', block: true };
    if (r === vr && Math.abs(c - vc) <= 2 && c !== vc) return { g: 'mountain', fg: 'r', dt: 'r', bg: 'dBg', block: true };
    if (r === vr + 1 && Math.abs(c - vc) <= 3) return { g: 'mountain', fg: q < 0.5 ? 'r' : 'w', dt: 'r', bg: 'dBg', block: true };
    if (c === pc && r === pr) return { g: 'pyramid', fg: 'W', dt: 'r', bg: 'dBg', block: true };
    if (r === pr && c === pc + 1) return { g: 'ruin', fg: 'w', bg: 'dBg', block: true };
    for (const m of MESAS) {
      const [mc, mr] = cellOf(...m);
      if (r === mr && Math.abs(c - mc) <= 1) return { g: 'mesa', fg: 'r', dt: 'R', bg: 'dBg', block: true };
    }
    if (pond.contains(x, y)) return { anim: 'water', bg: 'dBg', block: true };
    if (pond.contains(x, y, -34)) return { g: 'club', fg: 'G', dt: 'w', bg: 'dBg', block: true };
    const bg = ground('dBg', x, y);
    if (coast) return { g: q < 0.6 ? 'dot' : null, fg: 'W', bg };
    if (q < 0.04) return { g: 'cactus', fg: 'G', bg, block: true };
    if (n > 0.58 && k > 0.35) return { g: q < 0.8 ? 'hill' : 'tilde', fg: k > 0.6 ? 'O' : 'W', bg };
    if (n < 0.36) return { g: 'shade1', fg: k > 0.45 ? 'y' : 'w', bg };
    return { g: q < 0.45 ? 'dot' : null, fg: 'w', bg };
  }

  function southTile(x, y, c, r, coast) {
    const n = biomeNoise(x, y), k = clump(x, y), q = rnd('s', c, r), bg = ground('fBg', x, y);
    if (TOWERS.some((t) => key(...cellOf(...t)) === key(c, r))) return { anim: 'tower', bg };
    for (const ridge of RIDGES) {
      if (x < ridge.from || x > ridge.to || Math.abs(y - ridge.y(x)) >= 18) continue;
      if (q < 0.2) return { g: 'hill', fg: 'm', bg };
      return { g: 'mountain', fg: k > 0.5 ? 'M' : 'm', dt: 'Y', bg };
    }
    if (CRYSTALS.some(([cx, cy, d]) => near(x, y, [cx, cy], d))) return { g: q < 0.5 ? 'crystal' : 'shard', fg: 'C', dt: 'M', bg };
    if (coast) return { g: q < 0.5 ? 'grass' : null, fg: 'm', bg };
    if (n > 0.55 && k > 0.5) return { g: 'mush', fg: k > 0.65 ? 'M' : 'm', dt: 'y', bg };
    return { g: q < 0.25 ? 'grass' : q < 0.4 ? 'dot' : q < 0.5 ? 'shade1' : null, fg: 'm', bg };
  }

  function isleTile(x, y, c, r) {
    const [sc, sr] = cellOf(SEED.x, SEED.y);
    if (c === sc && r === sr) return { anim: 'seed', bg: 'iBg' };
    return { g: rnd('i', c, r) < 0.5 ? 'dot' : 'grass', fg: rnd('i2', c, r) < 0.5 ? 'W' : 'G', bg: 'iBg' };
  }

  const continents = [[west, westTile, 'west'], [east, eastTile, 'east'], [south, southTile, 'south'], [seedIsle, isleTile, 'isle']];
  const landAt = (x, y) => continents.find(([shape]) => shape.contains(x, y));
  const isletCells = new Set(islets.map((p) => key(...cellOf(...p))));

  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push([]);
    for (let c = 0; c < COLS; c++) {
      const [x, y] = centre(c, r);
      const land = landAt(x, y);
      if (land) {
        const coast = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => !landAt(...centre(c + dc, r + dr)));
        grid[r].push({ kind: 'land', region: land[2], c, r, x, y, ...land[1](x, y, c, r, coast) });
      } else if (isletCells.has(key(c, r))) {
        grid[r].push({ kind: 'land', region: 'islet', c, r, x, y, g: rnd('il', c, r) < 0.5 ? 'club' : 'dot', fg: 'G', dt: 'w', bg: 'iBg' });
      } else {
        const s = plate(x, y) + (edgeNoise(x, y) - 0.5) * 0.5;
        grid[r].push({ kind: s < 1 ? 'sea' : 'void', region: s < 1 ? 'sea' : null, c, r, x, y, edge: clamp((1 - s) / 0.5), nz: seaNoise(x, y) });
      }
    }
  }
  const cells = grid.flat();
  const cellAt = (c, r) => grid[r]?.[c];
  const isSea = (c, r) => cellAt(c, r)?.kind === 'sea';
  for (const cell of cells) {
    cell.d = Math.hypot(cell.x - SEED.x, cell.y - SEED.y);
    if (cell.kind === 'sea') cell.shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => cellAt(cell.c + dc, cell.r + dr)?.kind === 'land');
  }
  const seaCells = cells.filter((cell) => cell.kind === 'sea');
  const landCells = cells.filter((cell) => cell.kind === 'land');
  const westCells = landCells.filter((cell) => cell.region === 'west');
  // A quarter of the groves have birds in them.
  const roosts = westCells.filter((cell) => cell.tree && rnd('roost', cell.c, cell.r) < 0.25);
  // The deer start in three meadows.
  const meadow = (cell) => cell?.region === 'west' && !cell.anim && !cell.solid && !cell.tree;
  const nearestMeadow = ([x, y]) => westCells.filter(meadow).reduce((a, b) => (Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b));
  const animCells = cells.filter((cell) => cell.anim);

  // Ferry lanes (as in hero-map), as chains of sea cells.
  function lane(fromShape, fromAt, toShape, toAt, bend) {
    const a = fromShape.at(fromAt, 26), b = toShape.at(toAt, 26);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = [(a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * bend, (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * bend];
    const pts = Array.from({ length: 41 }, (_, i) => {
      const u = i / 40;
      return [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * k[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * k[1] + u * u * b[1]];
    });
    return cellPath(pts).filter(([c, r]) => isSea(c, r));
  }
  const LANES = [
    { path: lane(west, -0.42, east, 2.42, 28), phase: 0 },
    { path: lane(west, 0.4, south, Math.PI - 0.08, -22), phase: 0.5 },
  ];

  // ---------- What the reader has done ----------
  // Everything is timed in steps. Lists are pruned in update() as things end.

  const state = {
    step: 0,
    hover: null,          // { c, r, cell, region } under the pointer
    ripples: [],          // { x, y, born, strong }
    pulses: [],           // { born } the World Seed's rings
    sparks: [],           // { c, r, born } around the Seed
    serpent: null,        // the one sea serpent: { c, r, born, path, dive, dived }
    nextSerpent: null,    // where it comes up next, once it's gone under
    planted: new Map(),   // key → { g, fg, born } trees that stay
    nextTree: 0,
    blooms: [],           // { x, y, born, radius } bursts spreading from a click
    growth: new Map(),    // key → { kind, g, fg, at, until } what a bloom grew, for a while
    birds: [],            // { x, y, vx, vy, born } in flight
    roosting: new Map(),  // key → step a roost's birds come back
    deer: [],             // { c, r, flip, flee, from, rest }
    walker: { c: HOME[0], r: HOME[1], flip: false, job: null },  // job: { c, r, start }
    queue: [],            // pyramid sites waiting for the walker
    pyramids: [],         // { c, r, doom, doomed }
    eruptions: [],        // { target, born, flight, landed }
    blasts: [],           // { c, r, born } lava landing
    rubble: new Map(),    // key → { born }
    strikes: [],          // { c, r, born } lightning
    scorched: new Map(),  // key → { born, heals }
  };

  const RIPPLE_LIFE = 7;
  const PULSE_LIFE = 48, PULSE_REACH = 1300, PULSE_BAND = 30;
  const SERPENT = { rise: 4, swim: 48, speed: 0.75, humps: 5 };
  // Its head's place along its path (negative while still rising), and the
  // step its tail has followed it under.
  const serpentHead = (s, step) => Math.floor((step - s.born - SERPENT.rise) * SERPENT.speed);
  const serpentGone = (s) => s.born + SERPENT.rise + Math.ceil((s.dive + SERPENT.humps * 2 + 1) / SERPENT.speed);
  const BUILD_STEPS = 9, RUMBLE = 5, RUBBLE_LIFE = 40;
  const TREES = [{ g: 'fir', fg: 'G' }, { g: 'club', fg: 'g' }, { g: 'fir', fg: 'g' }, { g: 'club', fg: 'G' }];
  const BLOOM = { speed: 26, reach: 210 };
  const PETALS = ['M', 'W', 'R', 'm', 'Y'];
  for (const at of [[250, 470], [420, 310], [330, 590]]) {
    const cell = nearestMeadow(toWest(at));
    state.deer.push({ c: cell.c, r: cell.r, flip: rnd('deer', cell.c) < 0.5, flee: 0, from: null, rest: Math.floor(rnd('rest', cell.c) * 20) });
  }
  const NEAR = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  const plantable = (cell) => cell?.region === 'west' && !cell.anim && !cell.tree && !cell.solid && !state.planted.has(key(cell.c, cell.r));
  const pyramidAt = (c, r) => state.pyramids.some((p) => p.c === c && p.r === r);
  const building = (c, r) => state.walker.job?.start !== undefined && state.walker.job.c === c && state.walker.job.r === r;
  const walkable = (c, r) => {
    const cell = cellAt(c, r);
    return cell?.region === 'east' && !cell.anim && !cell.block && !pyramidAt(c, r) && !building(c, r);
  };
  const buildable = (c, r) => walkable(c, r) && !state.rubble.has(key(c, r))
    && !state.queue.some((q) => q.c === c && q.r === r) && !(state.walker.job?.c === c && state.walker.job?.r === r);

  // The first step from `from` towards the nearest of `goals`, over walkable cells.
  function nextStep(from, goals) {
    const wanted = new Set(goals.map(([c, r]) => key(c, r)));
    const prev = new Map([[key(...from), null]]);
    const queue = [from];
    while (queue.length) {
      const here = queue.shift();
      if (wanted.has(key(...here))) {
        let cell = here;
        while (prev.get(key(...cell)) && key(...prev.get(key(...cell))) !== key(...from)) cell = prev.get(key(...cell));
        return cell;
      }
      for (const [dc, dr] of NEAR) {
        const next = [here[0] + dc, here[1] + dr];
        if (!prev.has(key(...next)) && walkable(...next)) { prev.set(key(...next), here); queue.push(next); }
      }
    }
    return null;
  }

  function stepWalker(step) {
    const w = state.walker;
    if (w.job?.start !== undefined) {
      if (step - w.job.start >= BUILD_STEPS) {
        const { c, r } = w.job;
        state.pyramids.push({ c, r, doom: step + 36 + Math.floor(rnd('doom', c, r, step) * 48) });
        w.job = null;
      }
      return;
    }
    if (!w.job && state.queue.length) w.job = state.queue.shift();
    let goals;
    if (w.job) goals = NEAR.map(([dc, dr]) => [w.job.c + dc, w.job.r + dr]).filter(([c, r]) => walkable(c, r));
    else if (state.hover?.region === 'east' && walkable(state.hover.c, state.hover.r)) goals = [[state.hover.c, state.hover.r]];
    else return;
    if (goals.some(([c, r]) => c === w.c && r === w.r)) {
      if (w.job) { w.job.start = step; w.flip = w.job.c < w.c; }
      return;
    }
    const next = nextStep([w.c, w.r], goals);
    if (!next) { w.job = null; return; }
    if (next[0] !== w.c) w.flip = next[0] < w.c;
    [w.c, w.r] = next;
  }

  function update(step) {
    state.step = step;
    stepWalker(step);
    stepWest(step);

    // The volcano picks off each pyramid in its own time.
    const [vc, vr] = cellOf(...VOLCANO);
    for (const p of state.pyramids) {
      if (p.doomed || step < p.doom) continue;
      p.doomed = true;
      state.eruptions.push({ target: p, born: step, flight: clamp(Math.round(Math.hypot(p.c - vc, p.r - vr) / 1.6), 5, 12) });
    }
    for (const e of state.eruptions) {
      if (e.landed || step - e.born < RUMBLE + e.flight) continue;
      e.landed = true;
      state.pyramids = state.pyramids.filter((p) => p !== e.target);
      state.blasts.push({ c: e.target.c, r: e.target.r, born: step });
      state.rubble.set(key(e.target.c, e.target.r), { born: step });
    }

    // A splash where the serpent goes under; once it's gone, it may come up elsewhere.
    const s = state.serpent;
    if (s && !s.dived && serpentHead(s, step) >= s.dive) {
      s.dived = true;
      const [x, y] = centre(...s.path[s.dive % s.path.length]);
      state.ripples.push({ x, y, born: step, strong: true });
    }
    if (s && step >= serpentGone(s)) state.serpent = null;
    if (state.nextSerpent && step >= state.nextSerpent.born && !state.serpent) {
      state.serpent = state.nextSerpent;
      state.nextSerpent = null;
    }

    const alive = (list, life) => list.filter((it) => step - it.born <= (typeof life === 'function' ? life(it) : life));
    state.ripples = alive(state.ripples, RIPPLE_LIFE);
    state.pulses = alive(state.pulses, PULSE_LIFE);
    state.sparks = alive(state.sparks, 6);
    state.eruptions = alive(state.eruptions, (e) => RUMBLE + e.flight + 1);
    state.blasts = alive(state.blasts, 4);
    state.strikes = alive(state.strikes, 6);
    for (const [k, r] of state.rubble) if (step - r.born > RUBBLE_LIFE) state.rubble.delete(k);
    for (const [k, s] of state.scorched) if (step > s.heals + 6) state.scorched.delete(k);
  }

  // The west: blooms spreading and fading, birds taking off, deer startling.
  const deerCanStand = (c, r) => meadow(cellAt(c, r)) && !state.planted.has(key(c, r)) && !state.deer.some((d) => d.c === c && d.r === r);
  function launchBirds(x, y, count, away, seed) {
    for (let i = 0; i < count && state.birds.length < 40; i++) {
      const a = away + (rnd('fly', seed, i) - 0.5) * 1.6, speed = 16 + rnd('flysp', seed, i) * 12;
      state.birds.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.8, born: state.step + Math.floor(rnd('flyat', seed, i) * 3) });
    }
  }

  function stepWest(step) {
    for (const b of state.blooms) {
      const before = b.radius ?? -1;
      b.radius = Math.min((step - b.born) * BLOOM.speed, BLOOM.reach);
      for (const cell of westCells) {
        const d = Math.hypot(cell.x - b.x, (cell.y - b.y) * 1.2);
        if (d > b.radius || d <= before || cell.anim || cell.solid || cell.tree || state.planted.has(key(cell.c, cell.r))) continue;
        const q = rnd('bloom', cell.c, cell.r, b.born);
        const kind = d < 60 ? (q < 0.7 ? 'tree' : 'sapling') : d < 130 ? (q < 0.3 ? 'tree' : q < 0.6 ? 'sapling' : 'flower') : q < 0.55 ? 'flower' : q < 0.7 ? 'sapling' : null;
        if (!kind) continue;
        state.growth.set(key(cell.c, cell.r), {
          kind, at: step, until: step + 60 + Math.floor(rnd('wilt', cell.c, cell.r, b.born) * 40),
          ...TREES[Math.floor(q * 97) % TREES.length], petal: PETALS[Math.floor(q * 113) % PETALS.length],
        });
      }
    }
    state.blooms = state.blooms.filter((b) => step - b.born <= BLOOM.reach / BLOOM.speed + 2);
    for (const [k, g] of state.growth) if (step > g.until + 3) state.growth.delete(k);
    state.birds = state.birds.filter((b) => step - b.born <= 16);

    // Birds lift off any roost the pointer comes near, and come back later.
    const h = state.hover;
    if (h) {
      const [hx, hy] = centre(h.c, h.r);
      for (const cell of roosts) {
        if ((state.roosting.get(key(cell.c, cell.r)) ?? 0) > step || Math.hypot(cell.x - hx, cell.y - hy) > 56) continue;
        state.roosting.set(key(cell.c, cell.r), step + 70);
        launchBirds(cell.x, cell.y, 2 + Math.floor(rnd('flock', cell.c, cell.r, step) * 2), Math.atan2(cell.y - hy - 30, cell.x - hx), key(cell.c, cell.r) + step);
      }
    }

    // Deer graze, wandering a step now and then, and bolt from the pointer.
    for (const d of state.deer) {
      if (h && Math.abs(h.c - d.c) <= 3 && Math.abs(h.r - d.r) <= 2) { d.flee = 7; d.from = [h.c, h.r]; }
      let options = NEAR.map(([dc, dr]) => [d.c + dc, d.r + dr]).filter(([c, r]) => deerCanStand(c, r));
      if (d.flee > 0) {
        d.flee--;
        const far = ([c, r]) => Math.hypot((c - d.from[0]) * 16, (r - d.from[1]) * 24);
        options = options.filter((o) => far(o) > far([d.c, d.r]));
        options.sort((a, b) => far(b) - far(a));
      } else if (step >= d.rest) {
        d.rest = step + 10 + Math.floor(rnd('rest', d.c, d.r, step) * 24);
        options = [options[Math.floor(rnd('wander', d.c, d.r, step) * options.length)]].filter(Boolean);
      } else options = [];
      if (options.length) {
        if (options[0][0] !== d.c) d.flip = options[0][0] < d.c;
        [d.c, d.r] = options[0];
      }
    }
  }

  // ---------- Input ----------

  // Pointer input arrives in canvas pixels; the world is SHIFT to the right.
  function hover(x, y) {
    if (x !== null) x -= SHIFT;
    const cell = x === null ? null : cellAt(...cellOf(x, y));
    if (!cell || cell.kind === 'void') { state.hover = null; return; }
    const prev = state.hover;
    state.hover = { c: cell.c, r: cell.r, cell, region: cell.region };
    if (cell.region === 'sea' && (prev?.c !== cell.c || prev?.r !== cell.r)) {
      const last = state.ripples[state.ripples.length - 1];
      if (!last || last.born !== state.step) state.ripples.push({ x, y, born: state.step });
      if (state.ripples.length > 16) state.ripples.shift();
    }
  }

  function click(x, y) {
    x -= SHIFT;
    const cell = cellAt(...cellOf(x, y));
    const step = state.step;
    if (!cell || cell.kind === 'void') return;
    const { c, r } = cell;
    if (cell.region === 'sea') {
      // There's only ever one serpent. If it's up, it dives now and surfaces
      // here once it's fully under; if it's still rising, it just rises here.
      const turn = rnd('turn', c, r, step) < 0.5 ? 1 : -1;
      const path = loopPath(Array.from({ length: 49 }, (_, i) => [x + Math.cos((turn * i * TAU) / 48) * 72, y + Math.sin((turn * i * TAU) / 48) * 40]));
      const next = { c, r, born: step, path, dive: Math.floor(SERPENT.swim * SERPENT.speed) };
      const now = state.serpent;
      if (!now || serpentHead(now, step) < 0) state.serpent = next;
      else {
        now.dive = Math.min(now.dive, serpentHead(now, step) + 1);
        next.born = serpentGone(now);
        state.nextSerpent = next;
      }
      state.ripples.push({ x, y, born: step, strong: true });
    } else if (cell.region === 'west') {
      // The spot itself gets a tree that stays; the bloom around it fades.
      if (plantable(cell)) state.planted.set(key(c, r), { ...TREES[state.nextTree++ % TREES.length], born: step });
      if (state.blooms.length >= 3) state.blooms.shift();
      state.blooms.push({ x, y, born: step });
      launchBirds(x, y, 9, -Math.PI / 2, 'burst' + step);
    } else if (cell.region === 'east') {
      if (buildable(c, r) && state.queue.length < 4) state.queue.push({ c, r });
    } else if (cell.region === 'south') {
      if (state.strikes.length >= 4) return;
      state.strikes.push({ c, r, born: step });
      for (const other of landCells) {
        if (other.region !== 'south' || Math.hypot(other.x - cell.x, (other.y - cell.y) * 0.9) > 56) continue;
        state.scorched.set(key(other.c, other.r), { born: step, heals: step + 36 + Math.floor(rnd('heal', other.c, other.r, step) * 24) });
      }
    } else if (cell.region === 'isle') {
      if (state.pulses.length < 3) state.pulses.push({ born: step });
      const [sc, sr] = cellOf(SEED.x, SEED.y);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + rnd('burst', step) * TAU;
        state.sparks.push({ c: sc + Math.round(Math.cos(a) * 3), r: sr + Math.round(Math.sin(a) * 1.6), born: step });
      }
    }
  }

  function cursor() {
    const h = state.hover;
    if (!h) return '';
    if (h.region === 'south' || h.region === 'west') return 'none';
    if (h.region === 'isle' || (h.region === 'east' && buildable(h.c, h.r))) return 'pointer';
    return '';
  }

  // ---------- Drawing ----------

  const pulseShape = (age) => {
    const k = age / PULSE_LIFE;
    return { radius: k * PULSE_REACH, fade: 1 - smooth(clamp(k)) };
  };

  // The sea at rest: slow swells, a little shimmer. `amb` is the step for
  // ambient motion, held at 0 for reduced motion.
  function drawSea(ctx, P, step, amb) {
    const st = amb / (STEPS * 2);
    const shimmer = Math.floor(amb / 3);
    const pulses = state.pulses.map((p) => pulseShape(step - p.born));
    const ripples = state.ripples.map((rp) => ({ ...rp, age: step - rp.born }));
    for (const cell of seaCells) {
      const { c, r, x, y, edge, nz, shore, d } = cell;
      const pulse = pulses.find((p) => Math.abs(d - p.radius) < PULSE_BAND);
      if (pulse && edge > 0.15) {
        put(ctx, P, c, r, { g: 'approx', fg: 'O', alpha: pulse.fade * clamp(edge * 1.5) });
        continue;
      }
      // The pointer leaves faint, short rings. A serpent's splash is a bright
      // ring with the water parted inside it.
      let ring = 0, parted = false, strong = false;
      for (const rp of ripples) {
        const life = rp.strong ? RIPPLE_LIFE : 4;
        const radius = 10 + rp.age * (rp.strong ? 24 : 12), dist = Math.hypot(x - rp.x, y - rp.y);
        if (rp.age < life && Math.abs(dist - radius) < 12) {
          const k = 1 - rp.age / life;
          if (rp.strong) { ring = Math.max(ring, k); strong = true; } else ring = Math.max(ring, k * 0.55);
        } else if (rp.strong && dist < radius && rp.age < 4) parted = true;
      }
      if (ring > 0) {
        put(ctx, P, c, r, { g: strong && ring > 0.5 ? 'approx' : 'tilde', fg: strong && ring > 0.6 ? 'Y' : 'C', alpha: ring * clamp(edge * 2) });
        continue;
      }
      if (parted) continue;
      let v = 0.5 + 0.2 * Math.sin(TAU * ((x * 0.0042 + y * 0.0068) - st)) + 0.2 * Math.sin(TAU * ((x * -0.0031 + y * 0.0052) - 2 * st + 0.3));
      v = v * 0.55 + nz * 0.45 + (rnd('f', c, r, shimmer) - 0.5) * 0.06;
      if (shore) v += 0.1;
      if (v < lerp(1.05, 0.34, edge)) continue;
      const alpha = clamp(edge * 2);
      if (v > 0.76) put(ctx, P, c, r, { g: 'approx', fg: 'C', alpha });
      else if (v > 0.6) put(ctx, P, c, r, { g: 'tilde', fg: 'c', alpha });
      else put(ctx, P, c, r, { g: edge < 0.5 && rnd('e', c, r) < 0.5 ? 'shade1' : 'dot', fg: 'K', alpha });
    }
  }

  // Trees planted, pyramids built or burning, and blasted ground growing back.
  function drawChanges(ctx, P, step) {
    for (const [k, t] of state.planted) {
      const cell = cellAt(...k.split(',').map(Number)), age = step - t.born;
      const g = age < 1 ? 'dot' : age < 2 ? 'sprout' : t.g;
      put(ctx, P, cell.c, cell.r, { bg: cell.bg, g, fg: age < 2 ? 'G' : t.fg, dt: 'w' });
      if (age >= 2 && age < 5) for (const dc of [-1, 1]) put(ctx, P, cell.c + dc, cell.r, { g: 'dot', fg: 'W', alpha: 1 - (age - 2) / 3 });
    }
    for (const [k, g] of state.growth) {
      const cell = cellAt(...k.split(',').map(Number)), age = step - g.at;
      let tile;
      if (step >= g.until) tile = { g: 'grass', fg: 'g' };
      else if (age < 1) tile = { g: 'dot', fg: 'W' };
      else if (g.kind === 'flower') tile = { g: 'flower', fg: g.petal, dt: 'W' };
      else if (g.kind === 'sapling' || age < 2) tile = { g: 'sprout', fg: 'G' };
      else tile = { g: g.g, fg: g.fg, dt: 'w' };
      put(ctx, P, cell.c, cell.r, { bg: cell.bg, ...tile });
    }
    for (const p of state.pyramids) put(ctx, P, p.c, p.r, { bg: cellAt(p.c, p.r).bg, g: 'pyramid', fg: 'W', dt: 'r' });
    const job = state.walker.job;
    if (job?.start !== undefined) {
      const done = step - job.start;
      put(ctx, P, job.c, job.r, { bg: cellAt(job.c, job.r).bg, g: done < 3 ? 'scaffold' : done < 6 ? 'pyrhalf' : 'pyramid', fg: done < 3 ? 'w' : 'W', dt: 'r' });
      if (done % 2 === 0) put(ctx, P, job.c, job.r - 1, { g: 'star', fg: 'W', alpha: 0.9 });
    }
    for (const site of [...state.queue, ...(job && job.start === undefined ? [job] : [])]) {
      put(ctx, P, site.c, site.r, { g: 'cross', fg: 'O', alpha: step % 2 ? 0.5 : 0.85 });
    }
    for (const [k, rb] of state.rubble) {
      const cell = cellAt(...k.split(',').map(Number)), age = step - rb.born;
      if (age < 14) put(ctx, P, cell.c, cell.r, { bg: 'scorch', g: 'shade2', fg: rnd('ember', k, step) < 0.5 ? 'R' : 'o' });
      else put(ctx, P, cell.c, cell.r, { bg: cell.bg, g: 'shade1', fg: 'r', alpha: 1 - (age - 14) / (RUBBLE_LIFE - 14) });
    }
    for (const [k, s] of state.scorched) {
      const cell = cellAt(...k.split(',').map(Number)), age = step - s.born;
      if (step >= s.heals) {
        put(ctx, P, cell.c, cell.r, { bg: cell.bg, g: step - s.heals < 3 ? 'dot' : 'grass', fg: 'm' });
        continue;
      }
      const ember = rnd('scorch', k, step) < 0.5 ? 'o' : 'R';
      if (age < 3) put(ctx, P, cell.c, cell.r, { bg: 'scorch', g: 'shade2', fg: ember });
      else if (age < 16) put(ctx, P, cell.c, cell.r, { bg: 'scorch', g: rnd('emb', k) < 0.6 ? 'dot' : 'shade1', fg: ember });
      else put(ctx, P, cell.c, cell.r, { bg: 'scorch', g: 'shade1', fg: 'ash' });
    }
  }

  function drawPulseOnLand(ctx, P, step) {
    for (const pulse of state.pulses.map((p) => pulseShape(step - p.born))) {
      for (const cell of landCells) {
        if (cell.anim !== 'seed' && Math.abs(cell.d - pulse.radius) < PULSE_BAND) put(ctx, P, cell.c, cell.r, { bg: 'O', alpha: P.pulse * pulse.fade });
      }
    }
  }

  function drawAnimated(ctx, P, step, amb) {
    const erupting = state.eruptions.some((e) => step - e.born < RUMBLE + 2);
    const fresh = state.pulses.length ? clamp(1 - (step - state.pulses[state.pulses.length - 1].born) / 12) : 0;
    for (const cell of animCells) {
      const { c, r, anim, bg } = cell;
      if (state.scorched.has(key(c, r))) continue;
      if (anim === 'water') {
        const k = (c * 3 + r * 5 + Math.floor(amb / 3)) % 6;
        put(ctx, P, c, r, { bg, g: k < 3 ? 'approx' : 'tilde', fg: k % 3 === 0 ? 'B' : 'b' });
      } else if (anim === 'volcano') {
        const dt = erupting ? (step % 2 ? 'W' : 'O') : ['R', 'o', 'R', 'O'][Math.floor(amb / 3) % 4];
        put(ctx, P, c, r, { bg, g: 'volcano', fg: 'r', dt });
      } else if (anim === 'tower') {
        put(ctx, P, c, r, { bg, g: 'tower', fg: 'y', dt: rnd('win', c, Math.floor(amb / 9)) < 0.8 ? 'O' : 'w' });
      } else if (anim === 'seed') {
        const lure = state.hover?.region === 'isle' ? 0.35 : 0;
        const glow = clamp(0.35 + 0.3 * wave(amb / (STEPS * 2), 1) + lure + fresh);
        for (let dr = -1; dr <= 1; dr++) for (let dc = -2; dc <= 2; dc++) {
          if (dr || dc) put(ctx, P, c + dc, r + dr, { bg: 'O', alpha: (P.pulse * (0.3 + 0.7 * glow)) / (Math.abs(dc) + Math.abs(dr)) });
        }
        put(ctx, P, c, r, { bg: 'O', alpha: 0.2 + 0.45 * glow });
        put(ctx, P, c, r, { g: 'seed', fg: 'G', dt: glow > 0.6 ? 'W' : 'O' });
      }
    }
  }

  function drawSmoke(ctx, P, amb) {
    const [vc, vr] = cellOf(...VOLCANO);
    for (let i = 0; i < 2; i++) {
      const k = cycle(amb / STEPS, 1, i / 2);
      put(ctx, P, vc + Math.round(k * 2), vr - 1 - Math.floor(k * 4), { g: k < 0.35 ? 'shade2' : 'shade1', fg: 'y', alpha: 0.6 * (1 - k) });
    }
  }

  function drawSparks(ctx, P, step, amb) {
    // Now and then a mote drifts up from the Seed; a click sends a burst.
    const [sc, sr] = cellOf(SEED.x, SEED.y);
    const age = amb % 18, gen = Math.floor(amb / 18);
    if (age < 6) {
      const a = rnd('spa', gen) * TAU;
      put(ctx, P, sc + Math.round(Math.cos(a) * 2.5), sr + Math.round(Math.sin(a) * 1.2), { g: age < 2 ? 'star' : 'dot', fg: age < 3 ? 'W' : 'O', alpha: 1 - age / 6 });
    }
    for (const s of state.sparks) {
      const k = step - s.born;
      put(ctx, P, s.c, s.r - (k > 2 ? 1 : 0), { g: k < 3 ? 'star' : 'dot', fg: k < 2 ? 'W' : 'O', alpha: 1 - k / 6 });
    }
  }

  function drawBoats(ctx, P, amb) {
    for (const { path, phase } of LANES) {
      if (path.length < 2) continue;
      const k = cycle(amb / (STEPS * 3), 1, phase);
      const there = k < 0.5;
      const i = Math.round((there ? k * 2 : 2 - k * 2) * (path.length - 1));
      const [c, r] = path[i];
      const [nc] = path[clamp(i + (there ? 1 : -1), 0, path.length - 1)];
      const wake = path[clamp(i + (there ? -1 : 1), 0, path.length - 1)];
      if (wake[0] !== c || wake[1] !== r) put(ctx, P, wake[0], wake[1], { g: 'dot', fg: 'C', alpha: 0.6 });
      put(ctx, P, c, r, { g: 'boat', fg: 'Y', dt: 'w', flip: nc < c });
    }
  }

  // Bubbles where it rises, then a head and humps circling, then each part
  // goes under where the head did.
  function drawSerpent(ctx, P, step) {
    const s = state.serpent;
    if (s) {
      const age = step - s.born, n = s.path.length, dive = s.dive;
      if (age < SERPENT.rise) {
        put(ctx, P, s.c, s.r, { g: age % 2 ? 'ring' : 'dot', fg: 'Y' });
        for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (rnd('bub', s.born, age, dc, dr) < 0.5) put(ctx, P, s.c + dc, s.r + dr, { g: 'dot', fg: 'C' });
        return;
      }
      const head = serpentHead(s, step);
      const tail = head - SERPENT.humps * 2;
      for (let i = tail - 3; i < tail; i++) {
        if (i < 0 || i >= dive) continue;
        const [c, r] = s.path[i % n];
        if (isSea(c, r)) put(ctx, P, c, r, { g: 'tilde', fg: 'C', alpha: 0.35 + 0.15 * (i - tail + 3) });
      }
      for (let part = SERPENT.humps; part >= 0; part--) {
        const i = head - part * 2;
        if (i < 0 || i >= dive) continue;
        const [c, r] = s.path[i % n];
        if (!isSea(c, r)) continue;
        if (part) put(ctx, P, c, r, { g: 'hump', fg: 'G' });
        else put(ctx, P, c, r, { g: 'head', fg: 'G', flip: s.path[(i + 1) % n][0] < c });
      }
    }
  }

  // The edge of each bloom as it spreads: a ring of sparkle over the meadow.
  function drawBloomFronts(ctx, P, step) {
    for (const b of state.blooms) {
      if (step - b.born > BLOOM.reach / BLOOM.speed) continue;
      const radius = Math.min((step - b.born) * BLOOM.speed, BLOOM.reach);
      for (const cell of westCells) {
        const d = Math.hypot(cell.x - b.x, (cell.y - b.y) * 1.2);
        if (Math.abs(d - radius) < 13) put(ctx, P, cell.c, cell.r, { g: rnd('spark', cell.c, cell.r, step) < 0.5 ? 'star' : 'dot', fg: rnd('sparkc', cell.c, step) < 0.5 ? 'W' : 'G', alpha: 1 - radius / (BLOOM.reach * 1.3) });
      }
    }
  }

  function drawDeer(ctx, P, step) {
    for (const d of state.deer) {
      const grazing = rnd('graze', d.c, d.r, Math.floor(step / 6)) < 0.5;
      const g = d.flee > 0 ? (step % 2 ? 'deerRun' : 'deer') : grazing ? 'deerGraze' : 'deer';
      put(ctx, P, d.c, d.r, { bg: cellAt(d.c, d.r).bg, g, fg: 'w', flip: d.flip });
    }
  }

  function drawBirds(ctx, P, step) {
    for (const b of state.birds) {
      const age = step - b.born;
      if (age < 0) continue;
      const [c, r] = cellOf(b.x + b.vx * age, b.y + b.vy * age);
      put(ctx, P, c, r, { g: (age + Math.floor(b.vx)) % 2 ? 'birdUp' : 'birdDown', fg: 'Y', alpha: clamp((16 - age) / 5) });
    }
  }

  function drawWalker(ctx, P, step) {
    const w = state.walker;
    const hammering = w.job?.start !== undefined && step % 2 === 0;
    put(ctx, P, w.c, w.r, { bg: cellAt(w.c, w.r).bg, g: hammering ? 'hammer' : 'walker', fg: 'Y', dt: 'o', flip: w.flip });
  }

  // Lava spits from the crater, then a bomb arcs onto its pyramid.
  function drawEruptions(ctx, P, step) {
    const [vc, vr] = cellOf(...VOLCANO);
    for (const e of state.eruptions) {
      const age = step - e.born;
      if (age < RUMBLE + 2) {
        // A fountain of lava over the crater, then the bomb leaves it.
        const height = Math.min(age + 1, 3);
        put(ctx, P, vc, vr, { bg: 'O', alpha: 0.35 });
        for (let up = 1; up <= height; up++) put(ctx, P, vc, vr - up, { g: up === height ? 'flame' : 'shade2', fg: 'R', dt: 'W' });
        for (let i = 0; i < 4; i++) {
          const dc = Math.round((rnd('spit', e.born, age, i) - 0.5) * 5), up = 1 + Math.floor(rnd('spitup', e.born, age, i) * 3);
          put(ctx, P, vc + dc, vr - up, { g: i % 2 ? 'dot' : 'star', fg: i ? 'o' : 'W' });
        }
      }
      if (age < RUMBLE || e.landed) continue;
      const [x0, y0] = centre(vc, vr - 2), [x1, y1] = centre(e.target.c, e.target.r);
      const lift = 24 + Math.hypot(x1 - x0, y1 - y0) * 0.22;
      const at = (u) => cellOf(lerp(x0, x1, u), Math.max(34, lerp(y0, y1, u) - lift * 4 * u * (1 - u)));
      for (let k = 2; k >= 1; k--) {
        const u = (age - RUMBLE - k) / e.flight;
        if (u >= 0) put(ctx, P, ...at(u), { g: 'dot', fg: 'R', alpha: 1 - k * 0.35 });
      }
      put(ctx, P, ...at(clamp((age - RUMBLE) / e.flight)), { g: 'bomb', fg: 'R', dt: 'W' });
    }
    for (const b of state.blasts) {
      // A splash of lava: the pyramid's cell, then flames thrown outward.
      const age = step - b.born, reach = Math.min(age + 1, 2);
      put(ctx, P, b.c, b.r, { g: age < 2 ? 'star' : 'flame', fg: 'R', dt: 'W' });
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0]]) {
        if (Math.abs(dc) > reach || age === 0) continue;
        put(ctx, P, b.c + dc, b.r + dr, { g: Math.abs(dc) === 2 ? 'dot' : 'flame', fg: rnd('blast', b.born, age, dc, dr) < 0.5 ? 'R' : 'o', dt: 'W', alpha: 1 - age / 5 });
      }
    }
  }

  // What the pointer is about to do: a sapling to plant, a pyramid's ghost, a
  // gathering storm over a target.
  function drawHover(ctx, P, step) {
    const h = state.hover;
    if (!h) return;
    const blink = step % 2 === 0;
    if (h.region === 'west') {
      // A seed of the bloom, twinkling where it'll land.
      put(ctx, P, h.c, h.r, { g: blink ? 'star' : 'sprout', fg: blink ? 'W' : 'G', alpha: 0.9 });
    } else if (h.region === 'east' && buildable(h.c, h.r)) {
      put(ctx, P, h.c, h.r, { g: 'pyramid', fg: 'W', dt: 'r', alpha: 0.35 });
    } else if (h.region === 'south') {
      const top = Math.max(1, h.r - 9);
      for (const [c, r] of cloudCells(h.c, top)) put(ctx, P, c, r, { g: 'cloud', fg: 'y', alpha: 0.55 });
      for (let r = top + 1; r < h.r - 1; r++) put(ctx, P, h.c, r, { g: 'vdash', fg: 'y', alpha: (r + step) % 2 ? 0.25 : 0.5 });
      // Brackets that keep closing in on the target, as if locking on.
      const k = [3, 2, 1, 1][step % 4], fg = k === 1 ? 'R' : 'o';
      put(ctx, P, h.c - k, h.r - k, { g: 'brTL', fg });
      put(ctx, P, h.c + k, h.r - k, { g: 'brTR', fg });
      put(ctx, P, h.c - k, h.r + k, { g: 'brBL', fg });
      put(ctx, P, h.c + k, h.r + k, { g: 'brBR', fg });
      put(ctx, P, h.c, h.r, { bg: 'R', alpha: blink ? 0.12 : 0.22 });
      put(ctx, P, h.c, h.r, { g: 'cross', fg: 'R' });
    }
  }

  const cloudCells = (c, r) => [[c - 3, r], [c - 2, r], [c - 1, r], [c, r], [c + 1, r], [c + 2, r], [c + 3, r], [c - 2, r - 1], [c - 1, r - 1], [c, r - 1], [c + 1, r - 1], [c + 2, r - 1]];

  // A jagged bolt from the cloud to the target, with a fork, new each step.
  function boltCells(s, age, top) {
    const links = new Map();
    const link = (a, b) => {
      for (const [p, q] of [[a, b], [b, a]]) {
        if (!links.has(key(...p))) links.set(key(...p), { c: p[0], r: p[1], dirs: new Set() });
        links.get(key(...p)).dirs.add(dirTo(q[0] - p[0], q[1] - p[1]));
      }
    };
    // Each row it lurches sideways up to two cells, in a hard horizontal jog.
    let prev = [s.c, top];
    const trunk = [prev];
    for (let r = top + 1; r <= s.r; r++) {
      const left = s.r - r;
      const c = clamp(prev[0] + Math.round((rnd('bolt', s.born, age, r) - 0.5) * 4.4), s.c - Math.min(3, left), s.c + Math.min(3, left));
      while (Math.abs(c - prev[0]) > 1) {
        const jog = [prev[0] + Math.sign(c - prev[0]), prev[1]];
        link(prev, jog);
        prev = jog;
      }
      const cell = [c, r];
      link(prev, cell);
      trunk.push(cell);
      prev = cell;
    }
    const from = trunk[1 + Math.floor(rnd('fork', s.born, age) * Math.max(1, trunk.length - 4))];
    const side = rnd('side', s.born, age) < 0.5 ? -1 : 1;
    let f = from;
    for (let k = 1; k <= 3; k++) {
      const next = [from[0] + side * k, from[1] + k];
      if (next[1] >= s.r) break;
      link(f, next);
      f = next;
    }
    return [...links.values()];
  }

  function drawStrikes(ctx, P, step, calm) {
    for (const s of state.strikes) {
      const age = step - s.born, top = Math.max(1, s.r - 9);
      if (age === 0 && !calm) {
        ctx.fillStyle = P.flash;
        ctx.fillRect(-SHIFT, 0, W, H);
      }
      if (age <= 4) for (const [c, r] of cloudCells(s.c, top)) put(ctx, P, c, r, { g: 'cloud', fg: age === 0 ? 'bolt' : 'y', alpha: 1 - age / 5 });
      if (age <= 2) {
        const bolt = boltCells(s, age, top);
        // A bright core in a coloured halo.
        for (const b of bolt) put(ctx, P, b.c, b.r, { bg: 'glow', alpha: age === 2 ? 0.12 : 0.28 });
        for (const b of bolt) put(ctx, P, b.c, b.r, { g: connector(b.dirs, 6), fg: 'glow', alpha: age === 2 ? 0.5 : 1 });
        for (const b of bolt) put(ctx, P, b.c, b.r, { g: connector(b.dirs, 2), fg: 'bolt', alpha: age === 2 ? 0.5 : 1 });
      }
      if (age <= 1) {
        put(ctx, P, s.c, s.r, { bg: 'glow', alpha: 0.6 });
        for (const [dc, dr] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) put(ctx, P, s.c + dc, s.r + dr, { g: 'star', fg: dc || dr ? 'glow' : 'bolt' });
      }
      if (age >= 1) {
        for (let i = 0; i < 10; i++) {
          const a = rnd('debris', s.born, i) * TAU, dist = (age - 0.5) * (1 + rnd('speed', s.born, i));
          put(ctx, P, s.c + Math.round(Math.cos(a) * dist * 1.4), s.r + Math.round(Math.sin(a) * dist * 0.9), {
            g: age < 3 ? 'star' : 'dot', fg: rnd('chip', s.born, i) < 0.5 ? 'M' : 'W', alpha: 1 - (age - 1) / 5,
          });
        }
      }
    }
  }

  // Everything that doesn't change, once per theme.
  const layers = new Map();
  function landLayer(theme) {
    if (!layers.has(theme)) {
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.translate(SHIFT, 0);
      const P = PALETTES[theme];
      for (const cell of landCells) if (!cell.anim) put(ctx, P, cell.c, cell.r, cell);
      layers.set(theme, canvas);
    }
    return layers.get(theme);
  }

  function render(ctx, step, theme, { calm = false } = {}) {
    const P = PALETTES[theme];
    const amb = calm ? 0 : step;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(SHIFT, 0);
    if (!calm && state.strikes.some((s) => step - s.born <= 1)) ctx.translate(Math.round((rnd('shake', step) - 0.5) * 8), Math.round((rnd('shakey', step) - 0.5) * 6));
    drawSea(ctx, P, step, amb);
    ctx.drawImage(landLayer(theme), -SHIFT, 0);
    drawChanges(ctx, P, step);
    drawPulseOnLand(ctx, P, step);
    drawAnimated(ctx, P, step, amb);
    drawSmoke(ctx, P, amb);
    drawSparks(ctx, P, step, amb);
    drawBoats(ctx, P, amb);
    drawSerpent(ctx, P, step);
    drawWalker(ctx, P, step);
    drawDeer(ctx, P, step);
    drawEruptions(ctx, P, step);
    drawBloomFronts(ctx, P, step);
    drawBirds(ctx, P, step);
    drawHover(ctx, P, step);
    drawStrikes(ctx, P, step, calm);
    ctx.restore();
  }

  SceneKit.register({
    name: 'glyph-map', width: W, height: H, fps: FPS, frames: FRAMES, tick: TICK, poster: 40,
    backgrounds: { light: PALETTES.light.paper, dark: PALETTES.dark.paper },
    draw: (ctx, frame, theme) => render(ctx, Math.floor(frame / TICK), theme),
    render, update, hover, click, cursor,
    state,  // for poking at from the console
  });
})();
