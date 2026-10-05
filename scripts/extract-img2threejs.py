"""Extract the Apache-2.0 upstream sweep helper and canon. No reconstruction gate is claimed."""
import ast, importlib.util, json, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'vendor/img2threejs/forge'
source = VENDOR / 'stage3_build/generate_threejs_factory.py'
tree = ast.parse(source.read_text())
for node in ast.walk(tree):
    if isinstance(node, ast.If) and ast.unparse(node.test) == "'tapered-sweep' in used_primitives":
        lines = ast.literal_eval(node.body[0].value.args[0])
        code = '\n'.join(lines).replace('function buildTaperedSweepGeometry(', 'export function buildTaperedSweepGeometry(', 1)
        header = '// SPDX-License-Identifier: Apache-2.0\n// Extracted from img2threejs commit 6e60b5e22419464b4853e01ddb6c0e6f6659a733.\n// Only changes: THREE import and exported function. See THIRD_PARTY.md.\nimport * as THREE from "three";\n'
        (ROOT / 'src/vendor/taperedSweep.ts').write_text(header + code)
        break
else:
    raise RuntimeError('Upstream helper was not found')
path = VENDOR / 'stage2_spec/humanoid_proportions.py'
loader = importlib.util.spec_from_file_location('canon', path)
module = importlib.util.module_from_spec(loader)
loader.loader.exec_module(module)
(ROOT / 'src/generated/anatomy.json').write_text(json.dumps(module.derive_anatomy(8), indent=2) + '\n')
(ROOT / 'vendor/img2threejs/PROVENANCE.json').write_text(json.dumps({
    'repository': 'https://github.com/img2threejs/img2threejs',
    'commit': '6e60b5e22419464b4853e01ddb6c0e6f6659a733',
    'license': 'Apache-2.0',
    'factorySha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'reuse': ['buildTaperedSweepGeometry', 'derive_anatomy(8)'],
    'note': 'Runtime extension; not a completed image reconstruction pipeline.'
}, indent=2) + '\n')
print('Generated: src/vendor/taperedSweep.ts and src/generated/anatomy.json')
