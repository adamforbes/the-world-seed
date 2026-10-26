// The Era mascots, for the rules page: one beside each Era's heading, built
// on its suit and inked in its suit's colour. They're made like the margin
// drolleries, with the same runtime and rules (load after marginalia.js), and
// are a little bigger. Decorative only.
//
//   m-myth       ♥ a walking anatomical heart, on bird legs, that buds
//                little hearts which toddle off
//   m-antiquity  ♦ a sage whose head is a cut diamond, who unrolls a scroll
//                and sends its runes round his head and into the gem
//   m-ruin       ♣ a bald, muscled woman in black leather with a club, who
//                flexes at a hover and at a click slams it on her own head
//                and gets pumped
//   m-promise    ♠ a tall, skittish cormorant with a coin in its bill, who
//                leans away from the pointer and at a click leaps and flaps

(function () {
  const { TAU, clamp, lerp, smooth } = SceneKit;
  const { drollery, art, size, rule, R } = Margins;

  // Fades a figure out as it nears the sides, so nothing meets the frame.
  const inside = (x, w, lo = 4, hi = 76) => clamp(Math.min(x - lo, hi - (x + w)) / 6);

  // A dark figure: filled with 'k' and edged in ink, so it stays dark on dark
  // paper.
  function inked(p, rows, x, y, { flip = false, map = {} } = {}) {
    const [w] = size(rows);
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      const X = x + (flip ? w - 1 - i : i);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(X + dx, y + j + dy, '#');
    }));
    p.sprite(rows, x, y, { flip, map: { '#': 'k', ...map } });
  }

  // A tube along a path of points, `r` thick, edged in ink. All the edges go
  // down before any of the fill, so the joins stay clean.
  function tube(p, pts, r, ink, at = (x, y) => [x, y]) {
    for (const [rr, c] of [[r + 1, '#'], [r, ink]]) for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let k = 0; k <= n; k++) {
        const cx = lerp(x0, x1, k / n), cy = lerp(y0, y1, k / n), e = Math.ceil(rr);
        for (let dy = -e; dy <= e; dy++) for (let dx = -e; dx <= e; dx++) {
          if (dx * dx + dy * dy <= rr * rr + 0.5) p.px(...at(Math.round(cx + dx), Math.round(cy + dy)), c);
        }
      }
    }
  }

  // ---------- Myth ♥: a walking heart ----------

  {
    const BASE = 58, HW = 26, LEGS = 10, TOP = 19;
    const HIPS = [[8, 28], [13, 26]];
    // The heart, drawn from its parts: the aorta arching over the top with
    // three branches, the vena cava and the pulmonary trunk in blue, the body
    // tapering to an apex low on the left, fat in its groove and vessels over
    // it. `swell` is the beat.
    const midAt = (y) => 13 - (y - 10) * 0.18;
    const half = (y) => (y < 15 ? 10.5 * Math.sqrt(Math.max(0, 1 - ((15 - y) / 6.5) ** 2)) : 10.5 * Math.pow(Math.max(0, 1 - (y - 15) / 15), 0.75));
    function heart(p, ox, oy, flip, swell) {
      const at = (x, y) => [flip ? ox + HW - 1 - x : ox + x, oy + y];
      tube(p, [[14, 11], [14, 4], [12, 1.6], [9, 1.6], [7, 3.5], [7, 9]], 1.6, 'r', at);
      for (const pts of [[[9.5, 1], [9, -2]], [[11.5, 0.5], [11.5, -2.5]], [[13.5, 1], [14.5, -1.5]]]) tube(p, pts, 0.5, 'r', at);
      tube(p, [[19, 11], [19, 1.5]], 1.5, 'b', at);
      tube(p, [[11, 10], [8, 7], [4, 6.5]], 1.4, 'b', at);
      const inBody = (x, y) => y >= 8.5 - swell && Math.abs(x - midAt(y)) <= half(y) + swell * (y < 15 ? 1 : 0.6);
      for (let y = 6; y <= 32; y++) for (let x = -1; x <= HW; x++) {
        if (!inBody(x, y)) continue;
        const rim = !inBody(x - 1, y) || !inBody(x + 1, y) || !inBody(x, y - 1) || !inBody(x, y + 1);
        const d = (x - midAt(y)) / Math.max(1, half(y));
        let ink = rim ? '#' : d < -0.45 ? 'm' : d > 0.4 && d < 0.65 && y > 11 && y < 20 ? 'p' : 'r';
        if (!rim && y >= 10 && y <= 12 && R('fat', x, y) < 0.55) ink = 'g';
        p.px(...at(x, y), ink);
      }
      // Vessels over the surface.
      for (const [pts, ink] of [[[[14, 12], [12.5, 18], [10, 27]], 'm'], [[[13, 16], [17, 22]], 'm'], [[[17, 12], [20, 19]], 'b']]) {
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
          for (let k = 0; k <= n; k++) p.px(...at(Math.round(lerp(x0, x1, k / n)), Math.round(lerp(y0, y1, k / n))), ink);
        }
      }
    }
    const BUD = art(`
      .##.##.
      #rr#rr#
      #rrrrr#
      .#rrr#.
      ..#r#..
    `);

    // A bird's leg: back to the knee, forward to a three-toed foot.
    function leg(p, x, y, face, stride) {
      const kx = x - 2 * face, ky = y + Math.round(LEGS / 2), fx = x + stride, fy = BASE - 1;
      p.line(x, y, kx, ky, '#');
      p.line(kx, ky, fx, fy, '#');
      p.line(fx, fy, fx + 2 * face, fy, '#');
      p.px(fx - face, fy, '#');
    }

    drollery('myth', {
      span: [3, 14, 80, 58],
      h: 64,
      make: () => ({ x: 24, dir: 1, face: 1, rest: 0, buds: [] }),
      update(st, step, pointer) {
        // It wanders back and forth, stopping now and then, and stands still to
        // watch you.
        if (pointer) st.face = pointer[0] >= st.x + HW / 2 ? 1 : -1;
        else if (step >= st.rest) {
          st.x += st.dir * 0.22;
          st.face = st.dir;
          if (st.x > 44 || st.x < 8) { st.dir *= -1; st.rest = step + 40; }
          else if (R('stop', step) < 0.004) st.rest = step + 30;
        }
        for (const b of st.buds) if (step - b.born > 14) b.x += b.dir * 0.35;
        st.buds = st.buds.filter((b) => inside(b.x, 7) > 0 || step - b.born < 20);
      },
      click(st, step) {
        if (st.buds.length >= 4) return;
        const dir = st.face, x = st.x + HW / 2 + dir * 9;
        st.buds.push({ born: step, sx: x, sy: TOP + 14, x: x + dir * 8, dir });
      },
      draw(p, st, { step, calm, pointer }) {
        rule(p, 4, 70, BASE);
        const walking = !pointer && step >= st.rest && !calm;
        const x = Math.round(st.x), bob = walking && (step >> 2) % 2 ? 1 : 0;
        const cycle = pointer ? 12 : 26, ph = step % cycle;
        const swell = !calm && (ph < 3 || (ph >= 5 && ph < 7)) ? 1 : 0;
        const stride = walking ? (Math.floor(step / 6) % 2 ? 2 : -2) : 0;
        const flip = st.face < 0;
        HIPS.forEach(([hx, hy], i) => leg(p, flip ? x + HW - 1 - hx : x + hx, TOP + hy - bob, st.face, i ? -stride : stride));
        heart(p, x, TOP - bob, flip, swell);

        // Its buds pop out of its side and toddle off.
        for (const b of st.buds) {
          const a = step - b.born;
          let bx = b.x, by = BASE - 8;
          if (a < 14) {
            const k = smooth(a / 14);
            bx = lerp(b.sx, b.x, k);
            by = lerp(b.sy, BASE - 8, k) - Math.sin(k * Math.PI) * 6;
          }
          const al = a < 14 ? 1 : inside(bx, 7), tod = a >= 14 && (step >> 2) % 2 ? 1 : 0;
          const ix = Math.round(bx);
          p.sprite(BUD, ix, Math.round(by) - tod, { alpha: al });
          if (a >= 14) { p.px(ix + 2 + tod, BASE - 2, '#', al); p.px(ix + 4 - tod, BASE - 2, '#', al); p.px(ix + 3, BASE - 3, '#', al); }
        }
      },
    });
  }

  // ---------- Antiquity ♦: a diamond-headed sage with a scroll ----------

  {
    const BASE = 66, CX = 40;
    // His head is a cut gold diamond; G marks its brightest facets.
    const GEM = art(`
      .....#.....
      ....#G#....
      ...#GgG#...
      ..#GgggG#..
      .#########.
      #ggGgggGgg#
      .#gGgggGg#.
      ..#gGgGg#..
      ...#gGg#...
      ....#g#....
      .....#.....
    `);
    // A crimson robe with a gold collar, a jade belt and a gold hem.
    const ROBE = art(`
      ......####......
      .....#gggg#.....
      ...##rrrrrr##...
      ..#mrrrrrrrrr#..
      ..#mrrrrrrrrr#..
      ..#mrrrrrrrrr#..
      ..#mrrrrrrrrr#..
      ..#mrrrrrrrrr#..
      ..#gvgvgvgvgv#..
      ..#mrrrrrrrrr#..
      ..#mrrrrrrrrr#..
      .#mmrrrrrrrrrr#.
      .#mmrrrrrrrrrr#.
      .#mmrrrrrrrrrr#.
      .#mmrrrrrrrrrr#.
      #mmmrrrrrrrrrrr#
      #mmmrrrrrrrrrrr#
      #gggggggggggggg#
      ################
    `);
    const [RW, RH] = size(ROBE), [EW, EH] = size(GEM);
    const RX = CX - (RW >> 1), RY = BASE - RH, EX = CX - (EW >> 1), EY = RY - EH + 1;
    const CORE = [CX, EY + 5];
    const SHOULDERS = [[RX + 3, RY + 3], [RX + RW - 4, RY + 3]];
    const RUNES = 8, READ = 78;
    // Each rune: which of its three pixels are inked, and when it lifts off.
    const rune = (i) => [0, 1, 2].map((j) => R('rune', i, j) < 0.65);
    const lift = (i) => 18 + i * 2;
    // How far the scroll is open (0 to 1) at a step into a reading.
    const open = (a) => (a < 0 || a >= READ ? 0 : a < 12 ? smooth(a / 12) : a < 64 ? 1 : 1 - smooth((a - 64) / 12));

    drollery('antiquity', {
      span: [9, 9, 64, 66],
      h: 72,
      make: () => ({ readAt: -999 }),
      click(st, step) { if (step - st.readAt >= READ) st.readAt = step; },
      draw(p, st, { step, calm, pointer }) {
        const a = step - st.readAt, k = open(a);
        rule(p, 4, 72, BASE);
        // A few gold motes drifting up.
        if (!calm) for (let i = 0; i < 8; i++) {
          const life = 180 + R('life', i) * 80, age = (step + R('mote', i) * life) % life;
          const y = 64 - age * 0.32;
          if (y > 6) p.px(10 + R('mx', i) * 60 + Math.sin(age * 0.05 + i) * 2, y, 'g', clamp(Math.min(age / 20, (y - 6) / 12)) * 0.8);
        }
        p.sprite(ROBE, RX, RY);

        // Arms in wide sleeves, holding the scroll; they spread to open it and
        // raise it a little at a hover.
        const up = pointer && a >= READ ? 2 : Math.round(2 * k);
        const hy = RY + 9 - up;
        const hands = [[CX - 3 - 12 * k, hy], [CX + 2 + 12 * k, hy]];
        const elbows = [[RX - 2 * k, RY + 8 - 2 * k], [RX + RW - 1 + 2 * k, RY + 8 - 2 * k]];
        // Maroon sleeves against the crimson robe, with gold cuffs.
        for (const i of [0, 1]) {
          tube(p, [SHOULDERS[i], elbows[i], hands[i]], 1.4, 'm');
          const [cx, cy] = [lerp(hands[i][0], elbows[i][0], 0.3), lerp(hands[i][1], elbows[i][1], 0.3)];
          for (const [ox, oy] of [[0, -1], [0, 0], [0, 1]]) p.px(cx + ox, cy + oy, 'g');
        }
        // The scroll: gold rollers in his hands and the paper between them,
        // with its runes, until they lift off.
        const [lx, rx] = [Math.round(hands[0][0]), Math.round(hands[1][0])], py = Math.round(hy);
        for (let x = lx + 1; x < rx; x++) for (let y = py - 2; y <= py + 2; y++) p.px(x, y, y === py - 2 || y === py + 2 ? '#' : 'w');
        if (k > 0.9) for (let i = 0; i < RUNES; i++) {
          if (a >= lift(i)) continue;
          rune(i).forEach((on, j) => { if (on) p.px(lx + 3 + i * 3, py - 1 + j, 'g'); });
        }
        for (const x of [lx, rx]) for (let y = py - 3; y <= py + 3; y++) p.px(x, y, Math.abs(y - py) === 3 ? '#' : 'g');
        for (const [x, y] of hands) { p.px(x - 0.5, y, 'p'); p.px(x + 0.5, y, 'p'); p.px(x - 0.5, y + 1, 'p'); p.px(x + 0.5, y + 1, 'p'); }

        // The runes rise off the paper, circle his head, and sink into the
        // gem, which flares.
        for (let i = 0; i < RUNES; i++) {
          const t = a - lift(i);
          if (a >= READ || t < 0 || a > 62) continue;
          const th = (i / RUNES) * TAU + (a - 18) * 0.13;
          const rr = 11 * (1 - smooth(clamp((a - 50) / 10)));
          const orbit = [CORE[0] + Math.cos(th) * rr, CORE[1] + Math.sin(th) * rr * 0.8];
          const from = [lx + 3 + i * 3, py];
          const m = smooth(clamp(t / 8));
          const x = lerp(from[0], orbit[0], m), y = lerp(from[1], orbit[1], m);
          rune(i).forEach((on, j) => { if (on) p.px(x, y - 1 + j, (step + i) % 6 < 3 ? 'glint' : 'g'); });
        }
        const flare = a >= 58 && a < 70 ? 1 - (a - 58) / 12 : 0;
        if (flare > 0) {
          p.glow(CORE[0], CORE[1], 16, 'g', 0.6 * flare);
          for (let i = 0; i < 8; i++) {
            const th = (i / 8) * TAU + 0.4;
            for (let r = 8; r < 8 + 6 * flare; r++) p.px(CORE[0] + Math.cos(th) * r, CORE[1] + Math.sin(th) * r, 'g', flare);
          }
        }
        // The gem head: its bright facets shimmer, blaze at a hover, flash at
        // the end of a reading.
        const shimmer = !calm && (step >> 4) % 3 === 0;
        p.sprite(GEM, EX, EY, { map: { G: pointer || shimmer || flare ? 'glint' : 'g', g: flare > 0.5 ? 'glint' : 'g' } });
      },
    });
  }

  // ---------- Ruin ♣: a muscled woman in black leather with a club ----------

  {
    const BASE = 52, WX = 31;
    // Bald and built, facing us: a shine on her head, a stern mouth, a
    // studded collar, broad shoulders, a leather top crossed by a studded
    // harness, a belt with a gold buckle, leather breeches and buckled boots.
    // Her arms are drawn on their own. E eyes, M mouth.
    const WOMAN = art(`
      .......####.......
      ......#pwpp#......
      .....#pppppp#.....
      .....#pEppEp#.....
      .....#pppppp#.....
      .....#ppMMpp#.....
      ......#pppp#......
      .......#pp#.......
      ......#gkkg#......
      ....##pkkkkp##....
      ...#ppkkkkkkpp#...
      .....#gkkkkg#.....
      .....#kgkkgk#.....
      .....#kkggkk#.....
      .....#kgkkgk#.....
      ......#kkkk#......
      .....#kkgkkk#.....
      ....#kkkkkkkk#....
      ....#kkk##kkk#....
      ...#kkk#..#kkk#...
      ...#kkk#..#kkk#...
      ...#kkk#..#kkk#...
      ...#kgk#..#kgk#...
      ...#kkk#..#kkk#...
      ..#kkkk#..#kkkk#..
      ..######..######..
    `);
    const WY = BASE - WOMAN.length, NECK = 8, TOP = [WX + 8.5, WY - 1];
    const SHOULDERS = [[WX + 4, WY + 10], [WX + 13, WY + 10]];
        // A muscled arm through elbow to fist, edged before it's filled, the
    // forearm in a black bracer.
    function arm(p, s, e, h, X, flex = 0) {
      const seg = (a, b, r0, r1, ink) => {
        const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2), pts = [];
        for (let k = 0; k <= n; k++) pts.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n), lerp(r0, r1, k / n) + (ink === 'p' ? flex * Math.sin((k / n) * Math.PI) : 0), ink]);
        return pts;
      };
      const pts = [...seg(s, e, 1.8, 1.5, 'p'), ...seg(e, h, 1.4, 1.2, 'k')];
      for (const [grow, own] of [[1, false], [0, true]]) for (const [x, y, r, ink] of pts) {
        const rr = r + grow, k = Math.ceil(rr);
        for (let oy = -k; oy <= k; oy++) for (let ox = -k; ox <= k; ox++) if (ox * ox + oy * oy <= rr * rr) p.px(X(x + ox), y + oy, own ? ink : '#');
      }
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) p.px(X(h[0] + ox), h[1] + oy, Math.abs(ox) + Math.abs(oy) === 2 ? '#' : 'p');
    }
    // The club: one thick black cudgel, thin at the grip and swelling to a
    // rounded head, with a gold band and a shine down it. From the hand, at
    // angle `th` (radians, 0 points right).
    const CLUB = 12;
    function club(p, [hx, hy], th) {
      const dx = Math.cos(th), dy = Math.sin(th), pts = [];
      for (let i = 0; i <= CLUB * 2; i++) {
        const t = i / (CLUB * 2);
        pts.push([hx + dx * t * CLUB, hy + dy * t * CLUB, t < 0.25 ? 0.9 : lerp(1, 2.8, Math.sin(((t - 0.25) / 0.75) * Math.PI * 0.6))]);
      }
      for (const [grow, ink] of [[1, '#'], [0, 'k']]) for (const [x, y, r] of pts) {
        const rr = r + grow, e = Math.ceil(rr);
        for (let oy = -e; oy <= e; oy++) for (let ox = -e; ox <= e; ox++) if (ox * ox + oy * oy <= rr * rr) p.px(x + ox, y + oy, ink);
      }
      for (let t = 0.45; t < 0.95; t += 0.06) p.px(hx + dx * t * CLUB - dy, hy + dy * t * CLUB + dx, 'f');
      p.line(hx + dx * 3 - dy * 1.2, hy + dy * 3 + dx * 1.2, hx + dx * 3 + dy * 1.2, hy + dy * 3 - dx * 1.2, 'g');
    }
    // A hit, step by step, like a game's punch: a snap up, a two-frame slam
    // on her own head, a frozen beat on the hit, then she's pumped. Where her
    // club hand is and which way the club points.
    const REST = { hand: [WX + 3, WY + 15], th: -2.05 };
    const KEYS = [
      { at: 0, ...REST },
      { at: 3, hand: [WX + 3, WY + 2], th: -2.4 },
      { at: 5, hand: [WX + 2, WY - 1], th: 0 },
      { at: 9, hand: [WX + 2, WY - 1], th: 0 },
      { at: 13, hand: [WX + 1, WY - 3], th: -1.35 },
      { at: 30, hand: [WX + 1, WY - 3], th: -1.35 },
      { at: 36, ...REST },
    ];
    const HIT = 5, FREEZE = 9, PUMPED = 30, BONK = 36;
    function clubAt(a) {
      if (a < 0 || a >= BONK) return REST;
      let i = 0;
      while (KEYS[i + 1].at <= a) i++;
      const A = KEYS[i], B = KEYS[i + 1], t = (a - A.at) / (B.at - A.at), k = A.at === 3 ? t : smooth(t);
      return { hand: [lerp(A.hand[0], B.hand[0], k), lerp(A.hand[1], B.hand[1], k)], th: lerp(A.th, B.th, k) };
    }

    drollery('ruin', {
      span: [21, 6, 56, 52],
      h: 56,
      make: () => ({ bonkAt: -999, blinkAt: 30, combo: 0 }),
      update(st, step) { if (step > st.blinkAt + 4) st.blinkAt = step + 60 + Math.floor(R('blink', step) * 90); },
      // Hit her again as soon as the freeze is over to chain it.
      click(st, step) {
        const a = step - st.bonkAt;
        if (a >= 0 && a < FREEZE) return;
        st.combo = a < BONK ? st.combo + 1 : 0;
        st.bonkAt = step;
      },
      draw(p, st, { step, calm, pointer }) {
        const a = step - st.bonkAt, bonking = a >= 0 && a < BONK;
        rule(p, 4, 72, BASE);
        const X = (x) => x;
        const hit = bonking && a >= HIT && a < FREEZE, pumped = bonking && a >= FREEZE && a < PUMPED;
        // The hit freezes her, shaking; pumped, she bounces on her toes.
        const shake = hit && !calm ? (step % 2 ? 1 : -1) : 0;
        const bounce = pumped && !calm && (step >> 1) % 2 ? -1 : 0;
        const squash = hit ? 1 : 0;
        const ox = shake, oy = bounce;
        const blink = !calm && step - st.blinkAt >= 0 && step - st.blinkAt < 4;
        const eye = hit || pumped ? 'r' : blink ? 'p' : '#';
        const c = clubAt(bonking ? a : -1);
        const hand = [c.hand[0] + ox, c.hand[1] + oy];
        // A red aura flickering up round her while she's pumped.
        if (pumped && !calm) for (let k = 0; k < 14 + Math.min(st.combo, 4) * 4; k++) {
          const t = (step * 2 + k * 7) % 14, x = WX + 2 + R('aura', k) * 14, y = WY + 24 - t * 2 - R('auy', k) * 6;
          p.px(x + ox, y + oy, k % 3 ? 'r' : 'o', 1 - t / 14);
        }
        const resting = !bonking || a >= BONK - 3;
        if (resting) club(p, hand, c.th);
        WOMAN.forEach((row, j) => p.sprite([row], WX + ox, WY + j + oy + (j < NECK ? squash : 0), { map: { E: eye, M: pumped ? 'm' : '#' } }));
        // Her club arm, and the other: hanging, flexed at a hover, and both up
        // in a double flex when she's pumped.
        const so = (s) => [s[0] + ox, s[1] + oy];
        arm(p, so(SHOULDERS[0]), [WX + 1 + ox, (SHOULDERS[0][1] + hand[1]) / 2 + 1 + oy], hand, X, pumped ? 0.6 : 0);
        const rs = so(SHOULDERS[1]);
        if (pumped || (pointer && !bonking)) arm(p, rs, [WX + 18 + ox, WY + 9 + oy], [WX + 16 + ox, WY + 4 + oy], X, 0.8);
        else arm(p, rs, [WX + 16 + ox, WY + 14 + oy], [WX + 15 + ox, WY + 17 + oy], X);
        if (!resting) club(p, hand, c.th);
        // The hit: a burst of light and a ring off her head.
        if (hit) {
          const t = a - HIT, [cx, cy] = [TOP[0] + ox, TOP[1] + 1];
          p.glow(cx, cy, 10, 'o', 0.6 * (1 - t / 4));
          for (let k = 0; k < 10; k++) {
            const th = (k / 10) * TAU + 0.3;
            for (let r = 3 + t; r < 7 + t * 2.5; r++) p.px(cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.7, k % 2 ? 'glint' : 'o', 1 - t / 4);
          }
        }
        // Pumped: steam off her head.
        if (pumped && !calm) for (let k = 0; k < 4; k++) {
          const t = (a - FREEZE + k * 4) % 12;
          p.px(TOP[0] + (k - 1.5) * 3 + ox + Math.sin(t + k) * 0.8, TOP[1] - t * 0.7 + oy, 'f', 1 - t / 12);
        }
      },
    });
  }

  // ---------- Promise ♠: a skittish cormorant with a coin ----------

  {
    const BASE = 64, CX0 = 30;
    // Tall and gaunt, facing right: a long hooked grey bill with a gold
    // throat, a pale staring eye (E), a long S of a neck, hunched shoulders,
    // black plumage marked with a lapis spade, a drooping tail and long legs.
    const BIRD = art(`
      .........##.......
      ........#kk#......
      .......#kkEk####..
      .......#kkkgffff#.
      ........#kk#....#.
      ........#kk#......
      .........#kk#.....
      .........#kk#.....
      ........#kk#......
      .......#kk#.......
      .......#kk#.......
      ........#kk#......
      ........#kkk#.....
      .......#kkkkk#....
      ......#kkkkkkk#...
      .....#kkkkkkkkk#..
      ....#kkkkkbkkkkk#.
      ....#kkkkbbbkkkk#.
      ....#kkkbbbbbkkk#.
      ....#kkkbkbkbkkk#.
      ....#kkkkkbkkkkk#.
      ....#kkkkbbbkkkk#.
      ...#kkkkkkkkkkk#..
      ...#kkkkkkkkkkk#..
      ..#kkkkkkkkkkk#...
      .#kkkkkkkkkk#.....
      #kkk#.#kkkkk#.....
      #kk#..#kkkk#......
      #k#....#k#k#......
      .......#k#k#......
      .......#k#k#......
      .......#k#k#......
      ......##k##k#.....
    `);
    const [BW, BH] = size(BIRD);
    const BY0 = BASE - BH, SHOULDER = [8, 16], BILL = [16, 5], FLY = 30;
    // A spade, for the feathers.
    const MARK = (p, x, y, X) => { p.px(X(x), y - 1, 'b'); p.px(X(x - 1), y, 'b'); p.px(X(x), y, 'b'); p.px(X(x + 1), y, 'b'); p.px(X(x), y + 1, 'b'); };
    // A wing spread from the shoulder: up, level or down by `angle` (0 is
    // straight back), long-feathered, a spade on each feather.
    function wing(p, [sx, sy], angle, X) {
      const d = [-Math.cos(angle), Math.sin(angle)], n = [-d[1], d[0]];
      const at = (u, v) => [sx + d[0] * u + n[0] * v, sy + d[1] * u + n[1] * v];
      const pts = [at(0, -1.5), at(6, -3), at(16, -1.5), at(17, 0), at(14, 3), at(10, 3.5), at(6, 4), at(1, 2.5)];
      const inPoly = (x, y) => {
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.max(...ys) + 1; y++) for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.max(...xs) + 1; x++) {
        if (!inPoly(x, y)) continue;
        const rim = !inPoly(x - 1, y) || !inPoly(x + 1, y) || !inPoly(x, y - 1) || !inPoly(x, y + 1);
        p.px(X(x), y, rim ? 'e' : 'k');
      }
      for (const u of [6, 10, 14]) { const [x, y] = at(u, 1); MARK(p, x, y, (v) => v); }
    }
    // The coin: a gold disc, edge-on as it spins.
    function coin(p, x, y, spin) {
      const w = [1, 1, 0, 1][spin % 4];
      for (let oy = -1; oy <= 1; oy++) for (let ox = -w; ox <= w; ox++) p.px(x + ox, y + oy, ox === 0 && oy === -1 ? 'glint' : 'o');
    }

    drollery('promise', {
      span: [21, 12, 57, 64],
      h: 72,
      make: () => ({ flyAt: -999, blinkAt: 40 }),
      update(st, step) { if (step > st.blinkAt + 4) st.blinkAt = step + 70 + Math.floor(R('blink', step) * 100); },
      click(st, step) { if (step - st.flyAt >= FLY) st.flyAt = step; },
      draw(p, st, { step, calm, pointer }) {
        const a = step - st.flyAt, flying = a >= 0 && a < FLY;
        rule(p, 4, 72, BASE);
        // Skittish of the pointer: it stares at it, leans away from it, and
        // trembles when it gets close.
        const cx = CX0 + BW / 2;
        let face = 1, lean = 0, shiver = 0;
        if (pointer && !flying) {
          const dx = pointer[0] - cx, near = Math.hypot(dx, pointer[1] - (BY0 + 10));
          face = dx >= 0 ? 1 : -1;
          lean = -face * Math.round(clamp(36 / Math.max(near, 8), 0, 4));
          if (near < 24 && !calm) shiver = step % 2 ? 1 : -1;
        } else if (!calm && R('look', Math.floor(step / 120)) < 0.3) face = -1;
        const X = (x) => (face > 0 ? x : 2 * CX0 + BW - 1 - x);
        // A click: a crouch, a leap, quick hard wingbeats, and back down, the
        // coin tossed up spinning and caught again in its bill.
        let hop = 0, beat = null;
        if (flying) {
          if (a < 2) hop = 1;
          else if (a < 6) hop = -Math.round(9 * smooth((a - 2) / 4));
          else if (a < 20) { beat = Math.floor((a - 6) / 2) % 2; hop = -9 + (beat ? 1 : 0); }
          else if (a < 27) { hop = -Math.round(9 * (1 - smooth((a - 20) / 7))); beat = 2; }
          else hop = a < 29 ? 1 : 0;
        }
        const y0 = BY0 + hop;
        const sh = [CX0 + SHOULDER[0], y0 + SHOULDER[1]];
        // Wings beat up and back, clear of its neck, and down.
        const angle = beat === 0 ? -0.85 : beat === 1 ? 1.1 : 0.15;
        if (beat !== null) wing(p, [sh[0] + 2, sh[1] - 1], angle + (beat === 2 ? 0 : 0.2), X);
        const eye = pointer ? 'glint' : !calm && step - st.blinkAt >= 0 && step - st.blinkAt < 3 ? 'k' : 'w';
        BIRD.forEach((row, j) => {
          const dx = Math.round((lean * (BH - 1 - j)) / (BH - 1)) + shiver;
          p.sprite([row], CX0 + face * dx, y0 + j, { flip: face < 0, map: { E: eye, '#': 'e' } });
        });
        if (beat !== null) wing(p, sh, angle, X);
        // The coin in its bill, or in the air.
        const bill = [X(CX0 + BILL[0] + Math.round(lean * (BH - 1 - BILL[1]) / (BH - 1)) * face) + 0, y0 + BILL[1] + 1];
        if (flying && a >= 4 && a < 22) {
          const t = (a - 4) / 18;
          coin(p, bill[0] + face * 2, bill[1] - Math.sin(t * Math.PI) * 14, a);
        } else coin(p, bill[0] + shiver, bill[1], calm ? 0 : (step >> 3) % 2 ? 1 : 0);
      },
    });
  }
})();
