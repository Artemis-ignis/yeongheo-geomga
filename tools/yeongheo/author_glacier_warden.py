"""Author the ImageGen/img2threejs Glacier Warden asset brief.

The upstream Forge character scaffold is deliberately generic.  This script
records the subject-specific armor, ice, cloak, and glaive observations before
strict validation or factory generation.  It is an authoring step, not a
quality-gate bypass.
"""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SPEC = ROOT / "artifacts/img2threejs/glacier-warden-v1/object-sculpt-spec.json"
EVIDENCE_ROOT = "artifacts/img2threejs/glacier-warden-v1"
MAP_ROOT = "pbr-evidence"


STYLES = {
    "ice": ("#B9EDFF", "#4D83B8", "glass", 0.92),
    "metal": ("#1B2A3D", "#7C9BB8", "metal", 0.90),
    "cloth": ("#24344D", "#6D87A3", "fabric", 0.82),
    "under": ("#0D1421", "#384B64", "fabric", 0.72),
    "boot": ("#162236", "#5B718B", "metal", 0.84),
    "eye": ("#47E8FF", "#D7FBFF", "glass", 0.96),
    "utility": ("#111A2A", "#34455E", "unknown", 0.36),
}

MATERIAL_FAMILY = {
    "base": "metal",
    "hidden": "utility",
    "skin": "under",
    "hair": "ice",
    "shirt": "cloth",
    "pants": "cloth",
    "shoes": "boot",
    "eye": "eye",
    "lips": "under",
}

ARMOR_COMPONENTS = {
    "root", "pelvis", "abdomen", "chest", "neck", "head",
    "clavicle-l", "clavicle-r", "upper-arm-l", "upper-arm-r",
    "forearm-l", "forearm-r", "hand-l", "hand-r", "thigh-l",
    "thigh-r", "shin-l", "shin-r",
}

DETAIL_COMPONENTS = {
    "ice-crown": "head",
    "mask-eye-slits": "head",
    "crystal-shoulder-l": "clavicle-l",
    "crystal-shoulder-r": "clavicle-r",
    "chest-frost-lattice": "chest",
    "waist-frost-buckle": "pelvis",
    "split-ice-cloak": "pelvis",
    "gauntlet-runes": "forearm-r",
    "boot-facet-edges": "shin-r",
    "glaive-hook": "hand-r",
    "glaive-core": "hand-r",
    "floating-ice-shards": "chest",
}


def rgba(hex_color: str) -> str:
    value = hex_color.removeprefix("#")
    red, green, blue = (int(value[index:index + 2], 16) for index in (0, 2, 4))
    return f"rgba({red}, {green}, {blue}, 1.0)"


def family_for(material_id: str) -> str:
    return MATERIAL_FAMILY.get(material_id, "utility")


def recipe(material_id: str, evidence: str) -> dict[str, Any]:
    family = family_for(material_id)
    dominant, secondary, material_class, confidence = STYLES[family]
    return {
        "dominantAlbedo": rgba(dominant),
        "secondaryAlbedo": rgba(secondary),
        "materialClass": material_class,
        "materialClassConfidence": confidence,
        "colorGradient": {
            "type": "linear",
            "stops": [
                {"position": 0.0, "color": rgba(dominant)},
                {"position": 1.0, "color": rgba(secondary)},
            ],
        },
        "evidenceRefs": [evidence],
        "notes": "ImageGen Glacier Warden turnaround palette; verify under neutral and grazing light.",
    }


def material_for(component_id: str, original: str) -> str:
    if component_id in ARMOR_COMPONENTS:
        return "base"
    if component_id.startswith("eye-") and "cavity" not in component_id:
        return "eye"
    if component_id in {"hair", "brow-l", "brow-r"}:
        return "hair"
    if component_id.startswith(("foot-", "shin-")):
        return "shoes"
    if component_id in {"ear-l", "ear-r", "nose", "mouth"}:
        return "skin"
    return original if original in MATERIAL_FAMILY else "base"


def detail(detail_id: str, kind: str, component_id: str, description: str, refs: list[str]) -> dict[str, Any]:
    return {
        "id": detail_id,
        "kind": kind,
        "componentId": component_id,
        "mapsTo": {"ref": detail_id},
        "description": description,
        "evidenceRefs": refs,
        "status": "observed-from-turnaround",
    }


def build_passes(component_ids: list[str]) -> list[dict[str, Any]]:
    return [
        {
            "id": "blockout",
            "goal": "Lock the tall masked sentinel silhouette, weapon negative space, and four-view proportions.",
            "componentRefs": component_ids,
            "acceptance": ["The ice crown, broad shoulders, split cloak, boots, and crescent glaive read in front and side views."],
        },
        {
            "id": "structural-pass",
            "goal": "Build the armored humanoid hierarchy, ice shoulder sockets, cloak panels, and glaive attachment before surface dressing.",
            "componentRefs": component_ids,
            "acceptance": ["Crystal plates have parent sockets, controlled gaps, and no body intersections during the near-detail idle pose."],
        },
        {
            "id": "form-refinement",
            "goal": "Refine the pointed crown, faceted armor, layered waist, articulated gauntlets, and hooked weapon silhouette.",
            "componentRefs": component_ids,
            "acceptance": ["Three-quarter and back views preserve the asymmetric mantle and the long split cloak negative space."],
        },
        {
            "id": "material-pass",
            "goal": "Separate frost glass, blue metal, woven cloak, dark under-armor, boots, and cyan emissive eyes by material recipe.",
            "componentRefs": component_ids,
            "acceptance": ["Canonical Forge pixel evidence is shared explicitly; material-specific response is authored without duplicated false masks."],
        },
        {
            "id": "surface-pass",
            "goal": "Add ice fracture lines, edge chips, chest lattice, gauntlet runes, cloak facets, and glaive core emission.",
            "componentRefs": component_ids,
            "acceptance": ["Identity details survive gameplay distance and remain below the near-detail geometry budget."],
        },
        {
            "id": "lighting-pass",
            "goal": "Match the neutral navy studio reference with a readable cool key, cyan fill, silver rim, and controlled emission.",
            "componentRefs": component_ids,
            "acceptance": ["Mask, ice shoulders, blue metal, cloak folds, eyes, and glaive edge remain distinct under combat lighting."],
        },
        {
            "id": "interaction-pass",
            "goal": "Preserve humanoid motion, glaive socket, hit reaction, and despawn hooks.",
            "componentRefs": component_ids,
            "acceptance": ["Idle, advance, hit flash, and despawn keep the weapon and crystal attachments aligned."],
        },
        {
            "id": "optimization-pass",
            "goal": "Keep the elite near-detail model bounded while the outer crowd stays instanced.",
            "componentRefs": component_ids,
            "acceptance": ["No per-frame allocation; near-detail slot is bounded; repeated ice pieces share geometry and material."],
        },
    ]


def author(spec: dict[str, Any]) -> dict[str, Any]:
    spec = copy.deepcopy(spec)
    turnaround = f"{EVIDENCE_ROOT}/turnaround"
    views = [
        {"id": "front-three-quarter", "label": "Front three-quarter", "sourceImage": f"{turnaround}/three-quarter.png", "confidence": 0.90, "imageRegion": {"x": 0, "y": 0, "width": 1, "height": 1}},
        {"id": "front", "label": "Front", "sourceImage": f"{turnaround}/front.png", "confidence": 0.90, "imageRegion": {"x": 0, "y": 0, "width": 1, "height": 1}},
        {"id": "side", "label": "Side", "sourceImage": f"{turnaround}/side.png", "confidence": 0.86, "imageRegion": {"x": 0, "y": 0, "width": 1, "height": 1}},
        {"id": "back", "label": "Back", "sourceImage": f"{turnaround}/back.png", "confidence": 0.84, "imageRegion": {"x": 0, "y": 0, "width": 1, "height": 1}},
    ]
    evidence_ids = [item["id"] for item in views]

    details = [
        detail("ice-crown", "contour", "head", "Tall clustered ice crown turns the helmet into a distinct elite silhouette.", ["front", "side"]),
        detail("mask-eye-slits", "linework", "head", "Narrow cyan eye slits sit inside a dark faceted mask.", ["front-three-quarter", "front"]),
        detail("crystal-shoulder-l", "ridge", "clavicle-l", "Large translucent shoulder shards overlap in stepped rows.", ["front-three-quarter", "back"]),
        detail("crystal-shoulder-r", "ridge", "clavicle-r", "Asymmetric shoulder ice creates a readable broken contour.", ["front-three-quarter", "side"]),
        detail("chest-frost-lattice", "ridge", "chest", "Raised silver-blue lattice sits over the dark chest under-armor.", ["front", "front-three-quarter"]),
        detail("waist-frost-buckle", "fastener", "pelvis", "Angular frost buckle anchors the layered waist plates.", ["front", "side"]),
        detail("split-ice-cloak", "contour", "pelvis", "Long split cloak panels create separate back and leg negative spaces.", ["back", "side"]),
        detail("gauntlet-runes", "linework", "forearm-r", "Small cyan rune cuts track along the right gauntlet.", ["front-three-quarter", "side"]),
        detail("boot-facet-edges", "bevel", "shin-r", "Faceted boot edges catch a narrow silver rim.", ["front", "side"]),
        detail("glaive-hook", "contour", "hand-r", "The crescent glaive is a separate hooked combat prop with a clear socket.", ["front", "side"]),
        detail("glaive-core", "emissive", "hand-r", "Cyan core crystals repeat at the weapon guard and blade tip.", ["front-three-quarter", "side"]),
        detail("floating-ice-shards", "chip", "chest", "Sparse floating ice fragments reinforce the elite frost identity without clutter.", ["front-three-quarter", "back"]),
    ]

    assessment = spec.setdefault("preSpecAssessment", {})
    assessment["objectClass"] = {
        "primaryType": "masked humanoid ice-armored elite warden",
        "primaryDomain": "character",
        "formLanguage": ["faceted frost armor", "layered split cloak", "asymmetric crystalline mantle", "crescent glaive silhouette"],
        "structureKind": ["socketed humanoid armor", "repeated crystal plates", "separate cloak panels", "detachable glaive prop", "emissive eye and weapon cores"],
        "motionPotential": ["humanoid advance", "glaive sweep", "cloak sway", "shoulder crystal recoil", "ice-shard despawn"],
        "materialFamilies": ["translucent frost glass", "blue steel", "dark woven cloth", "matte under-armor", "cyan emission"],
        "notes": "Authored from the ImageGen v1 four-view turnaround; hidden joints remain bounded gameplay assumptions.",
    }
    assessment["complexity"] = {
        "tier": "complex",
        "scores": {"silhouetteComplexity": 3, "componentCount": 3, "hierarchyDepth": 3, "repetitionDensity": 3, "materialComplexity": 3, "surfaceDetail": 3, "animationComplexity": 2},
        "estimatedCounts": {"macroComponents": 18, "mesoComponents": 12, "microFeatureGroups": 7, "materialLayers": 5, "repetitionSystems": 3},
        "reasoning": ["The four-view reference shows a humanoid armor hierarchy with a separate glaive, cloak panels, and repeated crystal plates.", "The runtime target is a bounded near-detail slot, so surface identity is concentrated in a small number of authored focal features."],
        "targetMinDetails": 12,
        "notes": "Elite close-range character with hard-surface, crystal, cloth, and weapon families.",
    }
    assessment["anatomy"] = {
        "applies": True,
        "styleHeads": 8.0,
        "proportions": {"headUnit": 1.0, "torso": 2.8, "legs": 3.8, "shoulderWidth": 2.6, "hipWidth": 1.55},
        "pose": {"type": "combat-ready neutral A-pose", "jointAngles": {"shoulderAbduction": 10, "elbowFlexion": 8, "hipAbduction": 4, "kneeFlexion": 3}},
        "faceLandmarks": {"eyeLine": 0.48, "eyeSpacing": 0.30, "noseBase": 0.58, "mouthLine": 0.70, "hairline": 0.10},
        "features": ["fully masked face", "ice crown", "high collar", "long armored forearms", "faceted boots"],
        "confidence": 0.80,
        "note": "Masked reference prioritizes armor silhouette and gameplay readability over exposed facial likeness.",
    }
    assessment["detailInventory"] = {"targetMinDetails": 12, "microFeatureGroups": 7, "details": details}

    spec["sourceImage"] = f"{turnaround}/front.png"
    spec["viewEvidence"] = views
    spec["referenceCamera"] = {"solved": False, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "Orthographic-like studio reference; solve review camera before final likeness lock."}

    detail_by_id = {item["id"]: item for item in details}
    components = spec.get("componentTree", [])
    component_ids = []
    for component in components:
        if not isinstance(component, dict):
            continue
        component_id = str(component.get("id") or "")
        if not component_id:
            continue
        component_ids.append(component_id)
        material_id = material_for(component_id, str(component.get("material") or "base"))
        component["material"] = material_id
        component["materialLayers"] = [material_id]
        component["fidelityTier"] = "structural-pass" if component.get("level") == "macro" else "form-refinement"
        component["confidence"] = max(float(component.get("confidence") or 0.0), 0.76)
        component["evidenceRefs"] = evidence_ids[:2] if component.get("level") == "macro" else ["front-three-quarter", "side"]
        component["colorMaterialRecipe"] = recipe(material_id, component["evidenceRefs"][0])
        generated_ids = set(DETAIL_COMPONENTS) | {f"{component_id}-surface-breakup"}
        features = [feature for feature in list(component.get("localFeatures") or []) if isinstance(feature, dict) and feature.get("id") not in generated_ids and not str(feature.get("id") or "").endswith("-surface-breakup")]
        if component_id in {"head", "chest", "clavicle-l", "clavicle-r", "forearm-r", "pelvis", "shin-r", "hand-r"}:
            features.append({"id": f"{component_id}-surface-breakup", "kind": "faceted-relief", "description": "Ice Warden panel breakup derived from the ImageGen turnaround.", "evidenceRefs": ["front-three-quarter", "front"], "realization": "geometry-plus-material-response"})
        component["localFeatures"] = features
        component["surfaceDetail"] = {
            "macroRoughness": 0.32 if material_id in {"base", "hair", "eye"} else 0.56,
            "microRoughness": 0.12 if material_id in {"base", "hair", "eye"} else 0.20,
            "bumpAmplitude": 0.040 if material_id == "base" else 0.020,
            "normalPattern": "canonical Forge evidence plus authored frost fractures",
            "displacementPattern": "micro bevel only; no runtime displacement",
            "occlusionPattern": "contact darkening beneath overlapping ice plates and cloak sockets",
            "edgeWearPattern": "pale chipped edges on exposed crystal rims",
            "notes": "Near-detail only; outer crowd remains instanced proxy geometry.",
        }

    component_by_id = {item.get("id"): item for item in components if isinstance(item, dict)}
    for detail_id, component_id in DETAIL_COMPONENTS.items():
        component = component_by_id.get(component_id)
        if component is None:
            continue
        observed = detail_by_id[detail_id]
        component.setdefault("localFeatures", []).append({"id": detail_id, "kind": observed["kind"], "description": observed["description"], "evidenceRefs": observed["evidenceRefs"], "realization": "geometry-plus-material-response"})

    material_styles = {
        "base": {"baseColor": "#1B2A3D", "secondary": ["#7C9BB8", "#B9EDFF"], "roughness": {"base": 0.34, "variation": 0.18}, "metalness": {"base": 0.74, "variation": 0.12}},
        "hidden": {"baseColor": "#111A2A", "secondary": ["#34455E"], "roughness": {"base": 0.92, "variation": 0.05}, "metalness": {"base": 0.02, "variation": 0.02}},
        "skin": {"baseColor": "#0D1421", "secondary": ["#384B64"], "roughness": {"base": 0.72, "variation": 0.12}, "metalness": {"base": 0.04, "variation": 0.02}},
        "hair": {"baseColor": "#B9EDFF", "secondary": ["#4D83B8", "#E9FBFF"], "roughness": {"base": 0.26, "variation": 0.18}, "metalness": {"base": 0.20, "variation": 0.08}},
        "shirt": {"baseColor": "#24344D", "secondary": ["#6D87A3", "#101A2B"], "roughness": {"base": 0.76, "variation": 0.12}, "metalness": {"base": 0.04, "variation": 0.02}},
        "pants": {"baseColor": "#24344D", "secondary": ["#6D87A3", "#101A2B"], "roughness": {"base": 0.78, "variation": 0.10}, "metalness": {"base": 0.03, "variation": 0.02}},
        "shoes": {"baseColor": "#162236", "secondary": ["#5B718B", "#0E1522"], "roughness": {"base": 0.48, "variation": 0.16}, "metalness": {"base": 0.48, "variation": 0.12}},
        "eye": {"baseColor": "#47E8FF", "secondary": ["#D7FBFF", "#0B718A"], "roughness": {"base": 0.16, "variation": 0.08}, "metalness": {"base": 0.04, "variation": 0.02}},
        "lips": {"baseColor": "#0D1421", "secondary": ["#384B64"], "roughness": {"base": 0.72, "variation": 0.10}, "metalness": {"base": 0.02, "variation": 0.02}},
    }
    for material in spec.get("materials", []):
        if not isinstance(material, dict):
            continue
        material_id = str(material.get("id") or "")
        style = material_styles.get(material_id, material_styles["hidden"])
        material["baseColor"] = style["baseColor"]
        material["color"] = style["baseColor"]
        material["albedo"] = {"dominant": style["baseColor"], "secondary": style["secondary"], "samplingNotes": "ImageGen Glacier Warden palette; not a baked final texture."}
        material["colorVariation"] = {"palette": [style["baseColor"], *style["secondary"]], "pattern": "ice-edge and blue-steel value breakup", "amplitude": 0.20, "heightCorrelation": 0.42}
        material["roughness"] = {**style["roughness"], "map": f"{MAP_ROOT}/base_roughness.png", "localResponse": "canonical full-object Forge evidence; semantic material mask explicitly pending"}
        material["metalness"] = style["metalness"]
        material["normal"] = {"pattern": "canonical reference-derived height-gradient normal", "strength": 0.25 if material_id in {"base", "hair", "eye"} else 0.16, "map": f"{MAP_ROOT}/base_normal.png", "heightSource": f"{MAP_ROOT}/base_height.png", "space": "tangent"}
        material["bump"] = {"pattern": "canonical reference-derived height field", "amplitude": 0.032, "map": f"{MAP_ROOT}/base_height.png"}
        material["ambientOcclusion"] = {"cavityStrength": 0.42, "contactShadowBias": 0.30, "map": f"{MAP_ROOT}/base_ao.png", "notes": "Canonical Forge cavity evidence shared by material recipes."}
        material["surfaceFrequencyBands"] = [{"id": "macro", "frequency": 2.0, "amplitude": 0.32, "role": "large armor and cloak value breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.20, "role": "facets, seams, frost plates, and weapon grooves"}, {"id": "micro", "frequency": 60.0, "amplitude": 0.06, "role": "grazing-light ice highlight breakup"}]
        material["localOverrides"] = [{"id": "frost-edge-and-cavity", "type": "material-map-evidence", "evidenceRefs": ["front-three-quarter", "front"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Official img2threejs Forge evidence with authored material-local frost response; semantic masks remain explicitly pending."}]
        material["referencePbr"] = {
            **(material.get("referencePbr") if isinstance(material.get("referencePbr"), dict) else {}),
            "materialId": material_id,
            "usable": True,
            "verdict": "pass-shared-reference-evidence",
            "confidence": 0.72,
            "estimatedFidelity": 0.72,
            "targetThreshold": 0.70,
            "sourceImage": f"{turnaround}/front.png",
            "method": "canonical full-object Forge pixel evidence shared by material recipes; not a semantic material mask",
            "sharedEvidenceMaterial": "base" if material_id != "base" else None,
            "maps": {channel: {"url": f"{MAP_ROOT}/base_{channel}.png", "channel": channel, "source": "reference-pixel-extraction"} for channel in ("albedo", "roughness", "height", "normal", "ao")},
            "warnings": ["semantic material masks remain pending; material color/roughness response is authored per family"],
        }
        if material_id != "base":
            material["sharedReferenceEvidence"] = {"sourceMaterial": "base", "semanticMaskStatus": "pending", "reason": "A single turnaround crop cannot prove per-material masks; do not duplicate the same map set."}
        material["qualityTier"] = "utility" if material_id in {"hidden", "lips"} else "hero"
        material["notes"] = "ImageGen/img2threejs evidence-backed recipe with canonical shared maps. Final material lock requires semantic masks, neutral/grazing browser renders, and real mesh review."

    spec["repetitionSystems"] = [
        {"id": "crystalline-shoulder-clusters", "name": "Stepped crystalline shoulder plates", "component": "clavicle-l", "geometry": {"primitive": "faceted-shard", "width": 0.14, "height": 0.32, "depth": 0.08, "bevelRadius": 0.012}, "instances": {"count": 18, "layout": "asymmetric-overlap", "seed": 260807}, "material": "hair", "buildsGeometry": True, "realization": "instanced-near-detail-only", "evidenceRefs": ["front-three-quarter", "back"]},
        {"id": "split-cloak-panels", "name": "Layered split ice-cloak panels", "component": "pelvis", "geometry": {"primitive": "tapered-panel", "rowSpacing": 0.08, "panelWidth": 0.22, "panelHeight": 0.72, "depth": 0.03, "bevelRadius": 0.016}, "instances": {"count": 12, "layout": "fan-and-split", "seed": 260808}, "material": "shirt", "buildsGeometry": True, "realization": "instanced-near-detail-only", "evidenceRefs": ["back", "side"]},
        {"id": "glaive-frost-runes", "name": "Crescent glaive frost runes", "component": "hand-r", "geometry": {"primitive": "low-profile-gem", "radius": 0.035, "depth": 0.012}, "instances": {"count": 9, "layout": "blade-spine", "seed": 260809}, "material": "eye", "buildsGeometry": True, "realization": "instanced-near-detail-only", "evidenceRefs": ["front-three-quarter", "side"]},
    ]
    spec["buildPasses"] = build_passes(component_ids)
    spec.setdefault("sculptPipeline", {})["passOrder"] = [item["id"] for item in spec["buildPasses"]]
    spec.setdefault("qualityContract", {})["qualityBar"] = "complex"
    spec["qualityContract"]["minimumSpecDepth"] = {"macroComponents": 3, "mesoComponents": 8, "microFeatureGroups": 7, "materialLayers": 3, "repetitionSystems": 2, "reviewViewpoints": 4}
    spec["qualityContract"]["definitionOfDone"] = [
        "The near-detail model preserves the ImageGen turnaround silhouette, crystalline shoulders, split cloak, masked face, and crescent glaive negative space.",
        "Every production material has a named recipe and explicitly labeled canonical/shared PBR evidence; no duplicate semantic masks are claimed.",
        "Strict img2threejs validation passes before code generation; runtime integration remains gated on visual comparison and performance evidence.",
    ]
    spec["lightingFromPhoto"] = [
        {"role": "key", "direction": [-0.35, 0.72, 0.58], "color": "#D7F1FF", "intensity": 1.9, "notes": "Cool broad key revealing ice bevels and dark mask planes."},
        {"role": "fill", "direction": [0.45, 0.2, 0.8], "color": "#37C7E8", "intensity": 0.62, "notes": "Cyan fill from eyes, shoulder crystals, and glaive core."},
        {"role": "rim", "direction": [0.1, 0.55, -0.9], "color": "#A6D8FF", "intensity": 1.35, "notes": "Silver rim on crown, cloak edges, boots, and weapon hook."},
        {"role": "ambient", "color": "#0A1220", "intensity": 0.40, "notes": "Deep navy environment with contact shadow and ambient occlusion under plate overlaps, boots, cloak, and weapon socket."},
        {"role": "exposure", "value": 1.05, "toneMapping": "ACES Filmic", "notes": "Keep dark steel readable without flattening the frost highlights."},
    ]
    spec["performanceBudget"] = {"targetFps": 60, "nearDetail": {"maxTriangles": 26000, "maxDrawCalls": 20, "maxTextureMemoryMB": 12}, "crowdProxy": {"maxInstances": 64, "instanced": True, "maxTrianglesPerInstance": 72}, "notes": "Only the bounded near-detail slot receives layered ice geometry; outer glacier enemies remain instanced proxies."}
    spec["proceduralStrategy"] = ["hybrid-authored-near-detail", "ImageGen v1 four-view turnaround + official img2threejs Forge spec/codegen", "canonical shared Forge PBR evidence with material-local response", "TRELLIS promotion requires external quota, four-view review, animation/socket review, and browser performance regression"]
    return spec


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default=str(DEFAULT_SPEC))
    parser.add_argument("--out", default=None)
    args = parser.parse_args()
    source = Path(args.spec)
    target = Path(args.out) if args.out else source
    authored = author(json.loads(source.read_text(encoding="utf-8")))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(authored, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "AUTHORED", "spec": str(target), "components": len(authored.get("componentTree", [])), "details": len(authored.get("preSpecAssessment", {}).get("detailInventory", {}).get("details", []))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
