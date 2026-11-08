"""One admitted plan, stable SDK test targets, and one deadline/cleanup owner."""
import argparse
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import plistlib
import re
import signal
import shutil
import socket
import struct
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


def verify_selected_app_inputs(plan, app):
    recorded = app.get("sourceFilesSHA256")
    if recorded is None:
        return {"status": "LEGACY_IDENTITY_REQUIRES_SEPARATE_SOURCE_MAP_REVIEW", "scope": "No retrospective source admission claim for older cached product formats"}
    repository = REPO.resolve()
    recorded = {str((repository / path).resolve()): value for path, value in recorded.items()}
    selected = []
    for group in ["source", "fixture"]:
        for item in plan["bindings"][group]:
            path = Path(item["path"]).resolve()
            if path.suffix in [".ts", ".tsx"] and not any(part in ["__tests__", "__mocks__"] for part in path.parts) and ".test." not in path.name and ".spec." not in path.name and any(path.is_relative_to(repository / root) for root in ["apps/native-showcase/src", "packages/react-native/src"]):
                require(recorded.get(str(path)) == item["sha256"], "Selected application source differs from prepared product: " + str(path))
                selected.append(str(path))
    require(selected, "Prepared source-aware app needs selected runtime source bindings")
    return {"status": "PASS", "matchedSelectedSources": selected, "scope": "Selected library/fixture inputs only; unrelated source does not invalidate reuse"}


def selection(platform, batch="meter-g02"):
    if batch in ["tooltip","tooltip-ownership","tooltip-styles","tooltip-motion"]:
        require(platform=="ios","Current Tooltip batch is iOS only")
        methods=["testTooltipOwnershipDelayAndLifetime","testTooltipStylesAndConstraint","testTooltipMotionAndRetirement"] if batch=="tooltip" else [{"tooltip-ownership":"testTooltipOwnershipDelayAndLifetime","tooltip-styles":"testTooltipStylesAndConstraint","tooltip-motion":"testTooltipMotionAndRetirement"}[batch]]
        return {"ios":["TooltipTrialTests/"+method for method in methods],"android":[]}
    if batch in ["link","link-static","link-actions"]:
        require(platform=="ios","Current Link batch is iOS only")
        return {"ios":["LinkTrialTests/"+name for name in (["testLinkActionsAndLifetimes"]+([] if batch=="link-actions" else ["testLinkStylesAndConstraints"])+(["testLinkMotionAndRetirement"] if batch=="link" else []))],"android":[]}
    if batch in ["button","button-motion"]:
        require(platform=="ios","Current Button batch is iOS only")
        return {"ios":(["ButtonTrialTests/testButtonActionsAndLifetimes","ButtonTrialTests/testButtonStylesAndConstraints"] if batch=="button" else [])+["ButtonTrialTests/testButtonMotionAndRetirement"],"android":[]}
    if batch=="radio-group":
        require(platform=="ios","Current RadioGroup batch is iOS only")
        return {"ios":["RadioGroupTrialTests/testRadioGroupActionsAndLifetimes","RadioGroupTrialTests/testRadioGroupStylesAndConstraints"],"android":[]}
    if batch in ["checkbox-group","checkbox-group-actions"]:
        require(platform == "ios", "Current CheckboxGroup batch is iOS only")
        return {"ios":["CheckboxGroupTrialTests/testCheckboxGroupActionsAndLifetimes"]+([] if batch=="checkbox-group-actions" else ["CheckboxGroupTrialTests/testCheckboxGroupStylesAndConstraints"]),"android":[]}
    if batch in ["checkbox","checkbox-static","checkbox-motion"]:
        require(platform == "ios", "Current Checkbox batch is iOS only")
        names=["testCheckboxMotionAndRetirement"] if batch=="checkbox-motion" else ["testCheckboxActionsAndLifetimes","testCheckboxStylesAndConstraints"]+([] if batch=="checkbox-static" else ["testCheckboxMotionAndRetirement"])
        return {"ios":["CheckboxTrialTests/"+name for name in names],"android":[]}
    if batch in ["switch", "switch-motion"]:
        require(platform == "ios", "Current Switch batch is iOS only")
        return {"ios": ["SwitchTrialTests/"+name for name in (["testSwitchMotionAndRetirement"] if batch == "switch-motion" else ["testSwitchActionsAndLifetimes", "testSwitchStylesAndConstraints", "testSwitchMotionAndRetirement"])], "android": []}
    if batch == "slider-hit-layout":
        require(platform == "ios", "Current Slider hit-layout batch is iOS only")
        return {"ios": ["SliderHitLayoutTrialTests/"+name for name in ["testP01TranslatedOriginalThumbHoldThenDrag", "testP01RepositionedOriginalThumbHoldThenDrag", "testP01RotatedCenterOriginalThumbHoldThenDrag", "testP01RotatedCornerFollowsOriginalNativeHit"]], "android": []}
    if batch == "placeholder-g08":
        require(platform == "ios", "Current PlaceholderText batch is iOS only")
        return {"ios": ["PlaceholderTrialTests/"+name for name in ["testP01LightStylePrecedenceAndRestore", "testP02DarkProviderExplicitAndEmptyReset", "testP03NarrowWrappedFirstActionAndReset"]], "android": []}
    if batch in ["radio", "radio-motion"]:
        require(platform == "ios", "Current Radio batch is iOS only")
        return {"ios": ["RadioTrialTests/" + name for name in (["testRadioMotionAndRetirement"] if batch == "radio-motion" else ["testRadioActionsAndLifetimes", "testRadioStylesAndConstraints", "testRadioMotionAndRetirement"])], "android": []}
    if batch in ["toggle-button", "toggle-button-affected", "toggle-button-style"]:
        require(platform == "ios", "Current ToggleButton batch is iOS only")
        return {"ios": (["ToggleButtonTrialTests/testToggleButtonStylesAndConstraints"] if batch == "toggle-button-style" else ["ToggleButtonTrialTests/testToggleButtonActionsAndLifetimes", "ToggleButtonTrialTests/testToggleButtonStylesAndConstraints"] + ([] if batch == "toggle-button-affected" else ["ToggleButtonTrialTests/testToggleButtonMotionAndRetirement"])), "android": []}
    if batch in ["list-box-item", "list-box-item-motion"]:
        require(platform == "ios", "Current ListBoxItem batch is iOS only")
        return {"ios": ["ListBoxItemTrialTests/testListBoxItemMotionAndRetirement"] if batch == "list-box-item-motion" else ["ListBoxItemTrialTests/testListBoxItemActionsAndLifetimes", "ListBoxItemTrialTests/testListBoxItemStylesAndConstraints", "ListBoxItemTrialTests/testListBoxItemMotionAndRetirement"], "android": []}
    if batch == "avatar":
        require(platform == "ios", "Current Avatar batch is iOS only")
        return {"ios": ["AvatarTrialTests/testAvatarImagesActionsAndLifetimes", "AvatarTrialTests/testAvatarGeometryStylesAndProviders"], "android": []}
    if batch == "gallery-remaining":
        require(platform == "ios", "Gallery batch is iOS only")
        return {"ios": ["GalleryTrialTests/testGalleryPrimitiveAndRemainingCounts"], "android": []}
    if batch in ["gallery", "gallery-modes", "gallery-styles"]:
        require(platform == "ios", "Gallery batch is iOS only")
        return {"ios": (["GalleryTrialTests/testGalleryModesActionsAndLifetimes"] if batch != "gallery-styles" else []) + (["GalleryTrialTests/testGalleryStylesWidthsAndProviders"] if batch != "gallery-modes" else []), "android": []}
    if batch in ["thumbnail", "thumbnail-geometry"]:
        require(platform == "ios", "Current ThumbnailImage batch is iOS-only")
        return {"ios": (["ThumbnailTrialTests/testThumbnailDecodeFallbackAndLifetime"] if batch == "thumbnail" else []) + ["ThumbnailTrialTests/testThumbnailGeometryDensityAndProviders"], "android": []}
    if batch in ["counter", "counter-values"]:
        require(platform == "ios", "Current Counter batch is iOS-only")
        return {"ios": ["CounterTrialTests/testCounterValuesStylesAndProviders"] + (["CounterTrialTests/testCounterColorInterruptionAndRetirement"] if batch == "counter" else []), "android": []}
    if batch == "lagging-lines":
        require(platform == "ios", "Current LaggingLines batch is iOS-only")
        return {"ios": ["LaggingLinesTrialTests/testLaggingLinesGeometryAndProviders", "LaggingLinesTrialTests/testLaggingLinesMotionAndRetirement"], "android": []}
    if batch == "circle-loader":
        require(platform == "ios", "CircleLoader current batch is iOS-only")
        return {"ios": ["CircleLoaderTrialTests/testCircleLoaderGeometryAndProviders", "CircleLoaderTrialTests/testCircleLoaderMotionAndRetirement"], "android": []}
    if batch == "circular-progress-affected":
        require(platform == "ios", "Affected CircularProgress methods are iOS-only")
        return {"ios": ["CircularProgressTrialTests/testCircularGeometrySemanticsAndSlots", "CircularProgressTrialTests/testCircularInterruptionAndRetirement"], "android": []}
    if batch == "circular-progress":
        require(platform in ["ios", "android"], "Unknown CircularProgress platform")
        return {"ios": ["CircularProgressTrialTests/" + name for name in ["testCircularGeometrySemanticsAndSlots", "testCircularProvidersAndConstraint", "testCircularInterruptionAndRetirement"]] if platform == "ios" else [], "android": ["geometry-semantics-slots", "providers-constraint", "interruption-retirement"] if platform == "android" else []}
    if batch == "text-style-context":
        require(platform == "ios", "Focused Text context batch is iOS-only")
        return {"ios": ["TextStyleTrialTests/testTextProviderChange", "TextStyleTrialTests/testTextCompactAndLiveRestoration"], "android": []}
    if batch == "text-style":
        require(platform in ["ios", "android"], "Unknown Text platform")
        return {"ios": ["TextStyleTrialTests/testTextTypographyAndClear", "TextStyleTrialTests/testTextProviderChange", "TextStyleTrialTests/testTextCompactAndLiveRestoration"] if platform == "ios" else [], "android": ["typography", "provider-constraint"] if platform == "android" else []}
    if batch == "linear-progress-risk":
        require(platform in ["ios", "android"], "Unknown risk platform")
        return {"ios": ["MeterStyleTrialTests/testLinearProgressLiveMotion"] if platform == "ios" else [], "android": ["live-motion"] if platform == "android" else []}
    if batch == "meter-style-dimensions":
        require(platform == "android", "Dimensions-only instrumentation is Android-only")
        return {"ios": [], "android": ["dimensions"]}
    if batch == "meter-startup-diagnostic":
        require(platform == "android", "Startup diagnostic is Android-only")
        return {"ios": [], "android": []}
    require(batch in ["meter-g02", "meter-style", "meter-events", "meter-style-zero-width", "meter-style-motion-cleanup", "meter-style-remaining", "meter-style-affected"] and not (batch in ["meter-events", "meter-style-zero-width", "meter-style-motion-cleanup", "meter-style-remaining", "meter-style-affected"] and platform != "ios"), "Unknown standard test selection")
    ios = ["MeterStyleTrialTests/" + name for name in IOS_STYLE_METHODS] if batch == "meter-style" else ["MeterG02TrialTests/" + name for name in (METHODS[-1:] if batch == "meter-events" else METHODS)]
    if batch == "meter-style-zero-width": ios = ["MeterStyleTrialTests/testMeterStyleZeroWidth"]
    if batch == "meter-style-motion-cleanup": ios = ["MeterStyleTrialTests/testRestoreMeterStyleMotionSetting"]
    if batch == "meter-style-remaining": ios = ["MeterStyleTrialTests/" + name for name in IOS_REMAINING_STYLE_METHODS]
    if batch == "meter-style-affected": ios = ["MeterStyleTrialTests/" + name for name in IOS_AFFECTED_STYLE_METHODS]
    return {"ios": ios if platform == "ios" else [], "android": (STYLE_COHORTS if batch == "meter-style" else COHORTS) if platform == "android" else []}


def bind_xctestrun(template, app, observer, output, installed_observer, restore_motion=None, work_deadline=None):
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
    target["TestTimeoutsEnabled"] = False
    for key in ["DefaultTestExecutionTimeAllowance", "MaximumTestExecutionTimeAllowance"]: target.pop(key, None)
    environment = {"CODON_METER_FIXTURE_SHA256": digest(REPO / "apps/native-showcase/src/scenes/MeterG02Fixture.tsx"), "CODON_METER_SCENE_SHA256": digest(REPO / "apps/native-showcase/src/scenes/RangeScene.tsx"), "CODON_METER_PRODUCT_SHA256": app["manifestSHA256"], "CODON_METER_OBSERVER_MANIFEST_SHA256": observer["manifestSHA256"]}
    environment["CODON_METER_STYLE_FIXTURE_SHA256"] = digest(REPO / "apps/native-showcase/src/scenes/MeterStyleFixture.tsx")
    plugin_key="PlugIns/CodonNativeComponents.xctest/CodonNativeComponents"
    if plugin_key in observer.get("filesSHA256",{}): environment["CODON_NATIVE_OBSERVER_EXECUTABLE_SHA256"]=observer["filesSHA256"][plugin_key]
    environment.update(CODON_SLIDER_SCENE_SHA256=digest(REPO / "apps/native-showcase/src/scenes/SliderScene.tsx"), CODON_SLIDER_PRODUCT_SHA256=app["manifestSHA256"], CODON_SLIDER_OBSERVER_MANIFEST_SHA256=observer["manifestSHA256"])
    if restore_motion is not None:
        require(restore_motion in ["0","1"], "Only the captured original Reduce Motion value is accepted")
        environment["CODON_METER_RESTORE_MOTION"] = restore_motion
    if work_deadline is not None:
        require(math.isfinite(work_deadline) and work_deadline > time.time(), "Live admitted work deadline required")
        environment["CODON_NATIVE_WORK_DEADLINE_UNIX"] = str(work_deadline)
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
        self.additional_motion_settings = {}
        self.env = {**os.environ, "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer", "PYTHONDONTWRITEBYTECODE": "1"}

    def remaining(self, cleanup=False):
        return (self.end if cleanup else self.work) - time.time() - 8

    def run(self, name, argv, cap=None, cleanup=False, while_running=None):
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
                if while_running is None:
                    try: process.wait(timeout=timeout)
                    except subprocess.TimeoutExpired: row["timedOut"] = True
                else:
                    until = time.monotonic() + timeout
                    while process.poll() is None:
                        if time.monotonic() >= until:
                            row["timedOut"] = True
                            break
                        while_running()
                        try: process.wait(timeout=min(.1, max(.001, until-time.monotonic())))
                        except subprocess.TimeoutExpired: pass
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
    circle_start = source.index("private func circularPixelsMatch(");circle_open = source.index("{",circle_start);circle_end=source.index("\n}",circle_open)+2
    circle_predicate = source[circle_start:circle_end].replace("private ","",1)
    image_start = source.index("private func thumbnailImageContentFrame(");image_open = source.index("{", image_start);image_depth = 1;image_end = image_open + 1
    while image_depth:
        image_depth += (source[image_end] == "{") - (source[image_end] == "}");image_end += 1
    image_predicate = source[image_start:image_end].replace("private ", "", 1)
    gallery_start = source.index("private func galleryTrackWidth(");gallery_open = source.index("{", gallery_start);gallery_end = source.index("\n}", gallery_open) + 2
    gallery_predicate = source[gallery_start:gallery_end].replace("private ", "", 1)
    list_predicates = []
    for signature in ["private func toggleButtonMatchedFrame(", "private func toggleButtonValueMatches(", "private func listItemValueMatches(", "private func listItemIntermediate(", "private func listItemSampleRGBA(", "private func switchNativeValueMatches(", "private func switchTrackSamples(", "private func switchThumbIntermediate(", "private func switchEndpointCoverage(", "private func switchRetirementCoverage(", "private func checkboxWhitePixels(", "private func checkboxNativeValueMatches(", "private func checkboxColorIntermediate(", "private func checkboxGlyphIntermediate(", "private func checkboxGlyphCoverage(", "private func checkboxEndpointCoverage(", "private func checkboxRetirementCoverage(", "private func checkboxGroupMembersMatch(", "private func checkboxGroupMemberTag(", "private func radioGroupMembersMatch(", "private func buttonShadowIntermediate(", "private func buttonMotionReferenceIndex(", "private func linkGlyphCounts(", "private func linkReferenceIndex("]:
        start = source.index(signature);opening = source.index("{", start);end = source.index("\n}", opening) + 2
        list_predicates.append(source[start:end].replace("private ", "", 1))
    scroll_start = source.index("private func galleryScrollFraction(");scroll_open = source.index("{", scroll_start);scroll_end = source.index("\n}", scroll_open) + 2
    scroll_predicate = source[scroll_start:scroll_end].replace("private ", "", 1)
    return "import Foundation\n" + "\n".join(list_predicates) + "\n" + scroll_predicate + "\n" + gallery_predicate + "\n" + predicate + "\n" + pixel_predicate + "\n" + shadow_predicate + "\n" + circle_predicate + "\n" + image_predicate + "\n" + '''
precondition(toggleButtonMatchedFrame([26,328,280,224],[26,327.999958,280,224],3))
precondition(!toggleButtonMatchedFrame([26,328,280,224],[26,559.999958,280,224],3))
precondition(!toggleButtonMatchedFrame([26,328,280,224],[26+1.0/3,328,280,224],3))
precondition(!toggleButtonMatchedFrame([26,328,280,224],[26,328,280,223.0],3))
precondition(!toggleButtonMatchedFrame([26,328,280,224],[26,328,280,224],0))
precondition(!toggleButtonMatchedFrame([26,328,280,224],[26,Double.nan,280,224],3))
precondition(toggleButtonValueMatches("checked",true,false))
precondition(toggleButtonValueMatches("unchecked",false,false))
precondition(toggleButtonValueMatches("radio button, checked",true,true))
precondition(!toggleButtonValueMatches("unchecked",true,false))
precondition(!toggleButtonValueMatches("radio button, checked",true,false))
precondition(!toggleButtonValueMatches("checked",true,true))
let deliveredSample:[String:Any] = ["sampleRGBA":[UInt8]([127,74,39,255])]
precondition(deliveredSample["sampleRGBA"] as? [Int] == nil)
let normalizedSample:[String:Any] = ["sampleRGBA":listItemSampleRGBA([127,74,39,255,17,119,51,255])]
precondition(normalizedSample["sampleRGBA"] as? [Int] == [127,74,39,255])
precondition(listItemIntermediate(normalizedSample["sampleRGBA"] as! [Int]))
precondition(listItemSampleRGBA([]).isEmpty)
precondition(listItemValueMatches("radio button, checked",true))
precondition(listItemValueMatches("radio button, unchecked",false))
precondition(!listItemValueMatches("radio button, unchecked",true))
precondition(!listItemValueMatches("radio button, checked",false))
precondition(!listItemValueMatches("checkbox, checked",true))
precondition(!listItemValueMatches("radio button, mixed",true))
precondition(!listItemValueMatches("radio button",false))
precondition(!listItemValueMatches("radio button, checked, unchecked",true))
precondition(listItemIntermediate([102,85,42,255]))
precondition(!listItemIntermediate([17,119,51,255]))
precondition(!listItemIntermediate([187,51,34,255]))
precondition(!listItemIntermediate([102,85,0,255]))
precondition(!listItemIntermediate([102,85,42,0]))
precondition(!listItemIntermediate([102,85,42]))
precondition(!listItemIntermediate([255,255,255,255]))
precondition(!listItemIntermediate([102,85,256,255]))
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
precondition(circularPixelsMatch([1,2,3,255],[1,2,3,255]))
precondition(!circularPixelsMatch([],[]))
precondition(!circularPixelsMatch([1],[1]))
precondition(!circularPixelsMatch([1,2,3,255],[1,2,4,255]))
precondition(!circularPixelsMatch([1,2,3,255],[1,2,3,254]))
precondition(!circularPixelsMatch([1,2,3,255],[1,2,3,255,1,2,3,255]))
precondition(galleryScrollFraction(8,600,49,759)! < 0 && galleryScrollFraction(8,600,49,759)! > -0.35)
precondition(galleryScrollFraction(300,600,49,759)! > 0 && galleryScrollFraction(300,600,49,759)! < 0.35)
precondition(galleryScrollFraction(2000,600,49,759) == 0.35)
precondition(galleryScrollFraction(-2000,600,49,759) == -0.35)
precondition(galleryScrollFraction(0,800,49,759) == nil)
precondition(galleryScrollFraction(Double.nan,600,49,759) == nil)
precondition(galleryScrollFraction(0,0,49,759) == nil)
precondition(galleryScrollFraction(0,600,49,0) == nil)
precondition(galleryTrackWidth(280,10,4) == 62.5)
precondition(galleryTrackWidth(280,10,2) == 135)
precondition(abs(galleryTrackWidth(280,10,3)! - 86.66666666666667) < 0.0000001)
precondition(galleryTrackWidth(246,8,4) == 55.5)
precondition(galleryTrackWidth(0,10,4) == 0)
precondition(galleryTrackWidth(-1,10,4) == nil)
precondition(galleryTrackWidth(280,10,0) == nil)
precondition(galleryTrackWidth(280,Double.nan,4) == nil)
precondition(thumbnailImageContentFrame([38,242,120,80],2) == [40,244,116,76])
precondition(thumbnailImageContentFrame([38,242,48,24],0) == [38,242,48,24])
precondition(thumbnailImageContentFrame([0,0,83.25,41.625],2) == [2,2,79.25,37.625])
precondition(thumbnailImageContentFrame([0,0,2,2],2) == nil)
precondition(thumbnailImageContentFrame([0,0,120,80],-1) == nil)
precondition(thumbnailImageContentFrame([0,0,Double.nan,80],2) == nil)
let switchValues:[(Any?,Bool,Bool)]=[("0",false,true),("1",true,true),(NSNumber(value:0),false,true),(NSNumber(value:1),true,true),("checked",true,false),("1",false,false),(NSNumber(value:2),true,false),(NSNumber(value:Double.nan),false,false),(nil,false,false),("",false,false)]
for (value,selected,expected) in switchValues{precondition(switchNativeValueMatches(value,selected)==expected)}
let white:[UInt8]=[255,255,255,255],red:[UInt8]=[187,51,34,255]
precondition(switchTrackSamples(white+white+red+red)?.0 == [0,2])
precondition(switchTrackSamples(red+red+white+white)?.0 == [2,2])
precondition(switchTrackSamples(red+white+white+red)?.0 == [1,2])
precondition(switchTrackSamples(white+red+white+white+red)?.0 == [2,2])
precondition(switchTrackSamples(white+white+red+red)?.1 == [187,51,34,255])
precondition(switchTrackSamples([]) == nil)
precondition(switchTrackSamples([1]) == nil)
precondition(switchTrackSamples(white+white) == nil)
precondition(switchTrackSamples(red+red) == nil)
let savedSwitchScale:CGFloat=3
let savedSwitchRow:[String:Any]=["thumbRun":[11,43],"scale":savedSwitchScale]
precondition((savedSwitchRow["scale"] as? Double)==nil)
precondition(!switchThumbIntermediate(savedSwitchRow))
let correctedSwitchRow:[String:Any]=["thumbRun":[11,43],"scale":Double(savedSwitchScale)]
precondition(switchThumbIntermediate(correctedSwitchRow))
for row:[String:Any] in [["thumbRun":[1,43],"scale":3.0],["thumbRun":[46,43],"scale":3.0],["thumbRun":[11],"scale":3.0],["thumbRun":[11,43],"scale":Double.nan],["thumbRun":[11,43],"scale":0.0],["thumbRun":[11,43],"scale":-1.0],["thumbRun":[11,43]],["thumbRun":[11,43],"scale":"3"]]{precondition(!switchThumbIntermediate(row))}
func endpointRow(_ start:Double,_ end:Double,_ exact:Bool=true)->[String:Any]{["captureStartedEpochMs":start,"captureEpochMs":end,"referenceExact":exact]}
let endpointSettled=endpointRow(8000,8100),endpointFresh=endpointRow(14000,14100)
precondition(switchEndpointCoverage([endpointSettled,endpointFresh],7000,10000,13000))
precondition(!switchEndpointCoverage([],7000,10000,13000))
precondition(!switchEndpointCoverage([endpointFresh],7000,10000,13000))
precondition(!switchEndpointCoverage([endpointSettled],7000,10000,13000))
precondition(!switchEndpointCoverage([endpointRow(7100,7200),endpointFresh],7000,10000,13000))
precondition(!switchEndpointCoverage([endpointRow(9900,10010),endpointFresh],7000,10000,13000))
precondition(!switchEndpointCoverage([endpointRow(8000,8100,false),endpointFresh],7000,10000,13000))
precondition(!switchEndpointCoverage([endpointSettled,endpointRow(14000,14100,false)],7000,10000,13000))
precondition(!switchEndpointCoverage([endpointSettled,endpointRow(14000,13900)],7000,10000,13000))
precondition(!switchEndpointCoverage([endpointSettled,endpointRow(Double.nan,14100)],7000,10000,13000))
func retirementRow(_ start:Double,_ end:Double,_ actual:Int,_ reference:Int)->[String:Any]{["captureStartedEpochMs":start,"captureEpochMs":end,"inkPixels":actual,"referenceInkPixels":reference,"thumbRun":actual==0 ? []:[46,43],"sampleRGBA":actual==0 ? []:[17,119,51,255]]}
let retiringLive=retirementRow(10014,10508,2201,2201),retiringGone=retirementRow(10633,11075,0,0)
precondition(switchRetirementCoverage([retiringLive,retiringGone],10000,13000))
precondition(switchRetirementCoverage([retiringGone],10000,13000))
precondition(!switchRetirementCoverage([retiringLive],10000,13000))
precondition(!switchRetirementCoverage([retirementRow(10633,11075,2201,0)],10000,13000))
precondition(!switchRetirementCoverage([retiringGone,retirementRow(11200,11700,0,2201)],10000,13000))
precondition(!switchRetirementCoverage([retiringGone,retirementRow(11200,11700,2201,0)],10000,13000))
precondition(!switchRetirementCoverage([retirementRow(13200,13700,0,0)],10000,13000))
precondition(!switchRetirementCoverage([retirementRow(12900,13100,0,0)],10000,13000))
var retiringMissing=retiringGone;retiringMissing.removeValue(forKey:"referenceInkPixels");precondition(!switchRetirementCoverage([retiringMissing],10000,13000))
precondition(!switchRetirementCoverage([retirementRow(10633,11075,1,0)],10000,13000))
var retiringThumb=retiringGone;retiringThumb["thumbRun"]=[1,43];precondition(!switchRetirementCoverage([retiringThumb],10000,13000))
var retiringColor=retiringGone;retiringColor["sampleRGBA"]=[17,119,51,255];precondition(!switchRetirementCoverage([retiringColor],10000,13000))
precondition(!switchRetirementCoverage([retirementRow(11075,10633,0,0)],10000,13000))
precondition(!switchRetirementCoverage([retirementRow(Double.nan,11075,0,0)],10000,13000))

let checkboxLive:[String:Any]=["captureStartedEpochMs":10014.0,"captureEpochMs":10508.0,"inkPixels":2201,"referenceInkPixels":2201,"glyphPixels":20,"sampleRGBA":[17,119,51,255]]
let checkboxGone:[String:Any]=["captureStartedEpochMs":10633.0,"captureEpochMs":11075.0,"inkPixels":0,"referenceInkPixels":0,"glyphPixels":0,"sampleRGBA":[Int]()]
let checkboxWhite:[String:Any]=["referenceSampleRGBA":[255,255,255,255],"sampleRGBA":[255,255,255,255],"referenceGlyphPixels":2196,"glyphPixels":2196]
let checkboxFull:[String:Any]=["referenceSampleRGBA":[17,119,51,255],"sampleRGBA":[17,119,51,255],"referenceGlyphPixels":275,"glyphPixels":275]
let checkboxPartial:[String:Any]=["referenceSampleRGBA":[17,119,51,255],"sampleRGBA":[102,136,153,255],"referenceGlyphPixels":275,"glyphPixels":100]
precondition(checkboxGlyphCoverage([checkboxPartial],[checkboxWhite,checkboxFull,checkboxPartial]))
precondition(!checkboxGlyphCoverage([checkboxFull],[checkboxWhite,checkboxFull]))
precondition(!checkboxGlyphCoverage([checkboxWhite],[checkboxWhite,checkboxFull]))
precondition(!checkboxGlyphCoverage([checkboxPartial],[checkboxWhite]))
var checkboxInconsistent=checkboxFull;checkboxInconsistent["referenceGlyphPixels"]=276
precondition(!checkboxGlyphCoverage([checkboxPartial],[checkboxFull,checkboxInconsistent]))
var checkboxFakePartial=checkboxWhite;checkboxFakePartial["glyphPixels"]=100
precondition(!checkboxGlyphCoverage([checkboxFakePartial],[checkboxWhite,checkboxFull]))
precondition(checkboxWhitePixels([255,255,255,255])==1)
precondition(checkboxWhitePixels([17,119,51,255])==0)
precondition(checkboxWhitePixels([17,119,51,255,255,255,255,255])==1)
precondition(checkboxWhitePixels([255,255,255,254])==0)
precondition(checkboxWhitePixels([255,255,255]) == -1)
precondition(checkboxWhitePixels([])==0)
precondition(checkboxNativeValueMatches("checkbox, unchecked",false,false))
precondition(checkboxNativeValueMatches("checkbox, checked",true,false))
precondition(checkboxNativeValueMatches("checkbox, mixed",false,true))
precondition(checkboxNativeValueMatches("checkbox, mixed",true,true))
precondition(!checkboxNativeValueMatches("radio button, checked",true,false))
precondition(!checkboxNativeValueMatches("checkbox, unchecked",true,false))
precondition(!checkboxNativeValueMatches("checkbox, checked",true,true))
precondition(!checkboxNativeValueMatches("checkbox, mixed, busy",true,true))
precondition(!checkboxNativeValueMatches(nil,false,false))
precondition(checkboxColorIntermediate([102,136,153,255],[17,119,51,255],[238,240,242,255]))
precondition(!checkboxColorIntermediate([17,119,51,255],[17,119,51,255],[238,240,242,255]))
precondition(!checkboxColorIntermediate([0,136,153,255],[17,119,51,255],[238,240,242,255]))
precondition(!checkboxColorIntermediate([102,136,153,254],[17,119,51,255],[238,240,242,255]))
precondition(!checkboxColorIntermediate([],[17,119,51,255],[238,240,242,255]))
precondition(checkboxGlyphIntermediate([["glyphPixels":12]],24))
precondition(!checkboxGlyphIntermediate([["glyphPixels":0]],24))
precondition(!checkboxGlyphIntermediate([["glyphPixels":24]],24))
precondition(!checkboxGlyphIntermediate([["glyphPixels":12]],0))
precondition(!checkboxGlyphIntermediate([[:]],24))
precondition(checkboxEndpointCoverage([endpointRow(7400,7900,true),endpointRow(13400,13900,true)],7000,10000,13000))
precondition(!checkboxEndpointCoverage([endpointRow(7400,7900,true)],7000,10000,13000))
precondition(!checkboxEndpointCoverage([endpointRow(13400,13900,true)],7000,10000,13000))
precondition(!checkboxEndpointCoverage([endpointRow(7400,7900,false),endpointRow(13400,13900,true)],7000,10000,13000))
var checkboxGhost=checkboxGone;checkboxGhost["inkPixels"]=1
var checkboxRepaint=checkboxGone;checkboxRepaint["referenceInkPixels"]=1
var checkboxFalseGlyph=checkboxGone;checkboxFalseGlyph["glyphPixels"]=1
var checkboxFalseColor=checkboxGone;checkboxFalseColor["sampleRGBA"]=[17,119,51,255]
var checkboxMissing=checkboxGone;checkboxMissing.removeValue(forKey:"referenceInkPixels")
var checkboxBackwards=checkboxGone;checkboxBackwards["captureEpochMs"]=9000.0
var checkboxNaN=checkboxGone;checkboxNaN["captureStartedEpochMs"]=Double.nan
precondition(!checkboxRetirementCoverage([checkboxGhost],10000,13000))
precondition(!checkboxRetirementCoverage([checkboxGone,checkboxRepaint],10000,13000))
precondition(!checkboxRetirementCoverage([checkboxFalseGlyph],10000,13000))
precondition(!checkboxRetirementCoverage([checkboxFalseColor],10000,13000))
precondition(!checkboxRetirementCoverage([checkboxMissing],10000,13000))
precondition(!checkboxRetirementCoverage([checkboxBackwards],10000,13000))
precondition(!checkboxRetirementCoverage([checkboxNaN],10000,13000))
precondition(!checkboxRetirementCoverage([checkboxGone],13000,10000))
precondition(checkboxRetirementCoverage([checkboxLive,checkboxGone],10000,13000))
precondition(checkboxRetirementCoverage([checkboxGone],10000,13000))
precondition(!checkboxRetirementCoverage([checkboxLive],10000,13000))
precondition(!checkboxRetirementCoverage([[:]],10000,13000))

let groupOff:[String:Any] = ["id":"alpha","label":"Alpha","value":"checkbox, unchecked","enabled":true,"relativeFrame":[0.0,0.0,106.0,44.0],"referenceRelativeFrame":[0.0,0.0,106.0,44.0]]
let groupLabels=["alpha":"Alpha"]
precondition(checkboxGroupMembersMatch([groupOff],["alpha":false],groupLabels,false,3))
var groupOn=groupOff;groupOn["value"]="checkbox, checked"
precondition(checkboxGroupMembersMatch([groupOn],["alpha":true],groupLabels,false,3))
precondition(!checkboxGroupMembersMatch([groupOn],["alpha":false],groupLabels,false,3))
var groupWrong=groupOff;groupWrong["label"]="Other"
precondition(!checkboxGroupMembersMatch([groupWrong],["alpha":false],groupLabels,false,3))
groupWrong=groupOff;groupWrong["value"]="radio button, unchecked"
precondition(!checkboxGroupMembersMatch([groupWrong],["alpha":false],groupLabels,false,3))
var groupDisabled=groupOff;groupDisabled["enabled"]=false
precondition(checkboxGroupMembersMatch([groupDisabled],["alpha":false],groupLabels,true,3))
precondition(!checkboxGroupMembersMatch([groupOff],["alpha":false],groupLabels,true,3))
groupWrong=groupOff;groupWrong["value"]=NSNull()
precondition(!checkboxGroupMembersMatch([groupWrong],["alpha":false],groupLabels,false,3))
precondition(!checkboxGroupMembersMatch([],["alpha":false],groupLabels,false,3))
precondition(!checkboxGroupMembersMatch([groupOff,groupOff],["alpha":false],groupLabels,false,3))
groupWrong=groupOff;groupWrong["relativeFrame"]=[0.0,0.0,107.0,44.0]
precondition(!checkboxGroupMembersMatch([groupWrong],["alpha":false],groupLabels,false,3))
groupWrong=groupOff;groupWrong["relativeFrame"]=[0.0,0.0,106.0001220703125,44.0]
precondition(checkboxGroupMembersMatch([groupWrong],["alpha":false],groupLabels,false,3))
groupWrong=groupOff;groupWrong["relativeFrame"]=[0.0,Double.nan,106.0,44.0]
precondition(!checkboxGroupMembersMatch([groupWrong],["alpha":false],groupLabels,false,3))
precondition(!checkboxGroupMembersMatch([groupOff],["alpha":false],groupLabels,false,0))

let nullableTags=try! JSONSerialization.jsonObject(with:Data(#"{"alpha":840,"beta":null,"loose":874,"nested":856}"#.utf8))
precondition(nullableTags as? [String:NSNumber] == nil)
precondition(checkboxGroupMemberTag(nullableTags,"nested")?.intValue==856)
precondition(checkboxGroupMemberTag(nullableTags,"alpha")?.intValue==840)
precondition(checkboxGroupMemberTag(nullableTags,"beta")==nil)
precondition(checkboxGroupMemberTag(nullableTags,"missing")==nil)
precondition(checkboxGroupMemberTag(NSNull(),"nested")==nil)
precondition(checkboxGroupMemberTag(["nested":NSNumber(value:-1)],"nested")==nil)
precondition(checkboxGroupMemberTag(["nested":NSNumber(value:Double.nan)],"nested")==nil)
let radioGroupOff:[String:Any] = ["id":"alpha","label":"Alpha","value":"radio button, unchecked","enabled":true,"relativeFrame":[0.0,0.0,106.0,44.0],"referenceRelativeFrame":[0.0,0.0,106.0,44.0]]
let radioGroupLabels=["alpha":"Alpha"]
precondition(radioGroupMembersMatch([radioGroupOff],["alpha":false],radioGroupLabels,false,3))
var radioGroupOn=radioGroupOff;radioGroupOn["value"]="radio button, checked"
precondition(radioGroupMembersMatch([radioGroupOn],["alpha":true],radioGroupLabels,false,3))
precondition(!radioGroupMembersMatch([radioGroupOn],["alpha":false],radioGroupLabels,false,3))
var radioGroupWrong=radioGroupOff;radioGroupWrong["label"]="Other"
precondition(!radioGroupMembersMatch([radioGroupWrong],["alpha":false],radioGroupLabels,false,3))
radioGroupWrong=radioGroupOff;radioGroupWrong["value"]="checkbox, unchecked"
precondition(!radioGroupMembersMatch([radioGroupWrong],["alpha":false],radioGroupLabels,false,3))
var radioGroupDisabled=radioGroupOff;radioGroupDisabled["enabled"]=false
precondition(radioGroupMembersMatch([radioGroupDisabled],["alpha":false],radioGroupLabels,true,3))
precondition(!radioGroupMembersMatch([radioGroupOff],["alpha":false],radioGroupLabels,true,3))
radioGroupWrong=radioGroupOff;radioGroupWrong["value"]=NSNull()
precondition(!radioGroupMembersMatch([radioGroupWrong],["alpha":false],radioGroupLabels,false,3))
precondition(!radioGroupMembersMatch([],["alpha":false],radioGroupLabels,false,3))
precondition(!radioGroupMembersMatch([radioGroupOff,radioGroupOff],["alpha":false],radioGroupLabels,false,3))
radioGroupWrong=radioGroupOff;radioGroupWrong["relativeFrame"]=[0.0,0.0,107.0,44.0]
precondition(!radioGroupMembersMatch([radioGroupWrong],["alpha":false],radioGroupLabels,false,3))
radioGroupWrong=radioGroupOff;radioGroupWrong["relativeFrame"]=[0.0,0.0,106.0001220703125,44.0]
precondition(radioGroupMembersMatch([radioGroupWrong],["alpha":false],radioGroupLabels,false,3))
radioGroupWrong=radioGroupOff;radioGroupWrong["relativeFrame"]=[0.0,Double.nan,106.0,44.0]
precondition(!radioGroupMembersMatch([radioGroupWrong],["alpha":false],radioGroupLabels,false,3))
precondition(!radioGroupMembersMatch([radioGroupOff],["alpha":false],radioGroupLabels,false,0))

precondition(buttonShadowIntermediate([200,200,200,255]))
precondition(!buttonShadowIntermediate([153,153,153,255]))
precondition(!buttonShadowIntermediate([255,255,255,255]))
precondition(!buttonShadowIntermediate([200,199,200,255]))
precondition(!buttonShadowIntermediate([200,200,200,254]))
precondition(!buttonShadowIntermediate([]))
precondition(buttonMotionReferenceIndex([187,51,34,255],1)==0)
precondition(buttonMotionReferenceIndex([17,119,51,255],1)==1)
precondition(buttonMotionReferenceIndex([255,255,255,255],0)==0)
precondition(buttonMotionReferenceIndex([255,255,255,255],1)==nil)
precondition(buttonMotionReferenceIndex([1,2,3,255],0)==nil)
precondition(buttonMotionReferenceIndex([17,119,51,254],1)==nil)
precondition(buttonMotionReferenceIndex([],0)==nil)
precondition(buttonMotionReferenceIndex([187,51,35,255],1)==nil)
precondition(linkGlyphCounts([187,51,34,255,17,119,51,255,102,85,42,255])==[1,1,1])
precondition(linkGlyphCounts([187,51,34,254,255,255,255,255,220,160,150,255])==[0,0,0])
precondition(linkGlyphCounts([187,119,51,255,17,51,34,255,255,255,255,255])==[0,0,0])
precondition(linkGlyphCounts([])==[0,0,0])
precondition(linkGlyphCounts([1])==[0,0,0])
precondition(linkReferenceIndex([1,0,0],4)==0)
precondition(linkReferenceIndex([0,1,0],4)==1)
precondition(linkReferenceIndex([0,0,0],0)==0)
precondition(linkReferenceIndex([0,0,0],1)==nil)
precondition(linkReferenceIndex([1,1,0],2)==nil)
precondition(linkReferenceIndex([1,0,1],2)==nil)
precondition(linkReferenceIndex([-1,0,0],0)==nil)
precondition(linkReferenceIndex([],0)==nil)
print(#"{\"linkGlyphCases\":5,\"linkReferenceCases\":8,\"buttonReferenceCases\":8,\"buttonShadowCases\":6,\"radioGroupCases\":14,\"checkboxGroupTagCases\":8,\"checkboxGroupCases\":14,\"checkboxCases\":47,\"switchValueCases\":10,\"switchRasterCases\":9,\"switchThumbCases\":11,\"switchEndpointCases\":10,\"switchRetirementCases\":14,\"toggleButtonCases\":12,\"listItemCases\":20,\"galleryScrollCases\":8,\"galleryTrackCases\":8,\"thumbnailFrameCases\":6,\"circularCases\":6,\"status\":\"PASS\",\"cases\":11,\"pixelCases\":6,\"shadowCases\":6,\"savedNSNumberIntValue\":9,\"savedNSNumberDoubleValue\":9.9998779296875}"#)
'''


def build_ios_application(session, config):
    base = json.loads(bound_file(config["baseApplicationIdentity"]).read_text())
    product = verify_product(base)
    freeze = json.loads(bound_file(config["baseApplicationSourceFreeze"]).read_text())
    freeze = freeze.get("sourceFilesSHA256", freeze)
    selected_runtime = set()
    for item in config.get("additionalApplicationSources", []):
        path = bound_file(item)
        require(path.suffix in [".ts", ".tsx"] and any(path.is_relative_to((REPO / root).resolve()) for root in ["apps/native-showcase/src", "packages/react-native/src"]), "Additional runtime source must be owned TypeScript")
        name = str(path.relative_to(REPO.resolve()))
        selected_runtime.add(name)
        freeze.setdefault(name, item["sha256"])
    current = {name: digest(REPO / name) for name in freeze}
    drift = [name for name in freeze if freeze[name] != current[name]]
    require(all((name.startswith("apps/native-showcase/src/") or name in selected_runtime) and name.endswith((".ts", ".tsx")) for name in drift), "Unexpected unbound native/config/library drift: " + repr(drift))
    target = session.output / "CodonCircular.app"
    shutil.copytree(product, target)
    write(session.output / "source-freeze.json", current)
    source_map = session.output / "main.jsbundle.map"
    session.run("export-embed", ["pnpm", "-F", "@codon-ui/native-showcase", "exec", "expo", "export:embed", "--entry-file", REPO / "apps/native-showcase/index.ts", "--platform", "ios", "--dev", "false", "--minify", "false", "--bytecode", "--max-workers", "1", "--bundle-output", target / "main.jsbundle", "--sourcemap-output", source_map, "--assets-dest", target])
    require(all(digest(REPO / name) == expected for name, expected in current.items()), "Application source changed during export")
    actual = files(target)
    require(actual.keys() == base["filesSHA256"].keys(), "Unexpected application native/assets member set change")
    require(all(actual[name] == expected for name, expected in base["filesSHA256"].items() if name != "main.jsbundle"), "Cached native/config/assets bytes changed")
    mapped = mapped_owned_sources(source_map, current)
    require(all((REPO / name).read_text() == body for name, body in mapped.items()), "Application map contains stale source")
    for item in config.get("requiredMappedApplicationSources", []):
        path = bound_file(item)
        require(str(path.relative_to(REPO)) in mapped, "Selected application fixture missing from bundle: " + str(path))
    result = identity(target)
    result.update(sourceFilesSHA256={str(REPO / name): value for name, value in current.items()}, sourceFreeze={"path": str(session.output / "source-freeze.json"), "sha256": digest(session.output / "source-freeze.json")}, packagerMap=str(source_map), packagerMapSHA256=digest(source_map))
    write(session.output / "map-proof.json", {"matchedOwnedSourceCount": len(mapped), "sourceFilesSHA256": {name: digest(REPO / name) for name in mapped}, "unchangedNativeAndAssets": True, "baseManifestSHA256": base["manifestSHA256"], "sourceDrift": drift})
    return result


def build_ios(session, config=None):
    if config and config.get("buildTarget") == "application": return build_ios_application(session, config)
    controls = session.output / "MeterGeometryControls.swift";controls.write_text(geometry_control_source())
    sdk = session.run("geometry-sdk", ["/usr/bin/xcrun", "--sdk", "macosx", "--show-sdk-path"]).strip()
    swift = "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift"
    control_result = json.loads(session.run("geometry-controls", [swift, "-sdk", sdk, "-module-cache-path", str(CACHE / "swift-host-module-cache"), str(controls)]))
    require(control_result.get("linkGlyphCases") == 5 and control_result.get("linkReferenceCases") == 8 and control_result.get("buttonReferenceCases") == 8 and control_result.get("buttonShadowCases") == 6 and control_result.get("radioGroupCases") == 14 and control_result.get("checkboxGroupTagCases") == 8 and control_result.get("checkboxGroupCases") == 14 and control_result.get("checkboxCases") == 47 and control_result.get("switchRetirementCases") == 14 and control_result.get("switchEndpointCases") == 10 and control_result.get("switchThumbCases") == 11 and control_result.get("switchValueCases") == 10 and control_result.get("switchRasterCases") == 9 and control_result.get("toggleButtonCases") == 12 and control_result.get("listItemCases") == 20 and control_result.get("galleryScrollCases") == 8 and control_result.get("galleryTrackCases") == 8 and control_result.get("thumbnailFrameCases") == 6 and control_result.get("circularCases") == 6 and control_result.get("status") == "PASS" and control_result.get("cases") == 11 and control_result.get("pixelCases") == 6 and control_result.get("shadowCases") == 6, "Actual Swift geometry/pixel/shadow controls failed")
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
    target = config.get("buildTarget", "observer")
    require(target in ["observer", "application"], "Unknown Android build target")
    if target == "application": return build_android_application(session, config)
    sdk, jdk = Path(config["sdk"]), Path(config["jdk"])
    tools, jar = sdk / "build-tools/36.0.0", sdk / "platforms/android-36/android.jar"
    source = ROOT / "android-native-inspector"
    build = CACHE / "android" / digest(source / "Actions.java")
    build.mkdir(parents=True, exist_ok=True)
    for name in ["classes", "dex"]: (build / name).mkdir(exist_ok=True)
    session.env.update(JAVA_HOME=str(jdk), JAVA_TOOL_OPTIONS="-XX:ActiveProcessorCount=1")
    controls = session.output / "MeterStyleControls.java"; controls.write_text(android_style_control_source())
    control_classes = session.output / "control-classes"; control_classes.mkdir()
    session.run("javac-controls", [jdk / "bin/javac", "-d", control_classes, controls])
    control_result = json.loads(session.run("java-controls", [jdk / "bin/java", "-cp", control_classes, "MeterStyleControls"]))
    require(control_result == {"status": "PASS", "cases": 45}, "Actual Java geometry/color/identity/automatic-height controls failed")
    session.run("javac", [jdk / "bin/javac", "-source", "8", "-target", "8", "-classpath", jar, "-d", build / "classes", source / "Actions.java"])
    session.run("dex", [tools / "d8", "--lib", jar, "--output", build / "dex", *sorted((build / "classes").rglob("*.class"))])
    session.run("package", [tools / "aapt2", "link", "--manifest", source / "AndroidManifest.xml", "-I", jar, "-o", build / "unsigned.apk"])
    with zipfile.ZipFile(build / "unsigned.apk", "a", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(build / "dex/classes.dex", "classes.dex")
    apk = build / "inspector.apk"
    session.run("align", [tools / "zipalign", "-f", "4", build / "unsigned.apk", apk])
    session.run("sign", [tools / "apksigner", "sign", "--ks", REPO / "apps/native-showcase/android/app/debug.keystore", "--ks-key-alias", "androiddebugkey", "--ks-pass", "pass:android", "--key-pass", "pass:android", apk])
    session.run("verify-signature", [tools / "apksigner", "verify", "--verbose", apk])
    if "closedRiskReceipt" in config:
        receipt = bound_file(config["closedRiskReceipt"])
        for item in config["closedRiskImages"]: bound_file(item)
        source = json.loads(receipt.read_text())
        require(source.get("nativeActionSucceeded") is True and not source.get("hasFailedCohorts"), "Only a clean native cohort may be reviewed")
        preferences = json.loads(bound_file(config["closedRiskPreferences"]).read_text())
        require(preferences["exactKeySetAndValuesVerified"] is True and preferences["captured"] == preferences["restored"], "Closed attempt cleanup preferences unverified")
        replay = reconcile_linear_progress_risk_android(session, config, receipt.parent, source, preferences["captured"])
        write(session.output / "closed-risk-review.json", {"status": "PASS", "sourceReceipt": config["closedRiskReceipt"], "sourceAttemptStatus": "FAILED_HOST_READER; native cohort passed; original failure preserved", "result": replay, "newGuestActions": 0})
    return {"apk": str(apk), "apkSHA256": digest(apk), "styleControls": {"result": control_result, "sourceSHA256": digest(controls), "outputSHA256": digest(session.output / "java-controls.stdout")}}


def android_style_control_source():
    source = (ROOT / "android-native-inspector/Actions.java").read_text(); methods = []
    for name in ["meterStyleFrameCheck", "meterStyleColorCheck", "meterStyleIdentityCheck", "meterStyleExpectedHeight", "meterAttemptDeadline", "meterStyleMethods", "motionPreferenceCommandAllowed", "progressRiskContrastCount", "circularPixelsMatch"]:
        declaration = re.search(r"(?m)^  public static \S+ " + re.escape(name) + r"\(", source)
        require(declaration is not None, "Compiled control helper declaration missing: " + name)
        start = declaration.start()
        opening = source.index("{", start); end = opening + 1; depth = 1
        while depth:
            depth += (source[end] == "{") - (source[end] == "}"); end += 1
        methods.append(source[start:end])
    return "public class MeterStyleControls {\n" + "\n".join(methods) + r'''
    static int cases=0;
    static void pass(Runnable action){action.run();cases++;}
    static void reject(Runnable action){try{action.run();}catch(AssertionError expected){cases++;return;}throw new AssertionError("Negative control accepted");}
    static void check(boolean value){if(!value)throw new AssertionError("Wrong actual helper result");cases++;}
    public static void main(String[] args){
      pass(()->meterStyleFrameCheck(new double[]{12,12,150,10},new double[]{12,12,150,10},3));
      pass(()->meterStyleFrameCheck(new double[]{12,12,73.142857,13.714286},new double[]{12,12,73.25,13.75},1.75));
      pass(()->meterStyleFrameCheck(new double[]{12,12,0,10},new double[]{12,12,0,10},3));
      reject(()->meterStyleFrameCheck(new double[]{12,12,150,9},new double[]{12,12,150,10},3));
      reject(()->meterStyleFrameCheck(new double[]{12,12,Double.NaN,10},new double[]{12,12,150,10},3));
      reject(()->meterStyleFrameCheck(new double[]{12,12,150,10},new double[]{12,12,150,10},0));
      pass(()->meterStyleColorCheck(0xff2563eb,0xff2563eb,false));pass(()->meterStyleColorCheck(0xffffffff,0xffffffff,true));
      reject(()->meterStyleColorCheck(0xff2563eb,0xff2563ea,false));reject(()->meterStyleColorCheck(0xfffefefe,0xfffefefe,true));
      pass(()->meterStyleIdentityCheck("meter-style-target",1));reject(()->meterStyleIdentityCheck("other",1));reject(()->meterStyleIdentityCheck("meter-style-target",2));
      check(meterStyleExpectedHeight(5,0,2)==2);check(meterStyleExpectedHeight(5,0,1.7142857142857142)==1.7142857142857142);check(meterStyleExpectedHeight(3,0,Double.NaN)==0);
      reject(()->meterStyleExpectedHeight(5,0,-1));reject(()->meterStyleExpectedHeight(5,0,Double.NaN));
      pass(()->meterStyleFrameCheck(new double[]{12,12,150,2},new double[]{12,12,150,meterStyleExpectedHeight(5,0,2)},3));
      reject(()->meterStyleFrameCheck(new double[]{12,12,150,2},new double[]{12,12,150,0},3));
      check(meterAttemptDeadline(1000,"30000")==31000);check(meterAttemptDeadline(1000,"1200000")==1201000);reject(()->meterAttemptDeadline(0,null));reject(()->meterAttemptDeadline(0,"0"));reject(()->meterAttemptDeadline(0,"1800001"));reject(()->meterAttemptDeadline(0,"invalid"));
      check(java.util.Arrays.equals(meterStyleMethods("dimensions"),new String[]{"dimensions"}));check(meterStyleMethods("").length==4);reject(()->meterStyleMethods("unknown"));
      check(motionPreferenceCommandAllowed("settings get global transition_animation_scale"));check(motionPreferenceCommandAllowed("settings get global animator_duration_scale"));check(motionPreferenceCommandAllowed("settings put global transition_animation_scale 0"));check(motionPreferenceCommandAllowed("settings delete global animator_duration_scale"));check(!motionPreferenceCommandAllowed("settings put secure setting 1"));check(!motionPreferenceCommandAllowed("settings put global animator_duration_scale 0; input tap 1 1"));
      check(progressRiskContrastCount(new int[]{0xfff7f7f7,0xfff7f7f7},0xfff7f7f7)==0);check(progressRiskContrastCount(new int[]{0xfff7f7f7,0xff4e8f3a},0xfff7f7f7)==1);reject(()->progressRiskContrastCount(null,0));reject(()->progressRiskContrastCount(new int[]{},0));
      check(circularPixelsMatch(new int[]{0xff123456},new int[]{0xff123456}));check(!circularPixelsMatch(new int[]{},new int[]{}));check(!circularPixelsMatch(null,new int[]{1}));check(!circularPixelsMatch(new int[]{1},null));check(!circularPixelsMatch(new int[]{1},new int[]{2}));check(!circularPixelsMatch(new int[]{1},new int[]{1,1}));
      if(cases!=45)throw new AssertionError("Control count changed");System.out.println("{\"status\":\"PASS\",\"cases\":"+cases+"}");
    }
}'''


def mapped_owned_sources(path, names):
    data = json.loads(Path(path).read_text()); found = {}
    for source, content in zip(data["sources"], data["sourcesContent"]):
        matches = [name for name in names if source.replace("\\", "/").endswith("/" + name) or source == name]
        require(len(matches) <= 1, "Ambiguous owned source-map path")
        if matches:
            name = matches[0]
            require(name not in found or found[name] == content, "Conflicting owned source-map bodies")
            found[name] = content
    require(found, "Owned source-map bodies missing")
    return found


def native_runtime_digest(raw):
    require(len(raw) >= 64 and raw[:6] == b"\x7fELF\x02\x01" and struct.unpack_from("<H", raw, 18)[0] == 62, "Require actual x86_64 little-endian ELF")
    offset = struct.unpack_from("<Q", raw, 40)[0]; size, count, strings_index = struct.unpack_from("<HHH", raw, 58)
    require(size == 64 and count > 0 and strings_index < count and offset + count * size <= len(raw), "Invalid ELF section table")
    sections = [struct.unpack_from("<IIQQQQIIQQ", raw, offset + i * size) for i in range(count)]
    strings_header = sections[strings_index]; strings = raw[strings_header[4]:strings_header[4] + strings_header[5]]
    notes = [row for row in sections if strings[row[0]:].split(b"\0", 1)[0] == b".note.gnu.build-id"]
    require(len(notes) == 1, "One GNU build-ID note required")
    note = notes[0]; start = note[4]
    require(note[1] == 7 and note[5] == 36 and start + 36 <= len(raw) and struct.unpack_from("<III", raw, start) == (4, 20, 3) and raw[start + 12:start + 16] == b"GNU\0", "Exact GNU SHA1 build-ID note layout required")
    normalized = raw[:start + 16] + bytes(20) + raw[start + 36:]
    return hashlib.sha256(normalized).hexdigest(), raw[start + 16:start + 36].hex()


def build_android_application(session, config):
    require(Path(config["gradleUserHome"]).is_dir(), "Explicit existing Gradle cache required")
    base = json.loads(bound_file(config["baseApplicationIdentity"]).read_text()); old_apk = verify_product(base)
    freeze = json.loads(bound_file(config["baseApplicationSourceFreeze"]).read_text())
    selected_runtime = set()
    for item in config.get("additionalApplicationSources", []):
        path = bound_file(item)
        require(path.suffix in [".ts", ".tsx"] and any(path.is_relative_to((REPO / root).resolve()) for root in ["apps/native-showcase/src", "packages/react-native/src"]), "Additional runtime source must be owned TypeScript")
        name = str(path.relative_to(REPO.resolve()))
        selected_runtime.add(name)
        freeze.setdefault(name, item["sha256"])
    current = {name: digest(REPO / name) for name in freeze}
    drift = [name for name in freeze if freeze[name] != current[name]]
    require(all(name.startswith("apps/native-showcase/src/") and name.endswith((".ts", ".tsx")) for name in drift), "Unexpected native/config/library input drift: " + repr(drift))
    map_path = Path(base["packagerMap"])
    old_map = None
    if "completedApplicationBuild" not in config:
        original_map = bound_file(config["baseApplicationSourceMap"]) if "baseApplicationSourceMap" in config else map_path
        require(digest(original_map) == base["packagerMapSHA256"], "Original application map changed")
        old_map = mapped_owned_sources(original_map, freeze)
    def native_members(apk):
        with zipfile.ZipFile(apk) as archive:
            return {name: hashlib.sha256(archive.read(name)).hexdigest() for name in archive.namelist() if name.startswith("lib/") or re.fullmatch(r"classes\d*\.dex", name)}
    original_native = native_members(old_apk); require(original_native, "Native APK members missing")
    write(session.output / "source-freeze.json", current)
    session.env.update(JAVA_HOME=config["jdk"], ANDROID_HOME=config["sdk"], ANDROID_SDK_ROOT=config["sdk"], GRADLE_USER_HOME=config["gradleUserHome"], JAVA_TOOL_OPTIONS="-XX:ActiveProcessorCount=1")
    project = REPO / "apps/native-showcase/android"
    argv = [project / "gradlew", "-p", project, ":app:assembleRelease", "--offline", "--no-daemon", "--max-workers=1", "--console=plain", "-PreactNativeArchitectures=x86_64"]
    if "completedApplicationBuild" in config:
        completed = json.loads(bound_file(config["completedApplicationBuild"]).read_text())
        require(completed.get("exitCode") == 0 and completed.get("ownedGroupGone") is True and not completed.get("timedOut") and completed["argv"] == list(map(str, argv)), "Closed Gradle command did not complete cleanly")
        require(json.loads(bound_file(config["completedApplicationSourceFreeze"]).read_text()) == current, "Completed application inputs changed")
        require(bound_file(config["completedApplicationAPK"]) == (project / "app/build/outputs/apk/release/app-release.apk").resolve() and bound_file(config["completedApplicationMap"]) == map_path.resolve(), "Closed application products differ from selected products")
    else: session.run("assemble-release", argv)
    require(all(digest(REPO / name) == expected for name, expected in current.items()), "Application input changed during build")
    apk = project / "app/build/outputs/apk/release/app-release.apk"
    actual_native = native_members(apk); metadata = []
    require(actual_native.keys() == original_native.keys(), "Built native member set changed")
    with zipfile.ZipFile(old_apk) as before, zipfile.ZipFile(apk) as after:
        for name in actual_native:
            if actual_native[name] == original_native[name]: continue
            require(name.startswith("lib/x86_64/") and name.endswith(".so"), "Built DEX or unsupported native member changed")
            old_runtime, old_id = native_runtime_digest(before.read(name)); new_runtime, new_id = native_runtime_digest(after.read(name))
            require(old_runtime == new_runtime, "Native runtime bytes changed outside GNU build ID: " + name)
            metadata.append({"name": name, "beforeSHA256": original_native[name], "afterSHA256": actual_native[name], "beforeBuildID": old_id, "afterBuildID": new_id, "allOtherBytesSHA256": new_runtime})
    mapped = mapped_owned_sources(map_path, current)
    require((old_map is None or set(mapped) >= set(old_map)) and all((REPO / name).read_text() == content for name, content in mapped.items()), "Current application map missing or stale owned source")
    session.run("verify-signature", [Path(config["sdk"]) / "build-tools/36.0.0/apksigner", "verify", "--verbose", apk])
    write(session.output / "map-proof.json", {"matchedOwnedSourceCount": len(mapped), "sourceFilesSHA256": {name: digest(REPO / name) for name in mapped}, "nativeLibrariesAndDEXSHA256": actual_native, "nativeBuildIDOnlyDifferences": metadata, "baseAPK": base["apkSHA256"], "sourceDrift": drift})
    return {"apk": str(apk), "apkSHA256": digest(apk), "inputOrigin": "Standard offline Gradle Release build; current workspace map, exact DEX and all native bytes except explicitly recorded GNU build-ID descriptions verified. Full current APK/member hashes retained.", "sourceFilesSHA256": {str(REPO / name): value for name, value in current.items()}, "sourceFreeze": {"path": str(session.output / "source-freeze.json"), "sha256": digest(session.output / "source-freeze.json")}, "packagerMap": str(map_path), "packagerMapSHA256": digest(map_path), "mapProof": {"path": str(session.output / "map-proof.json"), "sha256": digest(session.output / "map-proof.json")}}



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


def slider_hold_capture(session, device):
    captures = []
    def capture():
        raw = (session.output / "xctest.stdout").read_text()
        begins = list(re.finditer(r"CODON_SLIDER_GESTURE_BEGIN (\{[^\n]+\})", raw))
        if not begins: return
        tail = raw[begins[-1].end():]
        if "CODON_SLIDER_GESTURE_RETURN " in tail or re.search(r"Test Case '-\[[^\]]+\]' (?:passed|failed|skipped)", tail): return
        begin = json.loads(begins[-1].group(1))
        name = "slider-hold-"+str(len(begins)-1)+"-"+str(len(captures))
        png = session.output / (name+".png")
        row = {"gesture":len(begins)-1,"startedEpochSeconds":time.time(),"beginEpochSeconds":begin["epochSeconds"],"png":str(png)}
        session.run(name, [XCODE+"/simctl", "io", device, "screenshot", png])
        row.update(finishedEpochSeconds=time.time(),pngSHA256=digest(png))
        captures.append(row)
        write(session.output / "slider-held-captures.json", captures)
    return capture


def run_ios(session, config, app, observer):
    device = config["destination"]
    reuse_installed = config.get("reuseInstalledApplication", False)
    require(type(reuse_installed) is bool, "Installed application reuse must be boolean")
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
        if reuse_installed and label == "app":
            registered = session.run("preflight-installed-" + label, [XCODE + "/simctl", "get_app_container", device, bundle, "app"]).strip()
            verify_product(expected, registered)
            installed_products[label] = registered
            continue
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
    bind_xctestrun(template, app, observer, runfile, installed_products["observer"], config.get("restoreMotionOriginalValue"), session.work)
    selected = selection("ios", config.get("batch", "meter-g02"))["ios"]
    argv = [XCODE + "/xcodebuild", "test-without-building", "-xctestrun", str(runfile), "-destination", "platform=iOS Simulator,id=" + device, "-destination-timeout", str(max(1, int(session.remaining()))), "-jobs", "1", "-parallel-testing-enabled", "NO", "-test-timeouts-enabled", "NO", "-resultBundlePath", str(session.output / "Tests.xcresult")]
    argv += ["-only-testing:CodonNativeComponents/" + name for name in selected]
    sdk_error = None
    try:
        if config.get("batch") == "slider-hit-layout": raw = session.run("xctest", argv, while_running=slider_hold_capture(session, device))
        else: raw = session.run("xctest", argv, while_running=early_tooltip_observer(session,observer) if config.get("batch", "").startswith("tooltip") else None)
    except ValueError as error:
        sdk_error = error;stdout = session.output / "xctest.stdout";raw = stdout.read_text() if stdout.exists() else ""
    if config.get("batch") in ["meter-style", "meter-style-remaining", "meter-style-affected", "linear-progress-risk", "circular-progress", "circular-progress-affected", "circle-loader", "lagging-lines", "counter", "list-box-item", "list-box-item-motion", "toggle-button", "toggle-button-affected", "toggle-button-style", "radio", "radio-motion", "switch", "switch-motion", "checkbox", "checkbox-static", "checkbox-motion", "button", "button-motion", "link", "tooltip-motion", "tooltip"] and "METER_STYLE_MOTION_ORIGINAL " in raw:
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
    if config.get("batch", "").startswith("tooltip") and sdk_error is None:
        early_tooltip_observer(session,observer)();require((session.output/"early-loaded-observer.json").is_file(),"Tooltip early loaded-executable receipt missing")
    if sdk_error is not None: raise sdk_error
    summary = json.loads(session.run("xctest-summary", [XCODE + "/xcresulttool", "get", "test-results", "summary", "--path", session.output / "Tests.xcresult"]))
    result = reconcile_selected_results(summary, raw, selected)
    if config.get("batch") in ["text-style", "text-style-context"]:
        result["textStyle"] = reconcile_text_style_ios(raw, config, app)
    if config.get("batch") in ["circular-progress", "circular-progress-affected"]:
        rows = [json.loads(row) for row in re.findall(r"CIRCULAR_NATIVE_OBSERVATION (\{[^\n]+\})", raw)]
        names = ["quarter","zero","full","lower-clamp","upper-clamp","empty-range","half","reverse","round","square","wide","zero-width","zero-height","six-slots","named-paint","current-color","context-label","empty-label","node-label","unknown"]
        validate_circular_rows([row for row in rows if row["name"] in names], names)
        require(all(name in [row["name"] for row in rows] for name in ["motion-final", "reduced-final"]), "Discriminating normal/reduced motion captures missing")
        result["circularProgressObservations"] = len(rows)
        if config.get("batch") == "circular-progress-affected":
            retained = json.loads(bound_file(config["retainedCircularProviderMethod"]).read_text())
            require(retained["method"] == "testCircularProvidersAndConstraint", "Only the clean independent provider method is reusable")
            for item in retained["librarySources"]: bound_file(item)
            loaded = json.loads(bound_file(retained["loadedObserver"]).read_text())
            require(loaded["status"] == "PASS" and loaded["observerManifestSHA256"] == retained["observerManifestSHA256"], "Retained actually loaded observer mismatch")
            result["retainedCircularProvider"] = native_method(retained)
    if config.get("batch") == "circle-loader": result["circleLoader"] = reconcile_circle_loader_ios(raw)
    if config.get("batch") == "lagging-lines": result["laggingLines"] = reconcile_lagging_lines_ios(raw)
    if config.get("batch") in ["counter", "counter-values"]: result["counter"] = reconcile_counter_ios(raw, include_motion=config["batch"] == "counter")
    if config.get("batch") in ["list-box-item", "list-box-item-motion"]: result["listBoxItem"] = reconcile_list_item_ios(raw,config,app)
    if config.get("batch") == "placeholder-g08": result["placeholder"] = reconcile_placeholder_ios(raw)
    if config.get("batch") in ["switch", "switch-motion"]: result["switch"] = reconcile_switch_ios(raw, config, app)
    if config.get("batch", "").startswith("tooltip"): result["tooltip"]=reconcile_tooltip_ios(raw,config)
    if config.get("batch") in ["link","link-static","link-actions"]: result["link"]=reconcile_link_ios(raw,config)
    if config.get("batch") in ["button","button-motion"]: result["button"]=reconcile_button_ios(raw,config)
    if config.get("batch")=="radio-group": result["radioGroup"]=reconcile_radio_group_ios(raw)
    if config.get("batch") in ["checkbox-group","checkbox-group-actions"]: result["checkboxGroup"]=reconcile_checkbox_group_ios(raw,config,app)
    if config.get("batch") in ["checkbox","checkbox-static","checkbox-motion"]: result["checkbox"]=reconcile_checkbox_ios(raw,config,app)
    if config.get("batch") == "slider-hit-layout": result["sliderHitLayout"] = reconcile_slider_ios(raw, session.output)
    if config.get("batch") in ["radio", "radio-motion"]: result["radio"] = reconcile_radio_ios(raw,config)
    if config.get("batch") in ["toggle-button", "toggle-button-affected", "toggle-button-style"]: result["toggleButton"] = reconcile_toggle_button_ios(raw,config)
    if config.get("batch") == "avatar": result["avatar"] = reconcile_avatar_ios(raw)
    if config.get("batch") in ["gallery", "gallery-modes", "gallery-styles", "gallery-remaining"]: result["gallery"] = reconcile_gallery_ios(raw, config["batch"])
    if config.get("batch") in ["thumbnail", "thumbnail-geometry"]: result["thumbnail"] = reconcile_thumbnail_ios(raw, include_lifetime=config["batch"] == "thumbnail")
    if config.get("batch") == "linear-progress-risk": result["linearProgressRisk"] = reconcile_linear_progress_risk_ios(raw)
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



def validate_circular_rows(rows, expected):
    require(len(rows) == len(expected) and sorted(row["name"] for row in rows) == sorted(expected), "Missing/duplicate CircularProgress observations")
    for row in rows:
        state = row["state"]; name = state["case"]
        require(state["rootTag"] > 0 and state["attaches"] == 1 and state["detaches"] == 0, "Actual stable public CircularProgress ref required")
        event = state["layouts"]["target"]; layout = event["layout"]; scale = row["scale"]
        require(math.isfinite(scale) and scale > 0, "Actual finite native scale required")
        require(event["target"] == event["currentTarget"] == state["rootTag"], "Original delivered layout target differs")
        for key in ["width", "height"]:
            require(math.isfinite(layout[key]) and abs(layout[key] - state[key]) * scale <= 1, "Actual native root dimension differs")
        if name not in ["zero-width", "zero-height"]:
            require(row["nativeLabel"] == ("Scoped circular task" if name == "context-label" else "Circular verification"), "Actual native CircularProgress label missing/wrong")
            value = "13%" if name == "context-label" else "NaN%" if name == "empty-range" else "[object Object]" if name == "node-label" else "0%" if name in ["zero", "lower-clamp"] else "100%" if name in ["full", "upper-clamp"] else "25%"
            require(row["nativeValue"] in [None, ""] if name == "unknown" else row["nativeValue"] == value, "Actual current native CircularProgress value differs")
            require(row["inkPixels"] > 0, "Actual native drawing must paint")
        else: require(row["inkPixels"] == 0, "Zero native dimension must not paint")
        if name != "context-label": require(row["referenceExact"] is True, "Actual drawing differs from independent native reference")
    return {"status": "PASS", "observations": len(rows)}



LOADER_GEOMETRY_NAMES = ["default", "large", "zero", "fractional", "root-independent", "explicit-colors", "transparent", "track-restored", "foreground-restored", "root-restored", "dark", "compact", "live-restored", "light-restored"]
LOADER_MOTION_NAMES = ["moving", "reduced", "resumed", "duration-zero", "fresh-moving"]


def validate_circle_loader_rows(rows, expected):
    require(sorted(row["name"] for row in rows) == sorted(expected), "Missing/duplicate CircleLoader observations")
    for row in rows:
        state, scale = row["state"], row["scale"]
        require(isinstance(scale, (int, float)) and math.isfinite(scale) and scale > 0, "Invalid CircleLoader screenshot scale")
        parent = row["parent"]
        require(len(parent) == 4 and all(math.isfinite(value) for value in parent) and parent[2:] == [104, 88], "Wrong CircleLoader measurement parent")
        require(row["inkPixels"] >= 0, "Invalid painted count")
        if state["visible"] is False:
            require(state["rootTag"] is None and row["inkPixels"] == 0 and not row["nativeLabel"], "Retired loader must be absent")
            continue
        event, tag = state["layout"], state["rootTag"]
        require(isinstance(tag, (int, float)) and tag > 0, "Actual loader ref missing")
        require(event["eventTarget"] == event["currentTarget"] == tag, "Original CircleLoader layout/ref target mismatch")
        for key in ["width", "height"]:
            require(abs(event["layout"][key] - state["root" + key.title()]) <= 1 / scale, "Wrong actual CircleLoader root dimensions")
        if state["size"] == 0: require(row["inkPixels"] == 0, "Zero CircleLoader parent is not exactly white")
        else:
            require(row["inkPixels"] > 0 and row["nativeLabel"] == "Saving circle", "Actual CircleLoader paint/name missing")
            require(not re.search(r"[0-9]", str(row.get("nativeValue") or "")), "Indeterminate CircleLoader invented numeric value")
        if row["name"] in LOADER_GEOMETRY_NAMES or row["name"].startswith(("reduced-", "duration-zero-", "fresh-stopped")):
            require(row["referenceExact"] is True, "Static loader differs from independent native reference")
    return {"status": "PASS", "observations": len(rows)}


def reconcile_circle_loader_ios(raw):
    rows = [json.loads(row) for row in re.findall(r"CIRCLE_LOADER_OBSERVATION (\{[^\n]+\})", raw)]
    expected = LOADER_GEOMETRY_NAMES + [name + "-" + str(index) for name in LOADER_MOTION_NAMES for index in range(4)] + ["retired", "retired-quiet", "fresh-stopped"]
    result = validate_circle_loader_rows(rows, expected)
    motion = [json.loads(row) for row in re.findall(r"CIRCLE_LOADER_MOTION (\{[^\n]+\})", raw)]
    require(sorted(row["name"] for row in motion) == sorted(LOADER_MOTION_NAMES), "Missing/duplicate native motion intervals")
    for row in motion:
        moving = row["name"] in ["moving", "resumed", "fresh-moving"]
        require(row["frames"] == 4 and row["moving"] is moving and (row["changedPairs"] > 0 if moving else row["changedPairs"] == 0), "Real native motion/static frame discrimination failed")
    by_name = {row["name"]: row for row in rows}
    require(by_name["reduced-0"]["state"]["motionEvents"][-1:] == [True] and by_name["resumed-0"]["state"]["motionEvents"][-1:] == [False], "Actual live Reduce Motion events missing")
    require(by_name["fresh-stopped"]["state"]["rootTag"] != by_name["duration-zero-0"]["state"]["rootTag"], "Fresh insertion reused retired root")
    originals = re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])", raw)
    require(len(originals) == 1 and originals == re.findall(r"METER_STYLE_MOTION_RESTORED ([01])", raw), "Exact original Reduce Motion restoration missing")
    result.update(motionIntervals=len(motion), originalAndRestoredMotion=originals[0])
    return result



LAGGING_GEOMETRY_NAMES = ["default", "percentage", "zero", "fractional", "slide-slot-root", "slide-overrides-explicit", "explicit-foreground", "restored-foreground", "numeric-restored", "percentage-before-compact", "dark", "compact", "live-restored", "light-restored"]
LAGGING_MOTION_NAMES = ["moving", "reduced", "resumed", "duration-zero", "fresh-moving", "resized-moving"]


def validate_lagging_lines_rows(rows, expected):
    require(sorted(row["name"] for row in rows) == sorted(expected), "Missing/duplicate LaggingLines observations")
    for row in rows:
        state, scale = row["state"], row["scale"]
        require(isinstance(scale, (int, float)) and math.isfinite(scale) and scale > 0, "Invalid LaggingLines physical scale")
        require(row["backgroundRGB"] == ([16, 16, 16] if state["mode"] == "dark" else [255, 255, 255]), "Wrong declared native canvas background")
        parent, reference = row["parent"], row["referenceParent"]
        require(len(parent) == len(reference) == 4 and all(math.isfinite(value) for value in parent + reference) and parent[2:] == reference[2:] and 0 < parent[2] <= 330 and parent[3] == 100, "Wrong matched LaggingLines parents")
        for frame in [parent, reference]:
            left, top = [math.floor(value * scale + .5) for value in frame[:2]]
            width, height = [math.floor(value * scale + .5) for value in frame[2:]]
            require(0 <= left < left + width <= row["imageWidth"] and 0 <= top < top + height <= row["imageHeight"], "Physical LaggingLines parent outside screenshot")
        if state["visible"] is False:
            require(state["rootTag"] is None and row["inkPixels"] == 0 and not row["target"], "Retired LaggingLines must be absent")
            continue
        tag, event, width = state["rootTag"], state["layout"], state["rootWidth"]
        require(tag > 0 and event["eventTarget"] == event["currentTarget"] == tag, "Original LaggingLines ref/layout target mismatch")
        for key, value in [("width", width), ("height", 50)]:
            require(abs(event["layout"][key] - value) * scale <= 1, "Wrong delivered LaggingLines dimensions")
        if width == 0:
            require(row["inkPixels"] == 0 and row["referenceExact"] is True, "Zero LaggingLines must be exactly white")
            for key in ["target", "track"]:
                require(not row[key] or (len(row[key]) == 4 and abs(row[key][2]) * scale <= 1), "Zero native frame retained nonzero width")
            continue
        require(row["nativeLabel"] == "Fetching lines" and row["nativeValue"] == "busy" and row["inkPixels"] > 0, "Actual busy named LaggingLines paint missing")
        require(len(row["target"]) == len(row["track"]) == len(row["host"]) == 4 and len(row["wrappers"]) == len(row["visuals"]) == 3, "Actual three-line frame set missing")
        require(abs(row["target"][2] - width) * scale <= 1 and abs(row["target"][3] - 50) * scale <= 1 and abs(row["track"][2] - width) * scale <= 1, "Wrong actual root/track dimensions")
        static = row["name"] in LAGGING_GEOMETRY_NAMES or row["name"].startswith(("reduced-", "duration-zero-", "fresh-stopped"))
        for index, (wrapper, visual) in enumerate(zip(row["wrappers"], row["visuals"])):
            require(len(wrapper) == len(visual) == 4 and all(math.isfinite(value) for value in wrapper + visual), "Invalid native line frames")
            require(abs(wrapper[2] - row["track"][2] * .2) * scale <= 1 and abs(visual[2] - wrapper[2] * [1.2, 1.1, 1][index]) * scale <= 1 and abs(visual[3] - (7 if state["custom"] else 5)) * scale <= 1, "Wrong slide recipe/native geometry")
            require(row["track"][0] - 1 / scale <= wrapper[0] <= row["track"][0] + row["track"][2] + 1 / scale, "Native wrapper travel exceeds measured track")
            if static: require(abs(wrapper[0] - row["track"][0]) * scale <= 1, "Stopped wrapper displaced from first frame")
        if static: require(row["referenceExact"] is True, "Static lines differ from independent native reference")
    return {"status": "PASS", "observations": len(rows)}


def reconcile_lagging_lines_ios(raw):
    rows = [json.loads(row) for row in re.findall(r"LAGGING_LINES_OBSERVATION (\{[^\n]+\})", raw)]
    names = LAGGING_GEOMETRY_NAMES + [name + "-" + str(index) for name in LAGGING_MOTION_NAMES for index in range(4)] + ["retired", "retired-quiet", "fresh-stopped"]
    result = validate_lagging_lines_rows(rows, names)
    intervals = [json.loads(row) for row in re.findall(r"LAGGING_LINES_MOTION (\{[^\n]+\})", raw)]
    require(sorted(row["name"] for row in intervals) == sorted(LAGGING_MOTION_NAMES), "Missing/duplicate LaggingLines motion intervals")
    for row in intervals:
        moving = row["name"] not in ["reduced", "duration-zero"]
        require(row["frames"] == 4 and row["moving"] is moving and len(row["changedPairsPerLine"]) == 3, "Wrong native motion interval")
        require((row["changedPairs"] > 0 and all(value > 0 for value in row["changedPairsPerLine"])) if moving else (row["changedPairs"] == 0 and row["changedPairsPerLine"] == [0, 0, 0]), "All three native line motion/static discrimination failed")
    by_name = {row["name"]: row for row in rows}
    require(by_name["reduced-0"]["state"]["motionEvents"][-1:] == [True] and by_name["resumed-0"]["state"]["motionEvents"][-1:] == [False], "Actual live Reduce Motion events missing")
    require(by_name["fresh-stopped"]["state"]["rootTag"] != by_name["duration-zero-0"]["state"]["rootTag"], "Retired root reused")
    require(by_name["compact"]["state"]["rootWidth"] != by_name["percentage-before-compact"]["state"]["rootWidth"], "Percentage host constraint did not change actual width")
    require(re.findall(r"LAGGING_LINES_BUTTON_LABEL ([^\n]+)", raw) == ["Saving example action"], "Decorative loader changed Button name")
    original = re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])", raw)
    require(len(original) == 1 and original == re.findall(r"METER_STYLE_MOTION_RESTORED ([01])", raw), "Original Reduce Motion restoration missing")
    result.update(motionIntervals=len(intervals), originalAndRestoredMotion=original[0])
    return result



COUNTER_GEOMETRY_NAMES = ["baseline", "zero", "raw-string", "warning", "danger", "numeric-max-zero", "string-max-zero", "raw-text", "hidden-parts", "three-slots", "explicit-color", "fractional", "zero-width", "auto-width", "percentage", "dark", "compact", "live-restored", "light-restored"]


def validate_counter_rows(rows, names):
    require(sorted(row["name"] for row in rows) == sorted(names), "Missing/duplicate Counter observations")
    for row in rows:
        state, scale = row["state"], row["scale"]
        require(isinstance(scale, (int, float)) and math.isfinite(scale) and scale > 0, "Invalid Counter screenshot scale")
        require(row["backgroundRGB"] == ([16, 16, 16] if state["mode"] == "dark" else [255, 255, 255]), "Wrong Counter native background")
        parent, reference = row["parent"], row["referenceParent"]
        require(len(parent) == len(reference) == 4 and all(math.isfinite(v) for v in parent + reference) and parent[2:] == reference[2:] and parent[3] == 72 and 0 < parent[2] <= 330, "Wrong Counter reference parents")
        for frame in [parent, reference]:
            x, y, width, height = [math.floor(v * scale + .5) for v in frame]
            require(0 <= x < x + width <= row["imageWidth"] and 0 <= y < y + height <= row["imageHeight"], "Counter physical parent outside screenshot")
        require(row["referenceExact"] is True, "Counter paint differs from raw native reference")
        event = state["layouts"]["target"]
        require(state["rootTag"] > 0 and event["target"] == event["currentTarget"] == state["rootTag"], "Original Counter ref/layout targets differ")
        case = state["case"]
        width = 0 if case == "zero-width" else 183.25 if case == "fractional" else parent[2] - 16 if case in ["auto-width", "percentage"] else 180
        require(abs(event["layout"]["width"] - width) * scale <= 1 and abs(event["layout"]["height"] - 40) * scale <= 1, "Wrong delivered Counter dimensions")
        if width == 0: continue
        require(len(row["target"]) == 4 and abs(row["target"][2] - width) * scale <= 1 and abs(row["target"][3] - 40) * scale <= 1 and row["inkPixels"] > 0, "Wrong actual Counter root/paint")
        require(row["valueLabel"] == str(state["value"]), "Counter changed raw caller value")
        if case == "motion": continue
        optional = case not in ["numeric-max-zero", "hidden-parts"]
        if optional:
            require(row["ringLabel"] == "Native counter Progress" and row["suffixLabel"] == "/" + str(state["maxValue"]), "Counter optional labels/branches differ")
            size = 20 if case == "three-slots" else 12
            require(len(row["ringFrame"]) == 4 and all(abs(v - size) * scale <= 1 for v in row["ringFrame"][2:]), "Wrong Counter indicator slot geometry")
            if case not in ["string-max-zero", "raw-text"]:
                require(row["ringValue"] == {"zero": "0%", "raw-string": "49%", "warning": "80%", "danger": "90%"}.get(case, "25%"), "Wrong actual Counter progress semantics")
        else: require(row["ringLabel"] is None and row["suffixLabel"] is None and not row["ringFrame"], "Hidden Counter optional parts remain")
        if case != "three-slots": require(len(row["childFrame"]) == 4 and all(abs(v - 20) * scale <= 1 for v in row["childFrame"][2:]), "Ordinary empty native child was hidden/resized")
    return {"status": "PASS", "observations": len(rows)}


def validate_counter_touch(contacts, rows):
    baseline = [row for row in rows if row["name"] == "baseline"]
    require(len(baseline) == 1 and len(contacts) == 1 and contacts[0]["currentTarget"] == baseline[0]["state"]["rootTag"] and contacts[0]["target"] > 0, "Original native Counter touch missing")


def reconcile_counter_ios(raw, include_motion=True):
    all_rows = [json.loads(row) for row in re.findall(r"COUNTER_NATIVE_OBSERVATION (\{[^\n]+\})", raw)]
    rows = [row for row in all_rows if "state" in row]
    result = validate_counter_rows(rows, COUNTER_GEOMETRY_NAMES + (["normal-fresh", "reduced-fresh"] if include_motion else []))
    contacts = [json.loads(row) for row in re.findall(r"COUNTER_NATIVE_TOUCH (\{[^\n]+\})", raw)]
    validate_counter_touch(contacts, rows)
    named = {row["name"]: row for row in rows}
    require(named["compact"]["target"][2] != named["percentage"]["target"][2], "Counter percentage constraint did not change width")
    if not include_motion:
        result.update(motionIntervals=0, motionScope="Not selected; earlier clean method retains its original tuple")
        return result
    intervals = [json.loads(row) for row in re.findall(r"COUNTER_NATIVE_MOTION (\{[^\n]+\})", raw)]
    require(sorted(row["name"] for row in intervals) == ["normal", "reduced"], "Counter normal/reduced intervals missing")
    for row in intervals:
        scheduled = row["state"]["scheduled"]
        require([item["kind"] for item in scheduled] == ["red", "supersede-green", "blue", "red-again", "green-again", "retire", "fresh-blue"], "Counter interruption/retirement schedule incomplete")
        moving = [item for item in row["samples"] if item["captureStartedEpochMs"] >= scheduled[0]["epochMs"] and item["captureEpochMs"] < scheduled[5]["epochMs"]]
        require(len(moving) > 2 and len(moving) == row["movingRows"], "Insufficient Counter color observations")
        require(all(item["referenceExact"] for item in moving) if row["reduced"] else any(not item["referenceExact"] for item in moving), "Native Counter color interpolation/reduction failed")
        require(any(item["inkPixels"] == 0 for item in row["samples"]), "Actual Counter retirement paint missing")
    named = {row["name"]: row for row in rows}
    require(named["compact"]["target"][2] != named["percentage"]["target"][2], "Counter percentage constraint did not change width")
    original = re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])", raw)
    require(len(original) == 1 and original == re.findall(r"METER_STYLE_MOTION_RESTORED ([01])", raw), "Counter Reduce Motion original restoration unverified")
    result.update(motionIntervals=2, originalAndRestoredMotion=original[0], motionSamples=len(all_rows) - len(rows))
    return result





TOGGLE_BUTTON_BEHAVIOR = ["baseline","echo","disabled","held-disabled","restored","state-method","renderer","replaced","retired","fresh","auto-focus","local","local-default-changed","single-group","multiple-group","vetoed","echo-selected","held-canceled","state-requested","local-off","local-on","single-group-selected","multiple-group-selected"]
TOGGLE_BUTTON_STYLES = ["style-baseline","selected","root-custom","final-style","foreground","explicit-child","square","round","raised","long-narrow","fractional","percentage","auto","small-target","zero","dark","light-restored"]

def validate_toggle_button_rows(rows,names):
    require(sorted(row["name"] for row in rows)==sorted(names),"Missing/duplicate ToggleButton observations")
    for row in rows:
        state,scale=row["state"],row["scale"]
        require(isinstance(scale,(int,float)) and math.isfinite(scale) and scale>0 and scale==state["scale"],"Wrong ToggleButton scale")
        parent,reference=row["parent"],row["referenceParent"]
        require(len(parent)==len(reference)==4 and all(math.isfinite(v) for v in parent+reference) and parent[2:]==reference[2:] and 0<parent[2]<=280 and parent[3]==224,"Wrong ToggleButton parents")
        for frame in [parent,reference]:
            x,y,width,height=[math.floor(v*scale+.5) for v in frame]
            require(0<=x<x+width<=row["imageWidth"] and 0<=y<y+height<=row["imageHeight"],"ToggleButton parent outside physical screenshot")
        if state.get("raised"):
            matched=row.get("matchedReferenceParent",[])
            require(len(matched)==4 and all(math.isfinite(v) for v in matched) and [math.floor(v*scale+.5) for v in matched]==[math.floor(v*scale+.5) for v in parent],"Raised ToggleButton reference moved physical origin")
        require(row["referenceExact"] is True,"ToggleButton native reference mismatch")
        if not state["visible"]:
            require(not row["root"] and row["inkPixels"]==0 and state["rootTag"] is None,"Retired ToggleButton ref/paint remains")
            continue
        event=state["layouts"][-1];layout=event["layout"]
        require(state["rootTag"] and event["target"]==event["currentTarget"]==state["rootTag"],"Original ToggleButton layout/ref differs")
        if state["zero"]:
            require(layout["width"]==layout["height"]==0 and row["inkPixels"]==0,"Authored ToggleButton zero/clipping differs")
            continue
        require(row["targetCount"]==1 and row["nativeLabel"]==state["label"] and row["nativeEnabled"] is (not state["disabled"]),"ToggleButton name/guard/target differs")
        require([s.strip() for s in row["nativeValue"].split(",")]==(["radio button"] if state["radio"] else [])+["checked" if state["selected"] else "unchecked"] and (state["radio"] or row["nativeButton"]),"ToggleButton owned Button/radio/check native value differs")
        root,raw=row["root"],row["referenceRoot"]
        require(len(root)==len(raw)==4 and all(abs(a-b)*scale<=1 for a,b in zip([root[0]-parent[0],root[1]-parent[1],*root[2:]],[raw[0]-reference[0],raw[1]-reference[1],*raw[2:]])),"ToggleButton actual/reference frames differ")
        require(all(abs(root[i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"ToggleButton layout/native dimensions differ")
        if isinstance(state["width"],(int,float)):require(abs(root[2]-state["width"])*scale<=1,"ToggleButton authored width differs")
        require(abs(root[3]-24)*scale<=1 if state["small"] else root[3]>=44-1/scale,"ToggleButton explicit/default target height differs")
        if state["narrow"]:require(44<root[3] and root[1]+root[3]<=parent[1]+parent[3]-12+1/scale,"Constrained ToggleButton content clipped")
        for held in row.get("heldContactIntervals",[]):require(held["beganEpochMs"]<=held["disabledOnPressInEpochMs"]<held["endedEpochMs"]-400,"ToggleButton disable was not during held contact")
    return {"status":"PASS","observations":len(rows)}


def reconcile_toggle_button_ios(raw,config=None):
    config=config or {}
    retained=[]
    if config.get("batch") in ["toggle-button-affected","toggle-button-style"]:retained.append(("retainedToggleButtonMotion","testToggleButtonMotionAndRetirement"))
    if config.get("batch")=="toggle-button-style":retained.append(("retainedToggleButtonOwnership","testToggleButtonActionsAndLifetimes"))
    for binding,expected in retained:
        proof=json.loads(bound_file(config[binding]).read_text());require(proof["status"]=="PASS","Retained ToggleButton review did not pass")
        for source in proof["librarySources"]:bound_file(source)
        require(json.loads(bound_file(proof["cleanup"]).read_text())["cleanupVerified"],"Retained ToggleButton cleanup unverified")
        loaded=json.loads(bound_file(proof["loadedObserver"]).read_text());require(loaded["status"]=="PASS" and loaded["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained ToggleButton loaded observer differs")
        method=proof["nativeMethod"];require(method["method"]==expected and method["appManifestSHA256"]==proof["appManifestSHA256"] and method["observerManifestSHA256"]==proof["observerManifestSHA256"],"Only the exact clean ToggleButton method/tuple may be reused");native_method(method)
        prior=bound_file(proof["raw"]).read_text()
        if expected=="testToggleButtonActionsAndLifetimes":lines=[line for line in prior.splitlines() if line.startswith("TOGGLE_BUTTON_NATIVE_OBSERVATION ") and json.loads(line.split(" ",1)[1])["name"] in TOGGLE_BUTTON_BEHAVIOR]
        else:lines=[line for line in prior.splitlines() if line.startswith("TOGGLE_BUTTON_NATIVE_MOTION ") or line.startswith("METER_STYLE_MOTION_") or (line.startswith("TOGGLE_BUTTON_NATIVE_OBSERVATION ") and json.loads(line.split(" ",1)[1])["name"] in ["normal-fresh","reduced-fresh"])]
        raw+="\n"+"\n".join(lines)
    rows=[json.loads(x) for x in re.findall(r"TOGGLE_BUTTON_NATIVE_OBSERVATION (\{[^\n]+\})",raw)];result=validate_toggle_button_rows(rows,TOGGLE_BUTTON_BEHAVIOR+TOGGLE_BUTTON_STYLES+["normal-fresh","reduced-fresh"]);named={row["name"]:row for row in rows};tag=named["baseline"]["state"]["rootTag"]
    require(named["vetoed"]["state"]["actions"]==1 and not named["vetoed"]["state"]["selected"] and named["echo-selected"]["state"]["selected"],"ToggleButton veto/echo differs")
    for name in ["echo","disabled","held-disabled","restored","state-method","renderer"]:require(named[name]["state"]["rootTag"]==tag,"ToggleButton lost original renderer/ref")
    require(named["held-canceled"]["state"]["canceled"] and len(named["held-canceled"]["heldContactIntervals"])==1 and named["held-canceled"]["state"]["actions"]==2,"ToggleButton held cancellation differs")
    state=named["state-requested"]["state"];require(state["selected"] and state["actions"]==3 and state["phases"]==["change","press","change","press","change","press","change"],"ToggleButton state request/order differs")
    require(not named["local-off"]["state"]["selected"] and named["local-on"]["state"]["selected"] and named["local-default-changed"]["state"]["selected"],"ToggleButton local/default read-once differs")
    for name in ["single-group-selected","multiple-group-selected"]:require(named[name]["state"]["selected"] and named[name]["state"]["groupKeys"]==[0],"ToggleButton group native selection differs")
    require(named["fresh"]["state"]["rootTag"]!=tag and named["multiple-group-selected"]["state"]["actions"]==7,"ToggleButton lifetime/action count differs")
    motion=[json.loads(x) for x in re.findall(r"TOGGLE_BUTTON_NATIVE_MOTION (\{[^\n]+\})",raw)];require(len(motion)==2 and {m["name"] for m in motion}=={"normal","reduced"},"ToggleButton motion intervals missing")
    for interval in motion:
        trace=interval["state"]["motionTrace"];require([x["name"] for x in trace]==["select","interrupt","retarget","retire","fresh"],"ToggleButton motion schedule differs")
        samples=interval["samples"];moving=[row for row in samples if row["captureStartedEpochMs"]>=trace[0]["epochMs"] and row["captureEpochMs"]<trace[3]["epochMs"]];require(len(moving)>1 and any(row["inkPixels"]==0 for row in samples),"ToggleButton motion/retirement samples missing")
        if interval["reduced"]:require(all(row["referenceExact"] for row in moving),"Reduced ToggleButton interpolates")
        else:require(any(len(row["sampleRGBA"])==4 and 17<row["sampleRGBA"][0]<187 and 51<row["sampleRGBA"][1]<119 and 34<row["sampleRGBA"][2]<51 and row["sampleRGBA"][3]==255 for row in moving),"Actual ToggleButton interpolation missing")
    original=re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])",raw);restored=re.findall(r"METER_STYLE_MOTION_RESTORED ([01])",raw);require(len(original)==1 and original==restored,"ToggleButton original Reduce Motion restoration unverified")
    result.update(motionIntervals=2,motionFrames=sum(len(m["samples"]) for m in motion),originalMotionValue=original[0]);return result


PLACEHOLDER_NAMES = ["light-default","light-center","light-custom","light-final","light-custom-restored","light-computed-restored","dark-default","dark-final","light-explicit-retained","light-after-provider","empty-restored","full-final-deferred","narrow-final-deferred","narrow-after-first-action","reset-default"]


def reconcile_slider_ios(raw, output):
    begins = [json.loads(x) for x in re.findall(r"CODON_SLIDER_GESTURE_BEGIN (\{[^\n]+\})", raw)]
    finals = [json.loads(x) for x in re.findall(r"CODON_SLIDER_FINAL_OUTCOME (\{[^\n]+\})", raw)]
    require(len(begins)==len(finals)==4, "All four Slider native hit-layout witnesses required")
    captures = json.loads((Path(output)/"slider-held-captures.json").read_text())
    cases = []
    for index, (begin, final) in enumerate(zip(begins, finals)):
        geometry, owner, events = begin["geometry"], final["owner"], final["events"]
        tags = geometry["tags"]
        require(len(tags)==len(set(tags))==4 and all(type(x) is int and x>0 for x in tags), "Slider original native tags differ")
        preset = owner["preset"]
        key = preset+(":"+final["probe"] if preset=="rotated-scaled" else "")
        require(begin["before"]["preset"]==preset and begin["before"]["scalar"]==.5 and begin["before"]["requests"]==begin["before"]["ends"]==0, "Slider admission value was changed before contact")
        require(owner["rootTag"]==tags[0] and owner["dropped"]==0 and [x["sequence"] for x in events]==list(range(1,len(events)+1)) and all(x["rootTag"]==tags[0] and x["preset"]==preset for x in events), "Slider original trace/root was lost")
        touches = [x for x in events if x["kind"]=="touch"]
        downs, moves, ups = [[x for x in touches if x["phase"]==phase] for phase in ["start","move","end"]]
        require(len(downs)==len(ups)==1 and moves and not any(x["phase"]=="cancel" for x in touches), "Slider needs one continuous native DOWN/MOVE/UP")
        down, up = downs[0], ups[0]
        require(down["target"] in tags[1:3] and all(x["target"]==down["target"] and x["identifier"]==down["identifier"] for x in touches), "Slider original receiver/contact changed")
        require(down["sequence"]<moves[0]["sequence"]<=moves[-1]["sequence"]<up["sequence"] and down["timestamp"]<moves[0]["timestamp"]<=up["timestamp"], "Slider native contact ordering differs")
        thumb = down["target"]==tags[2]
        require(key=="rotated-scaled:aabb-corner" or thumb, "Measured thumb center must reach the original native thumb")
        track = geometry["window"]["track"]
        inset = 22 if track["width"]>44 else 0
        span = track["width"]-2*inset
        require(math.isfinite(span) and span>0, "Invalid original Slider track")
        offset = geometry["rootWindow"]["x"]-geometry["viewport"]["root"]["x"]
        snap = lambda value: min(1,max(0,math.floor(value*20+.5)/20))
        held = .5 if thumb else snap((down["pageX"]+offset-track["x"]-inset)/span)
        expected = snap(.5+(up["pageX"]-down["pageX"])/span) if thumb else snap((up["pageX"]+offset-track["x"]-inset)/span)
        requests = [x for x in events if x["kind"]=="request"]
        ends = [x for x in events if x["kind"]=="change-end"]
        require(requests and owner["requests"]==len(requests) and owner["ends"]==len(ends)==1 and owner["scalar"]==requests[-1]["value"]==ends[0]["value"]==expected, "Slider native hit classifier/request/end differs")
        if not thumb: require(requests[0]["value"]==held and requests[0]["sequence"]<moves[0]["sequence"], "Track native DOWN must request its actual value before MOVE")
        interval = (moves[0]["timestamp"]-down["timestamp"])/1000
        # BEGIN precedes DOWN. This conservative bound avoids inferring a held checkpoint from released state.
        before_move = begin["epochSeconds"]+min(begin["holdSeconds"],interval)
        candidates = []
        for capture in captures:
            if capture["gesture"]!=index: continue
            start, finish = capture["startedEpochSeconds"],capture["finishedEpochSeconds"]
            require(math.isfinite(start) and math.isfinite(finish) and begin["epochSeconds"]<=start<=finish, "Invalid independent Slider capture interval")
            png = Path(capture["png"])
            require(png.resolve().is_relative_to(Path(output).resolve()) and digest(png)==capture["pngSHA256"], "Independent Slider capture changed")
            if finish<before_move: candidates.append(capture)
        require(candidates, "Missing independent screen captured before the earliest possible MOVE")
        cases.append({"case":key,"nativeReceiver":"original-thumb" if thumb else "original-track","rootTag":tags[0],"target":down["target"],"identifier":down["identifier"],"expectedHeldScalar":held,"expectedHeldRequests":0 if thumb else 1,"expectedHeldEnds":0,"expectedFinal":expected,"nativeDownToMoveMs":interval*1000,"earliestMoveEpochSeconds":before_move,"candidateCaptures":candidates})
    require(sorted(x["case"] for x in cases)==sorted(["translated","repositioned","rotated-scaled:measured-center","rotated-scaled:aabb-corner"]), "Slider hit-layout coverage differs")
    return {"status":"NATIVE_PASS_PENDING_INDEPENDENT_HELD_SCREEN_REVIEW","cases":cases,"scope":"Four iOS witnesses only; original held DOWN/root/target/contact/value/request/end must be read from independent PNGs before G01 reconciliation. Android and whole-cell criteria remain separate."}


def validate_placeholder_rows(rows,names):
    require(sorted(row["name"] for row in rows)==sorted(names),"Missing/duplicate Placeholder observations")
    for row in rows:
        name,state,scale=row["name"],row["state"],row["scale"]
        require(isinstance(scale,(int,float)) and math.isfinite(scale) and scale>0,"Invalid Placeholder scale")
        frame,screen=row["frame"],row["screen"]
        require(len(frame)==len(screen)==4 and all(math.isfinite(v) for v in frame+screen) and frame[2]>0 and frame[3]>0,"Invalid Placeholder frames")
        x,y,width,height=[math.floor(v*scale+.5) for v in [frame[0]-screen[0],frame[1]-screen[1],frame[2],frame[3]]]
        require(0<=x<x+width<=row["imageWidth"] and 0<=y<y+height<=row["imageHeight"] and abs(screen[2]*scale-row["imageWidth"])<1 and abs(screen[3]*scale-row["imageHeight"])<1,"Placeholder crop outside actual screenshot")
        expected=[126,34,206,255] if any(v in name for v in ["final","explicit","first-action"]) else [166,107,0,255] if "custom" in name and "computed" not in name else [135,135,135,255] if name=="dark-default" else [112,112,112,255]
        require(row["expectedRGBA"]==expected and row["opaquePixels"]>=5,"Placeholder opaque glyph color/count differs")
        require(row["nativeLabel"]==row["text"] and state["rootTag"]>0 and state["refIdentity"]>0 and state["dropped"]==0,"Placeholder native label/ref/target differs")
    return {"status":"PASS","observations":len(rows)}


def reconcile_placeholder_ios(raw):
    rows=[json.loads(x) for x in re.findall(r"PLACEHOLDER_NATIVE_OBSERVATION (\{[^\n]+\})",raw)];result=validate_placeholder_rows(rows,PLACEHOLDER_NAMES);named={x["name"]:x for x in rows}
    for group in [PLACEHOLDER_NAMES[:6],PLACEHOLDER_NAMES[6:11],PLACEHOLDER_NAMES[11:14]]:
        first=named[group[0]]["state"]
        for name in group:
            require(all(named[name]["state"][key]==first[key] for key in ["rootTag","refIdentity","attaches","detaches"]),"Placeholder original ref lost")
    wide,narrow=named["full-final-deferred"]["frame"],named["narrow-final-deferred"]["frame"]
    require(narrow[2]<wide[2] and narrow[3]>wide[3]*1.5,"Placeholder native wrapping constraint missing")
    action=named["narrow-after-first-action"]["state"];require(action["actions"]==1 and [x["kind"] for x in action["receipts"]]==["pressIn","pressOut","press"] and all(x["native"]["target"]==action["rootTag"] for x in action["receipts"]),"Placeholder first native action/order/target differs")
    require(named["reset-default"]["state"]["actions"]==0,"Placeholder reset fabricated action")
    return result


SWITCH_BEHAVIOR = ["baseline","echo","disabled","readonly","held-disabled","restored","renderer","replaced","retired","fresh","local","local-default-changed","vetoed-1","vetoed-2","echo-activated-0","echo-activated-1","restored-activated-0","local-activated-0","local-activated-1","held-canceled"]
SWITCH_STYLES = ["style-baseline","selected","border","inverted","primary","root-custom","final-style","parts-custom","authored-left","orthogonal","round","icons","long-narrow","fractional","percentage","track-small","root-small","zero","dark","light-restored"]


def switch_physical_frame(frame,scale,width,height):
    require(len(frame)==4 and all(isinstance(v,(int,float)) and math.isfinite(v) for v in frame),"Invalid Switch frame")
    x,y,w,h=[math.floor(v*scale+.5) for v in frame]
    require(0<=x<x+w<=width and 0<=y<y+h<=height,"Switch crop outside physical screenshot")


def validate_switch_rows(rows,names):
    require(sorted(row["name"] for row in rows)==sorted(names),"Missing/duplicate Switch observations")
    for row in rows:
        state,scale=row["state"],row["scale"]
        require(isinstance(scale,(int,float)) and math.isfinite(scale) and scale>0 and scale==state["scale"],"Wrong Switch scale")
        parent,reference,matched=row["parent"],row["referenceParent"],row["matchedReferenceParent"]
        for frame in [parent,reference,matched]:switch_physical_frame(frame,scale,row["imageWidth"],row["imageHeight"])
        require(parent[2:]==reference[2:] and 0<parent[2]<=280 and parent[3]==224 and all(abs(a-b)*scale<=.5 for a,b in zip(parent,matched)),"Wrong Switch matched parents")
        require(row["referenceExact"] is True,"Switch same-origin raw reference mismatch")
        if not state["visible"]:
            require(not row["root"] and row["targetCount"]==0 and row["inkPixels"]==0 and state["rootTag"] is None,"Retired Switch ref/paint remains")
            continue
        event=state["layouts"][-1];layout=event["layout"]
        require(state["rootTag"]>0 and event["target"]==event["currentTarget"]==state["rootTag"],"Original Switch layout/ref differs")
        if state["zero"]:
            require(layout["width"]==layout["height"]==0 and row["inkPixels"]==0,"Authored Switch zero/clipping differs")
            continue
        require(row["targetCount"]==1 and row["nativeLabel"]=="Keep settings" and row["nativeEnabled"] is (not state["disabled"]) and row["nativeSwitch"] is True,"Switch role/name/guard/target differs")
        require(type(state["selected"]) is bool and type(row["nativeValue"]) in [str,int,float] and row["nativeValue"] in (["1",1] if state["selected"] else ["0",0]),"Switch checked native value differs")
        root,raw=row["root"],row["referenceRoot"]
        require(len(root)==len(raw)==4 and all(math.isfinite(v) for v in root+raw) and all(abs(a-b)*scale<=1 for a,b in zip([root[0]-parent[0],root[1]-parent[1],*root[2:]],[raw[0]-reference[0],raw[1]-reference[1],*raw[2:]])),"Switch actual/reference frames differ")
        require(all(abs(root[i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"Switch layout/native dimensions differ")
        if isinstance(state.get("rootWidth"),(int,float)):require(abs(root[2]-state["rootWidth"])*scale<=1,"Switch authored width differs")
        require(abs(root[3]-24)*scale<=1 if state["small"] else root[3]>=44-1/scale,"Switch explicit/default target height differs")
        if state["narrow"]:require(44<root[3] and root[1]+root[3]<=parent[1]+parent[3]-12+1/scale,"Constrained Switch content clipped")
        for held in row.get("heldContactIntervals",[]):require(held["beganEpochMs"]<=held["disabledOnPressInEpochMs"]<held["endedEpochMs"]-400,"Switch disable was not during held contact")
    return {"status":"PASS","observations":len(rows)}


def validate_switch_retirement(samples,retire,fresh):
    require(math.isfinite(retire) and math.isfinite(fresh) and retire<fresh,"Invalid Switch retirement epochs")
    require(all(math.isfinite(r["captureStartedEpochMs"]) and math.isfinite(r["captureEpochMs"]) and r["captureStartedEpochMs"]<=r["captureEpochMs"] for r in samples),"Invalid Switch retirement capture intervals")
    candidates=[r for r in samples if r["captureStartedEpochMs"]>=retire and r["captureEpochMs"]<fresh]
    require(all(type(r.get("referenceInkPixels")) is int and r["referenceInkPixels"]>=0 and type(r.get("inkPixels")) is int and r["inkPixels"]>=0 for r in candidates),"Missing Switch native removal witness")
    first=next((i for i,r in enumerate(candidates) if r["referenceInkPixels"]==0),None)
    require(first is not None,"No confirmed native reference removal")
    absent=candidates[first:]
    require(all(r["referenceInkPixels"]==r["inkPixels"]==0 and r["thumbRun"]==r["sampleRGBA"]==[] for r in absent),"Switch paint/work remains after native reference removal")
    return {"pendingNativeCommitFrames":first,"verifiedAbsentFrames":len(absent)}


def validate_switch_motion(interval):
    state,trace,samples=interval["state"],interval["state"]["motionTrace"],interval["samples"]
    require(interval["name"] in ["normal","reduced"] and interval["reduced"] is (interval["name"]=="reduced") and state["motionEvents"][-1] is interval["reduced"],"Switch actual motion preference differs")
    require([x["name"] for x in trace]==["select","interrupt","retarget"]+["retarget-"+str(i) for i in range(3,32)]+["settle","retire","fresh"],"Switch motion schedule differs")
    epochs=[x["epochMs"] for x in trace];require(all(math.isfinite(x) for x in epochs) and all(a<=b for a,b in zip(epochs,epochs[1:])),"Switch schedule epochs differ")
    times={row["name"]:row["epochMs"] for row in trace}
    previous=0
    for row in samples:
        start,end,scale=row["captureStartedEpochMs"],row["captureEpochMs"],row["scale"]
        require(all(math.isfinite(v) for v in [start,end,scale]) and previous<=start<=end and scale>0,"Switch complete capture interval differs");previous=end
        for key in ["parent","referenceParent","sampleFrame","referenceSampleFrame"]:switch_physical_frame(row[key],scale,row["imageWidth"],row["imageHeight"])
        require(abs(row["sampleFrame"][2]-30)*scale<=1 and round(row["sampleFrame"][3]*scale)==1,"Switch actual track scanline differs")
        for key in ["thumbRun","referenceThumbRun"]:
            run=row[key];require(not run or len(run)==2 and all(type(x) is int for x in run) and 0<=run[0]<run[0]+run[1]<=round(30*scale),"Switch thumb run outside track")
    moving=[r for r in samples if r["captureStartedEpochMs"]>=times["select"] and r["captureEpochMs"]<times["retire"]]
    require(len(moving)>1 and interval["movingRows"]==len(moving),"Switch moving observations missing")
    if interval["reduced"]:require(all(r["referenceExact"] is True for r in moving),"Reduced Switch interpolates")
    else:
        require(any(len(r["sampleRGBA"])==4 and 17<r["sampleRGBA"][0]<187 and 51<r["sampleRGBA"][1]<119 and 34<r["sampleRGBA"][2]<51 and r["sampleRGBA"][3]==255 for r in moving),"Actual Switch250ms color interpolation missing")
        require(any(len(r["thumbRun"])==2 and 1<r["thumbRun"][0]<15*r["scale"]-1 for r in moving),"Actual Switch225ms thumb interpolation missing")
    settled=[r for r in samples if r["captureStartedEpochMs"]>=times["settle"]+250 and r["captureEpochMs"]<times["retire"]]
    fresh=[r for r in samples if r["captureStartedEpochMs"]>=times["fresh"]+250]
    absent=[r for r in samples if r["captureStartedEpochMs"]>=times["retire"] and r["captureEpochMs"]<times["fresh"]]
    require(settled and fresh and all(r["referenceExact"] is True for r in settled+fresh),"Switch settled/fresh endpoint differs")
    validate_switch_retirement(samples,times["retire"],times["fresh"])
    require(state["rootTag"]>0 and state["rootTag"]!=interval["originalRootTag"] and state["visible"] is True and state["layouts"][-1]["currentTarget"]==state["rootTag"],"Switch fresh current ref missing")
    return len(samples)


def reconcile_switch_ios(raw,config=None,app=None):
    config=config or {}
    if config.get("batch")=="switch-motion":
        proof=json.loads(bound_file(config["retainedSwitchStaticMethods"]).read_text());require(proof["status"]=="PASS" and app and app["manifestSHA256"]==proof["appManifestSHA256"],"Retained Switch app/method review differs")
        for source in proof["librarySources"]:bound_file(source)
        require(json.loads(bound_file(proof["cleanup"]).read_text())["cleanupVerified"],"Retained Switch cleanup unverified")
        loaded=json.loads(bound_file(proof["loadedObserver"]).read_text());require(loaded["status"]=="PASS" and loaded["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained Switch loaded observer differs")
        require({m["method"] for m in proof["nativeMethods"]}=={"testSwitchActionsAndLifetimes","testSwitchStylesAndConstraints"},"Only the two clean Switch methods may be reused")
        for method in proof["nativeMethods"]:
            require(method["appManifestSHA256"]==proof["appManifestSHA256"] and method["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained Switch tuple differs");native_method(method)
        prior=bound_file(proof["raw"]).read_text();lines=[line for line in prior.splitlines() if line.startswith("SWITCH_NATIVE_OBSERVATION ") and json.loads(line.split(" ",1)[1])["name"] in SWITCH_BEHAVIOR+SWITCH_STYLES]
        validate_switch_rows([json.loads(line.split(" ",1)[1]) for line in lines],SWITCH_BEHAVIOR+SWITCH_STYLES);raw+="\n"+"\n".join(lines)
    rows=[json.loads(x) for x in re.findall(r"SWITCH_NATIVE_OBSERVATION (\{[^\n]+\})",raw)]
    result=validate_switch_rows(rows,SWITCH_BEHAVIOR+SWITCH_STYLES);named={row["name"]:row for row in rows};tag=named["baseline"]["state"]["rootTag"]
    for name in ["vetoed-1","vetoed-2"]:require(named[name]["state"]["selected"] is False,"Switch controlled veto mutated output")
    require(named["vetoed-2"]["state"]["requests"]==[True,True],"Switch repeat veto requests differ")
    for name in ["echo","disabled","readonly","held-disabled","restored","renderer"]:require(named[name]["state"]["rootTag"]==tag,"Switch original renderer/ref lost")
    require(named["echo-activated-0"]["state"]["selected"] is True and named["echo-activated-1"]["state"]["selected"] is False and named["echo-activated-1"]["state"]["actions"]==4,"Switch owner echo differs")
    require(named["held-canceled"]["state"]["canceled"] is True and len(named["held-canceled"]["heldContactIntervals"])==1 and named["held-canceled"]["state"]["actions"]==4,"Switch held cancellation differs")
    final=named["local-default-changed"]["state"];presses=[x for x in final["events"] if x["phase"]=="press"]
    require(final["selected"] is False and final["actions"]==7 and final["requests"]==[True,True,True,False,True,True,False] and final["phases"]==["change","press"]*7,"Switch local default/action/request order differs")
    require(len(presses)==7 and all(x["target"]>0 and x["currentTarget"]==tag for x in presses[:5]),"Switch original native event targets differ")
    for name in ["replaced","fresh"]:require(named[name]["state"]["rootTag"]!=tag,"Switch retired ref reused")
    require(named["dark"]["state"]["themeMode"]=="dark" and named["light-restored"]["state"]["themeMode"]=="light","Switch mounted provider update missing")
    motion=[json.loads(x) for x in re.findall(r"SWITCH_NATIVE_MOTION (\{[^\n]+\})",raw)]
    require(len(motion)==2 and {m["name"] for m in motion}=={"normal","reduced"},"Switch motion intervals missing")
    frames=sum(validate_switch_motion(m) for m in motion)
    original=re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])",raw);restored=re.findall(r"METER_STYLE_MOTION_RESTORED ([01])",raw)
    require(len(original)==1 and original==restored,"Switch original Reduce Motion restoration unverified")
    result.update(motionIntervals=2,motionFrames=frames,originalMotionValue=original[0]);return result


CHECKBOX_BEHAVIOR = ['baseline', 'echo', 'disabled', 'readonly', 'held-disabled', 'restored', 'renderer', 'mixed', 'group-veto', 'group-echo', 'group-disabled', 'group-readonly', 'replaced', 'retired', 'fresh', 'local', 'local-default-changed', 'vetoed-1', 'vetoed-2', 'echo-activated-0', 'echo-activated-1', 'restored-activated-0', 'mixed-activated-0', 'group-veto-activated-0', 'group-echo-activated-0', 'local-activated-0', 'local-activated-1', 'held-canceled']
CHECKBOX_STYLES = ['style-baseline', 'selected', 'mixed-style', 'no-icon', 'mixed-no-icon', 'primary', 'raised', 'root-custom', 'final-style', 'explicit-child', 'orthogonal', 'round', 'long-narrow', 'fractional', 'percentage', 'root-small', 'zero', 'dark', 'light-restored']

def validate_checkbox_rows(rows,names):
    require(sorted(row["name"] for row in rows)==sorted(names),"Missing/duplicate Checkbox observations")
    for row in rows:
        state,scale=row["state"],row["scale"]
        require(isinstance(scale,(int,float)) and math.isfinite(scale) and scale>0 and scale==state["scale"],"Wrong Checkbox scale")
        parent,reference,matched=row["parent"],row["referenceParent"],row["matchedReferenceParent"]
        for frame in [parent,reference,matched]:switch_physical_frame(frame,scale,row["imageWidth"],row["imageHeight"])
        require(parent[2:]==reference[2:] and 0<parent[2]<=280 and parent[3]==224 and all(abs(a-b)*scale<=.5 for a,b in zip(parent,matched)),"Wrong Checkbox matched parents")
        require(row["referenceExact"] is True,"Checkbox same-origin raw reference mismatch")
        if not state["visible"]:
            require(not row["root"] and row["targetCount"]==0 and row["inkPixels"]==0 and state["rootTag"] is None,"Retired Checkbox ref/paint remains")
            continue
        event=state["layouts"][-1];layout=event["layout"]
        require(state["rootTag"]>0 and event["target"]==event["currentTarget"]==state["rootTag"],"Original Checkbox layout/ref differs")
        if state["zero"]:
            require(layout["width"]==layout["height"]==0 and row["inkPixels"]==0,"Authored Checkbox zero/clipping differs")
            continue
        require(row["targetCount"]==1 and row["nativeLabel"]=="Keep settings" and row["nativeEnabled"] is (not state["disabled"]) and row["nativeCheckbox"] is True,"Checkbox role/name/guard/target differs")
        require(type(state["selected"]) is bool and type(state["mixed"]) is bool and isinstance(row["nativeValue"],str) and [part.strip() for part in row["nativeValue"].split(",")]==["checkbox","mixed" if state["mixed"] else "checked" if state["selected"] else "unchecked"],"Checkbox checked/mixed native value differs")
        root,raw=row["root"],row["referenceRoot"]
        require(len(root)==len(raw)==4 and all(math.isfinite(v) for v in root+raw) and all(abs(a-b)*scale<=1 for a,b in zip([root[0]-parent[0],root[1]-parent[1],*root[2:]],[raw[0]-reference[0],raw[1]-reference[1],*raw[2:]])),"Checkbox actual/reference frames differ")
        require(all(abs(root[i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"Checkbox layout/native dimensions differ")
        if isinstance(state.get("rootWidth"),(int,float)):require(abs(root[2]-state["rootWidth"])*scale<=1,"Checkbox authored width differs")
        require(abs(root[3]-24)*scale<=1 if state["small"] else root[3]>=44-1/scale,"Checkbox explicit/default target height differs")
        if state["narrow"]:require(44<root[3] and root[1]+root[3]<=parent[1]+parent[3]-12+1/scale,"Constrained Checkbox content clipped")
        for held in row.get("heldContactIntervals",[]):require(held["beganEpochMs"]<=held["disabledOnPressInEpochMs"]<held["endedEpochMs"]-400,"Checkbox disable was not during held contact")
    return {"status":"PASS","observations":len(rows)}


def checkbox_intermediate(rgba,low,high):
    return len(rgba)==len(low)==len(high)==4 and rgba[3]==low[3]==high[3]==255 and low!=high and all(min(a,b)<=x<=max(a,b) for x,a,b in zip(rgba[:3],low[:3],high[:3])) and any(min(a,b)<x<max(a,b) for x,a,b in zip(rgba[:3],low[:3],high[:3]))


def validate_checkbox_motion(interval):
    state,trace,samples=interval["state"],interval["state"]["motionTrace"],interval["samples"]
    require(interval["name"] in ["normal","reduced"] and interval["reduced"] is (interval["name"]=="reduced") and state["motionEvents"][-1] is interval["reduced"],"Checkbox actual motion preference differs")
    require([x["name"] for x in trace]==["select","interrupt","retarget"]+["retarget-"+str(i) for i in range(3,32)]+["settle","retire","fresh"],"Checkbox motion schedule differs")
    epochs=[x["epochMs"] for x in trace];require(all(math.isfinite(x) for x in epochs) and all(a<=b for a,b in zip(epochs,epochs[1:])),"Checkbox schedule epochs differ")
    times={r["name"]:r["epochMs"] for r in trace};previous=0
    for row in samples:
        start,end,scale=row["captureStartedEpochMs"],row["captureEpochMs"],row["scale"]
        require(all(math.isfinite(v) for v in [start,end,scale]) and previous<=start<=end and scale>0,"Checkbox complete capture interval differs");previous=end
        for key in ["parent","referenceParent","sampleFrame","referenceSampleFrame","glyphFrame","referenceGlyphFrame"]:switch_physical_frame(row[key],scale,row["imageWidth"],row["imageHeight"])
        require(round(row["sampleFrame"][2]*scale)==round(row["sampleFrame"][3]*scale)==1 and row["glyphFrame"][2:]==[16,16],"Checkbox actual shape/glyph sample differs")
        require(all(type(row[k]) is int and 0<=row[k]<=round(16*scale)**2 for k in ["glyphPixels","referenceGlyphPixels"]),"Checkbox glyph count differs")
    moving=[r for r in samples if r["captureStartedEpochMs"]>=times["select"] and r["captureEpochMs"]<times["retire"]]
    require(len(moving)>1 and interval["movingRows"]==len(moving),"Checkbox moving observations missing")
    if interval["reduced"]:require(all(r["referenceExact"] is True for r in moving),"Reduced Checkbox interpolates")
    else:
        colors=[r["referenceSampleRGBA"] for r in samples if len(r["referenceSampleRGBA"])==4];low=colors[0];high=next((c for c in colors if c!=low),low)
        require(any(checkbox_intermediate(r["sampleRGBA"],low,high) for r in moving),"Actual Checkbox175ms shape interpolation missing")
        counts={r["referenceGlyphPixels"] for r in samples if r["referenceSampleRGBA"]==[17,119,51,255]}
        require(len(counts)==1 and next(iter(counts),0)>0,"Checkbox selected reference glyph is missing/inconsistent")
        full=next(iter(counts));require(any(r["sampleRGBA"] and r["sampleRGBA"]!=[255,255,255,255] and 0<r["glyphPixels"]<full for r in moving),"Actual Checkbox250ms glyph interpolation missing; white background is not glyph paint")
    settled=[r for r in samples if r["captureStartedEpochMs"]>=times["settle"]+250 and r["captureEpochMs"]<times["retire"]];fresh=[r for r in samples if r["captureStartedEpochMs"]>=times["fresh"]+250]
    require(settled and fresh and all(r["referenceExact"] is True for r in settled+fresh),"Checkbox settled/fresh endpoint differs")
    retired=[dict(r,thumbRun=[] if r["glyphPixels"]==0 else [1,r["glyphPixels"]]) for r in samples]
    validate_switch_retirement(retired,times["retire"],times["fresh"])
    require(state["rootTag"]>0 and state["rootTag"]!=interval["originalRootTag"] and state["visible"] is True and state["layouts"][-1]["currentTarget"]==state["rootTag"],"Checkbox fresh current ref missing")
    return len(samples)


def reconcile_checkbox_ios(raw,config=None,app=None):
    config=config or {}
    if config.get("batch")=="checkbox-motion":
        proof=json.loads(bound_file(config["retainedCheckboxStaticMethods"]).read_text());require(proof["status"]=="PASS" and app and proof["appManifestSHA256"]==app["manifestSHA256"],"Retained Checkbox app differs")
        for item in proof["librarySources"]:bound_file(item)
        require(json.loads(bound_file(proof["cleanup"]).read_text())["cleanupVerified"],"Retained Checkbox cleanup unverified")
        loaded=json.loads(bound_file(proof["loadedObserver"]).read_text());require(loaded["status"]=="PASS" and loaded["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained Checkbox loaded identity differs")
        require({m["method"] for m in proof["nativeMethods"]}=={"testCheckboxActionsAndLifetimes","testCheckboxStylesAndConstraints"},"Two clean Checkbox static methods required")
        for method in proof["nativeMethods"]:
            require(method["appManifestSHA256"]==proof["appManifestSHA256"] and method["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained Checkbox tuple differs");native_method(method)
        old=bound_file(proof["raw"]).read_text();lines=[line for line in old.splitlines() if line.startswith("CHECKBOX_NATIVE_OBSERVATION ")];validate_checkbox_rows([json.loads(line.split(" ",1)[1]) for line in lines],CHECKBOX_BEHAVIOR+CHECKBOX_STYLES);raw+="\n"+"\n".join(lines)
    rows=[json.loads(x) for x in re.findall(r"CHECKBOX_NATIVE_OBSERVATION (\{[^\n]+\})",raw)]
    result=validate_checkbox_rows(rows,CHECKBOX_BEHAVIOR+CHECKBOX_STYLES);named={r["name"]:r for r in rows};tag=named["baseline"]["state"]["rootTag"]
    require(named["vetoed-2"]["state"]["selected"] is False and named["vetoed-2"]["state"]["requests"]==[True,True],"Checkbox veto differs")
    for name in ["echo","disabled","readonly","held-disabled","restored","renderer","mixed"]:require(named[name]["state"]["rootTag"]==tag,"Checkbox original renderer/ref lost")
    require(named["mixed-activated-0"]["state"]["mixed"] is True and named["mixed-activated-0"]["state"]["selected"] is False,"Checkbox authored mixed ownership differs")
    require(named["group-veto-activated-0"]["state"]["groupValue"]==[] and named["group-echo-activated-0"]["state"]["groupValue"]==["one"],"Checkbox group ownership differs")
    require(named["held-canceled"]["state"]["canceled"] is True and len(named["held-canceled"]["heldContactIntervals"])==1 and named["held-canceled"]["state"]["actions"]==4,"Checkbox held cancellation differs")
    final=named["local-default-changed"]["state"];presses=[x for x in final["events"] if x["phase"]=="press"]
    require(final["selected"] is False and final["actions"]==10 and final["requests"]==[True,True,True,False,True,False,True,True,True,False] and final["phases"]==["change","press"]*6+["group","change","press"]*2+["change","press"]*2,"Checkbox local/group callback order differs")
    require(final["groupRequests"]==[["one"],["one"]] and len(presses)==10 and all(x["target"]>0 and x["currentTarget"]==tag for x in presses[:6]),"Checkbox original group/native events differ")
    for name in ["replaced","fresh"]:require(named[name]["state"]["rootTag"]!=tag,"Checkbox retired ref reused")
    require(named["dark"]["state"]["themeMode"]=="dark" and named["light-restored"]["state"]["themeMode"]=="light","Checkbox mounted provider missing")
    if config.get("batch")=="checkbox-static":
        result.update(motionIntervals=0,remaining=["Separate clean normal/reduced motion batch required; no wholeG08 qualification from static evidence alone."]);return result
    motion=[json.loads(x) for x in re.findall(r"CHECKBOX_NATIVE_MOTION (\{[^\n]+\})",raw)];require(len(motion)==2 and {m["name"] for m in motion}=={"normal","reduced"},"Checkbox motion intervals missing")
    frames=sum(validate_checkbox_motion(m) for m in motion)
    original=re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])",raw);restored=re.findall(r"METER_STYLE_MOTION_RESTORED ([01])",raw);require(len(original)==1 and original==restored,"Checkbox Reduce Motion restoration missing")
    result.update(motionIntervals=2,motionFrames=frames,originalMotionValue=original[0]);return result



CHECKBOX_GROUP_BEHAVIOR=["baseline","echo","disabled","readonly","renderer","nested","replacement","retired","fresh","local","default-changed","veto-1","veto-2","echo-beta","echo-alpha","echo-remove-beta","nested-changed","loose-changed","local-remove-beta","local-add-alpha"]
CHECKBOX_GROUP_STYLES=["style-baseline","horizontal","wrap","custom","final","registered","fractional","percentage","long-narrow","zero","dark","light-restored"]

def reconcile_checkbox_group_ios(raw,config=None,app=None):
    config=config or {}
    if config.get("batch")=="checkbox-group-actions":
        proof=json.loads(bound_file(config["retainedGroupStyles"]).read_text());require(proof["status"]=="PASS" and app and proof["appManifestSHA256"]==app["manifestSHA256"],"Retained group app differs")
        require(proof["sources"],"Retained group sources missing")
        for item in proof["sources"]:bound_file(item)
        cleanup=json.loads(bound_file(proof["cleanup"]).read_text());require(cleanup["cleanupVerified"] and not cleanup.get("cleanupErrors") and cleanup["elapsedSeconds"]<1800,"Retained group cleanup/budget invalid")
        command=json.loads(bound_file(proof["sdkCommand"]).read_text());require(command["ownedGroupGone"] and not command.get("timedOut"),"Retained group SDK timeout/cleanup")
        loaded=json.loads(bound_file(proof["loadedObserver"]).read_text());require(loaded["status"]=="PASS" and loaded["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained group loaded observer differs")
        method=proof["nativeMethod"];require(method["method"]=="testCheckboxGroupStylesAndConstraints" and method["appManifestSHA256"]==proof["appManifestSHA256"] and method["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained group style tuple differs");native_method(method)
        prior=bound_file(proof["raw"]).read_text();lines=[line for line in prior.splitlines() if line.startswith("CHECKBOX_GROUP_NATIVE_OBSERVATION ") and json.loads(line.split(" ",1)[1])["name"] in CHECKBOX_GROUP_STYLES]
        require(sorted(json.loads(line.split(" ",1)[1])["name"] for line in lines)==sorted(CHECKBOX_GROUP_STYLES),"Retained group style coverage missing/duplicate")
        raw+="\n"+"\n".join(lines)
    rows=[json.loads(x) for x in re.findall(r"CHECKBOX_GROUP_NATIVE_OBSERVATION (\{[^\n]+\})",raw)]
    require(sorted(row["name"] for row in rows)==sorted(CHECKBOX_GROUP_BEHAVIOR+CHECKBOX_GROUP_STYLES),"Missing/duplicate CheckboxGroup native observations")
    named={row["name"]:row for row in rows}
    for row in rows:
        state,scale=row["state"],row["scale"]
        require(scale==state["scale"] and math.isfinite(scale) and scale>0,"Wrong CheckboxGroup scale")
        require(row["referenceExact"] is True,"CheckboxGroup native raw reference mismatch")
        parent,reference=row["parent"],row["referenceParent"]
        require(len(parent)==len(reference)==4 and parent[2:]==reference[2:] and 0<parent[2]<=280 and parent[3]==224,"CheckboxGroup parent dimensions differ")
        for frame in [parent,reference]:
            require(all(math.isfinite(v) for v in frame),"Nonfinite group parent")
            x,y,width,height=[math.floor(v*scale+.5) for v in frame]
            require(0<=x<x+width<=row["imageWidth"] and 0<=y<y+height<=row["imageHeight"],"CheckboxGroup parent outside screenshot")
        if not state["visible"]:
            require(not row["root"] and not row["members"] and state["rootTag"] is None and row["inkPixels"]==0,"Retired group/ref/paint remains")
            continue
        tag=state["rootTag"];event=state["layouts"][-1];layout=event["layout"]
        require(tag and tag==event["target"]==event["currentTarget"],"Original group layout/ref target differs")
        if state["zero"]:
            require(layout["width"]==layout["height"]==row["inkPixels"]==0,"Zero group retained paint/dimensions")
            for frame in [row["root"],row["referenceRoot"]]:
                require(not frame or (len(frame)==4 and all(math.isfinite(v) for v in frame) and frame[2:]==[0,0]),"Zero AX root retained dimensions")
            continue
        root,reference_root=row["root"],row["referenceRoot"]
        require(len(root)==len(reference_root)==4 and all(math.isfinite(v) for v in root+reference_root),"Group native frames differ")
        first=[root[0]-parent[0],root[1]-parent[1],*root[2:]];second=[reference_root[0]-reference[0],reference_root[1]-reference[1],*reference_root[2:]]
        require([math.floor(v*scale+.5) for v in first]==[math.floor(v*scale+.5) for v in second],"Group native reference geometry differs")
        require(all(abs(root[i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"Group native/onLayout dimensions differ")
        if isinstance(state["width"],(int,float)):require(abs(root[2]-state["width"])*scale<=1,"Authored group width differs")
        ids=["alpha","nested","loose"] if state["nested"] else ["alpha","beta"]
        require(sorted(x["id"] for x in row["members"])==sorted(ids),"Group independent member targets missing/duplicated")
        for member in row["members"]:
            id=member["id"];selected=state["looseValue"] if id=="loose" else id in (state["nestedValue"] if id=="nested" else state["value"])
            require(member["label"]==state["labels"][id] and member["enabled"] is (not state["disabled"] or id=="nested"),"Group member label/guard differs")
            require(member["value"]=="checkbox, "+("checked" if selected else "unchecked"),"Group member native checked value differs")
            actual,expected=member["relativeFrame"],member["referenceRelativeFrame"]
            require(len(actual)==len(expected)==4 and all(math.isfinite(v) for v in actual+expected) and actual[2]>0 and actual[3]>=44-1/scale,"Invalid member frame/target")
            require([math.floor(v*scale+.5) for v in actual]==[math.floor(v*scale+.5) for v in expected],"Member reference frame differs")
        if state["narrow"]:require(row["members"][0]["relativeFrame"][3]>44 and root[1]+root[3]<=parent[1]+parent[3]-12+1/scale,"Group constrained text clipped")
    original=named["baseline"]["state"]["rootTag"]
    for name in ["echo","disabled","readonly","renderer","nested"]:require(named[name]["state"]["rootTag"]==original,"Original group renderer/ref replaced")
    for name in ["replacement","fresh"]:require(named[name]["state"]["rootTag"]!=original,"Fresh group reused retired ref")
    for name in ["veto-1","veto-2"]:require(named[name]["state"]["value"]==[],"Group veto ignored")
    require(named["echo-remove-beta"]["state"]["value"]==["alpha"],"Group append/remove array order differs")
    require(named["loose-changed"]["state"]["nestedValue"]==[] and named["loose-changed"]["state"]["looseValue"] is False,"Nested/value-less ownership differs")
    final=named["default-changed"]["state"]
    require(final["value"]==["alpha"] and final["requests"]==[["alpha"],["alpha"],["beta"],["beta","alpha"],["alpha"],[],["alpha"]],"Group immutable requests/default read-once differs")
    phases=sum((["group:root","member:"+id,"press:"+id] for id in ["alpha","alpha","beta","alpha","beta"]),[])+["nested:nested","member:nested","press:nested","member:loose","press:loose"]+sum((["group:root","member:"+id,"press:"+id] for id in ["beta","alpha"]),[])
    require(final["phases"]==phases,"Group-before-member/press order differs")
    events=[x for x in final["events"] if x["phase"]=="press"]
    require(len(events)==9 and all(x["target"]>0 and x["currentTarget"]>0 for x in events),"Group original native event fields missing")
    require(named["dark"]["state"]["themeMode"]=="dark" and named["light-restored"]["state"]["themeMode"]=="light","Group provider restoration missing")
    return {"status":"PASS","observations":len(rows),"nativeActivations":9,"motion":"Group owns no motion; unchanged member clocks retain their separately bound CHK-08 proof."}













def early_tooltip_observer(session,observer):
    output=session.output/"early-loaded-observer.json"
    def inspect():
        log=session.output/"xctest.stdout"
        if output.exists() or not log.exists():return
        rows=[json.loads(x) for x in re.findall(r"NATIVE_LOADED_OBSERVER_EARLY (\{[^\n]+\})",log.read_text(errors="replace"))]
        if not rows:return
        expected=observer["filesSHA256"]["PlugIns/CodonNativeComponents.xctest/CodonNativeComponents"]
        require(all(x["sha256"]==x["expectedSHA256"]==expected for x in rows),"Early actual loaded Tooltip executable differs")
        row=rows[-1];bundle=Path(row["path"]);executable=Path(row["executable"])
        require(bundle.name=="CodonNativeComponents.xctest" and executable.parent==bundle and digest(executable)==expected,"Early actual loaded Tooltip path/bytes differ")
        verify_product(observer,bundle.parent.parent)
        write(output,{"status":"PASS","verifiedUTC":datetime.datetime.now(datetime.timezone.utc).isoformat(),"observerManifestSHA256":observer["manifestSHA256"],"nativeBeforeAppLaunch":rows,"loadedTestBundle":str(bundle),"executableSHA256":expected,"basis":"Native SHA check before app launch; actual loaded plug-in and full host bytes verified during SDK execution."})
    return inspect


TOOLTIP_STYLES=["baseline","custom","final","arrow-zero","narrow","dark","light-restored"]
def validate_tooltip_rows(rows,names):
    require(sorted(x["name"] for x in rows)==sorted(names),"Missing/duplicate Tooltip observations")
    for row in rows:
        state,scale=row["state"],row["scale"]
        require(isinstance(scale,(int,float)) and math.isfinite(scale) and scale>0,"Invalid Tooltip scale")
        if not state["open"] or not state["mounted"]:
            require(not row["root"] and state["rootTag"] is None,"Closed Tooltip host remains");continue
        root,window=row["root"],row["window"]
        require(len(root)==len(window)==4 and all(math.isfinite(x) for x in root+window) and root[2]>0 and root[3]>0,"Invalid Tooltip native frames")
        x,y,w,h=[math.floor(v*scale+.5) for v in root];require(0<=x<x+w<=row["imageWidth"] and 0<=y<y+h<=row["imageHeight"],"Tooltip outside physical screenshot")
        require(abs(root[2]-(128 if state["narrow"] else 220))*scale<=1,"Tooltip authored width differs")
        layout=state["layouts"][-1];require(layout["target"]==layout["currentTarget"]==state["rootTag"] and all(abs(root[i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"Tooltip original layout/ref differs")
        anchor=row["anchor"];placement=state["rendered"]["placement"];require(placement in ["top","bottom"] and (root[1]+root[3]<=anchor[1] if placement=="top" else root[1]>=anchor[1]+anchor[3]),"Tooltip actual placement overlaps anchor")
        if state["mode"]!="motion":
            measured=state["arrowLayout"];require(measured["target"]==measured["currentTarget"]>0 and measured["parentTag"]==state["rootTag"],"Tooltip original arrow layout/ref differs")
            expected_arrow=[root[0]+measured["x"]-measured["width"]/2,root[1]+measured["y"],measured["width"],measured["height"]]
            arrow=row["arrow"];require(row["arrowLayoutSource"]=="original-native-onLayout" and len(arrow)==4 and all(math.isfinite(x) for x in arrow) and all(abs(x-y)*scale<=1 for x,y in zip(arrow,expected_arrow)),"Tooltip original arrow native frame differs")
            require(abs(arrow[2]-(0 if state["case"]=="arrow-zero" else 18 if state["case"] in ["custom","final"] else 10))*scale<=1 and abs(arrow[3]-10)*scale<=1,"Tooltip original arrow dimensions differ")
            expected=state["background"].lstrip("#");rgba=[int(expected[i:i+2],16) for i in [0,2,4]]+[255];require(row["backgroundRGBA"]==rgba,"Tooltip native background differs")
            if state["case"] in ["custom","final"]:require(row["borderRGBA"]==[[17,119,51,255]]*(3 if state["case"]=="custom" else 1),"Tooltip native border width/color differs")
            if state["case"]=="arrow-zero":require(not row["arrow"] or row["arrow"][2]==0,"Tooltip authored zero arrow differs")
            else:
                border=3 if state["case"]=="custom" else 1 if state["case"]=="final" else 0
                require(abs((arrow[1] if placement=="top" else arrow[1]+arrow[3])-(root[1]+root[3]-border if placement=="top" else root[1]+border))*scale<=1,"Tooltip arrow is not at the surface padding edge")
                expected_arrow_rgba=[47,125,24,255] if state["case"] in ["custom","final"] else rgba
                require(row["canvasRGBA"]==[128,128,128,255] and row["canvasRGBA"]!=expected_arrow_rgba,"Tooltip independent canvas contrast differs")
                samples=row["arrowSamples"];offsets=[(2.5,1),(5,1),(7.5,1),(5,3.5),(.5,3.5),(9.5,3.5),(5,7.5)];require(len(samples)==len(offsets),"Tooltip triangle samples missing")
                for index,(sample,(x,y)) in enumerate(zip(samples,offsets)):
                    require(len(sample["point"])==2 and all(abs(a-b)*scale<=1 for a,b in zip(sample["point"],[arrow[0]+x,arrow[1]+(y if placement=="top" else 10-y)])),"Tooltip triangle sample point differs")
                    require(len(sample["rgba"])==4 and all(isinstance(v,int) and 0<=v<=255 for v in sample["rgba"]),"Tooltip triangle sample color invalid")
                    require((sample["rgba"]==expected_arrow_rgba)==(index<4),"Tooltip opaque triangle or exterior negative differs")
                require(row["arrowRGBA"]==samples[1]["rgba"]==expected_arrow_rgba,"Tooltip independent arrow fill differs")
            if state["narrow"]:require(row["body"][3]>34 and "étroite" in row["nativeBodyLabel"],"Tooltip constrained content truncated")
    return {"status":"PASS","observations":len(rows)}


def reconcile_tooltip_ios(raw,config):
    early=[json.loads(x) for x in re.findall(r"NATIVE_LOADED_OBSERVER_EARLY (\{[^\n]+\})",raw)];require(len(early)==(3 if config["batch"]=="tooltip" else 1) and all(x["sha256"]==x["expectedSHA256"]==early[0]["sha256"] and len(x["sha256"])==64 for x in early),"Tooltip early loaded executable proof missing")
    batch=config["batch"];rows=[json.loads(x) for x in re.findall(r"TOOLTIP_NATIVE_OBSERVATION (\{[^\n]+\})",raw)];ownership=["closed","cold-open","vetoed-close","echoed-close","delayed-close","retired","fresh-open"];motion_names=["normal-fresh","reduced-fresh"];names=ownership+TOOLTIP_STYLES+motion_names if batch=="tooltip" else ownership if batch=="tooltip-ownership" else TOOLTIP_STYLES if batch=="tooltip-styles" else motion_names;result=validate_tooltip_rows(rows,names);named={x["name"]:x for x in rows}
    if batch in ["tooltip","tooltip-ownership"]:
        cold=named["cold-open"]["state"];require(cold["requests"][0]["value"] is True and cold["requests"][0]["epochMs"]-cold["commands"][0]["epochMs"]>=1500,"Tooltip actual cold delay missing")
        veto=named["vetoed-close"]["state"];require(veto["actions"]==1 and veto["open"] and veto["rootTag"]==cold["rootTag"] and veto["requests"][-1]["value"] is False,"Tooltip original action/owner veto differs")
        require(named["echoed-close"]["state"]["actions"]==2,"Tooltip repeated original action differs")
        delayed=named["delayed-close"]["state"];require(delayed["requests"][-1]["value"] is False and delayed["requests"][-1]["epochMs"]-delayed["commands"][-1]["epochMs"]>=500,"Tooltip actual close delay missing")
        fresh=named["fresh-open"]["state"];require(fresh["anchorTag"]!=cold["anchorTag"] and fresh["rootTag"]!=cold["rootTag"] and len(fresh["events"])==2 and all(x["target"]>0 and x["currentTarget"]>0 for x in fresh["events"]),"Tooltip native lifetime/original events differ")
        for name in ["closed","cold-open","vetoed-close","echoed-close","delayed-close","fresh-open"]:
            state=named[name]["state"];native=state["inspection"];require(native["target"]==state["anchorTag"] and native["ownerId"] and native["windowId"] and native["platform"]=="ios" and native["descriptionAvailable"] is state["open"],"Tooltip actual original description lifetime differs")
    if batch in ["tooltip","tooltip-styles"]:require(named["dark"]["state"]["palette"]=="dark" and named["light-restored"]["state"]["palette"]=="light","Tooltip provider restoration differs")
    if batch in ["tooltip","tooltip-motion"]:
        intervals=[json.loads(x) for x in re.findall(r"TOOLTIP_NATIVE_MOTION (\{[^\n]+\})",raw)];require([x["name"] for x in intervals]==["normal","reduced"],"Tooltip normal/reduced motion missing")
        for interval in intervals:
            state=interval["state"];trace=state["commands"];require([x["name"] for x in trace]==["retarget-"+str(i) for i in range(40)]+["settle","entry-acknowledged","retire","fresh"] and state["motionEvents"][-1] is interval["reduced"],"Tooltip native retarget/reduction trace differs")
            samples=interval["samples"];moving=[x for x in samples if x["captureStartedEpochMs"]>=trace[0]["epochMs"] and x["captureEpochMs"]<trace[-2]["epochMs"]];require(len(moving)>1 and any(x["glyphRGBA"]==x["backgroundRGBA"]==[255,255,255,255] for x in samples),"Tooltip native motion/retirement frames missing")
            settled=next(x for x in trace if x["name"]=="settle");ack=next(x for x in trace if x["name"]=="entry-acknowledged");layout=ack["rootLayout"];root=interval["rootTagBefore"];frame=interval["rootFrameBefore"]
            require(root>0 and layout["target"]==layout["currentTarget"]==root and len(frame)==4 and all(math.isfinite(x) for x in frame),"Tooltip entry native root differs")
            require(all(abs(layout[key]-frame[i+2])*samples[0]["scale"]<=1 for i,key in enumerate(["width","height"])),"Tooltip entry native layout differs")
            require(settled["epochMs"]<=ack["epochMs"]<trace[-2]["epochMs"] and ack["rendered"]["isEntering"] is True and ack["rendered"]["placement"]==interval["placementBefore"] and interval["placementBefore"] in ["top","bottom"],"Tooltip entry acknowledgement missing/wrong phase")
            retargeting=[x for x in moving if x["captureEpochMs"]<settled["epochMs"]];entry=[x for x in moving if x["captureEpochMs"]>=ack["epochMs"]]
            require(len(retargeting)>1 and entry,"Tooltip separate retarget/entry observations missing")
            if interval["reduced"]:require(all(x["glyphRGBA"] in [[187,51,34,255],[17,119,51,255]] and x["backgroundRGBA"]==[34,68,102,255] for x in moving),"Tooltip real reduced endpoints differ")
            else:
                require(any(len(x["glyphRGBA"])==4 and 17<x["glyphRGBA"][0]<187 and 51<x["glyphRGBA"][1]<119 and 34<x["glyphRGBA"][2]<51 for x in retargeting),"Tooltip native foreground interpolation missing")
                require(any(len(x["backgroundRGBA"])==4 and 34<x["backgroundRGBA"][0]<255 and 68<x["backgroundRGBA"][1]<255 and 102<x["backgroundRGBA"][2]<255 for x in entry),"Tooltip native entry opacity interpolation missing")
        original=re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])",raw);require(len(original)==1 and original==re.findall(r"METER_STYLE_MOTION_RESTORED ([01])",raw),"Tooltip original Reduce Motion not restored")
        result["motionFrames"]=sum(len(x["samples"]) for x in intervals)
    return result


LINK_BEHAVIOR=["baseline","echo","disabled","held-disabled","restored","empty","fragment","relative","small-hit-target","replaced","retired","fresh","alias-relationships","attribute-relationships","changed-targets","removed-targets","empty-relationships","error","handoff"]
LINK_ACTIONS=["baseline-first","baseline-repeated","small-hit-target-activated"]+[name+"-activated" for name in ["echo","disabled","held-disabled","restored","empty","fragment","relative","error","handoff"]]
LINK_STYLES=["style-baseline","primary","visited","visited-override","provider-visited","root-custom","final-style","explicit-child","underline","line-through","fractional","percentage","auto","small-target","zero","long-narrow","dark","light-restored"]
def link_label(state):
    if not state["related"] or not state["targetsVisible"] or state["case"]=="empty-relationships":return "Read settings"
    return " ".join(reversed(state["targetText"]) if state["case"]=="attribute-relationships" else state["targetText"])


def validate_link_rows(rows,names):
    require(sorted(row["name"] for row in rows)==sorted(names),"Missing/duplicate Link observations")
    for row in rows:
        state,scale=row["state"],row["scale"];parent,reference,matched=row["parent"],row["referenceParent"],row["matchedReferenceParent"]
        require(isinstance(scale,(int,float)) and math.isfinite(scale) and scale>0 and scale==state["scale"],"Wrong Link scale")
        require(all(len(frame)==4 and all(math.isfinite(v) for v in frame) for frame in [parent,reference,matched]) and parent[2:]==reference[2:] and 0<parent[2]<=280 and parent[3]==224,"Wrong Link parents")
        for frame in [parent,reference,matched]:
            x,y,width,height=[math.floor(v*scale+.5) for v in frame];require(0<=x<x+width<=row["imageWidth"] and 0<=y<y+height<=row["imageHeight"],"Link parent outside physical screenshot")
        require([math.floor(v*scale+.5) for v in matched]==[math.floor(v*scale+.5) for v in parent] and row["referenceExact"] is True,"Link exact same-origin reference mismatch")
        if not state["visible"]:
            require(not row["root"] and row["inkPixels"]==0 and state["rootTag"] is None,"Retired Link ref/paint remains");continue
        event=state["layouts"][-1];layout=event["layout"];require(state["rootTag"] and event["target"]==event["currentTarget"]==state["rootTag"],"Original Link layout/ref differs")
        if state["zero"]:
            require(layout["width"]==layout["height"]==0 and row["inkPixels"]==0,"Authored Link zero/clipping differs");continue
        require(row["targetCount"]==1 and row["nativeLink"] is True and row["nativeLabel"]==link_label(state) and row["nativeValue"]=="Link value" and row["nativeEnabled"] is (not state["disabled"]),"Link native trait/name/value/guard/target differs")
        root,raw=row["root"],row["referenceRoot"];require(len(root)==len(raw)==4 and all(math.isfinite(v) for v in root+raw) and all(abs(a-b)*scale<=1 for a,b in zip([root[0]-parent[0],root[1]-parent[1],*root[2:]],[raw[0]-reference[0],raw[1]-reference[1],*raw[2:]])),"Link actual/reference frames differ")
        require(all(abs(root[i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"Link original native/layout dimensions differ")
        if isinstance(state["width"],(int,float)):require(abs(root[2]-state["width"])*scale<=1,"Link authored width differs")
        if state["height"] is not None:require(abs(root[3]-state["height"])*scale<=1,"Link authored height differs")
        if state["narrow"]:require(root[3]>44 and root[1]+root[3]<=parent[1]+parent[3]-12+1/scale,"Link long content clipped")
        for held in row.get("heldContactIntervals",[]):require(held["beganEpochMs"]<=held["disabledOnPressInEpochMs"]<held["endedEpochMs"]-400,"Link not canceled during held contact")
        if state["related"]:
            native=state["inspection"];related=state["targetsVisible"] and state["case"]!="empty-relationships"
            require(native["target"]==state["rootTag"] and native["ownerId"] and native["windowId"] and native["platform"]=="ios" and native["case"]==state["case"] and native["observedAt"]>0,"Link actual current native inspection missing")
            require(native["label"]==link_label(state) and native["hint"]=="Open the destination" and native["value"]=="Link value","Link native inspection fields differ")
            require(native["descriptionAvailable"] is related and native["detailsAvailable"] is related and native["description"]==("Guide" if related else "") and native["details"]==("Detail" if related else ""),"Link actual relationship fallback/order differs")
    return {"status":"PASS","observations":len(rows)}


def reconcile_link_ios(raw,config=None):
    config=config or {}
    if config.get("batch") in ["link-static","link-actions"]:
        proof=json.loads(bound_file(config["retainedLinkMotion"]).read_text());require(proof["status"]=="PASS","Retained Link motion review failed")
        require(json.loads(bound_file(proof["cleanup"]).read_text())["cleanupVerified"],"Retained Link motion cleanup unverified")
        loaded=json.loads(bound_file(proof["loadedObserver"]).read_text());require(loaded["status"]=="PASS" and loaded["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained Link actually loaded observer differs")
        method=proof["nativeMethod"];require(method["method"]=="testLinkMotionAndRetirement" and method["appManifestSHA256"]==proof["appManifestSHA256"] and method["observerManifestSHA256"]==proof["observerManifestSHA256"],"Wrong retained Link method/tuple");native_method(method)
        prior=bound_file(proof["log"]).read_text();lines=[]
        for line in prior.splitlines():
            if line.startswith(("LINK_NATIVE_MOTION ","LINK_NATIVE_MOTION_FRAME ","LINK_NATIVE_MOTION_REFERENCE ","METER_STYLE_MOTION_")):lines.append(line)
            elif line.startswith("LINK_NATIVE_OBSERVATION ") and json.loads(line.split(" ",1)[1])["name"] in ["normal-fresh","reduced-fresh"]:lines.append(line)
        raw+="\n"+"\n".join(lines)
    if config.get("batch")=="link-actions":
        proof=json.loads(bound_file(config["retainedLinkStyles"]).read_text());require(proof["status"]=="PASS","Retained Link style review failed")
        require(json.loads(bound_file(proof["cleanup"]).read_text())["cleanupVerified"],"Retained Link style cleanup unverified")
        loaded=json.loads(bound_file(proof["loadedObserver"]).read_text());require(loaded["status"]=="PASS" and loaded["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained Link style actually loaded observer differs")
        method=proof["nativeMethod"];require(method["method"]=="testLinkStylesAndConstraints" and method["appManifestSHA256"]==proof["appManifestSHA256"] and method["observerManifestSHA256"]==proof["observerManifestSHA256"],"Wrong retained Link style method/tuple");native_method(method)
        raw+="\n"+"\n".join(line for line in bound_file(proof["log"]).read_text().splitlines() if line.startswith("LINK_NATIVE_OBSERVATION ") and json.loads(line.split(" ",1)[1])["state"]["mode"]=="styles")
    rows=[json.loads(x) for x in re.findall(r"LINK_NATIVE_OBSERVATION (\{[^\n]+\})",raw)];result=validate_link_rows(rows,LINK_BEHAVIOR+LINK_ACTIONS+LINK_STYLES+["normal-fresh","reduced-fresh"]);named={row["name"]:row for row in rows};original=named["baseline"]["state"]["rootTag"]
    for name in ["echo","disabled","held-disabled","restored","empty","fragment","relative"]:require(named[name]["state"]["rootTag"]==original,"Link original root lost")
    for name in ["replaced","fresh"]:require(named[name]["state"]["rootTag"]!=original,"Link replacement ref reused")
    for name,count in [("baseline-first",1),("baseline-repeated",2),("small-hit-target-activated",8),("echo-activated",3),("disabled-activated",3),("held-disabled-activated",3),("restored-activated",4),("empty-activated",5),("fragment-activated",6),("relative-activated",7),("error-activated",9),("handoff-activated",10)]:require(len(named[name]["state"]["requests"])==count,"Link exact request/guard differs: "+name)
    require(not named["baseline-repeated"]["state"]["visited"] and named["echo-activated"]["state"]["visited"],"Link caller-owned visited differs")
    require(named["held-disabled-activated"]["state"]["canceled"] and len(named["held-disabled-activated"]["heldContactIntervals"])==1,"Link held cancellation missing")
    requests=named["handoff-activated"]["state"]["requests"];require(len(requests)==10,"Link callback count differs")
    for request in requests:
        case=request["case"];uri={"empty":"","fragment":"#section","relative":"/relative","handoff":"https://example.com/codon-native?value=0&empty="}.get(case,"codon-lab-unhandled://destination?value=0&empty=")
        require(request["href"]==uri and request["target"]>0 and request["currentTarget"]>0 and request["before"] is False and request["after"] is (case not in ["error","handoff"]),"Link unchanged original URL/event/veto differs")
    failed=named["error-activated"]["state"];require(failed["href"]=="#changed-after-request" and len(failed["errors"])==1 and failed["errors"][0]["href"]=="codon-lab-unhandled://destination?value=0&empty=" and failed["errors"][0]["error"],"Link error original destination/lifetime differs")
    handoff=[json.loads(x) for x in re.findall(r"LINK_NATIVE_HANDOFF (\{[^\n]+\})",raw)];require(len(handoff)==1 and handoff[0]["foregroundBundle"]=="com.apple.mobilesafari" and handoff[0]["address"] in ["https://example.com/codon-native?value=0&empty=","example.com/codon-native?value=0&empty="],"Actual exact native URL handoff missing")
    intervals=[json.loads(x) for x in re.findall(r"LINK_NATIVE_MOTION (\{[^\n]+\})",raw)];require(len(intervals)==2 and {x["name"] for x in intervals}=={"normal","reduced"},"Link actual motion intervals missing")
    references=[json.loads(x) for x in re.findall(r"LINK_NATIVE_MOTION_REFERENCE (\{[^\n]+\})",raw)];controls={x["name"]:x for x in references};require(len(controls)==len(references)==4 and set(controls)=={mode+"-reference-"+str(i) for mode in ["normal","reduced"] for i in [0,1]},"Link exact endpoint controls missing")
    for interval in intervals:
        trace=interval["state"]["motionTrace"];require([x["name"] for x in trace]==["retarget-"+str(i) for i in range(40)]+["settle","retire","fresh"],"Link125ms retarget/lifetime trace differs")
        require(interval["state"]["motionEvents"][-1] is interval["reduced"],"Link real motion setting differs")
        samples=interval["samples"];moving=[x for x in samples if x["captureStartedEpochMs"]>=trace[0]["epochMs"] and x["captureEpochMs"]<trace[-2]["epochMs"]];require(len(moving)>1 and any(x["inkPixels"]==0 for x in samples),"Link actual motion/removal samples missing")
        for sample in samples:
            counts=sample["referenceGlyphCounts"];require(len(counts)==3 and counts[2]==0 and ((counts[0]>0 and counts[1]==0) or (counts[1]>0 and counts[0]==0) or counts==[0,0,0] and sample["inkPixels"]==0),"Link unknown actual raw glyph endpoint")
            require(sample["calibratedReferenceName"] in controls and [math.floor(v*sample["scale"]+.5) for v in sample["parent"]]==[math.floor(v*sample["scale"]+.5) for v in sample["calibratedReferenceParent"]],"Link changed physical endpoint origin")
        require(all(x["calibratedReferenceExact"] for x in moving) if interval["reduced"] else any(x["glyphCounts"][2]>0 for x in moving),"Link real color motion/reduction differs")
    original_motion=re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])",raw);restored=re.findall(r"METER_STYLE_MOTION_RESTORED ([01])",raw);require(len(original_motion)==1 and original_motion==restored,"Link Reduce Motion restoration unverified")
    require(named["dark"]["state"]["themeMode"]=="dark" and named["light-restored"]["state"]["themeMode"]=="light","Link provider restoration differs")
    return dict(result,nativeActivations=10,motionFrames=sum(len(x["samples"]) for x in intervals))


def button_press_prefix(phases):
    return phases[:6] in [["start","change:true","up","end","change:false","press"],["start","change:true","up","press","end","change:false"]]


BUTTON_BEHAVIOR=["baseline","repeated","disabled","held-disabled","restored","pending","held-pending","pending-restored","renderer","replaced","retired","fresh","focus-excluded","long-press"]
BUTTON_ACTIONS=[name+"-activated" for name in ["baseline","repeated","disabled","held-disabled","restored","pending","held-pending","pending-restored","renderer","long-press"]]
BUTTON_STYLES=["style-baseline","flat","outline","primary","secondary","transparent","root-custom","final-style","foreground","explicit-child","square","round","long-narrow","fractional","percentage","auto","small-target","zero","dark","light-restored"]
def validate_button_rows(rows,names):
    require(sorted(row["name"] for row in rows)==sorted(names),"Missing/duplicate Button observations")
    for row in rows:
        state,scale=row["state"],row["scale"]
        require(isinstance(scale,(int,float)) and math.isfinite(scale) and scale>0 and scale==state["scale"],"Wrong Button scale")
        parent,reference=row["parent"],row["referenceParent"]
        require(len(parent)==len(reference)==4 and all(math.isfinite(v) for v in parent+reference) and parent[2:]==reference[2:] and 0<parent[2]<=280 and parent[3]==224,"Wrong Button parents")
        for frame in [parent,reference]:
            x,y,width,height=[math.floor(v*scale+.5) for v in frame]
            require(0<=x<x+width<=row["imageWidth"] and 0<=y<y+height<=row["imageHeight"],"Button parent outside physical screenshot")
        if state.get("hasShadow",state.get("raised")):
            matched=row.get("matchedReferenceParent",[])
            require(len(matched)==4 and all(math.isfinite(v) for v in matched) and [math.floor(v*scale+.5) for v in matched]==[math.floor(v*scale+.5) for v in parent],"Raised Button reference moved physical origin")
        require(row["referenceExact"] is True,"Button native reference mismatch")
        if not state["visible"]:
            require(not row["root"] and row["inkPixels"]==0 and state["rootTag"] is None,"Retired Button ref/paint remains")
            continue
        event=state["layouts"][-1];layout=event["layout"]
        require(state["rootTag"] and event["target"]==event["currentTarget"]==state["rootTag"],"Original Button layout/ref differs")
        if state["zero"]:
            require(layout["width"]==layout["height"]==0 and row["inkPixels"]==0,"Authored Button zero/clipping differs")
            continue
        require(row["targetCount"]==1 and row["nativeLabel"]==state["label"] and row["nativeEnabled"] is (not state["disabled"]),"Button name/guard/target differs")
        require(row["nativeButton"] is True and row["nativeValue"]==("busy" if state["pending"] else None) or row["nativeButton"] is True and not state["pending"] and row["nativeValue"]=="", "Button original busy metadata differs")
        root,raw=row["root"],row["referenceRoot"]
        require(len(root)==len(raw)==4 and all(abs(a-b)*scale<=1 for a,b in zip([root[0]-parent[0],root[1]-parent[1],*root[2:]],[raw[0]-reference[0],raw[1]-reference[1],*raw[2:]])),"Button actual/reference frames differ")
        require(all(abs(root[i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"Button layout/native dimensions differ")
        if isinstance(state["width"],(int,float)):require(abs(root[2]-state["width"])*scale<=1,"Button authored width differs")
        require(abs(root[3]-24)*scale<=1 if state["small"] else root[3]>=44-1/scale,"Button explicit/default target height differs")
        if state["narrow"]:require(44<root[3] and root[1]+root[3]<=parent[1]+parent[3]-12+1/scale,"Constrained Button content clipped")
        for held in row.get("heldContactIntervals",[]):require(held["beganEpochMs"]<=held["disabledOnPressInEpochMs"]<held["endedEpochMs"]-400,"Button disable was not during held contact")
    return {"status":"PASS","observations":len(rows)}


def reconcile_button_ios(raw,config=None):
    config=config or {}
    if config.get("batch")=="button-motion":
        for key,method,names in [("retainedButtonActions","testButtonActionsAndLifetimes",BUTTON_BEHAVIOR+BUTTON_ACTIONS),("retainedButtonStyles","testButtonStylesAndConstraints",BUTTON_STYLES)]:
            proof=json.loads(bound_file(config[key]).read_text());require(proof["status"]=="PASS","Retained Button review did not pass")
            require(json.loads(bound_file(proof["cleanup"]).read_text())["cleanupVerified"],"Retained Button cleanup unverified")
            for source in proof["librarySources"]:bound_file(source)
            native_method(proof["nativeMethod"]);prior=bound_file(proof["raw"]).read_text();raw+="\n"+"\n".join(line for line in prior.splitlines() if line.startswith("BUTTON_NATIVE_OBSERVATION ") and json.loads(line.split(" ",1)[1])["name"] in names)

    rows=[json.loads(x) for x in re.findall(r"BUTTON_NATIVE_OBSERVATION (\{[^\n]+\})",raw)];result=validate_button_rows(rows,BUTTON_BEHAVIOR+BUTTON_ACTIONS+BUTTON_STYLES+["normal-fresh","reduced-fresh"]);named={row["name"]:row for row in rows};original=named["baseline"]["state"]["rootTag"]
    for name in ["repeated","disabled","held-disabled","restored","pending","held-pending","pending-restored","renderer"]:require(named[name]["state"]["rootTag"]==original,"Button original root/ref lost")
    for name in ["replaced","fresh"]:require(named[name]["state"]["rootTag"]!=original,"Button replacement ref reused")
    for name,count in [("baseline",1),("repeated",2),("disabled",2),("held-disabled",2),("restored",3),("pending",3),("held-pending",3),("pending-restored",4),("renderer",5),("long-press",5)]:require(named[name+"-activated"]["state"]["actions"]==count,"Button one activation or guard differs: "+name)
    final=named["long-press-activated"]["state"];phases=final["phases"];require(button_press_prefix(phases),"Original Button semantic callback order differs")
    require(phases.count("start")==phases.count("end") and phases.count("change:true")==phases.count("change:false"),"Button press callbacks unbalanced")
    events=final["events"];presses=[row for row in events if row["phase"]=="press"];require(len(presses)==5 and all(row["currentTarget"]==original and row["target"]>0 for row in presses),"Original Button event/ref differs")
    require(sum(row["phase"]=="long" for row in events)==1,"Configured Button long press missing or duplicated")
    motion=[json.loads(x) for x in re.findall(r"BUTTON_NATIVE_MOTION (\{[^\n]+\})",raw)];require(len(motion)==2 and {m["name"] for m in motion}=={"normal","reduced"},"Button motion intervals missing")
    references=[json.loads(x) for x in re.findall(r"BUTTON_NATIVE_MOTION_REFERENCE (\{[^\n]+\})",raw)];require(len(references)==4 and {x["name"] for x in references}=={mode+"-reference-"+str(index) for mode in ["normal","reduced"] for index in [0,1]},"Button same-origin reference captures missing")
    controls={x["name"]:x for x in references}
    for interval in motion:
        trace=interval["state"]["motionTrace"];require([row["name"] for row in trace]==["retarget-"+str(i) for i in range(20)]+["settle","retire","fresh"],"Button retarget/lifetime trace differs")
        samples=interval["samples"]
        for sample in samples:
            require(sample["calibratedReferenceName"] in controls and (sample["referenceSampleRGBA"] in [[17,119,51,255],[187,51,34,255]] or sample["referenceSampleRGBA"]==[255,255,255,255] and sample["inkPixels"]==0),"Button unknown calibration target")
            require([math.floor(v*sample["scale"]+.5) for v in sample["parent"]]==[math.floor(v*sample["scale"]+.5) for v in sample["calibratedReferenceParent"]],"Button motion calibration origin differs")
        retired=trace[-2]["epochMs"];moving=[row for row in samples if row["captureStartedEpochMs"]>=trace[0]["epochMs"] and row["captureEpochMs"]<retired];require(len(moving)>1 and any(row["inkPixels"]==0 for row in samples),"Button complete motion/retirement capture missing")
        if interval["reduced"]:require(all(row["calibratedReferenceExact"] for row in moving),"Reduced Button interpolates")
        else:
            require(any(len(row["sampleRGBA"])==4 and 17<row["sampleRGBA"][0]<187 and 51<row["sampleRGBA"][1]<119 and 34<row["sampleRGBA"][2]<51 and row["sampleRGBA"][3]==255 for row in moving),"Button color interpolation missing")
            require(any(len(row["shadowRGBA"])==4 and 153<row["shadowRGBA"][0]<255 and row["shadowRGBA"][0]==row["shadowRGBA"][1]==row["shadowRGBA"][2] and row["shadowRGBA"][3]==255 for row in moving),"Button450ms shadow interpolation missing")
    original_motion=re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])",raw);restored=re.findall(r"METER_STYLE_MOTION_RESTORED ([01])",raw);require(len(original_motion)==1 and original_motion==restored,"Button Reduce Motion restoration unverified")
    result.update(motionIntervals=2,motionFrames=sum(len(row["samples"]) for row in motion),originalMotionValue=original_motion[0]);return result

RADIO_GROUP_BEHAVIOR=["baseline","echo","reselected","disabled","readonly","renderer","nested","replacement","retired","fresh","local","default-changed","empty-value","veto-1","veto-2","echo-beta","echo-alpha","reselected-alpha","nested-other","local-alpha","empty-selected","empty-reselected"]
RADIO_GROUP_STYLES=["style-baseline","horizontal","wrap","custom","final-style","registered","fractional","percentage","long-narrow","zero","dark","light-restored"]

def reconcile_radio_group_ios(raw):
    rows=[json.loads(x) for x in re.findall(r"RADIO_GROUP_NATIVE_OBSERVATION (\{[^\n]+\})",raw)]
    require(sorted(row["name"] for row in rows)==sorted(RADIO_GROUP_BEHAVIOR+RADIO_GROUP_STYLES),"Missing/duplicate RadioGroup native observations")
    named={row["name"]:row for row in rows}
    for row in rows:
        state,scale=row["state"],row["scale"]
        require(row["nativeRootLabel"]=="Notification options" if state["visible"] and not state["zero"] else True,"RadioGroup original native label differs")
        require(state["value"] is None or isinstance(state["value"],str),"RadioGroup string/null ownership differs")
        require(scale==state["scale"] and math.isfinite(scale) and scale>0,"Wrong RadioGroup scale")
        require(row["referenceExact"] is True,"RadioGroup native raw reference mismatch")
        parent,reference=row["parent"],row["referenceParent"]
        require(len(parent)==len(reference)==4 and parent[2:]==reference[2:] and 0<parent[2]<=280 and parent[3]==224,"RadioGroup parent dimensions differ")
        for frame in [parent,reference]:
            require(all(math.isfinite(v) for v in frame),"Nonfinite group parent")
            x,y,width,height=[math.floor(v*scale+.5) for v in frame]
            require(0<=x<x+width<=row["imageWidth"] and 0<=y<y+height<=row["imageHeight"],"RadioGroup parent outside screenshot")
        if not state["visible"]:
            require(not row["root"] and not row["members"] and state["rootTag"] is None and row["inkPixels"]==0,"Retired group/ref/paint remains")
            continue
        tag=state["rootTag"];event=state["layouts"][-1];layout=event["layout"]
        require(tag and tag==event["target"]==event["currentTarget"],"Original group layout/ref target differs")
        if state["zero"]:
            require(layout["width"]==layout["height"]==row["inkPixels"]==0,"Zero group retained paint/dimensions")
            for frame in [row["root"],row["referenceRoot"]]:
                require(not frame or (len(frame)==4 and all(math.isfinite(v) for v in frame) and frame[2:]==[0,0]),"Zero AX root retained dimensions")
            continue
        root,reference_root=row["root"],row["referenceRoot"]
        require(len(root)==len(reference_root)==4 and all(math.isfinite(v) for v in root+reference_root),"Group native frames differ")
        first=[root[0]-parent[0],root[1]-parent[1],*root[2:]];second=[reference_root[0]-reference[0],reference_root[1]-reference[1],*reference_root[2:]]
        require([math.floor(v*scale+.5) for v in first]==[math.floor(v*scale+.5) for v in second],"Group native reference geometry differs")
        require(all(abs(root[i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"Group native/onLayout dimensions differ")
        if isinstance(state["width"],(int,float)):require(abs(root[2]-state["width"])*scale<=1,"Authored group width differs")
        ids=["alpha","nested","other"] if state["nested"] else ["alpha","beta"]
        require(sorted(x["id"] for x in row["members"])==sorted(ids),"Group independent member targets missing/duplicated")
        for member in row["members"]:
            id=member["id"];selected=state["nestedValue"]==state["values"][id] if id in ["nested","other"] else state["value"] is not None and state["value"]==state["values"][id]
            require(member["label"]==state["labels"][id] and member["enabled"] is (not state["disabled"] or id in ["nested","other"]),"Group member label/guard differs")
            require(member["value"]=="radio button, "+("checked" if selected else "unchecked"),"Group member native checked value differs")
            actual,expected=member["relativeFrame"],member["referenceRelativeFrame"]
            require(len(actual)==len(expected)==4 and all(math.isfinite(v) for v in actual+expected) and actual[2]>0 and actual[3]>=44-1/scale,"Invalid member frame/target")
            require([math.floor(v*scale+.5) for v in actual]==[math.floor(v*scale+.5) for v in expected],"Member reference frame differs")
        if state["narrow"]:require(row["members"][0]["relativeFrame"][3]>44 and root[1]+root[3]<=parent[1]+parent[3]-12+1/scale,"Group constrained text clipped")
    original=named["baseline"]["state"]["rootTag"]
    for name in ["echo","reselected","disabled","readonly","renderer","nested"]:require(named[name]["state"]["rootTag"]==original,"Original RadioGroup root replaced")
    for name in ["replacement","fresh"]:require(named[name]["state"]["rootTag"]!=original,"RadioGroup fresh ref reused")
    for name in ["veto-1","veto-2"]:require(named[name]["state"]["value"] is None,"RadioGroup veto ignored")
    require(named["echo-alpha"]["state"]["value"]=="alpha" and named["reselected-alpha"]["state"]["requests"]==["alpha","alpha","beta","alpha"],"RadioGroup echo/quiet reselection differs")
    require(named["nested-other"]["state"]["value"]=="alpha" and named["nested-other"]["state"]["nestedValue"]=="other" and named["nested-other"]["state"]["requests"]==["alpha","alpha","beta","alpha"],"RadioGroup nested owner isolation differs")
    require(named["default-changed"]["state"]["value"]=="alpha","RadioGroup default read-once differs")
    final=named["empty-reselected"]["state"]
    require(final["value"]=="" and final["requests"]==["alpha","alpha","beta","alpha","alpha",""],"RadioGroup empty string/quiet reselection differs")
    phases=["group:root","press:alpha","group:root","press:alpha","group:root","press:beta","group:root","press:alpha","press:alpha","nested:other","press:other","group:root","press:alpha","group:root","press:alpha","press:alpha"]
    require(final["phases"]==phases,"RadioGroup original callback order differs")
    events=[x for x in final["events"] if x["phase"]=="press"];require(len(events)==9 and all(x["target"]>0 and x["currentTarget"]>0 for x in events),"RadioGroup native event fields missing")
    require(named["dark"]["state"]["themeMode"]=="dark" and named["light-restored"]["state"]["themeMode"]=="light","RadioGroup provider restoration missing")
    return {"status":"PASS","observations":len(rows),"nativeActivations":9,"motion":"Group owns no motion; unchanged Radio member250ms/native-retirement proof retained separately."}


RADIO_BEHAVIOR = ["baseline","echo","reselected","disabled","readonly","held-disabled","restored","renderer","replaced","retired","fresh","local","local-default-changed","empty-value","vetoed-1","vetoed-2","echo-activated","reselected-activated","restored-activated","local-activated","empty-value-activated","held-canceled"]
RADIO_STYLES = ["style-baseline","selected","root-custom","final-style","shape-custom","explicit-child","square","round","long-narrow","fractional","percentage","auto","small-target","zero","dark","light-restored"]

def validate_radio_rows(rows,names):
    require(sorted(row["name"] for row in rows)==sorted(names),"Missing/duplicate Radio observations")
    for row in rows:
        state,scale=row["state"],row["scale"]
        require(isinstance(scale,(int,float)) and math.isfinite(scale) and scale>0 and scale==state["scale"],"Wrong Radio scale")
        parent,reference=row["parent"],row["referenceParent"]
        require(len(parent)==len(reference)==4 and all(math.isfinite(v) for v in parent+reference) and parent[2:]==reference[2:] and 0<parent[2]<=280 and parent[3]==224,"Wrong Radio parents")
        for frame in [parent,reference]:
            x,y,width,height=[math.floor(v*scale+.5) for v in frame]
            require(0<=x<x+width<=row["imageWidth"] and 0<=y<y+height<=row["imageHeight"],"Radio parent outside physical screenshot")
        require(row["referenceExact"] is True,"Radio native reference mismatch")
        if not state["visible"]:
            require(not row["root"] and row["inkPixels"]==0 and state["rootTag"] is None,"Retired Radio ref/paint remains")
            continue
        event=state["layouts"][-1];layout=event["layout"]
        require(state["rootTag"] and event["target"]==event["currentTarget"]==state["rootTag"],"Original Radio layout/ref differs")
        if state["zero"]:
            require(layout["width"]==layout["height"]==0 and row["inkPixels"]==0,"Authored Radio zero/clipping differs")
            continue
        require(row["targetCount"]==1 and row["nativeLabel"]==state["label"] and row["nativeEnabled"] is (not state["disabled"]),"Radio name/guard/target differs")
        require([s.strip() for s in row["nativeValue"].split(",")]==["radio button"]+["checked" if state["selected"] else "unchecked"],"Radio owned Button/radio/check native value differs")
        root,raw=row["root"],row["referenceRoot"]
        require(len(root)==len(raw)==4 and all(abs(a-b)*scale<=1 for a,b in zip([root[0]-parent[0],root[1]-parent[1],*root[2:]],[raw[0]-reference[0],raw[1]-reference[1],*raw[2:]])),"Radio actual/reference frames differ")
        require(all(abs(root[i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"Radio layout/native dimensions differ")
        if isinstance(state["width"],(int,float)):require(abs(root[2]-state["width"])*scale<=1,"Radio authored width differs")
        require(abs(root[3]-24)*scale<=1 if state["small"] else root[3]>=44-1/scale,"Radio explicit/default target height differs")
        if state["narrow"]:require(44<root[3] and root[1]+root[3]<=parent[1]+parent[3]-12+1/scale,"Constrained Radio content clipped")
        for held in row.get("heldContactIntervals",[]):require(held["beganEpochMs"]<=held["disabledOnPressInEpochMs"]<held["endedEpochMs"]-400,"Radio disable was not during held contact")
    return {"status":"PASS","observations":len(rows)}


def reconcile_radio_ios(raw,config=None):
    config=config or {}
    if config.get("batch")=="radio-motion":
        proof=json.loads(bound_file(config["retainedRadioStaticMethods"]).read_text());require(proof["status"]=="PASS","Retained Radio methods not reviewed")
        for source in proof["librarySources"]:bound_file(source)
        require(json.loads(bound_file(proof["cleanup"]).read_text())["cleanupVerified"],"Retained Radio cleanup unverified")
        loaded=json.loads(bound_file(proof["loadedObserver"]).read_text());require(loaded["status"]=="PASS" and loaded["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained Radio loaded observer differs")
        require({m["method"] for m in proof["nativeMethods"]}=={"testRadioActionsAndLifetimes","testRadioStylesAndConstraints"},"Only the two clean Radio methods may be reused")
        for method in proof["nativeMethods"]:
            require(method["appManifestSHA256"]==proof["appManifestSHA256"] and method["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained Radio method tuple differs");native_method(method)
        prior=bound_file(proof["raw"]).read_text();lines=[line for line in prior.splitlines() if line.startswith("RADIO_NATIVE_OBSERVATION ") and json.loads(line.split(" ",1)[1])["name"] in RADIO_BEHAVIOR+RADIO_STYLES]
        validate_radio_rows([json.loads(line.split(" ",1)[1]) for line in lines],RADIO_BEHAVIOR+RADIO_STYLES);raw+="\n"+"\n".join(lines)
    rows=[json.loads(x) for x in re.findall(r"RADIO_NATIVE_OBSERVATION (\{[^\n]+\})",raw)];result=validate_radio_rows(rows,RADIO_BEHAVIOR+RADIO_STYLES+["normal-fresh","reduced-fresh"]);named={row["name"]:row for row in rows};tag=named["baseline"]["state"]["rootTag"]
    for name in ["vetoed-1","vetoed-2"]:require(not named[name]["state"]["selected"],"Radio controlled veto mutated output")
    require(named["vetoed-2"]["state"]["requests"]==["a","a"] and named["echo-activated"]["state"]["selected"],"Radio repeat veto/echo differs")
    for name in ["echo","reselected","disabled","readonly","held-disabled","restored","renderer"]:require(named[name]["state"]["rootTag"]==tag,"Radio lost original renderer/ref")
    require(named["reselected-activated"]["state"]["requests"]==["a","a","a"] and named["reselected-activated"]["state"]["actions"]==4,"Radio reselection fabricated group change")
    require(named["held-canceled"]["state"]["canceled"] and len(named["held-canceled"]["heldContactIntervals"])==1 and named["held-canceled"]["state"]["actions"]==4,"Radio held cancellation differs")
    require(named["local-default-changed"]["state"]["selected"],"Radio local default was reread")
    final=named["empty-value-activated"]["state"]
    require(final["selected"] and final["selectedValue"]=="" and final["actions"]==7 and final["requests"]==["a","a","a",""] and final["phases"]==["change","press","change","press","change","press","press","press","press","change","press"],"Radio empty value/group request/order differs")
    require(named["fresh"]["state"]["rootTag"]!=tag,"Radio fresh root reused retired ref")
    motion=[json.loads(x) for x in re.findall(r"RADIO_NATIVE_MOTION (\{[^\n]+\})",raw)];require(len(motion)==2 and {m["name"] for m in motion}=={"normal","reduced"},"Radio motion intervals missing")
    for interval in motion:
        trace=interval["state"]["motionTrace"];require([x["name"] for x in trace]==["select","interrupt","retarget"]+["retarget-"+str(i) for i in range(3,32)]+["settle","retire","fresh"],"Radio motion schedule differs")
        retired=next(x for x in trace if x["name"]=="retire")
        samples=interval["samples"];moving=[row for row in samples if row["captureStartedEpochMs"]>=trace[0]["epochMs"] and row["captureEpochMs"]<retired["epochMs"]];require(len(moving)>1 and any(row["inkPixels"]==0 for row in samples),"Radio motion/retirement samples missing")
        if interval["reduced"]:require(all(row["referenceExact"] for row in moving),"Reduced Radio interpolates")
        else:require(any(len(row["sampleRGBA"])==4 and 17<row["sampleRGBA"][0]<187 and 51<row["sampleRGBA"][1]<119 and 34<row["sampleRGBA"][2]<51 and row["sampleRGBA"][3]==255 for row in moving),"Actual Radio interpolation missing")
    original=re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])",raw);restored=re.findall(r"METER_STYLE_MOTION_RESTORED ([01])",raw);require(len(original)==1 and original==restored,"Radio original Reduce Motion restoration unverified")
    result.update(motionIntervals=2,motionFrames=sum(len(m["samples"]) for m in motion),originalMotionValue=original[0]);return result


LIST_ITEM_BEHAVIOR = ["baseline","echo","string-zero","empty-key","programmatic-off","disabled","readonly","held-disabled","restored","child-callback","renderer","replaced","retired","fresh","vetoed","echo-selected","held-canceled"]
LIST_ITEM_STYLES = ["style-baseline","selected","small-text","large-text","root-custom","final-style","foreground","explicit-child","square","long-narrow","fractional","percentage","auto","small-target","zero","dark","light-restored"]


def validate_list_item_rows(rows,names):
    require(sorted(row["name"] for row in rows)==sorted(names),"Missing/duplicate ListBoxItem observations")
    for row in rows:
        state,scale=row["state"],row["scale"]
        require(isinstance(scale,(int,float)) and math.isfinite(scale) and scale>0 and scale==state["scale"],"Wrong ListBoxItem scale")
        parent,reference=row["parent"],row["referenceParent"]
        require(len(parent)==len(reference)==4 and all(math.isfinite(v) for v in parent+reference) and parent[2:]==reference[2:] and 0<parent[2]<=280 and parent[3]==224,"Wrong ListBoxItem parents")
        for frame in [parent,reference]:
            x,y,width,height=[math.floor(v*scale+.5) for v in frame]
            require(0<=x<x+width<=row["imageWidth"] and 0<=y<y+height<=row["imageHeight"],"ListBoxItem parent outside physical screenshot")
        require(row["referenceExact"] is True,"ListBoxItem native reference mismatch")
        if not state["visible"]:
            require(not row["root"] and row["inkPixels"]==0 and state["rootTag"] is None,"Retired ListBoxItem ref/paint remains")
            continue
        event=state["layouts"][-1];layout=event["layout"]
        require(state["rootTag"] and event["target"]==event["currentTarget"]==state["rootTag"],"Original ListBoxItem layout/ref differs")
        if state["zero"]:
            require(layout["width"]==layout["height"]==0 and row["inkPixels"]==0,"Authored ListBoxItem zero/clipping differs")
            continue
        require(row["targetCount"]==1 and row["nativeLabel"]==state["textValue"] and row["nativeEnabled"] is (not state["disabled"]),"ListBoxItem name/guard/target differs")
        require([s.strip() for s in row["nativeValue"].split(",")]==["radio button","checked" if state["selected"] else "unchecked"],"ListBoxItem current radio/check native value differs")
        root,raw=row["root"],row["referenceRoot"]
        require(len(root)==len(raw)==4 and all(abs(a-b)*scale<=1 for a,b in zip([root[0]-parent[0],root[1]-parent[1],*root[2:]],[raw[0]-reference[0],raw[1]-reference[1],*raw[2:]])),"ListBoxItem actual/reference frames differ")
        require(all(abs(root[i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"ListBoxItem layout/native dimensions differ")
        if isinstance(state["width"],(int,float)):require(abs(root[2]-state["width"])*scale<=1,"ListBoxItem authored width differs")
        require(abs(root[3]-24)*scale<=1 if state["small"] else root[3]>=44-1/scale,"ListBoxItem explicit/default target height differs")
        if state["narrow"]:require(44<root[3] and root[1]+root[3]<=parent[1]+parent[3]-12+1/scale,"Constrained ListBoxItem content clipped")
        for held in row.get("heldContactIntervals",[]):require(held["beganEpochMs"]<=held["disabledOnPressInEpochMs"]<held["endedEpochMs"]-400,"ListBoxItem disable was not during held contact")
    return {"status":"PASS","observations":len(rows)}


def reconcile_list_item_ios(raw,config=None,app=None):
    config=config or {};retained_rows=[]
    if config.get("batch")=="list-box-item-motion":
        proof=json.loads(bound_file(config["retainedListItemMethods"]).read_text())
        require(proof["appManifestSHA256"]==app["manifestSHA256"],"Retained ListBoxItem app differs")
        for source in proof["librarySources"]:bound_file(source)
        loaded=json.loads(bound_file(proof["loadedObserver"]).read_text());require(loaded["status"]=="PASS" and loaded["observerManifestSHA256"]==proof["observerManifestSHA256"],"Retained ListBoxItem loaded observer differs")
        require(json.loads(bound_file(proof["cleanup"]).read_text())["cleanupVerified"],"Retained ListBoxItem cleanup unverified")
        require({m["method"] for m in proof["nativeMethods"]}=={"testListBoxItemActionsAndLifetimes","testListBoxItemStylesAndConstraints"},"Only clean ListBoxItem methods may be reused")
        for method in proof["nativeMethods"]:native_method(method)
        retained_raw=bound_file(proof["raw"]).read_text();retained_rows=[json.loads(x) for x in re.findall(r"LIST_ITEM_NATIVE_OBSERVATION (\{[^\n]+\})",retained_raw)];retained_rows=[row for row in retained_rows if row["name"] in LIST_ITEM_BEHAVIOR+LIST_ITEM_STYLES];validate_list_item_rows(retained_rows,LIST_ITEM_BEHAVIOR+LIST_ITEM_STYLES)
    rows=[json.loads(x) for x in re.findall(r"LIST_ITEM_NATIVE_OBSERVATION (\{[^\n]+\})",raw)]+retained_rows;result=validate_list_item_rows(rows,LIST_ITEM_BEHAVIOR+LIST_ITEM_STYLES+["normal-fresh","reduced-fresh"]);named={row["name"]:row for row in rows};tag=named["baseline"]["state"]["rootTag"]
    require(named["vetoed"]["state"]["actions"]==1 and not named["vetoed"]["state"]["selected"] and named["echo-selected"]["state"]["selected"],"ListBoxItem controlled veto/echo differs")
    for name in ["string-zero","empty-key","programmatic-off","disabled","readonly","held-disabled","restored","child-callback","renderer"]:require(named[name]["state"]["rootTag"]==tag,"ListBoxItem metadata/renderer replaced original ref")
    held=named["held-canceled"];require(held["state"]["canceled"] and held["state"]["actions"]==2 and len(held["heldContactIntervals"])==1,"ListBoxItem held cancellation missing")
    require(named["fresh"]["state"]["actions"]==3 and named["fresh"]["state"]["rootTag"]!=tag and named["string-zero"]["state"]["keyType"]=="string" and named["empty-key"]["state"]["id"]=="","ListBoxItem typed key/lifetime differs")
    motion=[json.loads(x) for x in re.findall(r"LIST_ITEM_NATIVE_MOTION (\{[^\n]+\})",raw)];require(len(motion)==2 and {m["name"] for m in motion}=={"normal","reduced"},"ListBoxItem motion intervals missing")
    for interval in motion:
        trace=interval["state"]["motionTrace"];require([x["name"] for x in trace]==["select","interrupt","retarget","retire","fresh"],"ListBoxItem real motion schedule differs")
        samples=interval["samples"];moving=[row for row in samples if row["captureStartedEpochMs"]>=trace[0]["epochMs"] and row["captureEpochMs"]<trace[3]["epochMs"]];require(len(moving)>1 and any(row["inkPixels"]==0 for row in samples),"ListBoxItem real motion/retired frames missing")
        if interval["reduced"]:require(all(row["referenceExact"] for row in moving),"Reduced ListBoxItem still interpolates")
        else:require(any(len(row["sampleRGBA"])==4 and 17<row["sampleRGBA"][0]<187 and 51<row["sampleRGBA"][1]<119 and 34<row["sampleRGBA"][2]<51 and row["sampleRGBA"][3]==255 for row in moving),"Real ListBoxItem background interpolation missing")
    original=re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])",raw);restored=re.findall(r"METER_STYLE_MOTION_RESTORED ([01])",raw);require(len(original)==1 and original==restored,"ListBoxItem Reduce Motion restoration unverified")
    result.update(motionIntervals=2,motionFrames=sum(len(m["samples"]) for m in motion),originalMotionValue=original[0]);return result


AVATAR_BEHAVIOR = ["baseline","sample","invalid","removed","first-name","last-name","anonymous","disabled","passive","missing-handler","held-cancel","restored","retired","fresh","delayed"]
AVATAR_STYLES = ["style-baseline","orthogonal","rounded","raised","root-style","fallback-style","text-style","image-style","final-precedence","fractional","percentage","auto","zero","dark","light-restored","narrow","name-enlarged"]


def validate_avatar_rows(rows, names):
    require(sorted(row["name"] for row in rows) == sorted(names), "Missing/duplicate Avatar observations")
    for row in rows:
        state,scale=row["state"],row["scale"]
        require(isinstance(scale,(int,float)) and math.isfinite(scale) and scale>0 and scale==state["scale"], "Wrong Avatar scale")
        parent,reference=row["parent"],row["referenceParent"]
        require(len(parent)==len(reference)==4 and all(math.isfinite(v) for v in parent+reference) and parent[2:]==reference[2:] and 0<parent[2]<=280 and parent[3]==128,"Wrong Avatar measurement parents")
        for frame in [parent,reference]:
            x,y,width,height=[math.floor(v*scale+.5) for v in frame]
            require(0<=x<x+width<=row["imageWidth"] and 0<=y<y+height<=row["imageHeight"],"Avatar physical parent outside screenshot")
        require(row["referenceExact"] is True,"Avatar differs from independent core-native reference")
        if not state["visible"]:
            require(not row["root"] and row["inkPixels"]==0 and state["rootTag"] is None,"Retired Avatar target/paint/ref remains")
            continue
        event=state["layouts"][-1];layout=event["layout"]
        require(state["rootTag"] and event["target"]==event["currentTarget"]==state["rootTag"],"Original Avatar layout/ref differs")
        if isinstance(state["size"],(int,float)):
            require(all(abs(layout[key]-state["size"])*scale<=1 for key in ["width","height"]),"Wrong actual Avatar size")
        if state["size"]==0:
            require(row["inkPixels"]==0 and layout["width"]==layout["height"]==0,"Avatar authored zero leaked paint/layout")
            continue
        require(row["targetCount"]==1 and row["nativeLabel"]==state["label"],"Avatar root target/name differs")
        require(row["nativeType"]==(9 if state["interactive"] else 43),"Avatar image/button trait differs")
        if state["interactive"]:require(row["nativeEnabled"] is (not state["disabled"]),"Avatar disabled native state differs")
        require(len(row["root"])==len(row["referenceRoot"])==4,"Avatar native root/reference missing")
        require(all(abs(a-b)*scale<=1 for a,b in zip(row["root"][2:],row["referenceRoot"][2:])) and all(abs(row["root"][i+2]-layout[key])*scale<=1 for i,key in enumerate(["width","height"])),"Avatar root/native/layout dimensions differ")
        if state["imageMode"]=="sample":require(state["referenceLoaded"].startswith("data:image/png;base64,"),"Independent actual image decode missing")
        if state["delayed"]:
            elapsed=row["captureEpochMs"]-state["mountedEpochMs"]
            require(0<=elapsed<state["delay"] if row["early"] else elapsed>=state["delay"],"Avatar fallback temporal observation outside intended phase")
    return {"status":"PASS","observations":len(rows)}


def reconcile_avatar_ios(raw):
    rows=[json.loads(row) for row in re.findall(r"AVATAR_NATIVE_OBSERVATION (\{[^\n]+\})",raw)]
    result=validate_avatar_rows(rows,AVATAR_BEHAVIOR+AVATAR_STYLES+["touched","held-canceled","delay-before"]);named={row["name"]:row["state"] for row in rows}
    tag=named["baseline"]["rootTag"]
    require(all(named[name]["rootTag"]==tag for name in ["touched","sample","invalid","removed","first-name","last-name","anonymous"]),"Avatar URI/name update replaced original root")
    require(named["touched"]["actions"]==1 and named["touched"]["contacts"][-1]["currentTarget"]==tag and named["touched"]["contacts"][-1]["target"],"Original actual Avatar press missing")
    require(named["held-canceled"]["canceled"] and named["held-canceled"]["disabled"] and named["held-canceled"]["actions"]==1,"Held Avatar disable did not cancel")
    require(named["retired"]["actions"]==named["fresh"]["actions"]==2 and named["fresh"]["rootTag"]!=tag,"Avatar restored action/retirement/fresh ref differs")
    require(named["dark"]["themeMode"]=="dark" and named["light-restored"]["themeMode"]=="light","Avatar provider restoration missing")
    return result


GALLERY_MODES = ["baseline", "touched", "reordered", "two-columns", "three-columns", "overflow-action", "disabled", "primary-only", "secondary-only", "all-restored", "fresh", "empty-media", "falsy-zero", "media-restored", "two-slots", "zero-slots", "fractional-count"]
GALLERY_STYLES = ["style-baseline", "root-style", "primary-style", "row-style", "four-styles", "primary-cleared", "styles-restored", "composite", "style-width-wins", "fractional-width", "percentage-width", "auto-width", "width-restored", "zero-width", "relative", "absolute", "dynamic-light", "dynamic-dark", "light-restored"]


def validate_gallery_rows(rows, names):
    require(sorted(row["name"] for row in rows) == sorted(names), "Missing/duplicate Gallery observations")
    for row in rows:
        state, scale, host = row["state"], row["scale"], row["host"]
        require(isinstance(scale, (int, float)) and math.isfinite(scale) and scale > 0 and scale == state["scale"], "Wrong Gallery scale")
        require(len(host) == 4 and all(math.isfinite(v) for v in host) and 0 < host[2] <= 304 and host[3] >= 600, "Wrong Gallery measurement host")
        for box in [host, *[c["frame"] for c in row["paintChecks"]]]:
            x,y,width,height = [math.floor(v * scale + .5) for v in box]
            require(0 <= x < x + width <= row["imageWidth"] and 0 <= y < y + height <= row["imageHeight"], "Gallery physical crop outside screenshot")
        layout_event = state["originalLayouts"]["root"];layout = layout_event["layout"]
        require(layout_event["target"] and layout_event["target"] == layout_event["currentTarget"], "Original Gallery layout binding differs")
        custom, selected, zero = state["custom"], state["customizations"], state["zero"]
        raw_count = float(state["count"]);count = max(0,math.floor(raw_count)) if math.isfinite(raw_count) else 4;columns = state["columns"] or max(count,1)
        root_border, root_padding, root_gap = (2,7,14) if "root" in selected else (1,5,12) if custom else (0,0,10)
        width = 0 if zero else 260 if custom else state["width"] if isinstance(state["width"],(int,float)) else (host[2]-24)/2 if state["width"] == "50%" else host[2]-24
        inner = max(0,width-2*(root_border+root_padding));primary_border = 3 if "primary" in selected else 2 if custom else 0
        primary_height = inner/2 if "primary" in selected or custom else inner
        row_border,row_padding,column_gap,row_gap = (2,6,8,12) if "row" in selected else (0,4,4,6) if custom else (0,0,10,10)
        grid_width = max(0,inner-2*(row_border+row_padding));track = max(0,(grid_width-(columns-1)*column_gap)/columns);slot_border = 2 if "secondary" in selected else 1 if custom else 0;slot_width = 48 if "secondary" in selected else 40 if custom else track
        show_primary = state["mode"] != "secondary";show_row = state["mode"] != "primary" and (state["kind"] not in ["undefined","null"] or state["items"]) and count > 0
        lines = math.ceil(count/columns) if show_row else 0;grid_height = max(0,lines-1)*row_gap if grid_width == 0 else lines*slot_width+max(0,lines-1)*row_gap
        height = 2*(root_border+root_padding)+(primary_height if show_primary else 0)+(grid_height+2*(row_border+row_padding) if show_row else 0)+(root_gap if show_primary and show_row else 0)
        close = lambda a,b: isinstance(a,(int,float)) and math.isfinite(a) and abs(a-b)*scale <= 1
        require(close(layout["width"],width) and close(layout["height"],height), "Wrong delivered Gallery outer geometry")
        if zero:
            require(layout["width"] == 0 and row["inkPixels"] == 0, "Zero Gallery leaked width/paint")
            continue
        require(row["inkPixels"] > 0 and len(row["root"]) == 4 and close(row["root"][2],width) and close(row["root"][3],height), "Wrong native Gallery root frame/paint")
        require(close(row["root"][0]-host[0],layout["x"]) and close(row["root"][1]-host[1],layout["y"]), "Gallery original/native positions differ")
        require(bool(row["primary"]) == show_primary and bool(row["grid"]) == bool(show_row) and len(row["slots"]) == (count if show_row else 0), "Wrong native Gallery mounted slots/mode")
        require(row["primaryPlaceholder"] == (show_primary and state["kind"] in ["undefined","null"]) and row["placeholderCount"] == (max(0,count-len(state["items"])) if show_row else 0), "Wrong Gallery actual placeholder availability")
        if show_primary:
            require(close(row["primary"][2],inner) and close(row["primary"][3],primary_height), "Wrong Gallery primary geometry")
            if state["kind"] == "zero": require(row.get("primaryTexts") == ["0"], "Authored Gallery zero text leaf missing")
            if state["kind"] == "image":
                load=state["primaryLoads"][-1];image=state["originalLayouts"]["image"]
                require(load["uri"] == state["expectedURI"] and load["width"] > 0 and load["height"] > 0 and load["target"] == image["currentTarget"] and load["currentTarget"] == load["target"], "Current Gallery image decode identity missing")
                require(state["primaryTag"] and state["primaryTag"] == state["originalLayouts"]["primary"]["currentTarget"], "Gallery caller-owned content ref differs")
        if show_row:
            require(close(row["grid"][2],grid_width) and close(row["grid"][3],grid_height), "Wrong Gallery measured native grid")
            for index,slot in enumerate(row["slots"]):
                require(len(slot) == 4 and all(close(a,b) for a,b in zip([slot[0]-row["grid"][0],slot[1]-row["grid"][1],slot[2],slot[3]],[(index%columns)*(track+column_gap),(index//columns)*(slot_width+row_gap),slot_width,slot_width])), "Wrong equal/wrapped Gallery track")
        overflow = state["overflow"] and len(state["items"])>count and show_row;actual = [c for c in row["controls"] if c["id"].startswith("gallery-item-")];over = [c for c in row["controls"] if c["id"] == "gallery-overflow"]
        require(len(actual) == (min(len(state["items"]),count)-int(bool(overflow)) if show_row else 0) and len(over) == int(bool(overflow)), "Wrong Gallery caller controls/overflow")
        require(all(c["enabled"] == (not state["disabled"]) for c in row["controls"]), "Gallery caller disabled state differs")
        if overflow: require(over[0]["label"] == "Gallery overflow "+str(len(state["items"])-count), "Wrong Gallery overflow argument")
        for control in row["controls"]:
            index = count-1 if control["id"] == "gallery-overflow" else state["items"].index(control["id"].removeprefix("gallery-item-"))
            slot = row["slots"][index]
            require(all(close(a,b) for a,b in zip(control["frame"],[slot[0]+slot_border,slot[1]+slot_border,slot_width-2*slot_border,slot_width-2*slot_border])), "Gallery caller control outside its styled slot")

        rgb = lambda text: [int(text[i:i+2],16) for i in [1,3,5]]
        colors = {"root": [8,127,140] if "root" in selected else rgb(state["colors"]["border"]),"primary": [190,18,60] if "primary" in selected else rgb(state["colors"]["selected"]),"row": [124,58,237],"row-background": rgb(state["colors"]["track"]),"secondary": [22,101,52] if "secondary" in selected else rgb(state["colors"]["border"])}
        expected = [key for key,border in [("root",root_border),("primary",primary_border if show_primary else 0),("row",row_border if show_row else 0),("secondary",slot_border if show_row else 0)] if border]
        if custom and show_row:expected.append("row-background")
        require(sorted(c["owner"] for c in row["paintChecks"]) == sorted(expected), "Missing Gallery opaque border observations")
        require(all(c["exact"] is True and c["pixels"] > 0 and c["expectedRGB"] == colors[c["owner"]] for c in row["paintChecks"]), "Wrong Gallery native opaque border colors")
    return {"status":"PASS","observations":len(rows)}


def reconcile_gallery_ios(raw, batch="gallery"):
    rows=[json.loads(x) for x in re.findall(r"GALLERY_NATIVE_OBSERVATION (\{[^\n]+\})",raw)];names=GALLERY_MODES if batch == "gallery-modes" else GALLERY_STYLES if batch == "gallery-styles" else GALLERY_MODES+GALLERY_STYLES
    if batch == "gallery-remaining":return validate_gallery_rows(rows,["falsy-zero","media-restored","two-slots","zero-slots","fractional-count"])
    result=validate_gallery_rows(rows,names);named={row["name"]:row for row in rows}
    if batch != "gallery-styles":
        tag=lambda name:named[name]["state"]["originalLayouts"]["A"]["currentTarget"]
        require(len({tag(name) for name in ["baseline","touched","reordered","two-columns","three-columns"]}) == 1,"Gallery keyed caller host changed")
        for name in ["touched","reordered","two-columns","three-columns","overflow-action","disabled"]:
            require(next(c["label"] for c in named[name]["controls"] if c["id"] == "gallery-item-A") == "Gallery A, count 1" and named[name]["state"]["actions"] == 1,"Gallery caller keyed state lost")
        require(named["overflow-action"]["state"]["overflowActions"] == named["disabled"]["state"]["overflowActions"] == 1,"Gallery caller overflow action differs")
        require(named["fresh"]["state"]["primaryTag"] != named["all-restored"]["state"]["primaryTag"],"Gallery fresh content ref not replaced")
    if batch != "gallery-modes":
        require(named["style-width-wins"]["root"][2] == 260 and named["fractional-width"]["root"][2] != 260,"Gallery final style width precedence missing")
        require(named["percentage-width"]["root"][2] < named["width-restored"]["root"][2],"Gallery percentage width did not constrain")
        require(named["dynamic-light"]["state"]["theme"] == named["light-restored"]["state"]["theme"] == "light" and named["dynamic-dark"]["state"]["theme"] == "dark","Gallery provider restoration missing")
    return result


THUMBNAIL_NAMES = ["baseline", "equivalent", "all-fail", "empty-list", "zero-fallback", "square", "landscape", "adapter", "adapter-empty-alt", "retired", "retired-quiet", "fresh", "geometry-baseline", "density-full", "density-src", "zero-density", "zero-fresh", "positive-fresh", "caller-selected", "styled", "constrained", "fractional", "percentage", "dark", "narrow", "live-restored", "light-restored"]


def validate_thumbnail_rows(rows, names):
    require(sorted(row["name"] for row in rows) == sorted(names), "Missing/duplicate ThumbnailImage observations")
    for row in rows:
        state, scale = row["state"], row["scale"]
        require(isinstance(scale, (float, int)) and math.isfinite(scale) and scale > 0 and scale == state["scale"], "Wrong actual ThumbnailImage scale")
        parent, reference = row["parent"], row["referenceParent"]
        require(len(parent) == len(reference) == 4 and all(math.isfinite(v) for v in parent + reference) and parent[2:] == reference[2:] and 0 < parent[2] <= 280 and parent[3] == 180, "Wrong ThumbnailImage measurement parents")
        for frame in [parent, reference]:
            x,y,width,height = [math.floor(v * scale + .5) for v in frame]
            require(0 <= x < x + width <= row["imageWidth"] and 0 <= y < y + height <= row["imageHeight"], "ThumbnailImage physical parent outside screenshot")
        require(row["referenceExact"] is True, "ThumbnailImage differs from independent Image/Text reference")
        if not state["visible"]:
            require(not row["target"] and row["inkPixels"] == 0, "Retired ThumbnailImage paint/target remains")
            continue
        fallback = not state["callerSelected"] and state["mode"] in [1,2]
        if fallback:
            require(not row["target"] and row["inkPixels"] > 0, "Actual ThumbnailImage fallback missing")
            continue
        layouts = [item for item in state["events"] if item["kind"] == "layout"]
        require(layouts, "Actual ThumbnailImage layout missing")
        event, layout = layouts[-1], layouts[-1]["layout"]
        require(event["target"] and event["target"] == event["currentTarget"], "Original ThumbnailImage event targets differ")
        if state["zero"]:
            require(layout["width"] == layout["height"] == 0 and row["inkPixels"] == 0, "Explicit ThumbnailImage zero leaked frame/paint")
            continue
        dimension = state["dimensionIndex"]
        density = not state["callerSelected"] and state["densityIndex"] > 0
        width = 140 if state["constrained"] else 83.25 if dimension == 1 else (parent[2] - 24) / 2 if dimension == 2 else 120 if state["custom"] else 32 if density else 96 if state["adapter"] else state["nativeSourceWidth"]
        height = width * state["nativeSourceHeight"] / state["nativeSourceWidth"] if state["constrained"] or dimension else 80 if state["custom"] else 32 if density else 48 if state["adapter"] else state["nativeSourceHeight"]
        require(abs(layout["width"] - width) * scale <= 1 and abs(layout["height"] - height) * scale <= 1 and row["inkPixels"] > 0, "Wrong actual ThumbnailImage dimensions/paint")
        if row["target"]:
            border = 2 if state["custom"] else 0
            expected_frame = [parent[0] + layout["x"] + border, parent[1] + layout["y"] + border, width - 2 * border, height - 2 * border]
            require(len(row["target"]) == 4 and all(abs(actual - expected) * scale <= 1 for actual, expected in zip(row["target"], expected_frame)) and row["nativeLabel"] == ("" if state["emptyAlt"] else "Thumbnail preview / aperçu"), "Wrong ThumbnailImage native content frame/name")
            if "referenceTarget" in row:
                raw = row["referenceTarget"]
                require(len(raw) == 4 and all(abs(a - b) * scale <= 1 for a,b in zip([row["target"][0]-parent[0],row["target"][1]-parent[1],*row["target"][2:]],[raw[0]-reference[0],raw[1]-reference[1],*raw[2:]])), "Actual/raw native image content frames differ")
        else: require(state["emptyAlt"], "Named ThumbnailImage absent from native snapshot")
        loads = [item for item in state["events"] if item["kind"] == "load"]
        require(loads and loads[-1]["source"]["uri"] == state["expectedURI"] and state["referenceSource"] == state["expectedURI"], "Actual ThumbnailImage/reference decoded wrong URI")
        require(loads[-1]["source"]["width"] > 0 and loads[-1]["source"]["height"] > 0 and loads[-1]["currentTarget"] == event["currentTarget"], "Original ThumbnailImage load/layout identity missing")
        if state["adapter"]:require(state["adapterBinding"]["tag"] == event["currentTarget"], "Renderer-owned Image ref does not match actual host")
    return {"status":"PASS","observations":len(rows)}


def reconcile_thumbnail_ios(raw, include_lifetime=True):
    rows = [json.loads(line) for line in re.findall(r"THUMBNAIL_NATIVE_OBSERVATION (\{[^\n]+\})", raw)]
    result = validate_thumbnail_rows(rows, THUMBNAIL_NAMES if include_lifetime else THUMBNAIL_NAMES[12:]);named = {row["name"]:row["state"] for row in rows}
    require(named["percentage"]["frame"]["width"] != named["narrow"]["frame"]["width"], "Percentage ThumbnailImage host constraint unchanged")
    if not include_lifetime: return result
    require(named["baseline"]["errors"] == named["equivalent"]["errors"] == 1 and named["all-fail"]["errors"] == named["empty-list"]["errors"] == 3, "Actual candidate error/equivalent-list protocol differs")
    events = named["baseline"]["events"]
    require(next(i for i,e in enumerate(events) if e["kind"] == "error") < next(i for i,e in enumerate(events) if e["kind"] == "load"), "Native error must precede fallback candidate success")
    require(named["adapter"]["adapterBinding"]["tag"] == named["adapter-empty-alt"]["adapterBinding"]["tag"], "Alt update replaced renderer-owned ref")
    require(named["fresh"]["adapterBinding"]["tag"] != named["adapter"]["adapterBinding"]["tag"] and named["fresh"]["adapterBinding"]["detaches"] == named["adapter"]["adapterBinding"]["detaches"] + 1, "Native image retirement/fresh lifetime missing")
    require(named["retired"]["loads"] == named["retired-quiet"]["loads"] and named["retired"]["errors"] == named["retired-quiet"]["errors"], "Retired callbacks changed caller state")
    require(named["percentage"]["frame"]["width"] != named["narrow"]["frame"]["width"], "Percentage ThumbnailImage host constraint unchanged")
    return result


def reconcile_text_style_ios(raw, config, app):
    from NativeTextStyleCheck import validate_rows
    rows = [json.loads(row) for row in re.findall(r"TEXT_STYLE_OBSERVATION (\{[^\n]+\})", raw)]
    if config.get("batch") == "text-style-context":
        retained = json.loads(bound_file(config["retainedTextTypographyMethod"]).read_text())
        require(retained.get("method") == "testTextTypographyAndClear" and retained.get("appManifestSHA256") == app["manifestSHA256"], "Retained typography needs the same app and exact method")
        native_method(retained)
        loaded = json.loads(bound_file(retained["loadedObserver"]).read_text())
        require(loaded.get("status") == "PASS" and loaded.get("observerManifestSHA256") == retained.get("observerManifestSHA256"), "Retained actual loaded observer identity is missing")
        prior = [json.loads(row) for row in re.findall(r"TEXT_STYLE_OBSERVATION (\{[^\n]+\})", bound_file(retained).read_text())]
        rows += [row for row in prior if row["name"] in ["default", "custom", "cleared", "restored"]]
    return validate_rows(rows, "ios")


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


RISK_NAMES = ["known-styled", "moving-0", "moving-1", "moving-2", "stopped-0", "stopped-1", "stopped-2", "known-restored"]


def validate_progress_risk_rows(rows, platform):
    require([row["name"] for row in rows] == RISK_NAMES, "Incomplete/duplicate LinearProgress risk observations")
    for index, row in enumerate(rows):
        unknown = 0 < index < 7
        require(row["unknown"] == unknown and math.isfinite(row.get("captureEpochMs", 0)) and row.get("captureEpochMs", 0) > 0 and math.isfinite(row["scale"]) and row["scale"] > 0, "Wrong actual risk state/capture")
        frame = row["frame"]
        height = (frame[3] - frame[1]) / row["scale"] if platform == "android" else frame[3]
        require(len(frame) == 4 and all(math.isfinite(x) for x in frame) and abs(height - 14) <= 1 / row["scale"], "Actual progress frame differs")
        if platform == "android":
            native = row["nativeTarget"]
            require(native["className"] == "android.view.View" and native["roleDescription"] == "Progress Bar", "Wrong actual progress role")
            require(native["contentDescription"] in (["Task progress", "Task progress, "] if unknown else ["Task progress, 25%"]), "Wrong current native progress text")
            require((native.get("rangeInfo") is None and native.get("currentValue") is None) if unknown else {key: native["rangeInfo"].get(key) for key in ["min", "max", "current"]} == {"min": 0, "max": 100, "current": 25}, "Stale native range")
        else:
            require(row["nativeLabel"] == "Task progress" and row["nativeValue"] in ([None, ""] if unknown else ["25%"]), "Wrong actual iOS progress label/value")
        if unknown: require(row["centerPaintedPixels"] > 0, "Unknown cue is absent")
        else:
            samples = row["samples"];require(len(samples) == 2, "Known fill/track samples missing")
            if platform == "ios":
                require(all(sample["rgba"] and len(sample["rgba"]) % 4 == 0 and sample["rgba"] == sample["referenceRGBA"] for sample in samples) and samples[0]["rgba"] != samples[1]["rgba"], "Actual independent opaque samples differ/vacuous")
            else: require(all(sample["argb"] == sample["referenceARGB"] for sample in samples) and samples[0]["argb"] != samples[1]["argb"], "Actual independent opaque samples differ/vacuous")
        if index in [4, 5, 6]: require(row["motionEvents"] and row["motionEvents"][-1] is True, "Real native public Reduce Motion event missing")
    for group in [rows[1:4], rows[4:7]]: require(all(row["frame"] == group[0]["frame"] for row in group), "Motion interval moved the native frame")
    return {"status": "PASS", "observations": len(rows), "actualPublicMotionEvent": True}


def reconcile_linear_progress_risk_ios(raw):
    rows = [json.loads(row) for row in re.findall(r"LINEAR_PROGRESS_RISK_OBSERVATION (\{[^\n]+\})", raw)]
    result = validate_progress_risk_rows(rows, "ios")
    require(raw.count("LINEAR_PROGRESS_RISK_INTERVALS movingDifferent=true stoppedExact=true") == 1, "Real native active/static intervals missing")
    originals = re.findall(r"METER_STYLE_MOTION_ORIGINAL ([01])", raw)
    require(len(originals) == 1 and originals == re.findall(r"METER_STYLE_MOTION_RESTORED ([01])", raw), "Original Reduce Motion restoration missing")
    return {**result, "originalAndRestoredMotion": originals[0], "rows": rows}


def reconcile_linear_progress_risk_android(session, config, directory, receipt, captured_preferences=None):
    from MeterStyleAndroidCheck import Bitmap
    require(receipt["operation"] == "linear-progress-risk-batch" and receipt["selectedMethods"] == ["live-motion"] and len(receipt["cohorts"]) == 1, "Wrong risk batch")
    cohort = receipt["cohorts"][0];rows = cohort["observations"]
    result = validate_progress_risk_rows(rows, "android")
    require(cohort["movingPixelsDiffer"] is True and cohort["stoppedPixelsExact"] is True and cohort["motionRestorationVerified"] is True, "Native interval/restoration failed")
    expected = captured_preferences if captured_preferences is not None else {**session.additional_motion_settings, "transition_animation_scale": session.motion_setting}
    require(cohort["originalMotionSettings"] == cohort["restoredMotionSettings"] == expected, "Exact originally captured preference set differs")
    decoder = bound_file(config["imageDecoder"]);frames = {}
    output = session.output / "paint";output.mkdir()
    for row in rows:
        require(Path(row["png"]).name == row["png"], "Original PNG basename required")
        bitmap = output / (row["name"] + ".bmp")
        session.run("decode-" + row["name"], [decoder, "-s", "format", "bmp", directory / row["png"], "--out", bitmap])
        image = Bitmap(bitmap.read_bytes());require([image.width, image.height] == row["screenSize"], "Native screenshot size differs")
        x,y,right,bottom = row["frame"]
        frames[row["name"]] = [image.argb([px,py]) for py in range(y,bottom) for px in range(x,right)]
        if row["unknown"]:
            cx,cy,cr,cb = row["center"];require(x <= cx < cr <= right and y <= cy < cb <= bottom, "Unknown center escaped actual root")
            count = sum(image.argb([px,py]) != 0xffffffff for py in range(cy,cb) for px in range(cx,cr))
            background = rows[0]["samples"][1]["argb"] & 0xffffffff
            cue_count = sum(image.argb([px,py]) != background for py in range(cy,cb) for px in range(cx,cr))
            if "centerBackgroundARGB" in row:
                require((row["centerBackgroundARGB"] & 0xffffffff) == background and cue_count == row["centerPaintedPixels"], "Native calibrated cue count differs")
            else: require(count == row["centerPaintedPixels"], "Original legacy nonwhite count differs")
            require(cue_count > 0, "Unknown cue matches the actual empty track and is invisible")
            row["independentCalibratedCuePixels"] = cue_count
            row["independentTrackARGB"] = background
        else:
            for sample in row["samples"]:require(image.argb(sample["point"]) == image.argb(sample["referencePoint"]) == (sample["argb"] & 0xffffffff), "Original opaque PNG/native reference differs")
    require(frames["moving-0"] != frames["moving-1"] or frames["moving-1"] != frames["moving-2"], "Original PNGs have no native motion")
    require(frames["stopped-0"] == frames["stopped-1"] == frames["stopped-2"], "Original PNGs did not stop")
    return {**result, "nativeAndHostColorTolerance": 0, "capturedPreferences": expected, "movingIntervalChanged": True, "reducedIntervalExact": True, "observedRows": rows}


def android_cpu_cores(config):
    value = config.get("cores", 2)
    require(type(value) is int and value in [2, 4], "Only the recorded two/four-vCPU configurations are supported")
    return value


def start_android(session, config):
    cores = android_cpu_cores(config)
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
    argv = [str(sdk / "emulator/emulator"), "-avd", config["avd"], "-port", str(port), "-no-snapshot-load", "-no-snapshot-save", "-cores", str(cores), "-memory", "2048", "-no-window", "-no-audio", "-no-boot-anim", "-gpu", config["gpu"]]
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
    return selected


def diagnose_android(session, config):
    selected = start_android(session, config)
    session.run("system-logcat", selected + ["logcat", "-b", "system", "-b", "events", "-b", "crash", "-d", "-v", "threadtime"])
    session.run("cpu-info", selected + ["shell", "dumpsys", "cpuinfo"])
    session.run("last-anr", selected + ["shell", "dumpsys", "activity", "lastanr"])
    report = session.output / "bugreport.zip"
    session.run("bugreport", selected + ["bugreport", report])
    require(zipfile.is_zipfile(report), "Standard adb bugreport archive missing")
    return {"status": "OS_DIAGNOSTIC_CAPTURED_PENDING_REVIEW", "componentMethods": 0, "installRequests": 0, "inputRequests": 0, "bugreport": {"path": str(report), "sha256": digest(report)}, "gatePromotions": 0}


def run_android(session, config, app, observer):
    sdk, serial = Path(config["sdk"]), config["destination"]
    selected = start_android(session, config)
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
    style = batch in ["meter-style", "meter-style-dimensions"]
    risk = batch == "linear-progress-risk"
    if style or risk or batch == "circular-progress":
        session.run("device-api", selected + ["shell", "getprop", "ro.build.version.sdk"])
        session.run("device-abi", selected + ["shell", "getprop", "ro.product.cpu.abi"])
        session.run("device-size", selected + ["shell", "wm", "size"])
        session.run("device-font-setting", selected + ["shell", "settings", "get", "system", "font_scale"])
        session.motion_setting = session.run("motion-setting-before", selected + ["shell", "settings", "get", "global", "transition_animation_scale"]).strip()
        require(session.motion_setting == "null" or re.fullmatch(r"[0-9.]+", session.motion_setting), "Unexpected captured motion preference")
        if risk:
            original = session.run("animator-setting-before", selected + ["shell", "settings", "get", "global", "animator_duration_scale"]).strip()
            require(original == "null" or re.fullmatch(r"[0-9.]+", original), "Unexpected captured animator preference")
            session.additional_motion_settings["animator_duration_scale"] = original
    operation = "meter-style" if style else batch
    remote = "/sdcard/Android/data/dev.codonui.lab.number/files/" + operation + "-native-" + session.output.name
    cohort_args = ["-e", "cohorts", "dimensions"] if batch == "meter-style-dimensions" else []
    session.run("instrumentation", selected + ["shell", "am", "instrument", "-w", "-e", "op", operation + "-batch", "-e", "outputDir", remote, "-e", "attemptRemainingMs", str(max(1, int(session.remaining() * 1000))), *cohort_args, "dev.codonui.lab.number/.Actions"])
    directory = session.output / "native"
    session.run("pull-results", selected + ["pull", remote, str(directory)])
    receipt = directory / "receipt.json";value = json.loads(receipt.read_text())
    require(value.get("nativeActionSucceeded") and not value.get("hasFailedCohorts") and value.get("selectedMethods") == cohorts, "Instrumentation failed/incomplete; adb exit alone is not a verdict")
    methods = [native_method({"path": str(receipt), "sha256": digest(receipt), "format": "android_receipt", "method": name, "maximumSeconds": 1800}) for name in cohorts]
    session.run("density", selected + ["shell", "wm", "density"])
    if risk:
        result = reconcile_linear_progress_risk_android(session, config, directory, value)
        write(session.output / "risk-review.json", result)
    elif batch == "circular-progress":
        rows = [row for cohort in value["cohorts"] for row in cohort["observations"]]
        require(len(rows) == 24 and all(row["referenceExact"] or row["state"]["case"] in ["context-label", "zero-width", "zero-height"] for row in rows), "CircularProgress drawing captures incomplete or mismatched")
        write(session.output / "circular-review.json", {"observations": len(rows), "allNativeAssertionsPassed": True, "visualReviewRequired": True})
    elif batch == "text-style":
        from NativeTextStyleCheck import validate_rows
        rows = [row for cohort in value["cohorts"] for row in cohort["observations"]]
        write(session.output / "text-style-review.json", validate_rows(rows, "android"))
    elif style:
        decoder = bound_file(config["imageDecoder"])
        selected_args = ["--selected-cohorts", "dimensions"] if batch == "meter-style-dimensions" else []
        session.run("paint", [os.sys.executable, "-B", ROOT / "MeterStyleAndroidCheck.py", "--input", directory, "--out", session.output / "paint", "--image-decoder", decoder, "--decoder-sha256", config["imageDecoder"]["sha256"], "--deadline-unix", str(session.work), *selected_args])
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
        captured = dict(session.additional_motion_settings)
        if session.motion_setting is not None: captured["transition_animation_scale"] = session.motion_setting
        restored = {}
        for key, original in captured.items():
            try:
                require(key in ["transition_animation_scale", "animator_duration_scale"], "Uncaptured motion preference key")
                label = "motion-setting" if key == "transition_animation_scale" else "animator-setting"
                argv = ["delete", "global", key] if original == "null" else ["put", "global", key, original]
                session.run("restore-" + label, adb + ["-s", config["destination"], "shell", "settings", *argv], session.remaining(True) / (2 * len(captured) + 1), True)
                restored[key] = session.run("verify-" + label, adb + ["-s", config["destination"], "shell", "settings", "get", "global", key], session.remaining(True) / (2 * len(captured) + 1), True).strip()
                require(restored[key] == original, "Exact captured motion preference restoration failed: " + key)
            except Exception as error:
                session.cleanup_errors.append("Motion preference restoration: " + repr(error))
        if captured: write(session.output / "preference-restoration.json", {"captured": captured, "restored": restored, "exactKeySetAndValuesVerified": restored == captured})
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


def capture_android_failure(session, config):
    if config["platform"] != "android" or config["action"] != "run" or not session.guest_owned or session.remaining() <= 0: return
    try:
        session.run("failure-system-logcat", [Path(config["sdk"]) / "platform-tools/adb", "-s", config["destination"], "logcat", "-b", "system", "-b", "events", "-b", "crash", "-d", "-v", "threadtime"])
    except BaseException as error:
        write(session.output / "failure-logcat-warning.json", {"error": repr(error), "scope": "Optional diagnostic capture; original native failure is preserved"})


def execute(plan, admission):
    config = plan["nativeStandard"]
    require(config["platform"] in ["ios", "android"] and config["action"] in ["build", "run", "diagnose"], "Unknown standard SDK operation")
    if config["action"] == "diagnose": require(config["platform"] == "android" and config["batch"] == "meter-startup-diagnostic", "Only the named Android OS diagnostic is supported")
    selection(config["platform"], config.get("batch"))
    maximum=plan["attempt"]["maximumSeconds"]
    session = Session(config["output"], maximum, plan["attempt"]["cleanupReserveSeconds"])
    result, failure = None, None
    def interrupted(signum, frame): raise InterruptedError("Owned standard SDK run interrupted: " + str(signum))
    prior = {signum: signal.signal(signum, interrupted) for signum in [signal.SIGINT, signal.SIGTERM, signal.SIGALRM]}
    signal.setitimer(signal.ITIMER_REAL, max(0.01, session.work - time.time()))
    try:
        if config["action"] == "build":
            result = build_ios(session, config) if config["platform"] == "ios" else build_android(session, config)
            result.setdefault("sourceFilesSHA256", {item["path"]: item["sha256"] for item in plan["bindings"]["observer"]})
            write(session.output / "identity.json", result)
        elif config["action"] == "diagnose": result = diagnose_android(session, config)
        else:
            app = json.loads(bound_file(config["appIdentity"]).read_text());observer = json.loads(bound_file(config["observerIdentity"]).read_text())
            verify_product(app);verify_product(observer)
            write(session.output / "selected-app-inputs.json", verify_selected_app_inputs(plan, app))
            for path, expected in observer["sourceFilesSHA256"].items(): require(digest(path) == expected, "Observer source changed since SDK build")
            result = run_ios(session, config, app, observer) if config["platform"] == "ios" else run_android(session, config, app, observer)
    except BaseException as error:
        failure = repr(error)
        capture_android_failure(session, config)
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


def validate_standard_scope(plan):
    cell, batch = plan["cell"], plan["nativeStandard"].get("batch", "meter-g02")
    meter = cell.startswith("CAT.meter.") and batch.startswith("meter-")
    progress = cell in ["CAT.linear-progress." + gate for gate in ["G04", "G07", "G08", "G09"]] and batch == "linear-progress-risk"
    text = cell in ["CAT.text." + gate for gate in ["G04", "G07", "G08", "G09"]] and batch in ["text-style", "text-style-context"]
    circular = cell in ["CAT.circular-progress." + gate for gate in ["G02", "G04", "G08"]] and batch in ["circular-progress", "circular-progress-affected"]
    loader = cell in ["CAT.circle-loader." + gate for gate in ["G04", "G08"]] and batch == "circle-loader"
    lines = cell in ["CAT.lagging-lines-loader." + gate for gate in ["G04", "G08"]] and batch == "lagging-lines"
    counter = cell in ["CAT.counter." + gate for gate in ["G04", "G08"]] and batch in ["counter", "counter-values"]
    thumbnail = cell in ["CAT.thumbnail-image." + gate for gate in ["G04", "G08"]] and batch in ["thumbnail", "thumbnail-geometry"]
    gallery = cell in ["CAT.thumbnail-showcase." + gate for gate in ["G04", "G08"]] and batch in ["gallery", "gallery-modes", "gallery-styles", "gallery-remaining"]
    avatar = cell in ["CAT.avatar." + gate for gate in ["G04", "G08"]] and batch == "avatar"
    list_item = cell in ["CAT.list-box-item." + gate for gate in ["G04", "G08"]] and batch in ["list-box-item", "list-box-item-motion"]
    toggle_button = cell in ["CAT.toggle-button." + gate for gate in ["G04", "G08"]] and batch in ["toggle-button", "toggle-button-affected", "toggle-button-style"]
    radio = cell == "CAT.radio.G08" and batch in ["radio", "radio-motion"]
    placeholder = cell == "CAT.placeholder-text.G08" and batch == "placeholder-g08"
    slider = cell == "CAT.slider.G01" and batch == "slider-hit-layout"
    checkbox = cell == "CAT.checkbox.G08" and batch in ["checkbox","checkbox-static","checkbox-motion"]
    tooltip = cell == "CAT.tooltip.G08" and batch in ["tooltip","tooltip-ownership","tooltip-styles","tooltip-motion"]
    link = cell == "CAT.link.G08" and batch in ["link","link-static","link-actions"]
    button = cell == "CAT.button.G08" and batch in ["button","button-motion"]
    radio_group = cell == "CAT.radio-group.G08" and batch=="radio-group"
    checkbox_group = cell == "CAT.checkbox-group.G08" and batch in ["checkbox-group","checkbox-group-actions"]
    switch = cell == "CAT.switch.G08" and batch in ["switch", "switch-motion"]
    require(meter or progress or text or circular or loader or lines or counter or thumbnail or gallery or avatar or list_item or toggle_button or radio or placeholder or slider or switch or checkbox or checkbox_group or radio_group or button or link or tooltip, "Only the authorized component and focused batch are selected")


def main():
    parser = argparse.ArgumentParser(description=__doc__);parser.add_argument("--plan", type=Path, required=True);args = parser.parse_args()
    plan = json.loads(args.plan.read_text());validate_standard_scope(plan)
    admission = load_admission(__file__, plan["cell"], selection(plan["nativeStandard"]["platform"], plan["nativeStandard"].get("batch", "meter-g02")))
    require(json.loads(Path(admission["path"]).read_text())["planSHA256"] == digest(args.plan), "Plan changed after admission")
    return execute(plan, admission)


if __name__ == "__main__":
    raise SystemExit(main())
