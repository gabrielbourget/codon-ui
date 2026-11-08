"""Review actual Text captures; SDK verdicts and visual review remain separate."""
import math

CONTENT = "Native text remains readable: sélectionnez les paramètres et continuez lorsque vous êtes prêt."
NAMES = ["default", "custom", "cleared", "restored", "light", "dark", "compact", "live-restored"]


def require(value, message):
    if not value:
        raise ValueError(message)


def validate_rows(rows, platform):
    require(platform in ["ios", "android"], "Unknown actual Text platform")
    require(len(rows) == len(NAMES) and sorted(row["name"] for row in rows) == sorted(NAMES), "Incomplete/duplicate actual Text observations")
    rows = sorted(rows, key=lambda row: NAMES.index(row["name"]))
    dimensions = {}
    for row in rows:
        scale, frame = row["scale"], row["frame"]
        require(math.isfinite(scale) and scale > 0 and len(frame) == 4 and all(math.isfinite(x) for x in frame), "Actual finite Text geometry required")
        left, top = frame[:2]
        width, height = ((frame[2]-left)/scale, (frame[3]-top)/scale) if platform == "android" else tuple(frame[2:])
        right, bottom = (frame[2], frame[3]) if platform == "android" else ((left+width)*scale, (top+height)*scale)
        require(left >= 0 and top >= 0 and width > 0 and height > 0 and right <= row["imageWidth"] and bottom <= row["imageHeight"], "Full positive Text frame must be inside actual screenshot")
        require(row["text"] == CONTENT and row["stableFrameAndContent"] is True, "Actual current stable full Text content required")
        require(row["expectedRGB"] == (0xffffff if row["name"] == "dark" else 0x171717) and isinstance(row["foregroundPixels"], int) and row["foregroundPixels"] > 0, "Actual expected foreground must paint")
        require(math.isfinite(row["captureEpochMs"]) and row["captureEpochMs"] > 0, "Actual capture time required")
        if platform == "android": require(row["className"] == "android.widget.TextView", "Native TextView required")
        dimensions[row["name"]] = [width, height]
    initial = dimensions["default"]
    require(dimensions["custom"][1] > initial[1], "Custom typography must change native layout")
    for name in ["cleared", "restored", "light", "dark", "live-restored"]:
        require(all(abs(actual-expected) <= 1/rows[0]["scale"] for actual, expected in zip(dimensions[name], initial)), "Native typography reset/provider dimensions differ: " + name)
    require(dimensions["compact"][0] <= 320 and dimensions["compact"][0] < dimensions["light"][0] and dimensions["compact"][1] > 14, "A narrower wrapping Text host is required")
    return {"status": "PASS", "platform": platform, "observations": len(rows), "dimensions": dimensions, "rows": rows, "scope": "Actual Text paint/layout/provider/reset/narrow wrapping; exact font family/weight source assertions remain separately mapped; no new physical AT claim"}
