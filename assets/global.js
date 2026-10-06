/* Halden — global.js
   Shared helpers, dialogs, scroll reveal, parallax, accordion, small utilities.
   No dependencies. Everything is attached to window.Halden. */
(function () {
  'use strict';

  var configEl = document.getElementById('HaldenConfig');
  var config = { routes: {}, settings: {}, strings: {} };
  if (configEl) {
    try { config = JSON.parse(configEl.textContent); } catch (e) { /* keep defaults */ }
  }

  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var animationsOn = function () {
    return document.body.dataset.animations === 'true' && !reducedMotionQuery.matches;
  };

  function debounce(fn, wait) {
    var timer;
    var debounced = function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
    debounced.cancel = function () { clearTimeout(timer); };
    return debounced;
  }

  function announce(message) {
    var region = document.getElementById('LiveRegion');
    if (!region || !message) return;
    // Clear first so repeated identical messages are re-announced.
    region.textContent = '';
    requestAnimationFrame(function () { region.textContent = message; });
  }

  function toast(message, type) {
    var region = document.getElementById('ToastRegion');
    if (!region || !message) return;
    var el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = message;
    region.appendChild(el);
    var remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    el.addEventListener('animationend', function (e) { if (e.animationName === 'toast-out') remove(); });
    // Fallback removal when animations are disabled (animationend never fires then).
    if (!animationsOn()) setTimeout(remove, 4000);
  }

  /** Fetch a same-origin URL and parse the HTML. Throws on non-2xx. */
  function fetchDocument(url, options) {
    return fetch(url, Object.assign({ headers: { 'X-Requested-With': 'XMLHttpRequest' } }, options || {}))
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (html) { return new DOMParser().parseFromString(html, 'text/html'); });
  }

  function formatCount(template, count) {
    return String(template).replace('{{ count }}', count);
  }

  /* ---------------- Dialogs (native <dialog>) ---------------- */
  var openDialogs = new Set();

  function lockScroll() { document.documentElement.classList.add('scroll-locked'); }
  function unlockScroll() { if (!openDialogs.size) document.documentElement.classList.remove('scroll-locked'); }

  function openDialog(dialog, opener) {
    if (!dialog || dialog.open) return;
    dialog._opener = opener || document.activeElement;
    dialog.classList.remove('is-closing');
    dialog.showModal();
    openDialogs.add(dialog);
    lockScroll();
    dialog.dispatchEvent(new CustomEvent('halden:dialog-open', { bubbles: true }));
    var focusTarget = dialog.querySelector('[data-autofocus], input[type="search"]');
    if (focusTarget) focusTarget.focus();
  }

  function finishClose(dialog) {
    if (dialog.open) dialog.close();
    dialog.classList.remove('is-closing');
    openDialogs.delete(dialog);
    unlockScroll();
    var opener = dialog._opener;
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    dialog.dispatchEvent(new CustomEvent('halden:dialog-close', { bubbles: true }));
  }

  function closeDialog(dialog) {
    if (!dialog || !dialog.open || dialog.classList.contains('is-closing')) return;
    if (!animationsOn()) { finishClose(dialog); return; }
    dialog.classList.add('is-closing');
    var animations = dialog.getAnimations({ subtree: true }).filter(function (a) {
      return a.animationName !== undefined || a.transitionProperty !== undefined;
    });
    if (!animations.length) { finishClose(dialog); return; }
    Promise.allSettled(animations.map(function (a) { return a.finished; })).then(function () { finishClose(dialog); });
  }

  document.addEventListener('click', function (event) {
    var opener = event.target.closest('[data-open-dialog]');
    if (opener) {
      var target = document.getElementById(opener.getAttribute('data-open-dialog'));
      if (target && typeof target.showModal === 'function') {
        event.preventDefault();
        openDialog(target, opener);
      }
      return;
    }
    var closer = event.target.closest('[data-close-dialog]');
    if (closer) {
      event.preventDefault();
      closeDialog(closer.closest('dialog'));
      return;
    }
    // Click on the backdrop (the dialog element itself) closes it.
    if (event.target.matches && event.target.matches('dialog[data-drawer]')) closeDialog(event.target);
  });

  // Escape fires "cancel"; route it through the animated close.
  document.addEventListener('cancel', function (event) {
    if (event.target.matches && event.target.matches('dialog')) {
      event.preventDefault();
      closeDialog(event.target);
    }
  }, true);

  // Close any open dialog when a link inside it navigates in-page (e.g. anchor links).
  document.addEventListener('click', function (event) {
    var link = event.target.closest('dialog a[href^="#"]');
    if (link) closeDialog(link.closest('dialog'));
  });

  /* ---------------- Scroll reveal ---------------- */
  var revealObserver = null;

  function revealNow(el) { el.classList.add('is-revealed'); }

  function observeReveals(root) {
    var els = (root || document).querySelectorAll('[data-reveal]:not(.is-revealed)');
    if (!els.length) return;
    var instant = !animationsOn() || !('IntersectionObserver' in window) ||
      (window.Shopify && window.Shopify.designMode);
    if (instant) { els.forEach(revealNow); return; }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealNow(entry.target);
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    }
    els.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------------- Parallax (transform only, only while visible) ---------------- */
  var parallaxItems = new Set();
  var parallaxVisible = new Set();
  var parallaxObserver = null;
  var parallaxTicking = false;

  function updateParallax() {
    parallaxTicking = false;
    var vh = window.innerHeight;
    parallaxVisible.forEach(function (item) {
      var rect = item.container.getBoundingClientRect();
      var progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2); // -1..1
      var offset = Math.max(-1, Math.min(1, progress)) * item.speed;
      item.img.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0) scale(1.12)';
    });
  }

  function onParallaxScroll() {
    if (parallaxTicking) return;
    parallaxTicking = true;
    requestAnimationFrame(updateParallax);
  }

  function syncParallaxListener() {
    if (parallaxVisible.size) {
      window.addEventListener('scroll', onParallaxScroll, { passive: true });
      window.addEventListener('resize', onParallaxScroll, { passive: true });
      onParallaxScroll();
    } else {
      window.removeEventListener('scroll', onParallaxScroll);
      window.removeEventListener('resize', onParallaxScroll);
    }
  }

  function initParallax(root) {
    if (document.body.dataset.parallax !== 'true' || !animationsOn() || !('IntersectionObserver' in window)) return;
    if (!parallaxObserver) {
      parallaxObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var item = entry.target._parallax;
          if (!item) return;
          if (entry.isIntersecting) parallaxVisible.add(item); else parallaxVisible.delete(item);
        });
        syncParallaxListener();
      }, { rootMargin: '10% 0px' });
    }
    (root || document).querySelectorAll('[data-parallax]').forEach(function (container) {
      if (container._parallax) return;
      var img = container.querySelector('[data-parallax-img]');
      if (!img) return;
      var item = { container: container, img: img, speed: parseFloat(container.dataset.parallax) || 40 };
      container._parallax = item;
      parallaxItems.add(item);
      parallaxObserver.observe(container);
    });
  }

  function destroyParallax(root) {
    (root || document).querySelectorAll('[data-parallax]').forEach(function (container) {
      var item = container._parallax;
      if (!item) return;
      parallaxObserver && parallaxObserver.unobserve(container);
      parallaxItems.delete(item);
      parallaxVisible.delete(item);
      container._parallax = null;
    });
    syncParallaxListener();
  }

  /* ---------------- Accordion (animated <details>) ---------------- */
  class HaldenAccordion extends HTMLElement {
    connectedCallback() {
      this.details = this.querySelector('details');
      this.summary = this.querySelector('summary');
      this.content = this.querySelector('.accordion__content');
      if (!this.details || !this.summary || !this.content) return;
      this.onClick = this.onClick.bind(this);
      this.summary.addEventListener('click', this.onClick);
    }
    disconnectedCallback() {
      if (this.summary) this.summary.removeEventListener('click', this.onClick);
    }
    onClick(event) {
      if (!animationsOn()) return; // native toggle, instantly
      event.preventDefault();
      if (this.animation) this.animation.cancel();
      var opening = !this.details.open;
      var content = this.content;
      if (opening) {
        this.details.open = true;
        var height = content.offsetHeight;
        this.animation = content.animate({ height: ['0px', height + 'px'], opacity: [0, 1] },
          { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        this.animation.onfinish = this.animation.oncancel = () => { this.animation = null; };
      } else {
        var start = content.offsetHeight;
        this.animation = content.animate({ height: [start + 'px', '0px'], opacity: [1, 0] },
          { duration: 220, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
        this.animation.onfinish = () => { this.details.open = false; this.animation = null; };
        this.animation.oncancel = () => { this.animation = null; };
      }
    }
  }
  if (!customElements.get('halden-accordion')) customElements.define('halden-accordion', HaldenAccordion);

  /* ---------------- Small delegated utilities ---------------- */
  document.addEventListener('change', function (event) {
    var select = event.target.closest && event.target.closest('select[data-auto-submit]');
    if (select && select.form) select.form.submit();
  });

  document.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-copy-link]');
    if (!btn) return;
    var url = btn.getAttribute('data-copy-link') || window.location.href;
    var done = function () { announce(config.strings.copied); toast(config.strings.copied, 'success'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { /* clipboard blocked: leave link visible */ });
    }
  });

  document.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-native-share]');
    if (!btn || !navigator.share) return;
    event.preventDefault();
    navigator.share({ title: document.title, url: btn.getAttribute('data-native-share') || window.location.href })
      .catch(function () { /* user cancelled */ });
  });
  if (!navigator.share) document.querySelectorAll('[data-native-share]').forEach(function (el) { el.hidden = true; });

  // Focus a form status message after a native form post returns (newsletter / contact).
  var autofocus = document.querySelector('main [data-autofocus]');
  if (autofocus && autofocus.matches('[tabindex]')) autofocus.focus({ preventScroll: false });

  /* ---------------- Boot & Theme Editor hooks ---------------- */
  function init(root) {
    observeReveals(root);
    initParallax(root);
  }
  init(document);

  document.addEventListener('shopify:section:load', function (event) { init(event.target); });
  document.addEventListener('shopify:section:unload', function (event) { destroyParallax(event.target); });

  reducedMotionQuery.addEventListener('change', function () {
    if (!animationsOn()) {
      document.querySelectorAll('[data-reveal]').forEach(revealNow);
      destroyParallax(document);
    }
  });

  window.Halden = {
    config: config,
    debounce: debounce,
    announce: announce,
    toast: toast,
    fetchDocument: fetchDocument,
    formatCount: formatCount,
    animationsOn: animationsOn,
    openDialog: openDialog,
    closeDialog: closeDialog,
    observeReveals: observeReveals,
    initParallax: initParallax
  };
})();
