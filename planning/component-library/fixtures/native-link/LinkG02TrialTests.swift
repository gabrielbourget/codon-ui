import XCTest

// Existing showcase UI-test target; main owns each admission and the matching genuine SDK witnesses.
final class LinkG02TrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let sceneSHA = "2e46badbba1cf12df3881c3b30221162ad7f8d9a8f7ea714c30db18f58471ce3"
    private let originalHref = "codon-lab-unhandled://destination?value=0&empty="

    override func setUpWithError() throws {
        continueAfterFailure = false
        guard ProcessInfo.processInfo.environment["CODON_LINK_SCENE_SHA256"] == sceneSHA else {
            XCTFail("Bind the unchanged LinkScene fixture")
            throw NSError(domain: "LinkG02Admission", code: 1)
        }
        for key in ["CODON_LINK_PRODUCT_SHA256", "CODON_LINK_INPUT_MANIFEST_SHA256",
                    "CODON_LINK_SDK_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression), "Invalid " + key)
        }
        // Main prelaunches the matched product and prepares a fresh default Link scene per method.
        // No replacement launch, target warm-up, action retry or implicit failure-path reset.
        guard [.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(app.state) else {
            XCTFail("Coordinator must prelaunch the matched product")
            throw NSError(domain: "LinkG02Admission", code: 2)
        }
        if app.state != .runningForeground { app.activate() }
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        XCTAssertLessThan(app.windows.firstMatch.frame.width, app.windows.firstMatch.frame.height)
        XCTAssertFalse(app.keyboards.firstMatch.exists, "Admit the keyboard-inactive touch condition")
        let initial = try owner()
        for key in ["visited", "echo", "handoff", "disabled", "armed"] { try exact(initial[key], false) }
        try exact(initial["requests"], 0); try exact(initial["errors"], 0)
        try exact(initial["last"], NSNull()); try exact(initial["lastError"], "none")
        try exact(initial["href"], originalHref); try exact(initial["relationships"], "none")
    }

    override func tearDownWithError() throws {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = "link-g02-final-screen"; image.lifetime = .keepAlways; add(image)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "link-g02-final-hierarchy"; tree.lifetime = .keepAlways; add(tree)
    }

    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private var link: XCUIElement { node("link-example") }
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
    private func control(_ label: String) {
        let target = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: 10)); reveal(target); target.tap()
    }
    private func rawState() throws -> String {
        let state = node("link-state")
        XCTAssertTrue(state.exists, "Missing existing Link scene state")
        return state.label
    }
    private func owner() throws -> [String: Any] {
        let raw = try rawState()
        func capture(_ pattern: String) throws -> String {
            let regex = try NSRegularExpression(pattern: pattern)
            let found = try XCTUnwrap(regex.firstMatch(in: raw, range: NSRange(location: 0, length: (raw as NSString).length)),
                                      "Missing existing state field: " + pattern + " in " + raw)
            return (raw as NSString).substring(with: found.range(at: 1))
        }
        func flag(_ label: String) throws -> Bool { try capture(label + ": (true|false)\\.") == "true" }
        func integer(_ label: String) throws -> Int { try XCTUnwrap(Int(try capture(label + ": ([0-9]+)\\."))) }
        func jsonString(_ value: String) throws -> String {
            try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(value.utf8), options: .fragmentsAllowed) as? String)
        }
        let last = try capture("Last: (.*?)\\. Errors:")
        var result: [String: Any] = [
            "visited": try flag("Visited"), "echo": try flag("Echo"), "handoff": try flag("Handoff"),
            "disabled": try flag("Disabled"), "armed": try flag("Armed guard"),
            "requests": try integer("Requests"), "errors": try integer("Errors"),
            "href": try jsonString(try capture("Target: (.*?)\\. Relationships:")),
            "lastError": try capture("Last error: (.*?)\\. Target:"),
            "relationships": try capture("Relationships: (.*?)\\. Description target:")
        ]
        if last == "none" { result["last"] = NSNull() }
        else { result["last"] = try jsonString(last) }
        return result
    }
    private func exact(_ actual: Any?, _ expected: Any) throws {
        let value = try XCTUnwrap(actual)
        let lhs = try JSONSerialization.data(withJSONObject: ["value": value], options: .sortedKeys)
        let rhs = try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys)
        XCTAssertEqual(String(decoding: lhs, as: UTF8.self), String(decoding: rhs, as: UTF8.self))
    }
    private func outcome(requests: Int, visited: Bool, disabled: Bool = false) throws {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (try? self.owner()["requests"] as? Int) == requests &&
            (try? self.owner()["visited"] as? Bool) == visited &&
            (try? self.owner()["disabled"] as? Bool) == disabled
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 10), .completed,
                       "Original input did not produce the required owner outcome")
        let row = try owner()
        try exact(row["requests"], requests); try exact(row["visited"], visited)
        try exact(row["disabled"], disabled); try exact(row["errors"], 0)
    }
    private func record(_ stage: String) throws {
        let frame = link.frame, window = app.windows.firstMatch.frame
        let payload: [String: Any] = [
            "stage": stage, "sceneSHA256": sceneSHA, "owner": try owner(), "rawState": try rawState(),
            "targetID": "link-example", "targetLabel": link.label, "targetEnabled": link.isEnabled,
            "targetFrame": [frame.minX, frame.minY, frame.width, frame.height],
            "windowFrame": [window.minX, window.minY, window.width, window.height],
            "keyboardActive": app.keyboards.firstMatch.exists, "capturedAt": Date().timeIntervalSince1970,
            "scope": "Existing scene state and public XCTest outcomes; original SDK event identity, receiver, timing, URL-call and lifetime evidence is independently required"
        ]
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: payload,
                                  options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
        attachment.name = stage; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func touch(requests: Int, visited: Bool = false) throws {
        let href = try XCTUnwrap(try owner()["href"] as? String)
        try exact(try owner()["handoff"], false)
        reveal(link); XCTAssertTrue(link.isEnabled); link.tap()
        try outcome(requests: requests, visited: visited)
        try exact(try owner()["last"], href)
        try record("S02-intercepted-contact-\(requests)")
    }
    private func destination(_ steps: Int, href: String) throws {
        for _ in 0..<steps { control("Next link destination") }
        try outcome(requests: 0, visited: false)
        try exact(try owner()["href"], href)
        try touch(requests: 1); try touch(requests: 2)
    }

    func testS02FirstInterceptedTouchKeepsControlledFalse() throws { try touch(requests: 1) }
    func testS02RepeatedInterceptedTouchesDoNotInventVisitedState() throws {
        try touch(requests: 1); try touch(requests: 2)
    }
    func testS01DirectOwnerVisitedReplacementMakesNoNavigationRequest() throws {
        control("Toggle link owner visited")
        try outcome(requests: 0, visited: true)
        try touch(requests: 1, visited: true)
        control("Toggle link owner visited")
        try outcome(requests: 1, visited: false)
        try touch(requests: 2)
    }
    func testS02ExplicitOwnerEchoChangesVisitedOnTheFirstContact() throws {
        control("Toggle link visited echo")
        try exact(try owner()["echo"], true)
        try touch(requests: 1, visited: true)
        try touch(requests: 2, visited: true)
    }
    func testS02EmptyDestinationVetoRetainsTheExactEmptyString() throws { try destination(1, href: "") }
    func testS02FragmentDestinationVetoRetainsTheExactFragment() throws { try destination(2, href: "#section") }
    func testS02RelativeDestinationVetoRetainsTheExactRelativeString() throws { try destination(3, href: "/relative") }
    func testS02DestinationReplacementUsesTheLatestOwnerString() throws {
        try touch(requests: 1)
        control("Next link destination"); control("Next link destination")
        try outcome(requests: 1, visited: false)
        try exact(try owner()["href"], "#section")
        try exact(try owner()["last"], originalHref)
        try touch(requests: 2)
    }
    func testS02DisabledGuardAndFirstReenabledContact() throws {
        control("Toggle link disabled")
        reveal(link, allowDisabled: true); XCTAssertFalse(link.isEnabled)
        link.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        try outcome(requests: 0, visited: false, disabled: true)
        try record("S02-disabled-original-contact")
        control("Toggle link disabled")
        try touch(requests: 1)
    }
    func testS02PressStartGuardCancelsTheCurrentContactAndRecovers() throws {
        control("Arm link disable during press")
        reveal(link); link.tap()
        try outcome(requests: 0, visited: false, disabled: true)
        try exact(try owner()["armed"], false)
        try record("S02-owner-disabled-at-press-in")
        control("Toggle link disabled")
        try touch(requests: 1)
    }
    func testS02OriginalContactCancelledOutsideTheTargetDoesNotAct() throws {
        reveal(link)
        let window = app.windows.firstMatch
        let outside = CGPoint(x: window.frame.minX + 2, y: window.frame.minY + 2)
        XCTAssertFalse(link.frame.contains(outside))
        let destination = window.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: outside.x - window.frame.minX, dy: outside.y - window.frame.minY))
        link.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.1, thenDragTo: destination)
        try outcome(requests: 0, visited: false)
        try record("S02-original-drag-cancellation")
        try touch(requests: 1)
    }
    func testS01RelationshipChangesDoNotRequestNavigation() throws {
        control("Next link relationships")
        control("Toggle link relationship text"); control("Toggle link description target")
        control("Next link relationships"); control("Next link relationships"); control("Next link relationships")
        try outcome(requests: 0, visited: false)
        try exact(try owner()["relationships"], "none")
        try record("S01-metadata-does-not-invent-navigation")
        try touch(requests: 1)
    }
    func testS12LiveContextChangesRetainOwnerAndNavigationCount() throws {
        try touch(requests: 1)
        control("Dark theme"); control("Compact width"); control("Next link order")
        try outcome(requests: 1, visited: false)
        try exact(try owner()["last"], originalHref)
        try touch(requests: 2)
    }
    func testS02DisabledGuardBlocksAnEnabledHandoff() throws {
        control("Toggle native URL handoff"); control("Toggle link disabled")
        try exact(try owner()["handoff"], true)
        reveal(link, allowDisabled: true); XCTAssertFalse(link.isEnabled)
        link.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        try outcome(requests: 0, visited: false, disabled: true)
        try record("S02-disabled-no-URL-call-required")
    }
    func testS02PressStartGuardBlocksAnEnabledHandoff() throws {
        control("Toggle native URL handoff"); control("Arm link disable during press")
        try exact(try owner()["handoff"], true)
        reveal(link); link.tap()
        try outcome(requests: 0, visited: false, disabled: true)
        try exact(try owner()["armed"], false)
        try record("S02-press-start-disabled-no-URL-call-required")
    }
}
