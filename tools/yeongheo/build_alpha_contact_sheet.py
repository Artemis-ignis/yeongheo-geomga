#!/usr/bin/env python3
"""Render a transparent atlas against black and white for spill inspection."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


def composite(source: Image.Image, color: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    fitted = source.copy()
    fitted.thumbnail(size, Image.Resampling.LANCZOS)
    panel = Image.new("RGBA", size, color)
    x = (size[0] - fitted.width) // 2
    y = (size[1] - fitted.height) // 2
    panel.alpha_composite(fitted, (x, y))
    return panel


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGBA")
    panel_size = (1024, 512)
    header = 54
    sheet = Image.new("RGBA", (panel_size[0] * 2, panel_size[1] + header), (16, 19, 23, 255))
    sheet.alpha_composite(composite(source, (0, 0, 0, 255), panel_size), (0, header))
    sheet.alpha_composite(composite(source, (255, 255, 255, 255), panel_size), (panel_size[0], header))
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 18), "BLACK BACKING - edge halo check", fill=(235, 240, 244, 255))
    draw.text((panel_size[0] + 24, 18), "WHITE BACKING - chroma spill check", fill=(235, 240, 244, 255))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(args.output, quality=94)


if __name__ == "__main__":
    main()
