#!/usr/bin/env python3
"""Prepare a generated square ground painting for lossless runtime tiling.

Image generators can describe a texture as seamless while still leaving small
pixel/value discontinuities at opposite borders. This tool preserves the
authored interior and reconciles each opposing border over a wide smooth band,
then writes the runtime WebP through the repository's lossless image policy.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from runtime_image_io import save_runtime_image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--size", type=int, default=1254)
    parser.add_argument("--blend-band", type=int, default=144)
    return parser.parse_args()


def _smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def _reconcile_edges(pixels: np.ndarray, axis: int, band: int) -> None:
    extent = pixels.shape[axis]
    band = max(2, min(int(band), extent // 3))
    for offset in range(band):
        interior_weight = _smoothstep(offset / (band - 1))
        first_slice = [slice(None)] * pixels.ndim
        last_slice = [slice(None)] * pixels.ndim
        first_slice[axis] = offset
        last_slice[axis] = extent - 1 - offset
        first = pixels[tuple(first_slice)].copy()
        last = pixels[tuple(last_slice)].copy()
        shared = (first + last) * 0.5
        pixels[tuple(first_slice)] = shared * (1.0 - interior_weight) + first * interior_weight
        pixels[tuple(last_slice)] = shared * (1.0 - interior_weight) + last * interior_weight


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGB")
    if source.width != source.height:
        raise RuntimeError(f"ground source must be square, got {source.size}")
    if source.size != (args.size, args.size):
        source = source.resize((args.size, args.size), Image.Resampling.LANCZOS)

    pixels = np.asarray(source, dtype=np.float32).copy()
    _reconcile_edges(pixels, axis=1, band=args.blend_band)
    _reconcile_edges(pixels, axis=0, band=args.blend_band)
    runtime = Image.fromarray(np.clip(np.rint(pixels), 0, 255).astype(np.uint8), "RGB")

    # The exact edge rows/columns are a hard contract for GPU repeat sampling.
    check = np.asarray(runtime)
    if not np.array_equal(check[:, 0], check[:, -1]):
        raise RuntimeError("left/right runtime edges do not match")
    if not np.array_equal(check[0], check[-1]):
        raise RuntimeError("top/bottom runtime edges do not match")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    save_runtime_image(runtime, args.out)
    print(
        f"saved={args.out} size={runtime.size} blend_band={args.blend_band} "
        "edges=exact"
    )


if __name__ == "__main__":
    main()
