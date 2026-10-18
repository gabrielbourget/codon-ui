"""Build an explicit private Menu focus entry without editing native projects."""
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
EVIDENCE = Path.home() / ".codex/visualizations/2026/10/16/01a142c2-0db7-7d31-aa1f-53e3773a7870/native-library-construction-2026-10-17"
BASELINE = EVIDENCE / "native-menu-release-ff0d092"
STAGE = REPO / "apps/native-showcase/.expo/codon-menu-focus"
STAGED_FILES = ["App.tsx", "index.ts", "phases.json", "receipt.ts"]


def digest(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def environment():
    result = {key: value for key, value in os.environ.items() if key in ["HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL", "__CF_USER_TEXT_ENCODING"]}
    result.update({"PATH": f"{LAB}/ruby-3.4.11/bin:{LAB}/ios-gems/bin:/Users/gabrielbourget/.nvm/versions/node/v24.15.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin", "CI": "1", "NODE_ENV": "production", "EXPO_OFFLINE": "1", "EXPO_NO_TELEMETRY": "1", "EXPO_HOME": str(LAB / "expo"), "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer", "JAVA_HOME": str(LAB / "jdk/Contents/Home"), "ANDROID_HOME": str(LAB / "sdk"), "ANDROID_SDK_ROOT": str(LAB / "sdk"), "GRADLE_USER_HOME": str(LAB / "gradle"), "GEM_HOME": str(LAB / "ios-gems"), "GEM_PATH": f"{LAB}/ios-gems:{LAB}/ruby-3.4.11/lib/ruby/gems/3.4.0", "CP_HOME_DIR": str(LAB / "cocoapods"), "COCOAPODS_DISABLE_STATS": "true"})
    return result


def verify_inputs(root):
    inputs = json.loads((root / "inputs.json").read_text())
    for name, checksum in inputs["libraryInputs"].items():
        assert digest(REPO / name) == checksum, name
    for name, checksum in inputs["nativeProjectInputs"].items():
        assert digest(REPO / name) == checksum, name
    for name, checksum in inputs["fixtureInputs"].items():
        assert digest(FIXTURE / name) == checksum, name
    for name in STAGED_FILES:
        assert digest(STAGE / name) == inputs["fixtureInputs"][name], name
    return inputs


def prepare(root):
    assert not root.exists(), "Use a fresh evidence root"
    assert not subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO)
    assert (BASELINE / "SEALED").exists()
    assert digest(BASELINE / "SHA256SUMS") == "701acf3bcb47fa2148a715da16d5bac82e20405a6480001199fee4cf2722df56"
    for line in (BASELINE / "SHA256SUMS").read_text().splitlines():
        checksum, name = line.split("  ", 1)
        assert digest(BASELINE / name) == checksum, name
    old = json.loads((BASELINE / "inputs.json").read_text())
    configuration = json.loads((FIXTURE / "phases.json").read_text())
    root.mkdir(parents=True)
    library = {}
    for name in old["sourceInputsSHA256"]:
        content = subprocess.check_output(["git", "show", configuration["libraryProducer"] + ":" + name], cwd=REPO)
        assert (REPO / name).read_bytes() == content, name
        destination = root / "library-source" / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        library[name] = hashlib.sha256(content).hexdigest()
        if name.startswith(("packages/react-native/ios/", "packages/react-native/android/", "packages/react-native/src/input/specs/")) or name.endswith(("CodonNativeInput.podspec", "react-native.config.js", "pnpm-lock.yaml")):
            assert library[name] == old["sourceInputsSHA256"][name], name
    for name, checksum in old["nativeProjectInputsSHA256"].items():
        assert digest(REPO / name) == checksum, name
    STAGE.mkdir(parents=True, exist_ok=True)
    for name in STAGED_FILES:
        shutil.copy2(FIXTURE / name, STAGE / name)
    fixture_inputs = {path.name: digest(path) for path in FIXTURE.iterdir() if path.is_file()}
    for path in FIXTURE.iterdir():
        if path.is_file():
            destination = root / "fixture-source" / path.name
            destination.parent.mkdir(exist_ok=True)
            shutil.copy2(path, destination)
    data = {"fixtureProducer": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(), "libraryProducer": configuration["libraryProducer"], "libraryInputs": library, "nativeProjectInputs": old["nativeProjectInputsSHA256"], "fixtureInputs": fixture_inputs, "baselineRelease": str(BASELINE), "baselineManifestSHA256": digest(BASELINE / "SHA256SUMS"), "stage": str(STAGE), "deadlineUnix": time.time() + 3600, "installedActions": 0, "nativeScope": "Existing native focus callbacks and inspector; native implementation/schema/dependencies unchanged. Four P01 focus forms per platform only."}
    (root / "inputs.json").write_text(json.dumps(data, indent=2) + "\n")
    entry = json.dumps(str(STAGE / "index.ts"))
    (root / "entry.gradle").write_text('gradle.beforeProject { project ->\n  if (project.path == ":app") {\n    project.afterEvaluate {\n      project.extensions.getByName("react").entryFile.set(new File(' + entry + '))\n    }\n  }\n}\n')
    verify_inputs(root)
    print("Frozen Menu focus fixture/current library and byte-matching native inputs; no guest actions", flush=True)


def build(root, platform):
    inputs = verify_inputs(root)
    record_path = root / "builds.json"
    records = json.loads(record_path.read_text()) if record_path.exists() else {}
    assert platform not in records, "Never silently restart a recorded build"
    env = environment()
    if platform == "android":
        command = ["./gradlew", "--init-script", str(root / "entry.gradle"), ":app:createBundleReleaseJsAndAssets", "--rerun", ":app:assembleRelease", "-PreactNativeArchitectures=x86_64", "--offline", "--no-daemon", "--max-workers=2", "--console=plain"]
        cwd, cap = REPO / "apps/native-showcase/android", 1800
    else:
        compose = REPO / "apps/native-showcase/node_modules/react-native/scripts/compose-source-maps.js"
        wrapper = root / "capture-compose.cjs"
        wrapper.write_text('const fs = require("node:fs")\nconst cp = require("node:child_process")\nfs.copyFileSync(process.argv[2], ' + json.dumps(str(root / "ios.packager.map")) + ')\ncp.execFileSync(process.execPath, [' + json.dumps(str(compose)) + ', ...process.argv.slice(2)], { stdio: "inherit" })\n')
        env.update({"ENTRY_FILE": str(STAGE / "index.ts"), "FORCE_BUNDLING": "1", "EXTRA_PACKAGER_ARGS": "--max-workers 2", "COMPOSE_SOURCEMAP_PATH": str(wrapper)})
        (root / "ios-compose-inputs.json").write_text(json.dumps({"wrapperSHA256": digest(wrapper), "upstreamComposeSHA256": digest(compose)}, indent=2) + "\n")
        command = ["/usr/bin/xcodebuild", "-jobs", "2", "-workspace", "CodonNativeShowcase.xcworkspace", "-scheme", "CodonNativeShowcase", "-configuration", "Release", "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", str(LAB / "ios-app-derived-data"), "ARCHS=x86_64", "ONLY_ACTIVE_ARCH=YES", "CODE_SIGNING_ALLOWED=NO", "CODE_SIGNING_REQUIRED=NO", "SOURCEMAP_FILE=" + str(root / "ios.map"), "build"]
        cwd, cap = REPO / "apps/native-showcase/ios", 2700
    cap = min(cap, max(1, int(inputs["deadlineUnix"] - time.time())))
    log_path = root / (platform + "-build.log")
    start, timed_out = time.monotonic(), False
    with log_path.open("wb") as log:
        process = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        records[platform] = {"command": command, "pid": process.pid, "capSeconds": cap, "status": "RUNNING"}
        record_path.write_text(json.dumps(records, indent=2) + "\n")
        print(platform, "build PID", process.pid, "cap", cap, flush=True)
        notice = start + 20
        while process.poll() is None:
            now = time.monotonic()
            if now >= notice:
                print(platform, "confirmed live", round(now - start, 1), "seconds;", log_path.stat().st_size, "log bytes", flush=True)
                notice = now + 20
            if now - start > cap:
                timed_out = True
                os.killpg(process.pid, signal.SIGINT)
                try:
                    process.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                break
            time.sleep(1)
        code = process.wait()
    records[platform].update({"exitCode": code, "status": "PASS" if code == 0 else "FAIL", "timedOut": timed_out, "durationSeconds": round(time.monotonic() - start, 3), "logSHA256": digest(log_path)})
    record_path.write_text(json.dumps(records, indent=2) + "\n")
    print(platform, "build terminal", code, flush=True)
    assert code == 0, log_path.read_text()[-4000:]
    prove(root, platform)


def prove(root, platform):
    inputs = verify_inputs(root)
    target = root / "products" / platform
    target.mkdir(parents=True, exist_ok=True)
    assert not (target / "proof.json").exists(), "Do not replace a completed product proof"
    if platform == "android":
        app = REPO / "apps/native-showcase/android/app/build/outputs/apk/release/app-release.apk"
        mapping = REPO / "apps/native-showcase/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map"
        baseline = BASELINE / "artifacts/android/app-release.apk"
        with zipfile.ZipFile(app) as current, zipfile.ZipFile(baseline) as old:
            native = [name for name in old.namelist() if name.endswith(".dex") or (name.startswith("lib/x86_64/") and name.endswith(".so"))]
            assert native and all(current.read(name) == old.read(name) for name in native), "Native code differs from CP-51"
        shutil.copy2(app, target / "observer.apk")
        product = target / "observer.apk"
    else:
        app = LAB / "ios-app-derived-data/Build/Products/Release-iphonesimulator/CodonNativeShowcase.app"
        assert digest(app / "CodonNativeShowcase") == digest(BASELINE / "artifacts/ios/CodonNativeShowcase"), "Native executable differs from CP-51"
        signature = subprocess.run(["/usr/bin/codesign", "-dv", str(app)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        assert signature.returncode != 0 and b"not signed" in signature.stdout
        shutil.copytree(app, target / "CodonNativeShowcase.app", dirs_exist_ok=True)
        product, mapping = target / "CodonNativeShowcase.app/CodonNativeShowcase", root / "ios.map"
    data = json.loads(mapping.read_text())
    library, fixture, react = {}, {}, set()
    banned = ["/node_modules/react-dom/", "/node_modules/react-native-web/", "/node_modules/react-aria/", "/packages/react/", "/__tests__/"]
    for source, content in zip(data["sources"], data["sourcesContent"]):
        assert not any(part in source for part in banned), source
        if "/node_modules/react/" in source:
            react.add(source.split("/node_modules/react/")[0])
        if "packages/react-native/" in source:
            name = "packages/react-native/" + source.split("packages/react-native/", 1)[1]
            assert content is not None and hashlib.sha256(content.encode()).hexdigest() == inputs["libraryInputs"][name], source
            library[name] = inputs["libraryInputs"][name]
        if ".expo/codon-menu-focus/" in source:
            name = source.split(".expo/codon-menu-focus/", 1)[1]
            assert content is not None and hashlib.sha256(content.encode()).hexdigest() == inputs["fixtureInputs"][name], source
            fixture[name] = inputs["fixtureInputs"][name]
    assert len(react) == 1 and "react@19.2.3" in next(iter(react)), react
    assert {"App.tsx", "index.ts", "receipt.ts"} <= fixture.keys(), fixture
    compiler_input_map = REPO / "apps/native-showcase/android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map" if platform == "android" else root / "ios.packager.map"
    compiler_input = json.loads(compiler_input_map.read_text())
    json_inputs = {}
    for source, content in zip(compiler_input["sources"], compiler_input["sourcesContent"]):
        if ".expo/codon-menu-focus/" in source:
            name = source.split(".expo/codon-menu-focus/", 1)[1]
            assert content is not None and hashlib.sha256(content.encode()).hexdigest() == inputs["fixtureInputs"][name], source
            json_inputs[name] = inputs["fixtureInputs"][name]
    assert set(STAGED_FILES) <= json_inputs.keys(), json_inputs
    shutil.copy2(compiler_input_map, target / "packager.map")
    for family in ["Menu/Menu.tsx", "Menu/MenuItem.tsx", "Menu/model.ts"]:
        assert "packages/react-native/src/components/" + family in library
    shutil.copy2(mapping, target / "bundle.map")
    (target / "proof.json").write_text(json.dumps({"platform": platform, "productSHA256": digest(product), "mapSHA256": digest(mapping), "nativeCodeByteMatchesCP51": True, "unsignedSimulator": platform == "ios", "librarySHA256": library, "fixtureSHA256": json_inputs, "composedMapFixtureSHA256": fixture, "compilerInputMapSHA256": digest(compiler_input_map), "reactRoots": sorted(react), "installedActions": 0}, indent=2) + "\n")
    print(platform, "private-entry product verified; native code matches CP-51; library modules", len(library), flush=True)



if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "android", "ios", "prove-android", "prove-ios"])
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    assert not any((parent / "SEALED").exists() or (parent / "SEALED.json").exists() for parent in [args.output, *args.output.parents])
    if args.phase == "prepare":
        prepare(args.output)
    elif args.phase.startswith("prove-"):
        prove(args.output, args.phase.removeprefix("prove-"))
    else:
        build(args.output, args.phase)
