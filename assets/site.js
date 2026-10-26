// The World Seed: shared behavior for every page.
// Builds the site nav, the "On this page" tree and reading progress, the todo toggle,
// and the Era card search, and plays the home page's hero map. Page content itself
// is plain HTML.

(function () {
  // Edit this list to add, remove or reorder pages in the header.
  // `key` is the keyboard shortcut shown as [K]; keep them unique, and not T (todos).
  const NAV = [
    { href: "index.html", label: "Home", key: "H" },
    { href: "rules.html", label: "Core Ruleset", key: "R" },
    { href: "era-cards.html", label: "Era Cards", key: "E" },
  ];

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } },
  };

  const here = location.pathname.split("/").pop() || "index.html";
  const main = document.querySelector("main");

  // ---------- Header ----------
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML =
    '<a class="brand" href="index.html">The World <span>Seed</span></a>' +
    '<nav class="site-nav" aria-label="Pages">' +
    NAV.map(p => `<a href="${p.href}" aria-keyshortcuts="${p.key}"${p.href === here ? ' aria-current="page"' : ""}><span class="k" aria-hidden="true">[${p.key}]</span>${p.label}</a>`).join("") +
    "</nav>";
  document.body.prepend(header);

  // Single-key shortcuts, ignored while typing or with a modifier held.
  const shortcuts = new Map(NAV.map(p => [p.key.toLowerCase(), () => { if (p.href !== here) location.href = p.href; }]));
  document.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    const run = shortcuts.get(e.key.toLowerCase());
    if (run) { e.preventDefault(); run(); }
  });

  // ---------- Todo toggle ----------
  const todos = document.querySelectorAll(".todo");
  if (todos.length) {
    const btn = document.createElement("button");
    btn.className = "todo-toggle";
    btn.type = "button";
    const apply = (show) => {
      document.body.classList.toggle("hide-todos", !show);
      btn.setAttribute("aria-pressed", String(show));
      btn.innerHTML = `<span class="k" aria-hidden="true">[T]</span> ${show ? "Hide" : "Show"} todos (${todos.length})`;
    };
    apply(store.get("tws-show-todos") !== "false");
    btn.addEventListener("click", () => {
      const show = document.body.classList.contains("hide-todos");
      store.set("tws-show-todos", String(show));
      apply(show);
    });
    btn.setAttribute("aria-keyshortcuts", "T");
    header.append(btn);
    shortcuts.set("t", () => btn.click());
  }

  // ---------- Heading anchors ----------
  main.querySelectorAll("h2[id], h3[id]:not(.card-title), h4[id]").forEach(h => {
    const a = document.createElement("a");
    a.className = "heading-anchor";
    a.href = "#" + h.id;
    a.setAttribute("aria-label", "Link to this section");
    a.textContent = "#";
    h.append(a);
  });

  // ---------- Margin figures ----------
  // The drolleries and Era mascots (.marginal) float into the right margin
  // beside their heading. When the margin is too narrow for them, each moves
  // into its heading instead, cropped to its own size (see style.css). Runs
  // once the scenes have loaded, since each one knows the box it stays in.
  const figures = [...main.querySelectorAll(".marginal")];
  if (figures.length) document.addEventListener("DOMContentLoaded", () => {
    const homes = figures.map(f => f.previousElementSibling);
    figures.forEach(f => {
      const span = window.SceneKit?.scenes[f.dataset.scene]?.span;
      if (!span) return;
      const [x0, y0, x1, y1] = span;
      f.style.cssText += `--x0:${x0};--y0:${y0};--w:${x1 - x0};--h:${y1 - y0}`;
    });
    const section = homes[0].parentElement, text = section.querySelector("p");
    let inline = null;
    const place = () => {
      const room = section.clientWidth - (text ? text.getBoundingClientRect().width : 0);
      const now = room < 160;
      if (now === inline) return;
      inline = now;
      document.documentElement.classList.toggle("margins-inline", inline);
      figures.forEach((f, i) => (inline ? homes[i].append(f) : homes[i].after(f)));
    };
    place();
    new ResizeObserver(place).observe(main);
  });

  // ---------- On this page ----------
  // A tree of h2s, each h3 group tucked under its h2 and opened only while
  // that section is being read. Below it, a reading-progress bar and time.
  const toc = document.querySelector(".toc");
  if (toc) {
    const heads = [...main.querySelectorAll("h2[id], h3[id]")].filter(h => !h.classList.contains("card-title"));
    if (heads.length > 1) {
      const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      const isSub = i => heads[i] && heads[i].tagName === "H3";
      const labelOf = h => {
        const label = h.cloneNode(true);
        label.querySelectorAll(".heading-anchor").forEach(n => n.remove());
        return label.textContent.trim();
      };
      const tree = heads.map((h, i) => {
        const a = `<a href="#${h.id}" data-i="${i}"${isSub(i) ? ' class="sub"' : ""}><span class="br" aria-hidden="true">└</span>${esc(labelOf(h))}</a>`;
        if (!isSub(i)) return a;
        return (isSub(i - 1) ? "" : '<div class="subs"><div>') + a + (isSub(i + 1) ? "" : "</div></div>");
      }).join("");

      const page = NAV.find(p => p.href === here);
      const title = page && page.href !== "index.html" ? page.label : document.querySelector("h1").textContent;
      const words = main.textContent.trim().split(/\s+/).length;
      toc.innerHTML =
        `<div class="rail-title" aria-hidden="true">${esc(title)}</div>` +
        `<details open><summary>On this page</summary><div class="tree">${tree}</div></details>` +
        '<div class="prog" aria-hidden="true"></div>' +
        `<div class="rail-time">${Math.max(1, Math.round(words / 230))} MIN READ</div>`;
      if (window.matchMedia("(max-width: 63.99rem)").matches) toc.querySelector("details").open = false;

      const topProg = document.createElement("div");
      topProg.className = "top-prog";
      topProg.setAttribute("aria-hidden", "true");
      document.body.prepend(topProg);

      const links = [...toc.querySelectorAll(".tree a")];
      const subs = [...toc.querySelectorAll(".subs")];
      const prog = toc.querySelector(".prog");
      const railTitle = toc.querySelector(".rail-title");
      const h1 = main.querySelector("h1");
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const BAR = 28;

      // A clicked link stays current until the reader scrolls on their own,
      // since sections near the bottom can't scroll up to the reading line.
      let clicked = null;
      let ticking = false;

      const update = () => {
        ticking = false;
        const end = main.getBoundingClientRect().bottom + scrollY - innerHeight;
        const t = Math.max(0, Math.min(1, scrollY / Math.max(1, end)));
        const filled = Math.round(BAR * t);
        topProg.style.width = `${t * 100}%`;
        prog.innerHTML = `<b>${"▓".repeat(filled)}</b>${"░".repeat(BAR - filled)}<span class="pct">${String(Math.round(t * 100)).padStart(2, "0")}%</span>`;

        // Headings in Eras hidden by the card search have no offsetParent; skip them.
        let current = Math.max(0, heads.findIndex(h => h.offsetParent));
        if (clicked !== null) current = clicked;
        else heads.forEach((h, i) => {
          if (h.offsetParent && h.getBoundingClientRect().top < innerHeight * 0.4) current = i;
        });
        links.forEach((a, i) => a.classList.toggle("active", i === current));
        const link = links[current];
        subs.forEach(s => {
          const parent = s.previousElementSibling;
          const open = parent === link || s.contains(link);
          s.classList.toggle("open", open);
          parent.setAttribute("aria-expanded", String(open));
        });

        if (h1) railTitle.classList.toggle("on", h1.getBoundingClientRect().bottom < 0);
      };

      links.forEach((a, i) => a.addEventListener("click", e => {
        e.preventDefault();
        clicked = i;
        heads[i].scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
        history.pushState(null, "", "#" + heads[i].id);
        update();
      }));
      ["wheel", "touchmove", "keydown"].forEach(type =>
        window.addEventListener(type, () => { clicked = null; }, { passive: true }));
      window.addEventListener("scroll", () => {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      }, { passive: true });
      window.addEventListener("resize", update);
      document.addEventListener("tws:filter", update);
      update();
    } else {
      toc.closest(".layout").classList.add("no-toc");
      toc.remove();
    }
  }

  // ---------- Hero art ----------
  // The home page map has one video per theme and CSS shows one of them. Play only
  // that one, only while the tab is visible, and leave the still poster for anyone
  // who prefers reduced motion.
  const heroVideos = document.querySelectorAll(".hero-art video");
  if (heroVideos.length) {
    const calm = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => heroVideos.forEach(v => {
      const play = getComputedStyle(v).display !== "none" && !calm.matches && !document.hidden;
      if (play) v.play().catch(() => {});
      else v.pause();
    });
    sync();
    calm.addEventListener("change", sync);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
  }

  // ---------- Era card search ----------
  const eras = [...main.querySelectorAll("section.era[data-era]")];
  if (eras.length > 1 && main.querySelector(".card")) {
    const controls = document.createElement("div");
    controls.className = "card-controls";
    controls.innerHTML =
      '<input class="card-search" type="search" placeholder="Search cards…" aria-label="Search cards">' +
      '<span class="card-count" aria-live="polite"></span>';
    eras[0].before(controls);

    const search = controls.querySelector(".card-search");
    const count = controls.querySelector(".card-count");

    const run = () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      eras.forEach(s => {
        let visibleInEra = 0;
        s.querySelectorAll(".card").forEach(card => {
          const ok = !q || card.textContent.toLowerCase().includes(q);
          card.classList.toggle("is-hidden", !ok);
          if (ok) visibleInEra++;
        });
        s.classList.toggle("is-hidden", Boolean(q) && !visibleInEra);
        shown += visibleInEra;
      });
      count.textContent = `${shown} card${shown === 1 ? "" : "s"}`;
      document.dispatchEvent(new Event("tws:filter"));
    };

    search.addEventListener("input", run);
    run();
  }
})();
