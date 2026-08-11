#!/usr/bin/env python3
"""Normalize an already alpha-matted grid into fixed-size Pixi atlas cells."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--rows", type=int, default=2)
    parser.add_argument("--cell", type=int, default=256)
    parser.add_argument("--gutter", type=int, default=6)
    parser.add_argument("--guard", type=int, default=8)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    atlas = Image.new("RGBA", (args.cols * args.cell, args.rows * args.cell), (0, 0, 0, 0))

    for row in range(args.rows):
        for col in range(args.cols):
            x0 = round(col * source.width / args.cols)
            x1 = round((col + 1) * source.width / args.cols)
            y0 = round(row * source.height / args.rows)
            y1 = round((row + 1) * source.height / args.rows)
            left = x0 + args.gutter
            right = x1 - args.gutter
            top = y0 + args.gutter
            bottom = y1 - args.gutter
            cell = source.crop((left, top, right, bottom))
            cell = cell.resize((args.cell, args.cell), Image.Resampling.LANCZOS)
            guard = max(1, min(args.guard, args.cell // 8))
            cell.paste((0, 0, 0, 0), (0, 0, args.cell, guard))
            cell.paste((0, 0, 0, 0), (0, args.cell - guard, args.cell, args.cell))
            cell.paste((0, 0, 0, 0), (0, 0, guard, args.cell))
            cell.paste((0, 0, 0, 0), (args.cell - guard, 0, args.cell, args.cell))
            atlas.alpha_composite(cell, (col * args.cell, row * args.cell))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(args.out, optimize=True)


if __name__ == "__main__":
    main()
