(() => {
  'use strict';

  const cfg = window.AURIQUE || {};
  const I18N = window.AURIQUE_I18N || { es: {}, dynamic: { en: {}, es: {} } };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionQuery.matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = () => typeof window.gsap !== 'undefined';

  let lang = 'en';
  let lenis = null;
  const t = (key) => (I18N.dynamic[lang] || I18N.dynamic.en)[key] ?? I18N.dynamic.en[key] ?? key;

  /* ---------------- i18n ---------------- */

  // English is read from the page once, before anything rewrites it.
  const EN = {};
  const parseAttrs = (el) =>
    el.dataset.i18nAttr.split(';').map((pair) => pair.split(':').map((s) => s.trim()));

  $$('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (!(key in EN)) EN[key] = el.innerHTML.trim();
  });
  $$('[data-i18n-attr]').forEach((el) => {
    parseAttrs(el).forEach(([attr, key]) => {
      if (!(key in EN)) EN[key] = el.getAttribute(attr) ?? '';
    });
  });

  const lookup = (key) => (lang === 'es' ? I18N.es[key] : undefined) ?? EN[key];

  function readInitialLang() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl === 'en' || fromUrl === 'es') return fromUrl;
    try {
      const stored = localStorage.getItem('aurique-lang');
      if (stored === 'en' || stored === 'es') return stored;
    } catch (e) { /* storage unavailable */ }
    return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  }

  function applyLang(next, { animate = false } = {}) {
    lang = next;
    document.documentElement.lang = lang;

    $$('[data-i18n]').forEach((el) => {
      const value = lookup(el.dataset.i18n);
      if (value === undefined) return;
      if (el.hasAttribute('data-split')) {
        el.innerHTML = value;
        splitWords(el);
        if (el.classList.contains('is-in')) {
          if (animate && !reduced()) {
            el.classList.remove('is-in');
            void el.offsetWidth;
            el.style.setProperty('--d', '0s');
          }
          el.classList.add('is-in');
        }
      } else if (el.innerHTML !== value) {
        el.innerHTML = value;
      }
    });
    $$('[data-i18n-attr]').forEach((el) => {
      parseAttrs(el).forEach(([attr, key]) => {
        const value = lookup(key);
        if (value !== undefined) el.setAttribute(attr, value);
      });
    });

    const sw = $('[data-lang-switch]');
    if (sw) {
      sw.dataset.active = lang;
      $$('[data-lang]', sw).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    }

    const url = new URL(location.href);
    if (lang === 'es') url.searchParams.set('lang', 'es'); else url.searchParams.delete('lang');
    history.replaceState(null, '', url);
    try { localStorage.setItem('aurique-lang', lang); } catch (e) { /* ignore */ }

    document.dispatchEvent(new CustomEvent('aurique:lang', { detail: lang }));
  }

  /* ---------------- Split text ---------------- */

  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.style.setProperty('--i', i++);
            wi.textContent = part;
            w.append(wi);
            frag.append(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    // Screen readers get the sentence, not a word list.
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  }

  /* ---------------- Reveal on scroll ---------------- */

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    : null;

  function observeReveal(root = document) {
    $$('[data-stagger]', root).forEach((group) => {
      $$(':scope > [data-anim]', group).forEach((el, i) => {
        if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${Math.min(i, 8) * 90}ms`);
      });
    });
    $$('[data-anim], [data-split]', root).forEach((el) => {
      if (el.closest('[data-hero]')) return; // hero runs its own intro
      if (reduced() || !revealObserver) el.classList.add('is-in');
      else revealObserver.observe(el);
    });
  }

  /* ---------------- Hero intro: the arch rises ---------------- */

  function heroIntro() {
    const hero = $('[data-hero]');
    if (!hero) return;
    const title = $('.hero__title', hero);
    const arch = $('[data-arch]', hero);
    const img = $('[data-arch] img', hero);
    const rest = $$('[data-anim]', hero);

    if (reduced() || !hasGsap()) {
      [title, ...rest].forEach((el) => el.classList.add('is-in'));
      return;
    }

    const { gsap } = window;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    // The photo is uncovered from the bottom up, so the arch's curve arrives last.
    tl.fromTo(arch, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.9, ease: 'power3.inOut', clearProps: 'clipPath' }, 0.1);
    if (img) tl.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 2.6 }, 0);
    tl.call(() => title.classList.add('is-in'), null, 0.25);
    tl.call(() => rest.forEach((el) => el.classList.add('is-in')), null, 0.3);

    if (window.ScrollTrigger && img) {
      gsap.to(img, {
        yPercent: 7,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
    }
  }

  // The LOVE hands rise a little as the section scrolls into view.
  function initHands() {
    const img = $('[data-hands]');
    if (!img || reduced() || !hasGsap() || !window.ScrollTrigger) return;
    window.gsap.fromTo(img, { yPercent: 14 }, {
      yPercent: 0,
      ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom 85%', scrub: true }
    });
  }

  /* ---------------- Smooth scroll ---------------- */

  function initScroll() {
    if (!reduced() && window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.095, smoothWheel: true });
      if (hasGsap() && window.ScrollTrigger) {
        window.gsap.registerPlugin(window.ScrollTrigger);
        lenis.on('scroll', window.ScrollTrigger.update);
        window.gsap.ticker.add((time) => lenis.raf(time * 1000));
        window.gsap.ticker.lagSmoothing(0);
      } else {
        const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
    } else if (hasGsap() && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
    }

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      const target = id === '#top' ? document.body : $(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      const offset = id === '#top' ? 0 : -($('[data-header]')?.offsetHeight || 0) + 1;
      if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { offset, duration: 1.4 });
      else window.scrollTo({ top: id === '#top' ? 0 : target.getBoundingClientRect().top + scrollY + offset, behavior: reduced() ? 'auto' : 'smooth' });
      if (id !== '#top') {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  }

  /* ---------------- Header, menu, active section ---------------- */

  const header = $('[data-header]');
  const menu = $('[data-mobile-menu]');
  const menuBtn = $('[data-menu-toggle]');

  function openMenu() {
    menu.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    header.classList.add('is-scrolled', 'is-menu-open');
    document.body.style.overflow = 'hidden';
    lenis?.stop();
  }
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    header.classList.remove('is-menu-open');
    document.body.style.overflow = '';
    lenis?.start();
    onScroll();
  }
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 24 || !menu.hidden);
  }

  function initHeader() {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    menuBtn?.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    window.matchMedia('(min-width: 1181px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });

    const links = $$('.site-nav a');
    // The hero is observed too, so returning to the top clears the highlight.
    const sections = [$('[data-hero]'), ...links.map((a) => $(a.getAttribute('href')))].filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === `#${entry.target.id}`)));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }

  function initLangSwitch() {
    $$('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.lang !== lang) applyLang(btn.dataset.lang, { animate: true });
      });
    });
  }

  /* ---------------- Magnetic buttons ---------------- */

  function initMagnetic() {
    if (!finePointer || reduced() || !hasGsap()) return;
    const { gsap } = window;
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)' });
      });
    });
  }

  /* ---------------- Services: "More" ---------------- */

  function refreshMoreButtons() {
    $$('.svc').forEach((svc) => {
      const desc = $('.svc__desc', svc);
      const btn = $('.svc__more', svc);
      if (!desc || !btn) return;
      const open = svc.classList.contains('is-open');
      btn.hidden = !open && desc.scrollHeight <= desc.clientHeight + 2;
      btn.textContent = open ? t('less') : lookup('services.more');
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  function initServices() {
    $$('.svc__more').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.svc').classList.toggle('is-open');
        refreshMoreButtons();
      });
    });
    let raf;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(refreshMoreButtons);
    });
    document.addEventListener('aurique:lang', refreshMoreButtons);
    refreshMoreButtons();
  }

  /* ---------------- Gallery, cursor, lightbox ---------------- */

  function initGallery() {
    const data = window.AURIQUE_GALLERY || [];
    const section = $('[data-gallery]');
    const grid = $('[data-gallery-grid]');
    if (!section || !grid) return;
    if (!data.length) {
      $$('[data-needs="gallery"]').forEach((a) => { a.hidden = true; });
      return;
    }
    section.hidden = false;

    const catLabel = (cat) => lookup(`services.g${cat[0].toUpperCase()}${cat.slice(1)}`) || cat;
    const shots = data.map((item, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shot';
      btn.dataset.cat = item.cat;
      btn.dataset.anim = '';
      btn.style.setProperty('--d', `${(i % 6) * 80}ms`);
      const img = document.createElement('img');
      img.src = item.src;
      img.srcset = item.srcset;
      img.sizes = '(max-width: 640px) 78vw, (max-width: 1100px) 46vw, 31vw';
      img.width = item.w;
      img.height = item.h;
      img.loading = 'lazy';
      img.decoding = 'async';
      btn.append(img);
      grid.append(btn);
      return btn;
    });

    const setAlts = () => shots.forEach((btn) => {
      const label = `${catLabel(btn.dataset.cat)} — Aurique by Diana`;
      $('img', btn).alt = label;
      btn.setAttribute('aria-label', `${lookup('work.view')}: ${label}`);
    });
    setAlts();
    document.addEventListener('aurique:lang', setAlts);
    observeReveal(grid);

    $$('[data-filter]').forEach((f) => {
      f.addEventListener('click', () => {
        $$('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
        shots.forEach((s) => {
          s.hidden = !(f.dataset.filter === 'all' || s.dataset.cat === f.dataset.filter);
          s.classList.add('is-in');
        });
        grid.scrollTo?.({ left: 0 });
        window.ScrollTrigger?.refresh();
      });
    });

    // Lightbox
    const dlg = $('[data-lightbox]');
    const lbImg = $('[data-lb-img]');
    let index = 0;
    const visible = () => shots.filter((s) => !s.hidden);
    const show = (i) => {
      const list = visible();
      index = (i + list.length) % list.length;
      const img = $('img', list[index]);
      lbImg.src = img.currentSrc || img.src;
      lbImg.srcset = img.srcset;
      lbImg.sizes = '90vw';
      lbImg.alt = img.alt;
    };
    shots.forEach((s) => s.addEventListener('click', () => {
      show(visible().indexOf(s));
      dlg.showModal();
      lenis?.stop();
      cursorOff();
    }));
    dlg.addEventListener('close', () => lenis?.start());
    $('[data-lb-close]').addEventListener('click', () => dlg.close());
    $('[data-lb-prev]').addEventListener('click', () => show(index - 1));
    $('[data-lb-next]').addEventListener('click', () => show(index + 1));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });

    // "View" cursor
    const cursor = $('[data-cursor]');
    function cursorOff() { cursor.classList.remove('is-on'); }
    if (!finePointer || !cursor) return;
    let xTo = (x) => { cursor.style.left = `${x}px`; };
    let yTo = (y) => { cursor.style.top = `${y}px`; };
    if (hasGsap() && !reduced()) {
      xTo = window.gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3.out' });
      yTo = window.gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3.out' });
    }
    window.addEventListener('pointermove', (e) => {
      xTo(e.clientX);
      yTo(e.clientY);
      cursor.classList.toggle('is-on', !!e.target.closest?.('.shot') && !dlg.open);
    }, { passive: true });
    document.addEventListener('pointerleave', cursorOff);
  }

  /* ---------------- Reviews ---------------- */

  function renderReviews() {
    const list = $('[data-reviews]');
    const data = window.AURIQUE_REVIEWS || [];
    if (!list || !data.length) return;
    list.hidden = false;
    list.innerHTML = '';
    data.forEach((r, i) => {
      const fig = document.createElement('figure');
      fig.className = 'review is-in';
      const q = document.createElement('blockquote');
      q.textContent = (r.text && (r.text[lang] || r.text.en)) || '';
      const cap = document.createElement('figcaption');
      cap.textContent = r.name;
      fig.append(q, cap);
      list.append(fig);
    });
  }

  /* ---------------- Instagram (Behold) ---------------- */

  async function initInstagram() {
    const grid = $('[data-insta]');
    if (!grid || !cfg.beholdFeedId) return;
    try {
      const res = await fetch(`https://feeds.behold.so/${encodeURIComponent(cfg.beholdFeedId)}`);
      if (!res.ok) return;
      const json = await res.json();
      const posts = (Array.isArray(json) ? json : json.posts || []).slice(0, 6);
      if (!posts.length) return;
      posts.forEach((p) => {
        const src = p.sizes?.medium?.mediaUrl || p.thumbnailUrl || p.mediaUrl;
        if (!src) return;
        const a = document.createElement('a');
        a.href = p.permalink;
        a.target = '_blank';
        a.rel = 'noopener';
        const img = document.createElement('img');
        img.src = src;
        img.loading = 'lazy';
        img.alt = (p.prunedCaption || p.caption || 'Instagram post by @aurique.by.diana').slice(0, 120);
        a.append(img);
        grid.append(a);
      });
      grid.hidden = false;
    } catch (e) { /* keep the profile link only */ }
  }

  /* ---------------- Map ---------------- */

  const MAP_COLORS = {
    land: '#EFE6D8',
    water: '#D8CDBD',
    park: '#E6DCC9',
    residential: '#ECE2D3',
    building: '#E2D5C2',
    road: '#FBF8F2',
    casing: '#E0D2BE',
    rail: '#D3C5B1',
    boundary: '#CBBBA5',
    label: '#6B5D57',
    halo: '#F4ECE0'
  };

  function recolor(map) {
    const set = (id, prop, value) => { try { map.setPaintProperty(id, prop, value); } catch (e) { /* layer lacks prop */ } };
    map.getStyle().layers.forEach(({ id, type }) => {
      if (type === 'background') set(id, 'background-color', MAP_COLORS.land);
      else if (type === 'fill') {
        if (/water/.test(id)) set(id, 'fill-color', MAP_COLORS.water);
        else if (/building/.test(id)) { set(id, 'fill-color', MAP_COLORS.building); set(id, 'fill-outline-color', MAP_COLORS.casing); }
        else if (/park|wood|glacier|ice/.test(id)) set(id, 'fill-color', MAP_COLORS.park);
        else set(id, 'fill-color', MAP_COLORS.residential);
      } else if (type === 'line') {
        if (/water/.test(id)) set(id, 'line-color', MAP_COLORS.water);
        else if (/casing/.test(id)) set(id, 'line-color', MAP_COLORS.casing);
        else if (/rail/.test(id)) set(id, 'line-color', MAP_COLORS.rail);
        else if (/boundary/.test(id)) set(id, 'line-color', MAP_COLORS.boundary);
        else set(id, 'line-color', MAP_COLORS.road);
      } else if (type === 'symbol') {
        set(id, 'text-color', MAP_COLORS.label);
        set(id, 'text-halo-color', MAP_COLORS.halo);
      }
    });
  }

  function loadMapLib() {
    const base = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/';
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${base}maplibre-gl.css`;
    document.head.append(css);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${base}maplibre-gl.js`;
      s.onload = () => resolve(window.maplibregl);
      s.onerror = reject;
      document.head.append(s);
    });
  }

  function initMap() {
    const el = $('[data-map]');
    if (!el || !('IntersectionObserver' in window)) return;
    const coords = cfg.coords || [-80.1975246, 25.7734397];
    let map = null;
    let visible = false;
    let flown = false;
    let touched = false; // once someone pans or zooms, stop moving the camera for them
    const START = { center: [coords[0] - 0.012, coords[1] - 0.008], zoom: 12.6, pitch: 0, bearing: 0 };

    const fly = () => {
      if (!map || !visible || flown) return;
      flown = true;
      const target = { center: coords, zoom: 16.4, pitch: 38, bearing: -14 };
      if (reduced()) map.jumpTo(target);
      else map.flyTo({ ...target, duration: 3400, curve: 1.3, essential: true });
    };
    // Rewind out of view, so the fly-in plays again every time the map scrolls back in.
    const rewind = () => {
      if (!map || !flown || touched || reduced()) return;
      map.stop();
      map.jumpTo(START);
      flown = false;
    };

    const loadObs = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      loadObs.disconnect();
      try {
        const maplibregl = await loadMapLib();
        const es = lang === 'es';
        map = new maplibregl.Map({
          container: el,
          style: 'https://tiles.openfreemap.org/styles/positron',
          ...START,
          attributionControl: { compact: true },
          cooperativeGestures: true,
          dragRotate: false,
          locale: es ? {
            'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + desplazamiento para acercar el mapa',
            'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + desplazamiento para acercar el mapa',
            'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa'
          } : undefined
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('style.load', () => recolor(map));

        const pin = document.createElement('div');
        pin.className = 'pin';
        pin.innerHTML = '<span class="pin__label"></span><svg class="pin__nail" viewBox="0 0 12 20" aria-hidden="true"><path d="M6 0C9.5.2 12 3.6 12 8v8.4c0 2-2.7 3.6-6 3.6S0 18.4 0 16.4V8C0 3.6 2.5.2 6 0Z"/></svg>';
        pin.querySelector('.pin__label').textContent = t('pin');
        new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat(coords).addTo(map);

        map.once('load', fly);
        const markTouched = (e) => { if (e.originalEvent) touched = true; };
        map.on('dragstart', markTouched);
        map.on('zoomstart', markTouched);
      } catch (e) {
        el.closest('.visit__map').hidden = true;
      }
    }, { rootMargin: '600px 0px' });
    loadObs.observe(el);

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && map?.loaded()) fly();
      else if (!entry.isIntersecting) rewind();
    }, { threshold: [0, 0.45] }).observe(el);
  }

  /* ---------------- Visit: copy + directions ---------------- */

  function initVisit() {
    const status = $('[data-copy-status]');
    $$('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
        } catch (e) {
          const ta = document.createElement('textarea');
          ta.value = btn.dataset.copy;
          document.body.append(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        btn.classList.add('is-copied');
        if (status) status.textContent = lookup('visit.copied');
        clearTimeout(btn._t);
        btn._t = setTimeout(() => {
          btn.classList.remove('is-copied');
          if (status) status.textContent = '';
        }, 2200);
      });
    });

    const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    if (apple) {
      const q = encodeURIComponent(cfg.address || '33 SW 2nd Ave, Unit 604, Miami, FL 33130');
      $$('[data-directions]').forEach((a) => { a.href = `https://maps.apple.com/?daddr=${q}`; });
    }
  }

  /* ---------------- Studio hours: highlight today (Miami time) ---------------- */

  function markToday() {
    const list = $('[data-hours]');
    if (!list) return;
    let day;
    try {
      const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date());
      day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name) + 1;
    } catch (e) {
      day = ((new Date().getDay() + 6) % 7) + 1;
    }
    $$('.hours__row', list).forEach((row) => {
      const today = Number(row.dataset.day) === day;
      row.classList.toggle('is-today', today);
      $('.hours__today', row)?.remove();
      if (today) {
        const tag = document.createElement('span');
        tag.className = 'hours__today';
        tag.textContent = t('today');
        $('.hours__day', row).append(tag);
        row.setAttribute('aria-current', 'date');
      } else {
        row.removeAttribute('aria-current');
      }
    });
  }

  /* ---------------- FAQ accordion (one open at a time) ---------------- */

  function initFaq() {
    const root = $('[data-accordion]');
    if (!root) return;
    const buttons = $$('.faq__q button', root);
    const setOpen = (btn, open) => {
      btn.setAttribute('aria-expanded', String(open));
      document.getElementById(btn.getAttribute('aria-controls')).classList.toggle('is-open', open);
    };
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const willOpen = btn.getAttribute('aria-expanded') !== 'true';
        buttons.forEach((b) => setOpen(b, b === btn && willOpen));
        setTimeout(() => window.ScrollTrigger?.refresh(), 600);
      });
    });
  }

  /* ---------------- Request form ---------------- */

  function initForm() {
    const form = $('[data-request-form]');
    if (!form) return;
    const status = $('[data-form-status]', form);
    const submit = $('[data-submit]', form);
    const say = (key, isError = false) => {
      status.textContent = t(key);
      status.classList.toggle('is-error', isError);
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = (fd.get('name') || '').toString().trim();
      const phone = (fd.get('phone') || '').toString().trim();
      form.elements.name.setAttribute('aria-invalid', String(!name));
      form.elements.phone.setAttribute('aria-invalid', String(!phone));
      if (!name || !phone) {
        say('required', true);
        (name ? form.elements.phone : form.elements.name).focus();
        return;
      }
      if (fd.get('botcheck')) { say('sent'); form.reset(); return; }

      const payload = {
        name,
        phone,
        service: fd.get('service'),
        date: fd.get('date') || '—',
        message: fd.get('message') || '—',
        language: lang === 'es' ? 'Español' : 'English'
      };

      if (!cfg.web3formsKey) {
        const body = Object.entries(payload).map(([k, v]) => `${k}: ${v}`).join('\n');
        location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(`${t('mailSubject')} — ${name}`)}&body=${encodeURIComponent(body)}`;
        say('mailto');
        return;
      }

      submit.disabled = true;
      say('sending');
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: cfg.web3formsKey,
            subject: `New request from ${name} — auriquebydiana.com`,
            from_name: 'Aurique by Diana website',
            ...payload
          })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) throw new Error(json.message || res.status);
        say('sent');
        form.reset();
      } catch (err) {
        say('error', true);
      } finally {
        submit.disabled = false;
      }
    });
  }

  /* ---------------- WhatsApp float ---------------- */

  function initWhatsAppFloat() {
    const btn = $('[data-wa-float]');
    const hero = $('[data-hero]');
    if (!btn || !hero || !('IntersectionObserver' in window)) { btn?.classList.add('is-visible'); return; }
    new IntersectionObserver(([entry]) => {
      btn.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }).observe(hero);
  }

  /* ---------------- Boot ---------------- */

  // Placeholder answers ([TBD]) are for review only — never shown on the live domain.
  if (/(^|.)auriquebydiana.com$/.test(location.hostname)) {
    $$('[data-tbd]').forEach((el) => el.remove());
    $$('.tbd').forEach((el) => el.remove());
  }

  $$('[data-book]').forEach((a) => { if (cfg.squareUrl) a.href = cfg.squareUrl; });
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  applyLang(readInitialLang());
  renderReviews();
  document.addEventListener('aurique:lang', renderReviews);

  initScroll();
  initHeader();
  initLangSwitch();
  initServices();
  initGallery();
  initInstagram();
  initMap();
  initVisit();
  markToday();
  document.addEventListener('aurique:lang', markToday);
  initFaq();
  initForm();
  initWhatsAppFloat();
  initMagnetic();

  // Split words shift slightly when the web fonts arrive, so wait for them (briefly).
  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]) : Promise.resolve();
  fontsReady.then(() => {
    document.documentElement.classList.add('is-ready');
    heroIntro();
    initHands();
    observeReveal();
    refreshMoreButtons();
    window.ScrollTrigger?.refresh();
  });
})();
