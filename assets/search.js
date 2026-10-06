/* Halden — search.js
   <predictive-search>: debounced, abortable requests to Shopify's predictive search endpoint
   through the Section Rendering API (section_id=predictive-search). */
(function () {
  'use strict';

  var H = window.Halden;
  if (!H) return;
  var strings = H.config.strings || {};

  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      this.input = this.querySelector('[data-search-input]');
      this.results = this.querySelector('[data-results]');
      this.status = this.querySelector('[data-status]');
      this.clearButton = this.querySelector('[data-search-clear]');
      this.defaultContent = this.querySelector('[data-default-content]');
      this.cache = new Map();
      this.enabled = this.dataset.enabled === 'true';
      this.controller = null;
      this.lastQuery = '';

      this.onInput = H.debounce(this.search.bind(this), 250);
      this.input.addEventListener('input', this.onInput);
      this.input.addEventListener('input', () => this.syncClear());
      this.input.addEventListener('keydown', (e) => this.onInputKey(e));
      this.results.addEventListener('keydown', (e) => this.onResultKey(e));
      this.form.addEventListener('reset', () => this.reset());
      this.syncClear();
      this.addEventListener('halden:dialog-close', () => this.abort());
    }

    disconnectedCallback() {
      this.onInput.cancel();
      this.abort();
    }

    syncClear() {
      if (this.clearButton) this.clearButton.hidden = this.input.value.length === 0;
    }

    abort() {
      if (this.controller) { this.controller.abort(); this.controller = null; }
    }

    reset() {
      this.onInput.cancel();
      this.abort();
      this.lastQuery = '';
      this.setLoading(false);
      this.results.replaceChildren();
      if (this.defaultContent) this.results.appendChild(this.defaultContent);
      this.status.textContent = '';
      requestAnimationFrame(() => { this.syncClear(); this.input.focus(); });
    }

    setLoading(loading) {
      this.toggleAttribute('data-loading', loading);
      this.results.setAttribute('aria-busy', loading ? 'true' : 'false');
      if (loading) this.status.textContent = strings.searchLoading;
    }

    showMessage(text) {
      var p = document.createElement('p');
      p.className = 'predictive-results__empty';
      p.textContent = text;
      this.results.replaceChildren(p);
      this.status.textContent = text;
    }

    render(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var fresh = doc.querySelector('.predictive-results');
      if (!fresh) { this.results.replaceChildren(); return; }
      this.results.replaceChildren(document.importNode(fresh, true));
      var total = parseInt(fresh.getAttribute('data-total'), 10) || 0;
      var template = total === 1 ? strings.searchResultsOne : strings.searchResultsOther;
      this.status.textContent = total ? H.formatCount(template, total) : strings.searchNoResults;
    }

    search() {
      var term = this.input.value.trim();
      if (!this.enabled) return;
      if (term === this.lastQuery) return;
      this.lastQuery = term;
      this.abort();

      if (term.length === 0) { this.reset(); return; }

      if (this.cache.has(term)) { this.render(this.cache.get(term)); return; }

      this.controller = new AbortController();
      var params = new URLSearchParams({
        q: term,
        section_id: 'predictive-search',
        'resources[type]': 'product,collection,article,page,query',
        'resources[limit]': '6',
        'resources[limit_scope]': 'each',
        'resources[options][unavailable_products]': 'last'
      });
      this.setLoading(true);
      fetch(this.dataset.url + '?' + params.toString(), { signal: this.controller.signal })
        .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
        .then((html) => {
          this.cache.set(term, html);
          if (term !== this.lastQuery) return; // a newer query superseded this one
          this.render(html);
          this.setLoading(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          this.setLoading(false);
          this.lastQuery = ''; // allow retry of the same term
          this.showMessage(strings.searchError);
        });
    }

    links() { return Array.prototype.slice.call(this.results.querySelectorAll('[data-result]')); }

    onInputKey(event) {
      if (event.key === 'ArrowDown') {
        var links = this.links();
        if (links.length) { event.preventDefault(); links[0].focus(); }
      }
    }

    onResultKey(event) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      var links = this.links();
      var index = links.indexOf(document.activeElement);
      if (index === -1) return;
      event.preventDefault();
      if (event.key === 'ArrowDown') {
        (links[index + 1] || links[index]).focus();
      } else if (index === 0) {
        this.input.focus();
      } else {
        links[index - 1].focus();
      }
    }
  }
  if (!customElements.get('predictive-search')) customElements.define('predictive-search', PredictiveSearch);
})();
