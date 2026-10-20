/* Start the existing application once, only after leaving the opening. */
(function () {
  'use strict';
  const app = document.getElementById('app');
  const host = document.getElementById('questOpeningHost');
  let opening = null;
  let started = false;

  function enterApp() {
    if (started) return;
    started = true;
    if (opening) opening.destroy();
    host.remove();
    app.inert = false;
    document.body.classList.remove('opening-pending');
    BCT.start();
    // BCT.start restores the existing save and chooses home or egg selection.
    const screen = app.querySelector('.screen.active');
    if (screen) {
      screen.setAttribute('tabindex', '-1');
      screen.focus({ preventScroll:true });
    }
  }

  try {
    if (!window.ShikaQuestOpening) { enterApp(); return; }
    opening = ShikaQuestOpening.mount(host, {
      assetBase: './assets/opening/',
      reducedMotion: BCT.prefs.get().reduceMotion ? true : undefined,
      onStart: enterApp
    });
    opening.element.querySelector('.sq-opening__skip').focus({ preventScroll:true });
  } catch (error) {
    console.warn('Opening unavailable; continuing to the application.', error);
    enterApp();
  }
})();
