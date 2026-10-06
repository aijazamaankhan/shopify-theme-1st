/* Halden — header.js
   Header height variable, transparent/sticky state, desktop menu disclosure, announcement bar. */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- Header metrics + transparent state ---------- */
  var header = document.querySelector('[data-site-header]');
  var sentinel = null;
  var sizeObserver = null;
  var topObserver = null;

  function setHeaderHeight() {
    if (!header) return;
    root.style.setProperty('--header-height', header.offsetHeight + 'px');
  }

  function initHeader() {
    header = document.querySelector('[data-site-header]');
    if (!header) return;
    setHeaderHeight();
    if (sizeObserver) sizeObserver.disconnect();
    if ('ResizeObserver' in window) {
      sizeObserver = new ResizeObserver(setHeaderHeight);
      sizeObserver.observe(header);
    }
    header.dataset.atTop = 'true';
    if (topObserver) topObserver.disconnect();
    if ('IntersectionObserver' in window) {
      if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none;';
        document.body.insertBefore(sentinel, document.body.firstChild);
      }
      topObserver = new IntersectionObserver(function (entries) {
        header.dataset.atTop = entries[0].isIntersecting ? 'true' : 'false';
      });
      topObserver.observe(sentinel);
    }
    initMenus();
  }

  /* ---------- Desktop menu disclosure ---------- */
  var menuAbort = null;
  var closeTimer = null;

  function setOpen(item, open) {
    var toggle = item.querySelector('[data-menu-toggle]');
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    item.toggleAttribute('data-open', open);
  }

  function closeAll(except) {
    document.querySelectorAll('[data-menu-item][data-open]').forEach(function (item) {
      if (item !== except) setOpen(item, false);
    });
  }

  function initMenus() {
    if (menuAbort) menuAbort.abort();
    menuAbort = new AbortController();
    var signal = menuAbort.signal;
    var items = document.querySelectorAll('[data-menu-item]');

    items.forEach(function (item) {
      var toggle = item.querySelector('[data-menu-toggle]');
      toggle.addEventListener('click', function () {
        var open = !item.hasAttribute('data-open');
        closeAll(item);
        setOpen(item, open);
      }, { signal: signal });

      item.addEventListener('pointerenter', function (event) {
        if (event.pointerType !== 'mouse') return;
        clearTimeout(closeTimer);
        closeAll(item);
        setOpen(item, true);
      }, { signal: signal });

      item.addEventListener('pointerleave', function (event) {
        if (event.pointerType !== 'mouse') return;
        // Short grace period so moving diagonally into a mega menu does not close it.
        closeTimer = setTimeout(function () { setOpen(item, false); }, 120);
      }, { signal: signal });

      item.addEventListener('focusout', function (event) {
        if (!item.contains(event.relatedTarget)) setOpen(item, false);
      }, { signal: signal });

      item.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' || !item.hasAttribute('data-open')) return;
        setOpen(item, false);
        toggle.focus();
        event.stopPropagation();
      }, { signal: signal });
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest('[data-menu-item]')) closeAll();
    }, { signal: signal });
  }

  /* ---------- Announcement bar ---------- */
  class AnnouncementBar extends HTMLElement {
    connectedCallback() {
      this.slides = Array.prototype.slice.call(this.querySelectorAll('[data-slide]'));
      this.index = 0;
      this.paused = false;
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (this.slides.length < 2) return;
      this.querySelector('[data-prev]').addEventListener('click', () => this.go(this.index - 1, true));
      this.querySelector('[data-next]').addEventListener('click', () => this.go(this.index + 1, true));
      this.toggle = this.querySelector('[data-toggle]');
      if (this.toggle) this.toggle.addEventListener('click', () => this.setPaused(!this.paused));
      this.addEventListener('pointerenter', () => { this.hovering = true; this.stop(); });
      this.addEventListener('pointerleave', () => { this.hovering = false; this.start(); });
      this.addEventListener('focusin', () => this.stop());
      this.addEventListener('focusout', () => this.start());
      this.start();
    }
    disconnectedCallback() { this.stop(); }
    get autoplay() {
      return this.dataset.autoplay === 'true' && !this.reduced.matches && !this.paused;
    }
    start() {
      this.stop();
      if (!this.autoplay || this.hovering) return;
      this.timer = setInterval(() => this.go(this.index + 1, false), parseInt(this.dataset.interval, 10) || 6000);
    }
    stop() { clearInterval(this.timer); }
    setPaused(paused) {
      this.paused = paused;
      if (this.toggle) {
        this.toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
        this.toggle.querySelector('[data-icon-pause]').hidden = paused;
        this.toggle.querySelector('[data-icon-play]').hidden = !paused;
      }
      if (paused) this.stop(); else this.start();
    }
    go(next, user) {
      var count = this.slides.length;
      next = (next + count) % count;
      this.slides[this.index].hidden = true;
      this.slides[this.index].classList.remove('is-active');
      this.index = next;
      this.slides[next].hidden = false;
      this.slides[next].classList.add('is-active');
      // Live region only for deliberate navigation; auto-rotation stays silent.
      var slidesWrap = this.querySelector('[data-slides]');
      slidesWrap.setAttribute('aria-live', user ? 'polite' : 'off');
      if (user) this.setPaused(true);
    }
  }
  if (!customElements.get('announcement-bar')) customElements.define('announcement-bar', AnnouncementBar);

  initHeader();
  document.addEventListener('shopify:section:load', function (event) {
    if (event.target.querySelector('[data-site-header]')) initHeader();
  });
})();
