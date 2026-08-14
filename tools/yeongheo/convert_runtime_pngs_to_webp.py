#!/usr/bin/env python3
"""Convert public runtime PNGs to exact lossless WebP files.

Authoring PNGs deliberately live outside public/assets and are never touched.
The conversion verifies every decoded pixel before the source PNG can be
removed, so an interrupted or lossy conversion cannot silently replace art.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("public/assets"))
    parser.add_argument("--remove-png", action="store_true")
    return parser.parse_args()


def exact_pixels(left: Image.Image, right: Image.Image) -> bool:
    mode = "RGBA" if "A" in left.getbands() else "RGB"
    return ImageChops.difference(left.convert(mode), right.convert(mode)).getbbox() is None


def main() -> None:
    args = parse_args()
    root = args.root.resolve()
    if not root.is_dir() or root.name != "assets" or root.parent.name != "public":
        raise SystemExit(f"refusing non-runtime root: {root}")

    files = sorted(root.rglob("*.png"))
    before = 0
    after = 0
    outputs: list[tuple[Path, Path]] = []
    for source in files:
        target = source.with_suffix(".webp")
        if target.exists():
            raise SystemExit(f"target already exists: {target}")
        with Image.open(source) as opened:
            image = opened.convert("RGBA" if "A" in opened.getbands() else "RGB")
            image.save(target, "WEBP", lossless=True, method=6, exact=True)
            with Image.open(target) as decoded:
                if decoded.size != image.size or not exact_pixels(image, decoded):
                    target.unlink(missing_ok=True)
                    raise SystemExit(f"lossless verification failed: {source}")
        before += source.stat().st_size
        after += target.stat().st_size
        outputs.append((source, target))

    if args.remove_png:
        for source, target in outputs:
            if not target.exists():
                raise SystemExit(f"verified target disappeared: {target}")
            source.unlink()

    saving = 0 if before == 0 else (1 - after / before) * 100
    print(
        f"converted={len(outputs)} before={before} after={after} "
        f"saving={saving:.1f}% removed={args.remove_png}"
    )


if __name__ == "__main__":
    main()
