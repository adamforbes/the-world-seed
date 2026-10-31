// The World Seed: shared behavior for every page.
// Builds the site nav, the glossary tooltips, the "On this page" tree and reading
// progress, the todo toggle, and the Era card search, and plays the home page's hero
// map. Page content itself is plain HTML.

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

  // ---------- Glossary terms ----------
  // The Glossary (dl.glossary) defines each game term once; its dt lists the
  // forms to look for and its link points to the term's section. A term in the
  // text becomes a reference: a dotted underline that shows the definition on
  // hover, focus or tap, and goes to the section on Enter. That happens to:
  //  - every link to a term's section ("See Journey"), since the definition
  //    links there itself. Links to other sections stay links.
  //  - the first time a term appears under each heading in the nav. Headings,
  //    links, labels, italics, tables and the term's own section are left plain.
  //  - every term in read-aloud text.
  const glossary = main.querySelector("dl.glossary");
  if (glossary) {
    const entries = [...glossary.querySelectorAll(":scope > div[id]")].map(div => {
      const dt = div.querySelector("dt");
      const href = div.querySelector("dd a")?.getAttribute("href") || null;
      return {
        id: div.id,
        name: dt.textContent.trim(),
        forms: (dt.dataset.forms || dt.textContent).split(",").map(s => s.trim()),
        dd: div.querySelector("dd"),
        href,
        home: href?.startsWith("#") ? href.slice(1) : null,
      };
    });
    const byForm = new Map(entries.flatMap(e => e.forms.map(f => [f, e])));
    const byId = new Map(entries.map(e => [e.id, e]));
    // A section two terms share (Qualities & Relationships) isn't either term's.
    const byHref = new Map();
    entries.forEach(e => { if (e.href) byHref.set(e.href, byHref.has(e.href) ? null : e); });
    const forms = [...byForm.keys()].sort((a, b) => b.length - a.length).map(f => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    // Longest forms first, so "Bonus Naming" wins over "Naming". "Era of Myth" is a name, not the term.
    const pattern = new RegExp(`\\b(?:${forms.join("|")})\\b(?! of [A-Z])`, "g");
    const SKIP = "h1, h2, h3, h4, h5, h6, a, strong, em, table, figure, blockquote, code, .todo, .table-note, .page-hero, .glossary, .term";

    const termFor = entry => {
      const term = document.createElement("span");
      term.className = "term";
      term.tabIndex = 0;
      term.dataset.term = entry.id;
      term.setAttribute("aria-describedby", "term-tip");
      return term;
    };

    // Links to a term's section.
    main.querySelectorAll("a[href]:not([class])").forEach(a => {
      const entry = byHref.get(a.getAttribute("href"));
      if (!entry || a.closest(".glossary")) return;
      const term = termFor(entry);
      term.textContent = a.textContent;
      a.replaceWith(term);
    });

    // Wrap each term in a text node that `make` returns an element for.
    const wrap = (node, make) => {
      const frag = document.createDocumentFragment();
      let at = 0;
      for (const m of node.data.matchAll(pattern)) {
        const el = make(byForm.get(m[0]));
        if (!el) continue;
        el.textContent = m[0];
        frag.append(node.data.slice(at, m.index), el);
        at = m.index + m[0].length;
      }
      if (!at) return;
      frag.append(node.data.slice(at));
      node.replaceWith(frag);
    };

    // Note each text node and reference with the headings above it, then mark
    // first uses in order. A reference counts as its term's first use.
    const chain = [];
    const found = [];
    const said = [];
    let section = 0;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        if (n.classList.contains("term")) { found.push({ ref: n.dataset.term, section }); continue; }
        const level = Number(/^H([2-6])$/.exec(n.tagName)?.[1]);
        if (!level || !n.id) continue;
        chain.length = level - 2;
        chain[level - 2] = n.id;
        if (level <= 4) section++;
      } else if (n.data.search(pattern) >= 0 && !n.parentElement.closest(".term")) {
        if (n.parentElement.closest(".read-aloud")) said.push(n);
        else if (!n.parentElement.closest(SKIP)) found.push({ node: n, chain: [...chain], section });
      }
    }

    const seen = new Set();
    let last = -1;
    found.forEach(({ node, ref, chain: above, section: s }) => {
      if (s !== last) { seen.clear(); last = s; }
      if (ref) { seen.add(ref); return; }
      wrap(node, entry => {
        if (seen.has(entry.id) || above.includes(entry.home)) return null;
        seen.add(entry.id);
        return termFor(entry);
      });
    });
    said.forEach(node => wrap(node, termFor));

    // One tooltip, moved to whichever term is being read.
    const tip = document.createElement("div");
    tip.className = "term-tip";
    tip.id = "term-tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.append(tip);
    let shown = null, timer = 0;
    const show = term => {
      clearTimeout(timer);
      if (term === shown) return;
      shown = term;
      const entry = byId.get(term.dataset.term);
      const name = document.createElement("div");
      name.className = "term-tip-name";
      name.textContent = entry.name;
      tip.replaceChildren(name, ...entry.dd.cloneNode(true).childNodes);
      tip.hidden = false;
      tip.style.left = "0px";
      const r = term.getBoundingClientRect();
      const below = r.bottom + 8 + tip.offsetHeight < innerHeight;
      tip.style.top = `${scrollY + (below ? r.bottom + 8 : r.top - 8 - tip.offsetHeight)}px`;
      tip.style.left = `${scrollX + Math.max(8, Math.min(r.left, innerWidth - tip.offsetWidth - 8))}px`;
    };
    const hide = () => { clearTimeout(timer); shown = null; tip.hidden = true; };
    const hideSoon = () => { clearTimeout(timer); timer = setTimeout(hide, 150); };
    const termOf = e => e.target.closest?.(".term");
    ["mouseover", "focusin", "click"].forEach(type => main.addEventListener(type, e => { if (termOf(e)) show(termOf(e)); }));
    ["mouseout", "focusout"].forEach(type => main.addEventListener(type, e => { if (termOf(e)) hideSoon(); }));
    tip.addEventListener("mouseenter", () => clearTimeout(timer));
    tip.addEventListener("mouseleave", hideSoon);
    document.addEventListener("click", e => { if (!e.target.closest(".term, .term-tip")) hide(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") hide(); });
    main.addEventListener("keydown", e => {
      const href = termOf(e) && byId.get(termOf(e).dataset.term).href;
      if (e.key === "Enter" && href) location.href = href;
    });
    window.addEventListener("resize", hide);
  }

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
  // A tree of h2s, h3s and h4s. Each h2's branch is opened whole while that
  // section is being read, and the rows above the current one light their └.
  // Rows indent by heading rank, so an h4 straight under an h2 sits two steps in.
  // Below it, a reading-progress bar and time. On narrow screens it's a bar at
  // the bottom naming the current section, which opens the tree in a panel.
  const toc = document.querySelector(".toc");
  if (toc) {
    const heads = [...main.querySelectorAll("h2[id], h3[id], h4[id]")].filter(h => !h.classList.contains("card-title"));
    if (heads.length > 1) {
      const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      const rank = h => Number(h.tagName[1]);
      const top = Math.min(...heads.map(rank));
      const isSub = i => heads[i] && rank(heads[i]) > top;
      // Each heading's nearest outranking heading above it, or -1.
      const parents = heads.map((h, i) => {
        let j = i - 1;
        while (j >= 0 && rank(heads[j]) >= rank(h)) j--;
        return j;
      });
      const labelOf = h => {
        const label = h.cloneNode(true);
        label.querySelectorAll(".heading-anchor").forEach(n => n.remove());
        return label.textContent.trim();
      };
      const tree = heads.map((h, i) => {
        const a = `<a href="#${h.id}" data-i="${i}"${isSub(i) ? ` class="sub" style="--depth:${rank(h) - top}"` : ""}><span class="br" aria-hidden="true">└</span>${esc(labelOf(h))}</a>`;
        if (!isSub(i)) return a;
        return (isSub(i - 1) ? "" : '<div class="subs"><div>') + a + (isSub(i + 1) ? "" : "</div></div>");
      }).join("");

      const labels = heads.map(labelOf);
      const page = NAV.find(p => p.href === here);
      const title = page && page.href !== "index.html" ? page.label : document.querySelector("h1").textContent;
      const words = main.textContent.trim().split(/\s+/).length;
      toc.innerHTML =
        `<div class="rail-title" aria-hidden="true">${esc(title)}</div>` +
        `<details open><summary><span class="now-label">On this page</span>` +
        '<span class="now-where"><span class="now-top"></span><span class="now-at"></span></span>' +
        '<span class="now-open" aria-hidden="true"></span></summary>' +
        `<div class="sheet"><div class="tree">${tree}</div></div></details>` +
        '<div class="prog" aria-hidden="true"></div>' +
        `<div class="rail-time">${Math.max(1, Math.round(words / 230))} MIN READ</div>`;

      const links = [...toc.querySelectorAll(".tree a")];
      const details = toc.querySelector("details");
      // Open in the rail on wide screens, closed behind the bar on narrow ones.
      const narrow = window.matchMedia("(max-width: 63.99rem)");
      details.open = !narrow.matches;
      narrow.addEventListener("change", () => { details.open = !narrow.matches; });
      const nowTop = toc.querySelector(".now-top");
      const nowAt = toc.querySelector(".now-at");
      const sheet = toc.querySelector(".sheet");
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
        prog.innerHTML = `<b>${"▓".repeat(filled)}</b>${"░".repeat(BAR - filled)}<span class="pct">${String(Math.round(t * 100)).padStart(2, "0")}%</span>`;

        // Headings in Eras hidden by the card search have no offsetParent; skip them.
        let current = Math.max(0, heads.findIndex(h => h.offsetParent));
        if (clicked !== null) current = clicked;
        else {
          heads.forEach((h, i) => {
            if (h.offsetParent && h.getBoundingClientRect().top < innerHeight * 0.4) current = i;
          });
          // A short last section never reaches the reading line; at the end, light it anyway.
          if (t >= 1) current = Math.max(current, heads.findLastIndex(h => h.offsetParent));
        }
        const trail = new Set();
        for (let j = parents[current]; j >= 0; j = parents[j]) trail.add(j);
        links.forEach((a, i) => {
          a.classList.toggle("active", i === current);
          a.classList.toggle("trail", trail.has(i));
        });
        const link = links[current];
        subs.forEach(s => {
          const parent = s.previousElementSibling;
          const open = parent === link || s.contains(link);
          s.classList.toggle("open", open);
          parent.setAttribute("aria-expanded", String(open));
        });

        if (h1) railTitle.classList.toggle("on", h1.getBoundingClientRect().bottom < 0);

        let topmost = current;
        while (parents[topmost] >= 0) topmost = parents[topmost];
        nowTop.textContent = topmost === current ? "" : labels[topmost];
        nowAt.textContent = labels[current];
      };

      // The narrow-screen panel opens at the current section, and closes from
      // the dimmed page behind it or Escape.
      details.addEventListener("toggle", () => {
        const active = toc.querySelector(".tree a.active");
        if (details.open && narrow.matches && active) sheet.scrollTop = active.offsetTop - sheet.clientHeight / 2;
      });
      details.addEventListener("click", e => { if (e.target === details && narrow.matches) details.open = false; });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && narrow.matches) details.open = false; });

      links.forEach((a, i) => a.addEventListener("click", e => {
        e.preventDefault();
        clicked = i;
        heads[i].scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
        history.pushState(null, "", "#" + heads[i].id);
        if (narrow.matches) details.open = false;
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
