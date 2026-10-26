// Shared helpers for the scenes in art/scenes/, and the runtime that plays
// interactive ones live on the site.
//
// A scene calls SceneKit.mount({...}) with its size, frame count and a
// draw(ctx, frame, theme) function. Opened normally, the page plays the loop
// with preview controls. Opened with ?export, it shows only the canvas and
// exposes window.SCENE for render.mjs to step through frame by frame.
//
// An interactive scene also has render(ctx, step, theme, { calm, time }) and
// any of update(step), hover(x, y), click(x, y), cursor() and reset(), and is announced with
// SceneKit.register(scene). With touchHover set, a first tap on a touch screen
// plays its hover and a second its click. Any element on the page with a matching
// data-scene attribute then gets a live canvas (see live() below). Its
// preview page can call mount() as usual, and ?live plays it interactively.

(function () {
  const TAU = Math.PI * 2;

  // Seeded PRNG (mulberry32), so every render of a frame is identical.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Stable positive integer from any mix of strings and numbers. Rough.js
  // seeds must be > 0.
  function hash(...parts) {
    let h = 2166136261;
    for (const part of parts) {
      const s = String(part);
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      h ^= 0x9e3779b9;
    }
    return ((h >>> 0) % 2147483646) + 1;
  }

  // Loop-safe motion. `cycles` must be a whole number so frame 0 follows the
  // last frame without a jump.
  const wave = (t, cycles = 1, phase = 0) => Math.sin(TAU * (t * cycles + phase));
  const cycle = (t, cycles = 1, phase = 0) => {
    const p = t * cycles + phase;
    return p - Math.floor(p);
  };

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const smooth = (k) => k * k * (3 - 2 * k);

  // Organic closed outline: an ellipse whose radius wobbles with a few seeded
  // harmonics, plus optional lobes (positive amount) and bays (negative).
  // Angles are in radians, 0 = east, PI/2 = south.
  function blob({ cx, cy, rx, ry, seed, wobble = 0.16, harmonics = 5, n = 96, lobes = [] }) {
    const r = rng(seed);
    const terms = [];
    for (let k = 2; k < 2 + harmonics; k++) {
      terms.push({ k, a: (wobble * (r() * 2 - 1)) / Math.sqrt(k - 1), p: r() * TAU });
    }
    const radius = (th) => {
      let v = 1;
      for (const term of terms) v += term.a * Math.sin(term.k * th + term.p);
      for (const lobe of lobes) {
        const d = Math.atan2(Math.sin(th - lobe.at), Math.cos(th - lobe.at));
        v += lobe.amount * Math.exp(-(d * d) / (2 * lobe.width * lobe.width));
      }
      return v;
    };
    const at = (th, grow = 0) => {
      const v = radius(th);
      return [cx + Math.cos(th) * (rx * v + grow), cy + Math.sin(th) * (ry * v + grow)];
    };
    const points = (grow = 0, count = n) =>
      Array.from({ length: count }, (_, i) => at((i / count) * TAU, grow));
    // Inside test with an optional margin in pixels (positive = further in).
    const contains = (x, y, margin = 0) => {
      const th = Math.atan2((y - cy) / ry, (x - cx) / rx);
      const [ex, ey] = at(th, -margin);
      return Math.hypot(x - cx, y - cy) < Math.hypot(ex - cx, ey - cy);
    };
    return { cx, cy, rx, ry, radius, at, points, contains };
  }

  // Close a point list for rough.curve (it draws open curves through points).
  const closed = (pts) => [...pts, pts[0], pts[1]];

  // Scatter points inside a test function, keeping a minimum spacing.
  function scatter({ seed, count, minDist, bounds, accept, tries = 4000 }) {
    const r = rng(seed);
    const out = [];
    const [x0, y0, x1, y1] = bounds;
    for (let i = 0; i < tries && out.length < count; i++) {
      const x = lerp(x0, x1, r());
      const y = lerp(y0, y1, r());
      if (!accept(x, y)) continue;
      if (out.some((p) => Math.hypot(p[0] - x, p[1] - y) < minDist)) continue;
      out.push([x, y, r()]);
    }
    return out;
  }

  function mount(scene) {
    const params = new URLSearchParams(location.search);
    const exporting = params.has('export');
    const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    let theme = params.get('theme') || (prefersDark ? 'dark' : 'light');

    const canvas = document.createElement('canvas');
    canvas.width = scene.width;
    canvas.height = scene.height;
    const ctx = canvas.getContext('2d');
    const render = (frame) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, scene.width, scene.height);
      scene.draw(ctx, frame, theme);
    };

    window.SCENE = {
      name: scene.name,
      width: scene.width,
      height: scene.height,
      fps: scene.fps,
      frames: scene.frames,
      themes: Object.keys(scene.backgrounds),
      poster: scene.poster || 0,
      ready: true,
      renderFrame(frame, th, type = 'image/png', quality) {
        theme = th;
        render(frame);
        return canvas.toDataURL(type, quality);
      },
    };

    document.body.style.margin = '0';
    if (exporting) {
      document.body.appendChild(canvas);
      return;
    }
    if (params.has('live') && scene.render) {
      // Interactive preview on the theme's page colour; T flips the theme.
      const host = document.createElement('div');
      host.style.cssText = `max-width: ${scene.width}px; margin: 24px auto; padding: 0 16px;`;
      document.body.appendChild(host);
      const setTheme = (th) => {
        theme = th;
        document.documentElement.dataset.theme = th;
        document.body.style.background = scene.backgrounds[th];
      };
      setTheme(theme);
      addEventListener('keydown', (e) => { if (e.key === 't') setTheme(theme === 'dark' ? 'light' : 'dark'); });
      live(host, scene).canvas.style.cssText = 'width: 100%; height: auto; display: block;';
      return;
    }

    // Preview: plays the loop on the theme's page colour so the edges can be
    // judged against the real site background.
    const style = document.createElement('style');
    style.textContent = `
      body { font: 14px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; transition: background .2s; }
      .stage { max-width: ${scene.width}px; margin: 0 auto; padding: 24px 16px; }
      canvas { width: 100%; height: auto; display: block; }
      .bar { display: flex; gap: 12px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
      .bar button { font: inherit; padding: 4px 10px; border-radius: 6px; border: 1px solid currentColor; background: none; color: inherit; cursor: pointer; }
      .bar input { flex: 1; min-width: 160px; }
      .bar output { font-variant-numeric: tabular-nums; min-width: 9ch; }
    `;
    document.head.appendChild(style);
    const stage = document.createElement('div');
    stage.className = 'stage';
    stage.innerHTML = `<div class="bar"><button data-play>Pause</button><button data-theme></button>
      <input type="range" min="0" max="${scene.frames - 1}" value="0"><output></output></div>`;
    stage.prepend(canvas);
    document.body.appendChild(stage);

    const playBtn = stage.querySelector('[data-play]');
    const themeBtn = stage.querySelector('[data-theme]');
    const scrub = stage.querySelector('input');
    const label = stage.querySelector('output');
    let frame = 0;
    let playing = !params.has('paused');
    let last = performance.now();
    let acc = 0;

    const show = () => {
      document.body.style.background = scene.backgrounds[theme];
      document.body.style.color = theme === 'dark' ? '#ece6da' : '#2a2620';
      themeBtn.textContent = `Theme: ${theme}`;
      playBtn.textContent = playing ? 'Pause' : 'Play';
      scrub.value = frame;
      label.textContent = `${frame} / ${scene.frames}  ${(frame / scene.fps).toFixed(2)}s`;
      render(frame);
    };
    const setTheme = (th) => { theme = th; show(); };
    playBtn.onclick = () => { playing = !playing; show(); };
    themeBtn.onclick = () => setTheme(theme === 'dark' ? 'light' : 'dark');
    scrub.oninput = () => { frame = +scrub.value; playing = false; show(); };
    addEventListener('keydown', (e) => {
      if (e.key === ' ') { playing = !playing; e.preventDefault(); }
      else if (e.key === 't') setTheme(theme === 'dark' ? 'light' : 'dark');
      else if (e.key === 'ArrowRight') { frame = (frame + 1) % scene.frames; playing = false; }
      else if (e.key === 'ArrowLeft') { frame = (frame - 1 + scene.frames) % scene.frames; playing = false; }
      else return;
      show();
    });
    window.SCENE.preview = { setTheme, goto(f) { frame = f; playing = false; show(); } };

    const tick = (now) => {
      acc += now - last;
      last = now;
      const step = 1000 / scene.fps;
      if (playing && acc >= step) {
        frame = (frame + Math.floor(acc / step)) % scene.frames;
        acc %= step;
        show();
      } else if (!playing) acc = 0;
      requestAnimationFrame(tick);
    };
    show();
    requestAnimationFrame(tick);
  }

  // Play an interactive scene inside `host` at its own pace (one step every
  // scene.tick frames), passing it pointer input in scene pixels. It follows
  // the page's theme, sleeps while offscreen or in a background tab, and asks
  // the scene to hold its ambient motion still for readers who prefer reduced
  // motion. Touch has no hover, so a tap is just a click, unless the scene
  // sets touchHover: then the first tap hovers there, the next taps click, and
  // a tap anywhere else lets go. Tile scenes redraw
  // a step at a time; a scene with `smooth: true` redraws every frame, and
  // `time` (in milliseconds, continuous) is there for its motion.
  function live(host, scene) {
    const canvas = document.createElement('canvas');
    canvas.width = scene.width;
    canvas.height = scene.height;
    host.appendChild(canvas);
    host.classList.add('is-live');
    const ctx = canvas.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const darkScheme = matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    const theme = () => root.dataset.theme || (darkScheme.matches ? 'dark' : 'light');
    const tickMs = (1000 * (scene.tick || 1)) / scene.fps;
    let step = 0, acc = 0, last = 0, running = false, onscreen = true, dirty = true;

    const toScene = (e) => {
      const box = canvas.getBoundingClientRect();
      return [((e.clientX - box.left) / box.width) * scene.width, ((e.clientY - box.top) / box.height) * scene.height];
    };
    const poke = () => {
      dirty = true;
      canvas.style.cursor = scene.cursor ? scene.cursor() : '';
    };
    let touched = false, swallow = false;
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      scene.hover?.(...toScene(e));
      poke();
    });
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'touch') return;
      scene.hover?.(null);
      poke();
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || !scene.touchHover) return;
      scene.hover?.(...toScene(e));
      swallow = !touched;
      touched = true;
      poke();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!touched || e.target === canvas) return;
      touched = false;
      scene.hover?.(null);
      poke();
    });
    canvas.addEventListener('click', (e) => {
      if (swallow) { swallow = false; return; }
      scene.click?.(...toScene(e));
      poke();
    });

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, scene.width, scene.height);
      scene.render(ctx, step, theme(), { calm: reduce.matches, time: (step + acc / tickMs) * tickMs });
      dirty = false;
    };
    const loop = (now) => {
      if (!onscreen || document.hidden) { running = false; return; }
      acc += Math.min(now - last, 250);
      last = now;
      while (acc >= tickMs) {
        acc -= tickMs;
        step++;   // not inside update?.(): that skips its arguments when a scene has no update
        scene.update?.(step);
        dirty = true;
      }
      if (dirty || scene.smooth) draw();
      requestAnimationFrame(loop);
    };
    const wake = () => {
      if (running || !onscreen || document.hidden) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(loop);
    };
    // A scene with reset() starts over each time it scrolls out of view.
    new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
      if (!onscreen && scene.reset) { scene.reset(); touched = false; dirty = true; }
      wake();
    }).observe(canvas);
    new MutationObserver(() => { dirty = true; }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    darkScheme.addEventListener('change', () => { dirty = true; });
    reduce.addEventListener('change', () => { dirty = true; });
    document.addEventListener('visibilitychange', wake);
    draw();  // never blank, even before the first animation frame
    wake();
    return { canvas };
  }

  const scenes = {};
  function register(scene) {
    scenes[scene.name] = scene;
    document.querySelectorAll(`[data-scene="${scene.name}"]`).forEach((host) => live(host, scene));
  }

  window.SceneKit = { TAU, rng, hash, wave, cycle, lerp, clamp, smooth, blob, closed, scatter, mount, live, register, scenes };
})();
