// Read-only design gallery. Does not load or change the player's saved game.
(function () {
  const BCT = window.BCT;
  const captions = {
    dolphin: ['01 · DOLPHIN', 'ひかりが ゆれる、あおい ラグーン。'],
    turtle: ['02 · SEA TURTLE', 'やわらかな アマモに つつまれる おにわ。'],
    hermit: ['03 · HERMIT CRAB', 'かいがらの おうちが ならぶ、はまべの むら。'],
  };
  const sprite = (id, className = '', alt = '') => `<img class="${className}" src="assets/habitats/${id}.webp" alt="${alt}">`;
  document.getElementById('habitats').innerHTML = Object.entries(captions).map(([type, [number, line]]) => {
    const items = BCT.ITEMS.filter(it => it.slot === 'home' && it.only === type);
    return `<section class="habitat" data-type="${type}">
      <div class="title"><small>${number}</small><h2>${BCT.HABITATS[type]}</h2><p>${line}</p></div>
      <div class="scene">${sprite('habitat_' + type, 'bg', BCT.HABITATS[type])}
        <img class="pet" src="assets/pets/${type}-2-happy.webp" alt="${type === 'dolphin' ? 'イルカ' : type === 'turtle' ? 'ウミガメ' : 'ヤドカリ'}のようせい">
        ${items.map(it => sprite(it.id, 'furniture')).join('')}</div>
      <div class="items">${items.map(it => `<figure>${sprite(it.id)}<figcaption>${it.name}</figcaption></figure>`).join('')}</div>
    </section>`;
  }).join('');
  document.getElementById('foods').innerHTML = ['drop_blue', 'drop_green', 'drop_rainbow'].map(id => {
    const food = BCT.foodOf(id);
    return `<figure>${sprite(id)}<figcaption>${food.name}</figcaption><p>${food.note || ''}</p></figure>`;
  }).join('');
  document.getElementById('furniture').addEventListener('change', (event) => {
    document.body.classList.toggle('hide-furniture', !event.target.checked);
  });
})();
