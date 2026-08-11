#!/usr/bin/env python3
"""Remove green-screen spill connected to transparent atlas backgrounds."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image = Image.open(args.input).convert("RGBA")
    pixels = np.array(image)
    red = pixels[..., 0].astype(np.int16)
    green = pixels[..., 1].astype(np.int16)
    blue = pixels[..., 2].astype(np.int16)
    alpha = pixels[..., 3]

    # Only the saturated green-screen family is floodable. Muted jade and cyan
    # paint remain outside this mask, even when they touch an object's edge.
    green_screen = (
        (green > 42)
        & (green - red > 30)
        & (green - blue > 24)
        & (green > red * 1.28)
        & (green > blue * 1.20)
    )
    transparent = alpha < 12
    floodable = transparent | green_screen

    # Pad with one connected exterior region, then flood through transparent
    # pixels and green-screen spill. Enclosed jade surfaces are not reached.
    padded = Image.new("L", (image.width + 2, image.height + 2), 255)
    padded.paste(Image.fromarray((floodable * 255).astype(np.uint8), "L"), (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    exterior = np.array(padded, dtype=np.uint8)[1:-1, 1:-1] == 128

    # Detached neon flecks are also chroma debris. Cyan spell light is retained
    # because its blue channel prevents it from entering this mask.
    neon_fleck = (
        (green > 125)
        & (green - red > 58)
        & (green - blue > 48)
        & (green > red * 1.55)
        & (green > blue * 1.42)
    )
    pure_key = (
        (green > 45)
        & (red < 20)
        & (blue < 26)
        & (green > red * 2.4)
        & (green > blue * 2.2)
    )
    # A keyed plate can leave a thicker lime shelf directly under feet or
    # props. It may be enclosed by a soft contact shadow, so the exterior flood
    # alone cannot reach it. Remove only strongly chromatic green within twelve
    # pixels of transparency; muted jade surfaces remain below these thresholds.
    near_exterior = Image.fromarray(
        (transparent * 255).astype(np.uint8), "L"
    ).filter(ImageFilter.MaxFilter(25))
    chroma_shelf = (
        (np.array(near_exterior) > 0)
        & (alpha > 0)
        & (green > 68)
        & (green - red > 38)
        & (green - blue > 30)
        & (green > red * 1.42)
        & (green > blue * 1.3)
    )
    removed = (exterior & green_screen) | neon_fleck | pure_key | chroma_shelf
    pixels[..., 3][removed] = 0
    pixels[..., 3][pixels[..., 3] < 18] = 0

    # Despill the two-pixel visible rim without changing alpha or jade interiors.
    transparent_after = Image.fromarray(
        ((pixels[..., 3] == 0) * 255).astype(np.uint8), "L"
    ).filter(ImageFilter.MaxFilter(5))
    edge = (np.array(transparent_after) > 0) & (pixels[..., 3] > 0)
    edge_green = edge & (green > red + 7) & (green > blue + 6)
    neutral_green = np.maximum(red, blue) + 5
    pixels[..., 1][edge_green] = np.clip(neutral_green[edge_green], 0, 255).astype(np.uint8)

    # Fully transparent keyed pixels must not retain green RGB data. Atlas
    # resampling can otherwise pull that invisible colour back into new
    # partially transparent pixels and recreate a green shelf at runtime.
    pixels[..., :3][pixels[..., 3] == 0] = 0

    args.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels, "RGBA").save(args.out, optimize=True)

    remaining = (
        (pixels[..., 3] > 24)
        & (pixels[..., 1].astype(np.int16) - pixels[..., 0].astype(np.int16) > 58)
        & (pixels[..., 1].astype(np.int16) - pixels[..., 2].astype(np.int16) > 48)
    )
    print(
        f"removed={int(removed.sum())} "
        f"visible_neon_green={int(remaining.sum())} "
        f"visible_pixels={int((pixels[..., 3] > 0).sum())}"
    )


if __name__ == "__main__":
    main()
