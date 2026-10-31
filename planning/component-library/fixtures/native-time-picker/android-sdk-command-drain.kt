package com.facebook.react.fabric.mounting

import android.os.SystemClock
import android.view.View
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.fabric.mounting.mountitems.DispatchStringCommandMountItem
import com.facebook.react.fabric.mounting.mountitems.MountItem
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
import java.util.function.BooleanSupplier

private class Arguments : ReadableArray
private class Item(private val label: String, private val body: () -> Unit) : MountItem {
  override fun getSurfaceId(): Int = 1
  override fun execute(mountingManager: MountingManager) { mountingManager.trace.add(label); body() }
}
private class Listener : MountItemDispatcher.ItemDispatchListener {
  var after: (() -> Unit)? = null
  override fun willMountItems(mountItems: List<MountItem>?) {}
  override fun didMountItems(mountItems: List<MountItem>?) {}
  override fun didDispatchMountItems() { after?.invoke() }
}

fun main() {
  var checks = 0
  fun verify(value: Boolean) { check(value) { "actual SDK command drain assertion failed" }; checks++ }
  for (late in listOf(false, true)) {
    ReactNativeFeatureFlags.late = late
    val manager = MountingManager(); val listener = Listener(); val dispatcher = MountItemDispatcher(manager, listener)
    val arguments = Arguments(); var guard = true
    manager.views.add(10)
    dispatcher.addViewCommandMountItem(DispatchStringCommandMountItem(1, 10, "earlier", arguments))
    dispatcher.addPreAllocateMountItem(Item("pre") {})
    dispatcher.addMountItem(Item("mount") { manager.views.add(12) })
    val scope = dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { guard })
    val original = DispatchStringCommandMountItem(1, 12, "focus", arguments)
    dispatcher.addViewCommandMountItem(original)
    verify(scope.finishAndDrain())
    verify(scope.wasExecuted() && scope.getError().isEmpty())
    verify(manager.commands.count { it == "focus:12" } == 1 && manager.commands.count { it == "earlier:10" } == 1)
    verify(manager.argumentObjects.all { it === arguments })
    val expected = if (late) listOf("pre", "command:earlier:10", "mount", "command:focus:12") else listOf("command:earlier:10", "pre", "mount", "command:focus:12")
    verify(manager.trace == expected)
    verify(original.getRetries() == if (late) 0 else 1)
    dispatcher.tryDispatchMountItems()
    verify(manager.commands.count { it == "focus:12" } == 1)
    // Closing an old scope must not clear a newer command capture.
    val next = dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { guard }); scope.close()
    dispatcher.addViewCommandMountItem(DispatchStringCommandMountItem(1, 10, "next", arguments)); verify(next.finishAndDrain())
  }
  ReactNativeFeatureFlags.late = false
  for (failure in listOf("timeout", "guard", "surface", "waiting", "throw", "retry")) {
    SystemClock.time = 0
    val manager = MountingManager(); val dispatcher = MountItemDispatcher(manager, Listener()); var live = true
    if (failure != "retry") manager.views.add(12)
    val scope = dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { live })
    val original = DispatchStringCommandMountItem(1, 12, "focus", Arguments())
    dispatcher.addViewCommandMountItem(original)
    when (failure) {
      "timeout" -> SystemClock.time = 1000
      "guard" -> live = false
      "surface" -> manager.stopped = true
      "waiting" -> manager.waiting = true
      "throw" -> manager.failure = IllegalStateException("original SDK command failure")
    }
    verify(!scope.finishAndDrain() && scope.getError().isNotEmpty())
    val before = manager.commands.size
    SystemClock.time = 0; live = true; manager.stopped = false; manager.waiting = false; manager.failure = null; manager.views.add(12)
    dispatcher.tryDispatchMountItems(); manager.attached.forEach { it.execute(manager) }; manager.attached.clear()
    verify(manager.commands.size == before)
    if (failure == "retry") verify(original.getRetries() == 1 && before == 0)
    if (failure == "throw") verify(scope.getError() == "original SDK command failure" && before == 1)
  }
  run {
    val manager = MountingManager(); val dispatcher = MountItemDispatcher(manager, Listener())
    var captured = false
    dispatcher.addMountItem(Item("inside-mount") {
      try { dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { true }) }
      catch (failure: IllegalStateException) { captured = failure.message == "native-event-command-dispatch-reentrant" }
    }); dispatcher.tryDispatchMountItems(); verify(captured)
    val scope = dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { true }); scope.close()
    for (method in listOf("draw", "layout")) {
      var rejected = false
      val operation: () -> Unit = { try { dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { true }) }
        catch (failure: IllegalStateException) { rejected = failure.message == "native-event-command-render-stack-active" } }
      if (method == "draw") View().draw(operation) else View().layout(operation)
      verify(rejected)
    }
    UiThreadUtil.ui = false
    try { dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { true }); verify(false) }
    catch (failure: IllegalStateException) { verify(failure.message == "ui-thread-required") }
    UiThreadUtil.ui = true
  }
  run {
    val manager = MountingManager(); manager.views.add(12); val dispatcher = MountItemDispatcher(manager, Listener())
    val scope = dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { true })
    verify(!scope.finishAndDrain() && scope.getError() == "native-event-command-not-captured")
    val closed = dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { true })
    dispatcher.addViewCommandMountItem(DispatchStringCommandMountItem(1, 12, "closed", Arguments())); closed.close()
    dispatcher.tryDispatchMountItems(); verify(manager.commands.isEmpty())
    val normal = DispatchStringCommandMountItem(1, 12, "normal", Arguments())
    UiThreadUtil.ui = false; dispatcher.addViewCommandMountItem(normal); UiThreadUtil.ui = true
    dispatcher.tryDispatchMountItems(); verify(manager.commands == listOf("normal:12"))
  }
  run {
    val manager = MountingManager(); manager.views.add(12); val dispatcher = MountItemDispatcher(manager, Listener())
    val scope = dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { true })
    try { dispatcher.addViewCommandMountItem(DispatchStringCommandMountItem(2, 12, "wrong-surface", Arguments())); verify(false) }
    catch (failure: IllegalStateException) { verify(failure.message == "native-event-command-surface-mismatch") }
    dispatcher.addViewCommandMountItem(DispatchStringCommandMountItem(1, 12, "original", Arguments()))
    try { dispatcher.addViewCommandMountItem(DispatchStringCommandMountItem(1, 12, "duplicate", Arguments())); verify(false) }
    catch (failure: IllegalStateException) { verify(failure.message == "native-event-command-capture-count") }
    scope.close(); dispatcher.tryDispatchMountItems(); verify(manager.commands.isEmpty())
  }
  run {
    // The surface can detach after admission but before this original item.
    ReactNativeFeatureFlags.late = true
    val manager = MountingManager(); manager.views.add(12); val dispatcher = MountItemDispatcher(manager, Listener())
    dispatcher.addMountItem(Item("detach-before-command") { manager.waiting = true })
    val scope = dispatcher.beginNativeEventCommand(1, 1000, BooleanSupplier { true })
    dispatcher.addViewCommandMountItem(DispatchStringCommandMountItem(1, 12, "deferred", Arguments()))
    verify(!scope.finishAndDrain() && scope.getError() == "native-event-command-no-progress")
    verify(manager.attached.size == 1 && manager.commands.isEmpty())
    manager.waiting = false; manager.attached.forEach { it.execute(manager) }
    verify(manager.commands.isEmpty())
  }
  println("$checks actual Android SDK dispatcher/scope/command-item assertions passed; explicit platform/manager doubles, no native or installed verdict")
}
