from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: compare_image_pixels.py EXPECTED ACTUAL")

    expected_path = Path(sys.argv[1])
    actual_path = Path(sys.argv[2])
    expected = np.asarray(Image.open(expected_path).convert("RGBA"))
    actual = np.asarray(Image.open(actual_path).convert("RGBA"))
    same_shape = expected.shape == actual.shape
    if same_shape:
        difference = np.abs(expected.astype(np.int16) - actual.astype(np.int16))
        mismatch_pixels = int(np.count_nonzero(np.any(difference != 0, axis=2)))
        max_channel_delta = int(difference.max(initial=0))
        actual_pixel_sha = hashlib.sha256(actual.tobytes()).hexdigest()
    else:
        mismatch_pixels = None
        max_channel_delta = None
        actual_pixel_sha = hashlib.sha256(actual.tobytes()).hexdigest()

    result = {
        "expected": str(expected_path),
        "actual": str(actual_path),
        "expectedFileSha256": file_sha256(expected_path),
        "actualFileSha256": file_sha256(actual_path),
        "expectedPixelSha256Rgba": hashlib.sha256(expected.tobytes()).hexdigest(),
        "actualPixelSha256Rgba": actual_pixel_sha,
        "expectedShape": list(expected.shape),
        "actualShape": list(actual.shape),
        "fileExact": file_sha256(expected_path) == file_sha256(actual_path),
        "pixelExact": same_shape and mismatch_pixels == 0,
        "mismatchPixels": mismatch_pixels,
        "maxChannelDelta": max_channel_delta,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
