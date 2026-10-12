/* Painted food, furniture and habitats. Keep game state and original pet art untouched. */
(function () {
  const BCT = window.BCT;
  const sprites = BCT.HABITAT_SPRITES;
  const art = BCT.homeArt;
  if (!sprites || !art) return;

  const image = (id, width = 100, height = 100, fit = 'xMidYMid meet') =>
    `<image data-art-id="${id}" href="${sprites[id].src}" width="${width}" height="${height}" preserveAspectRatio="${fit}"/>`;
  const svg = (body, width = 100, height = 100) =>
    `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

  const oldDrop = art.dropSvg;
  art.dropSvg = (id) => sprites[id] && id.startsWith('drop_') ? svg(image(id)) : oldDrop(id);

  const oldHabitat = art.habitatBg;
  art.habitatBg = (type) => {
    const id = `habitat_${type}`;
    return sprites[id] ? svg(image(id, 400, 300, 'xMidYMid slice'), 400, 300) : oldHabitat(type);
  };

  // Mutate the existing art object: habitat, beach and shop share this same reference.
  for (const id of Object.keys(sprites)) {
    if (id.startsWith('home_')) art.HOME_ART[id] = () => image(id);
  }
  const oldHomeItem = art.homeItemSvg;
  art.homeItemSvg = (id) => sprites[id] && id.startsWith('home_') ? svg(image(id)) : oldHomeItem(id);

  const oldItemIcon = BCT.art.itemIcon;
  BCT.art.itemIcon = (id, petType) => sprites[id] && id.startsWith('home_')
    ? art.homeItemSvg(id) : oldItemIcon(id, petType);
})();
