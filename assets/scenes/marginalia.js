// Margin drolleries, for the rules page: small, odd figures in the right
// margin beside the sections they illustrate, like the creatures in the
// margins of a medieval manuscript. Each is its own tiny live scene
// (data-scene="m-<name>") on a transparent background, in four inks: black,
// vermilion, lapis and gold, and the gold catches a slow glint. A hover gets
// one small reaction and a click one small gag, and each figure starts over
// when it scrolls out of view. The cast is listed in the "Margin Drolleries"
// doc. Decorative only.
//
//   m-places     a mango tree that shakes and drops golden mangos, which pile
//                up below
//   m-gods       a floating hand with an eye in its palm that follows you, and
//                rolls back to work a miracle
//   m-peoples    three gnomes who watch you and shuffle places
//   m-actors     a knight riding a snail, who tucks their helm under an arm:
//                another snail
//   m-nations    a flag the wind snaps out; lightning burns it, a new one rises
//   m-qualities  a portrait whose eyes follow you, repainted at a click: the
//                Wise king, the Holy saint, the Cruel tyrant, the Fallen
//   m-naming     a swaddled baby asleep on a cushion, who bursts out of the
//                swaddle crying at a hover; at a click the swaddle flies
//                back round it like a magic carpet
//   m-journey    a pilgrim who walks off and comes back with a souvenir
//   m-narration  a fortune-teller whose fire smokes out pictures
//   m-card       a face-down card that peeks, and flips to a random suit
//   m-legacy     a statue that crumbles under a pigeon, then rises as one

(function () {
  const { TAU, clamp, lerp, smooth } = SceneKit;
  const { QUD } = GlyphKit;
  const R = (...k) => GlyphKit.rnd(...k);

  // A sprite pixel is 4 canvas pixels square, so the 320-pixel canvas of a
  // figure 80 sprite pixels wide shows at 160px with each pixel 2 CSS pixels.
  const S = 4, W = 80, FPS = 24;

  // '#' ink, 'r' vermilion, 'b' lapis, 'g' gold, 'v' verdigris green (leaves),
  // 'w' white (eyes, card faces), 'f' faint ink (stone, smoke, shadow),
  // 'flash' for miracles, 'o' mango gold, and for the Era mascots 'm'
  // maroon, 'p' flesh, 'k', a black that stays dark on dark paper, 'e', an
  // edge for it, and 'n', the bronze-grey sheen of the cormorant's feathers.
  // On dark paper the ink is a slate grey rather than a pale one, so lines
  // read as drawn in dark ink there too, kept at 3:1 against the paper; every
  // other ink is at least that, except 'k', which is always edged in ink.
  const INKS = {
    dark: { '#': '#5d6779', faint: '#e6dfcf', r: QUD.dark.R, b: QUD.dark.B, g: '#b8864e', v: QUD.dark.g, m: '#a9493a', p: '#e89a80', k: '#433a31', o: '#eeb041', e: '#5d6779', n: '#9a958a', w: '#fffaf0', glint: '#e6bf85', flash: '#ffffff', paper: QUD.dark.paper },
    light: { '#': QUD.light.Y, faint: QUD.light.Y, r: QUD.light.R, b: QUD.light.B, g: '#9a6a2c', v: QUD.light.g, m: '#7d2c1e', p: '#e0937a', k: QUD.light.Y, o: '#d8941e', e: QUD.light.Y, n: '#8d8371', w: '#fffdf8', glint: '#cf9d55', flash: '#ffffff', paper: QUD.light.paper },
  };
  const FAINT = 0.38;
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };

  // Sprites are written as text, one character a pixel, '.' for nothing.
  const art = (s) => {
    const rows = s.trim().split('\n').map((r) => r.trim());
    const n = Math.max(...rows.map((r) => r.length));
    return rows.map((r) => r.padEnd(n, '.'));
  };
  const size = (a) => [a[0].length, a.length];

  // Every figure is drawn at the same pixel size, so they sit together on
  // the page as one set.
  function painter(ctx, theme, step, calm) {
    const K = S, cx = (x) => x * K, cy = (y) => y * K;
    const I = INKS[theme];
    // A diagonal glint that crosses the gold every eight seconds or so.
    const sweep = calm ? -99 : (step % 200) - 30;
    let buf = null, grey = false;

    function px(x, y, ink, alpha = 1) {
      x = Math.round(x); y = Math.round(y);
      if (buf) { buf.push([x, y, ink, alpha]); return; }
      let a = alpha, c;
      if (ink === 'f' || grey) { c = I.faint; a *= FAINT; }
      else if (ink === 'g' && x + y - sweep >= 0 && x + y - sweep < 2) c = I.glint;
      else c = I[ink] || ink;
      if (a <= 0) return;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = c;
      ctx.fillRect(cx(x), cy(y), K, K);
    }
    function sprite(rows, x, y, { flip = false, alpha = 1, map = null } = {}) {
      for (let j = 0; j < rows.length; j++) {
        const row = rows[j], n = row.length;
        for (let i = 0; i < n; i++) {
          let ch = row[flip ? n - 1 - i : i];
          if (ch === '.') continue;
          if (map && ch in map) ch = map[ch];
          if (ch) px(x + i, y + j, ch, alpha);
        }
      }
    }
    function line(x0, y0, x1, y1, ink, alpha = 1, every = 1) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, i = 0;
      for (;;) {
        if (i++ % every === 0) px(x0, y0, ink, alpha);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    // A region filled with one ink and edged with another.
    function region(inside, [x0, y0, x1, y1], fill, edge) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!inside(x, y)) continue;
        const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        px(x, y, rim ? edge : fill);
      }
    }
    function glow(x, y, r, ink, alpha) {
      if (alpha <= 0) return;
      const g = ctx.createRadialGradient(cx(x), cy(y), 0, cx(x), cy(y), r * K);
      g.addColorStop(0, rgba(I[ink], alpha));
      g.addColorStop(1, rgba(I[ink], 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(cx(x - r), cy(y - r), 2 * r * K, 2 * r * K);
    }
    // Draw into a list instead, to turn a group of pixels at once.
    function capture(fn) {
      const was = buf;
      buf = [];
      fn();
      const out = buf;
      buf = was;
      return out;
    }
    function turn(list, cx, cy, th) {
      if (!th) { for (const q of list) px(...q); return; }
      const at = new Map(list.map((q) => [q[0] + ',' + q[1], q]));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of list) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const c = Math.cos(th), s = Math.sin(th);
      for (let y = y0 - 3; y <= y1 + 3; y++) for (let x = x0 - 3; x <= x1 + 3; x++) {
        const dx = x - cx, dy = y - cy;
        const q = at.get(Math.round(cx + dx * c + dy * s) + ',' + Math.round(cy - dx * s + dy * c));
        if (q) px(x, y, q[2], q[3]);
      }
    }
    // While on, everything is drawn in faint ink.
    const greyed = (on) => { grey = on; };
    return { I, px, sprite, line, region, glow, capture, turn, greyed };
  }

  // The ruled line a figure stands on, ending in a gold ivy leaf.
  const IVY = art(`
    ..g.
    .ggg
    gggg
    .gg.
  `);
  // Where there's no margin the page sets the figures beside their headings
  // and rules the heading instead (margins-inline, set by site.js).
  function rule(p, x0, x1, y) {
    if (document.documentElement.classList.contains('margins-inline')) return;
    for (let x = x0; x <= x1; x++) p.px(x, y, 'f');
    p.sprite(IVY, x1 + 1, y - 2);
  }

  // Each figure keeps its own state, made fresh by make() and again whenever
  // it scrolls away. Times are in steps, 24 a second.
  // `span` is [x0, y0, x1, y1], the box everything it draws stays inside,
  // with its ruled line along the bottom, for cropping it where it sits
  // beside its heading.
  function drollery(name, d) {
    const at = (x, y) => [x / S, y / S];
    let st = d.make(), now = 0, pointer = null;
    const scene = {
      name: 'm-' + name, width: W * S, height: d.h * S, fps: FPS, frames: FPS * 8,
      backgrounds: { light: INKS.light.paper, dark: INKS.dark.paper },
      render(ctx, step, theme, { calm = false } = {}) {
        ctx.imageSmoothingEnabled = false;
        d.draw(painter(ctx, theme, step, calm), st, { step, calm, pointer });
        ctx.globalAlpha = 1;
      },
      draw(ctx, frame, theme) { scene.render(ctx, frame, theme); },
      update(step) { now = step; d.update?.(st, step, pointer); },
      hover(x, y) {
        const was = pointer;
        pointer = x === null ? null : at(x, y);
        if (!was && pointer) d.enter?.(st, now);
        if (was && !pointer) d.leave?.(st, now);
      },
      click(x, y) { d.click?.(st, now, at(x, y)); },
      cursor: () => 'pointer',
      touchHover: true,
      // The box everything in the figure stays inside, for cropping it.
      span: d.span,
      reset() { st = d.make(); pointer = null; },
      get state() { return st; },
    };
    SceneKit.register(scene);
  }

  // For the Era mascots in mascots.js, which are made the same way.
  window.Margins = { drollery, art, size, rule, R, W, INKS };

  // ---------- Places: a mango tree ----------

  {
    const BASE = 58, TRUNK = 30;
    const LOBES = [[30, 20, 10], [21, 27, 8], [39, 27, 8], [30, 30, 8], [24, 17, 6.5], [36, 17, 6.5]];
    const inCanopy = (x, y) => LOBES.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r);
    const CANOPY = [];
    for (let y = 6; y < 40; y++) for (let x = 10; x < 52; x++) {
      if (!inCanopy(x, y)) continue;
      const edge = !inCanopy(x - 1, y) || !inCanopy(x + 1, y) || !inCanopy(x, y - 1) || !inCanopy(x, y + 1);
      if (edge && R('ragged', x, y) < 0.3) continue;
      if (!edge && R('leaf', x, y) < 0.04) continue;  // gaps between the leaves
      CANOPY.push([x, y, edge]);
    }
    // Golden mangos hang on stalks from the underside and the sides of the
    // canopy, each with a shine (G) and a blush.
    const SPOTS = [[16, 33], [42, 33], [24, 37], [34, 37], [11, 25], [46, 24]];
    const APPLE = art(`
      ..#.
      .oo.
      oGoo
      ooor
      .or.
    `);
    // Where fallen apples come to rest, outward from the trunk, a second row
    // on top once there are two to sit on.
    const PILE = {};
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? TRUNK - 7 : TRUNK + 5;
      PILE[side] = [];
      for (let k = 0; k < 6; k++) {
        PILE[side].push([x0 + side * 4 * k, BASE - 5]);
        if (k > 0) PILE[side].push([x0 + side * (4 * k - 2), BASE - 8]);
      }
    }

    drollery('places', {
      span: [2, 10, 60, 58],
      h: 64,
      make: () => ({ tree: SPOTS.map(() => -1), apples: [], claimed: { '-1': 0, 1: 0 }, leaves: [], shakeAt: -99 }),
      update(st, step, pointer) {
        if (st.leaves.length < 14 && R('fall', step) < (pointer ? 0.07 : 0.0025)) {
          const [x, y] = CANOPY[Math.floor(R('which', step) * CANOPY.length)];
          st.leaves.push({ x, y, born: step, land: (BASE - 1 - y) / 0.22 });
        }
        st.leaves = st.leaves.filter((l) => step - l.born < l.land + 70);
        for (const a of st.apples) {
          if (step < a.born || a.done) continue;
          a.vy += 0.3;
          a.y += a.vy;
          if (a.y >= a.sy) {
            a.y = a.sy;
            if (!a.bounced && a.vy > 2) { a.vy = -a.vy * 0.3; a.bounced = true; }
            else { a.done = true; a.at = step; }
          }
          const k = a.bounced ? 1 : clamp((a.y - a.y0) / (a.sy - a.y0));
          a.x = lerp(a.x0, a.sx, k);
        }
        st.apples = st.apples.filter((a) => a.slot || !a.done || step - a.at < 24);
      },
      click(st, step) {
        st.shakeAt = step;
        const ready = st.tree.map((back, i) => (step >= back ? i : -1)).filter((i) => i >= 0);
        if (!ready.length) return;
        const i = ready[Math.floor(R('pick', step) * ready.length)];
        st.tree[i] = step + 150;
        const [x0, y0] = SPOTS[i];
        const side = x0 + 1 < TRUNK ? -1 : 1;
        const slot = PILE[side][st.claimed[side]++];
        st.apples.push({ x0, y0, x: x0, y: y0, vy: 0, side, slot, sx: slot ? slot[0] : x0, sy: slot ? slot[1] : BASE - 5, born: step + 3 });
      },
      draw(p, st, { step, calm, pointer }) {
        const shake = step - st.shakeAt;
        const sway = (y) => {
          const w = (BASE - y) / 40;
          if (shake < 16) return Math.round(Math.sin(shake * 1.9) * 2.4 * w * (1 - shake / 18));
          return pointer && !calm ? Math.round(Math.sin(step * 0.55) * 0.9 * w) : 0;
        };
        rule(p, 4, 66, BASE);
        for (let y = 34; y < BASE; y++) {
          const half = y >= BASE - 1 ? 3 : y >= BASE - 3 ? 2 : 1;
          for (let x = TRUNK - half; x <= TRUNK + half; x++) p.px(x, y, '#');
        }
        const rustle = pointer && !calm;
        // Each apple on the tree sits in a little clearing of leaves.
        const hung = SPOTS.filter((_, i) => step >= st.tree[i] - 36);
        for (const [x, y, edge] of CANOPY) {
          if (edge && rustle && R('rustle', x, y, step >> 2) < 0.35) continue;
          if (hung.some(([ax, ay]) => x >= ax - 1 && x <= ax + 4 && y >= ay && y <= ay + 5)) continue;
          p.px(x + sway(y), y, 'v');
        }
        st.tree.forEach((back, i) => {
          const [x, y] = SPOTS[i];
          if (step >= back) {
            p.line(x + 2 + sway(y - 2), y - 2, x + 2 + sway(y), y, '#');
            p.sprite(APPLE, x + sway(y + 2), y, { map: { G: 'glint' } });
          } else if (step >= back - 36) p.px(x + 1 + sway(y + 2), y + 2, 'o');
        });
        // An apple with no room left on the pile fades where it lands.
        for (const a of st.apples) if (step >= a.born) p.sprite(APPLE, Math.round(a.x), Math.round(a.y), { alpha: a.slot || !a.done ? 1 : 1 - (step - a.at) / 24, map: { G: 'glint' } });
        for (const l of st.leaves) {
          const age = step - l.born, t = Math.min(age, l.land);
          const x = l.x + Math.sin(t * 0.12 + l.x) * 2.5, y = l.y + t * 0.22;
          const alpha = clamp(1 - (age - l.land) / 70);
          p.px(x, y, 'v', alpha);
          if (age < l.land && (age >> 3) % 2) p.px(x + 1, y - 1, 'v', alpha);
          else p.px(x + 1, y, 'v', alpha);
        }
      },
    });
  }

  // ---------- Gods: a hand with an eye in its palm ----------

  {
    const HAND = art(`
      ........................
      ...........##...........
      ..........#gg#..........
      ..........#gg#.##.......
      .......##.#gg##gg#......
      ......#gg##gg##gg#......
      ......#gg##gg##gg#......
      ......#gg##gg##gg#.##...
      ......#gg##gg##gg##gg#..
      ......#gg##gg##gg##gg#..
      ......#gg##gg##gg##gg#..
      ......#gg##gg##gg##gg#..
      .##...#gg##gg##gg##gg#..
      #gg#..#gggggggggggggg#..
      #gg#..#gggggggggggggg#..
      #ggg#.#gggggggggggggg#..
      .#gg#.#gggggggggggggg#..
      .#ggg##gggggggggggggg#..
      ..#gggggggggggggggggg#..
      ..#gggggggggggggggggg#..
      ...#ggggggggggggggggg#..
      ...#ggggggggggggggggg#..
      ....#gggggggggggggggg#..
      .....#ggggggggggggggg#..
      ......#gggggggggggggg#..
      ......#gggggggggggggg#..
      ......#gggggggggggggg#..
      .......#gggggggggggg#...
      ........#gggggggggg#....
      ........#gggggggggg#....
      .......##############...
      .......#bbbbbbbbbbbb#...
      .......#gggggggggggg#...
      .......##############...
    `);
    const EYE = art(`
      ...###...
      .##www##.
      #wwwwwww#
      #wwwwwww#
      #wwwwwww#
      .##www##.
      ...###...
    `);
    const EX = 9, EY = 17, CX = 13, CY = 20;  // the eye within the hand, and its centre
    const LIDS = [null, { 1: 'g', 2: '#' }, { 1: 'g', 2: 'g', 3: '#', 4: 'g', 5: 'g' }];
    const CAST = 50, REACH = 26;

    drollery('gods', {
      span: [14, 2, 69, 60],
      h: 64,
      make: () => ({ blinkAt: 40, castAt: -999 }),
      update(st, step) {
        if (step > st.blinkAt + 6) st.blinkAt = step + 70 + Math.floor(R('blink', step) * 110);
      },
      click(st, step) { if (step - st.castAt > CAST) st.castAt = step; },
      draw(p, st, { step, calm, pointer }) {
        const a = step - st.castAt, casting = a >= 0 && a < CAST;
        const bob = calm ? 0 : Math.round(Math.sin((step / 84) * TAU) * 2);
        const lift = casting ? Math.round(2 * smooth(clamp(a / 8)) * (1 - smooth(clamp((a - 34) / 12)))) : 0;
        const tremble = casting && a > 3 && a < 26 ? (step % 2 ? 1 : -1) : 0;
        const hx = 28 + tremble, hy = 12 + bob - lift;
        const cx = hx + CX, cy = hy + CY;
        const burst = casting && a >= 8 && a < 38 ? a - 8 : -1;

        // The miracle behind the hand: a halo, rays and rings going out, all
        // inside REACH of the eye so nothing meets the frame.
        if (burst >= 0) {
          const k = 1 - burst / 30;
          p.glow(cx, cy, REACH, 'g', 0.45 * k);
          for (let i = 0; i < 16; i++) {
            if ((i + (step >> 1)) % 4 === 0) continue;
            const th = (i / 16) * TAU + 0.13, len = Math.min(4 + burst * 3, i % 2 ? 7 : 11);
            for (let r = 15; r < 15 + len; r += burst < 12 ? 1 : 2) p.px(cx + Math.cos(th) * r, cy + Math.sin(th) * r, i % 2 ? 'r' : 'g', k + 0.3);
          }
          for (const [ring, ink] of [[12 + burst, 'b'], [7 + burst, 'g']]) {
            if (ring < 12 || ring > REACH) continue;
            for (let i = 0; i < 90; i++) {
              const th = (i / 90) * TAU;
              p.px(cx + Math.cos(th) * ring, cy + Math.sin(th) * ring * 0.8, ink, k * clamp((REACH - ring) / 4));
            }
          }
        }
        // Its shadow on the line, smaller as it rises.
        const sw = 8 - bob - lift * 2;
        for (let x = -sw; x <= sw; x++) p.px(cx + x, 58, 'f', Math.abs(x) > sw - 2 ? 0.5 : 1);
        rule(p, 6, 70, 60);

        const burning = burst >= 0 && burst < 16 && (burst < 8 || step % 2 === 0);
        p.sprite(HAND, hx, hy, burning ? { map: { '#': 'r' } } : {});

        // The eye: lids for blinks, an iris that follows the pointer, rolling
        // back for the miracle.
        let dx = 0, dy = 0, lid = 0;
        if (casting) {
          dy = a < 8 ? -Math.round(a * 0.7) : a < 36 ? -6 : -Math.round(6 - (a - 36) * 0.45);
        } else if (pointer) {
          dx = clamp(Math.round((pointer[0] - cx) / 6), -3, 3);
          dy = clamp(Math.round((pointer[1] - cy) / 8), -2, 2);
        } else if (!calm) {
          dx = Math.round(Math.sin(step / 70) * 1.4);
          const b = step - st.blinkAt;
          if (b >= 0 && b < 6) lid = [1, 2, 2, 2, 1, 0][b];
        }
        const whites = burst >= 0 && burst < 20 ? 'glint' : 'w';
        EYE.forEach((row, j) => [...row].forEach((ch, i) => {
          if (ch === '.') return;
          let ink = ch === 'w' ? whites : '#';
          if (ch === 'w' && LIDS[lid] && LIDS[lid][j]) ink = LIDS[lid][j];
          else if (ch === 'w' && Math.abs(i - (4 + dx)) <= 1 && Math.abs(j - (3 + dy)) <= 1) ink = i === 4 + dx && j === 3 + dy ? '#' : 'b';
          p.px(hx + EX + i, hy + EY + j, ink);
        }));

        // Sparks thrown off.
        if (burst >= 0) for (let i = 0; i < 10; i++) {
          const th = R('spark', st.castAt, i) * TAU, r = 8 + burst * (0.6 + R('speed', st.castAt, i) * 0.5);
          if (r > REACH - 2) continue;
          const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r, al = (1 - burst / 30) * clamp((REACH - 2 - r) / 5);
          const ink = ['g', 'r', 'b', 'glint'][(i + (step >> 1)) % 4];
          p.px(x, y, ink, al);
          if (burst < 18) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + ox, y + oy, ink, al * 0.7);
        }
      },
    });
  }

  // ---------- Peoples: three gnomes ----------

  {
    const BASE = 46, SLOTS = [18, 40, 62];
    // Each faces right in its art: a tall hat (H), a big nose, a beard, a
    // coat; the third carries a lantern (l).
    const GNOMES = [
      {
        hat: 'r', face: 1,
        art: art(`
          HH..............
          HHH.............
          .HHH............
          .HHHH...........
          ..HHHH..........
          ..HHHHH.........
          ...HHHHH........
          ...HHHHHH.......
          ....HHHHHH......
          ....HHHHHHH.....
          ...HHHHHHHHH....
          ..HHHHHHHHHHH...
          .HHHHHHHHHHHHH..
          HHHHHHHHHHHHHHHH
          ..#pppppp#pp....
          ..#pppppppppppp.
          ..#ffffffppppp..
          ..#fffffffpp....
          ..#ffffffffffff.
          ..##fffffffffff.
          ..###ffffffff...
          ..####fffffff...
          .######fffff....
          #########ff#....
          ############....
          .###########....
          ..##########....
          ..##########....
          ..#########.....
          ..###..###......
          .###....##......
          ####....####....
          ###......###....
        `),
      },
      {
        hat: 'b', face: -1,
        art: art(`
          ........HH........
          .......HHHH.......
          ......HHHHHH......
          .....HHHHHHHH.....
          ....HHHHHHHHHH....
          ...HHHHHHHHHHHH...
          ..HHHHHHHHHHHHHH..
          .HHHHHHHHHHHHHHHH.
          HHHHHHHHHHHHHHHHHH
          ..#ppppppppp#pp...
          ..#pppppppppppppp.
          ..#fffffffffppppp.
          ..##fffffffffpp...
          ..##ffffffffffff..
          .####fffffffffff..
          .#####fffffffff#..
          #######ffffffff##.
          #########ffff####.
          ##################
          ##################
          .################.
          .################.
          ...############...
          ....###.....###...
          ....##......##....
          ..####....####....
          ..###.....###.....
        `),
        // One foot up, tapping.
        tap: art(`
          ....###.....###...
          ....##.....####...
          ..####.....###....
          ..###.............
        `),
      },
      {
        hat: 'g', face: 1,
        art: art(`
          ..HHHH............
          .HHHHHH...........
          HHH..HHH..........
          HH....HH..........
          HH...HHH..........
          HH..HHHH..........
          .HHHHHHH..........
          ..HHHHHHH.........
          ....HHHHH.........
          ....HHHHHHH.......
          ...HHHHHHHH.......
          .HHHHHHHHHHHH.....
          HHHHHHHHHHHHHH....
          HHHHHHHHHHHHHH....
          ..#pppppp#pp......
          ..#pppppppppppp...
          ..#fffffffppppp...
          ..#ffffffffpp.....
          ..#ffffffffffff...
          ..##fffff#######..
          ..###ff#####..##..
          ..#########...##..
          ..#########..####.
          ..########..#llll#
          ..########..#llll#
          ..########...####.
          ..########....##..
          ..########........
          ..###..###........
          .###....###.......
          ####....####......
          ###......###......
        `),
        // The curl at the top of the hat, flopped over.
        tip: art(`
          ..................
          ..................
          ..HHHHH...........
          .HHHHHHH..........
          HH..HHHH..........
          HH...HH...........
        `),
      },
    ];

    drollery('peoples', {
      span: [8, 6, 72, 46],
      h: 52,
      make: () => ({ at: SLOTS.slice(), to: SLOTS.slice(), order: [0, 1, 2], moves: 0 }),
      update(st) {
        st.at = st.at.map((x, i) => (Math.abs(st.to[i] - x) < 1.6 ? st.to[i] : x + Math.sign(st.to[i] - x) * 1.5));
      },
      click(st, step) {
        if (st.at.some((x, i) => x !== st.to[i])) return;
        const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].filter((q) => q.join() !== st.order.join());
        st.order = perms[Math.floor(R('shuffle', step, st.moves++) * perms.length)];
        st.to = st.order.map((s) => SLOTS[s]);
      },
      draw(p, st, { step, calm, pointer }) {
        rule(p, 6, 72, BASE);
        GNOMES.forEach((g, i) => {
          const x = st.at[i], walking = x !== st.to[i];
          let face = g.face;
          if (walking) face = Math.sign(st.to[i] - x);
          else if (pointer) face = pointer[0] >= x ? 1 : -1;
          else if (!calm && R('glance', i, Math.floor(step / 150)) < 0.3) face = -g.face;
          let rows = g.art, y = 0;
          if (walking) y = Math.floor(step / 3) % 2 ? -2 : 0;
          else if (!calm) {
            if (i === 0) { const k = (step + 20) % 110; if (k < 10) y = -Math.round(Math.sin((k / 10) * Math.PI) * 6); }
            if (i === 1 && step % 90 < 30 && (step >> 2) % 2) rows = [...rows.slice(0, -4), ...g.tap];
            if (i === 2 && (step >> 4) % 2) rows = [...g.tip, ...rows.slice(6)];
          }
          const [w, h] = size(rows);
          const lamp = calm || R('lamp', step >> 1) > 0.3 ? 'o' : 'r';
          p.sprite(rows, Math.round(x) - (w >> 1), BASE - h + y, { flip: face < 0, map: { H: g.hat, l: lamp } });
        });
      },
    });
  }

  // ---------- Actors: a knight riding a snail ----------

  {
    const BASE = 50;
    const inShell = (x, y) => (x - 30) ** 2 + (y - 36) ** 2 < 90;
    // The snail's body: a deep foot that tapers to its tail, and a thick
    // neck up to its head. `d` inches it forward.
    const inBody = (d) => (x, y) => {
      if (y >= 44 && y <= 49) {
        if (x >= 18 && x <= 53 + d) return true;
        if (x >= 12 && x < 18) return y >= 49 - (x - 12);
        return x === 54 + d && y >= 45 && y <= 48;
      }
      if (y >= 35 && y < 44) {
        const x0 = 44 + d + (y < 39) + (y === 35), x1 = 53 + d - (y === 35);
        return x >= x0 && x <= x1;
      }
      return false;
    };
    const HELM = art(`
      ..rr....
      .rrr....
      .r####..
      .#ffff#.
      .#ff###.
      .#ffff#.
      ..####..
    `);
    // Sitting astride the shell, the near leg hanging down it to a stirrup.
    const KNIGHT = art(`
      ...######...
      ..########..
      bbbb######..
      bgbb#####...
      bbbb#####...
      .bb.######..
      ...########.
      .........##.
      .........##.
      .........###
    `);
    const SNAILHEAD = art(`
      .####.
      #ffff#
      #ffff#
      #fff#.
      .###..
    `);
    const PENNANT = [art(`
      rrrrr
      .rrr.
      ..r..
    `), art(`
      .rrrr
      rrrrr
      ..rr.
    `)];
    const KX = 23, KY = 14, TUCK = 16;
    // The helm on the knight's head (t = 0) and tucked under their arm (t = 1).
    const HEAD = [KX + 2, KY], ARM = [KX + 6, KY + 8];
    function helmAt(t) {
      if (t < 0.3) return [HEAD[0], HEAD[1] - Math.round((t / 0.3) * 3)];
      const u = smooth((t - 0.3) / 0.7);
      return [Math.round(lerp(HEAD[0], ARM[0], u) + Math.sin(u * Math.PI) * 3), Math.round(lerp(HEAD[1] - 3, ARM[1], u))];
    }

    // An eyestalk from its base, leaning toward the pointer.
    function stalk(p, bx, by, len, pointer, ox) {
      let tx = bx + ox, ty = by - len;
      if (pointer) {
        const vx = pointer[0] - bx, vy = pointer[1] - (by - len), m = Math.hypot(vx, vy) || 1;
        tx = bx + Math.round((vx / m) * 3); ty = by - len + Math.round((vy / m) * 2);
      }
      p.line(bx, by, tx, ty, '#');
      p.px(tx, ty, '#'); p.px(tx + 1, ty, '#'); p.px(tx, ty - 1, '#'); p.px(tx + 1, ty - 1, '#');
    }

    drollery('actors', {
      span: [11, 4, 62, 50],
      h: 56,
      make: () => ({ off: false, at: -999 }),
      click(st, step) {
        if (step - st.at < TUCK) return;
        st.off = !st.off;
        st.at = step;
      },
      draw(p, st, { step, calm, pointer }) {
        const d = calm ? 0 : Math.floor(step / 36) % 2;
        rule(p, 6, 66, BASE);
        p.region(inBody(d), [10, 34, 56, 49], 'f', '#');
        stalk(p, 47 + d, 35, 6, pointer, -1);
        stalk(p, 51 + d, 35, 6, pointer, 1);
        p.region(inShell, [20, 26, 40, 46], 'g', '#');
        for (let th = 0.4; th < 13; th += 0.04) {
          const r = 0.6 + th * 0.62;
          p.px(30 + r * Math.cos(th), 36 + r * Math.sin(th), '#');
        }
        // A saddle cloth over the top of the shell, fringed in gold.
        for (let y = 27; y <= 31; y++) for (let x = 22; x <= 38; x++) {
          if (!inShell(x - 1, y) || !inShell(x + 1, y) || !inShell(x, y - 1)) continue;
          p.px(x, y, y === 31 ? (x % 2 ? 'g' : 'r') : 'r');
        }
        // Slack reins, from the knight's hand to the snail's neck.
        for (let i = 0; i <= 40; i++) {
          const t = i / 40, u = 1 - t;
          p.px(u * u * (KX + 10) + 2 * u * t * 40 + t * t * (46 + d), u * u * (KY + 10) + 2 * u * t * 41 + t * t * 41, '#');
        }
        // The lance and its pennant.
        p.line(KX + 10, KY + 8, KX + 37, KY - 9, '#');
        p.sprite(PENNANT[calm ? 0 : (step >> 3) % 2], KX + 29, KY - 6);
        p.sprite(KNIGHT, KX, KY + 7);
        // The helm comes off and goes under an arm: under it, another snail.
        // A second click puts it back on.
        const k = smooth(clamp((step - st.at) / TUCK)), t = st.off ? k : 1 - k;
        if (t > 0.05) {
          p.sprite(SNAILHEAD, KX + 2, KY + 2);
          const len = Math.round(6 * clamp((t - 0.35) / 0.35));
          if (len > 1) { stalk(p, KX + 3, KY + 2, len, pointer, -1); stalk(p, KX + 6, KY + 2, len, pointer, 1); }
        }
        p.sprite(HELM, ...helmAt(t));
      },
    });
  }

  // ---------- Nations: a flag ----------

  {
    const BASE = 58, POLE = 26, HX = 27, HY = 11, FW = 26, FH = 15;
    const EMBLEMS = {
      crown: art(`
        E..E..E
        EE.E.EE
        EEEEEEE
        .EEEEE.
        .EEEEE.
      `),
      tower: art(`
        E.E.E.E
        EEEEEEE
        .EEEEE.
        .EE.EE.
        .EE.EE.
      `),
      star: art(`
        ...E...
        ..EEE..
        EEEEEEE
        ..EEE..
        .E...E.
      `),
      eye: art(`
        ..EEE..
        .E...E.
        E..E..E
        .E...E.
        ..EEE..
      `),
      sun: art(`
        E..E..E
        .EEEEE.
        EEEEEEE
        .EEEEE.
        E..E..E
      `),
      heart: art(`
        .EE.EE.
        EEEEEEE
        .EEEEE.
        ..EEE..
        ...E...
      `),
    };
    const ON = { r: 'g', b: 'g', g: '#', '#': 'g' };
    const PATTERNS = ['plain', 'hoist', 'border', 'band'];
    // The ink of a full-size flag at (i, j).
    function ink(design, i, j) {
      const { field: F, pattern, emblem } = design, E = ON[F];
      if (pattern === 'band' && j >= 5 && j <= 9) return E;
      if (pattern === 'border' && (i === 0 || i === FW - 1 || j === 0 || j === FH - 1)) return E;
      if (pattern === 'hoist' && i < 6) return E;
      if (pattern !== 'band') {
        const m = EMBLEMS[emblem], ex = pattern === 'hoist' ? 13 : 10, ey = 5;
        const row = m[j - ey];
        if (row && row[i - ex] === 'E') return E;
      }
      return F;
    }
    // A flag half or wholly out (e from 0, hanging, to 1, flying).
    function flag(p, design, e, step, top = HY, burn = null) {
      const L = Math.round(lerp(6, FW, e)), Hc = Math.round(lerp(17, FH, e));
      for (let i = 0; i < L; i++) {
        if (burn && burn(i) === 'gone') continue;
        const droop = Math.round((1 - e) * (i / Math.max(1, L - 1)) * 5);
        const wave = e > 0.3 ? Math.round(Math.sin(i * 0.45 - step * 0.5) * 1.6 * (i / FW) * e) : 0;
        const hc = Hc - Math.round((1 - e) * Math.max(0, i - 3));
        for (let j = 0; j < hc; j++) {
          const x = HX + i, y = top + droop + wave + j;
          const fire = burn && burn(i);
          if (fire === 'stub') { p.px(x, y, '#'); continue; }
          if (fire === 'edge') { if (R('fire', i, j, step) < 0.6) p.px(x, y, R('hue', i, j, step) < 0.5 ? 'r' : 'g'); continue; }
          p.px(x, y, ink(design, Math.floor((i / L) * FW), Math.floor((j / hc) * FH)));
          if (e < 0.6 && i % 2 === 1 && j > 1) p.px(x, y, 'f', 0.8);
        }
      }
    }
    const pickDesign = (old, n) => {
      const fields = ['r', 'b', 'g', '#'].filter((f) => f !== old.field);
      const names = Object.keys(EMBLEMS).filter((m) => m !== old.emblem);
      return {
        field: fields[Math.floor(R('field', n) * fields.length)],
        pattern: PATTERNS[Math.floor(R('pattern', n) * PATTERNS.length)],
        emblem: names[Math.floor(R('emblem', n) * names.length)],
      };
    };
    const STRIKE = 84;

    drollery('nations', {
      span: [10, 0, 66, 58],
      h: 64,
      make: () => ({ design: { field: 'r', pattern: 'plain', emblem: 'crown' }, e: 0, strike: null, flags: 0 }),
      update(st, step, pointer) {
        const stir = (step % 110) < 16 ? 0.16 : 0;
        const target = pointer ? 1 : stir;
        st.e += clamp(target - st.e, -0.1, 0.12);
        if (st.strike && step - st.strike.born >= STRIKE) {
          st.design = st.strike.next;
          st.e = 0;
          st.strike = null;
        }
      },
      click(st, step) {
        if (st.strike) return;
        const L = Math.round(lerp(6, FW, st.e));
        st.strike = { born: step, e: st.e, hit: Math.max(3, L - 2), next: pickDesign(st.design, ++st.flags) };
      },
      draw(p, st, { step, calm }) {
        rule(p, 4, 66, BASE);
        for (const [y, x0, x1] of [[57, 21, 31], [56, 23, 29], [55, 25, 27]]) for (let x = x0; x <= x1; x++) p.px(x, y, y === 55 || x === x0 || x === x1 ? '#' : 'f');
        for (let y = 9; y < 55; y++) p.px(POLE, y, '#');
        p.sprite(art(`
          .g.
          ggg
          .g.
        `), POLE - 1, 6);

        const s = st.strike;
        if (!s) {
          // Gusts, fading in and out well inside the frame.
          if (st.e > 0.5 && !calm) for (let k = 0; k < 3; k++) {
            const y = [14, 22, 31][k], x = ((step * 2 + k * 37) % 62) + 4;
            for (let i = 0; i < 6; i++) p.px(x + i, y, 'f', 0.8 * clamp(Math.min((x - 4) / 8, (66 - x) / 8)));
          }
          flag(p, st.design, calm ? 0 : st.e, step);
          return;
        }
        const a = step - s.born, hx = HX + s.hit, hy = HY + 6;
        // The bolt: a thick, forked zigzag from off the top of the frame to the
        // ground, through the end of the flag.
        if (a < 5 && a !== 2) {
          p.glow(hx, hy, 22, 'g', 0.55);
          const bolt = (x, y, toX, toY, seed, thick) => {
            while (y < toY) {
              const ny = Math.min(toY, y + 5), nx = ny === toY ? toX : clamp(x + Math.round((R('bolt', seed, y) - 0.5) * 10), 6, 74);
              for (const [ox, ink] of thick ? [[-1, 'b'], [2, 'b'], [0, 'flash'], [1, 'flash']] : [[-1, 'b'], [0, 'flash']]) p.line(x + ox, y, nx + ox, ny, ink);
              x = nx; y = ny;
            }
          };
          // Down through the end of the flag and on to the ground, with a fork.
          bolt(hx + 6, -4, hx, hy, s.born, true);
          bolt(hx, hy, hx + 3, BASE - 1, s.born + 2, true);
          bolt(hx + 4, 4, hx + 16, 24, s.born + 1, false);
          for (let k = 0; k < 6; k++) p.px(hx + 3 + (k - 2.5) * 2, BASE - 2 - (k % 2) * 2, k % 2 ? 'g' : 'flash');
        }
        // The fire runs fast from the end of the flag back to the pole.
        const reach = (a - 2) * 2.2;
        if (a < 40) {
          flag(p, st.design, s.e, step, HY, (i) => {
            if (i < 2) return reach > s.hit - 2 ? 'stub' : null;
            const left = s.hit - reach;
            return i > left ? 'gone' : i > left - 2 ? 'edge' : null;
          });
        }
        // Embers and smoke.
        for (let k = 0; k < 24; k++) {
          const t = a - 3 - k * 1.1;
          if (t < 0 || t > 30) continue;
          const x0 = HX + Math.max(2, s.hit - (3 + k * 1.1) * 2.2) + (R('ex', k) - 0.5) * 3;
          const y0 = HY + 3 + R('ey', k) * 12;
          p.px(x0 + Math.sin(t * 0.3 + k) * 1.5, y0 - t * 0.4, k % 3 ? 'r' : 'g', 1 - t / 30);
        }
        for (let k = 0; k < 10; k++) {
          const t = a - 6 - k * 3;
          if (t < 0 || t > 40) continue;
          const x = HX + Math.max(2, s.hit - (6 + k * 3) * 2.2) + (R('sx', k) - 0.5) * 4 + t * 0.15, y = HY + 4 - t * 0.3;
          for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) p.px(x + ox, y + oy, 'f', 1 - t / 40);
        }
        // The new flag goes up the pole.
        if (a >= 44) {
          const k = smooth(clamp((a - 44) / 30));
          flag(p, s.next, 0, step, Math.round(lerp(40, HY, k)));
        }
      },
    });
  }

  // ---------- Qualities & Relationships: a portrait that is repainted ----------

  {
    const BASE = 61, NAIL = [39.5, 2];
    // The portrait inside its frame, and the frame and plaque round it.
    const PX = 28, PY = 13, PW = 24, PH = 30;
    const FX0 = PX - 4, FY0 = PY - 4, FX1 = PX + PW + 3, FY1 = PY + PH + 3;
    const PLAQUE = [25, 49, 54, 57];
    // A head and shoulders against a background (B): hair (H), skin, eyes
    // (E, drawn on their own so they can follow you), a mouth (M), a robe
    // (R) and its collar (C).
    const BUST = art(`
      BBBBBBBBBBBBBBBBBBBBBBBB
      BBBBBBBBBBBBBBBBBBBBBBBB
      BBBBBBBBBBBBBBBBBBBBBBBB
      BBBBBBBBBBBBBBBBBBBBBBBB
      BBBBBBBBBBBBBBBBBBBBBBBB
      BBBBBBBBBBBBBBBBBBBBBBBB
      BBBBBBBBB######BBBBBBBBB
      BBBBBBB##HHHHHH##BBBBBBB
      BBBBBB#HHHHHHHHHH#BBBBBB
      BBBBBB#HppppppppH#BBBBBB
      BBBBBB#pppppppppp#BBBBBB
      BBBBBB#p###pp###p#BBBBBB
      BBBBBB#pEEEppEEEp#BBBBBB
      BBBBBB#pEEEppEEEp#BBBBBB
      BBBBBB#ppppp#pppp#BBBBBB
      BBBBBB#pppp##pppp#BBBBBB
      BBBBBB#pppppppppp#BBBBBB
      BBBBBBB#ppMMMMpp#BBBBBBB
      BBBBBBB#pppppppp#BBBBBBB
      BBBBBBBB#pppppp#BBBBBBBB
      BBBBBBBBB#pppp#BBBBBBBBB
      BBBBBBBBBB#pp#BBBBBBBBBB
      BBBBBB##CCCCCCCC##BBBBBB
      BBBB##RRCCCCCCCCRR##BBBB
      BBB#RRRRRCCCCCCRRRRR#BBB
      BB#RRRRRRRCCCCRRRRRRR#BB
      B#RRRRRRRRRCCRRRRRRRRR#B
      B#RRRRRRRRRRRRRRRRRRRR#B
      #RRRRRRRRRRRRRRRRRRRRRR#
      #RRRRRRRRRRRRRRRRRRRRRR#
    `);
    // Painted over the bust: the king's crown and beard, the tyrant's spiky
    // crown and scowl, the saint's hands at prayer, and the chalk a vandal
    // left: horns and a curly moustache.
    const CROWN = art(`
      .g..gg..g.
      .g..gg..g.
      gg.gggg.gg
      gggggggggg
      gwgrggrgwg
      gggggggggg
    `);
    const SPIKES = art(`
      k..k.kk.k..k
      k..k.kk.k..k
      kk.kkkkkk.kk
      kkkkkkkkkkkk
      kkrkkkkkkrkk
      kkkkkkkkkkkk
      .kkkkkkkkkk.
    `);
    const BEARD = art(`
      ..DDDDDDDD..
      .#D......D#.
      .#DDDDDDDD#.
      .#DDDDDDDD#.
      ..#DDDDDD#..
      ..#DDDDDD#..
      ...#DDDD#...
      ....#DD#....
      .....##.....
    `);
    const SCOWL = art(`
      ..#......#..
      ..p##..##p..
    `);
    const PRAYER = art(`
      .##.
      #pp#
      #pp#
      #pp#
      #pp#
      #pp#
    `);
    const HORNS = art(`
      w..............w
      w..............w
      .w............w.
      .w............w.
      ..w..........w..
      ...w........w...
    `);
    const MOUSTACHE = art(`
      w..........w
      .w........w.
      ..wwwwwwww..
    `);
    const stamp = (rows, layers) => {
      const out = rows.map((r) => [...r]);
      for (const [s, x, y, map = {}] of layers) s.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch !== '.') out[y + j][x + i] = map[ch] || ch;
      }));
      return out.map((r) => r.join(''));
    };
    // Who the portrait shows, and what the plaque under it says. Each is
    // the same sitter, repainted: the Wise king, the Holy saint, the Cruel
    // tyrant, and that tyrant's portrait defaced once they had Fallen.
    const SITTERS = [
      { word: 'WISE', art: stamp(BUST, [[CROWN, 7, 2], [BEARD, 6, 16, { D: 'w' }]]), map: { B: 'v', H: 'w', R: 'r', C: 'w', M: 'm' }, eye: 'w', pupil: '#' },
      { word: 'HOLY', art: stamp(BUST, [[PRAYER, 10, 24]]), map: { B: 'b', H: 'm', R: 'm', C: 'w', M: 'm' }, eye: 'w', pupil: '#', halo: true, up: true },
      { word: 'CRUEL', art: stamp(BUST, [[SPIKES, 6, 1], [BEARD, 6, 16, { D: 'k' }], [SCOWL, 6, 10]]), map: { B: 'r', H: 'k', R: 'k', C: 'g', M: '#', '#': 'e' }, eye: 'k', pupil: 'r' },
      { word: 'FALLEN', art: stamp(BUST, [[BEARD, 6, 16, { D: 'k' }], [SCOWL, 6, 10], [HORNS, 4, 1], [MOUSTACHE, 6, 14]]), map: { B: 'r', H: 'k', R: 'k', C: 'g', M: '#', '#': 'e' }, eye: 'k', pupil: 'r', torn: true },
    ];
    // A tiny capital alphabet, for the plaque.
    const FONT = {
      W: ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'], I: ['###', '.#.', '.#.', '.#.', '###'], S: ['.##', '#..', '.#.', '..#', '##.'],
      E: ['###', '#..', '##.', '#..', '###'], H: ['#.#', '#.#', '###', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
      L: ['#..', '#..', '#..', '#..', '###'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], C: ['.##', '#..', '#..', '#..', '.##'],
      R: ['##.', '#.#', '##.', '#.#', '#.#'], U: ['#.#', '#.#', '#.#', '#.#', '###'], F: ['###', '#..', '##.', '#..', '#..'],
      A: ['.#.', '#.#', '###', '#.#', '#.#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
    };
    const wordWidth = (w) => [...w].reduce((n, ch) => n + FONT[ch][0].length + 1, -1);
    function word(p, w, ink, strike = 0) {
      const [x0, y0, x1, y1] = PLAQUE, top = (y0 + y1 - 4) >> 1;
      let x = Math.round((x0 + x1 + 1 - wordWidth(w)) / 2);
      const left = x;
      for (const ch of w) { p.sprite(FONT[ch], x, top, { map: { '#': ink } }); x += FONT[ch][0].length + 1; }
      if (strike > 0) p.line(left - 1, top + 2, left - 1 + Math.round((x - left) * strike), top + 2, 'r');
    }
    // The torn corner of the defaced portrait, ragged.
    const torn = (i, j) => (PW - 1 - i) + (PH - 1 - j) < 8 + Math.floor(R('tear', i, j) * 2);
    // The sitter, pixel by pixel, keeping only the rows `keep` allows.
    function sitter(p, s, look, keep = () => true) {
      const put = (x, y, ink) => { if (keep(y)) p.px(x, y, ink); };
      const [hx, hy] = [PX + 11.5, PY + 9];
      s.art.forEach((row, j) => [...row].forEach((ch, i) => {
        if (s.torn && torn(i, j)) return;
        const x = PX + i, y = PY + j;
        if (s.torn && torn(i + 1, j + 1)) return put(x, y, '#');
        // The saint's halo, a tooled ring behind the head.
        if (s.halo && ch === 'B') {
          const d = Math.hypot(x - hx, (y - hy) * 1.1);
          if (d < 9.5) return put(x, y, d > 8.5 ? '#' : 'o');
        }
        if (ch === 'E') {
          const [ex, ey] = [i < 12 ? i - 8 : i - 13, j - 12];
          let c = s.eye;
          if (look.shut) c = ey === 1 ? '#' : 'p';
          else if (ex === look.x && (look.y === null || look.y === ey)) c = s.pupil;
          return put(x, y, c);
        }
        put(x, y, s.map[ch] || ch);
      }));
      // The curl of the torn flap.
      if (s.torn) for (const [i, j] of [[PW - 6, PH - 1], [PW - 5, PH - 2], [PW - 4, PH - 3], [PW - 3, PH - 4], [PW - 2, PH - 5], [PW - 1, PH - 6], [PW - 4, PH - 2], [PW - 3, PH - 3]]) {
        put(PX + i + 1, PY + j + 1, 'w');
      }
    }
    // The frame: gilt, beaded, with a crest on top, hung on a cord from a nail.
    function frame(p) {
      p.line(NAIL[0], NAIL[1] + 1, FX0 + 5, FY0 - 1, 'f');
      p.line(NAIL[0] + 1, NAIL[1] + 1, FX1 - 5, FY0 - 1, 'f');
      for (let y = FY0; y <= FY1; y++) for (let x = FX0; x <= FX1; x++) {
        const d = Math.min(x - FX0, FX1 - x, y - FY0, FY1 - y);
        if (d > 3) continue;
        if (d === 0 || d === 3) p.px(x, y, '#');
        else if (d === 1) p.px(x, y, (x + y) % 3 === 0 ? 'o' : 'g');
        else p.px(x, y, 'g');
      }
      // Rosettes at the corners, and the crest.
      for (const [x, y] of [[FX0, FY0], [FX1, FY0], [FX0, FY1], [FX1, FY1]]) {
        for (const [ox, oy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) p.px(x + ox, y + oy, ox || oy ? 'o' : 'glint');
      }
      p.sprite(CREST, Math.round(NAIL[0]) - 2, FY0 - 3);
    }
    const CREST = art(`
      ..##..
      .#oo#.
      #oggo#
    `);
    const REPAINT = 14, SWING = 30, NAILED = art(`
      ee
      ee
    `);

    drollery('qualities', {
      span: [19, 0, 60, 59],
      h: 64,
      make: () => ({ at: 0, was: 0, paintAt: -999, blinkAt: 50 }),
      update(st, step) { if (step > st.blinkAt + 3) st.blinkAt = step + 60 + Math.floor(R('blink', step) * 90); },
      click(st, step) {
        if (step - st.paintAt < REPAINT) return;
        st.was = st.at;
        st.at = (st.at + 1) % SITTERS.length;
        st.paintAt = step;
      },
      draw(p, st, { step, calm, pointer }) {
        rule(p, 12, 66, BASE);
        const a = step - st.paintAt, painting = a >= 0 && a < REPAINT;
        const now = SITTERS[st.at], before = SITTERS[st.was];
        // Its eyes watch you, and follow the pointer; the saint's are raised
        // to heaven until you come near.
        const look = { x: 1, y: now.up ? 0 : null, shut: !calm && !painting && step - st.blinkAt >= 0 && step - st.blinkAt < 3 };
        if (pointer) {
          const dx = pointer[0] - (PX + 11.5), dy = pointer[1] - (PY + 12.5);
          look.x = dx < -5 ? 0 : dx > 5 ? 2 : 1;
          look.y = dy < -6 ? 0 : dy > 6 ? 1 : null;
        }
        // A click: a brush repaints it top to bottom, and the frame swings
        // on its cord.
        const wipe = PY + Math.floor(smooth(clamp(a / REPAINT)) * PH);
        const list = p.capture(() => {
          frame(p);
          if (painting) {
            sitter(p, before, look, (y) => y >= wipe);
            sitter(p, now, look, (y) => y < wipe);
          } else sitter(p, now, look);
        });
        const th = !calm && a >= 0 && a < SWING ? 0.07 * Math.sin(a * 0.55) * (1 - a / SWING) : 0;
        p.turn(list, NAIL[0], NAIL[1], th);
        p.sprite(NAILED, Math.round(NAIL[0]) - 1, NAIL[1] - 1);
        if (painting) {
          // The brush, zigzagging down: bristles in the new colour, a
          // ferrule and a handle.
          const u = (a / REPAINT) * 3, zig = u % 2 < 1 ? u % 1 : 1 - (u % 1);
          const bx = Math.round(PX + 2 + zig * (PW - 5)), by = Math.min(wipe, PY + PH - 1);
          const bristle = now.map.B;
          for (let k = 0; k < 3; k++) { p.px(bx + k, by, bristle); p.px(bx + k, by - 1, bristle); }
          for (let k = 0; k < 3; k++) { p.px(bx + k, by - 2, 'e'); p.px(bx + k, by - 3, 'e'); }
          for (let k = 4; k < 10; k++) p.px(bx + 1, by - k, 'm');
        }
        // The plaque: the old word struck through, then the new one, shining.
        const [x0, y0, x1, y1] = PLAQUE;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const edge = x === x0 || x === x1 || y === y0 || y === y1;
          if ((x === x0 || x === x1) && (y === y0 || y === y1)) continue;
          p.px(x, y, edge ? '#' : 'g');
        }
        for (const x of [x0 + 1, x1 - 1]) p.px(x, (y0 + y1) >> 1, 'e');
        if (painting && a < REPAINT / 2) word(p, before.word, 'k', a / (REPAINT / 2));
        else word(p, now.word, painting || (a >= 0 && a < REPAINT + 6) ? 'glint' : 'k');
      },
    });
  }

  // ---------- Naming: a swaddled baby ----------

  {
    const BASE = 66, MID = 39.5, HX = 29, HY = 20;
    // A chubby sleeping baby: a tuft of dark hair (h), closed eyes (E), rosy
    // cheeks (C) and a little mouth (M).
    const HEAD = art(`
      .........#..#.........
      ........#h##h#........
      ......##hhhhhh##......
      ....##pphhhhhhpp##....
      ...#pppppppppppppp#...
      ..#pppppppppppppppp#..
      ..#pppppppppppppppp#..
      .#pppppppppppppppppp#.
      .#pppppppppppppppppp#.
      .#ppppEpEppppEpEpppp#.
      .#pppppEppppppEppppp#.
      .#ppCCppppppppppCCpp#.
      .#ppCCppppppppppCCpp#.
      ..#pppppppMMppppppp#..
      ..#pppppppppppppppp#..
      ...#pppppppppppppp#...
      ....##pppppppppp##....
      ......##########......
    `);
    // The swaddle: a linen bundle from the chin down, round at the shoulders
    // and tapering to the feet, bound with criss-crossed vermilion bands.
    const UY = HY + 15, UH = 26, CUSHION = UY + UH;
    const half = (j) => {
      const t = j / (UH - 1);
      return t < 0.15 ? 9 + (t / 0.15) * 4 : t < 0.7 ? 13 : 13 - ((t - 0.7) / 0.3) ** 2 * 7;
    };
    const inBundle = (x, y) => y >= UY && y < UY + UH && Math.abs(x - MID) <= half(y - UY);
    function bundleInk(x, y) {
      if (!inBundle(x - 1, y) || !inBundle(x + 1, y) || !inBundle(x, y - 1) || !inBundle(x, y + 1)) return '#';
      const j = y - UY;
      if (j === 2) return 'f';
      const c = Math.floor(x), a = (((c + y) % 10) + 10) % 10, b = (((c - y) % 10) + 10) % 10;
      return j > 4 && (a === 0 || b === 0) ? 'r' : 'w';
    }
    // Under it, crying, a little red gown with a gold hem, and bare feet.
    const gownHalf = (j) => 7 + j * 0.2;
    const inGown = (x, y) => y >= UY && y < UY + UH - 3 && Math.abs(x - MID) <= gownHalf(y - UY);
    function gownInk(x, y) {
      if (!inGown(x - 1, y) || !inGown(x + 1, y) || !inGown(x, y - 1) || !inGown(x, y + 1)) return '#';
      const j = y - UY;
      return j < 3 ? 'w' : j >= UH - 6 ? 'g' : 'r';
    }
    const FOOT = art(`
      #pp#
      pppp
      .pp.
    `);
    // A chubby arm in a red sleeve, with a little hand.
    function arm(p, [x0, y0], [x1, y1]) {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (const [r, ink] of [[2.8, '#'], [1.9, 'r']]) for (let k = 0; k <= n; k++) {
        const x = lerp(x0, x1, k / n), y = lerp(y0, y1, k / n);
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= r * r) p.px(x + dx, y + dy, ink);
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx * dx + dy * dy < 2) p.px(x1 + dx, y1 + dy, 'p');
    }
    // The swaddle flown free, like a magic carpet: the same banded linen,
    // with gold tassels, a wave running down it and its folds in shadow.
    function carpet(p, cx, cy, len, ph, tilt) {
      const L = Math.max(3, Math.round(len)), x0 = Math.round(cx - L / 2);
      const at = (i) => {
        const u = i / Math.max(1, L - 1), edge = 0.6 + Math.abs(u - 0.5) * 1.6;
        return cy + Math.sin(u * TAU * 1.1 - ph) * 2 * edge + (u - 0.5) * tilt;
      };
      let yl = 0, yr = 0;
      for (let i = 0; i < L; i++) {
        const y = Math.round(at(i)), fold = at(i + 1) - at(i - 1) > 0.5;
        if (i === 0) yl = y;
        if (i === L - 1) yr = y;
        for (let k = -4; k <= 3; k++) {
          const x = x0 + i, a = (((x + k) % 10) + 10) % 10, b = (((x - k) % 10) + 10) % 10;
          p.px(x, y + k, k === -4 || k === 3 ? '#' : a === 0 || b === 0 ? 'r' : fold ? 'f' : 'w');
        }
      }
      const sway = Math.round(Math.sin(ph * 1.3));
      for (const [x, y, d] of [[x0 - 1, yl, -1], [x0 + L, yr, 1]]) {
        for (const k of [-3, -1, 1]) { p.px(x, y + k, 'g'); p.px(x + d, y + k + sway, 'g'); }
      }
    }
    const Z = [art(`
      #####
      ....#
      ...#.
      ..#..
      .#...
      #####
    `), art(`
      #######
      .....#.
      ....#..
      ...#...
      ..#....
      .#.....
      #######
    `)];
    const STAR = [art(`
      ....gg....
      ....gg....
      ....gg....
      ...gggg...
      gggggggggg
      gggggggggg
      ...gggg...
      ....gg....
      ....gg....
      ....gg....
    `), art(`
      gg......gg
      ggg....ggg
      .ggg..ggg.
      ..gg..gg..
      ....gg....
      ....gg....
      ..gg..gg..
      .ggg..ggg.
      ggg....ggg
      gg......gg
    `)];
    // The carpet hovers here while the baby cries.
    const HOVER = [MID, 11], BURST = 10, WRAP = 30, CLOTH = 36;

    drollery('naming', {
      span: [2, 1, 78, 66],
      h: 70,
      make: () => ({ mode: 'sleep', at: -999, soothed: false, starAt: -999, zs: [], tears: [], nextZ: 20 }),
      update(st, step, pointer) {
        const a = step - st.at;
        if (st.mode === 'sleep' && pointer && !st.soothed) { st.mode = 'burst'; st.at = step; }
        else if (st.mode === 'burst' && a >= BURST) { st.mode = 'cry'; st.at = step; }
        else if (st.mode === 'wrap' && a >= WRAP) { st.mode = 'sleep'; st.at = step; if (st.star) st.starAt = step; }
        if (st.mode === 'sleep' && step >= st.nextZ && step - st.starAt > 30) {
          st.zs.push({ born: step, big: st.zs.length % 2 });
          st.nextZ = step + 42;
        }
        st.zs = st.zs.filter((z) => step - z.born < 80);
        if (st.mode === 'cry' && step % 4 === 0) {
          const side = (step / 4) % 2 ? 1 : -1;
          st.tears.push({ x: HX + (side > 0 ? 15 : 6), y: HY + 10, vx: side * (0.7 + R('tear', step) * 0.6), vy: -0.8 });
        }
        for (const t of st.tears) { t.vy += 0.2; t.x += t.vx; t.y += t.vy; }
        st.tears = st.tears.filter((t) => t.y < BASE);
      },
      // Left alone it's wrapped back up; calmed with a click, it gets a star too.
      leave(st, step) {
        st.soothed = false;
        if (st.mode === 'burst' || st.mode === 'cry') { st.mode = 'wrap'; st.at = step; st.star = false; }
      },
      click(st, step) {
        if (st.mode !== 'burst' && st.mode !== 'cry') return;
        st.mode = 'wrap'; st.at = step; st.star = true; st.soothed = true; st.nextZ = step + WRAP + 30;
      },
      draw(p, st, { step, calm }) {
        rule(p, 6, 72, BASE);
        const a = step - st.at, mode = st.mode;
        // The cushion: lapis, edged and tasselled in gold.
        for (let y = CUSHION; y < BASE; y++) for (let x = 15; x <= 64; x++) {
          const edge = y === CUSHION || y === BASE - 1 || x === 15 || x === 64;
          p.px(x, y, edge ? '#' : y === CUSHION + 1 ? 'g' : 'b');
        }
        for (const x of [14, 65]) for (let y = CUSHION + 1; y <= CUSHION + 3; y++) p.px(x, y, 'g');
        // How much of it is swaddled, from the feet up, and where the carpet is.
        let wrapped = 1, cloth = null;
        const ph = step * 0.35;
        if (mode === 'burst') {
          const t = a / BURST, s = smooth(t);
          wrapped = 1 - t;
          cloth = { x: lerp(MID, HOVER[0], s) + Math.sin(t * TAU) * 14 * (1 - t), y: lerp(UY + UH / 2, HOVER[1], s), len: lerp(8, CLOTH, s), tilt: Math.sin(t * TAU * 1.5) * 4, front: Math.cos(t * TAU) > 0 };
        } else if (mode === 'cry') {
          wrapped = 0;
          cloth = { x: HOVER[0], y: HOVER[1] + Math.round(Math.sin(step * 0.15)), len: CLOTH, tilt: Math.sin(step * 0.09) * 3, front: true };
        } else if (mode === 'wrap') {
          // The carpet swoops down to the feet, then spirals up round the
          // baby, wrapping it as it goes and growing shorter.
          const u = a / WRAP;
          if (u < 0.25) {
            const s = smooth(u / 0.25);
            wrapped = 0;
            cloth = { x: lerp(HOVER[0], MID - 17, s), y: lerp(HOVER[1], UY + UH - 4, s) - Math.sin(s * Math.PI) * 6, len: CLOTH, tilt: lerp(0, 10, s), front: true };
          } else {
            const v = (u - 0.25) / 0.75, phi = v * TAU * 2.5;
            wrapped = smooth(v);
            cloth = { x: MID - 17 * Math.cos(phi), y: UY + UH - 4 - wrapped * (UH - 6), len: 4 + (CLOTH - 4) * (1 - wrapped), tilt: 6 * Math.cos(phi), front: Math.sin(phi) > 0, phi };
          }
        }
        const crying = mode === 'burst' || mode === 'cry';
        const hop = mode === 'cry' && !calm && (step >> 2) % 2 ? -1 : 0;
        const nod = mode === 'sleep' && !calm && Math.sin((step / 72) * TAU) > 0.2 ? 1 : 0;
        const line = UY + UH - wrapped * UH;
        if (cloth && !cloth.front) carpet(p, cloth.x, cloth.y, cloth.len, ph, cloth.tilt);
        // Under the swaddle: the gown, kicking feet and flailing arms.
        if (wrapped < 1) {
          for (let y = UY; y < UY + UH - 3; y++) for (let x = MID - 13; x <= MID + 13; x++) {
            if (inGown(x, y) && y < line) p.px(x, y + hop, gownInk(x, y));
          }
          const kick = crying && !calm ? (step >> 2) % 2 : 0;
          if (line > UY + UH - 3) {
            p.sprite(FOOT, Math.round(MID) - 7, UY + UH - 3 - kick);
            p.sprite(FOOT, Math.round(MID) + 3, UY + UH - 3 - (1 - kick));
          }
          if (line > UY + 8) {
            const tuck = clamp(wrapped / 0.6), flail = (step >> 2) % 2;
            for (const side of [-1, 1]) {
              const up = (side > 0) === !!flail;
              const hx = lerp(MID + side * (up ? 15 : 17), MID + side * 5, tuck), hy = lerp(UY + (up ? -6 : 3), UY + 9, tuck);
              arm(p, [MID + side * 6, UY + 4 + hop], [hx, hy + hop]);
            }
          }
        }
        // The swaddle itself.
        if (wrapped > 0) {
          for (let y = Math.ceil(line); y < UY + UH; y++) for (let x = MID - 13; x <= MID + 13; x++) {
            if (inBundle(x, y)) p.px(x, y, bundleInk(x, y));
          }
        }
        p.sprite(HEAD, HX, HY + nod + hop, { map: { h: 'k', E: '#', C: 'r', M: 'm' } });
        if (crying) {
          // Mouth wide open, tears flying.
          for (let oy = 0; oy < 3; oy++) for (let ox = 0; ox < 4; ox++) {
            if ((ox === 0 || ox === 3) && oy !== 1) continue;
            p.px(HX + 9 + ox, HY + 12 + oy + hop, 'm');
          }
          for (const t of st.tears) { p.px(t.x, t.y, 'b'); p.px(t.x, t.y - 1, 'b'); }
        }
        if (cloth && cloth.front) carpet(p, cloth.x, cloth.y, cloth.len, ph, cloth.tilt);
        // While it wraps, a band runs from the carpet to the swaddle, and
        // sparks trail it.
        if (mode === 'wrap' && cloth.phi !== undefined) {
          const ex = MID + Math.sign(cloth.x - MID || 1) * half(clamp(line - UY, 0, UH - 1)), ey = line;
          for (let k = 0; k <= 8; k++) {
            const x = lerp(cloth.x, ex, k / 8), y = lerp(cloth.y, ey, k / 8);
            p.px(x, y - 1, 'w'); p.px(x, y, 'r'); p.px(x, y + 1, 'w');
          }
          if (!calm) for (let k = 1; k <= 4; k++) {
            const ph2 = cloth.phi - k * 0.5;
            p.px(MID - 19 * Math.cos(ph2), cloth.y + k * 1.5 + Math.sin(k * 3 + step) * 2, k % 2 ? 'glint' : 'g', 1 - k / 5);
          }
        }
        for (const z of st.zs) {
          const t = step - z.born;
          p.sprite(Z[z.big], HX + 23 + t * 0.15 + Math.sin(t * 0.1) * 3, HY - 2 - t * 0.2, { alpha: t < 10 ? t / 10 : clamp(1 - (t - 50) / 30) });
        }
        const s = step - st.starAt;
        if (s >= 0 && s < 72) {
          p.glow(MID, HY - 8, 12, 'g', 0.3 * clamp(1 - (s - 40) / 32));
          p.sprite(STAR[(step >> 3) % 2], Math.round(MID) - 5, Math.round(HY - 4 - 12 * smooth(clamp(s / 12))), { alpha: clamp(1 - (s - 50) / 22) });
        }
      },
    });
  }

  // ---------- Journey: a pilgrim ----------

  {
    const BASE = 50, HOME = 6, STONE = 30, STOP = STONE + 11, FAR = 58, SPEED = 1.2;
    // A pilgrim facing right: a broad felt hat with a scallop shell on the
    // brim (rows 0 to 5), a face in profile, a lapis cloak, a gold belt and
    // scrip, legs and boots, and a hand out front for the staff, which is
    // drawn on its own.
    const PILGRIM = art(`
      ......#####.......
      .....#mmmmm#......
      .....#mmmmm#......
      ..#############...
      .#mmmmmmmmmmmwm#..
      ..#############...
      .....#ppppp#......
      .....#ppp#pp#.....
      .....#pppppp#.....
      .....#ppppp#......
      ......#ppp#.......
      ....##bbbbb##.....
      ...#bbbbbbbbb#....
      ..#bbbbbbbbbbb#...
      ..#bbbbbbbbbbbpp..
      ..#bbbbbbbbbbbpp..
      ..#bbbbbbbbbbb#...
      ..#gggggggggggg#..
      .#gg#bbbbbbbbb#...
      .#gg#bbbbbbbbb#...
      .#gg#bbbbbbbbbb#..
      ..##.#bbbbbbbbb#..
      .....#bbbbbbbbbb#.
      .....############.
      ......#kk#.#kk#...
      ......#kk#.#kk#...
      ......#kk#.#kk#...
      .....#kkk#.#kkk#..
      .....#####.#####..
    `);
    // Mid-stride, the last five rows.
    const STRIDE = art(`
      .....#kk#..#kk#...
      ....#kk#....#kk#..
      ...#kk#......#kk#.
      ..#kkk#......#kkk#
      ..#####......#####
    `);
    // Under the hat, raised to you.
    const HAIR = art(`
      ......#####.......
      .....#kkkkk#......
    `);
    const WAYSTONE = art(`
      ...####...
      .##ffff##.
      .#ffffff#.
      #ffffffff#
      #fffggfff#
      #ffgffgff#
      #fffggfff#
      #ffffffff#
      #ffffffff#
      ##ffffff##
      ###ffff###
      .########.
    `);
    const ITEMS = [
      // an apple
      art(`
        ....#.....
        ....##....
        ..rrrrrr..
        .rrrrrrrr.
        rrwrrrrrrr
        rrrrrrrrrr
        .rrrrrrrr.
        ..rrrrrr..
      `),
      // a bell
      art(`
        ....gg....
        ...gggg...
        ...gggg...
        ..gggggg..
        .gggggggg.
        gggggggggg
        gggggggggg
        ....gg....
      `),
      // a fish
      art(`
        bb......bb
        bbb...bbbb
        ..bbbbbbbb
        .bbbbbbw#b
        bbbbbbbbbb
        ..bbbbbbbb
        bbb...bbbb
        bb......bb
      `),
      // a crown
      art(`
        g...gg...g
        g...gg...g
        gg.gggg.gg
        gggggggggg
        grggggggrg
        gggggggggg
      `),
      // a skull
      art(`
        ..######..
        .########.
        ##..##..##
        ##..##..##
        ##########
        .########.
        .#.#..#.#.
        ..#.##.#..
      `),
      // a gem
      art(`
        ....gg....
        ...gggg...
        ..gggggg..
        .gggwgggg.
        gggggggggg
        .gggggggg.
        ..gggggg..
        ...gggg...
        ....gg....
      `),
    ];
    // The pilgrim fades into the distance at the far end of the road rather
    // than walking out of the frame.
    const seen = (x) => clamp((FAR - x) / 12);

    drollery('journey', {
      span: [4, 4, 74, 50],
      h: 56,
      make: () => ({ x: HOME, face: 1, phase: 'home', at: 0, item: 0, stack: [] }),
      update(st, step) {
        if (st.phase === 'out') {
          st.x += SPEED;
          if (st.x >= FAR) { st.phase = 'away'; st.at = step; }
        } else if (st.phase === 'away' && step - st.at > 36) {
          st.phase = 'back'; st.face = -1;
        } else if (st.phase === 'back') {
          st.x -= SPEED;
          if (st.x <= STOP) { st.x = STOP; st.phase = 'place'; st.at = step; }
        } else if (st.phase === 'place' && step - st.at > 14) {
          st.stack = [...st.stack, st.item].slice(-3);
          st.phase = 'home-bound';
        } else if (st.phase === 'home-bound') {
          st.x -= SPEED;
          if (st.x <= HOME) { st.x = HOME; st.phase = 'home'; st.face = 1; }
        }
      },
      click(st, step) {
        if (st.phase !== 'home') return;
        const choices = ITEMS.map((_, i) => i).filter((i) => i !== st.stack[st.stack.length - 1]);
        st.item = choices[Math.floor(R('item', step) * choices.length)];
        st.phase = 'out';
      },
      draw(p, st, { step, calm, pointer }) {
        rule(p, 2, 72, BASE);
        // One waystone, with the souvenirs piled on it, newest on top.
        const [sw, sh] = size(WAYSTONE);
        p.sprite(WAYSTONE, STONE, BASE - sh);
        let top = BASE - sh;
        for (const it of st.stack) {
          const [w, h] = size(ITEMS[it]);
          top -= h;
          p.sprite(ITEMS[it], STONE + (sw >> 1) - (w >> 1), top);
        }
        if (st.phase === 'away') return;
        const alpha = seen(st.x);
        const walking = ['out', 'back', 'home-bound'].includes(st.phase);
        const look = st.phase === 'home' && pointer && !calm;
        const striding = walking && Math.floor(st.x / 6) % 2;
        let x = Math.round(st.x), rows = PILGRIM;
        if (striding) rows = [...rows.slice(0, -5), ...STRIDE];
        if (st.phase === 'home' && !look && !calm && (step / 48) % 2 >= 1) x += 1;
        const [pw] = size(PILGRIM), y = BASE - rows.length, flip = st.face < 0;
        const fx = (i) => (flip ? x + pw - 1 - i : x + i);
        // The staff, in the front hand.
        const lean = striding ? 2 : 0;
        p.line(fx(16 + lean), y - 4, fx(16), BASE - 1, '#', alpha);
        p.px(fx(16 + lean), y - 5, 'g', alpha);
        p.px(fx(16 + lean), y - 6, 'g', alpha);
        // At a hover, it raises its hat to you with its other hand.
        if (look) {
          p.sprite(rows.slice(6), x, y + 6, { flip });
          p.sprite(HAIR, x, y + 4, { flip });
          p.sprite(rows.slice(0, 6), x, y - 3, { flip });
          p.line(fx(3), y + 14, fx(3), y + 3, 'b');
          p.line(fx(4), y + 14, fx(4), y + 3, 'b');
          p.px(fx(3), y + 2, 'p'); p.px(fx(4), y + 2, 'p');
        } else p.sprite(rows, x, y, { flip, alpha });
        // A souvenir, carried home overhead and set on the pile.
        if (st.phase === 'back' || st.phase === 'place') {
          const it = ITEMS[st.item], [w, h] = size(it);
          let ix = x + (pw >> 1) - (w >> 1), iy = y - h - 3;
          if (st.phase === 'place') {
            const k = smooth(clamp((step - st.at) / 14));
            ix = Math.round(lerp(ix, STONE + (sw >> 1) - (w >> 1), k));
            iy = Math.round(lerp(iy, top - h, k));
          }
          p.sprite(it, ix, iy, { alpha });
        }
      },
    });
  }

  // ---------- Narration: a fortune-teller at a fire ----------

  {
    const BASE = 66, FX = 46, TX = 8;
    // A hooded fortune-teller in one long maroon cloak, standing in profile
    // with her hands held out to the fire. The cloak's reaching sleeve is
    // rows 19 to 21.
    const TELLER = art(`
      ........eeeee.........
      ......eemmmmmee.......
      .....emmmmmmmmme......
      ....emmmmmmmmmmme.....
      ...emmmmmmmmmmmmme....
      ...emmmmmmmkkkkkme....
      ..emmmmmmmkkppppkme...
      ..emmmmmmmkpp#pppme...
      ..emmmmmmmkppppppppe..
      ..emmmmmmmkpppppppe...
      ..emmmmmmmkkppppme....
      ..emmmmmmmmkkpppme....
      ..emmmmmmmmmkkkmme....
      ..emmmmmmmmmmmmmme....
      ..emmmmmmmmmmmmmme....
      ..emmmmmmmmmmmmmmme...
      ..emmmmmmmmmmmmmmme...
      .emmmmmmmmmmmmmmmme...
      .emmmmmmmmmmmmmmmmeee.
      .emmmmmmmmmmmmmmmmmmpp
      .emmmmmmmmmmmmmmmmmmpp
      .emmmmmmmmmmmmmmmmeee.
      .emmmmmmmmmmmmmmmme...
      .emmmmmmmmmmmmmmmme...
      .emmmmmmmmmmmmmmmme...
      .emmmmmmmmmmmmmmmme...
      .emmmmmmmmmmmmmmmme...
      .emmmmmmmmmmmmmmmme...
      .emmmmmmmmmmmmmmmmme..
      .emmmmmmmmmmmmmmmmme..
      emmmmmmmmmmmmmmmmmme..
      emmmmmmmmmmmmmmmmmme..
      emmmmmmmmmmmmmmmmmme..
      emmmmmmmmmmmmmmmmmmme.
      emmmmmmmmmmmmmmmmmmme.
      emmmmmmmmmmmmmmmmmmme.
      emmmmmmmmmmmmmmmmmmme.
      emmmmmmmmmmmmmmmmmmme.
      emmmmmmmmmmmmmmmmmmmme
      emmmmmmmmmmmmmmmmmmmme
      eggggggggggggggggggggge
      eeeeeeeeeeeeeeeeeeeeee
    `);
    const TY = BASE - TELLER.length;
    const ARMSUP = [...TELLER.slice(0, 18), ...Array(4).fill('.emmmmmmmmmmmmmmmme...'), ...TELLER.slice(22)];
    // Her sleeve raised to the smoke, hand out of it.
    const RAISED = art(`
      .......pp.
      ......epp.
      ......emme
      .....emme.
      .....emme.
      ....emme..
      ....emme..
      ...emme...
      ...emme...
      ..emme....
      ..emme....
      .emme.....
      .emme.....
      emme......
      emme......
      mme.......
    `);
    // A tower, a ship, a castle and a whale.
    const SHAPES = [
      art(`
        ..............##................
        ..............###...............
        ..............###...............
        .............#.####.............
        ............##..###.............
        ...........###..#####...........
        ...........###..#####...........
        .........#####..#######.........
        .........#####..#######.........
        .......#######..#########.......
        ......########..##########......
        ......#######....#########......
        ..............##................
        ..............##................
        ################################
        ################################
        .##############################.
        ...##########################...
        .....######################.....
        .......##################.......
      `),
      art(`
        ..............##....................
        .............###....................
        .............###....................
        ...........#####....................
        ...........#####.............##.....
        .........#######...........######...
        .........#######...........#######..
        .......#########.........#########..
        .......#########.........####.......
        .....###########.......####.........
        .....###########.......###..........
        ...##############....#####..........
        ..##########################........
        .###########################........
        ###..######################.........
        ##.....###################..........
        ##.....######........#####..........
        ###.....###...........###...........
        .###....###...........###...........
        ..##....##............##............
      `),
      art(`
        ##..##..##..........##..##..##..
        ##..##..##..........##..##..##..
        ##########..........##########..
        .########............########...
        .########......##....########...
        ..######.....######...######....
        ..######.....######...######....
        ..######...#########...#####....
        ..######...##########...####....
        .#######..############..#####...
        .############################...
        ###############################.
        ############..####..###########.
        ############..####..############
        ############..####..############
        .##########....##....##########.
      `),
      art(`
        ..........................##..##
        ..........................##..##
        ...........................####.
        ............................##..
        .......##############.......##..
        .....##################.....##..
        ...######################.......
        .##########################.....
        .############################...
        ###############################.
        ################################
        .###############################
        .#############################..
        ...##########################...
        .....######################...##
        .......##################.....##
        ............................####
        ............................###.
      `),
    ];

    drollery('narration', {
      span: [7, 2, 68, 66],
      h: 70,
      make: () => ({ puffs: [], raiseAt: -999, next: 0 }),
      update(st, step) { st.puffs = st.puffs.filter((q) => step - q.born < 74); },
      click(st, step) {
        st.puffs.push({ born: step, shape: SHAPES[st.next++ % SHAPES.length] });
        st.raiseAt = step;
      },
      draw(p, st, { step, calm, pointer }) {
        rule(p, 4, 72, BASE);
        // The fire: crossed logs, and flames that flare at a hover.
        const flare = pointer ? 1.8 : 1;
        let crest = BASE;
        for (let x = FX - 7; x <= FX + 7; x++) {
          const base = 11 - Math.abs(x - FX) * 1.5, flick = calm ? 0.9 : 0.65 + 0.6 * R('fl', x, step >> 1);
          const top = BASE - 5 - Math.round(base * flick * flare);
          crest = Math.min(crest, top);
          for (let y = top; y <= BASE - 4; y++) {
            if (y === top && R('tip', x, step >> 1) < 0.3) continue;
            p.px(x, y, Math.abs(x - FX) <= 2 && y > top + 2 ? (y > BASE - 8 ? 'o' : 'g') : 'r');
          }
        }
        for (const o of [0, 1]) {
          p.line(FX - 10, BASE - 1 - o, FX + 10, BASE - 6 - o, '#');
          p.line(FX - 10, BASE - 6 - o, FX + 10, BASE - 1 - o, '#');
        }
        if (pointer && !calm) for (let k = 0; k < 8; k++) {
          const t = (step + k * 7) % 28;
          p.px(FX + Math.sin(t * 0.3 + k) * 5, crest - t * 1.2, 'o', 1 - t / 28);
        }
        // A thread of smoke.
        if (!calm) for (let y = crest - 2; y > 8; y--) {
          if ((y + (step >> 2)) % 3 === 0) continue;
          p.px(FX + Math.sin(y * 0.2 + step * 0.07) * (2 + (BASE - y) * 0.06), y, 'f', 1.6 * (y - 8) / (BASE - 8));
        }
        // Pictures in the smoke, forming, rising and coming apart before the top.
        for (const q of st.puffs) {
          const a = step - q.born, [w, h] = size(q.shape);
          const x0 = FX - (w >> 1) + a * 0.06, y0 = BASE - 34 - h - a * 0.12;
          q.shape.forEach((row, j) => [...row].forEach((ch, i) => {
            if (ch === '.') return;
            const r = R('wisp', i, j, q.born);
            if (a < 14 && r > a / 14) return;
            if (r < (a - 32) / 40) return;
            p.px(x0 + i + Math.round(Math.sin(j * 0.3 + a * 0.15) * 1.2), y0 + j, 'f', 1.3);
          }));
        }
        // The teller, arms up while a picture forms.
        const up = step - st.raiseAt < 30;
        p.sprite(up ? ARMSUP : TELLER, TX, TY);
        if (up) {
          p.sprite(RAISED, TX + 16, TY + 3);
        }
      },
    });
  }

  // ---------- Draw a Card: a card that flips ----------

  {
    const BASE = 60, CW = 23, CH = 33, CX = 28, CY = BASE - 2 - CH;
    const SUITS = ['heart', 'diamond', 'club', 'spade'];
    const SUIT_INK = { heart: 'r', diamond: 'g', club: '#', spade: 'b' };
    const PIPS = {
      heart: art(`
        .###...###.
        #####.#####
        ###########
        ###########
        ###########
        .#########.
        ..#######..
        ...#####...
        ....###....
        .....#.....
      `),
      diamond: art(`
        ....#....
        ...###...
        ...###...
        ..#####..
        .#######.
        #########
        #########
        .#######.
        ..#####..
        ...###...
        ...###...
        ....#....
      `),
      club: art(`
        ....###....
        ...#####...
        ...#####...
        ....###....
        .###.#.###.
        ###########
        ###########
        .###.#.###.
        .....#.....
        ....###....
        ...#####...
      `),
      spade: art(`
        .....#.....
        ....###....
        ...#####...
        ..#######..
        .#########.
        ###########
        ###########
        .####.####.
        .....#.....
        ....###....
        ...#####...
      `),
    };
    // Little pips, for the card's corners and the burst.
    const SMALL = {
      heart: ['#.#', '###', '.#.'], diamond: ['.#.', '###', '.#.'], club: ['.#.', '###', '.#.'], spade: ['.#.', '###', '###'],
    };
    const MID = [(CW - 1) / 2, (CH - 1) / 2];
    const corner = (i, j) => (i === 0 || i === CW - 1) && (j === 0 || j === CH - 1);
    function back(i, j) {
      if (corner(i, j)) return null;
      if (i === 0 || i === CW - 1 || j === 0 || j === CH - 1) return '#';
      if (i === 1 || i === CW - 2 || j === 1 || j === CH - 2) return 'g';
      if (i === 2 || i === CW - 3 || j === 2 || j === CH - 3) return 'b';
      if (i === 3 || i === CW - 4 || j === 3 || j === CH - 4) return 'g';
      const u = Math.abs(i - MID[0]), v = Math.abs(j - MID[1]);
      if (u + v <= 3) return u + v === 0 ? 'w' : 'g';
      if (u + v === 4) return 'b';
      return u % 2 === 0 && v % 2 === 0 && (u + v) % 4 === 0 ? 'g' : 'b';
    }
    function face(i, j, suit) {
      if (corner(i, j)) return null;
      if (i === 0 || i === CW - 1 || j === 0 || j === CH - 1) return '#';
      const pip = PIPS[suit], [pw, ph] = size(pip), px0 = (CW - pw) >> 1, py0 = (CH - ph) >> 1;
      const ch = pip[j - py0] && pip[j - py0][i - px0];
      if (ch === '#') return SUIT_INK[suit];
      // A small pip in two corners, the bottom one upside down.
      const s = SMALL[suit];
      if (i >= 2 && i < 5 && j >= 2 && j < 5 && s[j - 2][i - 2] === '#') return SUIT_INK[suit];
      if (i >= CW - 5 && i < CW - 2 && j >= CH - 5 && j < CH - 2 && s[CH - 3 - j][CW - 3 - i] === '#') return SUIT_INK[suit];
      return 'w';
    }
    const FLIP = 18, TURNS = 5, BURST = 24;

    drollery('card', {
      span: [16, 0, 64, 60],
      h: 68,
      make: () => ({ up: null, flip: null, peek: 'heart', fold: 0, draws: 0, shownAt: -999 }),
      update(st, step, pointer) {
        st.fold = clamp(st.fold + (pointer && !st.up && !st.flip ? 1 : -1), 0, 8);
        if (st.flip && step - st.flip.born >= FLIP) {
          st.up = st.flip.to;
          if (st.up) st.shownAt = step;
          st.flip = null;
          if (!st.up) st.peek = SUITS.filter((s) => s !== st.peek)[Math.floor(R('suit', ++st.draws) * 3)];
        }
      },
      click(st, step) {
        if (st.flip) return;
        st.flip = { born: step, from: st.up, to: st.up ? null : st.peek };
      },
      draw(p, st, { step, calm }) {
        rule(p, 10, 66, BASE);
        const f = st.flip, t = f ? (step - f.born) / FLIP : 0;
        // Idle, it floats and turns a little, breathing light, with sparks
        // winking round it. A click spins it up into the air, turning over
        // and over, and it lands showing the other side.
        const spin = f ? Math.PI * TURNS * smooth(t) : calm ? 0 : Math.sin((step / 90) * TAU) * 0.5;
        const side = f ? (Math.floor((Math.PI * TURNS * smooth(t)) / Math.PI + 0.5) % 2 ? f.to : f.from) : st.up;
        const wd = Math.max(1, Math.round(CW * Math.abs(Math.cos(spin))));
        const float = calm ? 0 : Math.round(2 + Math.sin((step / 48) * TAU) * 2);
        const lift = (f ? Math.round(Math.sin(Math.PI * t) * 14) : 0) + float;
        const x0 = CX + ((CW - wd) >> 1), y0 = CY - lift, n = st.fold;
        const cx = CX + CW / 2, cy = y0 + CH / 2, ink = side ? SUIT_INK[side] : 'b';
        // Its shadow on the line, smaller the higher it goes.
        const sw = Math.max(3, 11 - (lift >> 1));
        for (let x = -sw; x <= sw; x++) p.px(cx + x, BASE - 1, 'f', 0.8);
        if (!calm) p.glow(cx, cy, 20, ink, 0.18 + 0.1 * Math.sin((step / 30) * TAU));
        for (let k = 0; k < wd; k++) {
          const i = Math.min(CW - 1, Math.floor(((k + 0.5) * CW) / wd));
          for (let j = 0; j < CH; j++) {
            let c = side ? face(i, j, side) : back(i, j);
            // At a hover a corner lifts, to peek at the suit underneath.
            if (!side && !f && n > 0) {
              const u = i - (CW - n), v = j;
              if (u >= 0 && v < n) {
                if (u > v) c = null;
                else if (u === v) c = '#';
                else c = u <= 2 && v >= n - 3 ? SUIT_INK[st.peek] : 'w';
              }
            }
            if (c) p.px(x0 + k, y0 + j, c);
          }
        }
        if (!calm) for (let k = 0; k < 3; k++) {
          const life = (step + k * 23) % 60, th = R('spark', k, Math.floor((step + k * 23) / 60)) * TAU;
          if (life > 20) continue;
          const sx = cx + Math.cos(th) * 18, sy = cy + Math.sin(th) * 22, a = 1 - Math.abs(life - 10) / 10;
          for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(sx + ox, sy + oy, ox || oy ? 'g' : 'glint', a);
        }
        // Revealed: rays and a ring burst off it, and little pips of its suit
        // fly out.
        const b = step - st.shownAt;
        if (st.up && b >= 0 && b < BURST) {
          const k = 1 - b / BURST, si = SUIT_INK[st.up];
          p.glow(cx, cy, 24, si, 0.5 * k);
          for (let r = 0; r < 16; r++) {
            const th = (r / 16) * TAU + b * 0.05;
            for (let d = 15 + b * 0.35; d < 15 + b * 0.35 + 7 * k; d++) p.px(cx + Math.cos(th) * d, cy + Math.sin(th) * d, r % 2 ? 'glint' : si, k);
          }
          const ring = 8 + b * 0.75;
          for (let r = 0; r < 90; r++) { const th = (r / 90) * TAU; p.px(cx + Math.cos(th) * ring, cy + Math.sin(th) * ring, 'glint', k); }
          for (let q = 0; q < 8; q++) {
            const th = (q / 8) * TAU + 0.4, d = 10 + b * 0.5;
            p.sprite(SMALL[st.up], Math.round(cx + Math.cos(th) * d) - 1, Math.round(cy + Math.sin(th) * d) - 1, { alpha: k, map: { '#': si } });
          }
        }
      },
    });
  }

  // ---------- Legacy: a statue and a pigeon ----------

  {
    const BASE = 66, PL = 27, PR = 49, TOP = 56, MID = 38;
    // An emperor in a breastplate, one arm raised to address the crowd, a
    // cloak over the other, and a little cupid on a dolphin at his feet.
    const HERO = art(`
      .#...............
      #f#..............
      #ff#.............
      #ff#.....ggg.....
      .#ff#...g###g....
      ..#ff#..#fff#....
      ...#ff#.#fff#....
      ....#ff#.#f#.....
      .....#ff##f##....
      ......#ffffffff#.
      .......#fffff#f#.
      .......#ffggf#f#.
      .......#fgggf#f#.
      .......#fffff#f#.
      .......#fffff#ff#
      .......#fffff#f#.
      .......#######ff#
      .......#f#f#f#f#f
      .......#f#f#f#f#f
      ........#f#.#f#f#
      ........#f#.#f#f#
      ........#f#.#f#f#
      ...##...#f#.#f#f#
      ..#ff#..#f#.#f#f#
      ...##.#.#f#..#f#f
      ..#ff##.#f#..#f#f
      ..#ff#..#f#..#f#.
      .##ff#..#f#...#f#
      #fff#..##f#...#f#
      .###...####...###
    `);
    const DOVE = art(`
      .........####...
      ........#ffff#..
      ........#fffff#g
      ........#ffff#..
      .........#ff#...
      ........#ffff#..
      .......#ffffff#.
      .....##fffffff#.
      ...##ffffffffff#
      .##fffffffffff#.
      #ffffffffffff#..
      .##ffffffff##...
      ...#########....
      .......#.#......
      ......##.##.....
    `);
    const BIRD = {
      perch: art(`
        .....##.
        ....###g
        ....bb..
        .######.
        #######.
        ..#.#...
      `),
      bob: art(`
        ........
        ........
        .....##.
        .####bbg
        #######.
        ..#.#...
      `),
      up: art(`
        .#......
        .##...##
        ..##.##g
        .######.
        ...#....
      `),
      down: art(`
        ......##
        .######g
        ..####..
        ..##....
        ...#....
      `),
    };
    // Each statue, and where on it a pigeon sits.
    const FORMS = { hero: { art: HERO, perch: [6, -3] }, dove: { art: DOVE, perch: [7, -6] } };
    const corner = (form) => { const [w, h] = size(FORMS[form].art); return [MID - (w >> 1), TOP - h]; };
    function pixels(form) {
      const [x0, y0] = corner(form), out = [];
      FORMS[form].art.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') out.push({ x: x0 + i, y: y0 + j, ink: ch }); }));
      return out;
    }
    const perch = (form) => { const [x0, y0] = corner(form), [px, py] = FORMS[form].perch; return [x0 + px, y0 + py]; };
    // The pigeon fades in and out up here, inside the frame.
    const ENTRY = [68, 3];
    function fly(b, mode, to, step) {
      b.fade = b.mode === 'away' ? 'in' : mode === 'out' ? 'out' : null;
      b.from = b.mode === 'away' ? ENTRY.slice() : [b.x, b.y];
      b.to = to; b.mode = mode; b.at = step;
    }

    drollery('legacy', {
      span: [15, 1, 74, 66],
      h: 72,
      make: () => ({ form: 'hero', next: 'dove', anim: null, bird: { mode: 'away', x: ENTRY[0], y: ENTRY[1], alpha: 0 } }),
      update(st, step) {
        const b = st.bird, an = st.anim;
        if (b.mode === 'in' || b.mode === 'out' || b.mode === 'land') {
          const k = smooth(clamp((step - b.at) / 24));
          b.x = lerp(b.from[0], b.to[0], k);
          b.y = Math.max(1, lerp(b.from[1], b.to[1], k) - Math.sin(k * Math.PI) * 4);
          b.alpha = b.fade === 'in' ? clamp(k * 2.5) : b.fade === 'out' ? clamp((1 - k) * 2.5) : 1;
          if (k >= 1) b.mode = { in: 'circle', out: 'away', land: 'perch' }[b.mode];
          if (b.mode === 'circle') b.at = step;
        } else if (b.mode === 'circle') {
          const ph = (step - b.at) * 0.07;
          b.x = MID - 4 + Math.cos(ph) * 18; b.y = 12 + Math.sin(ph) * 5;
        }
        if (!an) return;
        const a = step - an.born;
        if (an.kind === 'crumble') {
          for (const c of an.chunks) {
            if (c.rest || a < c.delay) continue;
            // How far down it can go at x, resting on whatever is under it.
            const floorAt = (x) => Math.min(...Object.keys(c.low).map((dx) => (an.hm[x + +dx] ?? BASE) - 1 - c.low[dx]));
            c.vy += 0.3;
            c.x += clamp(c.tx - c.x, -1, 1);
            const x = Math.round(c.x), here = floorAt(x);
            if (c.y + c.vy < here) { c.y += c.vy; continue; }
            // On something: it rolls off toward lower ground if there's any
            // close by, and otherwise settles, and the pile grows.
            c.y = here; c.vy = 0;
            const roll = [-2, 2].map((dx) => [dx, floorAt(clamp(x + dx, 4, W - 10))]).filter(([, f]) => f > here + 2).sort((u, v) => v[1] - u[1])[0];
            if (roll) { c.tx = c.x = clamp(x + Math.sign(roll[0]), 4, W - 10); continue; }
            c.x = x; c.rest = true;
            for (const b of c.bits) an.hm[x + b.dx] = Math.min(an.hm[x + b.dx] ?? BASE, here + b.dy);
          }
          if (an.chunks.every((c) => c.rest)) {
            const bits = an.chunks.flatMap((c) => c.bits.map((b) => ({ x: c.x + b.dx, y: c.y + b.dy, ink: b.ink })));
            st.form = 'rubble'; st.rubble = bits; st.anim = null;
            let top = BASE, tx = MID;
            for (const q of bits) if (q.y < top) { top = q.y; tx = q.x; }
            fly(b, 'land', [tx - 3, top - 6], step);
          }
        } else if (a > an.end) {
          st.form = an.to; st.rubble = null; st.anim = null;
          fly(b, 'land', perch(st.form), step);
        }
      },
      enter(st, step) { const b = st.bird; if (b.mode === 'away' || b.mode === 'out') fly(b, 'in', [MID - 4 + 18, 12], step); },
      leave(st, step) { const b = st.bird; if (b.mode === 'in' || b.mode === 'circle') fly(b, 'out', ENTRY, step); },
      click(st, step) {
        if (st.anim) return;
        if (st.form === 'rubble') {
          // The rubble flies up into a new statue, from the bottom.
          const to = st.next, goal = pixels(to).sort((p, q) => q.y - p.y || p.x - q.x);
          const src = st.rubble.slice().sort((p, q) => q.y - p.y || p.x - q.x);
          const bits = goal.map((g, i) => {
            const s = src[i % src.length];
            return { sx: s.x, sy: s.y, x: g.x, y: g.y, ink: g.ink, delay: (TOP - g.y) * 0.9 + R('rise', i) * 5 };
          });
          st.anim = { kind: 'assemble', born: step, to, bits, spare: src.slice(goal.length), end: Math.max(...bits.map((q) => q.delay)) + 14 };
          st.next = to === 'hero' ? 'dove' : 'hero';
          return;
        }
        // Down it comes, in chunks: blocks of the statue laid like bricks.
        const hm = {};
        for (let x = -2; x < W + 2; x++) hm[x] = x >= PL && x <= PR ? TOP : BASE;
        const [x0, y0] = corner(st.form), groups = new Map();
        for (const q of pixels(st.form)) {
          const row = Math.floor((q.y - y0) / 4), col = Math.floor((q.x - x0 + (row % 2) * 2) / 5), key = row + ',' + col;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(q);
        }
        const chunks = [...groups.values()].map((qs, i) => {
          const x = Math.min(...qs.map((q) => q.x)), y = Math.min(...qs.map((q) => q.y));
          // The lowest chunks go first, so the higher ones land on them.
          const bottom = Math.max(...qs.map((q) => q.y));
          const bits = qs.map((q) => ({ dx: q.x - x, dy: q.y - y, ink: q.ink })), low = {};
          for (const b of bits) low[b.dx] = Math.max(low[b.dx] ?? -1, b.dy);
          return { x, y, tx: clamp(x + Math.round((R('vx', i, step) - 0.5) * 18), 4, W - 10), vy: 0, delay: Math.round((TOP - bottom) * 0.4 + R('d', i, step) * 2), bits, low };
        });
        st.anim = { kind: 'crumble', born: step, chunks, hm };
      },
      draw(p, st, { step, calm, pointer }) {
        rule(p, 4, 70, BASE);
        // The plinth, with a gold plaque.
        p.region((x, y) => (y >= TOP && y <= TOP + 1 && x >= PL && x <= PR) || (y > TOP + 1 && y < BASE - 2 && x >= PL + 2 && x <= PR - 2) || (y >= BASE - 2 && y < BASE && x >= PL && x <= PR), [PL, TOP, PR, BASE - 1], 'f', '#');
        for (let x = MID - 4; x <= MID + 4; x++) for (const y of [TOP + 4, TOP + 5]) p.px(x, y, 'g');

        const an = st.anim, a = an ? step - an.born : 0;
        if (!an && st.form !== 'rubble') for (const q of pixels(st.form)) p.px(q.x, q.y, q.ink);
        if (st.form === 'rubble' && !an) for (const q of st.rubble) p.px(q.x, q.y, q.ink);
        if (an && an.kind === 'crumble') for (const c of an.chunks) for (const b of c.bits) p.px(Math.round(c.x) + b.dx, Math.round(c.y) + b.dy, b.ink);
        if (an && an.kind === 'assemble') {
          for (const q of an.spare) p.px(q.x, q.y, q.ink, clamp(1 - a / 20));
          for (const q of an.bits) {
            const k = smooth(clamp((a - q.delay) / 14));
            p.px(lerp(q.sx, q.x, k), lerp(q.sy, q.y, k) - Math.sin(k * Math.PI) * 5, k < 1 ? 'f' : q.ink);
          }
        }

        const b = st.bird;
        if (b.mode === 'away') return;
        let rows, flip = false;
        if (b.mode === 'perch') rows = pointer && !calm && (step >> 3) % 2 ? BIRD.bob : BIRD.perch;
        else {
          rows = (step >> 2) % 2 ? BIRD.up : BIRD.down;
          if (b.mode === 'circle') flip = Math.sin((step - b.at) * 0.07) > 0;
          else flip = b.to[0] < b.from[0];
        }
        p.sprite(rows, Math.round(b.x), Math.round(b.y), { flip, alpha: b.alpha ?? 1 });
      },
    });
  }
})();
