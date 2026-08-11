#!/usr/bin/env python3
"""Report suspicious saturated green pixels per atlas cell."""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--rows", type=int, default=2)
    args = parser.parse_args()
    pixels = np.array(Image.open(args.input).convert("RGBA"))
    cell_width = pixels.shape[1] // args.cols
    cell_height = pixels.shape[0] // args.rows
    for row in range(args.rows):
        for column in range(args.cols):
            cell = pixels[row * cell_height:(row + 1) * cell_height, column * cell_width:(column + 1) * cell_width]
            red = cell[..., 0].astype(np.int16)
            green = cell[..., 1].astype(np.int16)
            blue = cell[..., 2].astype(np.int16)
            alpha = cell[..., 3]
            mask = (alpha > 20) & (green > 50) & (green - red > 24) & (green - blue > 12)
            y, x = np.where(mask)
            bbox = None if len(x) == 0 else (int(x.min()), int(y.min()), int(x.max()), int(y.max()))
            common = Counter(map(tuple, cell[mask][..., :3])).most_common(6)
            edge_alpha = np.concatenate((
                cell[0, :, 3], cell[-1, :, 3], cell[:, 0, 3], cell[:, -1, 3],
            ))
            print(
                f"cell={row * args.cols + column} count={len(x)} bbox={bbox} "
                f"edge_alpha={int((edge_alpha > 0).sum())} colors={common}"
            )


if __name__ == "__main__":
    main()
