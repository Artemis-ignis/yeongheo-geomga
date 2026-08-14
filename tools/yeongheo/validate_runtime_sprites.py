#!/usr/bin/env python3
"""Audit Yeongheo 2.5D runtime raster assets without visual approval.

Dependencies: Pillow and NumPy. Example with uv:
  uv run --with pillow --with numpy tools/yeongheo/validate_runtime_sprites.py --pretty

The command emits a JSON document to stdout. It deliberately keeps
``productionReady`` false: automated pixel checks cannot approve anatomy,
direction, motion semantics, or the final in-game presentation.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, UnidentifiedImageError


ALPHA_VISIBLE = 20
ALPHA_CLEAR = 8
GRID_TOKENS = ("motion", "props")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("public/assets/sprites2d"))
    parser.add_argument("--asset-manifest", type=Path, default=Path("tools/asset-manifest.json"))
    parser.add_argument("--pretty", action="store_true", help="indent JSON output")
    parser.add_argument(
        "--fail-on",
        choices=("never", "p0", "p1"),
        default="never",
        help="optional CI exit gate (p1 means P0 or P1)",
    )
    return parser.parse_args()


def issue(severity: str, code: str, message: str, **evidence: Any) -> dict[str, Any]:
    result: dict[str, Any] = {"severity": severity, "code": code, "message": message}
    if evidence:
        result["evidence"] = evidence
    return result


def load_manifest(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        str(Path(entry["path"]).as_posix()): entry
        for entry in payload.get("assets", [])
        if isinstance(entry, dict) and entry.get("path")
    }


def infer_grid(path: Path, width: int, height: int) -> tuple[int, int]:
    name = path.name.lower()
    if any(token in name for token in GRID_TOKENS) and width >= 4 and height >= 2:
        return (4, 2)
    return (1, 1)


def bbox_for(mask: np.ndarray) -> list[int] | None:
    ys, xs = np.where(mask)
    if xs.size == 0:
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def edge_count(mask: np.ndarray, band: int = 1) -> int:
    if mask.size == 0:
        return 0
    band = max(1, min(band, mask.shape[0], mask.shape[1]))
    edge = np.zeros_like(mask, dtype=bool)
    edge[:band, :] = True
    edge[-band:, :] = True
    edge[:, :band] = True
    edge[:, -band:] = True
    return int(np.count_nonzero(mask & edge))


def alpha_boundary(alpha: np.ndarray, radius: int = 2) -> np.ndarray:
    """Return visible pixels within ``radius`` of transparent pixels."""
    clear = alpha <= ALPHA_CLEAR
    near_clear = np.zeros_like(clear, dtype=bool)
    height, width = clear.shape
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx == 0 and dy == 0:
                continue
            y0, y1 = max(0, dy), min(height, height + dy)
            x0, x1 = max(0, dx), min(width, width + dx)
            sy0, sy1 = max(0, -dy), min(height, height - dy)
            sx0, sx1 = max(0, -dx), min(width, width - dx)
            near_clear[y0:y1, x0:x1] |= clear[sy0:sy1, sx0:sx1]
    return (alpha > ALPHA_VISIBLE) & near_clear


def frame_feature(rgba: np.ndarray, bbox: list[int] | None) -> np.ndarray | None:
    if bbox is None:
        return None
    x0, y0, x1, y1 = bbox
    crop = rgba[y0:y1, x0:x1]
    if crop.size == 0:
        return None
    sample = np.asarray(
        Image.fromarray(crop, "RGBA").resize((40, 40), Image.Resampling.LANCZOS),
        dtype=np.float32,
    )
    alpha = sample[..., 3:4] / 255.0
    premultiplied = sample[..., :3] * alpha
    return np.concatenate((premultiplied, sample[..., 3:4]), axis=2)


def frame_similarity(left: np.ndarray, right: np.ndarray) -> float:
    return float(1.0 - np.mean(np.abs(left - right)) / 255.0)


def inspect_cells(
    rgba: np.ndarray,
    cols: int,
    rows: int,
    runtime: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    height, width = rgba.shape[:2]
    cells: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []
    features: list[np.ndarray | None] = []
    if width % cols or height % rows:
        findings.append(issue(
            "P0" if runtime else "P2",
            "atlas_grid_misaligned",
            "PNG dimensions are not divisible by the inferred atlas grid.",
            width=width,
            height=height,
            columns=cols,
            rows=rows,
        ))
    cell_width = width // cols
    cell_height = height // rows
    for row in range(rows):
        for col in range(cols):
            index = row * cols + col
            cell = rgba[
                row * cell_height:(row + 1) * cell_height,
                col * cell_width:(col + 1) * cell_width,
            ]
            visible = cell[..., 3] > ALPHA_VISIBLE
            bbox = bbox_for(visible)
            border = edge_count(visible, 1)
            guard = edge_count(visible, 3)
            visible_count = int(np.count_nonzero(visible))
            aspect = None
            margins = None
            if bbox:
                x0, y0, x1, y1 = bbox
                bbox_width = x1 - x0
                bbox_height = y1 - y0
                aspect = round(bbox_height / max(1, bbox_width), 4)
                margins = {"left": x0, "top": y0, "right": cell_width - x1, "bottom": cell_height - y1}
            cells.append({
                "index": index,
                "bbox": bbox,
                "bboxHeightToWidth": aspect,
                "visiblePixels": visible_count,
                "borderContactPixels": border,
                "guardBandContactPixels": guard,
                "margins": margins,
            })
            features.append(frame_feature(cell, bbox))
            if runtime and visible_count == 0:
                findings.append(issue("P0", "empty_runtime_cell", "Runtime atlas cell is empty.", cell=index))
            if runtime and border:
                findings.append(issue(
                    "P1",
                    "cell_content_clipped",
                    "Visible content touches a cell edge and may be clipped or bleed into an adjacent frame.",
                    cell=index,
                    borderContactPixels=border,
                ))
            elif runtime and guard:
                findings.append(issue(
                    "P2",
                    "cell_guard_too_small",
                    "Visible content enters the three-pixel cell guard band.",
                    cell=index,
                    guardBandContactPixels=guard,
                ))

    duplicate_pairs: list[dict[str, Any]] = []
    if len(features) > 1:
        for left_index in range(len(features)):
            left = features[left_index]
            if left is None:
                continue
            for right_index in range(left_index + 1, len(features)):
                right = features[right_index]
                if right is None:
                    continue
                similarity = frame_similarity(left, right)
                if similarity < 0.985:
                    continue
                duplicate_pairs.append({
                    "left": left_index,
                    "right": right_index,
                    "similarity": round(similarity, 6),
                    "classification": "probable-copy" if similarity >= 0.995 else "near-duplicate",
                })
                findings.append(issue(
                    "P1" if similarity >= 0.995 and runtime else "P2",
                    "probable_duplicate_frames" if similarity >= 0.995 else "near_duplicate_frames",
                    "Frames are visually indistinguishable enough to require motion review.",
                    left=left_index,
                    right=right_index,
                    similarity=round(similarity, 6),
                ))
    return cells, duplicate_pairs, findings


def inspect_raster(path: Path, root: Path, manifest: dict[str, dict[str, Any]]) -> dict[str, Any]:
    repo_path = path.as_posix()
    entry = manifest.get(repo_path, {})
    allow_green_edge = bool(entry.get("qa", {}).get("allowGreenEdge", False))
    role = str(entry.get("role", "unmanifested"))
    runtime = role.startswith("runtime-2d-") or (role == "unmanifested" and path.parent.name != "source")
    findings: list[dict[str, Any]] = []
    if role == "unmanifested":
        findings.append(issue(
            "P1" if runtime else "P2",
            "asset_not_in_manifest",
            "PNG is not registered in tools/asset-manifest.json.",
        ))
    try:
        with Image.open(path) as source:
            original_mode = source.mode
            has_alpha_channel = "A" in source.getbands() or "transparency" in source.info
            rgba_image = source.convert("RGBA")
            rgba = np.asarray(rgba_image)
    except (OSError, UnidentifiedImageError) as error:
        return {
            "path": repo_path,
            "role": role,
            "runtime": runtime,
            "issues": [issue("P0", "png_unreadable", "PNG could not be decoded.", error=str(error))],
            "structuralGate": "FAIL",
            "productionReady": False,
        }

    height, width = rgba.shape[:2]
    alpha = rgba[..., 3]
    visible = alpha > ALPHA_VISIBLE
    visible_count = int(np.count_nonzero(visible))
    transparent_count = int(np.count_nonzero(alpha <= ALPHA_CLEAR))
    semitransparent_count = int(np.count_nonzero((alpha > ALPHA_CLEAR) & (alpha < 250)))
    bbox = bbox_for(visible)
    border = edge_count(visible, 1)
    cols, rows = infer_grid(path, width, height)

    if runtime and (not has_alpha_channel or transparent_count == 0):
        findings.append(issue(
            "P0",
            "runtime_missing_transparency",
            "Runtime sprite has no usable transparent background.",
            mode=original_mode,
            transparentPixels=transparent_count,
        ))
    elif not runtime and not has_alpha_channel:
        findings.append(issue(
            "P2",
            "authoring_source_has_no_alpha",
            "Authoring source is opaque; chroma removal must be verified on its runtime derivative.",
            mode=original_mode,
        ))
    if runtime and border:
        findings.append(issue(
            "P1",
            "image_border_contact",
            "Visible runtime pixels touch the outer PNG border.",
            borderContactPixels=border,
        ))

    red = rgba[..., 0].astype(np.int16)
    green = rgba[..., 1].astype(np.int16)
    blue = rgba[..., 2].astype(np.int16)
    green_dominant = (
        visible
        & (green >= 70)
        & ((green - red) >= 32)
        & ((green - blue) >= 18)
    )
    edge_green = green_dominant & alpha_boundary(alpha, 2)
    green_count = int(np.count_nonzero(green_dominant))
    edge_green_count = int(np.count_nonzero(edge_green))
    edge_green_ratio = edge_green_count / max(1, visible_count)
    if runtime and not allow_green_edge and edge_green_count >= 50 and edge_green_ratio >= 0.003:
        findings.append(issue(
            "P1",
            "green_edge_spill",
            "Saturated green pixels cluster on transparent edges; likely chroma-key residue (green artwork still needs visual confirmation).",
            pixels=edge_green_count,
            ratioVisible=round(edge_green_ratio, 6),
        ))
    elif runtime and not allow_green_edge and edge_green_count >= 20 and edge_green_ratio >= 0.0008:
        findings.append(issue(
            "P2",
            "possible_green_edge_spill",
            "Minor saturated-green edge residue requires original-size review.",
            pixels=edge_green_count,
            ratioVisible=round(edge_green_ratio, 6),
        ))

    cells, duplicate_pairs, cell_findings = inspect_cells(rgba, cols, rows, runtime)
    findings.extend(cell_findings)

    aspects = [cell["bboxHeightToWidth"] for cell in cells if cell["bboxHeightToWidth"] is not None]
    median_aspect = float(np.median(aspects)) if aspects else None
    hero = "hero" in role
    if runtime and hero and median_aspect is not None and median_aspect < 1.55:
        findings.append(issue(
            "P2",
            "hero_proportion_review_required",
            "The broad hero silhouette falls below the heuristic ratio; weapons and robes can cause false positives, so original-size anatomy review is mandatory.",
            medianBBoxHeightToWidth=round(median_aspect, 4),
            heuristicMinimum=1.55,
        ))
    elif runtime and median_aspect is not None and median_aspect < 0.65 and "prop" not in role:
        findings.append(issue(
            "P2",
            "extreme_wide_silhouette",
            "Very wide actor silhouette may reduce gameplay readability.",
            medianBBoxHeightToWidth=round(median_aspect, 4),
        ))

    severity_counts = Counter(item["severity"] for item in findings)
    structural_gate = "FAIL" if severity_counts["P0"] or severity_counts["P1"] else "PASS_WITH_REVIEW"
    return {
        "path": repo_path,
        "manifestId": entry.get("id"),
        "role": role,
        "runtime": runtime,
        "dimensions": {"width": width, "height": height, "mode": original_mode},
        "alpha": {
            "hasAlphaChannel": has_alpha_channel,
            "visiblePixels": visible_count,
            "transparentPixels": transparent_count,
            "semitransparentPixels": semitransparent_count,
            "transparentRatio": round(transparent_count / max(1, width * height), 6),
        },
        "opaqueBBox": bbox,
        "borderContactPixels": border,
        "grid": {"columns": cols, "rows": rows, "cellWidth": width // cols, "cellHeight": height // rows},
        "medianBBoxHeightToWidth": None if median_aspect is None else round(median_aspect, 4),
        "green": {
            "dominantVisiblePixels": green_count,
            "edgeSpillPixels": edge_green_count,
            "edgeSpillRatioVisible": round(edge_green_ratio, 6),
            "manualArtworkAllowance": allow_green_edge,
        },
        "cells": cells,
        "duplicatePairs": duplicate_pairs,
        "issues": findings,
        "severityCounts": {level: severity_counts[level] for level in ("P0", "P1", "P2")},
        "structuralGate": structural_gate,
        "visualApproval": "required",
        "productionReady": False,
    }


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    cwd = Path.cwd().resolve()
    try:
        relative_root = root.relative_to(cwd)
    except ValueError:
        relative_root = root
    manifest = load_manifest(args.asset_manifest)
    rasters = sorted(
        [*root.rglob("*.png"), *root.rglob("*.webp")],
        key=lambda item: item.as_posix().lower(),
    ) if root.is_dir() else []
    assets = []
    for raster in rasters:
        try:
            relative = raster.resolve().relative_to(cwd).as_posix()
        except ValueError:
            relative = raster.resolve().as_posix()
        assets.append(inspect_raster(Path(relative), relative_root, manifest))

    issue_counts: Counter[str] = Counter()
    code_counts: Counter[str] = Counter()
    for asset in assets:
        for finding in asset.get("issues", []):
            issue_counts[finding["severity"]] += 1
            code_counts[finding["code"]] += 1
    runtime_assets = [asset for asset in assets if asset.get("runtime")]
    failing_assets = [asset["path"] for asset in runtime_assets if asset.get("structuralGate") == "FAIL"]
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "root": relative_root.as_posix(),
        "assetManifest": args.asset_manifest.as_posix(),
        "thresholds": {
            "alphaVisible": ALPHA_VISIBLE,
            "alphaClear": ALPHA_CLEAR,
            "probableDuplicateSimilarity": 0.995,
            "nearDuplicateSimilarity": 0.985,
            "heroMinBBoxHeightToWidth": 1.55,
        },
        "summary": {
            "rasterCount": len(assets),
            "runtimeRasterCount": len(runtime_assets),
            "unmanifestedRasterCount": sum(1 for asset in assets if asset.get("role") == "unmanifested"),
            "severityCounts": {level: issue_counts[level] for level in ("P0", "P1", "P2")},
            "issueCodeCounts": dict(sorted(code_counts.items())),
            "failingRuntimeAssets": failing_assets,
            "structuralGate": "FAIL" if failing_assets else "PASS_WITH_REVIEW",
            "visualApproval": "required",
            "productionReady": False,
        },
        "assets": assets,
    }
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2 if args.pretty else None)
    sys.stdout.write("\n")
    if args.fail_on == "p0" and issue_counts["P0"]:
        return 2
    if args.fail_on == "p1" and (issue_counts["P0"] or issue_counts["P1"]):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
