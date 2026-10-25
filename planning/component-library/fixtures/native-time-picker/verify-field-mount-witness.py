"""Exercise actual mount observers without treating deduplicated form metadata as a transaction receipt."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
fixture = Path(__file__).resolve().parent
repo = fixture.parents[3]
output = args.output.resolve()
assert not any((p / "SEALED.json").exists() for p in [output, *output.parents])
output.mkdir(parents=True, exist_ok=False)
metadata = repo / "packages/react-native/ios/CUIFormMetadata.mm"
binding = repo / "packages/react-native/ios/CUIFieldInputBinding.mm"
legacy = subprocess.check_output(["git", "show", "9e3527b716f2e1d362b25b47272689564bc566a8:packages/react-native/ios/CUIFieldInputBinding.mm"], cwd=repo, text=True)


def extract(source, signature):
    start = source.index(signature)
    masked = re.sub(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"', lambda m: " " * len(m[0]), source)
    opening = source.index("{", start)
    depth = 1
    for end in range(opening + 1, len(masked)):
        depth += (masked[end] == "{") - (masked[end] == "}")
        if depth == 0:
            return source[start:end + 1]
    raise AssertionError("Incomplete owned method: " + signature)


text = metadata.read_text()
excerpts = {
    "metadata-witness.inc": "\n".join(extract(text, s) for s in ["- (NSString *)formTransactionWitness", "- (void)didMoveToWindow\n", "- (void)mountingTransactionDidMount:"]),
    "binding-witness.inc": extract(binding.read_text(), "- (NSString *)mountWitness\n"),
    "legacy-binding-witness.inc": extract(legacy, "- (NSString *)mountWitness\n"),
}
for name, source in excerpts.items():
    (output / name).write_text(source + "\n")
executable = output / "field-mount-witness-contract"
subprocess.run(["/usr/bin/clang++", "-std=c++20", "-fobjc-arc", "-fblocks", "-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter", "-I" + str(output), str(fixture / "field-mount-witness-contract.mm"), "-framework", "Foundation", "-o", str(executable)], check=True, timeout=30)
record = subprocess.check_output([str(executable)], text=True, timeout=8).strip()
result = {"status": "PASS", "result": record, "legacySource": "9e3527b716f2e1d362b25b47272689564bc566a8", "filesSHA256": {str(p.relative_to(repo)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [metadata, binding, Path(__file__), fixture / "field-mount-witness-contract.mm"]}, "excerptsSHA256": {n: hashlib.sha256((s + "\n").encode()).hexdigest() for n, s in excerpts.items()}, "nativeActions": 0, "installedAcceptance": False}
(output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
