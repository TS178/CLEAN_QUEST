"""Export the six approved Shika designs and update the embedded sprite bundles.

Run after pack-pet-art.mjs / pack-habitat-art.mjs if rebuilding those atlases.
Requires Pillow with WebP support. Original approved PNGs remain untouched.
"""
import base64
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/design-proposals/shika-items-20261016"
OVERRIDES = {"accessory_pendant": ROOT / "assets/item-source/sakuragai-pendant-charm.png"}
GROUPS = {
    "PET_SPRITES": ("pet-sprites.js", "items", {
        "accessory_pendant": "sakuragai-pendant.png",
        "accessory_korogaki": "korogaki-pochette.png",
        "head_flower": "hamanasu-flower.png",
    }),
    "HABITAT_SPRITES": ("habitat-sprites.js", "habitats", {
        "home_shika_lighthouse": "fukuura-lighthouse.png",
        "home_shika_bench": "bench.png",
        "home_shika_ganmon": "ganmon.png",
    }),
}

for bundle, (filename, folder, entries) in GROUPS.items():
    target = ROOT / "js" / filename
    source = target.read_text(encoding="utf-8")
    if "then python tools/pack-shika-items.py" not in source.splitlines()[0]:
        source = source.replace(".mjs */", ".mjs then python tools/pack-shika-items.py */", 1)
    # Preserve the original wrapper and every unrelated entry.
    start = source.index("{", source.index(bundle + " ="))
    data, end = json.JSONDecoder().raw_decode(source[start:])
    for item_id, original in entries.items():
        im = Image.open(OVERRIDES.get(item_id, SOURCE / original)).convert("RGBA")
        box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if not box:
            raise ValueError(f"Empty approved art: {original}")
        im = im.crop(box)
        im.thumbnail((488, 488), Image.Resampling.LANCZOS)
        # Equipment keeps its silhouette aspect ratio; furniture uses the existing square canvas.
        size = (512, 512) if folder == "habitats" else (im.width + 8, im.height + 8)
        canvas = Image.new("RGBA", size)
        canvas.alpha_composite(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2))
        relative = f"assets/{folder}/{item_id}.webp"
        output = ROOT / relative
        canvas.save(output, "WEBP", quality=90, method=6)
        data[item_id] = {"width": size[0], "height": size[1],
                         "src": "data:image/webp;base64," + base64.b64encode(output.read_bytes()).decode("ascii"),
                         "file": relative}
        print(f"{relative}: {size[0]}x{size[1]}, {output.stat().st_size:,} bytes")
    target.write_text(source[:start] + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + source[start + end:], encoding="utf-8", newline="\n")
