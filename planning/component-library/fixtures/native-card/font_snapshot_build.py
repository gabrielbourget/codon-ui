"""Freeze one non-shipping Android font product; execute only outside sealed evidence."""
from pathlib import Path
import argparse
import importlib
import json
import shutil
import subprocess
import sys
import time
import zipfile

REPO = Path(__file__).resolve().parents[4]
FIXTURE = Path(__file__).resolve().parent
COLLECTION = FIXTURE.parent / "native-collection"
sys.path.insert(0, str(COLLECTION))
build = importlib.import_module("build")
NATIVE = ["NativeIntrinsicAndroidAssertions.java", "NativeFontSnapshotAndroidAssertions.java", "FontSnapshotActivity.java", "FontSnapshotIdentity.java"]


def verify(root):
    inputs = build.verify(root)
    for name, digest in inputs["nativeFixtureInputs"].items():
        assert build.digest(build.STAGE / name) == digest, name
    return inputs


def prepare(root):
    assert not root.exists()
    assert not subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO)
    producer = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip()
    names = subprocess.check_output(["git", "ls-files", "packages/react-native", "apps/native-showcase", "planning/component-library/fixtures/native-card", "planning/component-library/fixtures/native-collection", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "AGENTS.md"], cwd=REPO, text=True).splitlines()
    root.mkdir(parents=True)
    stage = build.STAGE
    stage.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(FIXTURE / "CardCallbackApp.tsx", stage / "App.tsx")
    (stage / "index.ts").write_text((FIXTURE / "callback-index.ts").read_text().replace('"./CardCallbackApp"', '"./App"'))
    (stage / "callback-identity.ts").write_text("export const SOURCE_PRODUCER = " + json.dumps(producer) + "\n")
    native_stage = stage / "font-native"
    native_stage.mkdir(exist_ok=True)
    for name in NATIVE:
        text = (FIXTURE / name).read_text()
        if name == "FontSnapshotIdentity.java": text = text.replace('"UNFROZEN"', json.dumps(producer))
        (native_stage / name).write_text(text)
    native = {}
    for platform in ["android", "ios"]:
        folder = REPO / "apps/native-showcase" / platform
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or any(part in ["Pods", "build", ".gradle", ".cxx", ".kotlin", "xcuserdata", ".DS_Store"] for part in path.relative_to(folder).parts): continue
            name = path.relative_to(REPO).as_posix()
            native[name] = build.digest(path)
            target = root / "native-inputs" / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
    manifest = REPO / "apps/native-showcase/android/app/src/main/AndroidManifest.xml"
    (native_stage / "AndroidManifest.xml").write_text(manifest.read_text().replace("</application>", '<activity android:name="com.codonui.input.FontSnapshotActivity" android:exported="true"/></application>'))
    native_files = ["font-native/" + name for name in [*NATIVE, "AndroidManifest.xml"]]
    inputs = {"producer": producer, "profile": "font-snapshot", "sourceInputs": {name: build.digest(REPO / name) for name in names}, "nativeProjectInputs": native, "stageInputs": {name: build.digest(stage / name) for name in ["App.tsx", "index.ts", "callback-identity.ts"]}, "nativeFixtureInputs": {name: build.digest(stage / name) for name in native_files}, "nativeActivity": "com.codonui.input.FontSnapshotActivity", "deadlineUnix": time.time() + 3600, "nativeActions": 0, "scope": "Actual isolated native font span/cache/layout gate; no full Card/editor/physical/profile acceptance"}
    (root / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
    (root / "entry.gradle").write_text('gradle.beforeProject { project ->\n if (project.path == ":app") project.afterEvaluate {\n project.extensions.getByName("react").entryFile.set(new File(' + json.dumps(str(stage / "index.ts")) + '))\n project.android.sourceSets.main.java.srcDir(' + json.dumps(str(native_stage)) + ')\n project.android.sourceSets.main.manifest.srcFile(' + json.dumps(str(native_stage / "AndroidManifest.xml")) + ')\n }\n}\n')
    print("Frozen", producer, len(names), "source inputs,", len(native), "native project inputs and", len(native_files), "non-shipping native fixture inputs", flush=True)


def android(root):
    inputs = verify(root)
    assert time.time() < inputs["deadlineUnix"]
    build.command(root, "android-build", ["./gradlew", "--init-script", root / "entry.gradle", ":app:createBundleReleaseJsAndAssets", "--rerun", ":app:assembleRelease", "-PreactNativeArchitectures=x86_64", "--offline", "--no-daemon", "--max-workers=2", "--console=plain"], min(1800, int(inputs["deadlineUnix"] - time.time())), REPO / "apps/native-showcase/android")
    verify(root)
    build.prove_android(root)
    with zipfile.ZipFile(root / "app-release.apk") as archive:
        dex = b"".join(archive.read(name) for name in archive.namelist() if name.startswith("classes") and name.endswith(".dex"))
        for name in ["CUIMotionFontSnapshot", "FontSnapshotActivity", "NativeFontSnapshotAndroidAssertions"]:
            assert ("Lcom/codonui/input/" + name + ";").encode() in dex
        for name in ["fontCache", "customTypefaceCache", "typefaceSparseArray", "assetManager", "privateStyle", "privateWeight"]:
            assert name.encode() in dex
    shutil.copytree(build.STAGE / "font-native", root / "frozen-native-fixture")
    print("Actual Release contains the font producer and non-shipping assertions; native execution must resolve all six exact descriptors", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "android"])
    parser.add_argument("root", type=Path)
    arguments = parser.parse_args()
    (prepare if arguments.phase == "prepare" else android)(arguments.root.resolve())
