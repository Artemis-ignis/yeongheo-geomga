from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: normalize_jade_serpent_components.py INPUT OUTPUT")

    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    image = Image.open(source_path).convert("RGB")
    rgb = np.asarray(image)
    key = np.median(
        np.concatenate(
            [rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]],
            axis=0,
        ),
        axis=0,
    )
    distance = np.linalg.norm(
        rgb.astype(np.float32) - key.astype(np.float32), axis=2
    )
    labels, _ = ndimage.label(distance > 35)
    objects = ndimage.find_objects(labels)
    items: list[tuple[int, float, int, tuple[int, int, int, int], int]] = []
    for label_id, slices in enumerate(objects, 1):
        if slices is None:
            continue
        area = int(np.count_nonzero(labels[slices] == label_id))
        if area < 1000:
            continue
        y0, y1 = slices[0].start, slices[0].stop
        x0, x1 = slices[1].start, slices[1].stop
        items.append(
            (
                0 if (y0 + y1) / 2 < image.height / 2 else 1,
                (x0 + x1) / 2,
                label_id,
                (x0, y0, x1, y1),
                area,
            )
        )
    items = sorted(items, key=lambda value: (value[0], value[1]))
    if len(items) != 8:
        raise SystemExit(f"expected 8 subjects, found {len(items)}")

    canvas = Image.new("RGB", (1024, 512), (255, 0, 255))
    for index, (_, _, label_id, _, _) in enumerate(items):
        keep = ndimage.binary_dilation(labels == label_id, iterations=3)
        ys, xs = np.nonzero(keep)
        x0 = max(0, int(xs.min()) - 2)
        x1 = min(image.width, int(xs.max()) + 3)
        y0 = max(0, int(ys.min()) - 2)
        y1 = min(image.height, int(ys.max()) + 3)
        tile_rgb = rgb[y0:y1, x0:x1].copy()
        keep_mask = keep[y0:y1, x0:x1]
        tile_rgb[~keep_mask] = np.array([255, 0, 255], dtype=np.uint8)
        tile_distance = np.linalg.norm(
            tile_rgb.astype(np.float32) - key.astype(np.float32), axis=2
        )
        tile_rgb[tile_distance <= 18] = np.array(
            [255, 0, 255], dtype=np.uint8
        )
        tile = Image.fromarray(tile_rgb, "RGB")
        scale = min(228 / tile.width, 228 / tile.height)
        size = (
            max(1, round(tile.width * scale)),
            max(1, round(tile.height * scale)),
        )
        tile = tile.resize(size, Image.Resampling.LANCZOS)
        col = index % 4
        row = index // 4
        paste_x = col * 256 + (256 - size[0]) // 2
        paste_y = row * 256 + 246 - size[1]
        canvas.paste(tile, (paste_x, paste_y))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, optimize=True)
    print(f"saved={output_path} size={canvas.size} subjects={len(items)}")


if __name__ == "__main__":
    main()
