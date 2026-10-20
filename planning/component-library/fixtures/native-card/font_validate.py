"""Validate original installed font observations; no synthetic native observations."""
import json


def parse(text):
    return [json.loads(line) for line in text.splitlines() if line.startswith('{"kind":')]


def validate(records, platform, producer):
    assert platform == "android"
    assert records[0]["kind"] == "begin" and records[0]["producer"] == producer
    assert records[-1]["kind"] == "terminal" and records[-1]["outcome"] == "native-font-pass"
    assert records[-1]["producer"] == producer
    rows = [row for row in records if row["kind"] == "font-case"]
    expected = {(family, style, weight, feature) for family in ["cui-font-fixture-override", "cui-font-fixture-custom", "sans-serif", "cui-font-fixture-missing"] for style in [-1, 0, 1, 2, 3] for weight in [-1, 100, 200, 300, 400, 500, 600, 700, 800, 900] for feature in [None, "'liga' off, 'tnum'"]}
    actual = [(row["family"], row["style"], row["weight"], row["features"]) for row in rows]
    assert len(rows) == len(expected) and set(actual) == expected
    assert [row["case"] for row in rows] == list(range(len(rows)))
    for row in rows:
        assert row["sourceWidth"] == row["copiedWidth"]
        assert row["sourceLines"] == row["copiedLines"] and len(row["sourceLines"]) > 1
        assert row["originalCachesUnchanged"] is True
    summaries = [row for row in records if row["kind"] == "font-summary"]
    assert len(summaries) == 1
    summary = summaries[0]
    assert summary["cases"] == len(expected) and summary["assertions"] > len(expected)
    assert all(summary[key] is True for key in ["fontFitting", "requestIsolation", "sourceCachesUnchangedByScratch"])
    assert summary["fullCard"] is False
    return {"producer": producer, "platform": platform, "fontCases": len(rows), "assertions": summary["assertions"], "sdk": summary["sdk"], "scope": "Installed owned-font span/cache/layout correspondence; actual cached editor service, held editor/native-owner retirement, assets, API<28, consumer/profile/closure gates remain required", "fullCard": False, "fullGoal": False}
