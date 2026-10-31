"""Freeze the mounted Card/editor scene with non-shipping public-SDK inspections."""
from pathlib import Path
import argparse
import json
import shutil

import font_snapshot_build as base


def prepare(root):
    base.prepare(root)
    stage = base.build.STAGE
    shutil.copyfile(base.FIXTURE / "CardEditorApp.tsx", stage / "App.tsx")
    (stage / "index.ts").write_text((base.FIXTURE / "editor-index.ts").read_text().replace('"./CardEditorApp"', '"./App"'))
    native = stage / "font-native"
    shutil.copyfile(base.FIXTURE / "CardEditorInspectionProvider.java", native / "CardEditorInspectionProvider.java")
    manifest = native / "AndroidManifest.xml"
    manifest.write_text(manifest.read_text().replace("</application>", '<provider android:name="com.codonui.input.CardEditorInspectionProvider" android:authorities="dev.codonui.showcase.card-editor-inspection" android:exported="false"/>' + '<receiver android:name="com.codonui.input.CardEditorInspectionProvider$Receiver" android:exported="true"/></application>'))
    inputs = json.loads((root / "inputs.json").read_text())
    inputs.update({"profile": "card-editor", "nativeActivity": "dev.codonui.showcase.MainActivity", "scope": "Actual mounted Card isolated cached-editor queries joined to public SDK held-editor observations; no full Card/profile/closure acceptance"})
    inputs["stageInputs"] = {name: base.build.digest(stage / name) for name in inputs["stageInputs"]}
    inputs["nativeFixtureInputs"]["font-native/CardEditorInspectionProvider.java"] = base.build.digest(native / "CardEditorInspectionProvider.java")
    inputs["nativeFixtureInputs"] = {name: base.build.digest(stage / name) for name in inputs["nativeFixtureInputs"]}
    (root / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
    base.verify(root)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "android"])
    parser.add_argument("root", type=Path)
    arguments = parser.parse_args()
    (prepare if arguments.phase == "prepare" else base.android)(arguments.root.resolve())
