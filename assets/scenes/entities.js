// Entities, on the rules page: a small diorama of the five kinds of Entity in
// style-guide order (a Place, a God, a People, an Actor and a Nation), in
// the rules map's palette.
//
// Hovering one frames it, dims the rest, and draws glowing threads to every
// Entity it has a Relationship with. A click makes it act:
//   the Place     erupts, and the lava cools
//   the God       blesses the People with flowers, or smites the ground
//   the People    branch: a band walks off, settles, and turns a new colour
//   the Actor     goes on a Journey into a cave and comes back with treasure
//   the Nation    raises its towers and banners, with fireworks
// Decorative only.

(function () {
  const { TAU, clamp } = SceneKit;
  const { rnd, noise, connector, dirTo, QUD } = GlyphKit;

  const W = 1152, H = 360, FPS = 24, FRAMES = FPS * 12, TICK = 4;
  const COLS = 72, ROWS = 15, GROUND = 11;
  const { put, centre, cellOf, cellPath } = GlyphKit.grid({ cols: COLS, rows: ROWS, ox: 0, oy: 0 });
  const key = (...k) => k.join(',');

  const PALETTES = {
    dark: {
      ...QUD.dark,
      grove: '#11251a', grove2: '#0d1d15', lava: '#3a1508', scorch: '#160e0e',
      stone: '#9aa3b5', marble: '#e6e2f2', prom: '#86a6e0', bolt: '#ffffff', dim: 0.6,
    },
    light: {
      ...QUD.light,
      grove: '#e2ead2', grove2: '#d6e2c3', lava: '#f2c9b4', scorch: '#d8c8c0',
      stone: '#5a6274', marble: '#5f5a78', prom: '#3d5f9a', bolt: '#3b3fb8', dim: 0.6,
    },
  };

  // ---------- The five ----------

  const ENTITIES = [
    { id: 'place', color: 'C', box: [2, 3, 14, 13], anchor: [8, 6] },
    { id: 'god', color: 'W', box: [19, 1, 25, 5], anchor: [22, 3] },
    { id: 'people', color: 'G', box: [29, 8, 41, 13], anchor: [35, 9] },
    { id: 'actor', color: 'R', box: [45, 8, 52, 12], anchor: [49, 10] },
    { id: 'nation', color: 'prom', box: [56, 6, 70, 12], anchor: [63, 8] },
  ];
  const byId = Object.fromEntries(ENTITIES.map((e) => [e.id, e]));
  const LINKS = [['place', 'people'], ['place', 'god'], ['god', 'people'], ['god', 'actor'], ['actor', 'nation'], ['people', 'nation']];
  const related = (id) => LINKS.filter((l) => l.includes(id)).map((l) => (l[0] === id ? l[1] : l[0]));
  const inBox = (c, r, [x0, y0, x1, y1], pad = 0) => c >= x0 - pad && c <= x1 + pad && r >= y0 - pad && r <= y1 + pad;

  // The Place: a massif over a lake. Rows of [first col, last col].
  const PEAK = [8, 4];
  const MASSIF = [[5, 7, 9], [6, 6, 10], [7, 5, 11], [8, 4, 12]];
  const LAKE = [[12, 3, 13], [13, 4, 12]];
  const CAVE = [54, GROUND];
  const HUTS = [[30, 10], [32, 10], [35, 10], [37, 10], [40, 10], [33, 9], [38, 9]];
  const FOLK = [[31, 'Y'], [34, 'G'], [36, 'Y'], [39, 'w'], [41, 'G']];
  const CLOUDS = [[4, 1], [28, 3], [46, 2], [66, 1]];

  // ---------- State ----------

  const state = { step: 0, hover: null, hoverSince: 0, acts: {}, godMode: 0, branches: [] };

  function update(step) {
    state.step = step;
    for (const [id, a] of Object.entries(state.acts)) if (step - a.born > a.life) delete state.acts[id];
    for (const b of state.branches) {
      const walked = Math.floor((step - b.born) / 2);
      b.at = b.home + b.dir * Math.min(walked, Math.abs(b.to - b.home));
      b.settled = b.at === b.to;
    }
  }

  const hit = (x, y) => {
    const [c, r] = cellOf(x, y);
    return ENTITIES.find((e) => inBox(c, r, e.box, 1)) || null;
  };
  function hover(x, y) {
    const e = x === null ? null : hit(x, y);
    if (e?.id !== state.hover?.id) state.hoverSince = state.step;
    state.hover = e;
  }
  function click(x, y) {
    const e = hit(x, y), step = state.step;
    if (!e) return;
    if (e.id === 'people') {
      // A band leaves to found a new People, left first, then right.
      const dir = state.branches.some((b) => b.dir < 0) ? 1 : -1;
      if (state.branches.some((b) => b.dir === dir)) return;
      state.branches.push({ dir, home: 35 + dir * 3, to: dir < 0 ? 26 : 43, born: step, at: 35 });
      return;
    }
    if (state.acts[e.id]) return;
    const LIFE = { place: 44, god: 30, actor: 32, nation: 36 };
    state.acts[e.id] = { born: step, life: LIFE[e.id] };
    if (e.id === 'god') state.acts.god.mode = state.godMode++ % 2 ? 'smite' : 'bless';
  }
  const cursor = () => (state.hover ? 'pointer' : '');

  // ---------- Drawing ----------

  const edge = noise('edge', 2);
  const groundAt = (c, r) => {
    // The ground frays at the strip's ends.
    const fray = Math.min(c, COLS - 1 - c) + (edge(c, r) - 0.5) * 3;
    return r >= GROUND && fray > 1;
  };

  function drawWorld(ctx, P, step) {
    for (const [c0, r] of CLOUDS) {
      const c = ((c0 + Math.floor(step / 12)) % (COLS + 6)) - 3;
      for (const dc of [0, 1, 2]) put(ctx, P, c + dc, r, { g: 'cloud', fg: 'y', alpha: 0.35 });
    }
    for (let r = GROUND; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!groundAt(c, r)) continue;
      const q = rnd('g', c, r);
      put(ctx, P, c, r, { bg: q < 0.5 ? 'grove' : 'grove2', g: q < 0.2 ? 'grass' : q < 0.25 ? 'dot' : null, fg: q < 0.2 ? 'g' : 'w' });
    }
    // A road that ties them all together.
    for (let c = 14; c <= 56; c++) put(ctx, P, c, GROUND + 1, { bg: 'grove', g: 'dot', fg: 'w' });
    // The Place: a massif over a lake, with pines on its slopes.
    put(ctx, P, ...PEAK, { g: 'mountain', fg: 'stone', dt: 'Y' });
    for (const [r, c0, c1] of MASSIF) for (let c = c0; c <= c1; c++) {
      const q = rnd('m', c, r);
      put(ctx, P, c, r, r === 8 && (c === c0 || c === c1) ? { g: 'hill', fg: 'stone' } : { g: 'mountain', fg: 'stone', dt: r <= 6 ? 'Y' : 'stone' });
      if (r === 8 && q < 0.3) put(ctx, P, c, r + 1, { g: 'fir', fg: 'G', dt: 'w' });
    }
    for (let c = 3; c <= 13; c++) put(ctx, P, c, 9, { g: rnd('p', c) < 0.6 ? 'fir' : 'hill', fg: rnd('p', c) < 0.6 ? 'G' : 'g', dt: 'w' });
    for (let c = 2; c <= 14; c++) put(ctx, P, c, 10, { g: rnd('h', c) < 0.5 ? 'club' : 'grass', fg: 'G', dt: 'w' });
    for (const [r, c0, c1] of LAKE) for (let c = c0; c <= c1; c++) put(ctx, P, c, r, { bg: 'grove', g: (c + r + Math.floor(step / 3)) % 3 ? 'approx' : 'tilde', fg: 'B' });
    // The God, in glory over a shrine.
    const glow = 0.5 + 0.5 * Math.sin(step / 3);
    // Rays that twinkle round the god, alternating.
    [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].forEach(([dc, dr], i) => {
      if ((i + step) % 2 === 0) put(ctx, P, 22 + dc, 3 + dr, { g: i % 4 ? 'dot' : 'star', fg: 'W', alpha: 0.5 + 0.4 * glow });
    });
    put(ctx, P, 22, 3, { bg: 'O', alpha: 0.3 + 0.2 * glow });
    put(ctx, P, 22, 3, { g: 'god', fg: 'W', dt: 'O' });
    put(ctx, P, 22, 10, { g: 'pyramid', fg: 'marble', dt: 'W' });
    put(ctx, P, 22, 9, { g: 'flame', fg: 'o', dt: 'W' });
    // The People: a village with its fields.
    for (const [c, r] of HUTS) put(ctx, P, c, r, { g: 'hut', fg: r === 9 ? 'w' : 'R', dt: 'w' });
    for (let c = 29; c <= 41; c++) put(ctx, P, c, GROUND + 2, { bg: 'grove', g: rnd('f', c) < 0.75 ? 'grass' : null, fg: 'W' });
    FOLK.forEach(([c, fg], i) => put(ctx, P, c + ((step + i * 3) % 8 < 2 ? (i % 2 ? 1 : -1) : 0), GROUND, { bg: 'grove', g: 'walker', fg, dt: 'w' }));
    // The Actor: a hero's camp, and the cave of their Journey.
    put(ctx, P, 47, 10, { g: 'tent', fg: 'R', dt: 'R' });
    put(ctx, P, 50, 10, { g: 'flag', fg: 'w', dt: 'R' });
    put(ctx, P, 48, GROUND, { bg: 'grove', g: 'flame', fg: step % 2 ? 'o' : 'R', dt: 'W' });
    for (const c of [53, 55]) put(ctx, P, c, 10, { g: 'hill', fg: 'stone' });
    put(ctx, P, 54, 10, { g: 'mountain', fg: 'stone', dt: 'stone' });
    put(ctx, P, ...CAVE, { bg: 'grove', g: 'burrow', fg: 'stone', dt: 'K' });
    // The Nation: a walled city round a keep.
    for (let c = 57; c <= 70; c++) put(ctx, P, c, GROUND, { bg: 'grove', g: c === 63 ? 'dot' : 'brick', fg: 'stone' });
    for (const c of [57, 70]) { put(ctx, P, c, 10, { g: 'tower', fg: 'stone', dt: 'O' }); put(ctx, P, c, 9, { g: 'tower', fg: 'stone', dt: 'O' }); }
    for (const c of [59, 60, 61, 65, 66, 68]) put(ctx, P, c, 10, { g: 'hut', fg: c % 2 ? 'R' : 'w', dt: 'w' });
    put(ctx, P, 63, 10, { g: 'tower', fg: 'marble', dt: 'O' });
    put(ctx, P, 63, 9, { g: 'tower', fg: 'marble', dt: 'O' });
    put(ctx, P, 63, 8, { g: 'castle', fg: 'marble', dt: 'prom' });
    put(ctx, P, 63, 7, { g: 'flag', fg: 'w', dt: 'prom' });
  }

  function drawHero(ctx, P, step) {
    const a = state.acts.actor, age = a ? step - a.born : -1;
    // Out to the cave, a fight inside, back with the prize.
    let c = 49, hidden = false, prize = false;
    if (age >= 0 && age < 5) c = 49 + age;
    else if (age >= 5 && age < 13) {
      hidden = true;
      put(ctx, P, CAVE[0], CAVE[1] - 1, { g: age % 2 ? 'star' : 'dot', fg: age % 2 ? 'R' : 'W' });
    } else if (age >= 13 && age < 18) { c = 53 - (age - 13); prize = true; }
    else if (age >= 18) prize = true;
    if (!hidden) put(ctx, P, c, GROUND, { bg: 'grove', g: 'walker', fg: 'Y', dt: 'R', flip: age >= 13 && age < 18 });
    if (prize && !hidden) {
      put(ctx, P, c, GROUND - 1, { bg: 'O', alpha: 0.25 });
      put(ctx, P, c, GROUND - 1, { g: step % 2 ? 'star' : 'dot', fg: 'W' });
    }
  }

  function drawActs(ctx, P, step) {
    const place = state.acts.place;
    if (place) {
      const a = step - place.born;
      const [px, py] = PEAK;
      if (a < 4) put(ctx, P, px, py, { bg: 'R', alpha: 0.3 });
      else if (a < 22) {
        put(ctx, P, px, py, { bg: 'lava', g: 'volcano', fg: 'r', dt: a % 2 ? 'O' : 'R' });
        for (let up = 1; up <= Math.min(a - 3, 3); up++) put(ctx, P, px, py - up, { g: up === 3 ? 'shade2' : 'flame', fg: up === 3 ? 'y' : 'R', dt: 'W' });
        for (let i = 1; i <= Math.min(a - 4, 5); i++) for (const s of [-1, 1]) put(ctx, P, px + s * i, py + i, { bg: 'lava', g: 'tilde', fg: (a + i) % 2 ? 'R' : 'o' });
        if (a > 10) for (let c = 4; c <= 12; c++) put(ctx, P, c, GROUND, { g: 'shade1', fg: 'Y', alpha: 0.6 });
      } else {
        const k = 1 - (a - 22) / 22;
        for (let i = 1; i <= 5; i++) for (const s of [-1, 1]) put(ctx, P, px + s * i, py + i, { bg: 'lava', g: 'shade1', fg: 'r', alpha: k });
      }
    }
    const god = state.acts.god;
    if (god) {
      const a = step - god.born;
      if (god.mode === 'bless') {
        if (a < 6) for (const [c, r] of cellPath([centre(22, 5), centre(35, 8)])) put(ctx, P, c, r, { g: 'vdash', fg: 'W', alpha: 0.9 - a * 0.12 });
        const reach = Math.min(a, 6), fade = a > 22 ? 1 - (a - 22) / 8 : 1;
        for (let c = 29; c <= 41; c++) for (const r of [GROUND + 2, GROUND + 3]) {
          if (Math.abs(c - 35) <= reach && rnd('bloom', c, r) < 0.6) put(ctx, P, c, r, { g: 'flower', fg: ['M', 'W', 'R'][Math.floor(rnd('petal', c, r) * 3)], dt: 'W', alpha: fade });
        }
      } else {
        if (a === 0) { ctx.fillStyle = P.bolt; ctx.globalAlpha = 0.12; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
        if (a < 3) {
          // A jagged bolt from the God to the ground.
          let prev = [22, 5];
          const cells = [prev];
          for (let r = 6; r <= GROUND; r++) {
            const c = clamp(prev[0] + Math.round((rnd('bolt', god.born, a, r) - 0.3) * 2), 22, 28);
            cells.push([c, r]);
            prev = [c, r];
          }
          cells.forEach(([c, r], i) => {
            const dirs = [cells[i - 1], cells[i + 1]].filter(Boolean).map(([c2, r2]) => dirTo(c2 - c, r2 - r));
            put(ctx, P, c, r, { g: connector(dirs, 4), fg: 'bolt', alpha: a === 2 ? 0.5 : 1 });
          });
          god.hitAt = prev;
        }
        if (god.hitAt) for (const [dc, dr] of [[0, 0], [-1, 0], [1, 0], [0, 1]]) {
          put(ctx, P, god.hitAt[0] + dc, god.hitAt[1] + dr, { bg: 'scorch', g: a < 8 ? 'shade2' : 'shade1', fg: a < 8 ? (step % 2 ? 'R' : 'o') : 'r', alpha: clamp(1 - (a - 14) / 16) });
        }
      }
    }
    const nation = state.acts.nation;
    if (nation) {
      const a = step - nation.born;
      if (a >= 2) for (const c of [57, 70]) put(ctx, P, c, 8, { g: 'tower', fg: 'stone', dt: 'O' });
      if (a >= 4) for (const c of [57, 70]) put(ctx, P, c, 7, { g: 'flag', fg: 'w', dt: 'prom' });
      if (a >= 5) put(ctx, P, 63, 6, { g: 'flag', fg: 'w', dt: step % 2 ? 'prom' : 'W' });
      for (let k = 0; k < 5; k++) {
        const t = a - 6 - k * 3;
        if (t < 0 || t > 6) continue;
        const cx = 59 + ((k * 4) % 10), cy = 2 + (k % 3), fg = ['prom', 'W', 'M', 'C', 'R'][k];
        if (t < 2) put(ctx, P, cx, cy + 2 - t, { g: 'dot', fg: 'W' });
        else for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) put(ctx, P, cx + dc * (t > 3 ? 2 : 1), cy + dr, { g: t < 4 ? 'star' : 'dot', fg, alpha: 1 - (t - 2) / 5 });
      }
    }
    // Bands of the People who left, and the homes they made.
    for (const b of state.branches) {
      if (b.settled) put(ctx, P, b.to, GROUND - 1, { g: 'tent', fg: 'm', dt: 'M' });
      const spots = b.settled ? [b.to - 1, b.to + 1] : [b.at, b.at - b.dir];
      spots.forEach((c, i) => put(ctx, P, c, GROUND, {
        bg: 'grove', g: 'walker', fg: b.settled ? (i ? 'M' : 'm') : (i ? 'Y' : 'G'), dt: b.settled ? 'm' : 'w', flip: !b.settled && b.dir < 0,
      }));
    }
  }

  // Hovering: the Entity framed, the rest dimmed, threads to its Relationships.
  function drawFocus(ctx, P, step) {
    const e = state.hover;
    if (!e) return;
    const rel = related(e.id).map((id) => byId[id]);
    const keep = (c, r) => inBox(c, r, e.box) || rel.some((o) => inBox(c, r, o.box));
    ctx.fillStyle = P.paper;
    ctx.globalAlpha = P.dim;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!keep(c, r)) ctx.fillRect(c * 16, r * 24, 16, 24);
    ctx.globalAlpha = 1;
    const grown = (step - state.hoverSince) * 3;
    for (const o of rel) {
      const [x0, y0] = centre(...e.anchor), [x1, y1] = centre(...o.anchor);
      const lift = Math.min(y0, y1) - 70 - Math.abs(x1 - x0) * 0.08;
      const pts = Array.from({ length: 25 }, (_, i) => {
        const u = i / 24;
        return [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * ((x0 + x1) / 2) + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * Math.max(12, lift) + u * u * y1];
      });
      const path = cellPath(pts).filter(([c, r]) => !inBox(c, r, e.box) && !inBox(c, r, o.box));
      path.forEach(([c, r], i) => { if (i <= grown && i % 2 === 0) put(ctx, P, c, r, { g: 'dot', fg: e.color }); });
      if (grown >= path.length && path.length) put(ctx, P, ...path[Math.floor(step * 1.5) % path.length], { g: 'star', fg: e.color });
    }
    const [x0, y0, x1, y1] = e.box;
    put(ctx, P, x0 - 1, y0 - 1, { g: 'brTL', fg: e.color });
    put(ctx, P, x1 + 1, y0 - 1, { g: 'brTR', fg: e.color });
    put(ctx, P, x0 - 1, y1 + 1, { g: 'brBL', fg: e.color });
    put(ctx, P, x1 + 1, y1 + 1, { g: 'brBR', fg: e.color });
  }

  function render(ctx, step, theme, { calm = false } = {}) {
    const P = PALETTES[theme];
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, W, H);
    const s = calm ? 0 : step;
    drawWorld(ctx, P, s);
    drawHero(ctx, P, step);
    drawActs(ctx, P, step);
    drawFocus(ctx, P, step);
  }

  SceneKit.register({
    name: 'entities', width: W, height: H, fps: FPS, frames: FRAMES, tick: TICK, poster: 40,
    backgrounds: { light: PALETTES.light.paper, dark: PALETTES.dark.paper },
    draw: (ctx, frame, theme) => render(ctx, Math.floor(frame / TICK), theme),
    render, update, hover, click, cursor, state,
  });
})();
