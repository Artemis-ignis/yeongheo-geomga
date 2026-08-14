"""Deterministic output policy for generated runtime raster assets."""

from pathlib import Path

from PIL import Image


def save_runtime_image(image: Image.Image, output_path: Path) -> None:
    """Save only supported runtime formats, with exact lossless WebP output."""
    suffix = output_path.suffix.lower()
    if suffix == ".webp":
        image.save(output_path, "WEBP", lossless=True, method=6, exact=True)
        return
    if suffix == ".png":
        image.save(output_path, "PNG", optimize=True)
        return
    raise RuntimeError(f"unsupported runtime image format: {output_path}")
