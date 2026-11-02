package com.codonui.input;

import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.views.textinput.ReactEditText;
import com.facebook.react.views.view.ReactViewGroup;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.WeakHashMap;

final class CUIOriginalEditorWheel {
  static final class Registration {
    final String id, revision;
    final int targetTag, groupTarget;
    WeakReference<ReactEditText> original;
    WeakReference<View> group;
    String owner = "", published = "";
    boolean resolved, installed;
    Registration(String id, String revision, int targetTag, int groupTarget) {
      this.id=id; this.revision=revision; this.targetTag=targetTag; this.groupTarget=groupTarget;
    }
    boolean matches(Registration other) {
      return id.equals(other.id) && revision.equals(other.revision) && targetTag==other.targetTag && groupTarget==other.groupTarget;
    }
  }
  private static final WeakHashMap<ReactEditText, Registration> claimed = new WeakHashMap<>();
  private final CUIKeyboardScope scope;
  private List<Registration> registrations = new ArrayList<>();
  private final Set<String> conflictingIds = new HashSet<>();
  private final Set<Integer> conflictingTargets = new HashSet<>();
  private long sequence;
  CUIOriginalEditorWheel(CUIKeyboardScope scope) { this.scope=scope; }

  void update(List<Registration> next) {
    List<Registration> retained=new ArrayList<>();
    Set<String> ids=new HashSet<>(); Set<Integer> targets=new HashSet<>();
    conflictingIds.clear(); conflictingTargets.clear();
    for (Registration incoming : next) {
      Registration selected=incoming;
      for (Registration previous : registrations) if (incoming.matches(previous)) { selected=previous; break; }
      if (!ids.add(selected.id)) conflictingIds.add(selected.id);
      if (!targets.add(selected.targetTag)) conflictingTargets.add(selected.targetTag);
      retained.add(selected);
    }
    for (Registration previous : registrations) if (!retained.contains(previous)) release(previous);
    registrations=retained;
    publish();
  }
  private static boolean within(View child, View ancestor) {
    for (View view=child; view!=null; view=view.getParent() instanceof View ? (View)view.getParent() : null)
      if (view==ancestor) return true;
    return false;
  }
  private boolean current(Registration registration) {
    if (!scope.menuPointerCaptureReady() || registration.id.isEmpty() || registration.revision.isEmpty() ||
        registration.targetTag<=0 || registration.groupTarget<=0 || conflictingIds.contains(registration.id) ||
        conflictingTargets.contains(registration.targetTag)) return false;
    try {
      UIManager manager=UIManagerHelper.getUIManagerForReactTag((ThemedReactContext)scope.getContext(), registration.targetTag);
      if (manager==null) return false;
      View target=manager.resolveView(registration.targetTag), group=manager.resolveView(registration.groupTarget);
      // Only the pinned stock editor owns this listener slot; custom editor subclasses are not enrolled.
      if (target==null || target.getClass()!=ReactEditText.class || !(group instanceof ReactViewGroup) || target==group) return false;
      if (!registration.resolved) {
        registration.resolved=true; registration.original=new WeakReference<>((ReactEditText)target);
        registration.group=new WeakReference<>(group); registration.owner=scope.menuPointerOwnerId();
      }
      return registration.original.get()==target && registration.group.get()==group &&
        registration.owner.equals(scope.menuPointerOwnerId()) && target.isAttachedToWindow() && group.isAttachedToWindow() &&
        target.isShown() && group.isShown() && target.isEnabled() && ((ReactEditText)target).getKeyListener()!=null &&
        target.getRootView()==scope.getRootView() && group.getRootView()==scope.getRootView() &&
        within(target,group) && within(group,scope) && CUIInputWindow.identity(target).equals(CUIInputWindow.identity(scope));
    } catch (RuntimeException retired) { return false; }
  }
  private void release(Registration registration) {
    ReactEditText original=registration.original==null ? null : registration.original.get();
    if (original!=null && claimed.get(original)==registration) {
      original.setOnGenericMotionListener(null); claimed.remove(original);
    }
    registration.installed=false;
  }
  private boolean install(Registration registration) {
    if (!current(registration)) { release(registration); return false; }
    ReactEditText original=registration.original.get();
    Registration other=claimed.get(original);
    if (other!=null && other!=registration) return false;
    if (!registration.installed) {
      claimed.put(original,registration);
      original.setOnGenericMotionListener((view,event) -> receive(registration,view,event));
      registration.installed=true;
    }
    return true;
  }
  private WritableMap identity(Registration registration) {
    WritableMap data=Arguments.createMap(); scope.writePointerSession(data);
    data.putString("bindingId",registration.id); data.putString("bindingRevision",registration.revision);
    data.putInt("target",registration.targetTag); data.putInt("groupTarget",registration.groupTarget);
    data.putDouble("sequence",++sequence); return data;
  }
  void publish() {
    for (Registration registration : registrations) {
      boolean ready=install(registration);
      boolean active=scope.hasWindowFocus() && scope.isShown() && scope.isAttachedToWindow();
      String signature=scope.menuPointerOwnerId()+":"+CUIInputWindow.identity(scope)+":"+scope.menuPointerEpoch()+":"+ready+":"+active;
      if (signature.equals(registration.published)) continue;
      registration.published=signature;
      WritableMap data=identity(registration); data.putBoolean("ready",ready); data.putBoolean("windowActive",active);
      data.putString("sourceKind","android-generic-motion"); data.putString("error",ready ? "" : "original-editor-wheel-unavailable");
      scope.emitEditorWheelStatus(data);
    }
  }
  private boolean receive(Registration registration, View view, MotionEvent event) {
    if (event.getActionMasked()!=MotionEvent.ACTION_SCROLL || (event.getMetaState() & KeyEvent.META_CTRL_ON)!=0 ||
        !registrations.contains(registration) || !current(registration) || view!=registration.original.get() ||
        claimed.get((ReactEditText)view)!=registration) return false;
    boolean mouse=event.isFromSource(InputDevice.SOURCE_MOUSE);
    boolean trackpad=event.isFromSource(InputDevice.SOURCE_TOUCHPAD);
    if (!mouse && !trackpad) return false;
    View group=registration.group.get(), focused=group.findFocus();
    if (focused==null || focused.getId()<=0 || !within(focused,group)) return false;
    float horizontal=event.getAxisValue(MotionEvent.AXIS_HSCROLL), vertical=event.getAxisValue(MotionEvent.AXIS_VSCROLL);
    if (!Float.isFinite(horizontal) || !Float.isFinite(vertical)) return false;
    WritableMap data=identity(registration); data.putInt("focusedTarget",focused.getId());
    data.putDouble("timestamp",event.getEventTime()); data.putDouble("rawAxisX",horizontal); data.putDouble("rawAxisY",vertical);
    // Android vertical scroll is positive upwards; DOM content-scroll deltaY is positive downwards.
    data.putDouble("deltaX",horizontal); data.putDouble("deltaY",-vertical);
    data.putString("sourceKind",trackpad ? "trackpad" : "mouse"); data.putBoolean("nativeDefaultHandled",true);
    int modifiers=event.getMetaState();
    data.putBoolean("ctrlKey",false); data.putBoolean("altKey",(modifiers & KeyEvent.META_ALT_ON)!=0);
    data.putBoolean("metaKey",(modifiers & KeyEvent.META_META_ON)!=0); data.putBoolean("shiftKey",(modifiers & KeyEvent.META_SHIFT_ON)!=0);
    // This actual original-editor listener precedes its SDK default; even a horizontal/bound update is consumed.
    return scope.emitEditorWheel(data);
  }
  void dispose() { for (Registration registration : registrations) release(registration); registrations.clear(); }
}
