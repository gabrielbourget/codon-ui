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
FIXTURE_FILES = ["App.tsx", "gate.ts", "identity.ts", "index.ts", "AuthoringApp.tsx", "authoring.ts", "authoring-index.ts", "validate_authoring.py", "test_validate_authoring.py", "validate.py", "test_validate.py", "build.py", "run.py"]


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
    names = subprocess.check_output(["git", "ls-files", "packages/react-native", "apps/native-showcase", "planning/component-library/fixtures/native-collection", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "AGENTS.md"], cwd=REPO, text=True).splitlines()
    root.mkdir(parents=True)
    STAGE.mkdir(parents=True, exist_ok=True)
    stage_names = ["App.tsx", "gate.ts", "index.ts", "identity.ts"]
    if profile == "authoring": stage_names += ["AuthoringApp.tsx", "authoring.ts"]
    for name in stage_names:
        if name == "identity.ts": continue
        source_name = "authoring-index.ts" if profile == "authoring" and name == "index.ts" else name
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
        assert all(("Lcom/codonui/input/" + name + ";").encode() in dex for name in ["CUICollectionRoot", "CUICollectionNode"])
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["prepare", "android", "prove-android"])
    parser.add_argument("root", type=Path)
    parser.add_argument("--profile", choices=["metadata", "authoring"], default="metadata")
    args = parser.parse_args()
    root = args.root.resolve()
    if args.phase == "prepare": prepare(root, args.profile)
    elif args.phase == "prove-android": prove_android(root)
    else:
        inputs = verify(root)
        assert time.time() < inputs["deadlineUnix"]
        command(root, "android-build", ["./gradlew", "--init-script", root / "entry.gradle", ":app:createBundleReleaseJsAndAssets", "--rerun", ":app:assembleRelease", "-PreactNativeArchitectures=x86_64", "--offline", "--no-daemon", "--max-workers=2", "--console=plain"], min(1800, int(inputs["deadlineUnix"] - time.time())), REPO / "apps/native-showcase/android")
        prove_android(root)


if __name__ == "__main__":
    main()
