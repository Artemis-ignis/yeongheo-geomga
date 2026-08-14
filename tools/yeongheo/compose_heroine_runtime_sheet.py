from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from runtime_image_io import save_runtime_image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compose normalized 8-frame run and attack sheets into one 4x4 runtime atlas."
    )
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--attack", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args()


def validate_sheet(path: Path, image: Image.Image) -> None:
    if image.size != (1536, 512):
        raise RuntimeError(f"{path}: expected 1536x512, got {image.size}")
    alpha = np.asarray(image)[:, :, 3]
    for index in range(8):
        row, col = divmod(index, 4)
        cell = alpha[row * 256:(row + 1) * 256, col * 384:(col + 1) * 384]
        if np.count_nonzero(cell > 8) < 1000:
            raise RuntimeError(f"{path}: frame {index} has no usable silhouette")
        if any((
            np.any(cell[:, 0] > 8), np.any(cell[:, -1] > 8),
            np.any(cell[0] > 8), np.any(cell[-1] > 8),
        )):
            raise RuntimeError(f"{path}: frame {index} touches its cell boundary")


def main() -> None:
    args = parse_args()
    run = Image.open(args.run).convert("RGBA")
    attack = Image.open(args.attack).convert("RGBA")
    validate_sheet(args.run, run)
    validate_sheet(args.attack, attack)
    atlas = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    atlas.alpha_composite(run, (0, 0))
    atlas.alpha_composite(attack, (0, 512))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    save_runtime_image(atlas, args.out)
    print(f"Wrote {args.out} with 16 validated frames")


if __name__ == "__main__":
    main()
