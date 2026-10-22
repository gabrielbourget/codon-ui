package com.codonui.input;

import android.os.SystemClock;
import android.text.Editable;
import android.util.SparseArray;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewParent;
import android.view.inputmethod.BaseInputConnection;
import android.widget.EditText;
import androidx.core.view.ViewCompat;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.view.ReactViewGroup;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class CUIKeyboardScope extends ReactViewGroup {
  final CUIEditorKeyboardBindings editorKeyboard = new CUIEditorKeyboardBindings(this);
  final CUIMenuPointerPolicies menuPointers = new CUIMenuPointerPolicies(this);
  private List<CUIMenuPointerPolicies.Registration> menuPointerPolicies = new ArrayList<>();
  private double menuPointerRevision;
  void setMenuPointerPolicies(List<CUIMenuPointerPolicies.Registration> next) { menuPointerPolicies = next; }
  void setMenuPointerRevision(double next) { menuPointerRevision = next; }
  boolean menuPointerCaptureReady() { return captureReady(); }
  String menuPointerOwnerId() { return ownerId; }
  double menuPointerEpoch() { return windowEpoch; }
  void emitMenuPointer(WritableMap data) { emit("topNativeMenuPointer", data); }
  static final class Observation {
    final String id;
    final int targetTag;
    Observation(String id, int targetTag) { this.id = id; this.targetTag = targetTag; }
  }
  static final class Policy {
    final String id;
    final Set<String> tokens;
    final boolean excludeEditable;
    final int targetTag;
    final boolean excludeComposing;
    Policy(String id, Set<String> tokens, boolean excludeEditable, boolean excludeComposing, int targetTag) {
      this.id = id; this.tokens = new HashSet<>(tokens); this.excludeEditable = excludeEditable;
      this.targetTag = targetTag;
      this.excludeComposing = excludeComposing;
    }
    @Override public boolean equals(Object other) {
      if (!(other instanceof Policy)) return false;
      Policy policy = (Policy) other;
      return id.equals(policy.id) && tokens.equals(policy.tokens) && excludeEditable == policy.excludeEditable && excludeComposing == policy.excludeComposing && targetTag == policy.targetTag;
    }
    @Override public int hashCode() { return Objects.hash(id, tokens, excludeEditable, excludeComposing, targetTag); }
  }
  private static final class Hold {
    final String policyId;
    final String ownerId;
    final int focusedTarget;
    KeyEvent event;
    boolean retired;
    final String windowId;
    final double epoch;
    final double policyRevision;
    Hold(Policy policy, String ownerId, View focused, KeyEvent event, String windowId, double epoch, double policyRevision) {
      this.policyId = policy.id; this.ownerId = ownerId; this.focusedTarget = focused == null ? View.NO_ID : focused.getId(); this.event = new KeyEvent(event);
      this.windowId = windowId; this.epoch = epoch; this.policyRevision = policyRevision;
    }
  }

  private String ownerId = "";
  private boolean captureEnabled = true;
  private List<Policy> policies = new ArrayList<>();
  private final SparseArray<Hold> held = new SparseArray<>();
  private double windowEpoch;
  private double acceptedEpoch = -1;
  private double policyRevision;
  private double observationRevision;
  private List<Observation> observations = new ArrayList<>();
  private String acceptedWindowId = "";
  private List<CUIWindowPointers.Registration> pointerRegistrations = new ArrayList<>();
  private double pointerRevision;
  private String pointerStatus = "";
  void setPointerRegistrations(List<CUIWindowPointers.Registration> next) {
    for (CUIWindowPointers.Registration registration : next) for (CUIWindowPointers.Registration previous : pointerRegistrations)
      if (registration.id.equals(previous.id) && registration.targetTag == previous.targetTag) registration.target = previous.target;
    pointerRegistrations = next;
  }
  void setPointerRevision(double next) { pointerRevision = next; }
  boolean hasPointerRegistrations() { return captureReady() && !pointerRegistrations.isEmpty(); }
  private View pointerTarget(CUIWindowPointers.Registration registration) {
    if (registration.target == null) {
      View found = getRootView().findViewById(registration.targetTag);
      if (found != null) registration.target = new java.lang.ref.WeakReference<>(found);
    }
    View target = registration.target == null ? null : registration.target.get();
    if (target == null || target.getId() != registration.targetTag || !target.isAttachedToWindow() || target.getRootView() != getRootView()) return null;
    for (View view = target; view != null; view = view.getParent() instanceof View ? (View) view.getParent() : null) if (view == this) return target;
    return null;
  }
  void writePointerSession(WritableMap data) {
    data.putString("ownerId", ownerId); data.putString("windowId", CUIInputWindow.identity(this)); data.putDouble("epoch", windowEpoch);
  }
  boolean appendPointerRegistrations(WritableArray result, List<Integer> ancestry) {
    if (!hasPointerRegistrations()) return false;
    boolean added = false;
    for (CUIWindowPointers.Registration registration : pointerRegistrations) {
      if (pointerTarget(registration) == null) continue;
      WritableMap entry = Arguments.createMap();
      entry.putString("id", registration.id); entry.putString("ownerId", ownerId); entry.putDouble("epoch", windowEpoch);
      entry.putDouble("revision", pointerRevision); entry.putInt("targetTag", registration.targetTag); entry.putInt("depth", ancestry.indexOf(registration.targetTag));
      result.pushMap(entry); added = true;
    }
    return added;
  }
  void publishPointerStatus(boolean available, String error) {
    boolean ready = available && hasPointerRegistrations();
    for (CUIWindowPointers.Registration registration : pointerRegistrations) ready &= pointerTarget(registration) != null;
    String signature = ownerId + ":" + CUIInputWindow.identity(this) + ":" + windowEpoch + ":" + pointerRevision + ":" + ready + ":" + error;
    if (signature.equals(pointerStatus)) return;
    pointerStatus = signature;
    WritableMap data = Arguments.createMap(); writePointerSession(data);
    data.putDouble("revision", pointerRevision); data.putBoolean("ready", ready); data.putString("error", error);
    emit("topNativePointerStatus", data);
  }
  void emitPointer(WritableMap data) { if (hasPointerRegistrations()) emit("topNativeWindowPointer", data); }

  private long policyOrder;
  private View boundRoot;
  private final CUIFloatingObserver floating;
  private List<CUIFloatingObserver.Target> floatingTargets = new ArrayList<>();
  private final ViewCompat.OnUnhandledKeyEventListenerCompat unhandled = (view, event) -> dispatchCapturedKey(event);

  public CUIKeyboardScope(ThemedReactContext context) {
    super(context);
    floating = new CUIFloatingObserver(this, data -> {
      if (!captureReady()) return;
      data.putString("ownerId", ownerId); data.putString("windowId", CUIInputWindow.identity(this)); data.putDouble("epoch", windowEpoch);
      emit("topNativeFloatingObservation", data);
    });
  }
  void setFloatingTargets(List<CUIFloatingObserver.Target> next) { floatingTargets = next; }
  void setOwnerId(String next) {
    if (next == null) next = "";
    if (!ownerId.equals(next)) retireHeld();
    ownerId = next;
  }
  void setCaptureEnabled(boolean enabled) {
    if (!enabled) retireHeld();
    captureEnabled = enabled;
  }
  void setPolicies(List<Policy> next) {
    if (!policies.equals(next)) { retireHeld(); if (isAttachedToWindow()) policyOrder = CUIInputWindow.nextPolicyOrder(this); }
    policies = next;
  }
  void setAcceptedWindowId(String next) { if (next == null) next = ""; if (!acceptedWindowId.equals(next)) retireHeld(); acceptedWindowId = next; }
  void setAcceptedEpoch(double next) { if (acceptedEpoch != next) retireHeld(); acceptedEpoch = next; }
  void setPolicyRevision(double next) { if (policyRevision != next) retireHeld(); policyRevision = next; }
  void setObservations(List<Observation> next) { observations = next; }
  void setObservationRevision(double next) { observationRevision = next; }
  private boolean windowActive() { return isAttachedToWindow() && hasWindowFocus() && getWindowVisibility() == View.VISIBLE; }
  void writeActivationSession(WritableMap data) {
    data.putString("scopeOwnerId", ownerId);
    data.putString("windowId", CUIInputWindow.identity(this));
    data.putDouble("epoch", windowEpoch);
  }
  String formActionOwnerId() { return ownerId; }
  double formActionEpoch() { return windowEpoch; }
  private boolean captureReady() { return captureEnabled && windowActive() && acceptedEpoch == windowEpoch && acceptedWindowId.equals(CUIInputWindow.identity(this)); }
  void publishStatus() {
    editorKeyboard.publish();
    CUIWindowPointers.refresh(this);
    menuPointers.update(menuPointerPolicies, menuPointerRevision);
    floating.update(floatingTargets, captureReady());
    WritableMap data = baseData(); data.putString("windowId", isAttachedToWindow() ? CUIInputWindow.identity(this) : "");
    data.putDouble("epoch", windowEpoch); data.putDouble("policyRevision", policyRevision); data.putBoolean("ready", captureReady()); data.putBoolean("windowActive", windowActive()); emit("topNativeScopeStatus", data);
    WritableMap observed = baseData(); observed.putString("windowId", isAttachedToWindow() ? CUIInputWindow.identity(this) : "");
    observed.putDouble("epoch", windowEpoch); observed.putDouble("observationRevision", observationRevision);
    observed.putBoolean("ready", captureReady()); observed.putBoolean("windowActive", windowActive()); emit("topNativeObservationStatus", observed);
  }

  private Policy localPolicyFor(KeyEvent event, View focused) {
    if (!captureReady()) return null;
    boolean composing = false;
    if (focused instanceof EditText) {
      Editable text = ((EditText) focused).getText();
      composing = text != null && BaseInputConnection.getComposingSpanStart(text) >= 0;
    }
    if (focused instanceof CUIDateSegment) composing = ((CUIDateSegment)focused).isSegmentComposing();
    boolean editable = focused != null && focused.onCheckIsTextEditor();
    String token = CUIInputWindow.keyToken(event);
    for (Policy policy : policies) {
      if (editable && policy.excludeEditable) continue;
      if (composing && policy.excludeComposing) continue;
      if (policy.targetTag > 0) {
        boolean contains = false;
        for (View view = focused; view != null;) {
          if (view.getId() == policy.targetTag) { contains = true; break; }
          ViewParent parent = view.getParent(); view = parent instanceof View ? (View) parent : null;
        }
        if (!contains) continue;
      }
      if (policy.tokens.contains(token)) return policy;
    }
    return null;
  }

  @Override public boolean dispatchKeyEvent(KeyEvent event) {
    if (CUIFieldInputBinding.inDefault(event)) return super.dispatchKeyEvent(event);
    if (!isAttachedToWindow() || !hasWindowFocus() || (event.getAction() != KeyEvent.ACTION_DOWN && event.getAction() != KeyEvent.ACTION_UP)) return super.dispatchKeyEvent(event);
    boolean down = event.getAction() == KeyEvent.ACTION_DOWN;
    CUIMenuPointerPolicies.recordKey(this, event);
    if (down) recordModality("keyboard", event.getEventTime());
    boolean outer = CUIInputWindow.beginKey(this);
    try {
      if (outer && down) {
        View focused = getRootView().findFocus();
        List<CUIKeyboardScope> scopes = CUIInputWindow.scopes(this);
        boolean captured = focused instanceof CUIFocusView && ((CUIFocusView) focused).capturesObservedKey(event);
        for (CUIKeyboardScope candidate : scopes) captured |= candidate.held.get(event.getKeyCode()) != null || candidate.localPolicyFor(event, focused) != null;
        long eventId = CUIInputWindow.nextObservedEvent(this);
        for (CUIKeyboardScope candidate : scopes) candidate.observeKey(event, focused, eventId, captured);
      }
      if (outer) {
        CUIFieldInputBinding.Decision field = CUIFieldInputBinding.dispatch(this, event, getRootView().findFocus());
        if (field != null) {
          boolean invoked = false, handled = false;
          String error = "";
          KeyEvent previous = CUIFieldInputBinding.beginDefault(event);
          try {
            if (field.prevented) return true;
            invoked = true; handled = super.dispatchKeyEvent(event); return handled;
          } catch (RuntimeException | Error failure) { error = failure.toString(); throw failure; }
          finally { CUIFieldInputBinding.endDefault(event, previous); field.finish(invoked, handled, error); }
        }
      }
      if (outer && CUIEditorKeyboardBindings.dispatch(CUIInputWindow.scopes(this), event, getRootView().findFocus())) return true;
      return dispatchCapturedKey(event) || super.dispatchKeyEvent(event);
    } finally { CUIInputWindow.endKey(this); }
  }
  private void observeKey(KeyEvent event, View focused, long eventId, boolean captured) {
    if (!captureReady() || event.isCanceled() || observations.isEmpty()) return;
    WritableArray ids = Arguments.createArray();
    for (Observation observation : observations) {
      boolean matches = observation.targetTag <= 0;
      for (View view = focused; !matches && view != null;) {
        matches = view.getId() == observation.targetTag;
        ViewParent parent = view.getParent(); view = parent instanceof View ? (View) parent : null;
      }
      if (matches) ids.pushString(observation.id);
    }
    if (ids.size() == 0) return;
    boolean composing = false;
    if (focused instanceof EditText) { Editable text = ((EditText) focused).getText(); composing = text != null && BaseInputConnection.getComposingSpanStart(text) >= 0; }
    if (focused instanceof CUIDateSegment) composing = ((CUIDateSegment)focused).isSegmentComposing();
    int code = event.getKeyCode();
    WritableMap data = baseData();
    data.putInt("target", focused != null && focused.getId() != View.NO_ID ? focused.getId() : getId());
    data.putInt("focusedTarget", focused == null ? -1 : focused.getId());
    data.putString("windowId", CUIInputWindow.identity(this)); data.putDouble("epoch", windowEpoch);
    data.putDouble("observationRevision", observationRevision); data.putDouble("eventId", eventId); data.putArray("observerIds", ids);
    data.putString("key", CUIInputWindow.keyName(event)); data.putString("code", CUIPhysicalKey.code(code)); data.putInt("nativeCode", code);
    data.putInt("legacyKeyCode", "Unidentified".equals(CUIPhysicalKey.code(code)) ? 0 : code);
    data.putInt("location", CUIPhysicalKey.location(code)); data.putBoolean("repeat", event.getRepeatCount() > 0); data.putBoolean("cancelled", false); data.putBoolean("isComposing", composing);
    data.putBoolean("shiftKey", event.isShiftPressed()); data.putBoolean("altKey", event.isAltPressed()); data.putBoolean("ctrlKey", event.isCtrlPressed()); data.putBoolean("metaKey", event.isMetaPressed()); data.putBoolean("capsLock", event.isCapsLockOn());
    data.putString("nativeModifierData", Integer.toUnsignedString(event.getMetaState())); data.putBoolean("defaultCaptured", captured); data.putDouble("timestamp", event.getEventTime());
    emit("topNativeObservedKey", data);
  }
  private boolean dispatchCapturedKey(KeyEvent event) {
    if (!isAttachedToWindow() || !hasWindowFocus() || (event.getAction() != KeyEvent.ACTION_DOWN && event.getAction() != KeyEvent.ACTION_UP)) return false;
    View focused = getRootView().findFocus();
    int code = event.getKeyCode();
    CUIKeyboardScope owner = null;
    for (CUIKeyboardScope candidate : CUIInputWindow.scopes(this)) {
      if (candidate.held.get(code) != null) { owner = candidate; break; }
      if (candidate.localPolicyFor(event, focused) != null && (owner == null || candidate.policyOrder > owner.policyOrder)) owner = candidate;
    }
    return owner != null && owner.capture(event, focused);
  }
  private boolean capture(KeyEvent event, View focused) {
    boolean down = event.getAction() == KeyEvent.ACTION_DOWN;
    if (down) recordModality("keyboard", event.getEventTime());
    int code = event.getKeyCode();
    Hold hold = held.get(code);
    if (hold == null && down) {
      Policy policy = localPolicyFor(event, focused);
      if (policy == null) return false;
      hold = new Hold(policy, ownerId, focused, event, CUIInputWindow.identity(this), windowEpoch, policyRevision);
      hold.retired = event.getRepeatCount() > 0;
      held.put(code, hold);
    }
    if (hold == null) return false;
    hold.event = new KeyEvent(event);
    if (!hold.retired) emitKey(hold, down, event.isCanceled());
    if (!down) held.remove(code);
    return true;
  }

  @Override public boolean dispatchTouchEvent(MotionEvent event) {
    CUIInputWindow.pointerEvent(this, event);
    if (event.getActionMasked() == MotionEvent.ACTION_DOWN && hasWindowFocus()) {
      CUIMenuPointerPolicies.recordPointerDown(this);
      recordModality("pointer", event.getEventTime());
    }
    CUIInputWindow.beginPointer(this);
    try { return super.dispatchTouchEvent(event); }
    finally { CUIInputWindow.endPointer(this); }
  }
  @Override public boolean dispatchGenericMotionEvent(MotionEvent event) {
    if ((event.getActionMasked() == MotionEvent.ACTION_HOVER_MOVE || event.getActionMasked() == MotionEvent.ACTION_HOVER_ENTER)
        && event.getToolType(0) == MotionEvent.TOOL_TYPE_MOUSE) CUIMenuPointerPolicies.recordHover(this);
    if (event.getActionMasked() == MotionEvent.ACTION_SCROLL) CUIInputWindow.interacted(this);
    return super.dispatchGenericMotionEvent(event);
  }

  private WritableMap baseData() {
    WritableMap data = Arguments.createMap(); data.putString("ownerId", ownerId); data.putInt("target", getId()); return data;
  }
  private void recordModality(String origin, long timestamp) {
    CUIInputWindow.record(this, origin);
    WritableMap data = baseData(); data.putString("windowId", CUIInputWindow.identity(this)); data.putDouble("epoch", windowEpoch); data.putString("origin", origin); data.putDouble("timestamp", timestamp); emit("topNativeInputModality", data);
  }
  private void emitKey(Hold hold, boolean down, boolean cancelled) {
    KeyEvent event = hold.event;
    WritableMap data = baseData();
    data.putString("ownerId", hold.ownerId); data.putString("kind", "keyboard"); data.putString("policyId", hold.policyId);
    data.putInt("focusedTarget", hold.focusedTarget); data.putString("windowId", hold.windowId); data.putDouble("epoch", hold.epoch); data.putDouble("policyRevision", hold.policyRevision);
    data.putString("key", CUIInputWindow.keyName(event)); data.putInt("nativeCode", event.getKeyCode());
    int unicode = event.getUnicodeChar(); String characters = event.getCharacters();
    if (characters == null) characters = unicode != 0 && Character.isValidCodePoint(unicode) ? new String(Character.toChars(unicode)) : "";
    data.putString("characters", characters); data.putString("phase", down ? "down" : "up");
    data.putBoolean("repeat", down && event.getRepeatCount() > 0); data.putBoolean("cancelled", cancelled);
    data.putBoolean("shiftKey", event.isShiftPressed()); data.putBoolean("altKey", event.isAltPressed());
    data.putBoolean("ctrlKey", event.isCtrlPressed()); data.putBoolean("metaKey", event.isMetaPressed()); data.putBoolean("capsLock", event.isCapsLockOn());
    data.putString("nativeModifierData", Integer.toUnsignedString(event.getMetaState())); data.putBoolean("nativeDefaultHandled", true);
    data.putDouble("timestamp", cancelled ? SystemClock.uptimeMillis() : event.getEventTime()); emit("topNativeScopedKey", data);
  }
  private void emit(String name, WritableMap data) {
    ThemedReactContext context = (ThemedReactContext) getContext(); EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
    if (dispatcher != null) dispatcher.dispatchEvent(new ScopeEvent(UIManagerHelper.getSurfaceId(this), getId(), name, data));
  }
  void emitEditorKeyboard(String name, WritableMap data, boolean synchronous) {
    ThemedReactContext context = (ThemedReactContext)getContext();
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
    if (dispatcher != null) dispatcher.dispatchEvent(new EditorKeyboardEvent(UIManagerHelper.getSurfaceId(this), getId(), name, data, synchronous));
  }
  private static final class EditorKeyboardEvent extends Event<EditorKeyboardEvent> {
    private final String name;
    private final WritableMap data;
    private final boolean synchronous;
    EditorKeyboardEvent(int surface, int tag, String name, WritableMap data, boolean synchronous) {
      super(surface, tag); this.name = name; this.data = data; this.synchronous = synchronous;
    }
    @Override public String getEventName() { return name; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
    @Override protected boolean experimental_isSynchronous() { return synchronous; }
  }
  void retireHeld() {
    for (int index = 0; index < held.size(); index++) {
      Hold hold = held.valueAt(index);
      if (!hold.retired) emitKey(hold, false, true);
      hold.retired = true;
    }
  }
  @Override protected void onLayout(boolean changed, int left, int top, int right, int bottom) { super.onLayout(changed, left, top, right, bottom); editorKeyboard.publish(); }
  @Override public void onWindowFocusChanged(boolean focused) { retireHeld(); held.clear(); if (!focused) CUIInputWindow.clearPointers(this); windowEpoch++; super.onWindowFocusChanged(focused); publishStatus(); }
  @Override protected void onWindowVisibilityChanged(int visibility) {
    super.onWindowVisibilityChanged(visibility);
    if (boundRoot != null) { retireHeld(); held.clear(); windowEpoch++; publishStatus(); }
  }
  @Override protected void onAttachedToWindow() {
    super.onAttachedToWindow(); boundRoot = getRootView(); CUIInputWindow.register(this); policyOrder = CUIInputWindow.nextPolicyOrder(this);
    ViewCompat.addOnUnhandledKeyEventListener(boundRoot, unhandled); windowEpoch++; publishStatus();
  }
  @Override protected void onDetachedFromWindow() {
    floating.stop();
    menuPointers.dispose();
    retireHeld(); held.clear(); if (boundRoot != null) { ViewCompat.removeOnUnhandledKeyEventListener(boundRoot, unhandled); CUIInputWindow.unregister(boundRoot, this); CUIWindowPointers.release(boundRoot); CUIMenuPointerPolicies.release(boundRoot); boundRoot = null; }
    windowEpoch++; super.onDetachedFromWindow(); publishStatus();
  }

  private static final class ScopeEvent extends Event<ScopeEvent> {
    private final String name;
    private final WritableMap data;
    ScopeEvent(int surface, int tag, String name, WritableMap data) { super(surface, tag); this.name = name; this.data = data; }
    @Override public String getEventName() { return name; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
  }
}
