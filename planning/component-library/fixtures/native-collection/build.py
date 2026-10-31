"""Freeze and build the private metadata SDK gate. Evidence packets are data only."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import signal
import subprocess
import time
import zipfile

REPO = Path(__file__).resolve().parents[4]
FIXTURE = Path(__file__).resolve().parent
LAB = Path.home() / ".local/share/codon-native-lab"
STAGE = REPO / "apps/native-showcase/.expo/codon-collection-gate"
FIXTURE_FILES = ["App.tsx", "gate.ts", "identity.ts", "index.ts", "AuthoringApp.tsx", "authoring.ts", "authoring-index.ts", "validate_authoring.py", "test_validate_authoring.py", "validate.py", "test_validate.py", "build.py", "run.py", "FormApp.tsx", "form.ts", "form-index.ts", "validate_form.py", "test_validate_form.py", "run_form.py", "KeyboardApp.tsx", "keyboard.ts", "keyboard-index.ts", "keyboard-journal.test.ts", "KeyboardDefaultTrialTests.swift", "build_keyboard_tests.rb", "validate_keyboard.py", "test_validate_keyboard.py", "run_keyboard.py", "ResponderApp.tsx", "responder.ts", "responder-index.ts", "ResponderTrialTests.swift", "build_responder_tests.rb", "validate_responder.py", "test_validate_responder.py", "run_responder.py"]

TIME_ENTRY_FILES = ["SDKApp.tsx", "sdk.ts", "sdk-index.ts", "identity.ts", "TimeEntryTrialTests.swift", "build_sdk_tests.rb", "run_sdk.py", "validate_sdk.py", "test_validate_sdk.py"]
FIXTURE_FILES += ["../native-time-picker/" + name for name in TIME_ENTRY_FILES]


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def environment():
    result = {key: value for key, value in os.environ.items() if key in ["HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL", "LC_CTYPE", "__CF_USER_TEXT_ENCODING"]}
    result.update({"PATH": f"{LAB}/ruby-3.4.11/bin:{LAB}/ios-gems/bin:/Users/gabrielbourget/.nvm/versions/node/v24.15.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin", "CI": "1", "NODE_ENV": "production", "EXPO_OFFLINE": "1", "EXPO_NO_TELEMETRY": "1", "NPM_CONFIG_USERCONFIG": "/dev/null", "EXPO_HOME": str(LAB / "expo"), "JAVA_HOME": str(LAB / "jdk/Contents/Home"), "ANDROID_HOME": str(LAB / "sdk"), "ANDROID_SDK_ROOT": str(LAB / "sdk"), "GRADLE_USER_HOME": str(LAB / "gradle"), "ANDROID_AVD_HOME": str(LAB / "avd"), "ANDROID_USER_HOME": str(LAB / "android-user"), "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer", "GEM_HOME": str(LAB / "ios-gems"), "GEM_PATH": f"{LAB}/ios-gems:{LAB}/ruby-3.4.11/lib/ruby/gems/3.4.0", "CP_HOME_DIR": str(LAB / "cocoapods"), "COCOAPODS_DISABLE_STATS": "true"})
    return result


def command(root, name, args, cap=60, cwd=None, required=True, extra_env=None):
    log = root / (name + ".log")
    assert not log.exists(), "Never replace a recorded command: " + name
    start = time.monotonic()
    env = environment()
    env.update(extra_env or {})
    with log.open("wb") as output:
        child = subprocess.Popen(list(map(str, args)), cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        (root / (name + ".json")).write_text(json.dumps({"command": list(map(str, args)), "status": "RUNNING", "pid": child.pid, "capSeconds": cap}, indent=2) + "\n")
        print(name, "started", child.pid, "cap", cap, flush=True)
        try:
            while child.poll() is None:
                try: child.wait(timeout=min(20, max(1, cap - (time.monotonic() - start))))
                except subprocess.TimeoutExpired: print(name, "live", round(time.monotonic() - start, 1), "seconds;", log.stat().st_size, "bytes", flush=True)
                if child.poll() is None and time.monotonic() - start >= cap:
                    os.killpg(child.pid, signal.SIGTERM)
                    try: child.wait(timeout=10)
                    except subprocess.TimeoutExpired: os.killpg(child.pid, signal.SIGKILL); child.wait()
                    break
        finally:
            if child.poll() is None: os.killpg(child.pid, signal.SIGKILL); child.wait()
    result = {"command": list(map(str, args)), "exitCode": child.returncode, "seconds": round(time.monotonic() - start, 3), "logSHA256": digest(log)}
    (root / (name + ".json")).write_text(json.dumps(result, indent=2) + "\n")
    print(name, "terminal", child.returncode, "seconds", result["seconds"], flush=True)
    if required: assert child.returncode == 0, name + ": " + log.read_text(errors="replace")[-2000:]
    return child.returncode, log.read_bytes()


def verify(root):
    assert not (root / "SEALED.json").exists()
    inputs = json.loads((root / "inputs.json").read_text())
    for name, expected in inputs["sourceInputs"].items(): assert digest(REPO / name) == expected, name
    for name, expected in inputs["nativeProjectInputs"].items():
        if inputs.get("podsChecked") and name.endswith("Podfile.lock"): continue
        assert digest(REPO / name) == expected, name
    for name, expected in inputs["stageInputs"].items(): assert digest(STAGE / name) == expected, name
    return inputs


def prepare(root, profile="metadata"):
    assert not root.exists()
    assert not subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO)
    producer = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip()
    names = subprocess.check_output(["git", "ls-files", "packages/react-native", "apps/native-showcase", "planning/component-library/fixtures/native-collection", "planning/component-library/fixtures/native-time-picker", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "AGENTS.md"], cwd=REPO, text=True).splitlines()
    root.mkdir(parents=True)
    STAGE.mkdir(parents=True, exist_ok=True)
    stage_names = ["App.tsx", "gate.ts", "index.ts", "identity.ts"]
    if profile == "authoring": stage_names += ["AuthoringApp.tsx", "authoring.ts"]
    if profile == "time-entry": stage_names = ["SDKApp.tsx", "sdk.ts", "index.ts", "identity.ts"]
    if profile == "responder": stage_names = ["ResponderApp.tsx", "responder.ts", "index.ts", "identity.ts"]
    if profile == "keyboard": stage_names = ["KeyboardApp.tsx", "keyboard.ts", "index.ts", "identity.ts"]
    if profile == "form": stage_names = ["FormApp.tsx", "form.ts", "index.ts", "identity.ts"]
    for name in stage_names:
        if name == "identity.ts": continue
        source_name = ("authoring-index.ts" if profile == "authoring" else "form-index.ts" if profile == "form" else "keyboard-index.ts" if profile == "keyboard" else "responder-index.ts" if profile == "responder" else "index.ts") if name == "index.ts" else name
        if profile == "time-entry":
            source_name = "sdk-index.ts" if name == "index.ts" else name
            shutil.copyfile(FIXTURE.parent / "native-time-picker" / source_name, STAGE / name)
        else:
            shutil.copyfile(FIXTURE / source_name, STAGE / name)
    (STAGE / "identity.ts").write_text('export const SOURCE_PRODUCER = ' + json.dumps(producer) + '\n')
    native = {}
    for platform in ["android", "ios"]:
        folder = REPO / "apps/native-showcase" / platform
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or any(part in ["Pods", "build", ".gradle", ".cxx", ".kotlin", "xcuserdata", ".DS_Store"] for part in path.relative_to(folder).parts): continue
            name = path.relative_to(REPO).as_posix()
            native[name] = digest(path)
            target = root / "native-inputs" / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
    inputs = {"producer": producer, "profile": profile, "sourceInputs": {name: digest(REPO / name) for name in names}, "nativeProjectInputs": native, "fixtureInputs": {name: digest(FIXTURE / name) for name in FIXTURE_FILES}, "stageInputs": {name: digest(STAGE / name) for name in stage_names}, "deadlineUnix": time.time() + 3600, "nativeActions": 0, "scope": "Private SDK hierarchy/authoring gate; no family/installed-profile/full-goal acceptance"}
    (root / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
    entry = json.dumps(str(STAGE / "index.ts"))
    (root / "entry.gradle").write_text('gradle.beforeProject { project ->\n if (project.path == ":app") project.afterEvaluate { project.extensions.getByName("react").entryFile.set(new File(' + entry + ')) }\n}\n')
    print("Frozen", len(names), "source inputs and", len(native), "native project inputs; one60-minute build deadline", flush=True)


def prove_android(root):
    inputs = verify(root)
    source = REPO / "apps/native-showcase/android/app/build"
    apk = source / "outputs/apk/release/app-release.apk"
    bundle = source / "generated/assets/react/release/index.android.bundle"
    mapping = source / "generated/sourcemaps/react/release/index.android.bundle.map"
    with zipfile.ZipFile(apk) as archive:
        assert archive.read("assets/index.android.bundle") == bundle.read_bytes()
        dex = b"".join(archive.read(name) for name in archive.namelist() if name.startswith("classes") and name.endswith(".dex"))
        native_classes = ["CUIEditorKeyboardDefaultsModule", "CUIEditorKeyboardBindings", "CUIEditorKeyboardDefaultFrames"] if inputs.get("profile") == "keyboard" else ["CUIFormMetadataView", "CUIFormDocumentModule"] if inputs.get("profile") in ["form", "responder"] else ["CUIDateSegment", "CUIDateSegmentManager", "CUIKeyboardScope"] if inputs.get("profile") == "time-entry" else ["CUICollectionRoot", "CUICollectionNode"]
        assert all(("Lcom/codonui/input/" + name + ";").encode() in dex for name in native_classes)
    data = json.loads(mapping.read_text())
    library, fixture, react = {}, {}, set()
    for name, text in zip(data["sources"], data["sourcesContent"]):
        assert not any(part in name for part in ["/node_modules/react-dom/", "/node_modules/react-aria/", "/node_modules/react-aria-components/", "/node_modules/react-native-web/", "/__tests__/"]), name
        if "/node_modules/react/" in name: react.add(name.split("/node_modules/react/")[0])
        if "packages/react-native/" in name:
            source_name = "packages/react-native/" + name.split("packages/react-native/", 1)[1]
            assert text is not None and hashlib.sha256(text.encode()).hexdigest() == inputs["sourceInputs"][source_name]
            library[source_name] = inputs["sourceInputs"][source_name]
        if ".expo/codon-collection-gate/" in name:
            source_name = name.split(".expo/codon-collection-gate/", 1)[1]
            assert text is not None and hashlib.sha256(text.encode()).hexdigest() == inputs["stageInputs"][source_name]
            fixture[source_name] = inputs["stageInputs"][source_name]
    assert len(react) == 1 and "react@19.2.3" in next(iter(react))
    assert set(fixture) == set(inputs["stageInputs"])
    if inputs.get("profile") == "authoring":
        assert all("packages/react-native/src/collection/" + name in library for name in ["CollectionBuilder.tsx", "session.ts", "cachedChildren.tsx", "admission.ts", "snapshot.ts", "NativeCollectionMetadata.tsx"])
    artifacts = {}
    for name, path in [("app-release.apk", apk), ("index.android.bundle", bundle), ("index.android.bundle.map", mapping)]:
        shutil.copyfile(path, root / name)
        artifacts[name] = digest(path)
    proof = {"producer": inputs["producer"], "apkSHA256": digest(apk), "artifactsSHA256": artifacts, "librarySHA256": library, "fixtureSHA256": fixture, "singleReactRoot": sorted(react), "nativeActions": 0, "sourceGateOnly": True}
    (root / "android-product.json").write_text(json.dumps(proof, indent=2) + "\n")
    print("Matching private Android product", proof["apkSHA256"], flush=True)


def prove_ios(root):
    inputs = verify(root)
    app = LAB / "ios-app-derived-data/Build/Products/Release-iphonesimulator/CodonNativeShowcase.app"
    binary, bundle, mapping = app / "CodonNativeShowcase", app / "main.jsbundle", root / "ios-main.jsbundle.map"
    data = json.loads(mapping.read_text()); library, fixture, react = {}, {}, set()
    for name, text in zip(data["sources"], data["sourcesContent"]):
        assert not any(part in name for part in ["/node_modules/react-dom/", "/node_modules/react-aria/", "/node_modules/react-aria-components/", "/node_modules/react-native-web/", "/__tests__/"]), name
        if "/node_modules/react/" in name: react.add(name.split("/node_modules/react/")[0])
        if "packages/react-native/" in name:
            source_name = "packages/react-native/" + name.split("packages/react-native/", 1)[1]
            assert text is not None and hashlib.sha256(text.encode()).hexdigest() == inputs["sourceInputs"][source_name]
            library[source_name] = inputs["sourceInputs"][source_name]
        if ".expo/codon-collection-gate/" in name:
            source_name = name.split(".expo/codon-collection-gate/", 1)[1]
            assert text is not None and hashlib.sha256(text.encode()).hexdigest() == inputs["stageInputs"][source_name]
            fixture[source_name] = inputs["stageInputs"][source_name]
    assert len(react) == 1 and "react@19.2.3" in next(iter(react))
    assert set(fixture) == set(inputs["stageInputs"])
    classes = ["CUIFormRoot", "CUIFieldBinding", "CUIFormMetadataView", "CUIFormDocument", "CUIFieldCustomContentLease"]
    if inputs.get("profile") == "keyboard": classes += ["CUIEditorKeyboardDefaults", "CUIEditorKeyboardRecognizer"]
    if inputs.get("profile") == "time-entry": classes += ["CUIDateSegment", "CUIKeyboardScope"]
    symbols = subprocess.check_output(["/usr/bin/nm", "-gU", str(binary)], text=True)
    assert all("_OBJC_CLASS_$_" + name in symbols for name in classes)
    assert "x86_64" in subprocess.check_output(["/usr/bin/file", str(binary)], text=True)
    signed = subprocess.run(["/usr/bin/codesign", "-dv", str(app)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    assert signed.returncode != 0 and b"not signed" in signed.stdout
    (root / "ios-signature.txt").write_bytes(signed.stdout)
    artifacts = {}
    for name, source in [("ios-binary", binary), ("ios-main.jsbundle", bundle)]:
        shutil.copyfile(source, root / name); artifacts[name] = digest(source)
    archive = root / "ios-app.zip"
    command(root, "ios-archive", ["/usr/bin/ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", app, archive], 180)
    artifacts[archive.name] = digest(archive)
    proof = {"producer":inputs["producer"], "binarySHA256":digest(binary), "bundleSHA256":digest(bundle), "artifactsSHA256":artifacts, "librarySHA256":library, "fixtureSHA256":fixture, "singleReactRoot":sorted(react), "nativeClasses":classes, "unsignedSimulator":True, "architecture":"x86_64", "nativeActions":0, "sourceGateOnly":True, "bundleFilesSHA256":{path.relative_to(app).as_posix():digest(path) for path in sorted(app.rglob("*")) if path.is_file()}}
    (root / "ios-product.json").write_text(json.dumps(proof, indent=2) + "\n")
    print("Matching private iOS product", proof["binarySHA256"], flush=True)


def ios(root):
    inputs = verify(root)
    assert inputs["profile"] in ["form", "keyboard", "responder", "time-entry"] and time.time() < inputs["deadlineUnix"]
    lock = REPO / "apps/native-showcase/ios/Podfile.lock"
    ruby = LAB / "ruby-3.4.11/bin/ruby"
    def pod_lock(path):
        return json.loads(subprocess.check_output([ruby, "-ryaml", "-rjson", "-e", "puts JSON.generate(YAML.safe_load(File.read(ARGV[0]), permitted_classes: [Symbol], aliases: true))", str(path)], env=environment(), text=True))
    before = pod_lock(lock)
    command(root, "ios-pods", [LAB / "ios-gems/bin/pod", "install", "--no-repo-update"], min(900, int(inputs["deadlineUnix"] - time.time())), REPO / "apps/native-showcase/ios")
    after = pod_lock(lock); expected = json.loads(json.dumps(before))
    changed = [key for key in after["SPEC CHECKSUMS"] if after["SPEC CHECKSUMS"][key] != before["SPEC CHECKSUMS"].get(key)]
    assert set(changed) <= {"CodonNativeInput", "ReactCodegen", "ReactAppDependencyProvider"}, changed
    for key in changed: expected["SPEC CHECKSUMS"][key] = after["SPEC CHECKSUMS"][key]
    assert expected == after, "Pinned Pod versions/other lock sections changed"
    inputs["podsChecked"] = True
    (root / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n")
    (root / "ios-Podfile.lock").write_bytes(lock.read_bytes())
    verify(root)
    generated = REPO / "apps/native-showcase/ios/build/generated/ios/ReactCodegen/RCTThirdPartyComponentsProvider.mm"
    assert all(name in generated.read_text() for name in ["CUIFormRoot", "CUIFieldBinding"])
    project = REPO / "apps/native-showcase/ios/Pods/Pods.xcodeproj/project.pbxproj"
    assert "CUIFormDocumentInspection.mm" in project.read_text()
    if inputs["profile"] == "keyboard":
        assert all(name in project.read_text() for name in ["CUIEditorKeyboardDefaults.mm", "CUIEditorKeyboardRecognizer.mm", "CUIEditorKeyboardDefaultRegistry.cpp"])
    (root / "ios-integration.json").write_text(json.dumps({"producer":inputs["producer"], "ownedChecksumChanges":changed, "allPinnedVersionsUnchanged":True, "actualInspectionUnitIncluded":True, "providerSHA256":digest(generated)}, indent=2) + "\n")
    extra = {"ENTRY_FILE":str(STAGE / "index.ts"), "FORCE_BUNDLING":"1", "EXTRA_PACKAGER_ARGS":"--max-workers 2"}
    command(root, "ios-build", ["/usr/bin/xcodebuild", "-jobs", "2", "-workspace", "CodonNativeShowcase.xcworkspace", "-scheme", "CodonNativeShowcase", "-configuration", "Release", "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", LAB / "ios-app-derived-data", "ARCHS=x86_64", "ONLY_ACTIVE_ARCH=YES", "CODE_SIGNING_ALLOWED=NO", "CODE_SIGNING_REQUIRED=NO", "SOURCEMAP_FILE=" + str(root / "ios-main.jsbundle.map"), "build"], min(2700, int(inputs["deadlineUnix"] - time.time())), REPO / "apps/native-showcase/ios", extra_env=extra)
    prove_ios(root)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "android", "prove-android", "ios", "prove-ios"])
    parser.add_argument("root", type=Path)
    parser.add_argument("--profile", choices=["metadata", "authoring", "form", "keyboard", "responder", "time-entry"], default="metadata")
    args = parser.parse_args()
    root = args.root.resolve()
    if args.phase == "prepare": prepare(root, args.profile)
    elif args.phase == "prove-android": prove_android(root)
    elif args.phase == "prove-ios": prove_ios(root)
    elif args.phase == "ios": ios(root)
    else:
        inputs = verify(root)
        assert time.time() < inputs["deadlineUnix"]
        command(root, "android-build", ["./gradlew", "--init-script", root / "entry.gradle", ":app:createBundleReleaseJsAndAssets", "--rerun", ":app:assembleRelease", "-PreactNativeArchitectures=x86_64", "--offline", "--no-daemon", "--max-workers=2", "--console=plain"], min(1800, int(inputs["deadlineUnix"] - time.time())), REPO / "apps/native-showcase/android")
        prove_android(root)


if __name__ == "__main__":
    main()
