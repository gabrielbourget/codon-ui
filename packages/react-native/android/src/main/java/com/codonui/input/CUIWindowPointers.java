package com.codonui.input;

import android.app.Activity;
import android.app.Dialog;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.ViewTreeObserver;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.RootView;
import com.facebook.react.uimanager.TouchTargetHelper;
import com.facebook.react.views.modal.ReactModalHostView;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.WeakHashMap;

/** Private window transport. Actual reached React-root hits precede scope dispatch; delivery follows window dispatch. */
final class CUIWindowPointers implements CUIWindowPointerCallback.Listener, ViewTreeObserver.OnPreDrawListener {
  private static final WeakHashMap<View, CUIWindowPointers> observers = new WeakHashMap<>();
  private final WeakReference<View> root;
  private final CUIWindowPointerCallback callback;
  private final PointerIdentities identities = new PointerIdentities();
  private final Map<Integer, Integer> previousButtons = new HashMap<>();
  private String failure = "";
  private boolean retired;
  private final List<PointerDispatch> dispatches = new ArrayList<>();

  private final class PointerPacket implements Runnable {
    final View root;
    final CUIKeyboardScope emitter;
    final String identity;
    final WritableMap data;
    final List<WritableMap> registrations;
    boolean delivered;
    PointerPacket(View root, CUIKeyboardScope emitter, WritableMap data, List<WritableMap> registrations) {
      this.root = root; this.emitter = emitter; this.data = data; this.registrations = registrations;
      identity = CUIInputWindow.identity(root);
    }
    void hit(List<Integer> ancestry) {
      if (delivered) return;
      data.putInt("target", ancestry.isEmpty() ? View.NO_ID : ancestry.get(0));
      for (WritableMap entry : registrations) entry.putInt("depth", ancestry.indexOf(entry.getInt("targetTag")));
    }
    @Override public void run() {
      if (delivered || retired || !callback.isInstalled() || CUIWindowPointers.this.root.get() != root ||
          !root.isAttachedToWindow() || !identity.equals(CUIInputWindow.identity(root))) return;
      delivered = true;
      WritableArray values = Arguments.createArray();
      for (WritableMap entry : registrations) values.pushMap(entry);
      data.putArray("registrations", values);
      emitter.emitPointer(data);
    }
  }

  private final class PointerDispatch implements Runnable {
    final int action, actionIndex, device;
    final long downTime, eventTime;
    final List<Integer> ids = new ArrayList<>(), indices = new ArrayList<>();
    final List<PointerPacket> packets = new ArrayList<>();
    final List<View> surfaces = new ArrayList<>();
    final Set<Integer> conflicted = new HashSet<>();
    boolean closed;
    PointerDispatch(MotionEvent event) {
      action = event.getActionMasked(); actionIndex = event.getActionIndex(); device = event.getDeviceId();
      downTime = event.getDownTime(); eventTime = event.getEventTime();
      for (int i = 0; i < event.getPointerCount(); i++) ids.add(event.getPointerId(i));
    }
    boolean matches(MotionEvent event) {
      if (closed || event.getDeviceId() != device || event.getDownTime() != downTime || event.getEventTime() != eventTime) return false;
      for (int i = 0; i < event.getPointerCount(); i++) if (!ids.contains(event.getPointerId(i))) return false;
      int actual = event.getActionMasked();
      boolean start = action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN;
      boolean end = action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_POINTER_UP;
      if (start || end) {
        if (start ? actual != MotionEvent.ACTION_DOWN && actual != MotionEvent.ACTION_POINTER_DOWN
            : actual != MotionEvent.ACTION_UP && actual != MotionEvent.ACTION_POINTER_UP) return false;
        return event.getPointerId(event.getActionIndex()) == ids.get(actionIndex);
      }
      return actual == action;
    }
    void capture(View scope, MotionEvent event) {
      if (!matches(event)) return;
      View current = scope;
      List<View> chain = new ArrayList<>();
      while (!(current instanceof RootView)) {
        if (!(current.getParent() instanceof ViewGroup)) return;
        chain.add(current); current = (View)current.getParent();
      }
      View windowRoot = root.get();
      if (!(current instanceof ViewGroup) || !current.isAttachedToWindow() || current.getRootView() != windowRoot) return;
      for (int i = 0; i < packets.size(); i++) {
        if (conflicted.contains(i)) continue;
        int index = -1, id = ids.get(indices.get(i));
        for (int candidate = 0; candidate < event.getPointerCount(); candidate++)
          if (event.getPointerId(candidate) == id) { index = candidate; break; }
        if (index < 0) continue;
        View surface = surfaces.get(i);
        if (surface != null) {
          if (surface != current) {
            conflicted.add(i); packets.get(i).hit(java.util.Collections.emptyList());
          }
          continue;
        }
        float[] point = {event.getX(index), event.getY(index)};
        for (View child : chain) {
          child.getMatrix().mapPoints(point);
          ViewGroup parent = (ViewGroup)child.getParent();
          point[0] += child.getLeft() - parent.getScrollX();
          point[1] += child.getTop() - parent.getScrollY();
        }
        if (!Float.isFinite(point[0]) || !Float.isFinite(point[1])) continue;
        List<TouchTargetHelper.ViewTarget> path = TouchTargetHelper.findTargetPathAndCoordinatesForTouch(
            point[0], point[1], (ViewGroup)current, new float[2]);
        List<Integer> ancestry = new ArrayList<>();
        for (TouchTargetHelper.ViewTarget target : path) ancestry.add(target.getViewId());
        surfaces.set(i, current); packets.get(i).hit(ancestry);
      }
    }
    @Override public void run() {
      if (closed || retired || !callback.isInstalled()) return;
      for (PointerPacket packet : packets) {
        if (closed || retired || !callback.isInstalled()) return;
        packet.run();
      }
    }
  }

  static void pointerEvent(View scope, MotionEvent event) {
    CUIWindowPointers observer = observers.get(scope.getRootView());
    if (observer == null || observer.retired || observer.dispatches.isEmpty()) return;
    try { observer.dispatches.get(observer.dispatches.size() - 1).capture(scope, event); }
    catch (RuntimeException error) { observer.fail(error.toString()); observer.publish(); }
  }

  @Override public void finishPointer(Runnable delivery) {
    if (!(delivery instanceof PointerDispatch)) return;
    PointerDispatch dispatch = (PointerDispatch)delivery;
    dispatch.closed = true; dispatches.remove(dispatch);
  }

  static final class Registration {
    final String id;
    final int targetTag;
    WeakReference<View> target;
    Registration(String id, int targetTag) { this.id = id; this.targetTag = targetTag; }
  }

  // MotionEvent IDs are device-scoped. Each observed native stream gets one window identity.
  static final class PointerIdentities {
    private final Map<String, Integer> pointers = new HashMap<>();
    private final Map<Integer, Integer> primary = new HashMap<>();
    private final Map<Integer, Set<Integer>> active = new HashMap<>();
    private int serial;
    private String key(int device, int kind, int pointer, long downTime) { return device + ":" + kind + ":" + pointer + ":" + downTime; }
    Integer get(int device, int kind, int pointer, long downTime) { return pointers.get(key(device, kind, pointer, downTime)); }
    int start(int device, int kind, int pointer, long downTime) {
      String key = key(device, kind, pointer, downTime);
      Integer existing = pointers.get(key);
      if (existing != null) return existing;
      if (serial == Integer.MAX_VALUE) throw new IllegalStateException("Native motion: native pointer identities exhausted");
      int identity = ++serial;
      Set<Integer> held = active.computeIfAbsent(kind, ignored -> new HashSet<>());
      if (held.isEmpty()) primary.put(kind, identity);
      held.add(identity); pointers.put(key, identity);
      return identity;
    }
    boolean isPrimary(int kind, int identity) { return Integer.valueOf(identity).equals(primary.get(kind)); }
    void end(int device, int kind, int pointer, long downTime) {
      Integer identity = pointers.remove(key(device, kind, pointer, downTime));
      Set<Integer> held = active.get(kind);
      if (identity != null && held != null) { held.remove(identity); if (held.isEmpty()) { active.remove(kind); primary.remove(kind); } }
    }
    void clear() { pointers.clear(); primary.clear(); active.clear(); }
  }

  private CUIWindowPointers(View root, Window window) {
    this.root = new WeakReference<>(root);
    callback = new CUIWindowPointerCallback(window, this);
    root.getViewTreeObserver().addOnPreDrawListener(this);
  }

  private static boolean matches(Window window, View root) {
    return window != null && window.getDecorView() == root && root.isAttachedToWindow()
        && window.getDecorView().getWindowToken() == root.getWindowToken();
  }

  private static Window modalWindow(View view, View root, Set<View> visited) {
    if (!visited.add(view)) return null;
    if (view instanceof ReactModalHostView) {
      Dialog dialog = ((ReactModalHostView) view).getDialog();
      if (dialog != null && matches(dialog.getWindow(), root)) return dialog.getWindow();
    }
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup) view;
      for (int index = 0; index < group.getChildCount(); index++) {
        Window result = modalWindow(group.getChildAt(index), root, visited);
        if (result != null) return result;
      }
    }
    return null;
  }

  static Window actualWindow(CUIKeyboardScope scope, View root) {
    Activity activity = ((ThemedReactContext) scope.getContext()).getCurrentActivity();
    if (activity == null) return null;
    Window window = activity.getWindow();
    if (matches(window, root)) return window;
    return window == null ? null : modalWindow(window.getDecorView(), root, new HashSet<>());
  }

  static void refresh(CUIKeyboardScope scope) {
    View root = scope.getRootView();
    CUIWindowPointers observer = observers.get(root);
    boolean needed = false;
    for (CUIKeyboardScope candidate : CUIInputWindow.scopes(root)) needed |= candidate.hasPointerRegistrations();
    if (!needed) {
      if (observer != null) { observer.close(); observers.remove(root); }
      return;
    }
    if (observer == null) {
      Window window = actualWindow(scope, root);
      if (window == null) {
        scope.publishPointerStatus(false, "Native motion: actual Activity/modal window unavailable");
        return;
      }
      try { observer = new CUIWindowPointers(root, window); observers.put(root, observer); }
      catch (RuntimeException error) { scope.publishPointerStatus(false, error.toString()); return; }
    }
    observer.publish();
  }

  static void release(View root) {
    CUIWindowPointers observer = observers.get(root);
    if (observer == null) return;
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(root)) if (scope.hasPointerRegistrations()) { observer.publish(); return; }
    observer.close(); observers.remove(root);
  }

  private void publish() {
    View view = root.get();
    if (view == null) return;
    if (!retired && !callback.isInstalled()) fail("Native motion: actual window callback was replaced");
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(view))
      scope.publishPointerStatus(!retired && callback.isInstalled(), failure);
  }

  private void fail(String error) {
    failure = error;
    close();
  }

  private void close() {
    retired = true;
    for (PointerDispatch dispatch : dispatches) dispatch.closed = true;
    dispatches.clear();
    callback.close();
    identities.clear(); previousButtons.clear();
    View view = root.get();
    if (view != null && view.getViewTreeObserver().isAlive()) view.getViewTreeObserver().removeOnPreDrawListener(this);
  }

  @Override public boolean onPreDraw() { publish(); return true; }
  @Override public void focusChanged(boolean focused) { if (!focused) { identities.clear(); previousButtons.clear(); } publish(); }
  @Override public void detached() { fail("Native motion: observed window detached"); publish(); }
  @Override public void failed(RuntimeException error) { fail(error.toString()); publish(); }

  private PointerPacket packet(View view, String phase, int pointerId, String pointerType, boolean isPrimary,
      int button, int buttons, int nativeButtons, int modifiers, double x, double y, double timestamp,
      int target, List<Integer> ancestry) {
    if (retired || !callback.isInstalled() || !view.hasWindowFocus()) return null;
    List<CUIKeyboardScope> scopes = CUIInputWindow.scopes(view);
    CUIKeyboardScope emitter = null;
    List<WritableMap> registrations = new ArrayList<>();
    for (CUIKeyboardScope scope : scopes) {
      if (!scope.hasPointerRegistrations()) continue;
      boolean added = scope.appendPointerRegistrations(registrations, ancestry);
      if (added && emitter == null) emitter = scope;
    }
    if (emitter == null) return null;
    WritableMap data = Arguments.createMap();
    emitter.writePointerSession(data);
    data.putDouble("sequence", CUIInputWindow.nextWindowPointer(view)); data.putString("phase", phase);
    data.putInt("pointerId", pointerId); data.putString("pointerType", pointerType); data.putBoolean("isPrimary", isPrimary);
    data.putInt("button", button); data.putInt("buttons", buttons); data.putString("nativeButtons", Integer.toUnsignedString(nativeButtons));
    data.putBoolean("shiftKey", (modifiers & KeyEvent.META_SHIFT_ON) != 0); data.putBoolean("altKey", (modifiers & KeyEvent.META_ALT_ON) != 0);
    data.putBoolean("ctrlKey", (modifiers & KeyEvent.META_CTRL_ON) != 0); data.putBoolean("metaKey", (modifiers & KeyEvent.META_META_ON) != 0);
    data.putString("nativeModifiers", Integer.toUnsignedString(modifiers));
    data.putDouble("pageX", x); data.putDouble("pageY", y); data.putDouble("timestamp", timestamp);
    data.putInt("target", target);
    return new PointerPacket(view, emitter, data, registrations);
  }

  private static int button(int nativeButton) {
    if ((nativeButton & MotionEvent.BUTTON_PRIMARY) != 0) return 0;
    if ((nativeButton & MotionEvent.BUTTON_TERTIARY) != 0) return 1;
    if ((nativeButton & MotionEvent.BUTTON_SECONDARY) != 0) return 2;
    if ((nativeButton & MotionEvent.BUTTON_BACK) != 0) return 3;
    if ((nativeButton & MotionEvent.BUTTON_FORWARD) != 0) return 4;
    return -1;
  }
  private static int buttons(int value) {
    return (value & 3) | ((value & MotionEvent.BUTTON_TERTIARY) != 0 ? 4 : 0)
        | ((value & MotionEvent.BUTTON_BACK) != 0 ? 8 : 0) | ((value & MotionEvent.BUTTON_FORWARD) != 0 ? 16 : 0)
        | ((value & MotionEvent.BUTTON_STYLUS_PRIMARY) != 0 ? 2 : 0) | ((value & MotionEvent.BUTTON_STYLUS_SECONDARY) != 0 ? 32 : 0);
  }

  @Override public Runnable preparePointer(MotionEvent event, boolean generic) {
    if (generic || retired) return null;
    View view = root.get();
    if (!(view instanceof ViewGroup)) throw new IllegalStateException("Native motion: actual window root unavailable");
    int action = event.getActionMasked();
    String phase = action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN ? "start"
        : action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_POINTER_UP ? "end"
        : action == MotionEvent.ACTION_CANCEL ? "cancel" : action == MotionEvent.ACTION_MOVE ? "move" : null;
    if (phase == null) return null;
    PointerDispatch dispatch = new PointerDispatch(event);
    int first = "move".equals(phase) || "cancel".equals(phase) ? 0 : event.getActionIndex();
    int last = "move".equals(phase) || "cancel".equals(phase) ? event.getPointerCount() : first + 1;
    float density = view.getResources().getDisplayMetrics().density;
    for (int index = first; index < last; index++) {
      int nativePointer = event.getPointerId(index), tool = event.getToolType(index), device = event.getDeviceId();
      String pointerType = tool == MotionEvent.TOOL_TYPE_MOUSE ? "mouse" : tool == MotionEvent.TOOL_TYPE_STYLUS || tool == MotionEvent.TOOL_TYPE_ERASER ? "pen" : tool == MotionEvent.TOOL_TYPE_FINGER ? "touch" : null;
      if (pointerType == null) throw new IllegalStateException("Native motion: unsupported native pointer tool " + tool);
      int kind = "pen".equals(pointerType) ? MotionEvent.TOOL_TYPE_STYLUS : tool;
      Integer pointerId = identities.get(device, kind, nativePointer, event.getDownTime());
      if ("start".equals(phase)) pointerId = identities.start(device, kind, nativePointer, event.getDownTime());
      if (pointerId == null) continue;
      boolean isPrimary = "mouse".equals(pointerType) || identities.isPrimary(kind, pointerId);
      float x = event.getX(index), y = event.getY(index);
      List<Integer> ancestry = java.util.Collections.emptyList();
      int nativeButtons = event.getButtonState();
      int changed = event.getActionButton();
      if (changed == 0 && "mouse".equals(pointerType)) changed = previousButtons.getOrDefault(pointerId, 0) ^ nativeButtons;
      if (changed == 0 && ("start".equals(phase) || "end".equals(phase))) changed = nativeButtons == 0 ? MotionEvent.BUTTON_PRIMARY : nativeButtons;
      int mappedButtons = "mouse".equals(pointerType) ? buttons(nativeButtons) : buttons(nativeButtons) | ("end".equals(phase) || "cancel".equals(phase) ? 0 : 1);
      previousButtons.put(pointerId, nativeButtons);
      PointerPacket delivery = packet(view, phase, pointerId, pointerType, isPrimary, button(changed), mappedButtons, nativeButtons, event.getMetaState(), x / density, y / density, event.getEventTime(), ancestry.isEmpty() ? View.NO_ID : ancestry.get(0), ancestry);
      if (delivery != null) { dispatch.indices.add(index); dispatch.surfaces.add(null); dispatch.packets.add(delivery); }
      if ("end".equals(phase) || "cancel".equals(phase)) { identities.end(device, kind, nativePointer, event.getDownTime()); previousButtons.remove(pointerId); }
    }
    dispatches.add(dispatch);
    return dispatch;
  }

  static void activate(View target) {
    View root = target.getRootView();
    CUIWindowPointers observer = observers.get(root);
    if (observer == null || observer.retired) return;
    List<Integer> ancestry = new ArrayList<>();
    for (View view = target; view != null; view = view.getParent() instanceof View ? (View) view.getParent() : null) ancestry.add(view.getId());
    int[] location = new int[2], origin = new int[2];
    target.getLocationOnScreen(location); root.getLocationOnScreen(origin);
    float density = target.getResources().getDisplayMetrics().density;
    Runnable delivery = observer.packet(root, "activation", -1, "virtual", true, -1, 0, 0, 0,
        (location[0] - origin[0] + target.getWidth() / 2.0) / density,
        (location[1] - origin[1] + target.getHeight() / 2.0) / density,
        android.os.SystemClock.uptimeMillis(), target.getId(), ancestry);
    if (delivery != null) delivery.run();
  }
}
