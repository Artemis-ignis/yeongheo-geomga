# Seolryeong reference analysis

Reference: `../seolryeong-imagegen-reference.png`
Role: single full-body character reference for a stylized, animation-ready gameplay model.

## Observation in object space

- The target is one humanoid character in a near-frontal three-quarter stance, with a bilateral body plan and an asymmetric sword assembly held along one side.
- The macro envelope is a head-and-torso volume over a layered garment shell that widens toward the hem. Separate upper-limb sleeve volumes extend laterally and terminate in open cuffs. The lower silhouette ends in two boot volumes.
- The head has a rounded cranial volume, a controlled facial shell on the camera-facing side, a tied hair mass, and several long hair locks that fall behind the shoulder line.
- The costume hierarchy is: body → chest/waist → under-robe and overlapping robe panels → sleeves and cuffs → boots; the sword and hair ornament are attached sub-assemblies rather than painted marks.
- The sword is a thin extruded/lofted blade with a distinguishable guard and grip. The image shows the blade silhouette and front bevel; the hidden back edge and full scabbard construction remain inferred.

## Materials and surface response

- Robe: ivory satin/silk dielectric, medium-high roughness with localized sheen, pale frost-blue embroidered linework, and visible layered seams. The weave belongs in albedo/normal/roughness channels rather than a single flat color.
- Trim and ornament: brushed silver with a low-roughness edge catch and restrained metalness. The jade inset is a small cool-green accent, not a full emissive surface.
- Skin: warm dielectric with soft roughness variation and a cool rim, not a uniform Lambertian sphere.
- Hair: dark blue-black satin with broad streak highlights and a higher roughness than metal.
- Blade: translucent-looking ice-metal approximation with a sharp bevel, cool cyan edge response, and restrained emissive intensity so the blade remains legible without bloom washout.

## Identity features mapped into the spec

The generated `ObjectSculptSpec` maps the collar, sash, robe panels, open sleeves, silver shoulder guards, crown ornament, hair locks, ice blade bevel/guard, and boot engraving to named components or material local overrides. The detail inventory has 12 entries and the strict gate confirms every entry is linked.

## Uncertainty

This is a single generated view. The back of the hair, rear robe seams, underside of the sleeves, and the full scabbard are inferred. This is a stylized game reconstruction, not a claim of exact hidden-side likeness. The runtime model should be accepted only after the fixed three-quarter shot plus left/right orbit and grazing-light review.
