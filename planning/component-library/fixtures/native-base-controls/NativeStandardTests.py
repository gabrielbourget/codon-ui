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


def selection(platform):
    return {"ios": ["MeterG02TrialTests/" + name for name in METHODS] if platform == "ios" else [], "android": COHORTS if platform == "android" else []}


def bind_xctestrun(template, app, observer, output):
    def resolve(value):
        if isinstance(value, str): return value.replace("__TESTROOT__", str(Path(template).parent))
        if isinstance(value, list): return [resolve(item) for item in value]
        if isinstance(value, dict): return {key: resolve(item) for key, item in value.items()}
        return value
    data = resolve(plistlib.loads(Path(template).read_bytes()))
    target = data["CodonNativeComponents"]
    require(not target.get("SkipTestIdentifiers"), "Do not exclude compiled tests")
    target.pop("OnlyTestIdentifiers", None)
    target["UITargetAppPath"] = app["product"]
    target["UITargetAppBundleIdentifier"] = "dev.codonui.showcase"
    target.update(TestTimeoutsEnabled=True, DefaultTestExecutionTimeAllowance=180, MaximumTestExecutionTimeAllowance=180)
    environment = {"CODON_METER_FIXTURE_SHA256": digest(REPO / "apps/native-showcase/src/scenes/MeterG02Fixture.tsx"), "CODON_METER_SCENE_SHA256": digest(REPO / "apps/native-showcase/src/scenes/RangeScene.tsx"), "CODON_METER_PRODUCT_SHA256": app["manifestSHA256"], "CODON_METER_OBSERVER_MANIFEST_SHA256": observer["manifestSHA256"]}
    target.setdefault("EnvironmentVariables", {}).update(environment)
    target.setdefault("TestingEnvironmentVariables", {}).update(environment)
    Path(output).write_bytes(plistlib.dumps(data))


class Session:
    def __init__(self, output, maximum=1800, reserve=120):
        self.output, self.start = Path(output), time.time()
        self.output.mkdir(parents=True, exist_ok=False)
        self.end = self.start + maximum
        self.work = self.end - reserve
        self.rows, self.cleanup_errors = [], []
        self.emulator = None
        self.guest_owned = False
        self.env = {**os.environ, "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer", "PYTHONDONTWRITEBYTECODE": "1"}

    def run(self, name, argv, cap=60, cleanup=False):
        prefix = self.output / name
        row = {"name": name, "argv": list(map(str, argv)), "startedUTC": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        print(json.dumps(row), flush=True)
        timeout = min(cap, (self.end if cleanup else self.work) - time.time() - 8)
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


def build_ios(session):
    derived = CACHE / "ios"
    session.run("build-ios", [XCODE + "/xcodebuild", "build-for-testing", "-project", str(PROJECT), "-scheme", "CodonNativeComponents", "-configuration", "Release", "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", str(derived), "-jobs", "1", "CODE_SIGNING_ALLOWED=NO"], 280)
    product = derived / "Build/Products/Release-iphonesimulator/CodonNativeComponents-Runner.app"
    result = identity(product)
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
    session.run("javac", [jdk / "bin/javac", "-source", "8", "-target", "8", "-classpath", jar, "-d", build / "classes", source / "Actions.java"], 60)
    session.run("dex", [tools / "d8", "--lib", jar, "--output", build / "dex", *sorted((build / "classes").rglob("*.class"))], 60)
    session.run("package", [tools / "aapt2", "link", "--manifest", source / "AndroidManifest.xml", "-I", jar, "-o", build / "unsigned.apk"], 30)
    with zipfile.ZipFile(build / "unsigned.apk", "a", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(build / "dex/classes.dex", "classes.dex")
    apk = build / "inspector.apk"
    session.run("align", [tools / "zipalign", "-f", "4", build / "unsigned.apk", apk], 30)
    session.run("sign", [tools / "apksigner", "sign", "--ks", REPO / "apps/native-showcase/android/app/debug.keystore", "--ks-key-alias", "androiddebugkey", "--ks-pass", "pass:android", "--key-pass", "pass:android", apk], 30)
    session.run("verify-signature", [tools / "apksigner", "verify", "--verbose", apk], 30)
    return {"apk": str(apk), "apkSHA256": digest(apk)}


def run_ios(session, config, app, observer):
    device = config["destination"]
    require(re.fullmatch(r"[A-F0-9-]{36}", device), "Explicit simulator UUID required")
    state = Path.home() / "Library/Developer/CoreSimulator/Devices" / device / "device.plist"
    require(plistlib.loads(state.read_bytes())["state"] == 1, "Selected simulator must start shut down")
    session.guest_owned = True
    session.run("boot", [XCODE + "/simctl", "boot", device], 20)
    session.run("boot-readiness", [XCODE + "/simctl", "bootstatus", device, "-b"], 180)
    template = bound_file(observer["xctestrun"])
    runfile = session.output / "Tests.xctestrun"
    bind_xctestrun(template, app, observer, runfile)
    argv = [XCODE + "/xcodebuild", "test-without-building", "-xctestrun", str(runfile), "-destination", "platform=iOS Simulator,id=" + device, "-destination-timeout", "30", "-jobs", "1", "-parallel-testing-enabled", "NO", "-test-timeouts-enabled", "YES", "-maximum-test-execution-time-allowance", "180", "-resultBundlePath", str(session.output / "Tests.xcresult")]
    argv += ["-only-testing:CodonNativeComponents/" + name for name in selection("ios")["ios"]]
    raw = session.run("xctest", argv, 900)
    summary = json.loads(session.run("xctest-summary", [XCODE + "/xcresulttool", "get", "test-results", "summary", "--path", session.output / "Tests.xcresult"], 30))
    result = reconcile_selected_results(summary, raw, selection("ios")["ios"])
    write(session.output / "native-results.json", result)
    require(result["status"] == "PASS", "XCTest selection failed or incomplete")
    for label, bundle, expected in [("app", "dev.codonui.showcase", app), ("observer", "dev.codonui.lab.components.xctrunner", observer)]:
        registered = session.run("installed-" + label, [XCODE + "/simctl", "get_app_container", device, bundle, "app"], 15).strip()
        verify_product(expected, registered)
    return result


def run_android(session, config, app, observer):
    sdk, serial = Path(config["sdk"]), config["destination"]
    avd_home = Path(config["avdHome"])
    require((avd_home / (config["avd"] + ".ini")).is_file(), "Selected AVD is missing from explicit avdHome")
    require(Path(config["androidUserHome"]).is_dir(), "Existing Android user directory required")
    session.env.update(ANDROID_AVD_HOME=str(avd_home), ANDROID_USER_HOME=config["androidUserHome"], ANDROID_HOME=str(sdk), ANDROID_SDK_ROOT=str(sdk))
    require(re.fullmatch(r"emulator-\d+", serial), "Explicit owned emulator serial required")
    port = int(serial.split("-")[1]);require(port % 2 == 0, "Even emulator port required")
    adb = [str(sdk / "platform-tools/adb")]
    require(serial not in session.run("devices-before", adb + ["devices"], 10), "Selected serial already in use")
    for number in [port, port + 1]:
        with socket.socket() as probe:
            require(probe.connect_ex(("127.0.0.1", number)) != 0, "Selected emulator port in use")
    log = (session.output / "emulator.log").open("xb")
    argv = [str(sdk / "emulator/emulator"), "-avd", config["avd"], "-port", str(port), "-no-snapshot-load", "-no-snapshot-save", "-cores", "2", "-memory", "2048", "-no-window", "-no-audio", "-no-boot-anim", "-gpu", config["gpu"]]
    session.emulator = subprocess.Popen(argv, env=session.env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    write(session.output / "emulator-owner.json", {"pid": session.emulator.pid, "processGroup": session.emulator.pid, "ownerPID": os.getpid(), "argv": argv, "avdHome": str(avd_home)})
    log.close();session.guest_owned = True
    selected = adb + ["-s", serial]
    session.run("wait-device", selected + ["wait-for-device"], 90)
    until = min(time.time() + 180, session.work)
    for attempt in range(90):
        if session.run("boot-state-" + str(attempt), selected + ["shell", "getprop", "sys.boot_completed"], 10).strip() == "1": break
        require(time.time() < until and session.emulator.poll() is None, "Android boot readiness failed")
        time.sleep(2)
    else: raise ValueError("Android boot readiness failed")
    for label, bundle, expected in [("app", "dev.codonui.showcase", app), ("observer", "dev.codonui.lab.number", observer)]:
        session.run("install-" + label, selected + ["install", "-r", str(verify_product(expected))], 90)
        remote = session.run("package-" + label, selected + ["shell", "pm", "path", bundle], 15).strip()
        require(remote.startswith("package:") and "\n" not in remote, "Ambiguous installed APK")
        pulled = session.output / (label + ".apk")
        session.run("installed-" + label, selected + ["pull", remote[8:], str(pulled)], 30)
        verify_product(expected, pulled)
    session.run("launch", selected + ["shell", "am", "start", "-W", "-n", "dev.codonui.showcase/.MainActivity"], 30)
    remote = "/sdcard/Android/data/dev.codonui.lab.number/files/meter-g02-native-" + session.output.name
    session.run("instrumentation", selected + ["shell", "am", "instrument", "-w", "-e", "op", "meter-g02-batch", "-e", "outputDir", remote, "dev.codonui.lab.number/.Actions"], 1000)
    directory = session.output / "native"
    session.run("pull-results", selected + ["pull", remote, str(directory)], 30)
    receipt = directory / "receipt.json";value = json.loads(receipt.read_text())
    require(value.get("nativeActionSucceeded") and not value.get("hasFailedCohorts") and value.get("selectedMethods") == COHORTS, "Instrumentation failed/incomplete; adb exit alone is not a verdict")
    methods = [native_method({"path": str(receipt), "sha256": digest(receipt), "format": "android_receipt", "method": name, "maximumSeconds": 180}) for name in COHORTS]
    session.run("density", selected + ["shell", "wm", "density"], 15)
    oracle = bound_file(config["paintOracle"])
    session.run("paint", [os.sys.executable, "-B", ROOT / "MeterG02AndroidTests.py", "--input", directory, "--out", session.output / "paint", "--density", session.output / "density.stdout", "--paint-oracle", oracle, "--deadline-unix", str(session.work)], 90)
    return {"status": "NATIVE_AND_PAINT_ASSERTIONS_PASSED_PENDING_VISUAL_REVIEW", "methods": methods}


def cleanup(session, config):
    if not session.guest_owned: return
    if config["platform"] == "ios":
        session.run("shutdown", [XCODE + "/simctl", "shutdown", config["destination"]], 45, True)
        state = Path.home() / "Library/Developer/CoreSimulator/Devices" / config["destination"] / "device.plist"
        require(plistlib.loads(state.read_bytes())["state"] == 1, "Simulator shutdown not verified")
    else:
        adb = [str(Path(config["sdk"]) / "platform-tools/adb")]
        try: session.run("emulator-shutdown", adb + ["-s", config["destination"], "emu", "kill"], 15, True)
        except ValueError as error: write(session.output / "shutdown-transport-warning.json", {"error": str(error), "verdict": "Owned group,serial and port checks below determine actual cleanup"})
        finally:
            require(stop_owned_process(session.emulator), "Owned emulator group remains")
        until = min(time.time() + 30, session.end - 15)
        for attempt in range(30):
            if config["destination"] not in session.run("devices-after-" + str(attempt), adb + ["devices"], 5, True): break
            require(time.time() < until, "Emulator serial remains")
            time.sleep(1)
        else: raise ValueError("Emulator transport detachment not verified")
        for port in [int(config["destination"].split("-")[1]), int(config["destination"].split("-")[1]) + 1]:
            with socket.socket() as probe: require(probe.connect_ex(("127.0.0.1", port)) != 0, "Emulator port remains open")


def execute(plan, admission):
    config = plan["nativeStandard"]
    require(config["platform"] in ["ios", "android"] and config["action"] in ["build", "run"] and config.get("batch") == "meter-g02", "Unknown standard SDK operation/batch")
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
    admission = load_admission(__file__, plan["cell"], selection(plan["nativeStandard"]["platform"]))
    require(json.loads(Path(admission["path"]).read_text())["planSHA256"] == digest(args.plan), "Plan changed after admission")
    return execute(plan, admission)


if __name__ == "__main__":
    raise SystemExit(main())
