"""Freeze current Card source and build one matching unsigned UIKit app product."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import time

REPO = Path(__file__).resolve().parents[4]
FIXTURE = Path(__file__).resolve().parent
sys.path.insert(0, str(FIXTURE.parent / "native-collection"))
from build import LAB, command, digest, environment

STAGE = REPO / "apps/native-showcase/.expo/codon-card-ios-gate"


def provider_file(generated):
    candidates = list(generated.rglob("RCTThirdPartyComponentsProvider.mm"))
    assert len(candidates) == 1, "One actual generated third-party provider required"
    text = candidates[0].read_text()
    assert all(name in text for name in ["CUIFocusView", "CUIKeyboardScope", "CUICollectionRoot", "CUICollectionNode"])
    return candidates[0]


def pod_changes(before, after):
    expected = json.loads(json.dumps(before))
    changed = [name for name, value in after["SPEC CHECKSUMS"].items() if before["SPEC CHECKSUMS"].get(name) != value]
    assert set(changed) <= {"CodonNativeInput", "ReactCodegen", "ReactAppDependencyProvider"}
    for name in changed: expected["SPEC CHECKSUMS"][name] = after["SPEC CHECKSUMS"][name]
    assert expected == after, "Native pod versions or unrelated lock contents changed"
    return changed


def verify(root):
    assert not (root / "SHA256.json").exists(), "Sealed evidence is data only"
    inputs = json.loads((root / "inputs.json").read_text())
    assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip() == inputs["producer"]
    assert not subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO)
    for name, expected in inputs["sourceInputs"].items(): assert digest(REPO / name) == expected, name
    for name, expected in inputs["nativeProjectInputs"].items():
        if name.endswith("Podfile.lock") and inputs.get("podsChecked"): continue
        assert digest(REPO / name) == expected, name
    for name, expected in inputs["stageInputs"].items(): assert digest(STAGE / name) == expected, name
    return inputs


def prepare(root, scene="geometry"):
    assert not root.exists() and not subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO)
    producer = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip()
    names = subprocess.check_output(["git", "ls-files", "packages/react-native", "apps/native-showcase", "planning/component-library/fixtures/native-card", "planning/component-library/fixtures/native-collection", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "AGENTS.md"], cwd=REPO, text=True).splitlines()
    root.mkdir(parents=True)
    STAGE.mkdir(parents=True, exist_ok=True)
    assert scene in ["geometry", "drawing"]
    shutil.copyfile(FIXTURE / ("CardGeometryApp.tsx" if scene == "geometry" else "CardDrawingApp.tsx"), STAGE / "App.tsx")
    (STAGE / "index.ts").write_text((FIXTURE / "geometry-index.ts").read_text().replace('"./CardGeometryApp"', '"./App"'))
    (STAGE / "geometry-identity.ts").write_text("export const SOURCE_PRODUCER = " + json.dumps(producer) + "\n")
    native = {}
    for platform in ["ios", "android"]:
        folder = REPO / "apps/native-showcase" / platform
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or any(part in ["Pods", "build", ".gradle", ".cxx", ".kotlin", "xcuserdata", ".DS_Store"] for part in path.relative_to(folder).parts): continue
            name = path.relative_to(REPO).as_posix()
            native[name] = digest(path)
            destination = root / "native-inputs" / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, destination)
    stage_names = ["App.tsx", "index.ts", "geometry-identity.ts"]
    if scene == "drawing":
        shutil.copyfile(FIXTURE / "drawing-profiles.ts", STAGE / "drawing-profiles.ts")
        stage_names.append("drawing-profiles.ts")
    inputs = {"producer": producer, "profile": "card-ios-" + scene, "sourceInputs": {name: digest(REPO / name) for name in names},
        "nativeProjectInputs": native, "stageInputs": {name: digest(STAGE / name) for name in stage_names},
        "deadlineUnix": time.time() + 3600, "nativeActions": 0, "scope": "Mounted nested Card observer/clip/ref product only; no typing/GPU pixel/full Card verdict" if scene == "geometry"
            else "Displayed RN/owned drawing pairs and real-window screenshot correspondence only; no full Card/editor/input/performance verdict"}
    (root / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
    verify(root)
    print("Frozen matching UIKit Card producer", producer, len(names), "source and", len(native), "native-project inputs", flush=True)


def unchanged_native_integration_inputs(inputs, previous):
    def names(value):
        return {name for name in value["sourceInputs"] if name.startswith(("packages/react-native/ios/", "packages/react-native/cpp/", "packages/react-native/android/", "packages/react-native/src/input/specs/"))
            or name in ["packages/react-native/package.json", "packages/react-native/CodonNativeInput.podspec", "packages/react-native/react-native.config.js", "pnpm-lock.yaml", "package.json", "pnpm-workspace.yaml"]}
    native_sources = names(inputs)
    assert native_sources == names(previous), "Native integration source membership changed"
    for name in native_sources: assert inputs["sourceInputs"][name] == previous["sourceInputs"][name], name
    assert inputs["nativeProjectInputs"] == previous["nativeProjectInputs"]
    return native_sources


def reuse_pods(root, baseline):
    inputs = verify(root)
    assert not inputs.get("podsChecked") and (baseline / "SHA256.json").exists()
    for name, expected in json.loads((baseline / "SHA256.json").read_text()).items(): assert digest(baseline / name) == expected, name
    previous = json.loads((baseline / "inputs.json").read_text())
    proof = json.loads((baseline / "integration-proof.json").read_text())
    assert previous.get("podsChecked") and proof["podVersionsAndOtherLockSectionsUnchanged"] and proof["ownedMaskSourceInActualPodTarget"]
    native_sources = unchanged_native_integration_inputs(inputs, previous)
    generated = REPO / "apps/native-showcase/ios/build/generated/ios"
    assert provider_file(generated).relative_to(generated).as_posix() == proof["actualProviderPath"]
    for name, expected in proof["freshOwnedGeneratedAndProviderSHA256"].items(): assert digest(generated / name) == expected, name
    assert digest(REPO / "apps/native-showcase/ios/Pods/Pods.xcodeproj/project.pbxproj") == proof["podProjectSHA256"]
    assert digest(REPO / "apps/native-showcase/ios/Podfile.lock") == digest(baseline / "Podfile-after.lock")
    proof.update(producer=inputs["producer"], reuseBaselineProducer=previous["producer"], reuseBaselineManifestSHA256=digest(baseline / "SHA256.json"), verifiedNativeSourceInputs=len(native_sources))
    (root / "integration-proof.json").write_text(json.dumps(proof, indent=2) + "\n")
    shutil.copyfile(baseline / "Podfile-after.lock", root / "Podfile-after.lock")
    inputs["podsChecked"] = True
    (root / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
    verify(root)
    print("Reused exact native integration after", len(native_sources), "source and all project/generated/provider checks", flush=True)


def pods(root):
    inputs = verify(root)
    remaining = inputs["deadlineUnix"] - time.time()
    assert remaining > 10
    command(root, "ios-pods", [LAB / "ios-gems/bin/pod", "install", "--no-repo-update"], min(900, remaining - 10), REPO / "apps/native-showcase/ios")
    ruby = LAB / "ruby-3.4.11/bin/ruby"

    def yaml(path):
        return json.loads(subprocess.check_output([ruby, "-ryaml", "-rjson", "-e", "puts JSON.generate(YAML.safe_load(File.read(ARGV[0]), permitted_classes: [Symbol], aliases: true))", str(path)], env=environment(), text=True))

    lock_name = "apps/native-showcase/ios/Podfile.lock"
    changed = pod_changes(yaml(root / "native-inputs" / lock_name), yaml(REPO / lock_name))
    for name, expected in inputs["nativeProjectInputs"].items():
        if name != lock_name: assert digest(REPO / name) == expected, name
    generated = REPO / "apps/native-showcase/ios/build/generated/ios"
    provider = provider_file(generated)
    project = REPO / "apps/native-showcase/ios/Pods/Pods.xcodeproj/project.pbxproj"
    assert "CUIMotionMaskGeometry.mm" in project.read_text(), "The current private mask source must enter the actual Pod target"
    files = {path.relative_to(generated).as_posix(): digest(path) for path in generated.rglob("*") if path.is_file() and ("CodonNativeInputSpec" in str(path) or path == provider)}
    proof = {"producer": inputs["producer"], "onlyOwnedOrGeneratedChecksumsChanged": changed, "podVersionsAndOtherLockSectionsUnchanged": True,
        "otherNativeProjectInputsUnchanged": len(inputs["nativeProjectInputs"]) - 1, "actualProviderPath": provider.relative_to(generated).as_posix(),
        "freshOwnedGeneratedAndProviderSHA256": files, "podProjectSHA256": digest(project), "ownedMaskSourceInActualPodTarget": True, "nativeActions": 0}
    (root / "integration-proof.json").write_text(json.dumps(proof, indent=2) + "\n")
    shutil.copyfile(REPO / lock_name, root / "Podfile-after.lock")
    inputs["podsChecked"] = True
    (root / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
    verify(root)
    print("Verified actual generated provider", proof["actualProviderPath"], "and current owned mask source", flush=True)


def build(root):
    inputs = verify(root)
    assert inputs.get("podsChecked") and (root / "integration-proof.json").exists()
    remaining = inputs["deadlineUnix"] - time.time()
    assert remaining > 10
    arguments = ["/usr/bin/xcodebuild", "-jobs", "2", "-workspace", "CodonNativeShowcase.xcworkspace", "-scheme", "CodonNativeShowcase", "-configuration", "Release",
        "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", LAB / "ios-app-derived-data",
        "ARCHS=x86_64", "ONLY_ACTIVE_ARCH=YES", "CODE_SIGNING_ALLOWED=NO", "CODE_SIGNING_REQUIRED=NO", "SOURCEMAP_FILE=" + str(root / "main.jsbundle.map"), "build"]
    command(root, "ios-build", arguments, min(2700, remaining - 10), REPO / "apps/native-showcase/ios",
        extra_env={"FORCE_BUNDLING": "1", "EXTRA_PACKAGER_ARGS": "--max-workers 2", "ENTRY_FILE": str(STAGE / "index.ts")})
    verify(root)


def product(root):
    inputs = verify(root)
    assert json.loads((root / "ios-build.json").read_text())["exitCode"] == 0
    app = LAB / "ios-app-derived-data/Build/Products/Release-iphonesimulator/CodonNativeShowcase.app"
    binary = app / "CodonNativeShowcase"
    _, architecture = command(root, "product-architecture", ["/usr/bin/lipo", "-archs", binary])
    assert architecture.strip() == b"x86_64"
    _, symbols = command(root, "product-symbols", ["/usr/bin/nm", "-gU", binary])
    assert all(("_OBJC_CLASS_$_" + name).encode() in symbols for name in ["CUIFocusView", "CUIOwnedPathMaskLayer", "CUIMotionGeometryObserver"])
    code, signed = command(root, "product-unsigned", ["/usr/bin/codesign", "-dv", app], required=False)
    assert code != 0 and b"not signed" in signed
    mapping = json.loads((root / "main.jsbundle.map").read_text())
    library, fixture, react = {}, {}, set()
    for name, text in zip(mapping["sources"], mapping["sourcesContent"]):
        assert not any(marker in name for marker in ["/node_modules/react-dom/", "/node_modules/react-aria/", "/node_modules/react-aria-components/", "/node_modules/react-native-web/", "/__tests__/"]), name
        if "/node_modules/react/" in name: react.add(name.split("/node_modules/react/")[0])
        if "packages/react-native/" in name:
            relative = "packages/react-native/" + name.split("packages/react-native/", 1)[1]
            assert text is not None and hashlib.sha256(text.encode()).hexdigest() == inputs["sourceInputs"][relative], name
            library[relative] = inputs["sourceInputs"][relative]
        if ".expo/codon-card-ios-gate/" in name:
            relative = name.split(".expo/codon-card-ios-gate/", 1)[1]
            assert text is not None and hashlib.sha256(text.encode()).hexdigest() == inputs["stageInputs"][relative], name
            fixture[relative] = inputs["stageInputs"][relative]
    assert set(fixture) == set(inputs["stageInputs"]) and len(react) == 1 and "react@19.2.3" in next(iter(react))
    assert all("packages/react-native/" + name in library for name in ["src/components/Card/Card.tsx", "src/input/motionGeometry.ts", "src/motion/owner/NativeMotionOwnerHost.tsx"])
    assert not (root / app.name).exists()
    shutil.copytree(app, root / app.name, symlinks=True)
    proof = {"producer": inputs["producer"], "binarySHA256": digest(binary), "bundleSHA256": digest(app / "main.jsbundle"), "mapSHA256": digest(root / "main.jsbundle.map"),
        "appFilesSHA256": {path.relative_to(app).as_posix(): digest(path) for path in app.rglob("*") if path.is_file()},
        "ownedSourceSHA256": library, "fixtureSHA256": fixture, "reactRoots": sorted(react), "unsignedSimulator": True, "architecture": "x86_64", "nativeActions": 0, "scope": inputs["scope"]}
    (root / "ios-product.json").write_text(json.dumps(proof, indent=2) + "\n")
    print("Matching unsigned UIKit Card product", proof["binarySHA256"], "with", len(library), "exact owned modules", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "pods", "reuse-pods", "build", "product"])
    parser.add_argument("root", type=Path)
    parser.add_argument("--scene", choices=["geometry", "drawing"], default="geometry")
    parser.add_argument("--baseline", type=Path)
    arguments = parser.parse_args()
    if arguments.phase == "prepare": prepare(arguments.root.resolve(), arguments.scene)
    elif arguments.phase == "reuse-pods":
        assert arguments.baseline, "Exact sealed integration baseline required"
        reuse_pods(arguments.root.resolve(), arguments.baseline.resolve())
    else: globals()[arguments.phase](arguments.root.resolve())
