"""Finite packet-bound standard Release observer build; no guest actions."""
import datetime
import hashlib
import json
from pathlib import Path
import signal
import subprocess
import sys
import time

PACKET_PATH = Path(sys.argv[1]).resolve() if __name__ == "__main__" else None
PACKET = json.loads(PACKET_PATH.read_text()) if PACKET_PATH is not None else None
ROOT = Path(PACKET["buildRoot"]).resolve() if PACKET is not None else None
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
utc = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
write = lambda path, value: path.write_text(json.dumps(value, indent=2) + "\n")


def interrupted(signum, _frame):
    raise InterruptedError("Received signal " + str(signum))


def cutoff(_signum, _frame):
    raise TimeoutError("Admitted observer work deadline reached; cleanup remains reserved")


if __name__ == "__main__":
    assert not any((ROOT / name).exists() for name in ["observer-build.log", "observer-build-result.json", "observer-build-active.json", "observer-identity.json", "observer-derived-data"]), "Never overwrite an uncertain observer build"
    from NativeXCTestBatch import read_bound, validate_packet, validate_selection
    app = validate_packet(PACKET)
    request = json.loads(read_bound(PACKET["buildRequest"]).read_text())
    sys.dont_write_bytecode = True
    sys.path.insert(0, PACKET["supportRoot"])
    from NativeCellVerification import load_admission
    request["cellPreflight"] = load_admission(__file__, PACKET["cell"], {"ios": PACKET["selectedMethods"], "android": []})
    assert request["selectedMethods"] == PACKET["selectedMethods"] and request["compiledMethods"] == PACKET["compiledMethods"]
    validate_selection(request["selectedMethods"], request["compiledMethods"])
    assert request["workers"] == 1 and request["argv"][1] == "build-for-testing"
    for flag, value in [("-jobs", "1"), ("-configuration", "Release"), ("-sdk", "iphonesimulator"), ("-parallel-testing-enabled", "NO")]:
        assert request["argv"].count(flag) == 1 and request["argv"][request["argv"].index(flag) + 1] == value
    assert request["productManifestSHA256"] == app["manifestSHA256"]
    assert request["cwd"] == str(ROOT / "observer")
    assert request["argv"][request["argv"].index("-project") + 1] == str(ROOT / "observer/CodonNativeComponents.xcodeproj")
    assert request["argv"][request["argv"].index("-derivedDataPath") + 1] == str(ROOT / "observer-derived-data")
    assert request["compiledSources"] == ["CodonNativeComponents.swift"]
    assert sha(Path(request["sourcePath"])) == request["sourceSHA256"]
    assert request["sourceInputSHA256"] == {"CodonNativeComponents.swift": request["sourceSHA256"]}
    assert request["projectFilesSHA256"]["CodonNativeComponents.swift"] == request["sourceSHA256"]
    for relative, digest in request["projectFilesSHA256"].items():
        assert sha(ROOT / "observer" / relative) == digest, relative
    assert list((ROOT / "observer").glob("*.swift")) == [ROOT / "observer/CodonNativeComponents.swift"]
    from NativeAndroidTestSupport import stop_owned_process
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGALRM, cutoff)
    started = time.monotonic()
    attempt = request["cellPreflight"]["attempt"]
    work_seconds = attempt["maximumSeconds"] - attempt["cleanupReserveSeconds"]
    signal.setitimer(signal.ITIMER_REAL, work_seconds)
    process = None
    code = None
    failure = None
    cleanup_error = None
    group_gone = True
    timed_out = False
    try:
        with (ROOT / "observer-build.log").open("x") as log:
            process = subprocess.Popen(request["argv"], cwd=request["cwd"], stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            write(ROOT / "observer-build-active.json", {**request, "startedUTC": utc(), "pid": process.pid, "pgid": process.pid, "workers": 1})
            print(json.dumps({"startedUTC": utc(), "pid": process.pid, "argv": request["argv"]}), flush=True)
            code = process.wait(timeout=max(0.01, work_seconds - (time.monotonic() - started)))
        assert code == 0, code
        product = ROOT / "observer-derived-data/Build/Products/Release-iphonesimulator/CodonNativeComponents-Runner.app"
        files = {str(path.relative_to(product)): sha(path) for path in sorted(product.rglob("*")) if path.is_file()}
        prior = json.loads(read_bound(PACKET["retainedObserverIdentity"]).read_text())
        assert set(files) == set(prior["filesSHA256"]) and len(files) == PACKET["observerFileCount"], "Unexpected observer product file set"
        stable = {key: digest for key, digest in prior["filesSHA256"].items() if not key.startswith("PlugIns/")}
        assert all(files[key] == digest for key, digest in stable.items()), "Retained runner host/framework bytes changed"
        changed = sorted(key for key in files if files[key] != prior["filesSHA256"][key])
        manifest = hashlib.sha256(json.dumps(files, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        identity = {"product": str(product), "manifestSHA256": manifest, "filesSHA256": files,
                    "fixtureSHA256": request["sourceSHA256"], "observerSourceSHA256": request["sourceSHA256"],
                    "sourcePath": request["sourcePath"], "sourceInputSHA256": request["sourceInputSHA256"],
                    "cell": PACKET["cell"], "sourceScope": PACKET["sourceScope"], "retainedHarnessScope": PACKET["retainedHarnessScope"],
                    "productManifestSHA256": request["productManifestSHA256"], "selectedMethods": request["selectedMethods"], "compiledMethods": request["compiledMethods"],
                    "changedFromRetainedTextObserver": changed, "retainedHostAndFrameworkFilesExact": len(stable),
                    "guestActions": 0, "witnessProductSourceRevision": app["sourceRevision"], "buildRequestSHA256": sha(read_bound(PACKET["buildRequest"]))}
    except subprocess.TimeoutExpired:
        timed_out = True
        failure = "Observer command timeout"
        raise
    except BaseException as error:
        failure = repr(error)
        raise
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        try:
            if process is not None:
                group_gone = stop_owned_process(process)
        except BaseException as error:
            cleanup_error = repr(error)
        finally:
            code = process.poll() if process is not None else code
            result = {"finishedUTC": utc(), "seconds": time.monotonic() - started, "exitCode": code,
                      "groupGone": group_gone, "withinBoundary": time.monotonic() - started < attempt["maximumSeconds"],
                      "guestActions": 0, "timedOut": timed_out, "failure": failure, "cleanupError": cleanup_error}
            write(ROOT / "observer-build-result.json", result)
            print(json.dumps(result), flush=True)
    assert code == 0 and group_gone and result["withinBoundary"] and not timed_out and failure is None and cleanup_error is None, result
    write(ROOT / "observer-identity.json", identity)
    print("OBSERVER_PASS " + json.dumps({"manifestSHA256": identity["manifestSHA256"], "files": PACKET["observerFileCount"], "sourceSHA256": request["sourceSHA256"]}), flush=True)
