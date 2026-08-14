#!/usr/bin/env python3
"""Normalize an alpha-matted 4x2 enemy sheet without changing anatomy.

Each source grid cell is independently cropped to its visible alpha bounds,
scaled into a restrained quadruped envelope, and planted on one shared contact
row. This avoids both authoring-grid distortion and per-frame ground hopping.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

from runtime_image_io import save_runtime_image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--rows", type=int, default=2)
    parser.add_argument("--cell", type=int, default=256)
    parser.add_argument("--max-width", type=int, default=228)
    parser.add_argument("--max-height", type=int, default=148)
    parser.add_argument("--baseline", type=int, default=232)
    parser.add_argument("--source-gutter", type=int, default=4)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    atlas = Image.new(
        "RGBA",
        (args.cols * args.cell, args.rows * args.cell),
        (0, 0, 0, 0),
    )

    for row in range(args.rows):
        for col in range(args.cols):
            x0 = round(col * source.width / args.cols) + args.source_gutter
            x1 = round((col + 1) * source.width / args.cols) - args.source_gutter
            y0 = round(row * source.height / args.rows) + args.source_gutter
            y1 = round((row + 1) * source.height / args.rows) - args.source_gutter
            tile = source.crop((x0, y0, x1, y1))
            bounds = tile.getchannel("A").getbbox()
            if bounds is None:
                raise SystemExit(f"empty source cell row={row} col={col}")
            tile = tile.crop(bounds)
            scale = min(args.max_width / tile.width, args.max_height / tile.height)
            size = (
                max(1, round(tile.width * scale)),
                max(1, round(tile.height * scale)),
            )
            tile = tile.resize(size, Image.Resampling.LANCZOS)
            paste_x = col * args.cell + (args.cell - size[0]) // 2
            paste_y = row * args.cell + args.baseline - size[1]
            atlas.alpha_composite(tile, (paste_x, paste_y))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    save_runtime_image(atlas, args.out)
    print(
        f"saved={args.out} size={atlas.size} baseline={args.baseline} "
        f"max={args.max_width}x{args.max_height}"
    )


if __name__ == "__main__":
    main()
