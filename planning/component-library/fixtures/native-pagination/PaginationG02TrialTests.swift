import XCTest

// Add to the existing showcase UI-test target. Coordinator owns admission and genuine SDK evidence.
final class PaginationG02TrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let sceneSHA = "ef6a6c716d7e970a71cc365c4de2670b0a3cf2e435598acb32490a48aeb83679"

    override func setUpWithError() throws {
        continueAfterFailure = false
        guard ProcessInfo.processInfo.environment["CODON_PAGINATION_SCENE_SHA256"] == sceneSHA else {
            XCTFail("Bind the exact PaginationScene fixture")
            throw NSError(domain: "PaginationG02Admission", code: 1)
        }
        for key in ["CODON_PAGINATION_PRODUCT_SHA256", "CODON_PAGINATION_INPUT_MANIFEST_SHA256",
                    "CODON_PAGINATION_SDK_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression), "Invalid " + key)
        }
        // Main prelaunches the matched product and prepares a fresh default Pagination scene per method.
        // No replacement launch, target warm-up, retry after failed activation or failure-path reset.
        guard [.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(app.state) else {
            XCTFail("Coordinator must prelaunch the matched product")
            throw NSError(domain: "PaginationG02Admission", code: 2)
        }
        if app.state != .runningForeground { app.activate() }
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        XCTAssertLessThan(app.windows.firstMatch.frame.width, app.windows.firstMatch.frame.height)
        try exact(try owner()["page"], 3); try exact(try owner()["size"], 10)
        for key in ["echo", "groups", "left"] { try exact(try owner()[key], true) }
        for key in ["disabled", "empty", "rtl", "veto"] { try exact(try owner()[key], false) }
        try exact(try owner()["requests"], []); try exact(try receipts(), [])
        XCTAssertFalse(app.keyboards.firstMatch.exists, "This cohort requires the keyboard-inactive condition")
    }

    override func tearDownWithError() throws {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = "pagination-g02-final-screen"; image.lifetime = .keepAlways; add(image)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "pagination-g02-final-hierarchy"; tree.lifetime = .keepAlways; add(tree)
    }

    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private func button(_ id: String) -> XCUIElement {
        app.buttons.matching(identifier: id).firstMatch
    }
    private func reveal(_ target: XCUIElement, allowDisabled: Bool = false) {
        let visible = {
            guard target.exists, target.frame.width > 0, target.frame.height > 0 else { return false }
            let center = CGPoint(x: target.frame.midX, y: target.frame.midY)
            return self.app.windows.firstMatch.frame.contains(center) &&
                self.app.scrollViews.allElementsBoundByIndex.contains { $0.isHittable && $0.frame.contains(center) }
        }
        for _ in 0..<12 {
            if target.exists && (target.isHittable || (allowDisabled && visible())) { return }
            guard let scroll = app.scrollViews.allElementsBoundByIndex.first(where: { $0.isHittable }) else { break }
            if target.exists && target.frame.minY < scroll.frame.minY { scroll.swipeDown() }
            else { scroll.swipeUp() }
        }
        XCTAssertTrue(target.exists && (target.isHittable || (allowDisabled && visible())),
                      "Original target is unreachable: " + target.debugDescription)
    }
    private func tapControl(_ label: String) {
        let target = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: 10)); reveal(target); target.tap()
    }
    private func tapPage(_ page: Int) { tapButton("pagination-page-\(page)") }
    private func tapButton(_ id: String) {
        let target = button(id)
        reveal(target); XCTAssertTrue(target.isEnabled); target.tap()
    }
    private func blockedTouch(_ id: String) {
        let target = button(id)
        reveal(target, allowDisabled: true); XCTAssertFalse(target.isEnabled)
        target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
    private func read(_ id: String) throws -> Any {
        let target = node(id)
        XCTAssertTrue(target.exists, "Missing original fixture readback " + id)
        return try JSONSerialization.jsonObject(with: Data(target.label.utf8))
    }
    private func owner() throws -> [String: Any] {
        try XCTUnwrap(try read("pagination-behavior-owner") as? [String: Any])
    }
    private func receipts() throws -> [[String: Any]] {
        try XCTUnwrap(try read("pagination-behavior-callbacks") as? [[String: Any]])
    }
    private func exact(_ actual: Any?, _ expected: Any) throws {
        let value = try XCTUnwrap(actual)
        let lhs = try JSONSerialization.data(withJSONObject: ["value": value], options: .sortedKeys)
        let rhs = try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys)
        XCTAssertEqual(String(decoding: lhs, as: UTF8.self), String(decoding: rhs, as: UTF8.self))
    }
    private func settle(page: Int, requests: [String], receiptCount: Int) throws {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (try? self.owner()["page"] as? Int) == page &&
            (try? self.owner()["requests"] as? [String]) == requests &&
            (try? self.receipts().count) == receiptCount
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 10), .completed,
                       "Original contact did not produce the required owner/callback outcome")
        try exact(try owner()["page"], page); try exact(try owner()["requests"], requests)
        let trace = try receipts()
        XCTAssertEqual(try trace.map { try XCTUnwrap($0["sequence"] as? Int) },
                       trace.isEmpty ? [] : Array(1...trace.count))
    }
    private func trace(_ kinds: [String], pageValues: [Int]) throws {
        let rows = try receipts()
        try exact(rows.map { $0["kind"] ?? NSNull() }, kinds)
        try exact(rows.filter { $0["kind"] as? String == "page" }.map { $0["data"] ?? NSNull() }, pageValues)
        for row in rows where row["kind"] as? String == "button" {
            let data = try XCTUnwrap(row["data"] as? [String: Any])
            XCTAssertTrue(data["kind"] is NSNull, "Touch must not be replaced by a virtual/key event")
            XCTAssertNotNil(data["target"], "Keep the original target/descendant for SDK reconciliation")
        }
    }
    private func record(_ name: String, targetID: String) throws {
        let target = button(targetID), frame = target.frame, window = app.windows.firstMatch.frame
        let payload: [String: Any] = [
            "stage": name, "sceneSHA256": sceneSHA, "owner": try owner(), "callbacks": try receipts(),
            "targetID": targetID, "targetEnabled": target.isEnabled, "targetSelected": target.isSelected,
            "targetFrame": [frame.minX, frame.minY, frame.width, frame.height],
            "windowFrame": [window.minX, window.minY, window.width, window.height],
            "keyboardActive": app.keyboards.firstMatch.exists, "capturedAt": Date().timeIntervalSince1970,
            "scope": "Public XCTest outcomes and JS callback snapshots; genuine SDK target, provenance, timing and lifetime evidence remains required"
        ]
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: payload,
                                  options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func request(_ id: String, value: Int) throws {
        tapButton(id)
        try settle(page: value, requests: ["page:\(value)"], receiptCount: 2)
        try trace(["button", "page"], pageValues: [value])
        XCTAssertTrue(button("pagination-page-\(value)").isSelected)
        try record("S02-" + id, targetID: id)
    }

    func testS02CurrentPageTouchDoesNotRequestNavigation() throws {
        tapPage(3)
        try settle(page: 3, requests: [], receiptCount: 1)
        try trace(["button"], pageValues: [])
        XCTAssertTrue(button("pagination-page-3").isSelected)
        try record("S02-current-page-no-request", targetID: "pagination-page-3")
    }
    func testS02DifferentVisiblePageEchoesOnce() throws { try request("pagination-page-4", value: 4) }
    func testS02FirstRequestUsesCallerPage() throws { try request("pagination-first", value: 1) }
    func testS02PreviousRequestUsesCallerPage() throws { try request("pagination-previous", value: 2) }
    func testS02NextRequestUsesCallerPage() throws { try request("pagination-next", value: 4) }
    func testS02LastRequestUsesCallerPage() throws { try request("pagination-last", value: 20) }
    func testS02RepeatedDeclinedPageRequestsKeepCurrentPage() throws {
        tapControl("Toggle pager echo")
        for count in 1...2 {
            tapPage(4)
            try settle(page: 3, requests: Array(repeating: "page:4", count: count), receiptCount: count * 2)
            XCTAssertTrue(button("pagination-page-3").isSelected)
            XCTAssertFalse(button("pagination-page-4").isSelected)
        }
        try trace(["button", "page", "button", "page"], pageValues: [4, 4])
        try record("S02-two-independent-declined-contacts", targetID: "pagination-page-4")
    }
    func testS02RestoredEchoUsesTheLatestOwnerPage() throws {
        tapControl("Toggle pager echo")
        tapButton("pagination-next")
        try settle(page: 3, requests: ["page:4"], receiptCount: 2)
        tapControl("Toggle pager echo")
        tapButton("pagination-next")
        try settle(page: 4, requests: ["page:4", "page:4"], receiptCount: 4)
        tapButton("pagination-next")
        try settle(page: 5, requests: ["page:4", "page:4", "page:5"], receiptCount: 6)
        try trace(["button", "page", "button", "page", "button", "page"], pageValues: [4, 4, 5])
        try record("S02-restored-echo-current-owner", targetID: "pagination-next")
    }
    private func boundary(_ edge: String, otherBlocked: String, at: Int, back: String, next: Int) throws {
        try request(edge, value: at)
        let before = try receipts()
        blockedTouch(edge); blockedTouch(otherBlocked)
        try exact(try receipts(), before)
        try exact(try owner()["requests"], ["page:\(at)"])
        tapButton(back)
        try settle(page: next, requests: ["page:\(at)", "page:\(next)"], receiptCount: 4)
        try trace(["button", "page", "button", "page"], pageValues: [at, next])
        try record("S02-boundary-" + edge, targetID: back)
    }
    func testS02FirstBoundaryRejectsBackwardContacts() throws {
        try boundary("pagination-first", otherBlocked: "pagination-previous", at: 1, back: "pagination-next", next: 2)
    }
    func testS02LastBoundaryRejectsForwardContacts() throws {
        try boundary("pagination-last", otherBlocked: "pagination-next", at: 20, back: "pagination-previous", next: 19)
    }
    func testS02GlobalDisabledOverridesNestedPropsAndRecovers() throws {
        tapControl("Toggle pager disabled")
        for id in ["pagination-first", "pagination-previous", "pagination-next", "pagination-last", "pagination-page-3"] {
            XCTAssertFalse(button(id).isEnabled, id)
        }
        blockedTouch("pagination-next")
        try exact(try owner()["requests"], []); try exact(try receipts(), [])
        try record("S02-disabled-rejects-original-contact", targetID: "pagination-next")
        tapControl("Toggle pager disabled")
        try request("pagination-next", value: 4)
    }
    func testS02AuthoredVetoRunsBeforePageRequest() throws {
        tapControl("Toggle pager action veto")
        tapButton("pagination-next")
        try settle(page: 3, requests: [], receiptCount: 1)
        try trace(["button"], pageValues: [])
        let data = try XCTUnwrap(try receipts().first?["data"] as? [String: Any])
        try exact(data["preventedBefore"], false); try exact(data["preventedAfter"], true)
        try record("S02-original-event-veto", targetID: "pagination-next")
        tapControl("Toggle pager action veto")
        tapButton("pagination-next")
        try settle(page: 4, requests: ["page:4"], receiptCount: 3)
        try trace(["button", "button", "page"], pageValues: [4])
        try record("S02-distinct-contact-after-veto-clears", targetID: "pagination-next")
    }
    func testS01OwnerReplacementRequestsNothingAndUsesNewPage() throws {
        tapControl("Replace owner page")
        try settle(page: 8, requests: [], receiptCount: 0)
        XCTAssertTrue(button("pagination-page-8").isSelected)
        try request("pagination-next", value: 9)
    }
    func testS01EmptyDataRetainsCallerUntilExplicitRequest() throws {
        tapControl("Toggle pager empty data")
        try settle(page: 3, requests: [], receiptCount: 0)
        XCTAssertFalse(button("pagination-page-1").isSelected)
        try request("pagination-page-1", value: 1)
        for id in ["pagination-first", "pagination-previous", "pagination-next", "pagination-last"] {
            XCTAssertFalse(button(id).isEnabled, id)
        }
        let before = try receipts()
        tapControl("Toggle pager empty data")
        try exact(try receipts(), before)
        try exact(try owner()["page"], 1); try exact(try owner()["requests"], ["page:1"])
        try record("S01-empty-data-owner-retained", targetID: "pagination-page-1")
    }
    func testS12ContextChangesRetainPagingStateAndCallbacks() throws {
        try request("pagination-next", value: 4)
        let before = try receipts()
        tapControl("Toggle pager RTL"); tapControl("Toggle pager consolidation"); tapControl("Toggle pager groups")
        tapControl("Dark theme"); tapControl("Compact width")
        try exact(try receipts(), before)
        try exact(try owner()["page"], 4); try exact(try owner()["requests"], ["page:4"])
        tapButton("pagination-next")
        try settle(page: 5, requests: ["page:4", "page:5"], receiptCount: 4)
        try trace(["button", "page", "button", "page"], pageValues: [4, 5])
        try record("S12-context-retains-owned-state", targetID: "pagination-next")
    }
}
