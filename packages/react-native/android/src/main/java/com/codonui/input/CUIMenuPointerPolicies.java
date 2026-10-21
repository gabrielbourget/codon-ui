package com.codonui.input;

import android.graphics.Matrix;
import android.graphics.RectF;
import android.os.SystemClock;
import android.os.Build;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.Window;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.PointerEvents;
import com.facebook.react.uimanager.ReactPointerEventsView;
import com.facebook.react.uimanager.TouchTargetHelper;
import com.facebook.react.uimanager.UIManagerHelper;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.Set;
import java.util.WeakHashMap;
import org.json.JSONException;
import org.json.JSONObject;

/** Scope-owned Menu policy; the motion observer is a separate registry and always remains passive. */
final class CUIMenuPointerPolicies {
  static final class Registration {
    final String id, parentBinding, submenuBinding, triggerBinding;
    final int parentTarget, submenuTarget, triggerTarget;
    Registration(String id, int parentTarget, int submenuTarget, int triggerTarget, String parentBinding, String submenuBinding, String triggerBinding) {
      this.id = id; this.parentTarget = parentTarget; this.submenuTarget = submenuTarget; this.triggerTarget = triggerTarget;
      this.parentBinding = parentBinding; this.submenuBinding = submenuBinding; this.triggerBinding = triggerBinding;
    }
    boolean matches(Registration next) {
      return id.equals(next.id) && parentTarget == next.parentTarget && submenuTarget == next.submenuTarget && triggerTarget == next.triggerTarget
          && parentBinding.equals(next.parentBinding) && submenuBinding.equals(next.submenuBinding) && triggerBinding.equals(next.triggerBinding);
    }
  }
  private static final WeakHashMap<View, WindowPolicy> windows = new WeakHashMap<>();
  private static final WeakHashMap<View, String> modalities = new WeakHashMap<>();
  static void recordHover(View view) { modalities.put(view.getRootView(), "pointer"); }
  private static void recordModality(View view, String modality) {
    View root = view.getRootView(); modalities.put(root, modality);
    for (CUIKeyboardScope owner : CUIInputWindow.scopes(root)) for (Policy policy : owner.menuPointers.policies) {
      policy.setPointerMode("pointer".equals(modality));
    }
  }
  static void recordPointerDown(View view) { recordModality(view, "pointer"); }
  static void recordVirtual(View view) { recordModality(view, "virtual"); }
  static void recordKey(View view, KeyEvent event) {
    int code = event.getKeyCode();
    if (event.getAction() != KeyEvent.ACTION_DOWN || event.isAltPressed() || event.isCtrlPressed() || event.isMetaPressed()
        || code == KeyEvent.KEYCODE_SHIFT_LEFT || code == KeyEvent.KEYCODE_SHIFT_RIGHT || code == KeyEvent.KEYCODE_CTRL_LEFT || code == KeyEvent.KEYCODE_CTRL_RIGHT || code == KeyEvent.KEYCODE_META_LEFT || code == KeyEvent.KEYCODE_META_RIGHT) return;
    recordModality(view, "keyboard");
  }
  private final WeakReference<CUIKeyboardScope> scope;
  private List<Policy> policies = new ArrayList<>();
  private double revision;
  CUIMenuPointerPolicies(CUIKeyboardScope scope) { this.scope = new WeakReference<>(scope); }

  void update(List<Registration> registrations, double revision) {
    List<Policy> next = new ArrayList<>(); Set<String> ids = new HashSet<>();
    for (Registration registration : registrations) {
      if (registration.id.isEmpty() || !ids.add(registration.id)) continue;
      Policy retained = null;
      for (Policy previous : policies) if (previous.registration.matches(registration)) { retained = previous; break; }
      next.add(retained == null ? new Policy(registration, revision) : retained);
    }
    for (Policy previous : policies) if (!next.contains(previous)) previous.retire("policy-retired");
    for (Policy policy : next) policy.frameRevision = revision;
    policies = next; this.revision = revision;
    CUIKeyboardScope owner = scope.get();
    if (owner != null && owner.isAttachedToWindow()) refresh(owner);
  }
  void dispose() { for (Policy policy : policies) policy.retire("scope-retired"); policies.clear(); }
  private boolean needed() { CUIKeyboardScope owner = scope.get(); return owner != null && owner.menuPointerCaptureReady() && !policies.isEmpty(); }

  static void refresh(CUIKeyboardScope owner) {
    View root = owner.getRootView(); WindowPolicy current = windows.get(root);
    boolean needed = false;
    for (CUIKeyboardScope candidate : CUIInputWindow.scopes(root)) needed |= candidate.menuPointers.needed();
    if (!needed) { if (current != null) { current.close(); windows.remove(root); } return; }
    if (current == null) {
      Window window = CUIWindowPointers.actualWindow(owner, root);
      if (window == null) { owner.menuPointers.publishUnavailable("Native Menu: original Activity/modal window unavailable"); return; }
      try { current = new WindowPolicy(root, window); windows.put(root, current); }
      catch (RuntimeException error) { owner.menuPointers.publishUnavailable(error.toString()); return; }
    }
    current.publish();
  }
  static void release(View root) {
    WindowPolicy current = windows.get(root); if (current == null) return;
    for (CUIKeyboardScope owner : CUIInputWindow.scopes(root)) if (owner.menuPointers.needed()) { current.publish(); return; }
    current.close(); windows.remove(root);
  }
  private void publishUnavailable(String error) { for (Policy policy : policies) policy.status(false, error); }
  static boolean suppresses(CUIFocusView view) {
    WindowPolicy current = windows.get(view.getRootView());
    if (current == null || !current.active()) return false;
    for (Policy policy : current.policies()) if (policy.parent == view && policy.current() && policy.grace.suppressed()) return true;
    return false;
  }
  private static RectF rectangle(View target, View root) {
    Matrix matrix = new Matrix();
    if (Build.VERSION.SDK_INT >= 29) { target.transformMatrixToGlobal(matrix); root.transformMatrixToLocal(matrix); }
    else transformToRoot(target, root, matrix);
    RectF result = new RectF(0, 0, target.getWidth(), target.getHeight()); matrix.mapRect(result); return result;
  }
  private static void transformToRoot(View target, View root, Matrix matrix) {
    if (target == root) return;
    if (!(target.getParent() instanceof View)) throw new IllegalStateException("Native Menu: original window ancestry retired");
    View parent = (View)target.getParent(); transformToRoot(parent, root, matrix);
    matrix.preTranslate(-parent.getScrollX(), -parent.getScrollY());
    matrix.preTranslate(target.getLeft(), target.getTop());
    if (!target.getMatrix().isIdentity()) matrix.preConcat(target.getMatrix());
  }
  private static CUIMenuPointerGrace.Rect geometry(RectF value) { return new CUIMenuPointerGrace.Rect(value.left, value.top, value.right, value.bottom); }
  private static List<Integer> path(View root, double x, double y) {
    List<Integer> result = new ArrayList<>();
    for (TouchTargetHelper.ViewTarget target : TouchTargetHelper.findTargetPathAndCoordinatesForTouch((float)x, (float)y, (ViewGroup)root, new float[2])) result.add(target.getViewId());
    return result;
  }
  private static boolean inputVisible(View target, View scope) {
    if (!target.isAttachedToWindow() || !target.isShown() || !target.hasWindowFocus()) return false;
    for (View view = target; view != null; view = view.getParent() instanceof View ? (View)view.getParent() : null) {
      if (view.getAlpha() <= 0) return false;
      PointerEvents events = view instanceof CUIFocusView ? ((CUIFocusView)view).authoredPointerEvents()
          : view instanceof ReactPointerEventsView ? ((ReactPointerEventsView)view).getPointerEvents() : PointerEvents.AUTO;
      if (events == PointerEvents.NONE || view != target && events == PointerEvents.BOX_ONLY) return false;
      if (view == scope) return true;
    }
    return false;
  }
  private static boolean binding(View target, String serialized) {
    try {
      JSONObject value = new JSONObject(serialized);
      View root = target.getRootView().findViewById(value.getInt("target"));
      return root instanceof CUICollectionRoot && ((CUICollectionRoot)root).acceptsPointerBinding(serialized, target.getId());
    } catch (JSONException invalid) { return false; }
  }
  private static boolean relatedBindings(Registration registration) {
    try {
      JSONObject parent = new JSONObject(registration.parentBinding), submenu = new JSONObject(registration.submenuBinding), trigger = new JSONObject(registration.triggerBinding);
      for (String field : new String[]{"ownerId", "rootId", "rootRevision", "windowId"}) if (!parent.getString(field).equals(trigger.getString(field))) return false;
      for (String field : new String[]{"target", "surfaceId", "epoch", "sequence"}) if (parent.getDouble(field) != trigger.getDouble(field)) return false;
      return parent.getDouble("surfaceId") == submenu.getDouble("surfaceId");
    } catch (JSONException invalid) { return false; }
  }

  private final class Policy {
    final Registration registration;
    final CUIMenuPointerGrace grace = new CUIMenuPointerGrace();
    final String ownerId, windowId;
    final double epoch;
    double frameRevision;
    long sequence;
    WeakReference<View> parentRef, submenuRef, triggerRef;
    View parent, submenu, trigger;
    boolean retired, wasReady;
    String status = "";
    int width = -1, height = -1;
    RectF submenuRect;
    MotionEvent observation;
    long observationId;
    long decisionTime;
    final Runnable timeout = this::expire;
    private void expire() {
      CUIKeyboardScope owner = scope.get();
      if (owner == null || !current() || observation == null) { retire("observation-retired"); return; }
      WindowPolicy window = windows.get(owner.getRootView());
      if (window == null || !window.active()) { retire("window-retired"); return; }
      decisionTime = SystemClock.uptimeMillis();
      boolean handoff = grace.expire(decisionTime);
      List<Integer> hit = path(owner.getRootView(), observation.getX(), observation.getY());
      if (handoff) {
        if (hit.contains(registration.parentTarget)) emit("handoff", observation, observationId, hit, "");
        clearObservation();
      } else { emit("reset", observation, observationId, hit, ""); schedule(); }
    }
    Policy(Registration registration, double revision) {
      this.registration = registration;
      CUIKeyboardScope owner = scope.get();
      ownerId = owner == null ? "" : owner.menuPointerOwnerId();
      windowId = owner == null ? "" : CUIInputWindow.identity(owner);
      epoch = owner == null ? -1 : owner.menuPointerEpoch(); frameRevision = revision;
      grace.setPointerMode(owner != null && "pointer".equals(modalities.get(owner.getRootView())));
    }
    private View resolve(WeakReference<View> retained, int tag, View root) { return retained == null ? root.findViewById(tag) : retained.get(); }
    boolean current() {
      CUIKeyboardScope owner = scope.get();
      if (retired || owner == null || !policies.contains(this) || !owner.menuPointerCaptureReady()
          || !ownerId.equals(owner.menuPointerOwnerId()) || !windowId.equals(CUIInputWindow.identity(owner)) || epoch != owner.menuPointerEpoch()) return false;
      View root = owner.getRootView();
      parent = resolve(parentRef, registration.parentTarget, root); submenu = resolve(submenuRef, registration.submenuTarget, root); trigger = resolve(triggerRef, registration.triggerTarget, root);
      if (parent == null || submenu == null || trigger == null) return false;
      if (parentRef == null) parentRef = new WeakReference<>(parent);
      if (submenuRef == null) submenuRef = new WeakReference<>(submenu);
      if (triggerRef == null) triggerRef = new WeakReference<>(trigger);
      if (!(parent instanceof CUIFocusView) || !(submenu instanceof CUIFocusView) || !(trigger instanceof CUIFocusView)
          || parent == submenu || parent == trigger || submenu == trigger || parent.getRootView() != root || submenu.getRootView() != root || trigger.getRootView() != root
          || !inputVisible(parent, owner) || !inputVisible(submenu, owner) || !inputVisible(trigger, owner)
          || !trigger.isEnabled() || !trigger.isFocusable() || !((CUIFocusView)trigger).isNativePressable()
          || UIManagerHelper.getSurfaceId(parent) != UIManagerHelper.getSurfaceId(submenu) || UIManagerHelper.getSurfaceId(parent) != UIManagerHelper.getSurfaceId(trigger)
          || !binding(parent, registration.parentBinding) || !binding(submenu, registration.submenuBinding) || !binding(trigger, registration.triggerBinding) || !relatedBindings(registration)) return false;
      boolean descendant = false;
      for (View view = trigger; view != null; view = view.getParent() instanceof View ? (View)view.getParent() : null) if (view == parent) { descendant = true; break; }
      if (!descendant || parent.getWidth() <= 0 || parent.getHeight() <= 0 || submenu.getWidth() <= 0 || submenu.getHeight() <= 0) return false;
      if (width != submenu.getWidth() || height != submenu.getHeight()) {
        width = submenu.getWidth(); height = submenu.getHeight(); submenuRect = rectangle(submenu, root); grace.setSubmenu(geometry(submenuRect));
      }
      return true;
    }
    void status(boolean available, String error) {
      boolean ready = available && current();
      if (wasReady && !ready) { retire(error.isEmpty() ? "native-target-retired" : error); return; }
      String signature = frameRevision + ":" + ready + ":" + error;
      if (signature.equals(status)) return;
      status = signature; wasReady = ready;
      emit("status", null, 0, new ArrayList<>(), error);
    }
    void retire(String reason) {
      if (retired) return;
      retired = true; grace.retire(); clearObservation();
      emit("retired", null, 0, new ArrayList<>(), reason);
      parent = null; submenu = null; trigger = null; submenuRect = null;
    }
    void clearObservation() {
      CUIKeyboardScope owner = scope.get(); if (owner != null) owner.removeCallbacks(timeout);
      if (observation != null) observation.recycle(); observation = null;
    }
    void setPointerMode(boolean pointer) {
      if (!grace.setPointerMode(pointer)) return;
      clearObservation();
      CUIKeyboardScope owner = scope.get();
      if (pointer && owner != null && current()) {
        submenuRect = rectangle(submenu, owner.getRootView()); grace.activateSubmenu(geometry(submenuRect));
      }
    }
    void schedule() {
      CUIKeyboardScope owner = scope.get(); if (owner == null) return;
      owner.removeCallbacks(timeout);
      if (grace.deadline() >= 0) owner.postDelayed(timeout, Math.max(0, (long)Math.ceil(grace.deadline() - SystemClock.uptimeMillis())));
    }
    void move(MotionEvent event, long identity, List<Integer> originalHit) {
      CUIKeyboardScope owner = scope.get(); if (owner == null || !current()) return;
      long now = SystemClock.uptimeMillis();
      if (!grace.move(event.getX(), event.getY(), now, geometry(rectangle(parent, owner.getRootView())))) return;
      decisionTime = now;
      clearObservation(); observation = MotionEvent.obtain(event); observationId = identity;
      emit("move", event, identity, originalHit, ""); schedule();
    }
    void reset() { grace.retire(); clearObservation(); emit("reset", null, 0, new ArrayList<>(), ""); }
    void emit(String phase, MotionEvent event, long identity, List<Integer> hit, String error) {
      CUIKeyboardScope owner = scope.get(); if (owner == null) return;
      WritableMap data = Arguments.createMap(); data.putString("ownerId", ownerId); data.putString("windowId", windowId); data.putDouble("epoch", epoch);
      data.putDouble("revision", frameRevision); data.putString("policyId", registration.id); data.putDouble("sequence", ++sequence);
      data.putString("phase", phase); data.putBoolean("ready", !retired && current()); data.putBoolean("suppressed", !retired && grace.suppressed());
      data.putDouble("observationId", identity);
      int pointer = event != null && "down".equals(phase) ? event.getActionIndex() : 0;
      int tool = event == null ? MotionEvent.TOOL_TYPE_UNKNOWN : event.getToolType(pointer);
      data.putString("pointerType", tool == MotionEvent.TOOL_TYPE_MOUSE ? "mouse" : tool == MotionEvent.TOOL_TYPE_FINGER ? "touch" : tool == MotionEvent.TOOL_TYPE_STYLUS || tool == MotionEvent.TOOL_TYPE_ERASER ? "pen" : "unknown");
      float density = owner.getResources().getDisplayMetrics().density;
      data.putDouble("pageX", event == null ? 0 : event.getX(pointer) / density); data.putDouble("pageY", event == null ? 0 : event.getY(pointer) / density);
      data.putDouble("timestamp", event == null ? SystemClock.uptimeMillis() : event.getEventTime()); data.putInt("target", hit.isEmpty() ? View.NO_ID : hit.get(0));
      WritableArray ancestry = Arguments.createArray(); for (int tag : hit) ancestry.pushInt(tag); data.putArray("hitPath", ancestry);
      data.putString("nativeButtons", event == null ? "0" : Integer.toUnsignedString(event.getButtonState())); data.putString("nativeModifiers", event == null ? "0" : Integer.toUnsignedString(event.getMetaState()));
      String geometry = "{}";
      if (!retired && parent != null && submenuRect != null) {
        RectF bounds = rectangle(parent, owner.getRootView());
        geometry = "{\"parent\":[" + bounds.left / density + "," + bounds.top / density + "," + bounds.right / density + "," + bounds.bottom / density + "],\"submenu\":[" + submenuRect.left / density + "," + submenuRect.top / density + "," + submenuRect.right / density + "," + submenuRect.bottom / density + "],\"decisionTime\":" + decisionTime + ",\"deadline\":" + grace.deadline() + "}";
      }
      data.putString("geometry", geometry); data.putString("error", error); owner.emitMenuPointer(data);
    }
  }

  private static final class WindowPolicy implements CUIMenuPointerWindowCallback.Listener, ViewTreeObserver.OnPreDrawListener {
    private static final class Prepared {
      final MotionEvent original, snapshot;
      final List<Integer> hit;
      final List<Policy> policies;
      final long identity;
      Prepared(MotionEvent original, List<Integer> hit, List<Policy> policies, long identity) {
        this.original = original; snapshot = MotionEvent.obtain(original); this.hit = hit; this.policies = policies; this.identity = identity;
      }
    }
    private final WeakReference<View> root;
    private final CUIMenuPointerWindowCallback callback;
    private boolean retired;
    private long observationId;
    private final Map<String, List<Policy>> focusClaims = new HashMap<>();
    private final ArrayDeque<Prepared> dispatches = new ArrayDeque<>();
    WindowPolicy(View root, Window window) {
      this.root = new WeakReference<>(root); callback = new CUIMenuPointerWindowCallback(window, this); root.getViewTreeObserver().addOnPreDrawListener(this);
    }
    boolean active() { View view = root.get(); return !retired && callback.isInstalled() && view != null && view.isAttachedToWindow() && view.hasWindowFocus(); }
    List<Policy> policies() {
      List<Policy> result = new ArrayList<>(); View view = root.get();
      if (view != null) for (CUIKeyboardScope owner : CUIInputWindow.scopes(view)) result.addAll(owner.menuPointers.policies);
      return result;
    }
    void publish() {
      if (!retired && !callback.isInstalled()) { failed(new IllegalStateException("Native Menu: original window callback replaced")); return; }
      for (Policy policy : policies()) policy.status(active(), "");
    }
    @Override public boolean onPreDraw() { publish(); return true; }
    @Override public boolean before(MotionEvent event, boolean generic) {
      if (!active()) return false;
      publish();
      int action = event.getActionMasked();
      int pointer = event.getActionIndex();
      View view = root.get(); if (view == null) return false;
      Prepared prepared = new Prepared(event, path(view, event.getX(pointer), event.getY(pointer)), policies(), ++observationId);
      dispatches.push(prepared);
      String key = event.getDeviceId() + ":" + event.getDownTime() + ":" + event.getPointerId(pointer);
      if (action == MotionEvent.ACTION_DOWN) focusClaims.keySet().removeIf(previous -> previous.startsWith(event.getDeviceId() + ":"));
      if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN || action == MotionEvent.ACTION_BUTTON_PRESS && !focusClaims.containsKey(key)) {
        List<Policy> claims = new ArrayList<>();
        for (Policy policy : prepared.policies) if (policy.current() && policy.grace.suppressed()) {
          claims.add(policy); policy.emit("down", prepared.snapshot, prepared.identity, prepared.hit, "");
        }
        if (!claims.isEmpty()) focusClaims.put(key, claims);
      }
      List<Policy> claims = focusClaims.get(key);
      if (claims == null) return false;
      claims.removeIf(policy -> !policy.current());
      if (claims.isEmpty()) { focusClaims.remove(key); return false; }
      return action != MotionEvent.ACTION_MOVE && action != MotionEvent.ACTION_HOVER_MOVE;
    }
    @Override public void after(MotionEvent event, boolean generic) {
      if (dispatches.isEmpty()) return;
      Prepared prepared = dispatches.pop();
      try { afterPrepared(event, prepared); }
      finally { prepared.snapshot.recycle(); }
    }
    private void afterPrepared(MotionEvent original, Prepared prepared) {
      if (prepared.original != original) throw new IllegalStateException("Native Menu: original window dispatch order changed");
      if (!active()) return;
      MotionEvent event = prepared.snapshot;
      int action = event.getActionMasked();
      if (action == MotionEvent.ACTION_CANCEL) focusClaims.clear();
      else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_POINTER_UP)
        focusClaims.remove(event.getDeviceId() + ":" + event.getDownTime() + ":" + event.getPointerId(event.getActionIndex()));
      if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN || action == MotionEvent.ACTION_BUTTON_PRESS) {
        View view = root.get(); if (view != null) recordPointerDown(view); return;
      }
      if (event.getToolType(0) != MotionEvent.TOOL_TYPE_MOUSE) return;
      if (action != MotionEvent.ACTION_HOVER_MOVE && action != MotionEvent.ACTION_MOVE) return;
      View view = root.get(); if (view != null) recordHover(view);
      for (Policy policy : prepared.policies) policy.move(event, prepared.identity, prepared.hit);
    }
    @Override public void keyboard(KeyEvent event) {
      View view = root.get(); if (view != null) recordKey(view, event);
    }
    private void clearDispatches() { while (!dispatches.isEmpty()) dispatches.pop().snapshot.recycle(); }
    @Override public void lostWindow() { clearDispatches(); focusClaims.clear(); for (Policy policy : policies()) policy.retire("window-retired"); }
    @Override public void failed(RuntimeException failure) {
      for (Policy policy : policies()) policy.retire(failure.toString()); close();
    }
    void close() {
      if (retired) return; retired = true;
      clearDispatches();
      focusClaims.clear();
      for (Policy policy : policies()) policy.retire("window-policy-retired");
      callback.close(); View view = root.get();
      if (view != null && view.getViewTreeObserver().isAlive()) view.getViewTreeObserver().removeOnPreDrawListener(this);
    }
  }
}
