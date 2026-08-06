import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const [sourceArg, destinationArg] = process.argv.slice(2)
if (!sourceArg || !destinationArg) {
  throw new Error('usage: node prepare-gate-factory.mjs <generated-source> <runtime-source>')
}

const source = resolve(sourceArg)
const destination = resolve(destinationArg)
const input = readFileSync(source, 'utf8')
const newline = input.includes('\r\n') ? '\r\n' : '\n'
const signature = `function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {${newline}`
const guard = `${signature}  // The emergency LOD is self-contained; authoring PBR files stay outside the runtime bundle.${newline}  if ((options.qualityPriority ?? 'reference-fidelity') !== 'reference-fidelity') return null;${newline}`

if (!input.includes(signature)) throw new Error('generated factory signature not found')
const output = input.includes("if ((options.qualityPriority ?? 'reference-fidelity') !== 'reference-fidelity') return null;")
  ? input
  : input.replace(signature, guard)
mkdirSync(dirname(destination), { recursive: true })
writeFileSync(destination, output, 'utf8')
console.log(destination)
