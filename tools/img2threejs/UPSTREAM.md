# Upstream img2threejs

This directory is a vendored snapshot of [img2threejs/img2threejs](https://github.com/img2threejs/img2threejs), pinned at commit `d6673386f89673a58736f8d398dd16ece67874f5`.

Yeongheo Geomga uses the upstream `forge` pipeline to turn the ImageGen Seolryeong reference into a quality-gated `ObjectSculptSpec` and generated Three.js factory. The runtime game imports the generated factory under `src/art/generated/`; the upstream checkout is retained here so the asset can be regenerated after a clean clone without relying on a machine-local skill installation.

The upstream project is Apache-2.0 licensed. See `LICENSE` in this directory.
