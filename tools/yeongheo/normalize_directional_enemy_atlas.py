#!/usr/bin/env python3
"""Normalize an alpha-matted 4x2 enemy sheet without changing anatomy.

Each source grid cell is independently cropped to its visible alpha bounds,
scaled into a restrained enemy envelope, and planted on one shared contact
row. This avoids both authoring-grid distortion and per-frame ground hopping.
Generated sheets may place frames off the mathematical quarter-grid, so an
optional alpha-valley splitter can recover the real transparent gutters first.
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
    parser.add_argument(
        "--row-leading-overlap",
        type=int,
        default=0,
        help="Extend non-first rows upward to retain poses that cross the nominal row boundary.",
    )
    parser.add_argument(
        "--row-trailing-trim",
        type=int,
        default=0,
        help="Trim non-last rows above the nominal boundary to exclude lower-row overlap.",
    )
    parser.add_argument(
        "--alpha-activity-threshold",
        type=int,
        default=0,
        help="Ignore chroma fringe at or below this alpha when finding gutters and crop bounds.",
    )
    parser.add_argument(
        "--auto-column-cuts",
        action="store_true",
        help="Find each row's real frame gutters from transparent alpha valleys.",
    )
    return parser.parse_args()


def _auto_column_bounds(
    source: Image.Image,
    row_y0: int,
    row_y1: int,
    cols: int,
    minimum_gap: int,
    alpha_activity_threshold: int,
) -> list[tuple[int, int]]:
    """Return frame bounds split at the widest transparent gutters in a row."""

    alpha = source.getchannel("A")
    active = [
        alpha.crop((x, row_y0, x + 1, row_y1)).getextrema()[1]
        > alpha_activity_threshold
        for x in range(source.width)
    ]
    active_x = [x for x, present in enumerate(active) if present]
    if not active_x:
        raise SystemExit(f"empty source row y={row_y0}:{row_y1}")

    gaps: list[tuple[int, int]] = []
    start: int | None = None
    for x in range(active_x[0] + 1, active_x[-1]):
        if not active[x] and start is None:
            start = x
        elif active[x] and start is not None:
            if x - start >= minimum_gap:
                gaps.append((start, x))
            start = None
    if start is not None and active_x[-1] - start >= minimum_gap:
        gaps.append((start, active_x[-1]))

    if len(gaps) < cols - 1:
        raise SystemExit(
            f"cannot find {cols - 1} transparent frame gutters in row "
            f"y={row_y0}:{row_y1}; found={gaps}"
        )

    selected = sorted(
        sorted(gaps, key=lambda gap: gap[1] - gap[0], reverse=True)[: cols - 1]
    )
    cuts = [0, *[(start + end) // 2 for start, end in selected], source.width]
    return [(cuts[col], cuts[col + 1]) for col in range(cols)]


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    atlas = Image.new(
        "RGBA",
        (args.cols * args.cell, args.rows * args.cell),
        (0, 0, 0, 0),
    )

    for row in range(args.rows):
        row_y0 = round(row * source.height / args.rows)
        row_y1 = round((row + 1) * source.height / args.rows)
        column_bounds = (
            _auto_column_bounds(
                source,
                row_y0,
                row_y1,
                args.cols,
                max(3, args.source_gutter * 2),
                max(0, min(254, args.alpha_activity_threshold)),
            )
            if args.auto_column_cuts
            else [
                (
                    round(col * source.width / args.cols),
                    round((col + 1) * source.width / args.cols),
                )
                for col in range(args.cols)
            ]
        )
        for col in range(args.cols):
            x0 = column_bounds[col][0] + args.source_gutter
            x1 = column_bounds[col][1] - args.source_gutter
            leading_overlap = args.row_leading_overlap if row > 0 else 0
            y0 = max(0, row_y0 - max(0, leading_overlap)) + args.source_gutter
            trailing_trim = args.row_trailing_trim if row < args.rows - 1 else 0
            y1 = min(source.height, row_y1 - max(0, trailing_trim)) - args.source_gutter
            tile = source.crop((x0, y0, x1, y1))
            alpha = tile.getchannel("A")
            if args.alpha_activity_threshold > 0:
                alpha = alpha.point(
                    lambda value: 255 if value > args.alpha_activity_threshold else 0
                )
            bounds = alpha.getbbox()
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
