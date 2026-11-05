"""Root-only adaptation of the proven Text observer build; preparation is not execution."""
import datetime
import hashlib
import json
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(sys.argv[1]).resolve()
REPO = Path(__file__).resolve().parents[4]
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
utc = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
write = lambda path, value: path.write_text(json.dumps(value, indent=2) + "\n")


def interrupted(signum, _frame):
    raise InterruptedError("Received signal " + str(signum))


def cutoff(_signum, _frame):
    raise TimeoutError("Mechanical240s observer work cutoff;60s cleanup reserved")


def validate_observer_selection(request):
    probe = "IndicatorG04AXInitializationProbe/testAXInitializationOnly"
    selected = request["selectedMethods"]
    compiled = request["compiledMethods"]
    assert len(compiled) in [11, 12] and len(set(compiled)) == len(compiled)
    assert all(method in compiled for method in selected)
    assert (len(compiled) == 12) == (probe in compiled)
    if selected == [probe]:
        assert request.get("purpose") == "AX_STARTUP_DIAGNOSTIC_ONLY"
    else:
        assert selected == ["IndicatorG04TrialTests/testI10ShapeGeometry", "IndicatorG04TrialTests/testI11CallbackFinalStyle"]


if __name__ == "__main__":
    assert not any((ROOT / name).exists() for name in ["observer-build.log", "observer-build-result.json", "observer-build-active.json", "observer-identity.json", "observer-derived-data"]), "Never overwrite an uncertain observer build"
    request = json.loads((ROOT / "observer-build-request.json").read_text())
    sys.path.insert(0, str(REPO / "planning/component-library/fixtures/native-base-controls"))
    from NativeCellVerification import load_admission
    request["cellPreflight"] = load_admission(__file__, "CAT.indicator.G04", {"ios": request["selectedMethods"], "android": []})
    app = json.loads((ROOT / "product-identity.json").read_text())
    assert app["indicatorFixtureSHA256"] == request["indicatorFixtureSHA256"] and app["displaySceneSHA256"] == request["displaySceneSHA256"]
    request["productManifestSHA256"] = app["manifestSHA256"]
    assert request["compiledSources"] == ["CodonNativeComponents.swift"]
    validate_observer_selection(request)
    assert app["sourceRevision"] == request["witnessProductSourceRevision"] == "199492e878712c5fe22ec07ad758b901fdd8245f"
    assert request["standaloneNativePaintOracleCompiled"] is False
    assert sha(Path(request["sourcePath"])) == request["sourceSHA256"]
    for relative, digest in request["projectFilesSHA256"].items():
        assert sha(ROOT / "observer" / relative) == digest, relative
    assert list((ROOT / "observer").glob("*.swift")) == [ROOT / "observer/CodonNativeComponents.swift"]
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(REPO / "planning/component-library/fixtures/native-base-controls"))
    helper = REPO / "planning/component-library/fixtures/native-base-controls/NativeAndroidTestSupport.py"
    expected = json.loads((ROOT / "preparation-inputs.json").read_text())["repositoryFilesSHA256"]
    assert sha(helper) == expected[str(helper.relative_to(REPO))]
    from NativeAndroidTestSupport import stop_owned_process
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGALRM, cutoff)
    started = time.monotonic()
    signal.setitimer(signal.ITIMER_REAL, 240)
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
            code = process.wait(timeout=max(0.01, 240 - (time.monotonic() - started)))
        assert code == 0, code
        product = ROOT / "observer-derived-data/Build/Products/Release-iphonesimulator/CodonNativeComponents-Runner.app"
        files = {str(path.relative_to(product)): sha(path) for path in sorted(product.rglob("*")) if path.is_file()}
        prior = json.loads(Path("/tmp/codon-text-g02-context-ios-20261104/observer-identity.json").read_text())
        assert set(files) == set(prior["filesSHA256"]) and len(files) == 37, "Unexpected observer product file set"
        stable = {key: digest for key, digest in prior["filesSHA256"].items() if not key.startswith("PlugIns/")}
        assert all(files[key] == digest for key, digest in stable.items()), "Retained runner host/framework bytes changed"
        changed = sorted(key for key in files if files[key] != prior["filesSHA256"][key])
        manifest = hashlib.sha256(json.dumps(files, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        identity = {"product": str(product), "manifestSHA256": manifest, "filesSHA256": files,
                    "fixtureSHA256": request["sourceSHA256"], "observerSourceSHA256": request["sourceSHA256"],
                    "sourcePath": request["sourcePath"], "sourceInputSHA256": request["sourceInputSHA256"],
                    "indicatorFixtureSHA256": request["indicatorFixtureSHA256"], "displaySceneSHA256": request["displaySceneSHA256"],
                    "productManifestSHA256": request["productManifestSHA256"], "selectedMethods": request["selectedMethods"], "compiledMethods": request["compiledMethods"],
                    "changedFromRetainedTextObserver": changed, "retainedHostAndFrameworkFilesExact": len(stable),
                    "standaloneNativePaintOracleCompiled": False, "guestActions": 0, "witnessProductSourceRevision": request["witnessProductSourceRevision"]}
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
                      "groupGone": group_gone, "withinBoundary": time.monotonic() - started < 300,
                      "guestActions": 0, "timedOut": timed_out, "failure": failure, "cleanupError": cleanup_error}
            write(ROOT / "observer-build-result.json", result)
            print(json.dumps(result), flush=True)
    assert code == 0 and group_gone and result["withinBoundary"] and not timed_out and failure is None and cleanup_error is None, result
    write(ROOT / "observer-identity.json", identity)
    print("OBSERVER_PASS " + json.dumps({"manifestSHA256": identity["manifestSHA256"], "files": 37, "sourceSHA256": request["sourceSHA256"]}), flush=True)
