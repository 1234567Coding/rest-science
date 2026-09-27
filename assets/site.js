/* Rest Science shared site JS — vanilla, progressively enhanced.
   Features: nav toggle, site search, article TOC + scroll-spy, reading
   progress bar, FAQ accordions, sortable tables, dark mode, back-to-top.
   Every feature is guarded: if JS fails or a feature's markup is absent,
   the page works fine without it. */
(function () {
  'use strict';
  var doc = document;

  /* Site root derived from this script's own location, e.g.
     ".../assets/site.js" -> site root ".." up from assets/. */
  var rootBase = null;
  try {
    var scripts = doc.getElementsByTagName('script');
    var me = scripts[scripts.length - 1];
    if (me && me.src) rootBase = new URL('..', me.src).href;
  } catch (e) { rootBase = null; }

  function onReady(fn) {
    if (doc.readyState !== 'loading') fn();
    else doc.addEventListener('DOMContentLoaded', fn);
  }

  function safe(fn) {
    try { fn(); } catch (e) { /* one feature must never kill the rest */ }
  }

  onReady(function () {
    safe(navToggle);
    safe(siteSearch);
    safe(articleFeatures);
    safe(faqAccordions);
    safe(sortableTables);
    safe(darkMode);
    safe(backToTop);
  });

  /* ---------- Mobile nav toggle ---------- */
  function navToggle() {
    var btn = doc.querySelector('.nav-toggle');
    var nav = doc.getElementById('mainNav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- Site-wide client-side search ---------- */
  var indexCache = null;
  function loadIndex() {
    if (indexCache) return Promise.resolve(indexCache);
    if (!rootBase) return Promise.resolve([]);
    return fetch(new URL('search-index.json', rootBase).href, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('no index'); return r.json(); })
      .then(function (data) {
        indexCache = Array.isArray(data) ? data : [];
        return indexCache;
      })
      .catch(function () { return []; });
  }

  function siteSearch() {
    var box = doc.getElementById('siteSearch');
    var list = doc.getElementById('searchResults');
    if (!box || !list) return;

    var timer = null;
    function close() { list.hidden = true; list.innerHTML = ''; }

    function render(query, entries) {
      var q = query.trim().toLowerCase();
      list.innerHTML = '';
      if (!q || q.length < 2) { close(); return; }
      var words = q.split(/\s+/);
      var hits = entries.map(function (e) {
        var hay = (e.title + ' ' + e.excerpt + ' ' + (e.headings || []).join(' ')).toLowerCase();
        var score = 0;
        words.forEach(function (w) {
          if (e.title.toLowerCase().indexOf(w) !== -1) score += 3;
          else if (hay.indexOf(w) !== -1) score += 1;
        });
        return { e: e, score: score };
      }).filter(function (h) { return h.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 8);

      if (!hits.length) {
        var li = doc.createElement('li');
        li.className = 'search-no-results';
        li.textContent = 'No articles match "' + query.trim() + '".';
        list.appendChild(li);
        list.hidden = false;
        return;
      }
      hits.forEach(function (h) {
        var li = doc.createElement('li');
        li.setAttribute('role', 'option');
        var a = doc.createElement('a');
        a.href = rootBase ? new URL(h.e.url, rootBase).href : h.e.url;
        var t = doc.createElement('span');
        t.className = 'search-result-title';
        t.textContent = h.e.title;
        var x = doc.createElement('span');
        x.className = 'search-result-excerpt';
        x.textContent = h.e.excerpt;
        a.appendChild(t); a.appendChild(x);
        li.appendChild(a);
        list.appendChild(li);
      });
      list.hidden = false;
    }

    box.addEventListener('input', function () {
      clearTimeout(timer);
      var q = box.value;
      timer = setTimeout(function () {
        loadIndex().then(function (entries) { render(q, entries); });
      }, 150);
    });
    box.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { close(); box.blur(); }
    });
    doc.addEventListener('click', function (ev) {
      if (!list.hidden && !ev.target.closest('.site-search')) close();
    });
  }

  /* ---------- Article: TOC + scroll-spy + progress bar ---------- */
  function slugify(text) {
    return text.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
  }

  function articleFeatures() {
    var body = doc.querySelector('.article-body');
    if (!body) return;

    var headings = Array.prototype.filter.call(
      body.querySelectorAll('h2'), function (h) {
        return !h.closest('.faq') && !h.closest('.keep-reading');
      });
    if (headings.length < 3) return;

    /* Ensure stable ids on headings (h2 + h3) */
    var seen = {};
    Array.prototype.forEach.call(body.querySelectorAll('h2, h3'), function (h) {
      if (!h.id) {
        var base = slugify(h.textContent), id = base, n = 1;
        while (seen[id] || doc.getElementById(id)) { n++; id = base + '-' + n; }
        h.id = id; seen[id] = true;
      } else { seen[h.id] = true; }
    });

    /* Build TOC: h3s nested under their h2 */
    var nav = doc.createElement('nav');
    nav.className = 'toc';
    nav.setAttribute('aria-label', 'Table of contents');
    var title = doc.createElement('h2');
    title.className = 'toc-title';
    title.textContent = 'On this page';
    nav.appendChild(title);
    var top = doc.createElement('ul');
    nav.appendChild(top);
    var currentList = top, lastH2Li = null;
    Array.prototype.forEach.call(body.querySelectorAll('h2, h3'), function (h) {
      if (h.closest('.faq') || h.closest('.keep-reading') || h.classList.contains('toc-title')) return;
      var li = doc.createElement('li');
      var a = doc.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.dataset.target = h.id;
      li.appendChild(a);
      if (h.tagName === 'H2') {
        top.appendChild(li); lastH2Li = li; currentList = null;
      } else if (lastH2Li) {
        if (!currentList) { currentList = doc.createElement('ul'); lastH2Li.appendChild(currentList); }
        currentList.appendChild(li);
      } else { top.appendChild(li); }
    });

    var anchor = body.querySelector('.lede') || headings[0];
    anchor.parentNode.insertBefore(nav, anchor.nextSibling);

    /* Scroll-spy */
    var links = nav.querySelectorAll('a[data-target]');
    var linkById = {};
    Array.prototype.forEach.call(links, function (a) { linkById[a.dataset.target] = a; });
    if (typeof IntersectionObserver === 'function') {
      var active = null;
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var a = linkById[en.target.id];
          if (a && a !== active) {
            if (active) active.removeAttribute('aria-current');
            a.setAttribute('aria-current', 'true');
            active = a;
          }
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      Array.prototype.forEach.call(body.querySelectorAll('h2[id], h3[id]'), function (h) {
        if (!h.closest('.faq') && !h.closest('.keep-reading')) obs.observe(h);
      });
    }

    /* Reading progress bar */
    var wrap = doc.createElement('div');
    wrap.className = 'reading-progress';
    wrap.setAttribute('aria-hidden', 'true');
    var bar = doc.createElement('div');
    bar.className = 'reading-progress-bar';
    wrap.appendChild(bar);
    doc.body.appendChild(wrap);
    function update() {
      var start = body.offsetTop;
      var total = body.offsetHeight - window.innerHeight;
      var p = total > 0 ? Math.min(1, Math.max(0, (window.scrollY - start) / total)) : 0;
      bar.style.transform = 'scaleX(' + p + ')';
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- FAQ accordions (accessible) ---------- */
  function faqAccordions() {
    Array.prototype.forEach.call(doc.querySelectorAll('.faq'), function (faq) {
      var items = [];
      Array.prototype.forEach.call(faq.querySelectorAll(':scope > h3'), function (h3) {
        var content = [];
        var sib = h3.nextElementSibling;
        while (sib && sib.tagName !== 'H3' && sib.tagName !== 'H2') {
          content.push(sib);
          sib = sib.nextElementSibling;
        }
        items.push({ h3: h3, content: content });
      });
      items.forEach(function (item, i) {
        var wrapper = doc.createElement('div');
        wrapper.className = 'faq-item';
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'faq-question';
        btn.textContent = item.h3.textContent;
        var panel = doc.createElement('div');
        panel.className = 'faq-answer';
        var pid = 'faq-' + i + '-' + Math.random().toString(36).slice(2, 7);
        panel.id = pid;
        panel.setAttribute('role', 'region');
        item.content.forEach(function (el) { panel.appendChild(el); });
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', pid);
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', open ? 'false' : 'true');
          panel.hidden = open;
        });
        panel.hidden = true;
        wrapper.appendChild(btn);
        wrapper.appendChild(panel);
        item.h3.replaceWith(wrapper);
      });
    });
  }

  /* ---------- Sortable tables (activates wherever a real table exists) ---------- */
  function sortableTables() {
    Array.prototype.forEach.call(doc.querySelectorAll('table'), function (table) {
      var thead = table.querySelector('thead');
      if (!thead) return;
      var ths = thead.querySelectorAll('th');
      if (ths.length < 2) return;
      var tbody = table.querySelector('tbody');
      if (!tbody) return;
      table.classList.add('sortable');
      Array.prototype.forEach.call(ths, function (th, idx) {
        th.setAttribute('tabindex', '0');
        th.setAttribute('role', 'button');
        th.title = 'Sort by ' + th.textContent.trim();
        th.addEventListener('click', function () { sortTable(table, tbody, idx, th); });
        th.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); sortTable(table, tbody, idx, th); }
        });
      });
    });
  }
  function sortTable(table, tbody, idx, th) {
    var dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
    Array.prototype.forEach.call(table.querySelectorAll('th[aria-sort]'), function (o) { o.removeAttribute('aria-sort'); });
    th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    rows.sort(function (a, b) {
      var ta = (a.children[idx] || {}).textContent || '';
      var tb = (b.children[idx] || {}).textContent || '';
      var na = parseFloat(ta.replace(/[^0-9.\-]/g, ''));
      var nb = parseFloat(tb.replace(/[^0-9.\-]/g, ''));
      var cmp;
      if (!isNaN(na) && !isNaN(nb) && ta.trim() !== '' && tb.trim() !== '') cmp = na - nb;
      else cmp = ta.trim().localeCompare(tb.trim());
      return cmp * dir;
    });
    rows.forEach(function (r) { tbody.appendChild(r); });
  }

  /* ---------- Dark mode ---------- */
  var THEME_KEY = 'rest-science-theme';
  function darkMode() {
    var toggle = doc.getElementById('themeToggle');
    var root = doc.documentElement;
    var stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    apply(theme);

    if (toggle) {
      toggle.addEventListener('click', function () {
        theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        apply(theme);
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
      });
    }
    function apply(t) {
      if (t === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      if (toggle) {
        toggle.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
        toggle.textContent = t === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
        toggle.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      }
    }
  }

  /* ---------- Back to top ---------- */
  function backToTop() {
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.textContent = '\u2191';
    btn.setAttribute('aria-label', 'Back to top');
    btn.hidden = true;
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    doc.body.appendChild(btn);
    function update() { btn.hidden = window.scrollY < 600; }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }
})();
