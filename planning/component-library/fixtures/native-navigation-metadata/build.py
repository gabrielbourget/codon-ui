"""Build an explicit non-shipping observer entry without editing native projects."""
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
BASELINE = EVIDENCE / "native-navigation-release-f86d8a6"
STAGE = REPO / "apps/native-showcase/.expo/codon-navigation-observer"


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
    for name in ["App.tsx", "index.ts", "phases.json"]:
        assert digest(STAGE / name) == inputs["fixtureInputs"][name], name
    return inputs


def prepare(root):
    assert not root.exists(), "Use a fresh evidence root"
    assert not subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO)
    assert (BASELINE / "SEALED").exists()
    for line in (BASELINE / "SHA256SUMS").read_text().splitlines():
        checksum, name = line.split("  ", 1)
        assert digest(BASELINE / name) == checksum, name
    old = json.loads((BASELINE / "inputs.json").read_text())
    root.mkdir(parents=True)
    STAGE.mkdir(parents=True, exist_ok=True)
    for name in ["App.tsx", "index.ts", "phases.json"]:
        shutil.copy2(FIXTURE / name, STAGE / name)
    fixture_inputs = {path.name: digest(path) for path in FIXTURE.iterdir() if path.is_file()}
    for path in FIXTURE.iterdir():
        if path.is_file():
            target = root / "fixture-source" / path.name
            target.parent.mkdir(exist_ok=True)
            shutil.copy2(path, target)
    data = {"fixtureProducer": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(), "libraryProducer": old["producer"], "libraryInputs": old["sourceInputsSHA256"], "nativeProjectInputs": old["nativeProjectInputsSHA256"], "fixtureInputs": fixture_inputs, "baselineRelease": str(BASELINE), "baselineManifestSHA256": digest(BASELINE / "SHA256SUMS"), "stage": str(STAGE), "deadlineUnix": time.time() + 3600, "installedActions": 0}
    (root / "inputs.json").write_text(json.dumps(data, indent=2) + "\n")
    entry = json.dumps(str(STAGE / "index.ts"))
    (root / "entry.gradle").write_text('gradle.beforeProject { project ->\n  if (project.path == ":app") {\n    project.afterEvaluate {\n      project.extensions.getByName("react").entryFile.set(new File(' + entry + '))\n    }\n  }\n}\n')
    verify_inputs(root)
    print("Frozen observer fixture and unchanged CP-50 library/native inputs", flush=True)


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
        env.update({"ENTRY_FILE": str(STAGE / "index.ts"), "FORCE_BUNDLING": "1", "EXTRA_PACKAGER_ARGS": "--max-workers 2"})
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
    target.mkdir(parents=True)
    if platform == "android":
        app = REPO / "apps/native-showcase/android/app/build/outputs/apk/release/app-release.apk"
        mapping = REPO / "apps/native-showcase/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map"
        baseline = BASELINE / "artifacts/android/app-release.apk"
        with zipfile.ZipFile(app) as current, zipfile.ZipFile(baseline) as old:
            native = [name for name in old.namelist() if name.endswith(".dex") or (name.startswith("lib/x86_64/") and name.endswith(".so"))]
            assert native and all(current.read(name) == old.read(name) for name in native), "Native code differs from CP-50"
        shutil.copy2(app, target / "observer.apk")
        product = target / "observer.apk"
    else:
        app = LAB / "ios-app-derived-data/Build/Products/Release-iphonesimulator/CodonNativeShowcase.app"
        assert digest(app / "CodonNativeShowcase") == digest(BASELINE / "artifacts/ios/CodonNativeShowcase"), "Native executable differs from CP-50"
        signature = subprocess.run(["/usr/bin/codesign", "-dv", str(app)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        assert signature.returncode != 0 and b"not signed" in signature.stdout
        shutil.copytree(app, target / "CodonNativeShowcase.app")
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
        if ".expo/codon-navigation-observer/" in source:
            name = source.split(".expo/codon-navigation-observer/", 1)[1]
            assert content is not None and hashlib.sha256(content.encode()).hexdigest() == inputs["fixtureInputs"][name], source
            fixture[name] = inputs["fixtureInputs"][name]
    assert len(react) == 1 and "react@19.2.3" in next(iter(react)), react
    assert {"App.tsx", "index.ts", "phases.json"} <= fixture.keys(), fixture
    for family in ["Breadcrumbs/Breadcrumbs.tsx", "Pagination/Pagination.tsx"]:
        assert "packages/react-native/src/components/" + family in library
    shutil.copy2(mapping, target / "bundle.map")
    (target / "proof.json").write_text(json.dumps({"platform": platform, "productSHA256": digest(product), "mapSHA256": digest(mapping), "nativeCodeByteMatchesCP50": True, "unsignedSimulator": platform == "ios", "librarySHA256": library, "fixtureSHA256": fixture, "reactRoots": sorted(react), "installedActions": 0}, indent=2) + "\n")
    print(platform, "private-entry product verified; native code matches CP-50; library modules", len(library), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "android", "ios"])
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    assert not any((parent / "SEALED").exists() or (parent / "SEALED.json").exists() for parent in [args.output, *args.output.parents])
    prepare(args.output) if args.phase == "prepare" else build(args.output, args.phase)
