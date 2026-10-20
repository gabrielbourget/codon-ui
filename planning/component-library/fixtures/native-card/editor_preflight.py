"""Observe actual OS readiness before the single approved Card app attempt."""
import re
import time

LAUNCHER = "com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity"


def wait_for_os(device, state, save, alive, clock=time.monotonic, sleep=time.sleep):
    started = clock()
    stable_since = stable_pid = None
    state["stage"] = "actual-os-readiness"
    state["osReadiness"] = {"capSeconds": 90, "stableSecondsRequired": 20, "samples": []}
    save()
    while clock() - started < 90:
        assert alive(), "Owned emulator stopped during OS readiness"
        index = len(state["osReadiness"]["samples"])
        boot_code, boot = device(f"os-ready-boot-{index:02d}", ["shell", "getprop", "sys.boot_completed"], 8, False)
        focus_code, focus = device(f"os-ready-focus-{index:02d}", ["shell", "dumpsys", "window", "displays"], 8, False)
        pid_code, pid = device(f"os-ready-systemui-{index:02d}", ["shell", "pidof", "com.android.systemui"], 8, False)
        anr_code, anr = device(f"os-ready-anr-{index:02d}", ["shell", "dumpsys", "activity", "lastanr"], 8, False)
        focus_text = focus.decode(errors="replace")
        current_focus = re.findall(r"^\s*mCurrentFocus=(.*)$", focus_text, re.MULTILINE)
        healthy = boot_code == focus_code == pid_code == 0 and boot.strip() == b"1" and re.fullmatch(rb"\d+", pid.strip()) is not None and len(current_focus) == 1 and LAUNCHER in current_focus[0]
        no_anr = anr_code == 0 and "<no ANR has occurred since boot>" in anr.decode(errors="replace") and "Application Not Responding" not in focus_text
        now = clock()
        state["osReadiness"]["samples"].append({"elapsedSeconds": round(now - started, 3), "healthy": healthy, "noCurrentBootANR": no_anr, "systemUIPID": pid.decode(errors="replace").strip(), "focus": current_focus})
        save()
        assert no_anr, "Current-boot ANR or missing actual ANR readiness proof; app attempt withheld"
        if healthy:
            if stable_since is None or stable_pid != pid.strip():
                stable_since, stable_pid = now, pid.strip()
            if now - stable_since >= 20:
                state["osReadiness"].update({"passed": True, "stableSeconds": round(now - stable_since, 3)})
                save()
                return
        else:
            stable_since = stable_pid = None
        sleep(min(5, max(0, 90 - (clock() - started))))
    raise AssertionError("Actual launcher/SystemUI readiness did not remain stable; app attempt withheld")
