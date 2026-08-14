from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

from runtime_image_io import save_runtime_image


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: normalize_heroine_components.py INPUT OUTPUT")

    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    source = Image.open(source_path)
    rgba = np.asarray(source.convert("RGBA"))
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    height, width = rgb.shape[:2]
    has_transparency = bool(np.any(alpha < 255))
    if has_transparency:
        # Image generation does not always honor a mathematically flat chroma
        # field. Run the shared chroma helper first, then use its alpha matte as
        # the source of truth instead of treating tiny background gradients as
        # foreground islands.
        foreground = alpha > 8
    else:
        key = rgb[0, 0].astype(np.int16)
        delta = np.max(np.abs(rgb.astype(np.int16) - key), axis=2)
        foreground = delta > 14
    rows, cols = 2, 4
    source_cell_w = width / cols
    source_cell_h = height / rows
    components: list[tuple[np.ndarray, np.ndarray]] = []
    frame_bounds: list[tuple[int, int, int, int]] = []

    for row in range(rows):
        y0 = int(round(row * source_cell_h))
        y1 = int(round((row + 1) * source_cell_h))
        if has_transparency:
            # Generated sheets frequently keep four columns but not four
            # mathematically equal cells. Discover the authored gutters from
            # the alpha matte so that a sword crossing an assumed 25% boundary
            # is not assigned to its neighbour.
            occupied_columns = np.any(foreground[y0:y1], axis=0)
            runs: list[tuple[int, int]] = []
            start: int | None = None
            for x, occupied in enumerate(occupied_columns):
                if occupied and start is None:
                    start = x
                elif not occupied and start is not None:
                    if x - start >= 64:
                        runs.append((start, x))
                    start = None
            if start is not None and width - start >= 64:
                runs.append((start, width))
            if len(runs) != cols:
                raise RuntimeError(
                    f"Row {row} must contain exactly {cols} isolated frames; "
                    f"found {len(runs)}: {runs}"
                )
            frame_bounds.extend((x0, x1, y0, y1) for x0, x1 in runs)
        else:
            frame_bounds.extend(
                (
                    int(round(col * source_cell_w)),
                    int(round((col + 1) * source_cell_w)),
                    y0,
                    y1,
                )
                for col in range(cols)
            )

    visited = np.zeros((height, width), dtype=bool)
    for index, (x0, x1, y0, y1) in enumerate(frame_bounds):
            row, col = divmod(index, cols)
            sub_y, sub_x = np.nonzero(foreground[y0:y1, x0:x1])
            if not sub_x.size:
                raise RuntimeError(f"No foreground found for frame {row},{col}")
            if has_transparency:
                # A keyed character is often made of multiple disconnected
                # islands (sword, tassel, hair tips). Treat every alpha island
                # inside its authored cell as one frame; selecting only the
                # nearest connected component silently drops weapons.
                ys = sub_y.astype(np.int32) + y0
                xs = sub_x.astype(np.int32) + x0
                if xs.size < 1000:
                    raise RuntimeError(
                        f"Frame {row},{col} alpha matte too small: {xs.size} pixels"
                    )
                components.append((ys, xs))
                continue
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

    output_cell_w = 384
    output_cell_h = 256
    sheet = Image.new("RGBA", (output_cell_w * cols, output_cell_h * rows), (0, 0, 0, 0)) \
        if has_transparency else Image.new(
            "RGB", (output_cell_w * cols, output_cell_h * rows), (255, 0, 255)
        )
    component_widths = [int(xs.max() - xs.min() + 5) for _, xs in components]
    component_heights = [int(ys.max() - ys.min() + 5) for ys, _ in components]
    common_scale = min(
        360 / max(component_widths),
        232 / max(component_heights),
        210 / float(np.median(component_heights)),
    )
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
        channels = 4 if has_transparency else 3
        fill = (0, 0, 0, 0) if has_transparency else (255, 0, 255)
        crop_array = np.full((y1 - y0, x1 - x0, channels), fill, dtype=np.uint8)
        local = component[y0:y1, x0:x1]
        source_pixels = rgba[y0:y1, x0:x1] if has_transparency else rgb[y0:y1, x0:x1]
        crop_array[local] = source_pixels[local]
        crop = Image.fromarray(crop_array, "RGBA" if has_transparency else "RGB")
        scale = common_scale
        new_width = max(1, int(round(crop.width * scale)))
        new_height = max(1, int(round(crop.height * scale)))
        resized = crop.resize(
            (new_width, new_height), Image.Resampling.LANCZOS
        )
        row, col = divmod(index, 4)
        paste_x = col * output_cell_w + (output_cell_w - new_width) // 2
        paste_y = row * output_cell_h + 244 - new_height
        sheet.paste(resized, (paste_x, paste_y))
        stats.append(
            f"frame={index} source_bbox={crop.width}x{crop.height} "
            f"scale={scale:.4f} target={new_width}x{new_height} "
            f"margins=({paste_x-col*output_cell_w},{paste_y-row*output_cell_h},"
            f"{output_cell_w-(paste_x-col*output_cell_w)-new_width},"
            f"{output_cell_h-(paste_y-row*output_cell_h)-new_height})"
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    save_runtime_image(sheet, output_path)
    print("\n".join(stats))


if __name__ == "__main__":
    main()
