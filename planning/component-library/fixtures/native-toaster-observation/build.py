"""Freeze one private entry and build against the unchanged CP-72 native inputs."""
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
BASE = Path.home() / ".codex/visualizations/2026/10/18/01a150fa-1040-7ce3-824e-ea41526028ae/native-library-construction-2026-10-18"
BASELINE = BASE / "native-toaster-live-release-c2e4fde"
STAGE = REPO / "apps/native-showcase/.expo/codon-toaster-observation"


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def environment():
    result = {key: value for key, value in os.environ.items() if key in ["HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL", "__CF_USER_TEXT_ENCODING"]}
    result.update({"PATH": f"/Users/gabrielbourget/.nvm/versions/node/v24.15.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin", "CI": "1", "NODE_ENV": "production", "EXPO_OFFLINE": "1", "EXPO_NO_TELEMETRY": "1", "EXPO_HOME": str(LAB / "expo"), "JAVA_HOME": str(LAB / "jdk/Contents/Home"), "ANDROID_HOME": str(LAB / "sdk"), "ANDROID_SDK_ROOT": str(LAB / "sdk"), "GRADLE_USER_HOME": str(LAB / "gradle"), "ANDROID_AVD_HOME": str(LAB / "avd"), "ANDROID_USER_HOME": str(LAB / "android-user")})
    return result


def command(root, name, args, cap=60, cwd=None, required=True, binary=False):
    log = root / (name + ".log")
    assert not log.exists(), "Never replace a recorded command: " + name
    start = time.monotonic()
    with log.open("wb") as output:
        process = subprocess.Popen(list(map(str, args)), cwd=cwd, env=environment(), stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        (root / (name + ".json")).write_text(json.dumps({"command": list(map(str, args)), "status": "RUNNING", "pid": process.pid, "capSeconds": cap}, indent=2) + "\n")
        print(name, "PID", process.pid, "cap", cap, flush=True)
        timed_out = False
        try:
            while process.poll() is None:
                try:
                    process.wait(timeout=min(20, max(1, cap - (time.monotonic() - start))))
                except subprocess.TimeoutExpired:
                    print(name, "confirmed live", round(time.monotonic() - start, 1), "seconds;", log.stat().st_size, "log bytes", flush=True)
                if process.poll() is None and time.monotonic() - start >= cap:
                    timed_out = True
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
                    break
        except BaseException:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
            raise
    code = 124 if timed_out else process.returncode
    (root / (name + ".json")).write_text(json.dumps({"command": list(map(str, args)), "exitCode": code, "pid": process.pid, "durationSeconds": round(time.monotonic() - start, 3), "logSHA256": digest(log)}, indent=2) + "\n")
    if required:
        assert code == 0, name + ": " + log.read_text(errors="replace")[-2000:]
    return code, log.read_bytes() if binary else log.read_text(errors="replace")


def verify(root):
    assert not any((p / "SEALED").exists() or (p / "SEALED.json").exists() for p in [root, *root.parents])
    inputs = json.loads((root / "inputs.json").read_text())
    for name, expected in inputs["sourceInputs"].items():
        assert digest(REPO / name) == expected, name
    for name, expected in inputs["nativeProjectInputs"].items():
        assert digest(REPO / name) == expected, name
    for name, expected in inputs["fixtureInputs"].items():
        assert digest(FIXTURE / name) == expected, name
    for name in ["App.tsx", "index.ts"]:
        assert digest(STAGE / name) == inputs["fixtureInputs"][name], name
    return inputs


def prepare(root):
    assert not root.exists()
    assert not subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO)
    assert (BASELINE / "SEALED").exists()
    assert digest(BASELINE / "SHA256SUMS") == "123419a4a926c364032dd7b622a24ba4d87f182d66855cfdb4727a566d3f2b97"
    for line in (BASELINE / "SHA256SUMS").read_text().splitlines():
        expected, name = line.split("  ", 1)
        assert digest(BASELINE / name) == expected, name
    old = json.loads((BASELINE / "inputs.json").read_text())
    assert old["producer"] == "c2e4fded89f666f2b4097fa7a82f545487841f72"
    sources = {name: digest(REPO / name) for name in old["sourceInputsSHA256"]}
    changed = {name: {"cp72": expected, "current": sources[name]} for name, expected in old["sourceInputsSHA256"].items() if sources[name] != expected}
    assert set(changed) <= {"planning/component-library/roadmap.md", "planning/component-library/experiments.md"}, changed
    root.mkdir(parents=True)
    for name in changed:
        target = root / "provenance-documents" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(REPO / name, target)
    STAGE.mkdir(parents=True, exist_ok=True)
    for name in ["App.tsx", "index.ts"]:
        shutil.copy2(FIXTURE / name, STAGE / name)
    files = {p.name: digest(p) for p in FIXTURE.iterdir() if p.is_file() and p.suffix in [".py", ".ts", ".tsx"]}
    for name in files:
        target = root / "fixture-source" / name
        target.parent.mkdir(exist_ok=True)
        shutil.copy2(FIXTURE / name, target)
    data = {"libraryProducer": old["producer"], "fixtureProducer": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(), "sourceInputs": sources, "nonRuntimePlanningChanges": changed, "nativeProjectInputs": old["nativeProjectInputsSHA256"], "fixtureInputs": files, "baselineAPK": str(BASELINE / "artifacts/android/app-release.apk"), "baselineAPKHash": "7d0d53d191a55503c2e0af81c53e810d2ed5b141644ecc3557295f8a39b7b135", "deadlineUnix": time.time() + 3600, "nativeActions": 0, "scope": "First Android passive Toaster input cohort with a new private entry; no startup repair/replay or iOS action"}
    (root / "inputs.json").write_text(json.dumps(data, indent=2) + "\n")
    entry = json.dumps(str(STAGE / "index.ts"))
    (root / "entry.gradle").write_text('gradle.beforeProject { project ->\n if (project.path == ":app") project.afterEvaluate { project.extensions.getByName("react").entryFile.set(new File(' + entry + ')) }\n}\n')
    verify(root)
    print("Frozen private fixture and unchanged CP-72 source/native-project inputs; one60-minute deadline", flush=True)


def build(root):
    inputs = verify(root)
    assert time.time() < inputs["deadlineUnix"]
    command(root, "android-build", ["./gradlew", "--init-script", root / "entry.gradle", ":app:createBundleReleaseJsAndAssets", "--rerun", ":app:assembleRelease", "-PreactNativeArchitectures=x86_64", "--offline", "--no-daemon", "--max-workers=2", "--console=plain"], min(1800, int(inputs["deadlineUnix"] - time.time())), REPO / "apps/native-showcase/android")
    prove(root)


def prove(root):
    inputs = verify(root)
    apk = REPO / "apps/native-showcase/android/app/build/outputs/apk/release/app-release.apk"
    mapping = REPO / "apps/native-showcase/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map"
    with zipfile.ZipFile(apk) as new, zipfile.ZipFile(inputs["baselineAPK"]) as old:
        assert digest(inputs["baselineAPK"]) == inputs["baselineAPKHash"]
        native = [name for name in old.namelist() if name.endswith(".dex") or (name.startswith("lib/x86_64/") and name.endswith(".so"))]
        assert native and all(new.read(name) == old.read(name) for name in native), "native code differs from CP-72"
        bundle_hash = hashlib.sha256(new.read("assets/index.android.bundle")).hexdigest()
    graph = json.loads(mapping.read_text())
    library, fixture, react = {}, {}, set()
    for name, text in zip(graph["sources"], graph["sourcesContent"]):
        assert not any(part in name for part in ["/node_modules/react-dom/", "/node_modules/react-native-web/", "/node_modules/react-aria/", "/packages/react/", "/__tests__/"]), name
        if "/node_modules/react/" in name:
            react.add(name.split("/node_modules/react/")[0])
        if "packages/react-native/" in name:
            source = "packages/react-native/" + name.split("packages/react-native/", 1)[1]
            assert text is not None and hashlib.sha256(text.encode()).hexdigest() == inputs["sourceInputs"][source], name
            library[source] = inputs["sourceInputs"][source]
        if ".expo/codon-toaster-observation/" in name:
            source = name.split(".expo/codon-toaster-observation/", 1)[1]
            assert text is not None and hashlib.sha256(text.encode()).hexdigest() == inputs["fixtureInputs"][source], name
            fixture[source] = inputs["fixtureInputs"][source]
    assert len(react) == 1 and "react@19.2.3" in next(iter(react)), react
    assert set(fixture) == {"App.tsx", "index.ts"}
    assert "packages/react-native/src/components/Toaster/Toaster.tsx" in library
    target = root / "products"
    target.mkdir()
    shutil.copy2(apk, target / "observer.apk")
    shutil.copy2(mapping, target / "bundle.map")
    (target / "proof.json").write_text(json.dumps({"apkSHA256": digest(apk), "bundleSHA256": bundle_hash, "mapSHA256": digest(mapping), "nativeByteMatchesCP72": native, "librarySHA256": library, "fixtureSHA256": fixture, "reactRoots": sorted(react), "domFree": True, "nativeActions": 0}, indent=2) + "\n")
    print("Private-entry Android product proved; native code byte-matches CP-72; library modules", len(library), flush=True)


if __name__ == "__main__":
    def interrupted(signum, frame):
        raise KeyboardInterrupt("Owned build interrupted")
    signal.signal(signal.SIGTERM, interrupted)
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "android", "prove"])
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.phase == "prepare":
        prepare(args.output)
    elif args.phase == "android":
        build(args.output)
    else:
        prove(args.output)
