"""Freeze the mounted Card/editor scene with non-shipping public-SDK inspections."""
from pathlib import Path
import argparse
import json
import shutil
import time
import zipfile

import font_snapshot_build as base


def prepare(root):
    base.prepare(root)
    stage = base.build.STAGE
    shutil.copyfile(base.FIXTURE / "CardEditorApp.tsx", stage / "App.tsx")
    (stage / "index.ts").write_text((base.FIXTURE / "editor-index.ts").read_text().replace('"./CardEditorApp"', '"./App"'))
    native = stage / "font-native"
    # This probe owns SDK editor observations; the separate font prototype is not part of its product.
    shutil.rmtree(native)
    native.mkdir()
    shutil.copyfile(base.FIXTURE / "CardEditorInspectionProvider.java", native / "CardEditorInspectionProvider.java")
    manifest = native / "AndroidManifest.xml"
    original_manifest = base.build.REPO / "apps/native-showcase/android/app/src/main/AndroidManifest.xml"
    manifest.write_text(original_manifest.read_text().replace("</application>", '<provider android:name="com.codonui.input.CardEditorInspectionProvider" android:authorities="dev.codonui.showcase.card-editor-inspection" android:exported="false"/>' + '<receiver android:name="com.codonui.input.CardEditorInspectionProvider$Receiver" android:exported="true"/></application>'))
    inputs = json.loads((root / "inputs.json").read_text())
    inputs.update({"profile": "card-editor", "nativeActivity": "dev.codonui.showcase.MainActivity", "scope": "Actual mounted Card isolated cached-editor queries joined to public SDK held-editor observations; no full Card/profile/closure acceptance"})
    inputs["stageInputs"] = {name: base.build.digest(stage / name) for name in inputs["stageInputs"]}
    inputs["nativeFixtureInputs"] = {"font-native/" + name: base.build.digest(native / name) for name in ["CardEditorInspectionProvider.java", "AndroidManifest.xml"]}
    (root / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
    base.verify(root)


def android(root):
    inputs = base.verify(root)
    assert time.time() < inputs["deadlineUnix"], "Card/editor build deadline consumed"
    base.build.command(root, "android-build", ["./gradlew", "--init-script", root / "entry.gradle", ":app:createBundleReleaseJsAndAssets", "--rerun", ":app:assembleRelease", "-PreactNativeArchitectures=x86_64", "--offline", "--no-daemon", "--max-workers=2", "--console=plain"], min(1200, int(inputs["deadlineUnix"] - time.time())), base.build.REPO / "apps/native-showcase/android")
    base.verify(root)
    base.build.prove_android(root)
    with zipfile.ZipFile(root / "app-release.apk") as archive:
        dex = b"".join(archive.read(name) for name in archive.namelist() if name.startswith("classes") and name.endswith(".dex"))
        for name in ["CardEditorInspectionProvider", "CardEditorInspectionProvider$Receiver", "CUIMotionIntrinsics", "CUIMotionFontSnapshot"]:
            assert ("Lcom/codonui/input/" + name + ";").encode() in dex
    shutil.copytree(base.build.STAGE / "font-native", root / "frozen-native-fixture")
    print("Release contains the existing Card/editor SDK provider and live Motion intrinsic/font services; no font-prototype qualification", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "android"])
    parser.add_argument("root", type=Path)
    arguments = parser.parse_args()
    (prepare if arguments.phase == "prepare" else android)(arguments.root.resolve())
