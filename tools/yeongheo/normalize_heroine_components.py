from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: normalize_heroine_components.py INPUT OUTPUT")

    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    image = Image.open(source_path).convert("RGB")
    rgb = np.asarray(image)
    height, width = rgb.shape[:2]
    key = rgb[0, 0].astype(np.int16)
    delta = np.max(np.abs(rgb.astype(np.int16) - key), axis=2)
    foreground = delta > 14
    visited = np.zeros((height, width), dtype=bool)
    rows, cols = 2, 4
    source_cell_w = width / cols
    source_cell_h = height / rows
    components: list[tuple[np.ndarray, np.ndarray]] = []

    for row in range(rows):
        for col in range(cols):
            x0 = int(round(col * source_cell_w))
            x1 = int(round((col + 1) * source_cell_w))
            y0 = int(round(row * source_cell_h))
            y1 = int(round((row + 1) * source_cell_h))
            sub_y, sub_x = np.nonzero(
                foreground[y0:y1, x0:x1] & ~visited[y0:y1, x0:x1]
            )
            if not sub_x.size:
                raise RuntimeError(f"No foreground found for frame {row},{col}")
            center_x = (x0 + x1) / 2
            center_y = y0 + source_cell_h * 0.48
            distances = (
                (sub_x + x0 - center_x) ** 2
                + (sub_y + y0 - center_y) ** 2
            )
            nearest = int(np.argmin(distances))
            seed_x = int(sub_x[nearest] + x0)
            seed_y = int(sub_y[nearest] + y0)
            queue: deque[tuple[int, int]] = deque([(seed_y, seed_x)])
            visited[seed_y, seed_x] = True
            ys: list[int] = []
            xs: list[int] = []
            while queue:
                y, x = queue.popleft()
                ys.append(y)
                xs.append(x)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        ny, nx = y + dy, x + dx
                        if (
                            0 <= ny < height
                            and 0 <= nx < width
                            and foreground[ny, nx]
                            and not visited[ny, nx]
                        ):
                            visited[ny, nx] = True
                            queue.append((ny, nx))
            if len(xs) < 1000:
                raise RuntimeError(
                    f"Frame {row},{col} component too small: {len(xs)} pixels"
                )
            components.append(
                (np.asarray(ys, dtype=np.int32), np.asarray(xs, dtype=np.int32))
            )

    sheet = Image.new("RGB", (1024, 512), (255, 0, 255))
    base_scale = 1024 / width
    stats: list[str] = []
    for index, (ys, xs) in enumerate(components):
        component = np.zeros((height, width), dtype=bool)
        component[ys, xs] = True
        for _ in range(2):
            expanded = component.copy()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    y_dst0, y_dst1 = max(0, dy), min(height, height + dy)
                    x_dst0, x_dst1 = max(0, dx), min(width, width + dx)
                    y_src0, y_src1 = max(0, -dy), min(height, height - dy)
                    x_src0, x_src1 = max(0, -dx), min(width, width - dx)
                    expanded[y_dst0:y_dst1, x_dst0:x_dst1] |= component[
                        y_src0:y_src1, x_src0:x_src1
                    ]
            component = expanded
        cy, cx = np.nonzero(component)
        x0, x1 = int(cx.min()), int(cx.max()) + 1
        y0, y1 = int(cy.min()), int(cy.max()) + 1
        crop_array = np.full(
            (y1 - y0, x1 - x0, 3), (255, 0, 255), dtype=np.uint8
        )
        local = component[y0:y1, x0:x1]
        crop_array[local] = rgb[y0:y1, x0:x1][local]
        crop = Image.fromarray(crop_array, "RGB")
        scale = min(base_scale, 232 / crop.width, 232 / crop.height)
        new_width = max(1, int(round(crop.width * scale)))
        new_height = max(1, int(round(crop.height * scale)))
        resized = crop.resize(
            (new_width, new_height), Image.Resampling.LANCZOS
        )
        row, col = divmod(index, 4)
        paste_x = col * 256 + (256 - new_width) // 2
        paste_y = row * 256 + 244 - new_height
        sheet.paste(resized, (paste_x, paste_y))
        stats.append(
            f"frame={index} source_bbox={crop.width}x{crop.height} "
            f"scale={scale:.4f} target={new_width}x{new_height} "
            f"margins=({paste_x-col*256},{paste_y-row*256},"
            f"{256-(paste_x-col*256)-new_width},"
            f"{256-(paste_y-row*256)-new_height})"
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, optimize=True)
    print("\n".join(stats))


if __name__ == "__main__":
    main()
