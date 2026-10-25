package com.codonui.input;

import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.ViewGroup;
import com.facebook.react.ReactRootView;
import com.facebook.react.config.ReactFeatureFlags;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.EventDispatcher;
import android.view.View;
import android.view.ViewTreeObserver;
import android.os.SystemClock;
import com.facebook.react.fabric.mounting.NativeEventCommandScope;
import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.views.textinput.ReactEditText;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.WeakHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

@DoNotStrip
final class CUIFieldInputBinding {
  interface Snapshot { JSONObject read() throws Exception; }
  private static final WeakHashMap<CUIFieldInputBinding, Boolean> bindings = new WeakHashMap<>();
  private static final ThreadLocal<KeyEvent> currentDefault = new ThreadLocal<>();
  private final WeakReference<CUIFormMetadataView> metadata;
  private final WeakReference<FabricUIManager> manager;
  private final Snapshot snapshot;
  private final JSONObject registration;
  private JSONObject status;
  private long statusGeneration;
  private boolean statusPublished;
  private WeakReference<View> outer = new WeakReference<>(null), input = new WeakReference<>(null);
  private String outerInstance = "", inputInstance = "", bindingId = "", ownerId = "", lease = "", fingerprint = "", lastError = "";
  private long epoch = 1, eventId;
  private boolean closed, capturing;
  private final HashSet<Integer> consumed = new HashSet<>();
  private static native String nativeDispatchFieldKey(FabricUIManager manager, CUIFieldInputBinding binding,
    String document, String snapshot, String key, String declarations, double epoch);
  private static native String nativeEmitOwnedInput(FabricUIManager manager, CUIFieldInputBinding binding,
    String document, String snapshot, String input, String declarations, double epoch, Runnable emit);
  private static native void nativeRecordFieldInput(String lease, String encoded);
  private static native void nativeRetireBinding(String lease, String owner, String binding);
  private static native String nativeEmitFieldPointer(FabricUIManager manager, CUIFieldInputBinding owner,
    String document, Runnable emit);
  private CUIFieldPointerDispatcher pointerDispatcher;
  static final class PointerDecision {
    final boolean admitted, prevented;
    PointerDecision(boolean admitted, boolean prevented) { this.admitted = admitted; this.prevented = prevented; }
  }
  static PointerDecision dispatchPointer(ViewGroup originalRoot, MotionEvent event) {
    UiThreadUtil.assertOnUiThread();
    if (ReactFeatureFlags.dispatchPointerEvents) return new PointerDecision(false, false);
    // The outer keyboard scope owns the original physical dispatch. Descendant
    // roots must not redispatch a MotionEvent Android may have transformed.
    for (View ancestor = originalRoot.getParent() instanceof View ? (View)originalRoot.getParent() : null;
         ancestor != null; ancestor = ancestor.getParent() instanceof View ? (View)ancestor.getParent() : null)
      if (ancestor instanceof CUIKeyboardScope) return new PointerDecision(false, false);
    ViewGroup surface = pointerSurface(originalRoot);
    if (surface == null) return new PointerDecision(false, false);
    CUIFieldInputBinding selected = null;
    try {
      for (CUIFieldInputBinding binding : new ArrayList<>(bindings.keySet())) {
        View root = binding.outer.get();
        if (binding.closed || root == null || pointerSurface(root) != surface || binding.capture() == null ||
            (root != originalRoot && !(originalRoot instanceof CUIKeyboardScope))) continue;
        selected = binding;
        break;
      }
      // The original SDK must see outside phases too, to retire its down path
      // and preserve primary/multi-pointer data. Only field targets are emitted.
      return selected == null ? new PointerDecision(false, false) : selected.emitPointer(originalRoot, event);
    } catch (Exception error) {
      if (selected != null) selected.record("pointer-failure", String.valueOf(error.getMessage()));
      return new PointerDecision(false, false);
    }
  }
  private static ViewGroup pointerSurface(View original) {
    for (View view = original; view != null; view = view.getParent() instanceof View ? (View)view.getParent() : null)
      if (view instanceof ReactRootView) return (ViewGroup)view;
    return null;
  }
  private PointerDecision emitPointer(ViewGroup originalRoot, MotionEvent event) throws Exception {
    JSONObject value = capture(); FabricUIManager manager = this.manager.get();
    if (value == null || manager == null) return new PointerDecision(false, false);
    int action = event.getActionMasked();
    if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN || action == MotionEvent.ACTION_BUTTON_PRESS)
      CUIInputWindow.record(originalRoot, "pointer");
    ViewGroup surface = pointerSurface(originalRoot);
    EventDispatcher events = UIManagerHelper.getEventDispatcherForReactTag((com.facebook.react.bridge.ReactContext)originalRoot.getContext(), originalRoot.getId());
    if (surface == null || events == null) throw new IllegalStateException("field-input-original-pointer-dispatcher-unavailable");
    final CUIFieldPointerDispatcher dispatcher = CUIFieldPointerDispatcher.forSurface(surface, events);
    pointerDispatcher = dispatcher;
    java.util.Set<Integer> members = new java.util.HashSet<>();
    JSONObject document = new JSONObject(value.getString("encodedDocument"));
    for (CUIFieldInputBinding binding : new ArrayList<>(bindings.keySet())) {
      View root = binding.outer.get(); JSONObject current = binding.capture();
      if (current == null || root == null || pointerSurface(root) != surface || binding.manager.get() != manager || !binding.lease.equals(lease)) continue;
      binding.pointerDispatcher = dispatcher;
      JSONObject currentDocument = new JSONObject(current.getString("encodedDocument"));
      if (currentDocument.getInt("surfaceId") != document.getInt("surfaceId"))
        throw new IllegalStateException("field-input-pointer-surface-ambiguous");
      JSONObject plan = currentDocument.getJSONObject("fieldGroup");
      members.add(plan.getInt("outerTarget"));
      JSONArray nodes = plan.getJSONArray("nodes");
      for (int index = 0; index < nodes.length(); index++) members.add(nodes.getJSONObject(index).getInt("target"));
    }
    CUIOriginalInputEmission emission = new CUIOriginalInputEmission(() -> dispatcher.dispatch(event, members));
    String receipt;
    try {
      receipt = nativeEmitFieldPointer(manager, this, document.put("pointerMembers", new JSONArray(members)).toString(), emission);
    } catch (Exception failure) {
      emission.rethrowOriginalFailure();
      if (!emission.wasInvoked()) emission.run();
      throw failure;
    }
    if (receipt.isEmpty()) return new PointerDecision(false, false);
    JSONObject record = new JSONObject(receipt); emitRecord(record.toString());
    return new PointerDecision(true, record.getBoolean("originalDefaultPrevented"));
  }
  private static native boolean nativeOriginalCommandCurrent(long token);
  private static native String nativePerformOriginalCommand(long token);

  CUIFieldInputBinding(CUIFormMetadataView metadata, FabricUIManager manager, JSONObject registration, View outer, View input, Snapshot snapshot) throws Exception {
    UiThreadUtil.assertOnUiThread();
    this.metadata = new WeakReference<>(metadata); this.manager = new WeakReference<>(manager); this.snapshot = snapshot;
    this.registration = new JSONObject(registration.toString()); this.status = this.registration;
    this.outer = new WeakReference<>(outer); this.input = new WeakReference<>(input);
    bindingId = registration.getString("bindingId"); ownerId = registration.getString("ownerId"); lease = registration.getString("moduleLease");
    bindings.put(this, true);
  }
  JSONObject registrationReceipt() throws Exception {
    return new JSONObject().put("requestId", registration.getString("requestId"))
      .put("ownerToken", registration.getString("ownerToken")).put("metadataTarget", registration.getInt("metadataTarget"))
      .put("status", new JSONObject(status.toString()));
  }
  private void publishReadiness(boolean ready, String error) {
    try {
      CUIFormMetadataView original = metadata.get();
      JSONObject declaration = null;
      try { if (original != null && !original.fieldGroupBinding.isEmpty()) declaration = new JSONObject(original.fieldGroupBinding); }
      catch (org.json.JSONException invalidDeclaration) { /* A failed capture retains the last admitted identity. */ }
      boolean originalDeclaration = original != null && declaration != null && original.ownerId.equals(registration.getString("ownerId")) &&
        declaration.optString("ownerId").equals(registration.getString("ownerId")) &&
        declaration.optString("moduleLease").equals(registration.getString("moduleLease")) &&
        declaration.optString("bindingId").equals(registration.getString("bindingId"));
      String revision = originalDeclaration ? declaration.optString("bindingRevision", status.getString("bindingRevision")) : status.getString("bindingRevision");
      if (statusPublished && status.getString("bindingRevision").equals(revision) && status.getBoolean("ready") == ready) return;
      status = new JSONObject(registration.toString()).put("bindingRevision", revision).put("generation", ++statusGeneration)
        .put("ready", ready).put("error", error);
      statusPublished = true; emitRecord(status.toString());
    } catch (org.json.JSONException invalid) { throw new IllegalStateException("field-input-status-invalid", invalid); }
  }
  private JSONObject capture() {
    if (closed || capturing || metadata.get() == null || manager.get() == null) return null;
    capturing = true;
    try {
      CUIFormMetadataView metadata = this.metadata.get(); FabricUIManager manager = this.manager.get();
      JSONObject declaration = new JSONObject(metadata.fieldGroupBinding);
      if (!metadata.ownerId.equals(registration.getString("ownerId")) ||
          !declaration.getString("ownerId").equals(registration.getString("ownerId")) ||
          !declaration.getString("moduleLease").equals(registration.getString("moduleLease")) ||
          !declaration.getString("bindingId").equals(registration.getString("bindingId")))
        throw new IllegalStateException("field-input-original-binding-retired");
      JSONObject value = snapshot.read();
      JSONObject current = value.getJSONObject("fieldGroupSnapshot");
      if ((!bindingId.isEmpty() && !bindingId.equals(declaration.getString("bindingId"))) ||
          (!ownerId.isEmpty() && !ownerId.equals(declaration.getString("ownerId")))) throw new IllegalStateException("field-input-original-binding-retired");
      View outer = manager.resolveView(declaration.getInt("outerTarget")), input = manager.resolveView(declaration.getInt("inputTarget"));
      if (outer == null || input == null || outer != this.outer.get() || input != this.input.get() || (!outerInstance.isEmpty() && !outerInstance.equals(current.getString("outerInstance"))) ||
          (!inputInstance.isEmpty() && !inputInstance.equals(current.getString("inputInstance"))))
        throw new IllegalStateException("field-input-original-root-instance-retired");
      String fingerprint = new JSONArray().put(value.getString("documentId")).put(value.getInt("surfaceId"))
        .put(current.getString("windowId")).put(current.getString("outerInstance")).put(current.getString("inputInstance"))
        .put(metadata.fieldGroupBinding).put(metadata.ownedEditorBinding).toString();
      if (!this.fingerprint.isEmpty() && !this.fingerprint.equals(fingerprint)) { retirePending(); epoch++; }
      this.fingerprint = fingerprint; this.outer = new WeakReference<>(outer); this.input = new WeakReference<>(input);
      outerInstance = current.getString("outerInstance"); inputInstance = current.getString("inputInstance");
      bindingId = declaration.getString("bindingId"); ownerId = declaration.getString("ownerId"); lease = declaration.getString("moduleLease");
      lastError = ""; publishReadiness(true, ""); return value;
    } catch (Exception error) {
      retirePending();
      lastError = String.valueOf(error.getMessage());
      publishReadiness(false, lastError);
      return null;
    } finally { capturing = false; }
  }
  void refresh() { if (!closed && !capturing) capture(); }
  private void record(String kind, String error) {
    try { emitRecord(new JSONObject().put("kind", kind).put("error", error).toString()); }
    catch (Exception ignored) { /* The original native failure remains the decision. */ }
  }
  private void emitRecord(String encoded) {
    if (!lease.isEmpty()) nativeRecordFieldInput(lease, encoded);
    CUIFormMetadataView original = metadata.get();
    if (original != null) original.emitFieldInputRecord(encoded);
  }
  private void retirePending() {
    if (!lease.isEmpty() && !bindingId.isEmpty()) nativeRetireBinding(lease, ownerId, bindingId);
    consumed.clear();
  }
  void retire() { if (closed) return; publishReadiness(false, "field-input-registration-retired"); closed = true; retirePending(); bindings.remove(this); }
  private static boolean descendant(View view, View root) {
    if (root == null) return false;
    for (View current = view; current != null; current = current.getParent() instanceof View ? (View)current.getParent() : null)
      if (current == root) return true;
    return false;
  }
  private static boolean containsTarget(JSONObject value, int target) throws Exception {
    if (value == null) return false;
    JSONObject group = new JSONObject(value.getString("encodedDocument")).getJSONObject("fieldGroup");
    if (group.getInt("outerTarget") == target) return true;
    JSONArray nodes = group.getJSONArray("nodes");
    for (int index = 0; index < nodes.length(); index++)
      if (nodes.getJSONObject(index).getInt("target") == target) return true;
    return false;
  }
  static boolean inDefault(KeyEvent event) { return currentDefault.get() == event; }
  static KeyEvent beginDefault(KeyEvent event) {
    KeyEvent previous = currentDefault.get(); currentDefault.set(event); return previous;
  }
  static void endDefault(KeyEvent event, KeyEvent previous) {
    if (currentDefault.get() != event) return;
    if (previous == null) currentDefault.remove(); else currentDefault.set(previous);
  }
  static final class Decision {
    final CUIFieldInputBinding owner;
    final boolean prevented;
    final JSONObject record;
    Decision(CUIFieldInputBinding owner, boolean prevented, JSONObject record) { this.owner = owner; this.prevented = prevented; this.record = record; }
    void finish(boolean invoked, boolean handled, String error) {
      try {
        record.put("originalDefaultInvoked", invoked).put("originalDefaultReturned", invoked && error.isEmpty())
          .put("originalDispatchHandled", handled).put("originalDefaultError", error);
        owner.emitRecord(record.toString());
      }
      catch (Exception failure) { owner.record("failure", String.valueOf(failure.getMessage())); }
    }
  }
  static void emitOwnedInput(View original, Runnable emit) {
    UiThreadUtil.assertOnUiThread();
    CUIFieldInputBinding selected = null;
    JSONArray declarations = new JSONArray();
    try {
      for (CUIFieldInputBinding candidate : new ArrayList<>(bindings.keySet())) {
        JSONObject value = candidate.capture(); View outer = candidate.outer.get();
        if (value == null || outer == null || !original.isFocused() ||
            value.getJSONObject("fieldGroupSnapshot").getInt("eventFocusedTarget") != original.getId()) continue;
        declarations.put(new JSONObject().put("encodedDocument", value.getString("encodedDocument"))
          .put("snapshot", value.getJSONObject("fieldGroupSnapshot")).put("epoch", candidate.epoch));
        if (selected != null && selected.outer.get() == outer) throw new IllegalStateException("field-input-original-group-ambiguous");
        if (selected == null || containsTarget(selected.capture(), outer.getId())) selected = candidate;
      }
    } catch (Exception error) {
      if (selected != null) selected.record("failure", String.valueOf(error.getMessage()));
      emit.run(); return;
    }
    if (selected == null) { emit.run(); return; }
    selected.emitOriginalInput(original, emit, declarations);
  }
  private void emitOriginalInput(View original, Runnable emit, JSONArray declarations) {
    // The guard records invocation, including a throwing original emitter. A
    // capture/delivery failure must never invoke that original emitter twice.
    CUIOriginalInputEmission emission = new CUIOriginalInputEmission(emit);
    try {
      JSONObject value = capture(); FabricUIManager manager = this.manager.get();
      if (value == null || manager == null) { emission.run(); return; }
      JSONObject input = new JSONObject().put("target", original.getId()).put("eventId", ++eventId);
      String receipt = nativeEmitOwnedInput(manager, this, value.getString("encodedDocument"),
        value.getJSONObject("fieldGroupSnapshot").toString(), input.toString(), declarations.toString(), epoch,
        emission);
      if (!receipt.isEmpty()) emitRecord(receipt);
    } catch (Exception error) {
      record("failure", String.valueOf(error.getMessage()));
      emission.rethrowOriginalFailure();
      if (!emission.wasInvoked()) emission.run();
    }
  }
  static Decision dispatch(View window, KeyEvent event, View focused) {
    UiThreadUtil.assertOnUiThread();
    CUIFieldInputBinding selected = null;
    ArrayList<CUIFieldInputBinding> candidates = new ArrayList<>(bindings.keySet());
    JSONArray declarations = new JSONArray();
    for (CUIFieldInputBinding binding : candidates) {
      JSONObject value = binding.capture(); View outer = binding.outer.get();
      try {
        if (value == null || outer == null || outer.getRootView() != window.getRootView() ||
            value.getJSONObject("fieldGroupSnapshot").getInt("eventFocusedTarget") != focused.getId()) continue;
        declarations.put(new JSONObject().put("encodedDocument", value.getString("encodedDocument"))
          .put("snapshot", value.getJSONObject("fieldGroupSnapshot")).put("epoch", binding.epoch));
        if (selected != null && selected.outer.get() == outer) return null;
        if (selected == null || containsTarget(selected.capture(), outer.getId())) selected = binding;
      } catch (Exception error) { binding.record("failure", String.valueOf(error.getMessage())); }
    }
    if (selected == null) return null;
    return selected.dispatch(event, focused, declarations);
  }
  private Decision dispatch(KeyEvent event, View focused, JSONArray declarations) {
    try {
      JSONObject value = capture(); FabricUIManager manager = this.manager.get();
      if (value == null || manager == null ||
          value.getJSONObject("fieldGroupSnapshot").getInt("eventFocusedTarget") != focused.getId()) return null;
      boolean down = event.getAction() == KeyEvent.ACTION_DOWN;
      boolean intrinsic = consumed.contains(event.getKeyCode());
      if (down && focused instanceof CUIFocusView) intrinsic = ((CUIFocusView)focused).capturesObservedKey(event);
      if (down && intrinsic) consumed.add(event.getKeyCode());
      if (!down) consumed.remove(event.getKeyCode());
      int unicode = event.getUnicodeChar();
      String characters = unicode > 0 && Character.isValidCodePoint(unicode) ? new String(Character.toChars(unicode)) : "";
      JSONObject key = new JSONObject().put("kind", "keyboard").put("ownerId", ownerId).put("target", focused.getId())
        .put("key", CUIInputWindow.keyName(event)).put("nativeCode", event.getKeyCode()).put("characters", characters)
        .put("phase", down ? "down" : "up").put("repeat", down && event.getRepeatCount() > 0).put("cancelled", event.isCanceled())
        .put("shiftKey", event.isShiftPressed()).put("altKey", event.isAltPressed()).put("ctrlKey", event.isCtrlPressed()).put("metaKey", event.isMetaPressed())
        .put("capsLock", event.isCapsLockOn()).put("nativeModifierData", Integer.toUnsignedString(event.getMetaState()))
        .put("nativeDefaultHandled", intrinsic).put("timestamp", event.getEventTime()).put("eventId", ++eventId)
        .put("nativeScanCode", event.getScanCode()).put("nativeDeviceId", event.getDeviceId()).put("nativeSource", event.getSource())
        .put("nativeFlags", event.getFlags()).put("nativeDownTime", event.getDownTime())
        .put("code", CUIPhysicalKey.code(event.getKeyCode())).put("location", CUIPhysicalKey.location(event.getKeyCode()));
      JSONObject record = new JSONObject(nativeDispatchFieldKey(manager, this, value.getString("encodedDocument"),
        value.getJSONObject("fieldGroupSnapshot").toString(), key.toString(), declarations.toString(), epoch));
      return new Decision(this, intrinsic || record.getBoolean("originalDefaultPrevented"), record);
    } catch (Exception error) { record("failure", String.valueOf(error.getMessage())); return null; }
  }
  @DoNotStrip
  String mountWitness() throws Exception {
    CUIFormMetadataView original = metadata.get();
    JSONObject mount = original == null ? null : original.formMountSnapshot();
    return mount == null ? "unmounted" : mount.toString();
  }
  @DoNotStrip
  String currentSnapshot() throws Exception {
    JSONObject value = capture();
    if (value == null) throw new IllegalStateException("field-input-current-snapshot-retired");
    return value.toString();
  }
  private CUIFieldInputBinding scopeOwner(int target) throws Exception {
    View originalOuter = outer.get();
    CUIFieldInputBinding found = null;
    for (CUIFieldInputBinding binding : new ArrayList<>(bindings.keySet())) {
      View root = binding.outer.get();
      if (binding.closed || root == null || originalOuter == null || root.getId() != target ||
          root.getRootView() != originalOuter.getRootView() || !binding.lease.equals(lease)) continue;
      if (found != null) throw new IllegalStateException("field-input-original-group-ambiguous");
      found = binding;
    }
    if (found == null) throw new IllegalStateException("field-input-original-scope-retired");
    return found;
  }
  @DoNotStrip
  String currentScopeSnapshot(int target) throws Exception {
    CUIFieldInputBinding selected = scopeOwner(target);
    JSONObject value = selected.capture();
    if (value == null) throw new IllegalStateException("field-input-current-scope-retired");
    return value.put("scopeEpoch", selected.epoch).toString();
  }
  @DoNotStrip
  CUIFieldInputBinding currentPointerOwner(int target) throws Exception {
    UiThreadUtil.assertOnUiThread();
    FabricUIManager manager = this.manager.get();
    ViewGroup surface = pointerDispatcher == null ? null : pointerDispatcher.surface();
    if (surface == null || manager == null) return null;
    CUIFieldInputBinding selected = null;
    JSONObject value = null;
    for (CUIFieldInputBinding candidate : new ArrayList<>(bindings.keySet())) {
      View root = candidate.outer.get(); JSONObject current = candidate.capture();
      if (current == null || root == null || candidate.manager.get() != manager || !candidate.lease.equals(lease) ||
          pointerSurface(root) != surface || !containsTarget(current, target)) continue;
      if (selected != null && selected.outer.get() == root) throw new IllegalStateException("field-input-original-group-ambiguous");
      if (selected == null || containsTarget(value, root.getId())) { selected = candidate; value = current; }
    }
    return selected;
  }
  @DoNotStrip
  String currentPointerSnapshot(int target) throws Exception {
    UiThreadUtil.assertOnUiThread();
    FabricUIManager manager = this.manager.get();
    JSONObject value = capture(); View root = outer.get();
    if (value == null || root == null || manager == null || !containsTarget(value, target)) return "";
    int nativeTarget = 0;
    JSONArray instances = value.getJSONObject("fieldGroupSnapshot").getJSONArray("instances");
    for (int index = 0; index < instances.length(); index++) {
      JSONObject instance = instances.getJSONObject(index);
      if (instance.getInt("target") == target) { nativeTarget = instance.getInt("nativeTarget"); break; }
    }
    if (nativeTarget <= 0) return "";
    View original = manager.resolveView(nativeTarget);
    if (original == null || original.getRootView() != root.getRootView() || !containsTarget(value, target)) return "";
    JSONArray declarations = new JSONArray();
    for (CUIFieldInputBinding binding : new ArrayList<>(bindings.keySet())) {
      View ancestor = binding.outer.get(); JSONObject current = binding.capture();
      if (ancestor == null || current == null || binding.manager.get() != manager || !binding.lease.equals(lease) || ancestor.getRootView() != root.getRootView() ||
          !containsTarget(current, target)) continue;
      declarations.put(new JSONObject().put("encodedDocument", current.getString("encodedDocument"))
        .put("snapshot", current.getJSONObject("fieldGroupSnapshot")).put("epoch", binding.epoch));
    }
    return value.put("scopeEpoch", epoch).put("pointerEventId", ++eventId).put("pointerDeclarations", declarations).toString();
  }
  @DoNotStrip
  void checkCommandBoundary(int surface) {
    UiThreadUtil.assertOnUiThread();
    FabricUIManager manager = this.manager.get();
    if (manager == null) throw new IllegalStateException("field-input-command-manager-retired");
    manager.checkNativeEventCommandBoundary(surface);
  }
  @DoNotStrip
  String executeOriginalCommand(String encoded, long token, long remaining) throws Exception {
    UiThreadUtil.assertOnUiThread();
    JSONObject request = new JSONObject(encoded), before = capture();
    FabricUIManager manager = this.manager.get();
    View root = outer.get();
    if (before == null || manager == null || root == null || !root.isAttachedToWindow() || !root.hasWindowFocus())
      throw new IllegalStateException("field-input-command-window-retired");
    View original = manager.resolveView(request.getInt("target"));
    final long expectedEpoch = epoch;
    if (original == null || !original.isAttachedToWindow() || original.getRootView() != root.getRootView() || remaining <= 0 || remaining > 1000)
      throw new IllegalStateException("field-input-command-target-retired");
    java.util.function.BooleanSupplier current = () -> {
      try {
        return !closed && epoch == expectedEpoch && outer.get() == root && root.isAttachedToWindow() && root.hasWindowFocus() &&
          original.isAttachedToWindow() && original.getRootView() == root.getRootView() && manager.resolveView(original.getId()) == original &&
          capture() != null && nativeOriginalCommandCurrent(token);
      } catch (Exception error) { return false; }
    };
    String error;
    boolean executed, callbackCompleted;
    try (NativeEventCommandScope scope = manager.beginNativeEventCommand(request.getInt("surfaceId"), SystemClock.uptimeMillis() + remaining, current)) {
      error = nativePerformOriginalCommand(token);
      callbackCompleted = error.isEmpty();
      if (error.isEmpty() && !scope.finishAndDrain()) error = scope.getError();
      executed = scope.wasExecuted();
    }
    JSONObject after = capture();
    boolean live = current.getAsBoolean();
    if (!live && error.isEmpty()) error = "field-input-command-scope-retired-after-execution";
    JSONObject record = new JSONObject().put("kind", "command-native").put("target", original.getId())
      .put("command", request.getString("command")).put("callbackCompleted", callbackCompleted).put("nativeItemReturned", executed).put("current", live).put("error", error)
      .put("before", before.getJSONObject("fieldGroupSnapshot")).put("after", after == null ? JSONObject.NULL : after.getJSONObject("fieldGroupSnapshot"));
    emitRecord(record.toString());
    return record.toString();
  }
  @DoNotStrip
  String focus(String encoded) throws Exception {
    JSONObject request = new JSONObject(encoded);
    return scopeOwner(request.getInt("scopeTarget")).focusOriginal(request);
  }
  private String focusOriginal(JSONObject request) {
    try {
      JSONObject value = capture();
      FabricUIManager manager = this.manager.get();
      if (value == null || manager == null || request.getLong("epoch") != epoch) throw new IllegalStateException("field-input-focus-binding-retired");
      int target = request.getInt("target");
      JSONObject expected = request.getJSONObject("original");
      View original = manager.resolveView(target), outer = this.outer.get();
      if (original == null || !descendant(original, outer) || !CUIFieldGroupDocument.matchesOriginal(manager, expected, original))
        throw new IllegalStateException("field-input-focus-original-retired");
      boolean alreadyFocused = original.isFocused();
      if (alreadyFocused) return new JSONObject().put("requested", false).put("observed", true).put("current", true).put("target", target)
        .put("nativeInstance", expected.getString("nativeInstance")).put("editorInstance", expected.getString("editorInstance")).put("error", "").toString();
      final boolean[] observed = {alreadyFocused};
      ViewTreeObserver observer = outer.getViewTreeObserver();
      ViewTreeObserver.OnGlobalFocusChangeListener listener = (previous, next) -> { if (next == original) observed[0] = true; };
      observer.addOnGlobalFocusChangeListener(listener);
      Object commandResult = JSONObject.NULL;
      try {
        if (original instanceof CUIDateSegment) commandResult = ((CUIDateSegment)original).requestFormSegmentFocus(expected.getJSONObject("segment"));
        else if (original instanceof ReactEditText) ((ReactEditText)original).requestFocusFromJS();
        else if (original instanceof CUIFocusView) ((CUIFocusView)original).requestKeyboardFocus(((CUIFocusView)original).fieldInputOwnerId());
        else throw new IllegalStateException("field-input-original-focus-command-unavailable");
        for (CUIFieldInputBinding binding : new ArrayList<>(bindings.keySet())) {
          View root = binding.outer.get(); if (root instanceof CUIFocusView && root.getRootView() == outer.getRootView())
            ((CUIFocusView)root).synchronizeFocusWithin();
        }
      } finally { if (observer.isAlive()) observer.removeOnGlobalFocusChangeListener(listener); }
      JSONObject after = capture(), actual = null;
      if (after != null) {
        JSONArray originals = after.getJSONObject("fieldGroupSnapshot").getJSONArray("originals");
        for (int index = 0; index < originals.length(); index++) if (originals.getJSONObject(index).getInt("target") == target) actual = originals.getJSONObject(index);
      }
      boolean current = after != null && request.getLong("epoch") == epoch && manager.resolveView(target) == original && actual != null &&
        actual.getString("nativeInstance").equals(expected.getString("nativeInstance")) && actual.getString("editorInstance").equals(expected.getString("editorInstance"));
      boolean completed = observed[0];
      JSONObject response = new JSONObject().put("requested", true).put("observed", completed).put("current", current).put("target", target)
        .put("nativeInstance", expected.getString("nativeInstance")).put("editorInstance", expected.getString("editorInstance"))
        .put("error", completed ? "" : "field-input-original-focus-not-observed");
      emitRecord(new JSONObject(response.toString()).put("kind", "focus")
        .put("token", request.optLong("token")).put("eventId", request.optLong("eventId"))
        .put("groupTarget", request.getInt("scopeTarget")).put("action", request.optString("action"))
        .put("nativeCommandResult", commandResult).put("after", after == null ? JSONObject.NULL : after.getJSONObject("fieldGroupSnapshot")).toString());
      return response.toString();
    } catch (Exception error) {
      try { return new JSONObject().put("requested", false).put("observed", false).put("current", false).put("target", 0)
        .put("nativeInstance", "").put("editorInstance", "").put("error", String.valueOf(error.getMessage())).toString(); }
      catch (Exception impossible) { throw new IllegalStateException(impossible); }
    }
  }
}
