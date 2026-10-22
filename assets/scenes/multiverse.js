// Home page hero: the multiverse. Bubble universes drift in the void around
// the World Seed's own world, tied to it by threads of light. Each bubble is a
// whole world in tiles, in the Caves of Qud manner of glyph-map, and each has
// another self: the same place down a different road.
//
//   the World Seed     our world in miniature        / after the Era of Ruin
//   pirate seas        islands, a ship, a sea king    / storm and a ghost ship
//   dragon highlands   clans under circling dragons  / the dragons long dead
//   the burrow wood    an abbey wall, mice, lanterns  / deep winter
//   high fantasy       a white castle, a knight       / fallen to a dark lord
//   alien space        a ringed planet, a UFO         / the alien surface
//   sky isles          floating islands, an airship   / night and aurora
//   clockwork          gears turning, steam           / rusted and overgrown
//
// It plays live on the home page and is decorative only. The pointer is a
// lens: over a bubble it shows that universe's other self; over the void it
// finds faint universes no one else can see. A click on a bubble splits it,
// and the new one drifts away as the other self. A click on the void buds a
// newborn universe. Small ones bud off the Seed's world now and then, and
// every newborn pops in time.
//
// Preview with art/scenes/multiverse.html (?live to play), which also renders
// the poster.

(function () {
  const { TAU, wave, clamp, smooth } = SceneKit;
  const { rnd, noise, connector, dirTo, QUD } = GlyphKit;

  const W = 2552, H = 788, FPS = 24, FRAMES = FPS * 12;
  const TICK = 4;               // frames per step: tiles change at 6 Hz, like game turns
  const STEPS = FRAMES / TICK;  // 72 steps in the preview loop
  const COLS = 158, ROWS = 32, OX = 12, OY = 10;
  const { centre, cellOf, put, cellPath } = GlyphKit.grid({ cols: COLS, rows: ROWS, ox: OX, oy: OY });
  const key = (...k) => k.join(',');
  const blank = '........';

  // Each universe has its own colours. A few of them are windows onto night
  // or space, which stay dark in the light theme too.
  const PALETTES = {
    dark: {
      ...QUD.dark,
      veil: '#7b8cff', starC: '#f2efe6', bolt: '#ffffff', ghost: '#9fe3e0',
      seaBg: '#0f2a33', iBg: '#2b2711', jBg: '#11251a', dBg: '#29230f', fBg: '#25152a', ashBg: '#26241d', murk: '#1b1f1b',
      oBg: '#0c2a44', sand: '#3a3016', stormBg: '#121820',
      slate: '#1f2228', slateD: '#3c4250', stone: '#9aa3b5', lavaBg: '#3a1508',
      meadow: '#1d2a14', oak: '#a3a83c', snowBg: '#2c3238', snowC: '#e6edf2',
      vale: '#16261a', lakeBg: '#0e2638', marble: '#e6e2f2', gloom: '#5a4252', blight: '#1e1418',
      space: '#06070d', planet: '#5a3a7a', planetD: '#8f6bbd', ringC: '#e9c46a', alienBg: '#2a1438', alienD: '#6a3a88', neon1: '#3fe0d0', neon2: '#ff5fcf',
      sky: '#15304a', cloudC: '#d9e4ea', dirt: '#2e2213', grassBg: '#1d3317', night: '#0a0f1e',
      brassBg: '#2a1f10', brassD: '#5a4422',
    },
    light: {
      ...QUD.light,
      veil: '#5b6ad0', starC: '#f7f3ea', bolt: '#3b3fb8', ghost: '#2f8f8a',
      seaBg: '#d4e6ea', iBg: '#f0e6be', jBg: '#e2ead2', dBg: '#f1e4c1', fBg: '#eedbe8', ashBg: '#e2ddd0', murk: '#d9dccf',
      oBg: '#bcd7e8', sand: '#f1e2b0', stormBg: '#c9d0d8',
      slate: '#d9dbe0', slateD: '#a9afbb', stone: '#5a6274', lavaBg: '#f2c9b4',
      meadow: '#e3ecc9', oak: '#6f7a1f', snowBg: '#eef2f5', snowC: '#8ea4b4',
      vale: '#dfe9cf', lakeBg: '#cfe1ef', marble: '#5f5a78', gloom: '#3a2a33', blight: '#d8cdd0',
      space: '#1f2438', planet: '#6b4a8f', planetD: '#9b7cc4', ringC: '#e9c46a', alienBg: '#dcc6ea', alienD: '#a77cc4', neon1: '#14b3a3', neon2: '#e23fb0',
      sky: '#cfe5f4', cloudC: '#ffffff', dirt: '#d9c39a', grassBg: '#cfe3b4', night: '#222a48',
      brassBg: '#efdcb6', brassD: '#c9a86a',
    },
  };

  GlyphKit.define({
    pship: ['...d....', '...dd...', '...#....', '..###...', '.#####..', '..###...', '...#....', '########', '.######.', '..####..', blank, blank],
    whirl: [blank, '..####..', '.#....#.', '#..##..#', '#.#..#.#', '#.#.#..#', '#..#..#.', '.#...#..', '..###...', blank, blank, blank],
    rain: ['#.......', '.#......', blank, '....#...', '.....#..', blank, '..#.....', '...#....', blank, '......#.', '.......#', blank],
    mouse: [blank, '.##..##.', '.##..##.', '..####..', '.#d##d#.', '..####..', '...##...', '..####..', '..#..#..', blank, blank, blank],
    moonlet: [blank, blank, blank, '..###...', '.#####..', '.##.##..', '.#####..', '..###...', blank, blank, blank, blank],
    ufo: [blank, blank, '...##...', '..#dd#..', '.######.', '########', '.#.##.#.', blank, blank, blank, blank, blank],
    dome: [blank, blank, blank, '..####..', '.#d..d#.', '#dddddd#', '#.d..d.#', '########', blank, blank, blank, blank],
    tentacle: ['....#...', '...#.#..', '..#...#.', '..#.....', '...#....', '....#...', '...#....', '..#.....', '..#.....', '.###....', blank, blank],
    blimp: [blank, '..#####.', '.#######', '########', '.#######', '..#####.', '...ddd..', '...d.d..', blank, blank, blank, blank],
    gearA: [blank, '...##...', '.######.', '.##..##.', '###..###', '###..###', '.##..##.', '.######.', '...##...', blank, blank, blank],
    gearB: [blank, '.#....#.', '.######.', '###..###', '.#....#.', '.#....#.', '###..###', '.######.', '.#....#.', blank, blank, blank],
  });

  // ---------- The universes ----------
  // A side (prime or echo) gives each interior cell a tile from its offset
  // (dc, dr) from the bubble's centre cell, a per-cell random q and a noise
  // value n; anim(at, t) draws the moving parts with at(dc, dr, tile).

  const field = noise('field', 2.3);
  const inside = (dc, dr, x, y, rx, ry) => ((dc - x) / rx) ** 2 + ((dr - y) / ry) ** 2 < 1;
  const flick = (amb, n) => Math.floor(amb / n);

  // The World Seed's world: three small continents round the Seed.
  const SEEDLANDS = [
    { x: -4, y: -1, rx: 2.8, ry: 1.7, bg: 'jBg', land: 'green' },
    { x: 3, y: -2, rx: 2.6, ry: 1.3, bg: 'dBg', land: 'gold' },
    { x: 3.5, y: 2, rx: 2.6, ry: 1.5, bg: 'fBg', land: 'pink' },
  ];
  const seedLand = (dc, dr) => SEEDLANDS.find((l) => inside(dc, dr, l.x, l.y, l.rx, l.ry));

  // Pirate seas.
  const ISLES = [[-4, -2, 1.6, 1], [3, 1, 2.1, 1.2], [-1, 3, 1.3, 0.8], [5, -3, 0.9, 0.6]];
  const isle = (dc, dr) => ISLES.find(([x, y, rx, ry]) => inside(dc, dr, x, y, rx, ry));
  const shipAt = (amb) => {
    const a = amb * 0.06;
    return { x: Math.round(Math.cos(a) * 6), y: Math.round(Math.sin(a) * 3.6), flip: Math.sin(a) > 0 };
  };

  // Dragon highlands: five clans and a fortress.
  const CLANS = [[-5, -1, 'W'], [-2, -3, 'G'], [3, -3, 'R'], [5, 0, 'b'], [2, 3, 'm']];
  const clanAt = (dc, dr) => CLANS.find(([x, y]) => x === dc && y === dr);
  const lavaAt = (dc, dr) => Math.abs(dc) > 1 && dr === Math.round(2 + Math.sin(dc * 0.7));
  const dragonAt = (amb, i) => {
    const a = amb * 0.09 + i * Math.PI;
    return { x: Math.round(Math.cos(a) * 4.6), y: Math.round(Math.sin(a) * 2.4) - 1, flip: Math.sin(a) > 0 };
  };

  // The burrow wood: an abbey wall above, burrows below, a lane between.
  const DOORS = [[-5, 0], [4, 1], [-2, 2], [5, -1], [1, 3]];
  const doorAt = (dc, dr) => DOORS.some(([x, y]) => x === dc && y === dr);
  const wallAt = (dc, dr) => (dr === -3 && Math.abs(dc) <= 3) || (Math.abs(dc) === 3 && dr === -2);
  const laneY = (dc) => Math.round(1 + Math.sin(dc * 0.6));
  const LANE = Array.from({ length: 13 }, (_, i) => [i - 6, laneY(i - 6)]);

  // High fantasy: a castle on a rise, a road winding down from its gate.
  const roadX = (dr) => Math.round(Math.sin(dr * 0.9) * 1.5);
  const roadAt = (dc, dr) => dr >= 0 && dc === roadX(dr);
  const ROAD = Array.from({ length: 5 }, (_, i) => [roadX(i), i]);

  // Sky isles.
  const FLOATS = [[-3, -1, 2.2, 0.9], [3, 1, 2.6, 1.1], [0, -3, 1.4, 0.6]];
  const floatAt = (dc, dr) => FLOATS.find(([x, y, rx, ry]) => inside(dc, dr, x, y, rx, ry));

  // Clockwork: gears joined by pipes.
  const GEARS = [[-3, -1], [0, 0], [3, 1], [-1, 3], [4, -2], [-5, 2], [1, -3]];
  const gearAt = (dc, dr) => GEARS.findIndex(([x, y]) => x === dc && y === dr);
  const PIPES = new Map();
  for (let i = 0; i < GEARS.length - 1; i++) {
    const [x1, y1] = GEARS[i], [x2, y2] = GEARS[i + 1];
    const cells = [];
    for (let x = x1; x !== x2; x += Math.sign(x2 - x1)) cells.push([x, y1]);
    for (let y = y1; y !== y2; y += Math.sign(y2 - y1)) cells.push([x2, y]);
    cells.push([x2, y2]);
    cells.forEach(([x, y], j) => {
      if (!PIPES.has(key(x, y))) PIPES.set(key(x, y), new Set());
      for (const k of [j - 1, j + 1]) if (cells[k]) PIPES.get(key(x, y)).add(dirTo(cells[k][0] - x, cells[k][1] - y));
    });
  }

  const UNIVERSES = {
    seed: {
      rim: ['G', 'W', 'O'],
      prime: {
        tile(dc, dr, q) {
          if (!dc && !dr) return { bg: 'iBg', g: 'seed', fg: 'G', dt: 'O' };
          if (Math.abs(dc) === 1 && !dr) return { bg: 'iBg', g: 'grass', fg: 'G' };
          const l = seedLand(dc, dr);
          if (l?.land === 'green') return { bg: l.bg, g: q < 0.45 ? 'fir' : q < 0.75 ? 'club' : 'grass', fg: q < 0.6 ? 'G' : 'g', dt: 'w' };
          if (l?.land === 'gold') return { bg: l.bg, g: q < 0.35 ? 'hill' : q < 0.5 ? 'cactus' : 'dot', fg: q < 0.35 ? 'W' : q < 0.5 ? 'G' : 'w' };
          if (l?.land === 'pink') return { bg: l.bg, g: q < 0.4 ? 'mush' : q < 0.55 ? 'mountain' : 'grass', fg: q < 0.55 ? 'M' : 'm', dt: 'Y' };
          return { bg: 'seaBg', g: q < 0.3 ? 'tilde' : q < 0.45 ? 'dot' : null, fg: q < 0.3 ? 'c' : 'K' };
        },
        anim(at, { amb }) {
          const glow = 0.5 + 0.5 * wave(amb / STEPS, 1);
          at(0, 0, { bg: 'O', alpha: 0.25 + 0.35 * glow });
          at(0, 0, { g: 'seed', fg: 'G', dt: glow > 0.5 ? 'W' : 'O' });
          for (let i = 0; i < 4; i++) {
            const dc = Math.floor(rnd('sw', i, flick(amb, 3)) * 15) - 7, dr = Math.floor(rnd('swr', i, flick(amb, 3)) * 9) - 4;
            if (!seedLand(dc, dr) && Math.abs(dc) > 1) at(dc, dr, { bg: 'seaBg', g: 'approx', fg: 'C' });
          }
        },
      },
      echo: {
        tile(dc, dr, q) {
          if (!dc && !dr) return { bg: 'ashBg', g: 'dot', fg: 'w' };
          if (seedLand(dc, dr)) return { bg: 'ashBg', g: q < 0.3 ? 'ruin' : q < 0.55 ? 'shade1' : q < 0.65 ? 'bare' : null, fg: q < 0.3 ? 'w' : 'y' };
          return { bg: 'murk', g: q < 0.25 ? 'tilde' : null, fg: 'y' };
        },
        anim(at, { amb }) {
          for (let i = 0; i < 3; i++) {
            const k = (amb + i * 5) % 15;
            if (k < 5) at(-4 + i * 4, -1 - Math.floor(k / 2), { g: 'dot', fg: 'o', alpha: 1 - k / 5 });
          }
        },
      },
    },

    ocean: {
      rim: ['C', 'B', 'Y'],
      prime: {
        tile(dc, dr, q) {
          const i = isle(dc, dr);
          if (i) return { bg: 'sand', g: Math.hypot(dc - i[0], dr - i[1]) < 0.6 || q < 0.3 ? 'club' : 'dot', fg: 'G', dt: 'w' };
          return { bg: 'oBg', g: q < 0.22 ? 'approx' : q < 0.42 ? 'tilde' : null, fg: q < 0.22 ? 'B' : 'C' };
        },
        anim(at, { amb }) {
          at(-5, 1, { bg: 'oBg', g: 'whirl', fg: 'C', flip: amb % 2 === 0 });
          const s = shipAt(amb), wake = shipAt(amb - 3);
          at(wake.x, wake.y, { bg: 'oBg', g: 'tilde', fg: 'Y' });
          at(s.x, s.y, { bg: 'oBg', g: 'pship', fg: 'w', dt: 'R', flip: s.flip });
          // Now and then a sea king lifts its head.
          const k = amb % 48;
          if (k < 3) at(1, -3, { bg: 'oBg', g: 'ring', fg: 'Y' });
          else if (k < 14) {
            at(1, -3, { bg: 'oBg', g: 'head', fg: 'G' });
            if (k > 5) at(-1, -3, { bg: 'oBg', g: 'hump', fg: 'G' });
          }
        },
      },
      echo: {
        tile(dc, dr, q) {
          if (isle(dc, dr)) return { bg: 'stormBg', g: 'shade2', fg: 'w' };
          return { bg: 'stormBg', g: q < 0.35 ? 'approx' : q < 0.6 ? 'tilde' : null, fg: q < 0.15 ? 'Y' : 'c' };
        },
        anim(at, { amb }) {
          for (let dr = -5; dr <= 5; dr++) for (let dc = -8; dc <= 8; dc++) if ((dr * 2 + dc * 3 - amb + 400) % 5 === 0) at(dc, dr, { g: 'rain', fg: 'y' });
          const s = shipAt(amb + 30);
          at(s.x, s.y, { bg: 'stormBg', g: 'pship', fg: 'ghost', dt: 'ghost', alpha: 0.85, flip: s.flip });
          if (amb % 30 < 2) {
            const x = Math.round(rnd('strike', flick(amb, 30)) * 8) - 4;
            const bolt = [[x, -4], [x + 1, -3], [x, -2], [x + 1, -1]];
            bolt.forEach(([c, r], j) => {
              const dirs = [bolt[j - 1], bolt[j + 1]].filter(Boolean).map(([c2, r2]) => dirTo(c2 - c, r2 - r));
              at(c, r, { g: connector(dirs, 2), fg: 'bolt' });
            });
          }
        },
      },
    },

    dragon: {
      rim: ['R', 'O', 'W'],
      prime: {
        tile(dc, dr, q, n) {
          if (!dc && dr === 1) return { bg: 'slate', g: 'tower', fg: 'stone', dt: 'O' };
          if (Math.abs(dc) === 1 && dr === 1) return { bg: 'slate', g: 'ruin', fg: 'stone' };
          const clan = clanAt(dc, dr);
          if (clan) return { bg: 'slate', g: 'flag', fg: 'stone', dt: clan[2] };
          if (lavaAt(dc, dr)) return { bg: 'lavaBg', g: 'tilde', fg: 'R' };
          if (n > 0.58) return { bg: 'slate', g: 'mountain', fg: 'stone', dt: 'Y' };
          if (n > 0.45) return { bg: 'slate', g: 'hill', fg: 'slateD' };
          return { bg: 'slate', g: q < 0.3 ? 'shade1' : null, fg: 'slateD' };
        },
        anim(at, { amb }) {
          for (let dc = -7; dc <= 7; dc++) {
            const dr = Math.round(2 + Math.sin(dc * 0.7));
            if (lavaAt(dc, dr) && rnd('lava', dc, flick(amb, 2)) < 0.3) at(dc, dr, { bg: 'lavaBg', g: 'tilde', fg: 'o' });
          }
          for (let i = 0; i < 2; i++) {
            const d = dragonAt(amb, i), ahead = d.flip ? -1 : 1;
            at(d.x, d.y, { bg: 'slate', g: (amb + i) % 2 ? 'dragonUp' : 'dragonDown', fg: i ? 'C' : 'R', dt: 'W', flip: d.flip });
            if ((amb + i * 17) % 34 < 4) {
              at(d.x + ahead, d.y, { bg: 'slate', g: 'flame', fg: 'R', dt: 'W', flip: d.flip });
              at(d.x + ahead * 2, d.y, { bg: 'slate', g: 'flame', fg: 'o', dt: 'O', flip: d.flip });
            }
          }
        },
      },
      echo: {
        tile(dc, dr, q, n) {
          const clan = clanAt(dc, dr);
          if (clan) return { bg: 'slate', g: 'tent', fg: clan[2], dt: clan[2] };
          if (dr === 2 && dc >= -5 && dc <= -3) return { bg: 'slate', g: dc === -3 ? 'dskull' : 'ribs', fg: 'Y' };
          if (!dc && dr === 1) return { bg: 'slate', g: 'ruin', fg: 'stone' };
          if (lavaAt(dc, dr)) return { bg: 'slate', g: 'shade1', fg: 'w' };
          if (n > 0.58) return { bg: 'slate', g: 'mountain', fg: 'stone', dt: 'Y' };
          if (n > 0.45) return { bg: 'slate', g: 'hill', fg: 'slateD' };
          return { bg: 'slate', g: q < 0.3 ? 'shade1' : null, fg: 'slateD' };
        },
        anim(at, { amb }) {
          CLANS.forEach(([x, y], i) => at(x, y + 1, { bg: 'slate', g: 'flame', fg: rnd('fire', i, amb) < 0.5 ? 'o' : 'R', dt: 'W' }));
        },
      },
    },

    burrow: {
      rim: ['R', 'w', 'G'],
      prime: {
        tile(dc, dr, q, n) {
          if (!dc && dr === -4) return { bg: 'meadow', g: 'tower', fg: 'R', dt: 'W' };
          if (wallAt(dc, dr)) return { bg: 'meadow', g: 'brick', fg: 'R' };
          if (dr === -2 && Math.abs(dc) < 3) return { bg: 'meadow', g: 'flower', fg: ['M', 'W', 'R'][Math.floor(q * 3)], dt: 'W' };
          if (doorAt(dc, dr)) return { bg: 'meadow', g: 'burrow', fg: 'oak', dt: 'w' };
          if (dr === laneY(dc)) return { bg: 'meadow', g: 'dot', fg: 'w' };
          if (n > 0.6) return { bg: 'meadow', g: 'club', fg: 'oak', dt: 'w' };
          return { bg: 'meadow', g: q < 0.1 ? 'flower' : q < 0.35 ? 'grass' : null, fg: q < 0.1 ? 'M' : 'g', dt: 'W' };
        },
        anim(at, { amb }) {
          DOORS.forEach(([x, y], i) => at(x, y - 1, { g: 'dot', fg: rnd('lamp', i, flick(amb, 2)) < 0.8 ? 'O' : 'W' }));
          for (let i = 0; i < 3; i++) {
            const span = LANE.length - 1, k = (Math.floor(amb / 2) + i * 5) % (span * 2);
            const j = k < span ? k : span * 2 - k;
            const [x, y] = LANE[j];
            at(x, y, { bg: 'meadow', g: 'mouse', fg: 'w', dt: 'Y', flip: k >= span });
          }
        },
      },
      echo: {
        tile(dc, dr, q, n) {
          if (!dc && dr === -4) return { bg: 'snowBg', g: 'tower', fg: 'R', dt: 'O' };
          if (wallAt(dc, dr)) return { bg: 'snowBg', g: 'brick', fg: 'R' };
          if (doorAt(dc, dr)) return { bg: 'snowBg', g: 'burrow', fg: 'w', dt: 'O' };
          if (n > 0.6) return { bg: 'snowBg', g: 'bare', fg: 'w' };
          return { bg: 'snowBg', g: q < 0.3 ? 'dot' : null, fg: 'snowC' };
        },
        anim(at, { amb }) {
          for (let dr = -5; dr <= 5; dr++) for (let dc = -8; dc <= 8; dc++) if ((dr * 3 + dc * 5 - amb + 700) % 7 === 0) at(dc, dr, { g: 'dot', fg: 'snowC' });
        },
      },
    },

    fantasy: {
      rim: ['b', 'W', 'C'],
      prime: {
        tile(dc, dr, q, n) {
          if (!dc && dr === -1) return { bg: 'vale', g: 'castle', fg: 'marble', dt: 'b' };
          if (Math.abs(dc) === 1 && dr === -1) return { bg: 'vale', g: 'tower', fg: 'marble', dt: 'O' };
          if (!dc && dr === -2) return { bg: 'vale', g: 'flag', fg: 'marble', dt: 'b' };
          if (dc === 4 && dr === 1) return { bg: 'vale', g: 'tower', fg: 'b', dt: 'O' };
          if (roadAt(dc, dr)) return { bg: 'vale', g: 'dot', fg: 'W' };
          if (inside(dc, dr, -4, 1, 1.6, 0.8)) return { bg: 'lakeBg', g: q < 0.5 ? 'approx' : 'tilde', fg: 'B' };
          if (dr <= -3 && n > 0.42) return { bg: 'vale', g: 'mountain', fg: 'stone', dt: 'Y' };
          if (n > 0.55) return { bg: 'vale', g: 'fir', fg: q < 0.5 ? 'G' : 'C', dt: 'w' };
          return { bg: 'vale', g: q < 0.3 ? 'grass' : q < 0.4 ? 'flower' : null, fg: q < 0.3 ? 'g' : 'M', dt: 'W' };
        },
        anim(at, { amb }) {
          at(0, -2, { bg: 'vale', g: 'flag', fg: 'marble', dt: amb % 2 ? 'b' : 'W', flip: amb % 4 < 2 });
          for (let i = 0; i < 4; i++) {
            const dc = Math.floor(rnd('magic', i, flick(amb, 2)) * 13) - 6, dr = Math.floor(rnd('magicr', i, flick(amb, 2)) * 7) - 2;
            if (field(dc + 300, dr) > 0.55) at(dc, dr, { g: 'star', fg: i % 2 ? 'M' : 'C', alpha: 0.9 });
          }
          const span = ROAD.length - 1, k = Math.floor(amb / 3) % (span * 2);
          const [x, y] = ROAD[k < span ? span - k : k - span];
          at(x, y, { bg: 'vale', g: 'walker', fg: 'marble', dt: 'R' });
        },
      },
      echo: {
        tile(dc, dr, q, n) {
          if (!dc && dr === -1) return { bg: 'blight', g: 'castle', fg: 'gloom', dt: 'R' };
          if (Math.abs(dc) === 1 && dr === -1) return { bg: 'blight', g: 'tower', fg: 'gloom', dt: 'R' };
          if (dc === 4 && dr === 1) return { bg: 'blight', g: 'tower', fg: 'gloom', dt: 'R' };
          if (roadAt(dc, dr)) return { bg: 'blight', g: 'dot', fg: 'r' };
          if (inside(dc, dr, -4, 1, 1.6, 0.8)) return { bg: 'lavaBg', g: 'tilde', fg: 'R' };
          if (dr <= -3 && n > 0.42) return { bg: 'blight', g: 'mountain', fg: 'gloom', dt: 'R' };
          if (n > 0.55) return { bg: 'blight', g: 'bare', fg: 'w' };
          return { bg: 'blight', g: q < 0.25 ? 'shade1' : null, fg: 'gloom' };
        },
        anim(at, { amb }) {
          at(4, 1, { bg: 'R', alpha: 0.2 + 0.25 * (0.5 + 0.5 * wave(amb / 24, 1)) });
          at(4, 1, { g: 'tower', fg: 'gloom', dt: 'R' });
          for (let i = 0; i < 4; i++) {
            const k = (amb + i * 4) % 16;
            at(-3 + i * 2, 2 - Math.floor(k / 3), { g: 'dot', fg: 'o', alpha: 1 - k / 16 });
          }
        },
      },
    },

    alien: {
      rim: ['M', 'C', 'm'],
      prime: {
        tile(dc, dr, q) {
          if (!dr && Math.abs(dc - 1) <= 5) return { bg: inside(dc, dr, 1, 0, 3.9, 2.5) ? 'planet' : 'space', g: connector(['E', 'W'], 2), fg: 'ringC' };
          if (inside(dc, dr, 1, 0, 3.9, 2.5)) return { bg: 'planet', g: dr % 2 ? 'tilde' : null, fg: 'planetD' };
          return { bg: 'space', g: q < 0.03 ? 'star' : q < 0.13 ? 'dot' : null, fg: 'starC' };
        },
        anim(at, { amb }) {
          const a = amb * 0.1, x = Math.round(1 + Math.cos(a) * 6), y = Math.round(Math.sin(a) * 3.4);
          if (!(Math.sin(a) < 0 && inside(x, y, 1, 0, 4.1, 2.7))) at(x, y, { bg: 'space', g: 'moonlet', fg: 'y' });
          const k = amb % 60;
          if (k < 32) at(Math.round(k * 0.5) - 8, -3, { bg: 'space', g: 'ufo', fg: 'neon1', dt: 'neon2' });
          const s = amb % 25;
          if (s < 4) at(-6 + s * 2, -4 + s, { g: 'dot', fg: 'starC' });
        },
      },
      echo: {
        tile(dc, dr, q) {
          if (dr <= -2) return { bg: 'space', g: q < 0.12 ? 'dot' : null, fg: 'starC' };
          if ((dc === -3 && dr === 1) || (dc === 2 && dr === 2)) return { bg: 'alienBg', g: 'dome', fg: 'neon1', dt: 'neon2' };
          return { bg: 'alienBg', g: q < 0.2 ? 'tentacle' : q < 0.45 ? 'shade1' : null, fg: q < 0.1 ? 'neon1' : q < 0.2 ? 'neon2' : 'alienD' };
        },
        anim(at, { amb }) {
          at(-3, -4, { bg: 'space', g: 'moonlet', fg: 'neon2' });
          at(2, -3, { bg: 'space', g: 'moonlet', fg: 'y' });
          const bob = amb % 6 < 3 ? 0 : 1;
          at(4, -3 + bob, { bg: 'space', g: 'ufo', fg: 'neon1', dt: 'neon2' });
          for (let r = -1 + bob; r <= 1; r++) at(4, r, { g: 'vdash', fg: 'neon1', alpha: (r + amb) % 2 ? 0.5 : 0.9 });
        },
      },
    },

    sky: {
      rim: ['C', 'Y', 'B'],
      prime: {
        tile(dc, dr, q, n) {
          const f = floatAt(dc, dr);
          if (f) return dr < f[1] || (dr === f[1] && f[3] < 0.8) ? { bg: 'grassBg', g: q < 0.5 ? 'club' : 'grass', fg: 'G', dt: 'w' } : { bg: 'dirt', g: 'shade2', fg: 'w' };
          if (n > 0.62) return { bg: 'sky', g: 'cloud', fg: 'cloudC' };
          return { bg: 'sky' };
        },
        anim(at, { amb }) {
          FLOATS.forEach(([x, y, , ry], i) => {
            for (let k = 1; k <= 3; k++) at(x, y + Math.ceil(ry) + k - 1, { g: (amb + k) % 2 ? 'vdash' : 'dot', fg: 'C', alpha: 1 - k * 0.2 });
          });
          at(Math.round(((amb * 0.3) % 18) - 9), 3, { bg: 'sky', g: 'blimp', fg: 'O', dt: 'w' });
        },
      },
      echo: {
        tile(dc, dr, q) {
          if (floatAt(dc, dr)) return { bg: 'night', g: 'shade2', fg: 'K' };
          return { bg: 'night', g: q < 0.1 ? 'dot' : null, fg: 'starC' };
        },
        anim(at, { amb }) {
          for (let dc = -8; dc <= 8; dc++) for (const dr of [-4, -3]) {
            if (rnd('aur', dc, dr) < 0.75) at(dc, dr, { g: 'tilde', fg: ['G', 'C', 'M'][(dc + dr + Math.floor(amb / 2) + 30) % 3], alpha: 0.85 });
          }
          FLOATS.forEach(([x, y], i) => at(x, y, { g: 'dot', fg: rnd('lan', i, flick(amb, 3)) < 0.8 ? 'O' : 'W' }));
        },
      },
    },

    clock: {
      rim: ['O', 'w', 'W'],
      prime: {
        tile(dc, dr, q) {
          if (gearAt(dc, dr) >= 0) return { bg: 'brassBg', g: 'gearA', fg: 'O' };
          if (PIPES.has(key(dc, dr))) return { bg: 'brassBg', g: connector(PIPES.get(key(dc, dr)), 2), fg: 'w' };
          return { bg: 'brassBg', g: q < 0.25 ? 'shade1' : null, fg: 'brassD' };
        },
        anim(at, { amb }) {
          GEARS.forEach(([x, y], i) => at(x, y, { bg: 'brassBg', g: (amb + i) % 2 ? 'gearA' : 'gearB', fg: i % 2 ? 'O' : 'W' }));
          for (let i = 0; i < 2; i++) {
            const k = (amb + i * 6) % 12, [x, y] = GEARS[i * 3 + 1];
            if (k < 6) at(x, y - 1 - Math.floor(k / 3), { g: 'shade1', fg: 'y', alpha: 1 - k / 6 });
          }
        },
      },
      echo: {
        tile(dc, dr, q) {
          if (gearAt(dc, dr) >= 0) return { bg: 'brassBg', g: 'gearA', fg: 'r' };
          if (PIPES.has(key(dc, dr))) return { bg: 'brassBg', g: connector(PIPES.get(key(dc, dr)), 2), fg: 'r' };
          return { bg: 'brassBg', g: q < 0.3 ? 'grass' : q < 0.38 ? 'club' : q < 0.45 ? 'flower' : null, fg: q < 0.38 ? 'G' : 'M', dt: 'W' };
        },
      },
    },
  };
  const NAMES = Object.keys(UNIVERSES);

  // ---------- The void ----------

  const MAIN = [
    { u: 'seed', x: 1276, y: 404, R: 156 },
    { u: 'ocean', x: 720, y: 222, R: 128 },
    { u: 'fantasy', x: 470, y: 500, R: 138 },
    { u: 'burrow', x: 880, y: 600, R: 122 },
    { u: 'clock', x: 1276, y: 112, R: 92 },
    { u: 'dragon', x: 1840, y: 222, R: 128 },
    { u: 'alien', x: 1690, y: 606, R: 124 },
    { u: 'sky', x: 2090, y: 470, R: 126 },
  ].map((b, i) => ({ ...b, ax: b.x, ay: b.y, seed: i, echo: false, phase: rnd('ph', i) * TAU }));

  // Faint universes in the gaps, seen only through the lens.
  const GHOSTS = [[170, 190, 84], [2420, 170, 80], [1276, 708, 66], [2440, 690, 76], [140, 690, 70], [560, 90, 60]]
    .map(([x, y, R], i) => ({ u: NAMES[(i * 3 + 1) % NAMES.length], x, y, R, seed: 50 + i, echo: i % 2 === 1, ghost: true }));

  const edgeNoise = noise('edge', 90);
  const STARS = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const [x, y] = centre(c, r);
    const s = ((x - W / 2) / (W / 2)) ** 4 + ((y - H / 2) / (H / 2)) ** 4 + (edgeNoise(x, y) - 0.5) * 0.4;
    if (s < 1 && rnd('star', c, r) < 0.06 * (1 - s)) STARS.push({ c, r, fg: ['K', 'veil', 'C', 'K'][Math.floor(rnd('sc', c, r) * 4)], phase: Math.floor(rnd('sp', c, r) * 30) });
  }

  // ---------- What the reader has done ----------

  const LENS = 86;
  const state = {
    step: 0,
    pointer: null,   // { x, y } in canvas pixels
    born: [],        // newborn bubbles: { u, echo, seed, x0, y0, dir, R, born, life, from }
    wobble: new Map(),
  };

  // Where a bubble is now. Main bubbles bob around their anchors; newborns
  // slide out of their parent, then drift.
  function placeMain(b, amb) {
    b.x = b.ax + 26 * Math.sin((TAU * amb) / (STEPS * 6) + b.phase);
    b.y = b.ay + 12 * Math.sin((TAU * amb) / (STEPS * 4.5) + b.phase * 1.7);
  }
  function placeBorn(b, step) {
    const age = step - b.born;
    const out = b.from + (age < 8 ? smooth(age / 8) * b.reach : b.reach + (age - 8) * 1.4);
    b.x = clamp(b.x0 + Math.cos(b.dir) * out, b.R * 0.6, W - b.R * 0.6);
    b.y = clamp(b.y0 + Math.sin(b.dir) * out * 0.7, b.R * 0.5, H - b.R * 0.5);
    const popping = age - b.life;
    b.drawR = popping > 0 ? b.R * (1 - popping / 5) : age < 8 ? b.R * (0.35 + 0.65 * smooth(age / 8)) : b.R;
  }

  function bud({ u, echo, x, y, R, from = 0, reach = 0, life, step, seed }) {
    if (state.born.length >= 6) state.born[0].life = Math.min(state.born[0].life, step - state.born[0].born);
    state.born.push({ u, echo, seed, x0: x, y0: y, dir: rnd('dir', seed, step) * TAU, R, born: step, life, from, reach, x, y });
  }

  function update(step) {
    state.step = step;
    // Every so often a small universe buds off the Seed's world.
    if (step % 84 === 42) {
      const seedWorld = MAIN[0];
      bud({ u: NAMES[1 + Math.floor(rnd('ambient', step) * (NAMES.length - 1))], echo: rnd('ae', step) < 0.5, x: seedWorld.x, y: seedWorld.y,
        R: 50, from: seedWorld.R * 0.5, reach: seedWorld.R * 0.75, life: 110, step, seed: 'a' + step });
    }
    state.born = state.born.filter((b) => step - b.born < b.life + 5);
    for (const [k, until] of state.wobble) if (step > until) state.wobble.delete(k);
  }

  // ---------- Input ----------

  const bubbles = () => [...MAIN, ...state.born.filter((b) => state.step - b.born <= b.life)];
  function hover(x, y) {
    state.pointer = x === null ? null : { x, y };
  }
  function click(x, y) {
    const step = state.step;
    const hit = bubbles().reverse().find((b) => Math.hypot(b.x - x, (b.y - y) * 1) < (b.drawR ?? b.R));
    if (hit) {
      // It splits, and the new half is the other self.
      state.wobble.set(hit, step + 3);
      const R = Math.min(hit.R * 0.72, 84);
      bud({ u: hit.u, echo: !hit.echo, x: hit.x, y: hit.y, R, from: hit.R * 0.3, reach: hit.R * 0.75 + R, life: 150, step, seed: hit.seed });
    } else {
      bud({ u: NAMES[Math.floor(rnd('newborn', step, x) * NAMES.length)], echo: rnd('ne', step, y) < 0.3, x, y, R: 64, life: 150, step, seed: 'v' + step });
    }
  }
  const cursor = () => (state.pointer ? 'none' : '');

  // ---------- Drawing ----------

  const tiles = new Map();
  function tileOf(b, side, dc, dr) {
    const k = key(b.u, side, b.seed, dc, dr);
    if (!tiles.has(k)) {
      const seed = typeof b.seed === 'number' ? b.seed : rnd('seed', b.seed) * 1000;
      tiles.set(k, UNIVERSES[b.u][side].tile(dc, dr, rnd(b.u, side, b.seed, dc, dr), field(dc + seed * 7.3, dr + seed * 3.1)));
    }
    return tiles.get(k);
  }

  const lensOn = (c, r) => {
    if (!state.pointer) return false;
    const [x, y] = centre(c, r);
    return Math.hypot(x - state.pointer.x, y - state.pointer.y) < LENS;
  };

  // A universe: its interior (the other self wherever the lens is over it),
  // its moving parts, then an iridescent rim and a glint.
  function drawBubble(ctx, P, b, step, amb) {
    const R = (b.drawR ?? b.R) + (state.wobble.has(b) ? 6 : 0);
    if (R < 10) return;
    const [cc, cr] = cellOf(b.x, b.y);
    const U = UNIVERSES[b.u];
    const sides = b.echo ? ['echo', 'prime'] : ['prime', 'echo'];
    const alpha = b.ghost ? 0.55 : 1;
    const rc = Math.ceil(R / 16) + 1, rr = Math.ceil(R / 24) + 1;
    for (let dr = -rr; dr <= rr; dr++) for (let dc = -rc; dc <= rc; dc++) {
      const d = Math.hypot(dc * 16, dr * 24), c = cc + dc, r = cr + dr;
      if (d >= R) continue;
      const lens = lensOn(c, r);
      if (b.ghost && !lens) continue;
      put(ctx, P, c, r, { ...tileOf(b, b.ghost || !lens ? sides[0] : sides[1], dc, dr), alpha });
    }
    for (const [i, side] of sides.entries()) {
      const anim = U[side].anim;
      if (!anim || (i === 1 && (b.ghost || !state.pointer))) continue;
      anim((dc, dr, tile) => {
        const c = cc + dc, r = cr + dr;
        if (Math.hypot(dc * 16, dr * 24) >= R - 2) return;
        const lens = lensOn(c, r);
        if (b.ghost ? !lens : lens !== (i === 1)) return;
        put(ctx, P, c, r, { ...tile, alpha: (tile.alpha ?? 1) * alpha });
      }, { step, amb, seed: b.seed });
    }
    for (let dr = -rr; dr <= rr; dr++) for (let dc = -rc; dc <= rc; dc++) {
      const d = Math.hypot(dc * 16, dr * 24);
      if (d < R || d >= R + 13) continue;
      if (b.ghost && !lensOn(cc + dc, cr + dr)) continue;
      const turn = Math.floor(((Math.atan2(dr * 24, dc * 16) + Math.PI) / TAU) * 12 + amb / 3);
      put(ctx, P, cc + dc, cr + dr, { g: 'shade1', fg: U.rim[turn % U.rim.length], alpha: 0.9 * alpha });
    }
    if (!b.ghost) {
      const gx = Math.round((-R * 0.5) / 16), gy = Math.round((-R * 0.5) / 24);
      put(ctx, P, cc + gx, cr + gy, { g: amb % 12 < 2 ? 'star' : 'dot', fg: 'starC', alpha: 0.85 });
    }
  }

  // Threads from the Seed's world to the others, with light running out along them.
  function drawThreads(ctx, P, amb) {
    const [sx, sy] = [MAIN[0].x, MAIN[0].y];
    MAIN.slice(1).forEach((b, i) => {
      const path = cellPath([[sx, sy], [b.x, b.y]]);
      path.forEach(([c, r], j) => { if (j % 2 === 0) put(ctx, P, c, r, { g: 'dot', fg: 'veil', alpha: 0.45 }); });
      const k = Math.floor(amb * 0.7 + i * 7) % (path.length + 24);
      if (k < path.length) put(ctx, P, ...path[k], { g: 'star', fg: UNIVERSES[b.u].rim[0] });
    });
  }

  function drawStars(ctx, P, amb) {
    for (const s of STARS) {
      const k = (amb + s.phase) % 30;
      put(ctx, P, s.c, s.r, { g: k === 0 ? 'star' : 'dot', fg: s.fg, alpha: k === 0 ? 1 : 0.6 });
    }
  }

  // The lens itself: a ring, with more stars inside it than anyone else sees.
  function drawLens(ctx, P, amb) {
    if (!state.pointer) return;
    const [pc, pr] = cellOf(state.pointer.x, state.pointer.y);
    for (let dr = -5; dr <= 5; dr++) for (let dc = -7; dc <= 7; dc++) {
      const c = pc + dc, r = pr + dr, [x, y] = centre(c, r);
      const d = Math.hypot(x - state.pointer.x, y - state.pointer.y);
      if (Math.abs(d - LENS) < 10) put(ctx, P, c, r, { g: 'shade1', fg: 'veil', alpha: 0.85 });
    }
  }
  function drawLensStars(ctx, P, amb) {
    if (!state.pointer) return;
    const [pc, pr] = cellOf(state.pointer.x, state.pointer.y);
    for (let dr = -4; dr <= 4; dr++) for (let dc = -6; dc <= 6; dc++) {
      const c = pc + dc, r = pr + dr;
      if (lensOn(c, r) && rnd('hidden', c, r) < 0.16) put(ctx, P, c, r, { g: (amb + c) % 9 === 0 ? 'star' : 'dot', fg: 'veil' });
    }
  }

  function render(ctx, step, theme, { calm = false } = {}) {
    const P = PALETTES[theme];
    const amb = calm ? 0 : step;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, W, H);
    for (const b of MAIN) placeMain(b, amb);
    for (const b of state.born) placeBorn(b, step);
    drawStars(ctx, P, amb);
    drawLensStars(ctx, P, amb);
    drawThreads(ctx, P, amb);
    for (const g of GHOSTS) drawBubble(ctx, P, g, step, amb);
    for (const b of MAIN) drawBubble(ctx, P, b, step, amb);
    for (const b of state.born) {
      drawBubble(ctx, P, b, step, amb);
      const popping = step - b.born - b.life;
      if (popping >= 0) {
        // It pops into a ring of sparks.
        const [cc, cr] = cellOf(b.x, b.y);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU, d = b.R * (0.8 + popping * 0.15);
          put(ctx, P, cc + Math.round((Math.cos(a) * d) / 16), cr + Math.round((Math.sin(a) * d) / 24), { g: popping < 2 ? 'star' : 'dot', fg: UNIVERSES[b.u].rim[i % 3], alpha: 1 - popping / 5 });
        }
      }
    }
    drawLens(ctx, P, amb);
  }

  SceneKit.register({
    name: 'multiverse', width: W, height: H, fps: FPS, frames: FRAMES, tick: TICK, poster: 40,
    backgrounds: { light: PALETTES.light.paper, dark: PALETTES.dark.paper },
    draw: (ctx, frame, theme) => render(ctx, Math.floor(frame / TICK), theme),
    render, update, hover, click, cursor,
    state,  // for poking at from the console
  });
})();
