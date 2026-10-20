/* Standalone component: no application scripts, storage, service worker or sound. */
(function (global) {
  'use strict';
  function mount(host, { assetBase = './assets/', onStart = () => {}, reducedMotion } = {}) {
    if (!host) throw new Error('An opening host element is required.');
    const abort = new AbortController();
    const signal = abort.signal;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let quiet = reducedMotion === undefined ? motion.matches : !!reducedMotion;
    let alive = true, exiting = false, title = false, loaded = false;
    let frame = 0, elapsed = 0, previous = 0, exitTimer = 0;
    const asset = name => assetBase.replace(/\/?$/, '/') + name;
    const root = document.createElement('section');
    root.className = 'sq-opening';
    root.setAttribute('aria-label', 'SHIKA QUEST オープニング');
    root.innerHTML = `
      <div class="sq-opening__stage">
        <div class="sq-opening__shore" aria-hidden="true"></div>
        <div class="sq-opening__shade" aria-hidden="true"></div>
        <div class="sq-opening__surround" aria-hidden="true"></div>
        <p class="sq-opening__hint">うみの ようせいたちと、ぼうけんへ。</p>
        <div class="sq-opening__sparkles" aria-hidden="true"></div>
        <div class="sq-opening__fairies" role="img" aria-label="イルカ、ウミガメ、ヤドカリのようせいが楽しそうに動いています">
          ${['dolphin','turtle','hermit'].map(type => `<div class="sq-opening__fairy sq-opening__fairy--${type}"><img alt="" data-asset="${type}.webp" draggable="false"><span class="sq-opening__hello" aria-hidden="true">✦</span></div>`).join('')}
        </div>
        <div class="sq-opening__ring" aria-hidden="true"></div>
        <div class="sq-opening__title" aria-hidden="true">
          <div class="sq-opening__logo-wrap"><img class="sq-opening__logo" data-asset="logo.png" alt="SHIKA QUEST"><span class="sq-opening__logo-text" hidden>SHIKA<br>QUEST</span></div>
          <button type="button" class="sq-opening__start" disabled tabindex="-1">スタート</button>
        </div>
        <p class="sq-opening__loading" role="status">ようせいたちを よんでいます</p>
        <button type="button" class="sq-opening__skip" aria-label="オープニングをスキップしてタイトルへ">スキップ</button>
      </div>`;
    host.append(root);
    const q = selector => root.querySelector(selector);
    const start = q('.sq-opening__start');
    const skip = q('.sq-opening__skip');
    const loading = q('.sq-opening__loading');
    const fairies = q('.sq-opening__fairies');
    q('.sq-opening__shore').style.backgroundImage = `url("${asset('shore.webp')}")`;
    const sparkles = q('.sq-opening__sparkles');
    for (let i = 0; i < 14; i++) {
      const dot = document.createElement('i');
      dot.className = 'sq-opening__sparkle';
      dot.style.cssText = `--x:${8 + (i * 29) % 84}%;--y:${16 + (i * 19) % 67}%;--delay:${-(i % 7) * .47}s`;
      sparkles.append(dot);
    }
    const images = [...root.querySelectorAll('[data-asset]')];
    const preload = images.map(img => new Promise(resolve => {
      let settled = false;
      const timeout = setTimeout(() => finish(false), 5000);
      function finish(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (!ok && alive && img.classList.contains('sq-opening__logo')) {
          img.hidden = true;
          q('.sq-opening__logo-text').hidden = false;
        } else if (!ok && alive) img.hidden = true;
        resolve(ok);
      }
      img.addEventListener('load', () => finish(true), { once:true, signal });
      img.addEventListener('error', () => finish(false), { once:true, signal });
      signal.addEventListener('abort', () => finish(false), { once:true });
      img.src = asset(img.dataset.asset);
      if (img.complete) finish(img.naturalWidth > 0);
    }));
    function enableStart() {
      if (!alive || exiting) return;
      start.disabled = false;
      start.removeAttribute('tabindex');
    }
    function showTitle({ focus = false } = {}) {
      if (!alive || title || exiting) return;
      focus = focus || root.contains(document.activeElement);
      title = true;
      cancelAnimationFrame(frame);
      loading.hidden = true;
      skip.hidden = true;
      root.classList.toggle('is-reduced', quiet);
      root.classList.add('is-title');
      root.dataset.phase = 'title';
      fairies.setAttribute('aria-hidden', 'true');
      q('.sq-opening__title').setAttribute('aria-hidden', 'false');
      // Keep the invisible button out of the keyboard order until its entrance ends.
      start.addEventListener('animationend', event => {
        if (event.target === start) { enableStart(); if (focus) start.focus(); }
      }, { signal });
      if (quiet) { enableStart(); if (focus) start.focus(); }
    }
    function tick(now) {
      if (!alive || title || exiting) return;
      if (!document.hidden) {
        if (previous) elapsed += now - previous;
        previous = now;
        if (elapsed >= 5200) {
          root.classList.add('is-fading');
          root.dataset.phase = 'fade';
        }
        if (elapsed >= 6100) { showTitle(); return; }
      } else previous = 0;
      frame = requestAnimationFrame(tick);
    }
    function visibility() {
      previous = 0;
      root.classList.toggle('is-paused', document.hidden);
    }
    document.addEventListener('visibilitychange', visibility, { signal });
    visibility();
    function motionChanged() {
      if (reducedMotion !== undefined) return;
      quiet = motion.matches;
      if (quiet && loaded) {
        root.classList.add('is-reduced');
        if (title) enableStart(); else showTitle();
      }
    }
    motion.addEventListener('change', motionChanged, { signal });
    skip.addEventListener('click', () => showTitle({ focus:true }), { signal });
    start.addEventListener('click', () => {
      if (exiting || !title || start.disabled) return;
      exiting = true;
      root.dataset.phase = 'exit';
      start.disabled = true;
      root.classList.add('is-out');
      exitTimer = setTimeout(() => {
        if (!alive) return;
        root.hidden = true;
        onStart();
      }, quiet ? 0 : 400);
    }, { signal });
    root.dataset.phase = 'loading';
    const ready = Promise.all(preload).then(results => {
      if (!alive || title) return results;
      loaded = true;
      loading.hidden = true;
      if (quiet) showTitle();
      else {
        root.classList.add('is-playing');
        root.dataset.phase = 'fairies';
        frame = requestAnimationFrame(tick);
      }
      return results;
    });
    function destroy() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(frame);
      clearTimeout(exitTimer);
      abort.abort();
      root.remove();
    }
    return { ready, showTitle, destroy, element:root };
  }
  global.ShikaQuestOpening = { mount };
})(window);
