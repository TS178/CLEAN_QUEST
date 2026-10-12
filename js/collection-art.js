/* Approved painted achievements and beach sorting assets; embedded for offline SVG use. */
(function () {
  const BCT = window.BCT, sprites = BCT.COLLECTION_SPRITES;
  if (!sprites) return;
  const svg = (id, width = 100, height = 100) => {
    const s = sprites[id] || BCT.MISSION_SPRITES?.[id];
    return s ? `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><image data-collection-art="${id}" href="${s.src}" x="3" y="3" width="${width - 6}" height="${height - 6}" preserveAspectRatio="xMidYMid meet"/></svg>` : '';
  };
  BCT.collectionArt = {
    badge: (id) => svg(`badge_${id}`),
    bin: (key) => svg(`bin_${key}`, 80, 120),
    trash: (kind) => svg(kind, 64, 64),
    missionIcon: (key) => svg({ pet: 'b_bottle', plastic: 'b_bag', net: 'b_rope', float: 'mission_float', can: 'b_can', bin: 'b_glass', wood: 'b_wood', other: 'mission_other' }[key], 64, 64),
  };
  if (BCT.homeArt) {
    const art = BCT.homeArt, oldBin = art.binSvg, oldTrash = art.trashSvg;
    art.binSvg = (key) => sprites[`bin_${key}`] ? svg(`bin_${key}`, 80, 120) : oldBin(key);
    art.trashSvg = (kind) => sprites[kind] ? svg(kind, 64, 64) : oldTrash(kind);
  }
})();
