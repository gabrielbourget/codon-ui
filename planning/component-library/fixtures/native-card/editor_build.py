"""Freeze the mounted Card/editor scene with non-shipping public-SDK inspections."""
from pathlib import Path
import argparse
import json
import shutil
import time
import zipfile

import font_snapshot_build as base


def _java_block(source, declaration):
    start = source.index(declaration)
    opening = source.index("{", start)
    depth = 1
    for end in range(opening + 1, len(source)):
        depth += (source[end] == "{") - (source[end] == "}")
        if not depth:
            return source[start:end + 1]
    raise AssertionError("Incomplete Java source block: " + declaration)


def _write_editor_native_fixture(native, producer):
    if native.exists(): shutil.rmtree(native)
    native.mkdir()
    shutil.copyfile(base.FIXTURE / "CardEditorInspectionProvider.java", native / "CardEditorInspectionProvider.java")
    identity = (base.FIXTURE / "FontSnapshotIdentity.java").read_text()
    (native / "FontSnapshotIdentity.java").write_text(identity.replace('"UNFROZEN"', json.dumps(producer)))
    source = (base.FIXTURE / "NativeFontSnapshotAndroidAssertions.java").read_text()
    # The editor invokes only this cache observer, not the retired font-copy experiment.
    blocks = [_java_block(source, declaration) for declaration in [
        "private static void require(", "private static Object read(", "static final class Cache {",
    ]]
    imports = ["android.util.SparseArray", "com.facebook.react.common.assets.ReactFontManager",
        "java.lang.reflect.Field", "java.util.IdentityHashMap", "java.util.LinkedHashMap", "java.util.Map"]
    cache = "package com.codonui.input;\n\n" + "\n".join("import " + name + ";" for name in imports)
    cache += "\n\n// Exact cache-observer bodies from the retained font fixture; no font-copy API.\n"
    cache += "public final class NativeFontSnapshotAndroidAssertions {\n  private static int assertions;\n"
    (native / "NativeFontSnapshotAndroidAssertions.java").write_text(cache + "\n".join(blocks) + "\n}\n")
    manifest = native / "AndroidManifest.xml"
    original_manifest = base.build.REPO / "apps/native-showcase/android/app/src/main/AndroidManifest.xml"
    manifest.write_text(original_manifest.read_text().replace("</application>", '<provider android:name="com.codonui.input.CardEditorInspectionProvider" android:authorities="dev.codonui.showcase.card-editor-inspection" android:exported="false"/>' + '<receiver android:name="com.codonui.input.CardEditorInspectionProvider$Receiver" android:exported="true"/></application>'))


def prepare(root):
    base.prepare(root)
    stage = base.build.STAGE
    shutil.copyfile(base.FIXTURE / "CardEditorApp.tsx", stage / "App.tsx")
    (stage / "index.ts").write_text((base.FIXTURE / "editor-index.ts").read_text().replace('"./CardEditorApp"', '"./App"'))
    native = stage / "font-native"
    inputs = json.loads((root / "inputs.json").read_text())
    _write_editor_native_fixture(native, inputs["producer"])
    inputs.update({"profile": "card-editor", "nativeActivity": "dev.codonui.showcase.MainActivity", "scope": "Actual mounted Card isolated cached-editor queries joined to public SDK held-editor observations; no full Card/profile/closure acceptance"})
    inputs["stageInputs"] = {name: base.build.digest(stage / name) for name in inputs["stageInputs"]}
    inputs["nativeFixtureInputs"] = {"font-native/" + name: base.build.digest(native / name) for name in ["CardEditorInspectionProvider.java", "FontSnapshotIdentity.java", "NativeFontSnapshotAndroidAssertions.java", "AndroidManifest.xml"]}
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
