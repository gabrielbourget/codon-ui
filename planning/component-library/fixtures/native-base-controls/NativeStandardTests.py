"""One admitted plan, stable SDK test targets, and one deadline/cleanup owner."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import signal
import socket
import subprocess
import time
from urllib.parse import unquote, urlsplit
import zipfile

from NativeAndroidTestSupport import stop_owned_process
from NativeCellVerification import bound_file, digest, driver_exit_code, load_admission, native_method, require
from NativeXCTestBatch import reconcile_selected_results

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
CACHE = REPO / "node_modules/.cache/codon-native-tests"
PROJECT = ROOT / "ios-native-tests/CodonNativeComponents.xcodeproj"
XCODE = "/Applications/Xcode.app/Contents/Developer/usr/bin"
METHODS = ["testS01MTCallerValuesBoundsAndDeferred", "testS01MTFormattingEmptyLabelAndContext", "testS02MTKnownLatestFillAndVisualRetirement", "testS02S06MTNativeDeliveryCurrentCallbacksAndHeldRetirement"]
COHORTS = ["values", "format", "motion", "events"]
STYLE_COHORTS = ["dimensions", "geometry", "slots", "context-motion"]
IOS_STYLE_METHODS = ["testMeterStyleDimensions", "testMeterStyleGeometry", "testMeterStyleSlots", "testMeterStyleProviders", "testMeterStyleConstraint", "testMeterStyleMotionAndReset", "testMeterStyleReset"]
IOS_REMAINING_STYLE_METHODS = ["testMeterStyleAReferenceControl", "testMeterStyleRemainingDimensions", "testMeterStyleProviders", "testMeterStyleConstraint", "testMeterStyleMotionAndReset", "testMeterStyleReset"]
IOS_AFFECTED_STYLE_METHODS = ["testMeterStyleConstraint", "testMeterStyleMotionAndReset", "testMeterStyleRaised"]


def write(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + "\n")


def files(path):
    return {str(p.relative_to(path)): digest(p) for p in sorted(path.rglob("*")) if p.is_file()}


def identity(path):
    result = {"product": str(path.resolve()), "filesSHA256": files(path)}
    require(result["filesSHA256"], "Empty SDK product")
    result["manifestSHA256"] = hashlib.sha256(json.dumps(result["filesSHA256"], sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return result


def verify_product(value, path=None):
    path = Path(path or value.get("product") or value.get("apk"))
    if "filesSHA256" in value:
        require(files(path) == value["filesSHA256"], "Product files differ: " + str(path))
    else:
        require(digest(path) == value["apkSHA256"], "APK differs: " + str(path))
    return path


def selection(platform, batch="meter-g02"):
    require(batch in ["meter-g02", "meter-style", "meter-events", "meter-style-zero-width", "meter-style-motion-cleanup", "meter-style-remaining", "meter-style-affected"] and not (batch in ["meter-events", "meter-style-zero-width", "meter-style-motion-cleanup", "meter-style-remaining", "meter-style-affected"] and platform != "ios"), "Unknown standard test selection")
    ios = ["MeterStyleTrialTests/" + name for name in IOS_STYLE_METHODS] if batch == "meter-style" else ["MeterG02TrialTests/" + name for name in (METHODS[-1:] if batch == "meter-events" else METHODS)]
    if batch == "meter-style-zero-width": ios = ["MeterStyleTrialTests/testMeterStyleZeroWidth"]
    if batch == "meter-style-motion-cleanup": ios = ["MeterStyleTrialTests/testRestoreMeterStyleMotionSetting"]
    if batch == "meter-style-remaining": ios = ["MeterStyleTrialTests/" + name for name in IOS_REMAINING_STYLE_METHODS]
    if batch == "meter-style-affected": ios = ["MeterStyleTrialTests/" + name for name in IOS_AFFECTED_STYLE_METHODS]
    return {"ios": ios if platform == "ios" else [], "android": (STYLE_COHORTS if batch == "meter-style" else COHORTS) if platform == "android" else []}


def bind_xctestrun(template, app, observer, output, installed_observer, restore_motion=None):
    def resolve(value):
        if isinstance(value, str): return value.replace("__TESTROOT__", str(Path(template).parent))
        if isinstance(value, list): return [resolve(item) for item in value]
        if isinstance(value, dict): return {key: resolve(item) for key, item in value.items()}
        return value
    data = resolve(plistlib.loads(Path(template).read_bytes()))
    target = data["CodonNativeComponents"]
    require(not target.get("SkipTestIdentifiers"), "Do not exclude compiled tests")
    target.pop("OnlyTestIdentifiers", None)
    verify_product(observer, installed_observer)
    bundle_id = plistlib.loads((Path(observer["product"]) / "Info.plist").read_bytes())["CFBundleIdentifier"]
    require(Path(target["TestHostPath"]).resolve() == Path(observer["product"]).resolve(), "SDK test host does not match prepared observer")
    require(not target.get("UseDestinationArtifacts"), "Destination-artifact mode is unsupported on this simulator lane")
    target.update(TestHostBundleIdentifier=bundle_id, UITargetAppPath=app["product"], UITargetAppBundleIdentifier="dev.codonui.showcase")
    target.update(TestTimeoutsEnabled=True, DefaultTestExecutionTimeAllowance=180, MaximumTestExecutionTimeAllowance=180)
    environment = {"CODON_METER_FIXTURE_SHA256": digest(REPO / "apps/native-showcase/src/scenes/MeterG02Fixture.tsx"), "CODON_METER_SCENE_SHA256": digest(REPO / "apps/native-showcase/src/scenes/RangeScene.tsx"), "CODON_METER_PRODUCT_SHA256": app["manifestSHA256"], "CODON_METER_OBSERVER_MANIFEST_SHA256": observer["manifestSHA256"]}
    environment["CODON_METER_STYLE_FIXTURE_SHA256"] = digest(REPO / "apps/native-showcase/src/scenes/MeterStyleFixture.tsx")
    if restore_motion is not None:
        require(restore_motion in ["0","1"], "Only the captured original Reduce Motion value is accepted")
        environment["CODON_METER_RESTORE_MOTION"] = restore_motion
    target.setdefault("EnvironmentVariables", {}).update(environment)
    target.setdefault("TestingEnvironmentVariables", {}).update(environment)
    Path(output).write_bytes(plistlib.dumps(data))


def verify_loaded_observer(diagnostics, installed_observer, observer):
    paths = set()
    for log in Path(diagnostics).rglob("Session*.log"):
        for uri in re.findall(r"Loading test bundle at: (file://\S+)", log.read_text(errors="replace")):
            value = urlsplit(uri)
            require(value.netloc in ["", "localhost"], "Unexpected runtime bundle URL host")
            paths.add(Path(unquote(value.path)))
    require(len(paths) == 1, "XCTest loaded multiple or unrecorded test bundles: " + repr(paths))
    loaded = next(iter(paths))
    require(loaded.name == "CodonNativeComponents.xctest" and loaded.parent.name == "PlugIns", "Unexpected runtime test bundle structure")
    verify_product(observer, loaded.parent.parent)
    executable = loaded / "CodonNativeComponents"
    expected_hash = observer["filesSHA256"]["PlugIns/CodonNativeComponents.xctest/CodonNativeComponents"]
    require(digest(executable) == expected_hash, "Loaded test executable differs from intended observer")
    return {"status": "PASS", "loadedTestBundle": str(loaded), "preflightInstalledObserver": str(installed_observer), "executableSHA256": expected_hash, "observerManifestSHA256": observer["manifestSHA256"], "basis": "XCTest runtime loading log and exact full actually loaded observer product"}


class Session:
    def __init__(self, output, maximum=1800, reserve=120):
        self.output, self.start = Path(output), time.time()
        self.output.mkdir(parents=True, exist_ok=False)
        self.end = self.start + maximum
        self.work = self.end - reserve
        self.rows, self.cleanup_errors = [], []
        self.emulator = None
        self.guest_owned = False
        self.motion_setting = None
        self.env = {**os.environ, "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer", "PYTHONDONTWRITEBYTECODE": "1"}

    def remaining(self, cleanup=False):
        return (self.end if cleanup else self.work) - time.time() - 8

    def run(self, name, argv, cap=None, cleanup=False):
        prefix = self.output / name
        row = {"name": name, "argv": list(map(str, argv)), "startedUTC": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        print(json.dumps(row), flush=True)
        remaining = self.remaining(cleanup)
        timeout = remaining if cap is None else min(cap, remaining)
        row.update(timeoutSeconds=timeout, deadlineKind="cleanup" if cleanup else "work", explicitCapSeconds=cap)
        require(timeout > 0, "No command budget remains")
        process = None
        try:
            with prefix.with_suffix(".stdout").open("xb") as output, prefix.with_suffix(".stderr").open("xb") as error:
                process = subprocess.Popen(row["argv"], env=self.env, stdout=output, stderr=error, start_new_session=True)
                row.update(pid=process.pid, processGroup=process.pid, ownerPID=os.getpid())
                write(prefix.with_suffix(".json"), row)
                try: process.wait(timeout=timeout)
                except subprocess.TimeoutExpired: row["timedOut"] = True
        finally:
            if process is not None:
                row["ownedGroupGone"] = stop_owned_process(process)
                row["exitCode"] = process.poll()
            row["endedUTC"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self.rows.append(row);write(prefix.with_suffix(".json"), row);write(self.output / "commands.json", self.rows)
        require(row.get("ownedGroupGone") is True and not row.get("timedOut"), "Command timeout/cleanup failure: " + name)
        require(row.get("exitCode") == 0, "SDK command failed: " + name)
        return prefix.with_suffix(".stdout").read_text()



def geometry_control_source():
    source = (ROOT / "MeterG02TrialTests.swift").read_text()
    start = source.index("private func layoutMatches(");opening = source.index("{", start);depth = 1;end = opening + 1
    while depth:
        depth += (source[end] == "{") - (source[end] == "}");end += 1
    predicate = source[start:end].replace("private ", "", 1)
    pixel_start = source.index("private func stylePixelsMatch(");pixel_open = source.index("{", pixel_start);pixel_depth = 1;pixel_end = pixel_open + 1
    while pixel_depth:
        pixel_depth += (source[pixel_end] == "{") - (source[pixel_end] == "}");pixel_end += 1
    pixel_predicate = source[pixel_start:pixel_end].replace("private ", "", 1)
    shadow_start = source.index("private func shadowFallsDown(");shadow_open = source.index("{", shadow_start);shadow_depth = 1;shadow_end = shadow_open + 1
    while shadow_depth:
        shadow_depth += (source[shadow_end] == "{") - (source[shadow_end] == "}");shadow_end += 1
    shadow_predicate = source[shadow_start:shadow_end].replace("private ", "", 1)
    return "import Foundation\n" + predicate + "\n" + pixel_predicate + "\n" + shadow_predicate + "\n" + '''
let saved: NSNumber = 9.9998779296875
precondition(saved.intValue == 9 && saved.doubleValue == 9.9998779296875)
let cases: [(Double, Double, Double, Bool)] = [
    (saved.doubleValue, 10, 3, true), (10, 10, 3, true), (180, 180, 3, true),
    (9, 10, 3, false), (181, 180, 3, false), (9.5, 10, 3, false),
    (9.9998779296875, 10, 1, true), (Double.nan, 10, 3, false),
    (10, Double.infinity, 3, false), (10, 10, 0, false), (10, 10, Double.nan, false)
]
for (actual, expected, scale, verdict) in cases { precondition(layoutMatches(actual, expected, scale) == verdict) }
let pixels: [UInt8] = [255,255,255,255,0,122,255,255]
precondition(stylePixelsMatch(pixels,pixels))
precondition(!stylePixelsMatch([],[]))
precondition(!stylePixelsMatch([1],[1]))
precondition(!stylePixelsMatch(pixels,Array(pixels.dropLast(4))))
var wrong = pixels;wrong[4] = 1;precondition(!stylePixelsMatch(pixels,wrong))
wrong = pixels;wrong[7] = 0;precondition(!stylePixelsMatch(pixels,wrong))
precondition(shadowFallsDown([248,248,248,255],[225,225,225,255]))
precondition(!shadowFallsDown([255,255,255,255],[255,255,255,255]))
precondition(!shadowFallsDown([225,225,225,255],[248,248,248,255]))
precondition(!shadowFallsDown([248,240,248,255],[225,225,225,255]))
precondition(!shadowFallsDown([248,248,248,200],[225,225,225,255]))
precondition(!shadowFallsDown([],[225,225,225,255]))
print(#"{\"status\":\"PASS\",\"cases\":11,\"pixelCases\":6,\"shadowCases\":6,\"savedNSNumberIntValue\":9,\"savedNSNumberDoubleValue\":9.9998779296875}"#)
'''


def build_ios(session):
    controls = session.output / "MeterGeometryControls.swift";controls.write_text(geometry_control_source())
    sdk = session.run("geometry-sdk", ["/usr/bin/xcrun", "--sdk", "macosx", "--show-sdk-path"]).strip()
    swift = "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift"
    control_result = json.loads(session.run("geometry-controls", [swift, "-sdk", sdk, "-module-cache-path", str(CACHE / "swift-host-module-cache"), str(controls)]))
    require(control_result.get("status") == "PASS" and control_result.get("cases") == 11 and control_result.get("pixelCases") == 6 and control_result.get("shadowCases") == 6, "Actual Swift geometry/pixel/shadow controls failed")
    derived = CACHE / "ios"
    # A source revision gets an unambiguous observer registration; old installed revisions remain intact.
    bundle_id = "dev.codonui.lab.components.r" + digest(ROOT / "MeterG02TrialTests.swift")[:12]
    session.run("build-ios", [XCODE + "/xcodebuild", "build-for-testing", "-project", str(PROJECT), "-scheme", "CodonNativeComponents", "-configuration", "Release", "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", str(derived), "-jobs", "1", "CODE_SIGNING_ALLOWED=NO", "PRODUCT_BUNDLE_IDENTIFIER=" + bundle_id])
    product = derived / "Build/Products/Release-iphonesimulator/CodonNativeComponents-Runner.app"
    result = identity(product)
    result["geometryControls"] = {"result": control_result, "sourceSHA256": digest(controls), "outputSHA256": digest(session.output / "geometry-controls.stdout")}
    templates = list((derived / "Build/Products").glob("*.xctestrun"))
    require(len(templates) == 1, "Ambiguous SDK-generated xctestrun")
    result["xctestrun"] = {"path": str(templates[0]), "sha256": digest(templates[0])}
    return result


def build_android(session, config):
    sdk, jdk = Path(config["sdk"]), Path(config["jdk"])
    tools, jar = sdk / "build-tools/36.0.0", sdk / "platforms/android-36/android.jar"
    source = ROOT / "android-native-inspector"
    build = CACHE / "android" / digest(source / "Actions.java")
    build.mkdir(parents=True, exist_ok=True)
    for name in ["classes", "dex"]: (build / name).mkdir(exist_ok=True)
    session.env.update(JAVA_HOME=str(jdk), JAVA_TOOL_OPTIONS="-XX:ActiveProcessorCount=1")
    session.run("javac", [jdk / "bin/javac", "-source", "8", "-target", "8", "-classpath", jar, "-d", build / "classes", source / "Actions.java"])
    session.run("dex", [tools / "d8", "--lib", jar, "--output", build / "dex", *sorted((build / "classes").rglob("*.class"))])
    session.run("package", [tools / "aapt2", "link", "--manifest", source / "AndroidManifest.xml", "-I", jar, "-o", build / "unsigned.apk"])
    with zipfile.ZipFile(build / "unsigned.apk", "a", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(build / "dex/classes.dex", "classes.dex")
    apk = build / "inspector.apk"
    session.run("align", [tools / "zipalign", "-f", "4", build / "unsigned.apk", apk])
    session.run("sign", [tools / "apksigner", "sign", "--ks", REPO / "apps/native-showcase/android/app/debug.keystore", "--ks-key-alias", "androiddebugkey", "--ks-pass", "pass:android", "--key-pass", "pass:android", apk])
    session.run("verify-signature", [tools / "apksigner", "verify", "--verbose", apk])
    return {"apk": str(apk), "apkSHA256": digest(apk)}



def wait_ios_pending_app(session, device, app, maximum):
    require(type(maximum) is int and maximum > 0, "Pending observation needs a positive scoped budget")
    until, observations = min(time.time() + maximum, session.work - 8), []
    while time.time() < until:
        remaining = until - time.time()
        registered = session.run("pending-app-" + str(len(observations)), [XCODE + "/simctl", "get_app_container", device, "dev.codonui.showcase", "app"], remaining).strip()
        row = {"atUTC": datetime.datetime.now(datetime.timezone.utc).isoformat(), "registered": registered, "matched": False}
        try:
            verify_product(app, registered)
            row["matched"] = True
        except ValueError as error:
            row["mismatch"] = str(error)
        observations.append(row);write(session.output / "pending-app-observations.json", observations)
        if row["matched"]: return
        time.sleep(min(5, max(0, until - time.time())))
    raise ValueError("Existing pending app update did not reach the selected product within its observation budget; no install reissued")


def run_ios(session, config, app, observer):
    device = config["destination"]
    resume = config.get("resumePendingApplicationInstall", False)
    require(type(resume) is bool, "Pending-install mode must be boolean")
    if resume: require(type(config.get("pendingInstallObservationSeconds")) is int and config["pendingInstallObservationSeconds"] > 0, "Pending observation needs a positive scoped budget")
    require(re.fullmatch(r"[A-F0-9-]{36}", device), "Explicit simulator UUID required")
    state = Path.home() / "Library/Developer/CoreSimulator/Devices" / device / "device.plist"
    require(plistlib.loads(state.read_bytes())["state"] == 1, "Selected simulator must start shut down")
    session.guest_owned = True
    session.run("boot", [XCODE + "/simctl", "boot", device])
    session.run("boot-readiness", [XCODE + "/simctl", "bootstatus", device, "-b"])
    observer_bundle = plistlib.loads((Path(observer["product"]) / "Info.plist").read_bytes())["CFBundleIdentifier"]
    products = [("app", "dev.codonui.showcase", app), ("observer", observer_bundle, observer)]
    installed_products = {}
    for label, bundle, expected in products:
        if resume and label == "app":
            try: wait_ios_pending_app(session, device, app, config["pendingInstallObservationSeconds"])
            except ValueError:
                try:
                    session.run("pending-install-diagnostics", [XCODE + "/simctl", "diagnose", "-b", "--timeout=" + str(max(1, int(session.remaining()))), "--no-archive", "--output=" + str(session.output / "diagnostics"), "--udid=" + device])
                    require(any((session.output / "diagnostics").rglob("*")), "SDK diagnose produced no capture; inspect its acknowledgment/output")
                except ValueError as error: write(session.output / "pending-install-diagnostics-failure.json", {"error": repr(error)})
                raise
        elif not resume:
            session.run("install-" + label, [XCODE + "/simctl", "install", device, expected["product"]])
        registered = session.run("preflight-installed-" + label, [XCODE + "/simctl", "get_app_container", device, bundle, "app"]).strip()
        verify_product(expected, registered)
        installed_products[label] = registered
    template = bound_file(observer["xctestrun"])
    runfile = session.output / "Tests.xctestrun"
    bind_xctestrun(template, app, observer, runfile, installed_products["observer"], config.get("restoreMotionOriginalValue"))
    selected = selection("ios", config.get("batch", "meter-g02"))["ios"]
    argv = [XCODE + "/xcodebuild", "test-without-building", "-xctestrun", str(runfile), "-destination", "platform=iOS Simulator,id=" + device, "-destination-timeout", str(max(1, int(session.remaining()))), "-jobs", "1", "-parallel-testing-enabled", "NO", "-test-timeouts-enabled", "YES", "-maximum-test-execution-time-allowance", "180", "-resultBundlePath", str(session.output / "Tests.xcresult")]
    argv += ["-only-testing:CodonNativeComponents/" + name for name in selected]
    sdk_error = None
    try: raw = session.run("xctest", argv)
    except ValueError as error:
        sdk_error = error;stdout = session.output / "xctest.stdout";raw = stdout.read_text() if stdout.exists() else ""
    if config.get("batch") in ["meter-style", "meter-style-remaining", "meter-style-affected"] and "METER_STYLE_MOTION_ORIGINAL " in raw:
        original_motion = re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])", raw)
        restored_motion = re.findall(r"METER_STYLE_MOTION_RESTORED ([01])", raw)
        if original_motion != restored_motion: session.cleanup_errors.append("Original iOS Reduce Motion restoration unverified")
    diagnostics = session.output / "runtime-diagnostics"
    try:
        session.run("xctest-runtime-diagnostics", [XCODE + "/xcresulttool", "export", "diagnostics", "--path", session.output / "Tests.xcresult", "--output-path", diagnostics])
        loaded = verify_loaded_observer(diagnostics, installed_products["observer"], observer)
    except ValueError as error:
        write(session.output / "loaded-observer.json", {"status": "FAIL", "failure": str(error), "sdkFailure": str(sdk_error) if sdk_error else None})
        if sdk_error is not None: raise sdk_error from error
        raise
    write(session.output / "loaded-observer.json", loaded)
    if sdk_error is not None: raise sdk_error
    summary = json.loads(session.run("xctest-summary", [XCODE + "/xcresulttool", "get", "test-results", "summary", "--path", session.output / "Tests.xcresult"]))
    result = reconcile_selected_results(summary, raw, selected)
    if config.get("batch") == "meter-style": result["styleObservations"] = reconcile_ios_styles(raw)
    if config.get("batch") == "meter-style-affected":
        result["styleObservations"] = reconcile_ios_styles(raw,["before-compact","compact","live-restored","reduced-value75","motion-restored-value25","raised"])
    if config.get("batch") == "meter-style-remaining":
        expected = ["zero-height", "percentage", "auto-height", "dark-semantic", "dark-primary", "dark-post-custom-final", "dark-native-color", "before-compact", "compact", "live-restored", "reduced-value75", "motion-restored-value25", "explicit-reset"]
        result["styleObservations"] = reconcile_ios_styles(raw, expected)
        controls = re.findall(r"METER_STYLE_REFERENCE_CONTROL (\{[^\n]+\})",raw)
        require(len(controls) == 1 and json.loads(controls[0])["matchedPositions"] is True, "Matched-position native stock controls missing")
        result["stockReferenceControl"] = json.loads(controls[0])
    if config.get("batch") == "meter-style-motion-cleanup":
        require(re.findall(r"METER_STYLE_MOTION_RESTORED ([01])",raw)==[config["restoreMotionOriginalValue"]], "Cleanup did not verify exact original setting")
    write(session.output / "native-results.json", result)
    require(result["status"] == "PASS", "XCTest selection failed or incomplete")
    for label, bundle, expected in products:
        registered = session.run("installed-" + label, [XCODE + "/simctl", "get_app_container", device, bundle, "app"]).strip()
        verify_product(expected, registered)
    return result


def reconcile_ios_styles(raw, expected=None):
    from MeterStyleAndroidCheck import EXPECTED
    observations = [json.loads(row) for row in re.findall(r"METER_STYLE_OBSERVATION (\{[^\n]+\})", raw)]
    if expected is None: expected = [name for names in EXPECTED.values() for name in names]
    require(sorted(row["name"] for row in observations) == sorted(expected), "Incomplete/duplicate selected iOS style observations")
    for row in observations:
        if row["name"] == "raised":
            samples = row.get("opaqueSamples", []);shadows = row.get("shadowSamples", [])
            require(row.get("opaqueSamplesExact") is True and row.get("shadowPresenceDirection") is True and len(samples) == 4 and len(shadows) == 2, "Opaque/shadow observations missing")
            require(all(sample["rgba"] == sample["referenceRGBA"] for sample in samples), "Actual opaque reference differs")
            for shadow in shadows:
                above, below = shadow["aboveRGBA"], shadow["belowRGBA"]
                require(len(above) == len(below) == 4 and above[3] == below[3] == 255 and above[0] == above[1] == above[2] and below[0] == below[1] == below[2] and below[0] < above[0], "Actual neutral downward shadow missing")
        else: require(row["wholeParentExact"] is True, "Actual whole-parent paint match missing")
        require(row["comparedPixels"] > 0, "Actual captured parent missing")
        require(row["state"] == row["afterState"], "Style state changed during actual capture")
    originals = re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])", raw)
    require(len(originals) == 1 and originals == re.findall(r"METER_STYLE_MOTION_RESTORED ([01])", raw), "Exact original iOS motion preference restoration missing")
    return observations


def run_android(session, config, app, observer):
    sdk, serial = Path(config["sdk"]), config["destination"]
    avd_home = Path(config["avdHome"])
    require((avd_home / (config["avd"] + ".ini")).is_file(), "Selected AVD is missing from explicit avdHome")
    require(Path(config["androidUserHome"]).is_dir(), "Existing Android user directory required")
    session.env.update(ANDROID_AVD_HOME=str(avd_home), ANDROID_USER_HOME=config["androidUserHome"], ANDROID_HOME=str(sdk), ANDROID_SDK_ROOT=str(sdk))
    require(re.fullmatch(r"emulator-\d+", serial), "Explicit owned emulator serial required")
    port = int(serial.split("-")[1]);require(port % 2 == 0, "Even emulator port required")
    adb = [str(sdk / "platform-tools/adb")]
    require(serial not in session.run("devices-before", adb + ["devices"]), "Selected serial already in use")
    for number in [port, port + 1]:
        with socket.socket() as probe:
            require(probe.connect_ex(("127.0.0.1", number)) != 0, "Selected emulator port in use")
    log = (session.output / "emulator.log").open("xb")
    argv = [str(sdk / "emulator/emulator"), "-avd", config["avd"], "-port", str(port), "-no-snapshot-load", "-no-snapshot-save", "-cores", "2", "-memory", "2048", "-no-window", "-no-audio", "-no-boot-anim", "-gpu", config["gpu"]]
    session.emulator = subprocess.Popen(argv, env=session.env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    write(session.output / "emulator-owner.json", {"pid": session.emulator.pid, "processGroup": session.emulator.pid, "ownerPID": os.getpid(), "argv": argv, "avdHome": str(avd_home)})
    log.close();session.guest_owned = True
    selected = adb + ["-s", serial]
    session.run("wait-device", selected + ["wait-for-device"])
    attempt = 0
    while True:
        require(session.remaining() > 0 and session.emulator.poll() is None, "Android boot readiness failed")
        if session.run("boot-state-" + str(attempt), selected + ["shell", "getprop", "sys.boot_completed"]).strip() == "1": break
        attempt += 1
        time.sleep(min(2, max(0, session.remaining())))
    for label, bundle, expected in [("app", "dev.codonui.showcase", app), ("observer", "dev.codonui.lab.number", observer)]:
        session.run("install-" + label, selected + ["install", "-r", str(verify_product(expected))])
        remote = session.run("package-" + label, selected + ["shell", "pm", "path", bundle]).strip()
        require(remote.startswith("package:") and "\n" not in remote, "Ambiguous installed APK")
        pulled = session.output / (label + ".apk")
        session.run("installed-" + label, selected + ["pull", remote[8:], str(pulled)])
        verify_product(expected, pulled)
    session.run("launch", selected + ["shell", "am", "start", "-W", "-n", "dev.codonui.showcase/.MainActivity"])
    batch = config["batch"]
    cohorts = selection("android", batch)["android"]
    if batch == "meter-style":
        session.run("device-api", selected + ["shell", "getprop", "ro.build.version.sdk"])
        session.run("device-abi", selected + ["shell", "getprop", "ro.product.cpu.abi"])
        session.run("device-size", selected + ["shell", "wm", "size"])
        session.run("device-font-setting", selected + ["shell", "settings", "get", "system", "font_scale"])
        session.motion_setting = session.run("motion-setting-before", selected + ["shell", "settings", "get", "global", "transition_animation_scale"]).strip()
        require(session.motion_setting == "null" or re.fullmatch(r"[0-9.]+", session.motion_setting), "Unexpected captured motion preference")
    remote = "/sdcard/Android/data/dev.codonui.lab.number/files/" + batch + "-native-" + session.output.name
    session.run("instrumentation", selected + ["shell", "am", "instrument", "-w", "-e", "op", batch + "-batch", "-e", "outputDir", remote, "dev.codonui.lab.number/.Actions"])
    directory = session.output / "native"
    session.run("pull-results", selected + ["pull", remote, str(directory)])
    receipt = directory / "receipt.json";value = json.loads(receipt.read_text())
    require(value.get("nativeActionSucceeded") and not value.get("hasFailedCohorts") and value.get("selectedMethods") == cohorts, "Instrumentation failed/incomplete; adb exit alone is not a verdict")
    methods = [native_method({"path": str(receipt), "sha256": digest(receipt), "format": "android_receipt", "method": name, "maximumSeconds": 180}) for name in cohorts]
    session.run("density", selected + ["shell", "wm", "density"])
    if batch == "meter-style":
        decoder = bound_file(config["imageDecoder"])
        session.run("paint", [os.sys.executable, "-B", ROOT / "MeterStyleAndroidCheck.py", "--input", directory, "--out", session.output / "paint", "--image-decoder", decoder, "--decoder-sha256", config["imageDecoder"]["sha256"], "--deadline-unix", str(session.work)])
    else:
        oracle = bound_file(config["paintOracle"])
        session.run("paint", [os.sys.executable, "-B", ROOT / "MeterG02AndroidTests.py", "--input", directory, "--out", session.output / "paint", "--density", session.output / "density.stdout", "--paint-oracle", oracle, "--deadline-unix", str(session.work)])
    return {"status": "NATIVE_AND_PAINT_ASSERTIONS_PASSED_PENDING_VISUAL_REVIEW", "methods": methods}


def cleanup(session, config):
    if not session.guest_owned: return
    if config["platform"] == "ios":
        session.run("shutdown", [XCODE + "/simctl", "shutdown", config["destination"]], cleanup=True)
        state = Path.home() / "Library/Developer/CoreSimulator/Devices" / config["destination"] / "device.plist"
        require(plistlib.loads(state.read_bytes())["state"] == 1, "Simulator shutdown not verified")
    else:
        adb = [str(Path(config["sdk"]) / "platform-tools/adb")]
        if session.motion_setting is not None:
            try:
                original = session.motion_setting
                argv = ["delete", "global", "transition_animation_scale"] if original == "null" else ["put", "global", "transition_animation_scale", original]
                session.run("restore-motion-setting", adb + ["-s", config["destination"], "shell", "settings", *argv], session.remaining(True) / 3, True)
                restored = session.run("verify-motion-setting", adb + ["-s", config["destination"], "shell", "settings", "get", "global", "transition_animation_scale"], session.remaining(True) / 3, True).strip()
                write(session.output / "preference-restoration.json", {"captured": {"transition_animation_scale": original}, "restored": {"transition_animation_scale": restored}, "exactKeySetAndValuesVerified": restored == original})
                require(restored == original, "Exact captured motion preference restoration failed")
            except Exception as error:
                session.cleanup_errors.append("Motion preference restoration: " + repr(error))
        try: session.run("emulator-shutdown", adb + ["-s", config["destination"], "emu", "kill"], session.remaining(True) / 2, True)
        except ValueError as error: write(session.output / "shutdown-transport-warning.json", {"error": str(error), "verdict": "Owned group,serial and port checks below determine actual cleanup"})
        finally:
            require(stop_owned_process(session.emulator), "Owned emulator group remains")
        attempt = 0
        while True:
            if config["destination"] not in session.run("devices-after-" + str(attempt), adb + ["devices"], cleanup=True): break
            require(session.remaining(True) > 0, "Emulator transport detachment not verified")
            attempt += 1
            time.sleep(min(1, max(0, session.remaining(True))))
        for port in [int(config["destination"].split("-")[1]), int(config["destination"].split("-")[1]) + 1]:
            with socket.socket() as probe: require(probe.connect_ex(("127.0.0.1", port)) != 0, "Emulator port remains open")


def execute(plan, admission):
    config = plan["nativeStandard"]
    require(config["platform"] in ["ios", "android"] and config["action"] in ["build", "run"], "Unknown standard SDK operation")
    selection(config["platform"], config.get("batch"))
    session = Session(config["output"], plan["attempt"]["maximumSeconds"], plan["attempt"]["cleanupReserveSeconds"])
    result, failure = None, None
    def interrupted(signum, frame): raise InterruptedError("Owned standard SDK run interrupted: " + str(signum))
    prior = {signum: signal.signal(signum, interrupted) for signum in [signal.SIGINT, signal.SIGTERM, signal.SIGALRM]}
    signal.setitimer(signal.ITIMER_REAL, max(0.01, session.work - time.time()))
    try:
        if config["action"] == "build":
            result = build_ios(session) if config["platform"] == "ios" else build_android(session, config)
            result["sourceFilesSHA256"] = {item["path"]: item["sha256"] for item in plan["bindings"]["observer"]}
            write(session.output / "identity.json", result)
        else:
            app = json.loads(bound_file(config["appIdentity"]).read_text());observer = json.loads(bound_file(config["observerIdentity"]).read_text())
            verify_product(app);verify_product(observer)
            for path, expected in observer["sourceFilesSHA256"].items(): require(digest(path) == expected, "Observer source changed since SDK build")
            result = run_ios(session, config, app, observer) if config["platform"] == "ios" else run_android(session, config, app, observer)
    except BaseException as error: failure = repr(error)
    finally:
        signal.setitimer(signal.ITIMER_REAL, max(0.01, session.end - time.time() - 8))
        try: cleanup(session, config)
        except BaseException as error: session.cleanup_errors.append(repr(error))
        signal.setitimer(signal.ITIMER_REAL, 0)
        for signum, handler in prior.items(): signal.signal(signum, handler)
        clean = not session.cleanup_errors and time.time() < session.end and all(row.get("ownedGroupGone") is True for row in session.rows)
        record = {"preflight": admission, "finishedUTC": datetime.datetime.now(datetime.timezone.utc).isoformat(), "elapsedSeconds": time.time() - session.start, "action": config["action"], "platform": config["platform"], "status": "COMPLETED_PENDING_REVIEW" if failure is None and clean else "FAILED", "failure": failure, "cleanupErrors": session.cleanup_errors, "cleanupVerified": clean, "result": result, "gatePromotions": 0}
        write(session.output / "terminal.json", record);print(json.dumps(record), flush=True)
    return driver_exit_code(0 if failure is None else 1, result is not None, clean)


def main():
    parser = argparse.ArgumentParser(description=__doc__);parser.add_argument("--plan", type=Path, required=True);args = parser.parse_args()
    plan = json.loads(args.plan.read_text());require(plan["cell"].startswith("CAT.meter."), "Only the authorized Meter path is selected")
    admission = load_admission(__file__, plan["cell"], selection(plan["nativeStandard"]["platform"], plan["nativeStandard"].get("batch", "meter-g02")))
    require(json.loads(Path(admission["path"]).read_text())["planSHA256"] == digest(args.plan), "Plan changed after admission")
    return execute(plan, admission)


if __name__ == "__main__":
    raise SystemExit(main())
