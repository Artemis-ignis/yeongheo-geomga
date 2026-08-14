#!/usr/bin/env python3
"""Remove an exterior magenta key plate while preserving red game art.

Generated motion sheets use magenta because the scarlet actors themselves can
contain green, cyan and ember orange. Only magenta-family pixels connected to
the exterior are removed; enclosed cinnabar seams and dark violet material are
kept. Fully transparent RGB is zeroed before atlas resampling to prevent a pink
halo from bleeding back into the runtime texture.
"""

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

    magenta_screen = (
        (red > 125)
        & (blue > 125)
        & (np.minimum(red, blue) - green > 62)
        & (np.abs(red - blue) < 76)
    )
    transparent = alpha < 12
    floodable = transparent | magenta_screen

    padded = Image.new("L", (image.width + 2, image.height + 2), 255)
    padded.paste(Image.fromarray((floodable * 255).astype(np.uint8), "L"), (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    exterior = np.array(padded, dtype=np.uint8)[1:-1, 1:-1] == 128

    pure_key = (
        (red > 190)
        & (blue > 190)
        & (green < 90)
        & (np.abs(red - blue) < 58)
    )
    near_exterior = Image.fromarray(
        ((transparent | (exterior & magenta_screen)) * 255).astype(np.uint8), "L"
    ).filter(ImageFilter.MaxFilter(17))
    chroma_shelf = (
        (np.array(near_exterior) > 0)
        & (alpha > 0)
        & (red > 145)
        & (blue > 145)
        & (np.minimum(red, blue) - green > 74)
        & (np.abs(red - blue) < 64)
    )
    removed = (exterior & magenta_screen) | pure_key | chroma_shelf
    pixels[..., 3][removed] = 0
    pixels[..., 3][pixels[..., 3] < 18] = 0

    transparent_after = Image.fromarray(
        ((pixels[..., 3] == 0) * 255).astype(np.uint8), "L"
    ).filter(ImageFilter.MaxFilter(9))
    edge = (np.array(transparent_after) > 0) & (pixels[..., 3] > 0)
    edge_magenta = (
        edge
        & (red > green + 24)
        & (blue > green + 24)
        & (np.abs(red - blue) < 72)
    )
    # A warm red-brown rim is compatible with this actor's ember seams; an
    # equal red/blue rim still reads as the original key plate on white.
    pixels[..., 2][edge_magenta] = np.clip(
        np.maximum(green[edge_magenta] + 4, red[edge_magenta] * 0.58), 0, 255,
    ).astype(np.uint8)
    pixels[..., :3][pixels[..., 3] == 0] = 0

    args.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels, "RGBA").save(args.out, optimize=True)
    remaining = (
        (pixels[..., 3] > 24)
        & (pixels[..., 0].astype(np.int16) > pixels[..., 1].astype(np.int16) + 74)
        & (pixels[..., 2].astype(np.int16) > pixels[..., 1].astype(np.int16) + 74)
        & (np.abs(
            pixels[..., 0].astype(np.int16) - pixels[..., 2].astype(np.int16)
        ) < 58)
    )
    print(
        f"removed={int(removed.sum())} "
        f"visible_neon_magenta={int(remaining.sum())} "
        f"visible_pixels={int((pixels[..., 3] > 0).sum())}"
    )


if __name__ == "__main__":
    main()
