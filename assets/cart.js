/* Halden — cart.js
   Cart drawer / page updates and AJAX add-to-cart.
   Uses only documented Shopify endpoints: /cart/add.js, /cart/change.js, /cart/update.js, /cart.js
   and the Section Rendering API (?sections=…, or a `sections` body parameter). */
(function () {
  'use strict';

  var H = window.Halden;
  if (!H) return;
  var routes = H.config.routes || {};
  var strings = H.config.strings || {};
  var settings = H.config.settings || {};

  /* ---------- <quantity-input> ---------- */
  class QuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      this.onClick = (event) => {
        var button = event.target.closest('button');
        if (!button || !this.contains(button)) return;
        event.preventDefault();
        var step = parseInt(this.input.step, 10) || 1;
        var value = parseInt(this.input.value, 10) || 0;
        var min = this.input.min !== '' ? parseInt(this.input.min, 10) : 1;
        var max = this.input.max !== '' ? parseInt(this.input.max, 10) : Infinity;
        var next = button.name === 'plus' ? value + step : value - step;
        next = Math.max(min, Math.min(max, next));
        if (next === value) return;
        this.input.value = next;
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      this.addEventListener('click', this.onClick);
    }
    disconnectedCallback() { this.removeEventListener('click', this.onClick); }
  }
  if (!customElements.get('quantity-input')) customElements.define('quantity-input', QuantityInput);

  /* ---------- Cart state & requests ---------- */
  var queue = Promise.resolve();

  function cartPageSectionId() {
    var el = document.querySelector('[data-cart-section-id]');
    return el ? el.getAttribute('data-cart-section-id') : null;
  }

  function sectionIds() {
    var ids = [];
    if (document.getElementById('CartDrawer')) ids.push('cart-drawer');
    var page = cartPageSectionId();
    if (page) ids.push(page);
    return ids;
  }

  function request(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) {
          var err = new Error(json.description || json.message || strings.cartError);
          err.status = res.status;
          throw err;
        }
        return json;
      }, function () { throw new Error(strings.cartError); });
    });
  }

  function mutate(url, body) {
    var ids = sectionIds();
    var payload = Object.assign({}, body);
    if (ids.length) {
      payload.sections = ids.join(',');
      payload.sections_url = window.location.pathname;
    }
    // Serialise mutations so responses are applied in request order.
    var run = queue.then(function () { return request(url, payload); });
    queue = run.catch(function () { /* keep the queue alive after failures */ });
    return run;
  }

  function fetchSections() {
    var ids = sectionIds();
    if (!ids.length) return Promise.resolve({});
    return fetch(window.location.pathname + '?sections=' + encodeURIComponent(ids.join(',')))
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); });
  }

  /* ---------- Rendering ---------- */
  function parse(html) { return new DOMParser().parseFromString(html, 'text/html'); }

  function captureFocus() {
    var active = document.activeElement;
    if (!active) return null;
    var line = active.closest && active.closest('[data-cart-line]');
    if (!line) return null;
    return {
      key: line.getAttribute('data-key'),
      index: parseInt(line.getAttribute('data-index'), 10),
      kind: active.matches('[data-remove]') ? 'remove' : 'qty',
      scope: line.closest('dialog') ? 'dialog' : 'page'
    };
  }

  function restoreFocus(state, container) {
    if (!state || !container) return;
    var scope = container;
    var line = scope.querySelector('[data-cart-line][data-key="' + CSS.escape(state.key) + '"]');
    var target = null;
    if (line) {
      target = state.kind === 'remove' ? line.querySelector('[data-remove]') : line.querySelector('.quantity__input');
    } else {
      // Line was removed: move to the line now occupying its position, else the heading / empty state.
      var lines = scope.querySelectorAll('[data-cart-line]');
      var next = lines[Math.min(state.index - 1, lines.length - 1)];
      target = next ? next.querySelector('[data-remove]') : scope.querySelector('[data-cart-body] a, [data-cart-body] button, .cart-empty a');
    }
    if (target) target.focus();
  }

  function applySections(sections) {
    if (!sections) return;
    var focusState = captureFocus();

    var drawer = document.getElementById('CartDrawer');
    if (drawer && sections['cart-drawer']) {
      var fresh = parse(sections['cart-drawer']).getElementById('CartDrawer');
      if (fresh) {
        drawer.innerHTML = fresh.innerHTML;
        if (focusState && focusState.scope === 'dialog') restoreFocus(focusState, drawer);
      }
    }

    var pageId = cartPageSectionId();
    if (pageId && sections[pageId]) {
      var host = document.querySelector('[data-cart-section-id]');
      var freshHost = parse(sections[pageId]).querySelector('[data-cart-section-id]');
      if (host && freshHost) {
        host.innerHTML = freshHost.innerHTML;
        if (focusState && focusState.scope === 'page') restoreFocus(focusState, host);
      }
    }
  }

  function setCount(count) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      el.classList.toggle('is-empty', count === 0);
    });
    document.querySelectorAll('[data-cart-count-label]').forEach(function (el) {
      el.textContent = '(' + count + ')';
    });
  }

  function fetchCount() {
    return fetch(routes.cartJson, { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (cart) { setCount(cart.item_count); return cart; });
  }

  function refresh() {
    return Promise.all([fetchSections(), fetchCount()]).then(function (results) { applySections(results[0]); });
  }

  /* ---------- Drawer ---------- */
  function openDrawer(opener) {
    var drawer = document.getElementById('CartDrawer');
    if (drawer) H.openDialog(drawer, opener);
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-cart-link]');
    if (!link) return;
    if (document.body.dataset.cartType !== 'drawer' || !document.getElementById('CartDrawer')) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    openDrawer(link);
  });

  /* ---------- Line updates ---------- */
  function lineError(line, message) {
    var box = line && line.querySelector('[data-line-error]');
    if (!box) { H.toast(message, 'error'); return; }
    box.querySelector('[data-line-error-text]').textContent = message;
    box.hidden = false;
    H.announce(message);
  }

  function changeLine(line, quantity) {
    var key = line.getAttribute('data-key');
    line.classList.add('is-updating');
    var errBox = line.querySelector('[data-line-error]');
    if (errBox) errBox.hidden = true;
    return mutate(routes.cartChange, { id: key, quantity: quantity })
      .then(function (cart) {
        setCount(cart.item_count);
        applySections(cart.sections);
        H.announce(quantity === 0 ? strings.itemRemoved : strings.cartUpdated);
      })
      .catch(function (err) {
        line.classList.remove('is-updating');
        lineError(line, err.message || strings.cartError);
        // Resync so quantities reflect the real cart.
        return refresh().catch(function () { /* offline: leave as is */ });
      });
  }

  var debouncedChange = H.debounce(function (line, qty) { changeLine(line, qty); }, 350);

  document.addEventListener('change', function (event) {
    var input = event.target.closest && event.target.closest('.quantity__input[data-line]');
    if (input) {
      var line = input.closest('[data-cart-line]');
      var qty = parseInt(input.value, 10);
      if (!line || isNaN(qty) || qty < 0) return;
      debouncedChange(line, qty);
      return;
    }
    var note = event.target.closest && event.target.closest('[data-cart-note]');
    if (note) {
      mutate(routes.cartUpdate, { note: note.value }).catch(function (err) { H.toast(err.message, 'error'); });
    }
  });

  document.addEventListener('click', function (event) {
    var remove = event.target.closest('[data-remove]');
    if (!remove) return;
    event.preventDefault();
    var line = remove.closest('[data-cart-line]');
    if (line) changeLine(line, 0);
  });

  /* Pressing Enter in a quantity field must update, not submit the form to checkout. */
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && event.target.matches && event.target.matches('.quantity__input[data-line]')) {
      event.preventDefault();
      event.target.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  /* ---------- Add to cart ---------- */
  function setBusy(form, busy) {
    form.dataset.busy = busy ? 'true' : 'false';
    form.querySelectorAll('[data-add-button]').forEach(function (button) {
      button.classList.toggle('is-loading', busy);
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
      if (busy) button.setAttribute('aria-disabled', 'true'); else button.removeAttribute('aria-disabled');
    });
  }

  function flashAdded(form) {
    form.querySelectorAll('[data-add-button]').forEach(function (button) {
      var label = button.querySelector('[data-add-label]');
      if (!label) return;
      var original = label.textContent;
      label.textContent = strings.added;
      button.classList.add('is-added');
      // Visual confirmation only; the live region carries the real announcement.
      setTimeout(function () { label.textContent = original; button.classList.remove('is-added'); }, 2200);
    });
  }

  function showFormError(form, message) {
    var box = form.querySelector('[data-form-error]');
    if (box) {
      box.querySelector('[data-form-error-text]').textContent = message;
      box.hidden = false;
    } else {
      H.toast(message, 'error');
    }
    H.announce(message);
  }

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form.matches || !form.matches('form[data-ajax-cart]')) return;
    event.preventDefault();
    if (form.dataset.busy === 'true') return; // block duplicate submissions
    if (!form.checkValidity()) { form.reportValidity(); return; }

    var errorBox = form.querySelector('[data-form-error]');
    if (errorBox) errorBox.hidden = true;
    setBusy(form, true);
    H.announce(strings.adding);

    var data = new FormData(form);
    var body = { items: [{ id: parseInt(data.get('id'), 10), quantity: parseInt(data.get('quantity'), 10) || 1 }] };
    // Line item properties (name="properties[Engraving]").
    var props = {};
    data.forEach(function (value, key) {
      var match = key.match(/^properties\[(.+)\]$/);
      if (match && value !== '') props[match[1]] = value;
    });
    if (Object.keys(props).length) body.items[0].properties = props;
    if (data.get('selling_plan')) body.items[0].selling_plan = parseInt(data.get('selling_plan'), 10);

    mutate(routes.cartAdd, body)
      .then(function (result) {
        setBusy(form, false);
        if (settings.cartType === 'page') { window.location.href = routes.cart; return; }
        flashAdded(form);
        applySections(result.sections);
        fetchCount().then(function () {
          H.announce(strings.added);
          if (settings.openCartOnAdd) openDrawer(form.querySelector('[data-add-button]'));
        });
      })
      .catch(function (err) {
        setBusy(form, false);
        showFormError(form, err.message || strings.cartError);
      });
  });

  /* Refresh stale cart when restored from the back/forward cache. */
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) refresh().catch(function () { /* ignore */ });
  });

  H.cart = { refresh: refresh, openDrawer: openDrawer };
})();
