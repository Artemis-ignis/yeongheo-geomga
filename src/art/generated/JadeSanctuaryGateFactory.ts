import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const [red, green, blue] = hexToRgb(source);
  return new THREE.Color(red / 255, green / 255, blue / 255);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  // The emergency LOD is self-contained; authoring PBR files stay outside the runtime bundle.
  if ((options.qualityPriority ?? 'reference-fidelity') !== 'reference-fidelity') return null;
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Jade Sanctuary Gate
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createJadeSanctuaryGateModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Jade Sanctuary Gate";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": true, "fovDegrees": 40, "aspect": 1, "orientation": {"yaw": 0, "pitch": 0, "roll": 0}, "positionHint": [0, 4.2, 17], "note": "Single-view camera estimate for a centered orthographic-like hero prop; final runtime view is a separate gameplay camera."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["roof"] = createSculptMaterial(
    "roof",
    {"id": "roof", "name": "Glazed roof tile utility layer", "type": "physical", "shaderModel": "MeshPhysicalMaterial / PBR", "qualityTier": "utility", "baseColor": "#172637", "color": "#172637", "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.28, "role": "tile rows"}, {"id": "meso", "frequency": 14, "amplitude": 0.16, "role": "tile ridges"}, {"id": "micro", "frequency": 56, "amplitude": 0.06, "role": "wet glaze breakup"}], "roughness": {"base": 0.46, "variation": 0.12, "map": "independent-procedural-roughness"}, "normal": {"pattern": "tile-ridge-normal", "strength": 0.18}, "ambientOcclusion": {"cavityStrength": 0.3}, "localOverrides": [{"id": "tile-gloss", "region": "front tile edges", "roughness": 0.3}]},
    options
  );
  materialMap["warm-lantern"] = createSculptMaterial(
    "warm-lantern",
    {"id": "warm-lantern", "name": "Warm lantern practical utility layer", "type": "physical", "shaderModel": "MeshBasicMaterial / emissive practical", "qualityTier": "utility", "baseColor": "#FFC66F", "color": "#FFC66F", "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.18, "role": "warm core"}, {"id": "meso", "frequency": 12, "amplitude": 0.12, "role": "frame shadow"}, {"id": "micro", "frequency": 48, "amplitude": 0.04, "role": "glass grain"}], "roughness": {"base": 0.28, "variation": 0.08, "map": "independent-practical-field"}, "normal": {"pattern": "lantern-glass-normal", "strength": 0.08}, "ambientOcclusion": {"cavityStrength": 0.18}, "localOverrides": [{"id": "lantern-emission", "region": "core", "roughness": 0.18}]},
    options
  );
  materialMap["stone"] = createSculptMaterial(
    "stone",
    {"id": "stone", "name": "Wet carved moonstone", "type": "physical", "shaderModel": "MeshPhysicalMaterial / metallic-roughness PBR", "baseColor": "#28313B", "color": "#28313B", "albedo": {"dominant": "#28313B", "secondary": ["#536474", "#101A26"], "samplingNotes": "Dark blue-gray stone with cool edge lift and damp cavity darkening."}, "colorVariation": {"palette": ["#28313B", "#536474", "#101A26"], "pattern": "mottled damp stone", "amplitude": 0.22, "heightCorrelation": 0.35}, "textureResolution": 1024, "textureProjection": {"mode": "procedural", "repeat": [2.5, 3], "anisotropy": 4, "texelDensityIntent": "Keep relief scale stable on pillar and stair dimensions."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.42, "role": "large stone slabs and value breakup"}, {"id": "meso", "frequency": 14, "amplitude": 0.22, "role": "chisel grooves and bevel response"}, {"id": "micro", "frequency": 58, "amplitude": 0.08, "role": "wet highlight breakup"}], "roughness": {"base": 0.68, "variation": 0.16, "map": "independent-procedural-roughness"}, "metalness": {"base": 0.16, "variation": 0.04}, "normal": {"pattern": "independent-procedural-height-field", "strength": 0.22, "scale": 22, "space": "tangent"}, "ambientOcclusion": {"cavityStrength": 0.45, "contactShadowBias": 0.3, "notes": "Darken stair seams, panel recesses, and pillar intersections."}, "wear": {"edgeWear": 0.18, "scratches": ["horizontal chisel marks"], "chips": ["small stair edge chips"]}, "dirt": {"amount": 0.22, "cavityBias": 0.46, "color": "#0A1118"}, "localOverrides": [{"id": "stone-cavity-dirt", "region": "underside seams", "roughness": 0.82, "albedo": "#101A26"}], "referencePbr": {"version": "1", "sourceImage": "artifacts/asset-intake/2026-08-06/jade-sanctuary-gate-reference-v1.png", "extractor": "img2threejs/forge/stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel-derived albedo roughness height normal AO estimate", "verdict": "pass-with-single-view-limitation", "hardLimit": "Not photogrammetry; render review remains required.", "usable": true, "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "maps": {"albedo": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_albedo.png", "channel": "albedo"}, "roughness": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_roughness.png", "channel": "roughness"}, "height": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_height.png", "channel": "height"}, "normal": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_normal.png", "channel": "normal"}, "ao": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_ao.png", "channel": "ao"}}}},
    options
  );
  materialMap["stone-edge"] = createSculptMaterial(
    "stone-edge",
    {"id": "stone-edge", "name": "Moonlit cut stone edge", "type": "physical", "shaderModel": "MeshPhysicalMaterial / metallic-roughness PBR", "baseColor": "#536474", "color": "#536474", "albedo": {"dominant": "#536474", "secondary": ["#28313B", "#8EA9BB"], "samplingNotes": "Cool raised edges catch the key light against dark damp stone."}, "colorVariation": {"palette": ["#536474", "#28313B", "#8EA9BB"], "pattern": "edge-worn strata", "amplitude": 0.18, "heightCorrelation": 0.4}, "textureResolution": 1024, "textureProjection": {"mode": "procedural", "repeat": [2.5, 3], "anisotropy": 4, "texelDensityIntent": "Keep bevel highlights legible without high-frequency noise."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.3, "role": "broad cut-stone value"}, {"id": "meso", "frequency": 13, "amplitude": 0.18, "role": "edge chamfer and grooves"}, {"id": "micro", "frequency": 54, "amplitude": 0.07, "role": "fine highlight breakup"}], "roughness": {"base": 0.54, "variation": 0.14, "map": "independent-procedural-roughness"}, "metalness": {"base": 0.24, "variation": 0.03}, "normal": {"pattern": "independent-procedural-height-field", "strength": 0.2, "scale": 24, "space": "tangent"}, "ambientOcclusion": {"cavityStrength": 0.32, "contactShadowBias": 0.28, "notes": "Keep contact between relief strips and pillar faces visible."}, "wear": {"edgeWear": 0.22, "scratches": ["fine vertical tool marks"], "chips": ["capital corner chips"]}, "dirt": {"amount": 0.16, "cavityBias": 0.32, "color": "#111A23"}, "localOverrides": [{"id": "edge-wear-highlight", "region": "outer bevels", "roughness": 0.4, "albedo": "#8EA9BB"}], "referencePbr": {"version": "1", "sourceImage": "artifacts/asset-intake/2026-08-06/jade-sanctuary-gate-reference-v1.png", "extractor": "img2threejs/forge/stage1_intake/extract_pbr_evidence.py", "method": "shared source pixel evidence with edge-family override", "verdict": "pass-with-single-view-limitation", "hardLimit": "The source image does not identify a physically unique material partition.", "usable": true, "confidence": 0.8, "estimatedFidelity": 0.8, "targetThreshold": 0.7, "maps": {"albedo": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_albedo.png", "channel": "albedo"}, "roughness": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_roughness.png", "channel": "roughness"}, "height": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_height.png", "channel": "height"}, "normal": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_normal.png", "channel": "normal"}, "ao": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_ao.png", "channel": "ao"}}}},
    options
  );
  materialMap["bronze"] = createSculptMaterial(
    "bronze",
    {"id": "bronze", "name": "Aged bronze ornament", "type": "physical", "shaderModel": "MeshPhysicalMaterial / metallic-roughness PBR", "baseColor": "#6A4A2D", "color": "#6A4A2D", "albedo": {"dominant": "#6A4A2D", "secondary": ["#B47C43", "#2D2117"], "samplingNotes": "Warm bronze is constrained to beams, brackets, medallions, rails, and lantern frames."}, "colorVariation": {"palette": ["#6A4A2D", "#B47C43", "#2D2117"], "pattern": "patina and edge wear", "amplitude": 0.25, "heightCorrelation": 0.2}, "textureResolution": 1024, "textureProjection": {"mode": "procedural", "repeat": [2, 2], "anisotropy": 4, "texelDensityIntent": "Keep engraved metal response visible at hero distance."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.28, "role": "patina zones"}, {"id": "meso", "frequency": 16, "amplitude": 0.18, "role": "engraved edge relief"}, {"id": "micro", "frequency": 62, "amplitude": 0.06, "role": "grazing highlight scratches"}], "roughness": {"base": 0.36, "variation": 0.16, "map": "independent-procedural-roughness"}, "metalness": {"base": 0.78, "variation": 0.08}, "clearcoat": {"base": 0.32}, "normal": {"pattern": "independent-height-and-engraving-field", "strength": 0.18, "scale": 28, "space": "tangent"}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.24, "notes": "Darken engraving and beam joints, retain worn edge glints."}, "wear": {"edgeWear": 0.34, "scratches": ["thin radial engraving scratches"], "chips": []}, "dirt": {"amount": 0.18, "cavityBias": 0.42, "color": "#2D2117"}, "localOverrides": [{"id": "bronze-patina-recess", "region": "engraved recesses", "roughness": 0.58, "albedo": "#2D2117"}], "referencePbr": {"version": "1", "sourceImage": "artifacts/asset-intake/2026-08-06/jade-sanctuary-gate-reference-v1.png", "extractor": "img2threejs/forge/stage1_intake/extract_pbr_evidence.py", "method": "source-derived palette and roughness with metal family override", "verdict": "pass-with-single-view-limitation", "hardLimit": "Bronze/stone separation is an authored material classification, not exact inverse rendering.", "usable": true, "confidence": 0.78, "estimatedFidelity": 0.78, "targetThreshold": 0.7, "maps": {"albedo": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_albedo.png", "channel": "albedo"}, "roughness": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_roughness.png", "channel": "roughness"}, "height": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_height.png", "channel": "height"}, "normal": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_normal.png", "channel": "normal"}, "ao": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_ao.png", "channel": "ao"}}}},
    options
  );
  materialMap["jade"] = createSculptMaterial(
    "jade",
    {"id": "jade", "name": "Jade inlay and emissive core", "type": "physical", "shaderModel": "MeshPhysicalMaterial / clearcoat PBR", "baseColor": "#2F9D8E", "color": "#2F9D8E", "albedo": {"dominant": "#2F9D8E", "secondary": ["#B8FFE4", "#195B52"], "samplingNotes": "Jade accents are sparse, placed at the crest, pillar emblems, finials, and stair caps."}, "colorVariation": {"palette": ["#2F9D8E", "#B8FFE4", "#195B52"], "pattern": "translucent jade striation", "amplitude": 0.24, "heightCorrelation": 0.28}, "textureResolution": 1024, "textureProjection": {"mode": "procedural", "repeat": [2, 2], "anisotropy": 4, "texelDensityIntent": "Use small high-contrast accents rather than covering the stone."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2, "amplitude": 0.22, "role": "green value zoning"}, {"id": "meso", "frequency": 11, "amplitude": 0.16, "role": "inlay facets and striations"}, {"id": "micro", "frequency": 50, "amplitude": 0.05, "role": "clearcoat highlight breakup"}], "roughness": {"base": 0.25, "variation": 0.12, "map": "independent-procedural-roughness"}, "metalness": {"base": 0.18, "variation": 0.04}, "clearcoat": {"base": 0.48}, "normal": {"pattern": "faceted-inlay-normal-field", "strength": 0.16, "scale": 22, "space": "tangent"}, "ambientOcclusion": {"cavityStrength": 0.28, "contactShadowBias": 0.22, "notes": "Preserve the dark seam around each inset jewel."}, "wear": {"edgeWear": 0.08, "scratches": [], "chips": ["small finial edge chips"]}, "dirt": {"amount": 0.05, "cavityBias": 0.18, "color": "#195B52"}, "localOverrides": [{"id": "jade-emissive-accent", "region": "crest and finials", "roughness": 0.18, "emissive": "#0A574E"}], "referencePbr": {"version": "1", "sourceImage": "artifacts/asset-intake/2026-08-06/jade-sanctuary-gate-reference-v1.png", "extractor": "img2threejs/forge/stage1_intake/extract_pbr_evidence.py", "method": "source-derived cool accent evidence with authored jade response", "verdict": "pass-with-single-view-limitation", "hardLimit": "The source image gives color/edge evidence but cannot prove jade transmission from one view.", "usable": true, "confidence": 0.74, "estimatedFidelity": 0.74, "targetThreshold": 0.7, "maps": {"albedo": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_albedo.png", "channel": "albedo"}, "roughness": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_roughness.png", "channel": "roughness"}, "height": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_height.png", "channel": "height"}, "normal": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_normal.png", "channel": "normal"}, "ao": {"url": "artifacts/img2threejs/jade-sanctuary-gate/pbr/gate-stone-bronze_ao.png", "channel": "ao"}}}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Jade Sanctuary Gate__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Jade Sanctuary Gate", "level": "macro", "role": "body", "importance": 1, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The visible object is an assembly of interlocking masonry, timber/bronze members, and roof modules around an open center.", "geometryDescriptor": {"topologyIntent": "assembled modular solids with beveled seams", "edgeTreatment": {"type": "rounded-bevel", "bevelRadius": 0.08, "segments": 3}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "smoothed hard-surface normals with weighted relief normals"}, "parent": null, "material": "stone", "materialLayers": ["stone", "bronze", "jade", "roof"], "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center-grounded", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.94}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "left-pillar-socket", "localPosition": [-4.9, 0, 0]}, {"id": "right-pillar-socket", "localPosition": [4.9, 0, 0]}, {"id": "roof-socket", "localPosition": [0, 7.8, 0]}], "collider": {"type": "compound-boxes", "offset": [0, 3.8, 0], "scale": [12, 8, 2], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "gate-root", "seamRefs": ["pillar-beam", "beam-roof"], "detachableFragments": ["roof", "left-pillar", "right-pillar"], "breakImpulse": 0, "debrisMaterial": "stone"}}, "localFeatures": ["gate-proportions", "moon-gate-negative-space"], "surfaceDetail": {"macroRoughness": 0.68, "microRoughness": 0.16, "bumpAmplitude": 0.22}, "evidenceRefs": ["full-object"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(42, 52, 63, 1.0)", "secondaryAlbedo": "rgba(106, 74, 45, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(18, 28, 42, 1.0)"}, {"position": 1, "color": "rgba(83, 100, 116, 1.0)"}]}}};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center-grounded", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.94}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "left-pillar-socket", "localPosition": [-4.9, 0, 0]}, {"id": "right-pillar-socket", "localPosition": [4.9, 0, 0]}, {"id": "roof-socket", "localPosition": [0, 7.8, 0]}], "collider": {"type": "compound-boxes", "offset": [0, 3.8, 0], "scale": [12, 8, 2], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "gate-root", "seamRefs": ["pillar-beam", "beam-roof"], "detachableFragments": ["roof", "left-pillar", "right-pillar"], "breakImpulse": 0, "debrisMaterial": "stone"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["stone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Jade Sanctuary Gate";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Jade Sanctuary Gate", "level": "macro", "role": "body", "importance": 1, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The visible object is an assembly of interlocking masonry, timber/bronze members, and roof modules around an open center.", "geometryDescriptor": {"topologyIntent": "assembled modular solids with beveled seams", "edgeTreatment": {"type": "rounded-bevel", "bevelRadius": 0.08, "segments": 3}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "smoothed hard-surface normals with weighted relief normals"}, "parent": null, "material": "stone", "materialLayers": ["stone", "bronze", "jade", "roof"], "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center-grounded", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.94}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "left-pillar-socket", "localPosition": [-4.9, 0, 0]}, {"id": "right-pillar-socket", "localPosition": [4.9, 0, 0]}, {"id": "roof-socket", "localPosition": [0, 7.8, 0]}], "collider": {"type": "compound-boxes", "offset": [0, 3.8, 0], "scale": [12, 8, 2], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "gate-root", "seamRefs": ["pillar-beam", "beam-roof"], "detachableFragments": ["roof", "left-pillar", "right-pillar"], "breakImpulse": 0, "debrisMaterial": "stone"}}, "localFeatures": ["gate-proportions", "moon-gate-negative-space"], "surfaceDetail": {"macroRoughness": 0.68, "microRoughness": 0.16, "bumpAmplitude": 0.22}, "evidenceRefs": ["full-object"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(42, 52, 63, 1.0)", "secondaryAlbedo": "rgba(106, 74, 45, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(18, 28, 42, 1.0)"}, {"position": 1, "color": "rgba(83, 100, 116, 1.0)"}]}}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "compound-boxes", "offset": [0, 3.8, 0], "scale": [12, 8, 2], "isTrigger": false};
  destructionGroups["gate-root"] ??= [];
  destructionGroups["gate-root"].push(node_root_0);
  const socket_root_left_pillar_socket_0 = new THREE.Object3D();
  socket_root_left_pillar_socket_0.name = "left-pillar-socket";
  socket_root_left_pillar_socket_0.position.set(-4.9, 0.0, 0.0);
  socket_root_left_pillar_socket_0.rotation.set(0, 0, 0);
  socket_root_left_pillar_socket_0.userData.socket = {"id": "left-pillar-socket", "localPosition": [-4.9, 0, 0]};
  node_root_0.add(socket_root_left_pillar_socket_0);
  sockets["root:left-pillar-socket"] = socket_root_left_pillar_socket_0;
  const socket_root_right_pillar_socket_1 = new THREE.Object3D();
  socket_root_right_pillar_socket_1.name = "right-pillar-socket";
  socket_root_right_pillar_socket_1.position.set(4.9, 0.0, 0.0);
  socket_root_right_pillar_socket_1.rotation.set(0, 0, 0);
  socket_root_right_pillar_socket_1.userData.socket = {"id": "right-pillar-socket", "localPosition": [4.9, 0, 0]};
  node_root_0.add(socket_root_right_pillar_socket_1);
  sockets["root:right-pillar-socket"] = socket_root_right_pillar_socket_1;
  const socket_root_roof_socket_2 = new THREE.Object3D();
  socket_root_roof_socket_2.name = "roof-socket";
  socket_root_roof_socket_2.position.set(0.0, 7.8, 0.0);
  socket_root_roof_socket_2.rotation.set(0, 0, 0);
  socket_root_roof_socket_2.userData.socket = {"id": "roof-socket", "localPosition": [0, 7.8, 0]};
  node_root_0.add(socket_root_roof_socket_2);
  sockets["root:roof-socket"] = socket_root_roof_socket_2;

  const attachment_left_pillar_1 = null;
  const endpoint_left_pillar_1 = makeAttachmentEndpoint(attachment_left_pillar_1);
  const node_left_pillar_1 = new THREE.Group();
  node_left_pillar_1.name = "Left carved pillar__pivot";
  node_left_pillar_1.scale.set(1, 1, 1);
  if (endpoint_left_pillar_1) {
    node_left_pillar_1.position.copy(endpoint_left_pillar_1.start);
    node_left_pillar_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_left_pillar_1.position.set(-4.9, 0.0, 0.0);
    node_left_pillar_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_left_pillar_1.userData.sculptComponent = {"id": "left-pillar", "name": "Left carved pillar", "level": "macro", "role": "column", "importance": 0.92, "confidence": 0.88, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The pillar is a stacked plinth, fluted column, inset relief panel, and capital with visible seams.", "geometryDescriptor": {"topologyIntent": "stacked beveled masonry and relief solids", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.1, "segments": 3}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted normals plus independent relief normals"}, "parent": "root", "material": "stone", "materialLayers": ["stone", "bronze", "jade"], "transform": {"position": [-4.9, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-pillar", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "beam-contact", "localPosition": [0, 6.8, 0]}], "collider": {"type": "box", "offset": [0, 3.4, 0], "scale": [1.8, 6.8, 1.6], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-pillar", "seamRefs": ["left-capital"], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone"}}, "localFeatures": ["fluted-column", "bronze-medallion", "capital-stack"], "surfaceDetail": {"macroRoughness": 0.68, "microRoughness": 0.14, "bumpAmplitude": 0.24}, "evidenceRefs": ["left-pillar"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(40, 49, 60, 1.0)", "secondaryAlbedo": "rgba(83, 100, 116, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.91, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(22, 31, 42, 1.0)"}, {"position": 1, "color": "rgba(83, 100, 116, 1.0)"}]}}};
  node_left_pillar_1.userData.actionProfile = {"animationRole": "static-pillar", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "beam-contact", "localPosition": [0, 6.8, 0]}], "collider": {"type": "box", "offset": [0, 3.4, 0], "scale": [1.8, 6.8, 1.6], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-pillar", "seamRefs": ["left-capital"], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone"}};
  (nodes["root"] ?? root).add(node_left_pillar_1);
  nodes["left-pillar"] = node_left_pillar_1;
  const mesh_left_pillar_1Geometry = endpoint_left_pillar_1
    ? new THREE.CylinderGeometry(endpoint_left_pillar_1.endRadius, endpoint_left_pillar_1.baseRadius, endpoint_left_pillar_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_left_pillar_1) {
    mesh_left_pillar_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_left_pillar_1 = new THREE.Mesh(
    mesh_left_pillar_1Geometry,
    materialMap["stone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_left_pillar_1.name = "Left carved pillar";
  if (endpoint_left_pillar_1) {
    mesh_left_pillar_1.position.copy(endpoint_left_pillar_1.midpoint);
    mesh_left_pillar_1.quaternion.copy(endpoint_left_pillar_1.quaternion);
  }
  mesh_left_pillar_1.castShadow = options.castShadow ?? true;
  mesh_left_pillar_1.receiveShadow = options.receiveShadow ?? true;
  mesh_left_pillar_1.userData.sculptComponent = {"id": "left-pillar", "name": "Left carved pillar", "level": "macro", "role": "column", "importance": 0.92, "confidence": 0.88, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The pillar is a stacked plinth, fluted column, inset relief panel, and capital with visible seams.", "geometryDescriptor": {"topologyIntent": "stacked beveled masonry and relief solids", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.1, "segments": 3}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted normals plus independent relief normals"}, "parent": "root", "material": "stone", "materialLayers": ["stone", "bronze", "jade"], "transform": {"position": [-4.9, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-pillar", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "beam-contact", "localPosition": [0, 6.8, 0]}], "collider": {"type": "box", "offset": [0, 3.4, 0], "scale": [1.8, 6.8, 1.6], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-pillar", "seamRefs": ["left-capital"], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone"}}, "localFeatures": ["fluted-column", "bronze-medallion", "capital-stack"], "surfaceDetail": {"macroRoughness": 0.68, "microRoughness": 0.14, "bumpAmplitude": 0.24}, "evidenceRefs": ["left-pillar"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(40, 49, 60, 1.0)", "secondaryAlbedo": "rgba(83, 100, 116, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.91, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(22, 31, 42, 1.0)"}, {"position": 1, "color": "rgba(83, 100, 116, 1.0)"}]}}};
  node_left_pillar_1.add(mesh_left_pillar_1);
  meshes["left-pillar"] = mesh_left_pillar_1;
  colliders["left-pillar"] = {"type": "box", "offset": [0, 3.4, 0], "scale": [1.8, 6.8, 1.6], "isTrigger": false};
  destructionGroups["left-pillar"] ??= [];
  destructionGroups["left-pillar"].push(node_left_pillar_1);
  const socket_left_pillar_beam_contact_0 = new THREE.Object3D();
  socket_left_pillar_beam_contact_0.name = "beam-contact";
  socket_left_pillar_beam_contact_0.position.set(0.0, 6.8, 0.0);
  socket_left_pillar_beam_contact_0.rotation.set(0, 0, 0);
  socket_left_pillar_beam_contact_0.userData.socket = {"id": "beam-contact", "localPosition": [0, 6.8, 0]};
  node_left_pillar_1.add(socket_left_pillar_beam_contact_0);
  sockets["left-pillar:beam-contact"] = socket_left_pillar_beam_contact_0;

  const attachment_right_pillar_2 = null;
  const endpoint_right_pillar_2 = makeAttachmentEndpoint(attachment_right_pillar_2);
  const node_right_pillar_2 = new THREE.Group();
  node_right_pillar_2.name = "Right carved pillar__pivot";
  node_right_pillar_2.scale.set(1, 1, 1);
  if (endpoint_right_pillar_2) {
    node_right_pillar_2.position.copy(endpoint_right_pillar_2.start);
    node_right_pillar_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_right_pillar_2.position.set(4.9, 0.0, 0.0);
    node_right_pillar_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_right_pillar_2.userData.sculptComponent = {"id": "right-pillar", "name": "Right carved pillar", "level": "macro", "role": "column", "importance": 0.92, "confidence": 0.88, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The right pillar mirrors the left with stepped foundation, fluted shaft, inset panel, and layered capital.", "geometryDescriptor": {"topologyIntent": "stacked beveled masonry and relief solids", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.1, "segments": 3}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted normals plus independent relief normals"}, "parent": "root", "material": "stone", "materialLayers": ["stone", "bronze", "jade"], "transform": {"position": [4.9, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-pillar", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "beam-contact", "localPosition": [0, 6.8, 0]}], "collider": {"type": "box", "offset": [0, 3.4, 0], "scale": [1.8, 6.8, 1.6], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-pillar", "seamRefs": ["right-capital"], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone"}}, "localFeatures": ["fluted-column", "bronze-medallion", "capital-stack"], "surfaceDetail": {"macroRoughness": 0.68, "microRoughness": 0.14, "bumpAmplitude": 0.24}, "evidenceRefs": ["right-pillar"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(40, 49, 60, 1.0)", "secondaryAlbedo": "rgba(83, 100, 116, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.91, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(22, 31, 42, 1.0)"}, {"position": 1, "color": "rgba(83, 100, 116, 1.0)"}]}}};
  node_right_pillar_2.userData.actionProfile = {"animationRole": "static-pillar", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "beam-contact", "localPosition": [0, 6.8, 0]}], "collider": {"type": "box", "offset": [0, 3.4, 0], "scale": [1.8, 6.8, 1.6], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-pillar", "seamRefs": ["right-capital"], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone"}};
  (nodes["root"] ?? root).add(node_right_pillar_2);
  nodes["right-pillar"] = node_right_pillar_2;
  const mesh_right_pillar_2Geometry = endpoint_right_pillar_2
    ? new THREE.CylinderGeometry(endpoint_right_pillar_2.endRadius, endpoint_right_pillar_2.baseRadius, endpoint_right_pillar_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_right_pillar_2) {
    mesh_right_pillar_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_right_pillar_2 = new THREE.Mesh(
    mesh_right_pillar_2Geometry,
    materialMap["stone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_right_pillar_2.name = "Right carved pillar";
  if (endpoint_right_pillar_2) {
    mesh_right_pillar_2.position.copy(endpoint_right_pillar_2.midpoint);
    mesh_right_pillar_2.quaternion.copy(endpoint_right_pillar_2.quaternion);
  }
  mesh_right_pillar_2.castShadow = options.castShadow ?? true;
  mesh_right_pillar_2.receiveShadow = options.receiveShadow ?? true;
  mesh_right_pillar_2.userData.sculptComponent = {"id": "right-pillar", "name": "Right carved pillar", "level": "macro", "role": "column", "importance": 0.92, "confidence": 0.88, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The right pillar mirrors the left with stepped foundation, fluted shaft, inset panel, and layered capital.", "geometryDescriptor": {"topologyIntent": "stacked beveled masonry and relief solids", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.1, "segments": 3}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted normals plus independent relief normals"}, "parent": "root", "material": "stone", "materialLayers": ["stone", "bronze", "jade"], "transform": {"position": [4.9, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-pillar", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "beam-contact", "localPosition": [0, 6.8, 0]}], "collider": {"type": "box", "offset": [0, 3.4, 0], "scale": [1.8, 6.8, 1.6], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-pillar", "seamRefs": ["right-capital"], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone"}}, "localFeatures": ["fluted-column", "bronze-medallion", "capital-stack"], "surfaceDetail": {"macroRoughness": 0.68, "microRoughness": 0.14, "bumpAmplitude": 0.24}, "evidenceRefs": ["right-pillar"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(40, 49, 60, 1.0)", "secondaryAlbedo": "rgba(83, 100, 116, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.91, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(22, 31, 42, 1.0)"}, {"position": 1, "color": "rgba(83, 100, 116, 1.0)"}]}}};
  node_right_pillar_2.add(mesh_right_pillar_2);
  meshes["right-pillar"] = mesh_right_pillar_2;
  colliders["right-pillar"] = {"type": "box", "offset": [0, 3.4, 0], "scale": [1.8, 6.8, 1.6], "isTrigger": false};
  destructionGroups["right-pillar"] ??= [];
  destructionGroups["right-pillar"].push(node_right_pillar_2);
  const socket_right_pillar_beam_contact_0 = new THREE.Object3D();
  socket_right_pillar_beam_contact_0.name = "beam-contact";
  socket_right_pillar_beam_contact_0.position.set(0.0, 6.8, 0.0);
  socket_right_pillar_beam_contact_0.rotation.set(0, 0, 0);
  socket_right_pillar_beam_contact_0.userData.socket = {"id": "beam-contact", "localPosition": [0, 6.8, 0]};
  node_right_pillar_2.add(socket_right_pillar_beam_contact_0);
  sockets["right-pillar:beam-contact"] = socket_right_pillar_beam_contact_0;

  const attachment_crossbeam_3 = null;
  const endpoint_crossbeam_3 = makeAttachmentEndpoint(attachment_crossbeam_3);
  const node_crossbeam_3 = new THREE.Group();
  node_crossbeam_3.name = "Carved crossbeam and brackets__pivot";
  node_crossbeam_3.scale.set(1, 1, 1);
  if (endpoint_crossbeam_3) {
    node_crossbeam_3.position.copy(endpoint_crossbeam_3.start);
    node_crossbeam_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_crossbeam_3.position.set(0.0, 7.1, 0.0);
    node_crossbeam_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_crossbeam_3.userData.sculptComponent = {"id": "crossbeam", "name": "Carved crossbeam and brackets", "level": "macro", "role": "beam", "importance": 0.9, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The horizontal beam is a layered solid with a recessed shadow pocket, angled brackets, and a separate crest.", "geometryDescriptor": {"topologyIntent": "layered beveled beams with angled structural braces", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.09, "segments": 3}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted beam normals and relief normals"}, "parent": "root", "material": "bronze", "materialLayers": ["stone", "bronze", "jade"], "transform": {"position": [0, 7.1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "beam-and-crest", "pivot": {"mode": "center", "localPosition": [0, 7.1, 0], "axis": [0, 1, 0], "confidence": 0.87}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "crest-socket", "localPosition": [0, 0, 0.9]}, {"id": "left-bracket", "localPosition": [-3.6, -0.5, 0.5]}, {"id": "right-bracket", "localPosition": [3.6, -0.5, 0.5]}], "collider": {"type": "box", "offset": [0, 7.1, 0], "scale": [11.5, 1.4, 1.4], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "beam", "seamRefs": ["beam-roof"], "detachableFragments": ["crest"], "breakImpulse": 0, "debrisMaterial": "bronze"}}, "localFeatures": ["bracket-stack", "central-crest", "hanging-pendants"], "surfaceDetail": {"macroRoughness": 0.36, "microRoughness": 0.12, "bumpAmplitude": 0.2}, "evidenceRefs": ["crossbeam"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(106, 74, 45, 1.0)", "secondaryAlbedo": "rgba(42, 52, 63, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.86, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(68, 45, 28, 1.0)"}, {"position": 1, "color": "rgba(145, 102, 58, 1.0)"}]}}};
  node_crossbeam_3.userData.actionProfile = {"animationRole": "beam-and-crest", "pivot": {"mode": "center", "localPosition": [0, 7.1, 0], "axis": [0, 1, 0], "confidence": 0.87}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "crest-socket", "localPosition": [0, 0, 0.9]}, {"id": "left-bracket", "localPosition": [-3.6, -0.5, 0.5]}, {"id": "right-bracket", "localPosition": [3.6, -0.5, 0.5]}], "collider": {"type": "box", "offset": [0, 7.1, 0], "scale": [11.5, 1.4, 1.4], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "beam", "seamRefs": ["beam-roof"], "detachableFragments": ["crest"], "breakImpulse": 0, "debrisMaterial": "bronze"}};
  (nodes["root"] ?? root).add(node_crossbeam_3);
  nodes["crossbeam"] = node_crossbeam_3;
  const mesh_crossbeam_3Geometry = endpoint_crossbeam_3
    ? new THREE.CylinderGeometry(endpoint_crossbeam_3.endRadius, endpoint_crossbeam_3.baseRadius, endpoint_crossbeam_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_crossbeam_3) {
    mesh_crossbeam_3Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_crossbeam_3 = new THREE.Mesh(
    mesh_crossbeam_3Geometry,
    materialMap["bronze"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_crossbeam_3.name = "Carved crossbeam and brackets";
  if (endpoint_crossbeam_3) {
    mesh_crossbeam_3.position.copy(endpoint_crossbeam_3.midpoint);
    mesh_crossbeam_3.quaternion.copy(endpoint_crossbeam_3.quaternion);
  }
  mesh_crossbeam_3.castShadow = options.castShadow ?? true;
  mesh_crossbeam_3.receiveShadow = options.receiveShadow ?? true;
  mesh_crossbeam_3.userData.sculptComponent = {"id": "crossbeam", "name": "Carved crossbeam and brackets", "level": "macro", "role": "beam", "importance": 0.9, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The horizontal beam is a layered solid with a recessed shadow pocket, angled brackets, and a separate crest.", "geometryDescriptor": {"topologyIntent": "layered beveled beams with angled structural braces", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.09, "segments": 3}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted beam normals and relief normals"}, "parent": "root", "material": "bronze", "materialLayers": ["stone", "bronze", "jade"], "transform": {"position": [0, 7.1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "beam-and-crest", "pivot": {"mode": "center", "localPosition": [0, 7.1, 0], "axis": [0, 1, 0], "confidence": 0.87}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "crest-socket", "localPosition": [0, 0, 0.9]}, {"id": "left-bracket", "localPosition": [-3.6, -0.5, 0.5]}, {"id": "right-bracket", "localPosition": [3.6, -0.5, 0.5]}], "collider": {"type": "box", "offset": [0, 7.1, 0], "scale": [11.5, 1.4, 1.4], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "beam", "seamRefs": ["beam-roof"], "detachableFragments": ["crest"], "breakImpulse": 0, "debrisMaterial": "bronze"}}, "localFeatures": ["bracket-stack", "central-crest", "hanging-pendants"], "surfaceDetail": {"macroRoughness": 0.36, "microRoughness": 0.12, "bumpAmplitude": 0.2}, "evidenceRefs": ["crossbeam"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(106, 74, 45, 1.0)", "secondaryAlbedo": "rgba(42, 52, 63, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.86, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(68, 45, 28, 1.0)"}, {"position": 1, "color": "rgba(145, 102, 58, 1.0)"}]}}};
  node_crossbeam_3.add(mesh_crossbeam_3);
  meshes["crossbeam"] = mesh_crossbeam_3;
  colliders["crossbeam"] = {"type": "box", "offset": [0, 7.1, 0], "scale": [11.5, 1.4, 1.4], "isTrigger": false};
  destructionGroups["beam"] ??= [];
  destructionGroups["beam"].push(node_crossbeam_3);
  const socket_crossbeam_crest_socket_0 = new THREE.Object3D();
  socket_crossbeam_crest_socket_0.name = "crest-socket";
  socket_crossbeam_crest_socket_0.position.set(0.0, 0.0, 0.9);
  socket_crossbeam_crest_socket_0.rotation.set(0, 0, 0);
  socket_crossbeam_crest_socket_0.userData.socket = {"id": "crest-socket", "localPosition": [0, 0, 0.9]};
  node_crossbeam_3.add(socket_crossbeam_crest_socket_0);
  sockets["crossbeam:crest-socket"] = socket_crossbeam_crest_socket_0;
  const socket_crossbeam_left_bracket_1 = new THREE.Object3D();
  socket_crossbeam_left_bracket_1.name = "left-bracket";
  socket_crossbeam_left_bracket_1.position.set(-3.6, -0.5, 0.5);
  socket_crossbeam_left_bracket_1.rotation.set(0, 0, 0);
  socket_crossbeam_left_bracket_1.userData.socket = {"id": "left-bracket", "localPosition": [-3.6, -0.5, 0.5]};
  node_crossbeam_3.add(socket_crossbeam_left_bracket_1);
  sockets["crossbeam:left-bracket"] = socket_crossbeam_left_bracket_1;
  const socket_crossbeam_right_bracket_2 = new THREE.Object3D();
  socket_crossbeam_right_bracket_2.name = "right-bracket";
  socket_crossbeam_right_bracket_2.position.set(3.6, -0.5, 0.5);
  socket_crossbeam_right_bracket_2.rotation.set(0, 0, 0);
  socket_crossbeam_right_bracket_2.userData.socket = {"id": "right-bracket", "localPosition": [3.6, -0.5, 0.5]};
  node_crossbeam_3.add(socket_crossbeam_right_bracket_2);
  sockets["crossbeam:right-bracket"] = socket_crossbeam_right_bracket_2;

  const attachment_roof_4 = null;
  const endpoint_roof_4 = makeAttachmentEndpoint(attachment_roof_4);
  const node_roof_4 = new THREE.Group();
  node_roof_4.name = "Two-tier upturned tiled roof__pivot";
  node_roof_4.scale.set(1, 1, 1);
  if (endpoint_roof_4) {
    node_roof_4.position.copy(endpoint_roof_4.start);
    node_roof_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_roof_4.position.set(0.0, 8.0, 0.0);
    node_roof_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_roof_4.userData.sculptComponent = {"id": "roof", "name": "Two-tier upturned tiled roof", "level": "macro", "role": "roof", "importance": 0.98, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The roof is two pairs of sloped panels with separate repeated tile courses, curled eaves, ridge tails, and finials.", "geometryDescriptor": {"topologyIntent": "paired sloped shells with instanced tile courses and curved eave members", "edgeTreatment": {"type": "rolled-edge", "bevelRadius": 0.08, "segments": 3}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "slope-aware normals plus tile normals"}, "parent": "root", "material": "roof", "materialLayers": ["roof", "bronze", "jade"], "transform": {"position": [0, 8, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "roof-static", "pivot": {"mode": "ridge", "localPosition": [0, 8.2, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "left-eave", "localPosition": [-6.5, 0, 1.0]}, {"id": "right-eave", "localPosition": [6.5, 0, 1.0]}], "collider": {"type": "compound-boxes", "offset": [0, 8.6, 0], "scale": [14, 2.2, 4], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "roof", "seamRefs": ["beam-roof"], "detachableFragments": ["roof-tile-courses"], "breakImpulse": 0, "debrisMaterial": "roof"}}, "localFeatures": ["tile-course", "upturned-eaves", "ridge-finials"], "surfaceDetail": {"macroRoughness": 0.46, "microRoughness": 0.12, "bumpAmplitude": 0.18}, "evidenceRefs": ["roof"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 38, 55, 1.0)", "secondaryAlbedo": "rgba(106, 74, 45, 1.0)", "materialClass": "ceramic", "materialClassConfidence": 0.84, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(15, 29, 46, 1.0)"}, {"position": 1, "color": "rgba(62, 88, 111, 1.0)"}]}}};
  node_roof_4.userData.actionProfile = {"animationRole": "roof-static", "pivot": {"mode": "ridge", "localPosition": [0, 8.2, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "left-eave", "localPosition": [-6.5, 0, 1.0]}, {"id": "right-eave", "localPosition": [6.5, 0, 1.0]}], "collider": {"type": "compound-boxes", "offset": [0, 8.6, 0], "scale": [14, 2.2, 4], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "roof", "seamRefs": ["beam-roof"], "detachableFragments": ["roof-tile-courses"], "breakImpulse": 0, "debrisMaterial": "roof"}};
  (nodes["root"] ?? root).add(node_roof_4);
  nodes["roof"] = node_roof_4;
  const mesh_roof_4Geometry = endpoint_roof_4
    ? new THREE.CylinderGeometry(endpoint_roof_4.endRadius, endpoint_roof_4.baseRadius, endpoint_roof_4.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_roof_4) {
    mesh_roof_4Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_roof_4 = new THREE.Mesh(
    mesh_roof_4Geometry,
    materialMap["roof"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_roof_4.name = "Two-tier upturned tiled roof";
  if (endpoint_roof_4) {
    mesh_roof_4.position.copy(endpoint_roof_4.midpoint);
    mesh_roof_4.quaternion.copy(endpoint_roof_4.quaternion);
  }
  mesh_roof_4.castShadow = options.castShadow ?? true;
  mesh_roof_4.receiveShadow = options.receiveShadow ?? true;
  mesh_roof_4.userData.sculptComponent = {"id": "roof", "name": "Two-tier upturned tiled roof", "level": "macro", "role": "roof", "importance": 0.98, "confidence": 0.9, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The roof is two pairs of sloped panels with separate repeated tile courses, curled eaves, ridge tails, and finials.", "geometryDescriptor": {"topologyIntent": "paired sloped shells with instanced tile courses and curved eave members", "edgeTreatment": {"type": "rolled-edge", "bevelRadius": 0.08, "segments": 3}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "slope-aware normals plus tile normals"}, "parent": "root", "material": "roof", "materialLayers": ["roof", "bronze", "jade"], "transform": {"position": [0, 8, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "roof-static", "pivot": {"mode": "ridge", "localPosition": [0, 8.2, 0], "axis": [0, 1, 0], "confidence": 0.88}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [{"id": "left-eave", "localPosition": [-6.5, 0, 1.0]}, {"id": "right-eave", "localPosition": [6.5, 0, 1.0]}], "collider": {"type": "compound-boxes", "offset": [0, 8.6, 0], "scale": [14, 2.2, 4], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "roof", "seamRefs": ["beam-roof"], "detachableFragments": ["roof-tile-courses"], "breakImpulse": 0, "debrisMaterial": "roof"}}, "localFeatures": ["tile-course", "upturned-eaves", "ridge-finials"], "surfaceDetail": {"macroRoughness": 0.46, "microRoughness": 0.12, "bumpAmplitude": 0.18}, "evidenceRefs": ["roof"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(23, 38, 55, 1.0)", "secondaryAlbedo": "rgba(106, 74, 45, 1.0)", "materialClass": "ceramic", "materialClassConfidence": 0.84, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(15, 29, 46, 1.0)"}, {"position": 1, "color": "rgba(62, 88, 111, 1.0)"}]}}};
  node_roof_4.add(mesh_roof_4);
  meshes["roof"] = mesh_roof_4;
  colliders["roof"] = {"type": "compound-boxes", "offset": [0, 8.6, 0], "scale": [14, 2.2, 4], "isTrigger": false};
  destructionGroups["roof"] ??= [];
  destructionGroups["roof"].push(node_roof_4);
  const socket_roof_left_eave_0 = new THREE.Object3D();
  socket_roof_left_eave_0.name = "left-eave";
  socket_roof_left_eave_0.position.set(-6.5, 0.0, 1.0);
  socket_roof_left_eave_0.rotation.set(0, 0, 0);
  socket_roof_left_eave_0.userData.socket = {"id": "left-eave", "localPosition": [-6.5, 0, 1.0]};
  node_roof_4.add(socket_roof_left_eave_0);
  sockets["roof:left-eave"] = socket_roof_left_eave_0;
  const socket_roof_right_eave_1 = new THREE.Object3D();
  socket_roof_right_eave_1.name = "right-eave";
  socket_roof_right_eave_1.position.set(6.5, 0.0, 1.0);
  socket_roof_right_eave_1.rotation.set(0, 0, 0);
  socket_roof_right_eave_1.userData.socket = {"id": "right-eave", "localPosition": [6.5, 0, 1.0]};
  node_roof_4.add(socket_roof_right_eave_1);
  sockets["roof:right-eave"] = socket_roof_right_eave_1;

  const attachment_stairs_5 = null;
  const endpoint_stairs_5 = makeAttachmentEndpoint(attachment_stairs_5);
  const node_stairs_5 = new THREE.Group();
  node_stairs_5.name = "Ceremonial stair approach__pivot";
  node_stairs_5.scale.set(1, 1, 1);
  if (endpoint_stairs_5) {
    node_stairs_5.position.copy(endpoint_stairs_5.start);
    node_stairs_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_stairs_5.position.set(0.0, 0.0, 1.5);
    node_stairs_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_stairs_5.userData.sculptComponent = {"id": "stairs", "name": "Ceremonial stair approach", "level": "macro", "role": "stairs", "importance": 0.82, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Five overlapping stair slabs, rails, posts, and jade caps create the raised approach without filling the gate opening.", "geometryDescriptor": {"topologyIntent": "stepped overlapping slabs with beveled contact edges", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.05, "segments": 2}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted slab normals"}, "parent": "root", "material": "stone", "materialLayers": ["stone", "stone-edge", "bronze", "jade"], "transform": {"position": [0, 0, 1.5], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "approach-static", "pivot": {"mode": "ground", "localPosition": [0, 0, 1.5], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "rail-left", "localPosition": [-2.2, 0.4, 2.2]}, {"id": "rail-right", "localPosition": [2.2, 0.4, 2.2]}], "collider": {"type": "compound-boxes", "offset": [0, 0.5, 1.5], "scale": [5, 1.2, 3.2], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "stairs", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone"}}, "localFeatures": ["ceremonial-steps", "rail-jade-caps"], "surfaceDetail": {"macroRoughness": 0.68, "microRoughness": 0.16, "bumpAmplitude": 0.18}, "evidenceRefs": ["stairs"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(83, 100, 116, 1.0)", "secondaryAlbedo": "rgba(42, 52, 63, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.9, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(38, 55, 72, 1.0)"}, {"position": 1, "color": "rgba(102, 124, 141, 1.0)"}]}}};
  node_stairs_5.userData.actionProfile = {"animationRole": "approach-static", "pivot": {"mode": "ground", "localPosition": [0, 0, 1.5], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "rail-left", "localPosition": [-2.2, 0.4, 2.2]}, {"id": "rail-right", "localPosition": [2.2, 0.4, 2.2]}], "collider": {"type": "compound-boxes", "offset": [0, 0.5, 1.5], "scale": [5, 1.2, 3.2], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "stairs", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone"}};
  (nodes["root"] ?? root).add(node_stairs_5);
  nodes["stairs"] = node_stairs_5;
  const mesh_stairs_5Geometry = endpoint_stairs_5
    ? new THREE.CylinderGeometry(endpoint_stairs_5.endRadius, endpoint_stairs_5.baseRadius, endpoint_stairs_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_stairs_5) {
    mesh_stairs_5Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_stairs_5 = new THREE.Mesh(
    mesh_stairs_5Geometry,
    materialMap["stone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_stairs_5.name = "Ceremonial stair approach";
  if (endpoint_stairs_5) {
    mesh_stairs_5.position.copy(endpoint_stairs_5.midpoint);
    mesh_stairs_5.quaternion.copy(endpoint_stairs_5.quaternion);
  }
  mesh_stairs_5.castShadow = options.castShadow ?? true;
  mesh_stairs_5.receiveShadow = options.receiveShadow ?? true;
  mesh_stairs_5.userData.sculptComponent = {"id": "stairs", "name": "Ceremonial stair approach", "level": "macro", "role": "stairs", "importance": 0.82, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Five overlapping stair slabs, rails, posts, and jade caps create the raised approach without filling the gate opening.", "geometryDescriptor": {"topologyIntent": "stepped overlapping slabs with beveled contact edges", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.05, "segments": 2}, "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted slab normals"}, "parent": "root", "material": "stone", "materialLayers": ["stone", "stone-edge", "bronze", "jade"], "transform": {"position": [0, 0, 1.5], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "approach-static", "pivot": {"mode": "ground", "localPosition": [0, 0, 1.5], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "rail-left", "localPosition": [-2.2, 0.4, 2.2]}, {"id": "rail-right", "localPosition": [2.2, 0.4, 2.2]}], "collider": {"type": "compound-boxes", "offset": [0, 0.5, 1.5], "scale": [5, 1.2, 3.2], "isTrigger": false}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "stairs", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "stone"}}, "localFeatures": ["ceremonial-steps", "rail-jade-caps"], "surfaceDetail": {"macroRoughness": 0.68, "microRoughness": 0.16, "bumpAmplitude": 0.18}, "evidenceRefs": ["stairs"], "colorMaterialRecipe": {"dominantAlbedo": "rgba(83, 100, 116, 1.0)", "secondaryAlbedo": "rgba(42, 52, 63, 1.0)", "materialClass": "stone", "materialClassConfidence": 0.9, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(38, 55, 72, 1.0)"}, {"position": 1, "color": "rgba(102, 124, 141, 1.0)"}]}}};
  node_stairs_5.add(mesh_stairs_5);
  meshes["stairs"] = mesh_stairs_5;
  colliders["stairs"] = {"type": "compound-boxes", "offset": [0, 0.5, 1.5], "scale": [5, 1.2, 3.2], "isTrigger": false};
  destructionGroups["stairs"] ??= [];
  destructionGroups["stairs"].push(node_stairs_5);
  const socket_stairs_rail_left_0 = new THREE.Object3D();
  socket_stairs_rail_left_0.name = "rail-left";
  socket_stairs_rail_left_0.position.set(-2.2, 0.4, 2.2);
  socket_stairs_rail_left_0.rotation.set(0, 0, 0);
  socket_stairs_rail_left_0.userData.socket = {"id": "rail-left", "localPosition": [-2.2, 0.4, 2.2]};
  node_stairs_5.add(socket_stairs_rail_left_0);
  sockets["stairs:rail-left"] = socket_stairs_rail_left_0;
  const socket_stairs_rail_right_1 = new THREE.Object3D();
  socket_stairs_rail_right_1.name = "rail-right";
  socket_stairs_rail_right_1.position.set(2.2, 0.4, 2.2);
  socket_stairs_rail_right_1.rotation.set(0, 0, 0);
  socket_stairs_rail_right_1.userData.socket = {"id": "rail-right", "localPosition": [2.2, 0.4, 2.2]};
  node_stairs_5.add(socket_stairs_rail_right_1);
  sockets["stairs:rail-right"] = socket_stairs_rail_right_1;

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo", "uniform roughness", "albedo reused as another channel", "map-only silhouette relief"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "missing contact shadow"]}, "screenshotReview": ["Compare silhouette and negative space.", "Compare roughness/normal response under grazing light.", "Compare local jade/bronze zones and lantern warmth.", "Compare contact shadows and exposure."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createJadeSanctuaryGateLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Jade Sanctuary Gate look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"type": "key light", "direction": "high front-left", "color": "cool moon blue", "intensity": 1.0, "evidenceRef": "full-object"}, {"type": "fill light", "direction": "camera-side low fill", "color": "desaturated cyan", "intensity": 0.34, "evidenceRef": "full-object"}, {"type": "rim light", "direction": "back-right roof edge", "color": "silver cyan", "intensity": 0.72, "evidenceRef": "roof"}, {"type": "exposure and tone mapping", "exposure": 1.05, "toneMapping": "ACES filmic", "background": "deep blue sanctuary", "evidenceRef": "full-object"}, {"type": "contact shadow", "behavior": "soft grounding under stairs and pillar plinths; cavity AO under beam", "ambientOcclusion": true, "evidenceRef": "stairs"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo", "uniform roughness", "albedo reused as another channel", "map-only silhouette relief"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "missing contact shadow"]}, "screenshotReview": ["Compare silhouette and negative space.", "Compare roughness/normal response under grazing light.", "Compare local jade/bronze zones and lantern warmth.", "Compare contact shadows and exposure."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createJadeSanctuaryGateEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameJadeSanctuaryGateCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createJadeSanctuaryGatePresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureJadeSanctuaryGateRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createJadeSanctuaryGateInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
