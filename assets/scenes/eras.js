// The Four Eras, on the rules page: one valley on Greenwood's coast (the
// rules map's world, with the World Seed's isle offshore), and each Era is a
// single day over it. The sun crosses the sky, dusk slides into a short
// night, and a flash of light brings the next Era with the dawn.
//
// By day the sky, the land and the sea each answer the pointer, differently
// in every Era. Hovering hints; a click follows through:
//
//              sky                         land                         sea
//   Myth ♥     godlight gathers → a beam   flowers bloom → a sacred      spirit lights → a
//              raises a standing stone     tree bursts up               leviathan surfaces
//   Antiq. ♦   a bird circles → it flies   a builder's outline → a      the ship turns toward
//              to the castle; banners fly  tower is raised              you → it docks, and a
//                                                                       caravan carries goods up
//   Ruin ♣     crows and storm → a dragon  two soldiers face off → one  the sea swells → a great
//              swoops through the spot,    marches in, they fight, the  wave sweeps the shore,
//              fires where it passes       winner walks away            leaving wreck and bones
//   Promise ♠  a wishing star → it falls,  a glint → adventurers dig    gulls gather → a ship
//              an adventurer fetches it    up a relic of the past       sets sail and leaves
//
// What's made on the land lasts and ages through the Eras that follow (a
// sacred tree becomes a temple, then a ruin, then a shrine) until the world
// starts over at Myth. Nothing answers at night. Decorative only.

(function () {
  const { TAU, wave, clamp, smooth, lerp } = SceneKit;
  const { rnd, noise, QUD } = GlyphKit;

  const W = 1152, H = 432, FPS = 24, FRAMES = FPS * 12, TICK = 4;
  const COLS = 72, ROWS = 18;
  const HORIZON = 8, LAND = 9, SEA = 15;   // rows: sky down to the mountains at 8, land 9–14, sea 15–17
  const { put } = GlyphKit.grid({ cols: COLS, rows: ROWS, ox: 0, oy: 0 });
  const key = (...k) => k.join(',');

  const PALETTES = {
    dark: {
      ...QUD.dark,
      myth: '#e07a90', anti: '#e0b155', ruin: '#a7b56f', prom: '#86a6e0',
      day: ['#33202a', '#33290f', '#262a1d', '#1c2840'], dusk: '#4a2618', night: '#090c18', shade: '#05070f', shadeMax: 0.5,
      grove: '#11251a', field: '#1f2513', ash: '#1c1b16', sea: '#0f2a33', iBg: '#2b2711',
      stone: '#9aa3b5', marble: '#e6e2f2', sun: '#ffd76a', sunset: '#ff8a3d', star: '#f2efe6',
    },
    light: {
      ...QUD.light,
      myth: '#b4415a', anti: '#a8741a', ruin: '#5f6b3a', prom: '#3d5f9a',
      day: ['#f6e0e4', '#f5e8c9', '#e6e8d8', '#dee7f5'], dusk: '#f2c49a', night: '#2a3150', shade: '#1a2035', shadeMax: 0.55,
      grove: '#e2ead2', field: '#ece9cf', ash: '#dedbd0', sea: '#d4e6ea', iBg: '#f0e6be',
      stone: '#5a6274', marble: '#5f5a78', sun: '#f4b82a', sunset: '#e8662a', star: '#fdf6dc',
    },
  };
  const ERAS = ['myth', 'anti', 'ruin', 'prom'];
  const GROUND = ['grove', 'field', 'ash', 'grove'];

  // ---------- A day ----------
  // Dawn, a long day, dusk sliding into a short night, then a flash and the
  // next Era. About fifteen seconds an Era.
  const DAWN = 6, DAY = 66, DUSK = 8, NIGHT = 8, ERA = DAWN + DAY + DUSK + NIGHT, CYCLE = ERA * 4, SUNLIT = DAWN + DAY + DUSK;

  function clock(t) {
    const e = Math.floor(t / ERA) % 4, p = t % ERA;
    let light, warm;
    if (p < DAWN) { light = 0.35 + 0.65 * (p / DAWN); warm = 1 - p / DAWN; }
    else if (p < DAWN + DAY) { light = 1; warm = clamp((p - (DAWN + DAY - 10)) / 10) * 0.4; }
    else if (p < SUNLIT) { const k = (p - DAWN - DAY) / DUSK; light = 1 - smooth(k); warm = 0.4 + 0.6 * k; }
    else { light = 0; warm = 0.5; }
    const flash = p >= ERA - 2 ? (p - (ERA - 3)) / 3 : p < 2 ? (2 - p) / 3 : 0;
    return { e, p, light, warm, flash, sun: p < SUNLIT ? p / SUNLIT : -1, day: light > 0.55 };
  }

  // ---------- The valley ----------

  const grove = noise('grove', 3.5);
  const riverCol = (r) => 37 + Math.round(Math.sin(r * 0.9));
  const set = (cells) => new Set(cells.map((p) => key(...p)));
  const SPRING = set([[35, 11], [36, 11], [37, 11], [34, 12], [35, 12], [36, 12], [37, 12], [38, 12]]);
  const STONES = set([[32, 11], [40, 11], [33, 13], [39, 13]]);
  const HUTS = set([[8, 11], [14, 12], [20, 10], [24, 13], [45, 11], [50, 12], [56, 10], [62, 13], [66, 11]]);
  const TOWN = [[31, 11], [41, 11], [30, 12], [42, 12], [31, 13], [41, 13], [44, 12], [28, 11]];
  const TOWNSET = set(TOWN);
  const CASTLE = [36, 10], PIER = [34, 15];
  const road = (c, r) => c === 34 && r >= 12;

  const SITE = [
    // Myth: a spring ringed by standing stones in a wild wood.
    (c, r, q, n, bg) => {
      if (SPRING.has(key(c, r))) return { bg, g: 'approx', fg: 'C' };
      if (STONES.has(key(c, r))) return { bg, g: 'column', fg: 'stone' };
      if (c >= 29 && c <= 43 && r <= 13) return { bg, g: q < 0.4 ? 'grass' : q < 0.5 ? 'flower' : null, fg: q < 0.4 ? 'G' : 'M', dt: 'W', open: true };
      if (n > 0.35) return { bg, g: q < 0.5 ? 'fir' : 'club', fg: q < 0.4 ? 'C' : 'G', dt: 'w' };
      return { bg, g: q < 0.3 ? 'grass' : q < 0.36 ? 'flower' : null, fg: q < 0.3 ? 'g' : 'M', dt: 'W', open: true };
    },
    // Antiquity: a white castle walled round, a temple at the spring, fields.
    (c, r, q, n, bg) => {
      if (c === 36 && r === 10) return { bg, g: 'castle', fg: 'marble', dt: 'b' };
      if ((c === 33 || c === 39) && r === 10) return { bg, g: 'tower', fg: 'marble', dt: 'O', lit: true };
      if (r === 11 && c >= 32 && c <= 40) return c === 36 ? { bg, g: 'dot', fg: 'W' } : { bg, g: 'brick', fg: 'marble' };
      if (r === 12 && (c === 35 || c === 37)) return { bg, g: 'column', fg: 'marble' };
      if (r === 12 && c === 36) return { bg, g: 'approx', fg: 'C' };
      if (road(c, r)) return { bg, g: 'dot', fg: 'W' };
      if (HUTS.has(key(c, r))) return { bg, g: 'hut', fg: 'R', dt: 'w', lit: true };
      if (c < 28) return { bg, g: q < 0.6 ? 'grass' : null, fg: 'W', open: true };
      if (n > 0.55) return { bg, g: 'club', fg: 'G', dt: 'w' };
      return { bg, g: q < 0.25 ? 'grass' : null, fg: 'g', open: true };
    },
    // Ruin: the same stones, broken and burnt.
    (c, r, q, n, bg) => {
      if (c === 36 && r === 10) return { bg, g: 'wallb', fg: 'stone' };
      if ((c === 33 || c === 39) && r === 10) return { bg, g: 'colbroke', fg: 'stone' };
      if (r === 11 && c >= 32 && c <= 40) return { bg, g: q < 0.5 ? 'wallb' : 'shade1', fg: 'stone' };
      if (r === 12 && (c === 35 || c === 37)) return { bg, g: 'colbroke', fg: 'stone' };
      if (r === 12 && c === 36) return { bg, g: 'shade1', fg: 'y' };
      if (road(c, r)) return { bg, g: 'dot', fg: 'y' };
      if (HUTS.has(key(c, r))) return { bg, g: 'shade2', fg: 'r' };
      if (n > 0.5) return { bg, g: 'bare', fg: 'w' };
      return { bg, g: q < 0.25 ? 'shade1' : null, fg: 'y', open: true };
    },
    // Promise: the tower rebuilt, a town round it, the old walls grown over.
    (c, r, q, n, bg) => {
      if (c === 36 && r === 10) return { bg, g: 'tower', fg: 'marble', dt: 'O', lit: true };
      if (c === 36 && r === 9) return { bg, g: 'flag', fg: 'w', dt: 'prom' };
      if ((c === 33 || c === 39) && r === 10) return { bg, g: 'wallb', fg: 'g' };
      if (TOWNSET.has(key(c, r)) || (HUTS.has(key(c, r)) && q < 0.6)) return { bg, g: 'hut', fg: q < 0.5 ? 'R' : 'w', dt: 'w', lit: true };
      if (c === 43 && r === 11) return { bg, g: 'scaffold', fg: 'w' };
      if (road(c, r) || (r === 13 && c >= 42)) return { bg, g: 'dot', fg: 'w' };
      if (c < 26) return { bg, g: q < 0.55 ? 'grass' : null, fg: 'G', open: true };
      if (n > 0.5) return { bg, g: q < 0.7 ? 'club' : 'sprout', fg: 'G', dt: 'w' };
      return { bg, g: q < 0.25 ? 'grass' : q < 0.3 ? 'flower' : null, fg: 'g', dt: 'W', open: true };
    },
  ];

  const tiles = new Map();
  function tileAt(era, c, r) {
    const k = key(era, c, r);
    if (!tiles.has(k)) {
      const q = rnd('v', c, r), n = grove(c, r * 1.5);
      let tile = null;
      if (r === HORIZON) tile = { g: n > 0.5 ? 'mountain' : n > 0.32 ? 'hill' : null, fg: 'stone', dt: era === 2 ? 'y' : 'Y' };
      else if (r >= SEA) {
        if (r === 16 && c >= 52 && c <= 54) tile = c === 53 ? { bg: 'iBg', g: 'seed', fg: 'G', dt: era === 2 ? 'w' : 'O', lit: true } : { bg: 'iBg', g: 'grass', fg: 'G' };
        else if (era === 1 && c === PIER[0] && r === PIER[1]) tile = { bg: 'sea', g: 'brick', fg: 'w' };
        else tile = { bg: 'sea', g: q < 0.3 ? 'tilde' : null, fg: era === 2 ? 'y' : 'c' };
      } else if (r >= LAND && r >= 13 && c === riverCol(r)) tile = { bg: GROUND[era], g: era === 2 ? 'tilde' : 'approx', fg: era === 2 ? 'y' : 'B' };
      else if (r >= LAND) tile = SITE[era](c, r, q, n, GROUND[era]);
      tiles.set(k, tile);
    }
    return tiles.get(k);
  }

  // What's made on the land, and what each becomes in the Eras after.
  const RELICS = [{ g: 'column', fg: 'marble' }, { g: 'crystal', fg: 'W', dt: 'anti' }, { g: 'dskull', fg: 'Y' }, { g: 'castle', fg: 'stone', dt: 'O' }];
  const LINEAGE = {
    tree: [{ g: 'club', fg: 'W', dt: 'w', glow: true }, { g: 'pyramid', fg: 'marble', dt: 'W' }, { g: 'ruin', fg: 'stone' }, { g: 'pyramid', fg: 'W', dt: 'G' }],
    stone: [{ g: 'column', fg: 'stone' }, { g: 'column', fg: 'marble' }, { g: 'colbroke', fg: 'stone' }, { g: 'colbroke', fg: 'g' }],
    tower: [null, { g: 'tower', fg: 'marble', dt: 'O' }, { g: 'colbroke', fg: 'stone' }, { g: 'tower', fg: 'w', dt: 'O' }],
    fallen: [null, null, { g: 'fallen', fg: 'y', dt: 'y' }, { g: 'flower', fg: 'M', dt: 'W' }],
  };

  const SKYSTARS = [];
  for (let r = 0; r < HORIZON; r++) for (let c = 0; c < COLS; c++) if (rnd('sky', c, r) < 0.07) SKYSTARS.push([c, r, Math.floor(rnd('tw', c, r) * 12)]);

  const pingpong = (amb, span, every = 2) => {
    const k = Math.floor(amb / every) % (span * 2);
    return k < span ? { i: k, back: false } : { i: span * 2 - k, back: true };
  };
  const NEAR4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // ---------- State ----------

  const fresh = () => ({
    step: 0, t: DAWN + 4, era: 0,
    hover: null,      // { c, r, region }
    fx: [],           // passing effects: { kind, born, ... }; they end with the day
    fires: [],        // fires the dragon left: { c, r, born }
    changes: [],      // things made on the land: { kind, c, r, from, at, tile? }
    floods: [],       // shores the wave swept: { c0, c1, top, from, born }
    ship: { c: 12, aim: 26 },
  });
  const state = fresh();

  const regionOf = (r) => (r <= HORIZON ? 'sky' : r < SEA ? 'land' : 'sea');
  const spawn = (kind, props) => {
    state.fx.push({ kind, born: state.step, ...props });
    if (state.fx.length > 48) state.fx.shift();
  };
  function make(kind, c, r, delay, extra = {}) {
    state.changes = state.changes.filter((ch) => ch.c !== c || ch.r !== r);
    state.changes.push({ kind, c, r, from: state.era, at: state.step + delay, ...extra });
    if (state.changes.length > 24) state.changes.shift();
  }

  const LIFE = { beam: 8, grow: 6, leviathan: 22, swoop: 7, banners: 36, build: 7, dock: 120, dragon: 17, wave: 18, dig: 9, star: 60, depart: 40 };

  function dragonAt(f, step) {
    const u = clamp((step - f.born) / 16), start = f.c - f.dir * 16;
    return { x: Math.round(start + f.dir * 32 * u), y: Math.round(1 + (f.r - 1) * (1 - (2 * u - 1) ** 2)) };
  }

  function update(step) {
    state.step = step;
    state.t = (state.t + 1) % CYCLE;
    const k = clock(state.t);
    if (k.e !== state.era) {
      // A new Era: passing things end with the night. A new Myth is a new world.
      state.fx = [];
      state.fires = [];
      if (k.e === 0) { state.changes = []; state.floods = []; }
      state.era = k.e;
    }
    // The merchant ship of Antiquity docks when sent, turns toward the pointer
    // over the sea, and otherwise sails the bay.
    if (k.e === 1 && step % 2 === 0) {
      const s = state.ship, docks = state.fx.filter((f) => f.kind === 'dock');
      const waiting = docks.filter((f) => f.docked === undefined);
      const steering = !waiting.length && state.hover?.region === 'sea' && k.day;
      const target = waiting.length ? PIER[0] : steering ? state.hover.c : s.aim;
      if (s.c !== target) s.c += Math.sign(target - s.c);
      else if (!waiting.length && !steering) s.aim = s.aim === 26 ? 8 : 26;
      if (s.c === PIER[0]) {
        // Each load goes up in its own caravan, a few steps apart.
        const busy = docks.length - waiting.length;
        waiting.forEach((d, i) => { d.docked = step + (busy + i) * 4; });
      }
    }
    // Each dragon sets the land beneath it alight as it passes the spot.
    for (const f of state.fx) {
      if (f.kind !== 'dragon') continue;
      const { x } = dragonAt(f, step), fx = x + f.dir;
      if (Math.abs(x - f.c) > 5) continue;
      for (let r = 10; r <= 13; r++) {
        if (r > 11 && rnd('fire', fx, r, f.born) > 0.6) continue;
        if (!state.fires.some((fire) => fire.c === fx && fire.r === r)) state.fires.push({ c: fx, r, born: step });
      }
    }
    if (state.fires.length > 120) state.fires.splice(0, state.fires.length - 120);
    // Effects that lead on to others, or end early.
    for (const f of [...state.fx]) {
      const age = step - f.born;
      if (f.kind === 'swoop' && age === 6) {
        const banners = state.fx.find((b) => b.kind === 'banners');
        if (banners) banners.born = step; else spawn('banners', {});
      }
      if (f.kind === 'wave' && age >= 4 && !state.floods.some((fl) => fl.born === f.born)) state.floods.push({ c0: f.c0, c1: f.c1, top: LAND, from: 2, born: f.born });
      if (f.kind === 'dock' && f.docked !== undefined && step - f.docked >= 16) f.life = 0;
      if (f.kind === 'star' && age >= 6 + 2 * (Math.abs(f.lx - 36) + 1) + 4) f.life = 0;
    }
    state.fx = state.fx.filter((f) => step - f.born <= (f.life ?? LIFE[f.kind]));
  }

  // ---------- Input ----------

  function hover(x, y) {
    if (x === null) { state.hover = null; return; }
    const c = clamp(Math.floor(x / 16), 0, COLS - 1), r = clamp(Math.floor(y / 24), 0, ROWS - 1);
    state.hover = { c, r, region: regionOf(r) };
  }

  function click(x, y) {
    const k = clock(state.t);
    if (!k.day) return;   // nothing answers at night
    const c = clamp(Math.floor(x / 16), 0, COLS - 1), r = clamp(Math.floor(y / 24), 0, ROWS - 1), where = regionOf(r), e = k.e;
    const dir = c < COLS / 2 ? 1 : -1;
    if (e === 0) {
      if (where === 'sky') { spawn('beam', { c, r }); make('stone', c, 12, 4); }
      if (where === 'land') { spawn('grow', { c, r }); make('tree', c, r, 3); }
      if (where === 'sea') spawn('leviathan', { c, dir });
    } else if (e === 1) {
      // A little flock takes off each time.
      if (where === 'sky') for (let i = 0; i < 3; i++) spawn('swoop', { c: c + i * 2 - 2, r: clamp(r + (i % 2), 0, HORIZON), born: state.step + i });
      if (where === 'land') { spawn('build', { c, r }); make('tower', c, r, 6); }
      if (where === 'sea') spawn('dock', {});
    } else if (e === 2) {
      if (where === 'sky') spawn('dragon', { c, r: Math.max(2, r), dir });
      if (where === 'land') {
        // A soldier here; a challenger comes over the horizon behind and down to fight.
        const bx = clamp(c + dir * (2 + Math.floor(rnd('bx', c, r, state.step) * 4)), 1, COLS - 2);
        const march = Math.max(Math.abs(c + dir - bx), r - HORIZON);
        const winA = rnd('win', c, r, state.step) < 0.5;
        spawn('battle', { c, r, side: dir, bx, march, winA, life: march + 8 + 14 });
        make('fallen', winA ? c + dir : c, r, march + 8);
      }
      if (where === 'sea') spawn('wave', { c0: clamp(c - 5, 0, COLS - 1), c1: clamp(c + 5, 0, COLS - 1) });
    } else {
      if (where === 'sky') spawn('star', { c, r, lx: clamp(c + dir * 6, 2, COLS - 3) });
      if (where === 'land') { spawn('dig', { c, r }); make('relic', c, r, 6, { tile: RELICS[Math.floor(rnd('relic', c, r, state.step) * RELICS.length)] }); }
      if (where === 'sea') spawn('depart', { c, dir: -dir });
    }
  }
  const cursor = () => (state.hover && clock(state.t).day ? 'pointer' : '');

  // ---------- Effects ----------

  function drawFx(step, at) {
    for (const f of state.fx) {
      const age = step - f.born;
      switch (f.kind) {
        case 'beam': {   // godlight gathers, then falls as a beam onto the land
          if (age < 3) for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + age;
            at(f.c + Math.round(Math.cos(a) * (3 - age)), f.r + Math.round(Math.sin(a) * (1.5 - age / 2)), { g: 'star', fg: 'W' });
          } else for (let r = f.r; r <= 12; r++) at(f.c, r, { g: 'vdash', fg: 'W', alpha: 1 - (age - 3) / 5 });
          if (age >= 4) at(f.c, 12, { bg: 'W', alpha: 0.4 * (1 - (age - 4) / 4) });
          break;
        }
        case 'grow': {   // a sacred tree bursts up
          if (age < 3) at(f.c, f.r, { bg: GROUND[0], g: ['dot', 'sprout', 'club'][age], fg: age < 2 ? 'G' : 'W', dt: 'w' });
          else for (const [dc, dr] of NEAR4) at(f.c + dc, f.r + dr, { g: 'star', fg: 'W', alpha: 1 - (age - 3) / 3 });
          break;
        }
        case 'leviathan': {   // a titan surfaces, arcs and dives
          const row = 16, head = f.c + f.dir * (age - 3);
          if (age < 3) {
            at(f.c, row, { bg: 'sea', g: age % 2 ? 'ring' : 'approx', fg: 'Y' });
            for (const [dc, dr] of NEAR4) at(f.c + dc, row + dr, { g: 'dot', fg: 'C' });
          } else if (age < 17) {
            for (let s = 4; s >= 1; s--) if (age - 3 >= s * 2) at(head - f.dir * s * 2, row, { bg: 'sea', g: 'hump', fg: 'C' });
            at(head, row, { bg: 'sea', g: 'head', fg: 'C', flip: f.dir < 0 });
            if (age % 2) at(head, row - 1, { g: 'shade1', fg: 'Y', alpha: 0.7 });
          } else at(f.c + f.dir * 13, row, { bg: 'sea', g: age % 2 ? 'ring' : 'approx', fg: 'Y' });
          break;
        }
        case 'swoop': {   // the birds fly to the castle...
          if (age < 0) break;
          const u = age / 6;
          at(Math.round(lerp(f.c, CASTLE[0], u)), Math.round(lerp(f.r, CASTLE[1] - 1, u)), { g: age % 2 ? 'birdUp' : 'birdDown', fg: 'Y' });
          break;
        }
        case 'banners': {   // ...and the city flies its banners
          [32, 34, 35, 37, 38, 40].forEach((c, i) => at(c, 10, { g: 'flag', fg: 'marble', dt: ['b', 'R', 'W'][(i + Math.floor(step / 2)) % 3], flip: (step + i) % 4 < 2 }));
          break;
        }
        case 'build': {   // a tower goes up, with someone hammering
          at(f.c, f.r, { bg: GROUND[1], g: age < 3 || age % 2 ? 'scaffold' : 'tower', fg: age < 3 ? 'w' : 'marble', dt: 'O' });
          at(f.c - 1, f.r, { bg: GROUND[1], g: age % 2 ? 'hammer' : 'walker', fg: 'Y', dt: 'R' });
          break;
        }
        case 'dock': {   // the ship docks and a caravan carries the goods up
          if (f.docked === undefined) break;
          const k = Math.floor((step - f.docked) / 2), path = [[34, 14], [34, 13], [34, 12], [35, 11]];
          if (k < path.length) {
            at(...path[k], { bg: GROUND[1], g: 'walker', fg: 'Y', dt: 'O' });
            at(path[k][0], path[k][1] - 1, { g: 'dot', fg: 'O' });
          } else for (const [dc, dr] of NEAR4) at(CASTLE[0] + dc, CASTLE[1] + dr, { g: 'star', fg: 'O', alpha: 1 - (k - path.length) / 4 });
          break;
        }
        case 'dragon': {   // it swoops through the spot, breathing fire on the land below
          const { x, y } = dragonAt(f, step), d = f.dir, flip = d < 0, look = { fg: 'R', dt: 'W', flip };
          // Fire first, so the dragon flies over its own breath: a thick stream
          // pouring down from its jaws onto the land.
          if (Math.abs(x - f.c) <= 5) for (let r = y + 1; r <= 12; r++) for (const w of [1, 2]) {
            at(x + d * w, r, { g: (r + w + age) % 3 ? 'flame' : 'shade2', fg: ['R', 'o', 'O'][(r + w + age) % 3], dt: 'W', alpha: w === 2 ? 0.7 : 0.95 });
          }
          at(x - d * 2, y, { g: 'drgTail', ...look });
          at(x - d, y, { g: 'drgBody', ...look });
          at(x, y, { g: 'drgHead', ...look });
          at(x - d, age % 2 ? y - 1 : y + 1, { g: age % 2 ? 'drgWingUp' : 'drgWingDown', ...look });
          break;
        }
        case 'battle': {   // one marches in from the horizon; they fight; the winner leaves
          const fightAt = f.march, endAt = f.march + 8;
          // The challenger rises over the mountains, then comes down to fight.
          const b = age < fightAt
            ? [Math.round(lerp(f.bx, f.c + f.side, age / f.march)), Math.round(lerp(HORIZON, f.r, age / f.march))]
            : [f.c + f.side, f.r];
          if (age < endAt) {
            const fighting = age >= fightAt;
            at(f.c, f.r, { bg: GROUND[2], g: fighting && age % 2 ? 'hammer' : 'walker', fg: 'R', dt: 'Y', flip: f.side < 0 });
            at(b[0], b[1], { bg: b[1] > HORIZON ? GROUND[2] : null, g: fighting && age % 2 === 0 ? 'hammer' : 'walker', fg: 'b', dt: 'Y', flip: f.side > 0, alpha: b[1] > HORIZON ? 1 : 0.7 });
            if (fighting) at(age % 2 ? f.c : b[0], f.r - 1, { g: 'star', fg: 'W' });
          } else {
            const from = f.winA ? f.c : f.c + f.side, away = f.winA ? -f.side : f.side;
            at(from + away * (age - endAt) * 2, f.r, { bg: GROUND[2], g: 'walker', fg: f.winA ? 'R' : 'b', dt: 'Y', flip: away < 0 });
          }
          break;
        }
        case 'wave': {   // a great wave swells, sweeps the shore, and drains away
          const mid = (f.c0 + f.c1) / 2;
          for (let c = f.c0; c <= f.c1; c++) {
            // A ragged, rounded front: the flanks run a step or two behind.
            const lag = Math.round(rnd('surge', c, f.born) * 1.5) + (Math.abs(c - mid) > 3 ? 1 : 0) + (Math.abs(c - mid) > 4 ? 1 : 0);
            const front = age < 4 ? SEA : Math.max(LAND, 14 - Math.max(0, age - 4 - lag));
            const drain = age < 11 + lag ? LAND - 1 : LAND - 1 + (age - 10 - lag);
            if (age < 4) {
              for (let r = SEA; r < ROWS; r++) at(c, r, { bg: 'sea', g: 'approx', fg: 'Y' });
              at(c, SEA - 1, { g: 'shade1', fg: 'C', alpha: age / 4 });
              continue;
            }
            for (let r = Math.max(front, drain + 1); r < SEA; r++) at(c, r, { bg: 'sea', g: r === front ? 'approx' : 'tilde', fg: r === front ? 'Y' : 'C' });
            if (age < 11 && front > LAND) at(c, front - 1, { g: 'shade1', fg: 'C', alpha: 0.8 });
          }
          break;
        }
        case 'dig': {   // adventurers dig, and up comes a relic of an older age
          if (age < 6) {
            at(f.c, f.r, { bg: GROUND[3], g: 'shade2', fg: 'w' });
            at(f.c - 1, f.r, { bg: GROUND[3], g: age % 2 ? 'hammer' : 'walker', fg: 'prom', dt: 'O' });
          } else for (const [dc, dr] of NEAR4) at(f.c + dc, f.r + dr, { g: 'star', fg: 'W', alpha: 1 - (age - 6) / 3 });
          break;
        }
        case 'star': {   // a wishing star falls; someone runs out to fetch it
          const ly = 12, go = Math.abs(f.lx - 36) + 1, picked = 6 + go;
          if (age < 6) {
            const u = age / 6;
            at(Math.round(lerp(f.c, f.lx, u)), Math.round(lerp(f.r, ly, u)), { g: 'star', fg: 'W' });
            for (let k = 1; k <= 2; k++) {
              const v = Math.max(0, u - k * 0.12);
              at(Math.round(lerp(f.c, f.lx, v)), Math.round(lerp(f.r, ly, v)), { g: 'dot', fg: 'W', alpha: 1 - k * 0.3 });
            }
          } else if (age < picked) {
            at(f.lx, ly, { bg: 'O', alpha: 0.3 });
            at(f.lx, ly, { g: 'crystal', fg: 'W', dt: 'O' });
            at(Math.round(lerp(36, f.lx, (age - 6) / go)), 13, { bg: GROUND[3], g: 'walker', fg: 'prom', dt: 'O', flip: f.lx < 36 });
          } else if (age < picked + 4) {
            at(f.lx, 13, { bg: GROUND[3], g: 'walker', fg: 'prom', dt: 'O' });
            at(f.lx, 12, { g: 'star', fg: 'W' });
          } else {
            const x = f.lx + Math.sign(36 - f.lx) * (age - picked - 4);
            at(x, 13, { bg: GROUND[3], g: 'walker', fg: 'prom', dt: 'O', flip: f.lx > 36 });
            at(x, 12, { g: 'star', fg: 'W', alpha: 0.8 });
          }
          break;
        }
        case 'depart': {   // a ship sets sail and leaves
          const x = f.c + f.dir * age;
          at(x, 16, { bg: 'sea', g: 'boat', fg: 'prom', dt: 'w', flip: f.dir < 0 });
          at(x - f.dir, 16, { g: 'tilde', fg: 'Y', alpha: 0.6 });
          for (let i = 0; i < 2; i++) at(x - f.dir * i, 15, { g: (age + i) % 2 ? 'birdUp' : 'birdDown', fg: 'Y', alpha: 0.9 });
          break;
        }
      }
    }
  }

  // Hovering hints at what a click will do.
  function drawHover(step, at, e) {
    const h = state.hover;
    if (!h) return;
    const { c, r, region } = h;
    const orbit = (n, rx, ry, tile) => {
      for (let i = 0; i < n; i++) {
        const a = step * 0.35 + (i * TAU) / n;
        at(c + Math.round(Math.cos(a) * rx), r + Math.round(Math.sin(a) * ry), tile(i));
      }
    };
    const bird = (fg) => (i) => ({ g: (step + i) % 2 ? 'birdUp' : 'birdDown', fg });
    if (e === 0) {
      if (region === 'sky') orbit(6, 2.5, 1, (i) => ({ g: (step + i) % 3 ? 'dot' : 'star', fg: i % 2 ? 'M' : 'W' }));
      if (region === 'land') for (let dr = -1; dr <= 1; dr++) for (let dc = -2; dc <= 2; dc++) {
        const cc = c + dc, rr = r + dr;
        if (rr < LAND || rr >= SEA || Math.abs(dc) + Math.abs(dr) > 2 || rnd('bloom', cc, rr, Math.floor(step / 2)) > 0.7) continue;
        const petal = ['M', 'W', 'R'][Math.floor(rnd('pet', cc, rr) * 3)];
        // Flowers in the open; on the trees, a shimmer.
        at(cc, rr, tileAt(0, cc, rr)?.open ? { g: 'flower', fg: petal, dt: 'W' } : { g: 'star', fg: petal, alpha: 0.85 });
      }
      if (region === 'sea') {
        at(c, r, { bg: 'C', alpha: 0.18 });
        orbit(4, 2, 1, (i) => ({ g: 'dot', fg: i % 2 ? 'C' : 'W' }));
      }
    } else if (e === 1) {
      if (region === 'sky') orbit(1, 3, 1, bird('Y'));
      if (region === 'land') at(c, r, { g: 'tower', fg: 'marble', dt: 'O', alpha: 0.4 });
    } else if (e === 2) {
      if (region === 'sky') {
        if (r > 0) for (let dc = -2; dc <= 2; dc++) at(c + dc, r - 1, { g: 'cloud', fg: 'y', alpha: 0.55 });
        orbit(3, 3, 1, bird('y'));
      }
      if (region === 'land') {
        // Two soldiers face off: one here, one watching from the horizon.
        const dir = c < COLS / 2 ? 1 : -1;
        at(c, r, { g: 'walker', fg: 'R', dt: 'Y', flip: dir < 0 });
        if (step % 4 < 3) at(clamp(c + dir * 4, 1, COLS - 2), HORIZON, { g: 'walker', fg: 'b', dt: 'Y', flip: dir > 0, alpha: 0.8 });
      }
      if (region === 'sea') for (let dc = -3; dc <= 3; dc++) for (let rr = SEA; rr <= SEA + 1; rr++) at(c + dc, rr, { g: 'approx', fg: 'Y', alpha: 0.4 + 0.3 * wave(step / 6, 1, dc * 0.1) });
    } else {
      if (region === 'sky') {
        at(c, r, { bg: 'W', alpha: 0.18 + 0.1 * wave(step / 4, 1) });
        at(c, r, { g: 'star', fg: 'W' });
        for (const [dc, dr] of NEAR4) if ((step + dc + dr) % 2) at(c + dc * 2, r + dr, { g: 'dot', fg: 'W', alpha: 0.7 });
      }
      if (region === 'land') at(c, r, { g: step % 3 ? 'dot' : 'star', fg: 'W' });
      if (region === 'sea') orbit(3, 3, 1, bird('Y'));
    }
  }

  // Each Era's own small motions.
  const AMBIENT = [
    (at, amb) => {
      for (let i = 0; i < 4; i++) {
        const k = (amb + i * 5) % 12;
        at(10 + i * 15, 14 - Math.floor(k / 2), { g: 'dot', fg: i % 2 ? 'M' : 'C', alpha: 1 - k / 12 });
      }
      const { i, back } = pingpong(amb, 12, 3);
      at(6 + i, 14, { bg: 'grove', g: amb % 6 < 3 ? 'deer' : 'deerGraze', fg: 'w', flip: back });
    },
    (at, amb) => {
      for (const c of [33, 39]) at(c, 9, { g: 'flag', fg: 'marble', dt: (amb + c) % 2 ? 'b' : 'W' });
      at(34, 12 + pingpong(amb, 2, 3).i, { bg: 'field', g: 'walker', fg: 'Y', dt: 'R' });
      at(state.ship.c, 16, { bg: 'sea', g: 'boat', fg: 'Y', dt: 'w', flip: state.ship.aim < state.ship.c });
    },
    (at, amb) => {
      [[35, 10], [38, 11], [32, 12], [14, 12], [56, 10]].forEach(([c, r], i) => {
        at(c, r, { g: 'flame', fg: (amb + i) % 3 ? 'R' : 'o', dt: 'W' });
        const k = (amb + i * 3) % 9;
        at(c + (k > 5 ? 1 : 0), r - 1 - Math.floor(k / 3), { g: 'shade1', fg: 'y', alpha: 1 - k / 9 });
      });
    },
    (at, amb) => {
      for (const [c, r] of [TOWN[0], TOWN[1], TOWN[6]]) {
        const k = (amb + c) % 8;
        at(c, r - 1 - Math.floor(k / 4), { g: 'shade1', fg: 'y', alpha: 0.7 - k / 12 });
      }
      for (let i = 0; i < 2; i++) at(42 + ((Math.floor(amb / 2) + i * 13) % 30), 13, { bg: 'grove', g: 'walker', fg: i ? 'Y' : 'prom', dt: 'O' });
      const sail = pingpong(amb, 20, 3);
      at(8 + sail.i, 16, { bg: 'sea', g: 'boat', fg: 'prom', dt: 'w', flip: sail.back });
    },
  ];

  // ---------- Drawing ----------

  const mix = (a, b, k) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
    return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
  };

  function render(ctx, step, theme, { calm = false } = {}) {
    const P = PALETTES[theme];
    const amb = calm ? 0 : step;
    const k = clock(state.t), e = k.e;
    const at = (c, r, tile) => put(ctx, P, c, r, tile);
    ctx.imageSmoothingEnabled = false;

    // The sky, from dawn through day and dusk to night.
    ctx.fillStyle = mix(mix(P.night, P.day[e], k.light), P.dusk, k.warm * 0.55 * (k.light > 0 ? 1 : 0.4));
    ctx.fillRect(0, 0, W, (HORIZON + 1) * 24);
    const dark = 1 - k.light;
    if (dark > 0.3) for (const [c, r, ph] of SKYSTARS) at(c, r, { g: (amb + ph) % 12 === 0 ? 'star' : 'dot', fg: 'star', alpha: (dark - 0.3) * 1.3 });

    // The sun, rising on the left and setting on the right: a round disc
    // five cells wide and three tall (cells are taller than they are wide).
    if (k.sun >= 0) {
      const sc = Math.round(-3 + k.sun * (COLS + 6)), sr = Math.round(HORIZON - 0.5 - Math.sin(Math.PI * k.sun) * 7);
      const fg = k.warm > 0.5 ? 'sunset' : 'sun', haze = e === 2 ? 0.75 : 1;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -2; dc <= 2; dc++) {
        if ((Math.abs(dc) === 2 && dr) || sr + dr > HORIZON) continue;
        at(sc + dc, sr + dr, { bg: fg, alpha: (Math.abs(dc) === 2 || (dr && Math.abs(dc) === 1) ? 0.75 : 1) * haze });
      }
      [[-3, 0], [3, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([dc, dr], i) => {
        if ((i + amb) % 2 === 0 && sr + dr <= HORIZON) at(sc + dc, sr + dr, { g: i < 3 ? 'star' : 'dot', fg, alpha: 0.8 * haze });
      });
    }

    // The valley in this Era, with what earlier Eras left on it.
    for (let r = HORIZON; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const tile = tileAt(e, c, r);
      if (tile) at(c, r, tile);
    }
    for (const fl of state.floods) {
      if (e < fl.from) continue;
      for (let r = fl.top; r < SEA; r++) for (let c = fl.c0; c <= fl.c1; c++) {
        const q = rnd('wreck', c, r);
        if (e === 2) at(c, r, { bg: 'ash', g: q < 0.06 ? 'ribs' : q < 0.1 ? 'dskull' : q < 0.13 ? 'boat' : q < 0.3 ? 'shade2' : null, fg: q < 0.1 ? 'Y' : 'w', dt: 'w', flip: q < 0.12 });
        else at(c, r, { bg: 'grove', g: q < 0.35 ? 'grass' : q < 0.45 ? 'sprout' : q < 0.5 ? 'flower' : null, fg: q < 0.45 ? 'G' : 'M', dt: 'W' });
      }
    }
    for (const ch of state.changes) {
      if (e < ch.from || (e === ch.from && state.step < ch.at)) continue;
      const tile = ch.kind === 'relic' ? ch.tile : LINEAGE[ch.kind][e];
      if (!tile) continue;
      at(ch.c, ch.r, { bg: GROUND[e], ...tile });
      if (tile.glow) at(ch.c, ch.r, { bg: 'O', alpha: 0.18 + 0.08 * wave(amb / 8, 1) });
    }
    for (const fire of state.fires) {
      const age = state.step - fire.born;
      if (age < 40) { at(fire.c, fire.r, { bg: 'O', alpha: 0.25 }); at(fire.c, fire.r, { g: 'flame', fg: (amb + fire.c + fire.r) % 3 ? 'R' : 'o', dt: (amb + fire.r) % 2 ? 'W' : 'O' }); }
      else at(fire.c, fire.r, { bg: 'ash', g: 'shade1', fg: 'r' });
    }

    AMBIENT[e](at, amb);
    drawFx(step, at);
    if (k.day) drawHover(step, at, e);

    // Night darkens the land; lit windows and the Seed shine through.
    if (dark > 0) {
      ctx.fillStyle = P.shade;
      ctx.globalAlpha = dark * P.shadeMax;
      ctx.fillRect(0, (HORIZON + 1) * 24, W, H);
      ctx.globalAlpha = 1;
      if (dark > 0.4) for (let r = LAND; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (tileAt(e, c, r)?.lit) at(c, r, { g: 'dot', fg: 'O', alpha: (dark - 0.4) * 1.6 });
      }
    }

    // A flash of the new Era's light as it arrives.
    if (k.flash > 0 && !calm) {
      ctx.fillStyle = P[ERAS[k.p < 2 ? e : (e + 1) % 4]];
      ctx.globalAlpha = k.flash * 0.6;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  SceneKit.register({
    name: 'eras', width: W, height: H, fps: FPS, frames: FRAMES, tick: TICK, poster: 160,
    backgrounds: { light: PALETTES.light.paper, dark: PALETTES.dark.paper },
    // For previews and the poster, play the day forward to the frame asked for.
    draw: (ctx, frame, theme) => {
      const step = Math.floor(frame / TICK);
      if (step < state.step) Object.assign(state, fresh());
      while (state.step < step) update(state.step + 1);
      render(ctx, step, theme);
    },
    render, update, hover, click, cursor, state,
  });
})();
