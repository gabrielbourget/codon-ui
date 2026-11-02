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
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UIManagerListener;
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

public final class CUIKeyboardScope extends ReactViewGroup implements UIManagerListener {
  final CUIDragInteractions dragInteractions = new CUIDragInteractions(this);
  private UIManager dragMountManager;
  boolean dragCaptureReady() { return dragInteractions.available(); }
  boolean dragEnabled() { return captureEnabled; }
  long dragEpoch() { return dragInteractions.epoch(); }
  String dragWindowId() { return dragInteractions.window(); }
  void emitDragStatus(String record) { WritableMap data=Arguments.createMap(); data.putString("packet",record); emit("topNativeDragStatus",data); }
  @Override public void didMountItems(UIManager manager) { if (manager == dragMountManager) { dragInteractions.refresh(); } ordinaryEditorKeys.publish(); editorWheel.publish(); publishToolbarStatus(); }
  @Override public void willDispatchViewUpdates(UIManager manager) {}
  @Override public void willMountItems(UIManager manager) {}
  @Override public void didDispatchMountItems(UIManager manager) {}
  @Override public void didScheduleMountItems(UIManager manager) {}
  final CUIDialogFocusScopes dialogs = new CUIDialogFocusScopes(this);
  boolean dialogFocusReady() { return captureReady(); }
  void emitDialogFocus(String name, WritableMap data) { emit(name, data); }
  final CUIOrdinaryEditorKeys ordinaryEditorKeys = new CUIOrdinaryEditorKeys(this);
  final CUIOriginalEditorWheel editorWheel = new CUIOriginalEditorWheel(this);
  void emitEditorWheelStatus(WritableMap data) { emit("topNativeEditorWheelStatus",data); }
  boolean emitEditorWheel(WritableMap data) {
    EventDispatcher dispatcher=UIManagerHelper.getEventDispatcherForReactTag((ThemedReactContext)getContext(),getId());
    if (dispatcher==null) return false;
    dispatcher.dispatchEvent(new ScopeEvent(UIManagerHelper.getSurfaceId(this),getId(),"topNativeEditorWheel",data));
    return true;
  }
  boolean menuPointerCaptureReady() { return captureReady(); }
  String menuPointerOwnerId() { return ownerId; }
  double menuPointerEpoch() { return windowEpoch; }
  private static final class ToolbarRole {
    final java.lang.ref.WeakReference<View> original;
    final Object role;
    final String capture;
    ToolbarRole(View original, Object role, String capture) { this.original=new java.lang.ref.WeakReference<>(original); this.role=role; this.capture=capture; }
  }
  static final class Toolbar {
    final String id, revision, orientation;
    final int rootTag;
    final boolean tabOnly;
    boolean resolved;
    String failure="";
    List<ToolbarRole> roles;
    java.lang.ref.WeakReference<View> original, last;
    Toolbar(org.json.JSONObject data) throws org.json.JSONException {
      id=data.getString("bindingId"); revision=data.getString("bindingRevision"); rootTag=data.getInt("rootTarget");
      orientation=data.getString("orientation"); tabOnly=data.optBoolean("tabOnly",false);
    }
  }
  private static final class ToolbarHold {
    final Toolbar binding;
    final View original;
    final double epoch;
    final String window;
    String disposition="ordinary";
    boolean consumed, retired;
    int requestedTarget=-1;
    boolean focusObserved;
    KeyEvent event;
    CUIKeyboardScope owner;
    org.json.JSONObject route;
    View observationTarget;
    boolean originalForwarded, cancelForwarded;
    ToolbarHold(Toolbar binding, View original, double epoch, String window) {
      this.binding=binding; this.original=original; this.epoch=epoch; this.window=window;
    }
  }
  private List<Toolbar> toolbars=new ArrayList<>();
  private static ToolbarHold toolbarDispatchHold;
  private final SparseArray<ToolbarHold> toolbarHeld=new SparseArray<>();
  private long toolbarSequence, toolbarEventId;
  private boolean toolbarMoving;
  private android.view.ViewTreeObserver toolbarObserver;
  private static KeyEvent toolbarOriginalEvent, toolbarObservedOriginalEvent;
  private final android.view.ViewTreeObserver.OnGlobalFocusChangeListener toolbarFocusChanged=(before, after) -> {
    if (toolbarMoving || !captureReady()) return;
    refreshToolbarRolesInWindow();
    Toolbar binding=outermostToolbar(after,null,true);
    if (binding == null || !toolbars.contains(binding) || !toolbarEligible(binding, after)) return;
    if (binding.tabOnly) return;
    View last=binding.last == null ? null : binding.last.get();
    if (outermostToolbar(before,null,true) != binding && toolbarEligible(binding, last)) {
      toolbarMoving=true;
      try { last.requestFocus(); } finally { toolbarMoving=false; }
    } else binding.last=new java.lang.ref.WeakReference<>(after);
  };
  void setToolbarBindings(String value) {
    List<Toolbar> next=new ArrayList<>();
    try {
      org.json.JSONArray data=new org.json.JSONArray(value == null ? "[]" : value);
      for (int index=0; index<data.length(); index++) {
        Toolbar binding=new Toolbar(data.getJSONObject(index));
        for (Toolbar old : toolbars) if (old.id.equals(binding.id) && old.revision.equals(binding.revision) && old.rootTag == binding.rootTag) {
          binding=old; break;
        }
        next.add(binding);
      }
    } catch (org.json.JSONException error) { next.clear(); }
    if (!toolbars.equals(next)) retireToolbarHeld();
    toolbars=next;
    attachToolbarObserver();
  }
  private View toolbarRoot(Toolbar binding) {
    View current=getRootView().findViewById(binding.rootTag);
    if (!binding.resolved && current != null) { binding.resolved=true; binding.original=new java.lang.ref.WeakReference<>(current); }
    View root=binding.original == null ? null : binding.original.get();
    return root != null && root == current && root.isAttachedToWindow() && root.getRootView() == getRootView() && insideToolbarView(root, this) ? root : null;
  }
  private static boolean insideToolbarView(View target, View root) {
    for (View view=target; view != null; view=view.getParent() instanceof View ? (View)view.getParent() : null) if (view == root) return true;
    return false;
  }
  private Toolbar toolbarAt(View view) {
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(this)) if (scope.captureReady())
      for (Toolbar binding : scope.toolbars) if (scope.toolbarRoot(binding) == view) return binding;
    return null;
  }
  private static Object originalToolbarRole(View view) {
    Object role=view.getTag(com.facebook.react.R.id.role);
    return role != null ? role : view.getTag(com.facebook.react.R.id.accessibility_role);
  }
  private boolean toolbarAncestor(View root) {
    for (View view=root == null ? null : root.getParent() instanceof View ? (View)root.getParent() : null; view != null; view=view.getParent() instanceof View ? (View)view.getParent() : null) {
      Object role=originalToolbarRole(view);
      if (role != null && "toolbar".equalsIgnoreCase(role.toString())) return true;
    }
    return false;
  }
  private CUIKeyboardScope toolbarOwner(Toolbar binding) {
    if (binding == null) return null;
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(this)) if (scope.toolbars.contains(binding)) return scope;
    return null;
  }
  private boolean toolbarObservationAvailable(Toolbar binding) {
    View root=toolbarRoot(binding);
    return captureReady() && root != null && ordinaryEditorKeys.canObserveTarget(root);
  }
  private boolean toolbarCaptureAvailable(Toolbar binding) {
    return toolbarObservationAvailable(binding) && !toolbarAncestor(toolbarRoot(binding));
  }
  private int toolbarDelta(Toolbar binding, KeyEvent event) {
    if (binding.tabOnly) return 0;
    if (event.isAltPressed() || event.isCtrlPressed() || event.isMetaPressed() || event.isShiftPressed()) return 0;
    int code=event.getKeyCode();
    if ("vertical".equals(binding.orientation)) return code == KeyEvent.KEYCODE_DPAD_DOWN ? 1 : code == KeyEvent.KEYCODE_DPAD_UP ? -1 : 0;
    boolean rtl=toolbarRoot(binding).getLayoutDirection() == View.LAYOUT_DIRECTION_RTL;
    return code == KeyEvent.KEYCODE_DPAD_RIGHT ? (rtl ? -1 : 1) : code == KeyEvent.KEYCODE_DPAD_LEFT ? (rtl ? 1 : -1) : 0;
  }
  private Toolbar outermostToolbar(View focused, KeyEvent event, boolean capture) {
    if (focused == null || !captureReady()) return null;
    Toolbar selected=null;
    for (View view=focused; view != null; view=view.getParent() instanceof View ? (View)view.getParent() : null) {
      Toolbar binding=toolbarAt(view);
      CUIKeyboardScope owner=toolbarOwner(binding);
      if (binding == null || owner == null || !(capture ? owner.toolbarCaptureAvailable(binding) : owner.toolbarObservationAvailable(binding))) continue;
      if (event != null && owner.toolbarDelta(binding,event) == 0 && !(event.getKeyCode() == KeyEvent.KEYCODE_TAB && !event.isAltPressed() && !event.isCtrlPressed() && !event.isMetaPressed())) continue;
      // Capture walks from outer to inner; an unhandled orientation falls through.
      selected=binding;
    }
    return selected;
  }
  private Toolbar toolbarForEvent(View focused, KeyEvent event) {
    boolean tab=event.getKeyCode() == KeyEvent.KEYCODE_TAB;
    boolean editable=focused instanceof CUIDateSegment || (focused != null && focused.onCheckIsTextEditor());
    Toolbar navigation=!toolbarComposing(focused) && (tab || !editable) ? outermostToolbar(focused,event,true) : null;
    return navigation != null ? navigation : outermostToolbar(focused,null,false);
  }
  private boolean refreshToolbarRoles() {
    boolean changed=false;
    for (Toolbar binding : toolbars) {
      List<ToolbarRole> roles=new ArrayList<>();
      for (View view=toolbarRoot(binding); view != null; view=view.getParent() instanceof View ? (View)view.getParent() : null) {
        Toolbar capture=toolbarAt(view);
        roles.add(new ToolbarRole(view,originalToolbarRole(view),capture == null ? "" : capture.id+":"+capture.revision+":"+capture.rootTag));
      }
      boolean same=binding.roles != null && binding.roles.size() == roles.size();
      for (int index=0; same && index<roles.size(); index++) {
        ToolbarRole before=binding.roles.get(index), after=roles.get(index);
        same=before.original.get() == after.original.get() && Objects.equals(before.role,after.role) && before.capture.equals(after.capture);
      }
      if (same) continue;
      boolean replacing=binding.roles != null; binding.roles=roles; changed=true;
      if (!replacing) continue;
      binding.last=null;
      for (int index=toolbarHeld.size()-1; index>=0; index--) {
        ToolbarHold hold=toolbarHeld.valueAt(index); if (hold.binding != binding) continue;
        if (!hold.retired && hold.event != null) emitToolbarKey(hold,hold.event,-1,true);
        hold.retired=true; toolbarHeld.removeAt(index);
      }
    }
    return changed;
  }
  private void refreshToolbarRolesInWindow() {
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(this)) if (scope.refreshToolbarRoles()) scope.publishToolbarStatus();
  }
  private boolean toolbarEligible(Toolbar binding, View view) {
    View root=toolbarRoot(binding);
    if (view instanceof CUIDateSegment && (((CUIDateSegment)view).segmentDisabled || !((CUIDateSegment)view).segmentEditable)) return false;
    if (root == null || view == null || view == root || !view.isFocusable() || !view.isEnabled() || !view.isShown() || !view.isAttachedToWindow() || !toolbarObservationAvailable(binding)) return false;
    for (View current=view; current != null; current=current.getParent() instanceof View ? (View)current.getParent() : null) {
      if (current == root) return true;
    }
    return false;
  }
  private List<View> toolbarCandidates(Toolbar binding) {
    View root=toolbarRoot(binding); List<View> result=new ArrayList<>();
    if (root != null) for (View candidate : root.getFocusables(View.FOCUS_FORWARD)) if (toolbarEligible(binding, candidate) && !result.contains(candidate)) result.add(candidate);
    return result;
  }
  private static boolean toolbarComposing(View focused) {
    if (focused instanceof CUIDateSegment) return ((CUIDateSegment)focused).isSegmentComposing();
    if (!(focused instanceof EditText)) return false;
    Editable text=((EditText)focused).getText(); return text != null && BaseInputConnection.getComposingSpanStart(text) >= 0;
  }
  private Boolean dispatchToolbarKey(KeyEvent event, View focused) {
    refreshToolbarRolesInWindow();
    int code=event.getKeyCode(); boolean down=event.getAction() == KeyEvent.ACTION_DOWN;
    CUIKeyboardScope owner=null; ToolbarHold hold=null;
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(this)) {
      ToolbarHold candidate=scope.toolbarHeld.get(code);
      if (candidate != null) { owner=scope; hold=candidate; break; }
    }
    if (hold == null && down && event.getRepeatCount() == 0) {
      Toolbar binding=toolbarForEvent(focused,event);
      if (binding == null) return null;
      for (CUIKeyboardScope scope : CUIInputWindow.scopes(this)) if (scope.toolbars.contains(binding)) { owner=scope; break; }
      if (owner == null) return null;
      hold=new ToolbarHold(binding, focused, owner.windowEpoch, CUIInputWindow.identity(owner));
      hold.owner=owner;
      owner.toolbarHeld.put(code, hold);
    }
    if (hold == null) return null;
    hold.event=new KeyEvent(event);
    toolbarDispatchHold=hold;
    Toolbar binding=hold.binding;
    if (!owner.captureReady() || owner.windowEpoch != hold.epoch || !hold.window.equals(CUIInputWindow.identity(owner)) || !owner.toolbars.contains(binding) || owner.toolbarRoot(binding) == null || !owner.toolbarEligible(binding, hold.original)) hold.retired=true;
    boolean routing=hold.consumed || "tab".equals(hold.disposition);
    int destination=-1;
    if (!hold.retired && down) {
      boolean unmodified=!event.isAltPressed() && !event.isCtrlPressed() && !event.isMetaPressed();
      boolean tab=code == KeyEvent.KEYCODE_TAB && unmodified;
      int delta=owner.toolbarDelta(binding,event);
      if (focused instanceof CUIDateSegment || (focused != null && focused.onCheckIsTextEditor())) delta=0;
      if ((tab || delta != 0) && !toolbarComposing(focused) && owner.toolbarCaptureAvailable(binding)) {
        List<View> candidates=owner.toolbarCandidates(binding); int index=candidates.indexOf(focused);
        if (index >= 0 && !candidates.isEmpty()) {
          View target=tab ? candidates.get(event.isShiftPressed() ? 0 : candidates.size()-1) : candidates.get(Math.max(0, Math.min(candidates.size()-1, index+delta)));
          hold.requestedTarget=target.getId(); hold.disposition=tab ? "tab" : "arrow"; hold.consumed=!tab; routing=true;
          owner.toolbarMoving=true;
          boolean moved;
          try { moved=target == focused || target.requestFocus(); } finally { owner.toolbarMoving=false; }
          hold.focusObserved=getRootView().findFocus() == target;
          if (moved && hold.focusObserved) {
            destination=target.getId(); hold.disposition=tab ? "tab" : "arrow"; hold.consumed=!tab; routing=true;
            // Tab's temporary edge must not replace the remembered reentry original.
            binding.last=new java.lang.ref.WeakReference<>(tab ? focused : target);
          } else { binding.failure=moved ? "original-toolbar-focus-completion-not-observed" : "original-toolbar-focus-request-refused"; owner.publishToolbarStatus(); }
        }
      }
    }
    if (!hold.retired) owner.emitToolbarKey(hold, event, destination, event.isCanceled());
    if (!down) owner.toolbarHeld.remove(code);
    return routing ? hold.consumed : null;
  }
  private void emitToolbarKey(ToolbarHold hold, KeyEvent event, int destination, boolean cancelled) {
    try {
      org.json.JSONObject data=toolbarPacket(hold.binding);
      data.put("windowId",hold.window); data.put("epoch",hold.epoch); data.put("eventId",++toolbarEventId);
      data.put("target",hold.original.getId()); data.put("focusedTarget",hold.original.getId()); data.put("requestedTarget",hold.requestedTarget); data.put("destinationTarget",destination); data.put("focusObserved",hold.focusObserved);
      data.put("phase",event.getAction() == KeyEvent.ACTION_DOWN && !cancelled ? "down" : "up");
      data.put("key",CUIInputWindow.keyName(event)); data.put("nativeCode",event.getKeyCode());
      int unicode=event.getUnicodeChar(); String characters=event.getCharacters();
      data.put("characters",characters != null ? characters : unicode != 0 && Character.isValidCodePoint(unicode) ? new String(Character.toChars(unicode)) : "");
      data.put("repeat",event.getRepeatCount()>0); data.put("cancelled",cancelled); data.put("isComposing",toolbarComposing(hold.original));
      data.put("shiftKey",event.isShiftPressed()); data.put("altKey",event.isAltPressed()); data.put("ctrlKey",event.isCtrlPressed()); data.put("metaKey",event.isMetaPressed()); data.put("capsLock",event.isCapsLockOn());
      data.put("nativeModifierData",Integer.toUnsignedString(event.getMetaState())); data.put("nativeDefaultHandled",hold.consumed); data.put("disposition",hold.disposition); data.put("timestamp",event.getEventTime());
      org.json.JSONArray path=new org.json.JSONArray();
      for (View view=hold.original; view != null; view=view.getParent() instanceof View ? (View)view.getParent() : null) if (view.getId() > 0) path.put(view.getId());
      data.put("physicalPath",path);
      hold.observationTarget=event.getAction() == KeyEvent.ACTION_UP && !cancelled ? getRootView().findFocus() : hold.original;
      hold.route=null;
      if (toolbarEligible(hold.binding,hold.observationTarget)) {
        org.json.JSONObject route=new org.json.JSONObject(data.toString()); org.json.JSONArray originalPath=new org.json.JSONArray();
        for (View view=hold.observationTarget; view != null; view=view.getParent() instanceof View ? (View)view.getParent() : null) if (view.getId() > 0) originalPath.put(view.getId());
        route.put("physicalPath",originalPath); hold.route=route;
      }
      emitToolbarPacket("topNativeToolbarKeyboard",data);
    } catch (org.json.JSONException ignored) { }
  }
  private org.json.JSONObject toolbarPacket(Toolbar binding) throws org.json.JSONException {
    org.json.JSONObject data=new org.json.JSONObject();
    data.put("ownerId",ownerId); data.put("windowId",CUIInputWindow.identity(this)); data.put("epoch",windowEpoch);
    data.put("bindingId",binding.id); data.put("bindingRevision",binding.revision); data.put("rootTarget",binding.rootTag); return data;
  }
  private void emitToolbarPacket(String name, org.json.JSONObject packet) {
    WritableMap data=Arguments.createMap(); data.putString("packet",packet.toString()); emit(name,data);
  }
  private void publishToolbarStatus() {
    refreshToolbarRoles();
    for (int index=toolbarHeld.size()-1; index>=0; index--) {
      ToolbarHold hold=toolbarHeld.valueAt(index);
      if (!captureReady() || hold.epoch != windowEpoch || !toolbars.contains(hold.binding) || !toolbarEligible(hold.binding, hold.original)) {
        hold.retired=true; toolbarHeld.removeAt(index);
      }
    }
    for (Toolbar binding : toolbars) try {
      org.json.JSONObject data=toolbarPacket(binding); data.put("sequence",++toolbarSequence);
      View root=toolbarRoot(binding); data.put("nestedToolbar",root != null && toolbarAncestor(root));
      data.put("observationReady",captureReady() && root != null && ordinaryEditorKeys.canObserveTarget(root));
      data.put("ready",captureReady() && root != null && binding.failure.isEmpty() && ordinaryEditorKeys.canObserveTarget(root)); data.put("windowActive",windowActive());
      data.put("error",root == null ? "original-toolbar-root-unavailable" : binding.failure); emitToolbarPacket("topNativeToolbarStatus",data);
    } catch (org.json.JSONException ignored) { }
  }
  private static ToolbarHold originalToolbarHold(View original, KeyEvent event) {
    if (original == null) return null;
    ToolbarHold hold=toolbarDispatchHold;
    if (hold != null && hold.event.getKeyCode() == event.getKeyCode() && insideToolbarView(hold.observationTarget == null ? hold.original : hold.observationTarget,original)) return hold;
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(original)) {
      ToolbarHold candidate=scope.toolbarHeld.get(event.getKeyCode());
      if (candidate != null && insideToolbarView(candidate.observationTarget == null ? candidate.original : candidate.observationTarget,original)) return candidate;
    }
    return null;
  }
  static boolean toolbarCancelledOriginal(View original, KeyEvent event) {
    ToolbarHold hold=originalToolbarHold(original,event); return hold != null && hold.cancelForwarded;
  }
  static CUIKeyboardScope toolbarOriginalOwner(View original, KeyEvent event) {
    ToolbarHold hold=originalToolbarHold(original,event); return hold == null || toolbarRouteForOriginal(original,event) == null ? null : hold.owner;
  }
  static String toolbarRouteForOriginal(View original, KeyEvent event) {
    if (original == null) return null;
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(original)) if (scope.refreshToolbarRoles()) scope.publishToolbarStatus();
    ToolbarHold hold=originalToolbarHold(original,event);
    if (hold == null || hold.retired || hold.route == null || !hold.owner.captureReady() || hold.epoch != hold.owner.windowEpoch || !hold.owner.toolbars.contains(hold.binding) || !hold.owner.toolbarEligible(hold.binding,hold.original) || !hold.owner.ordinaryEditorKeys.canObserveTarget(hold.owner.toolbarRoot(hold.binding))) return null;
    return hold.route.toString();
  }
  static String toolbarDateRouteForOriginal(View original, KeyEvent event) {
    String encoded=toolbarRouteForOriginal(original,event); if (encoded == null) return null;
    try {
      org.json.JSONObject route=new org.json.JSONObject(encoded); org.json.JSONArray observers=new org.json.JSONArray();
      for (CUIKeyboardScope scope : CUIInputWindow.scopes(original)) scope.ordinaryEditorKeys.appendToolbarObservers(observers);
      route.put("observerBindings",observers); return route.toString();
    } catch (org.json.JSONException invalid) { return null; }
  }
  static void toolbarOriginalDidEmit(View original, KeyEvent event) {
    ToolbarHold hold=originalToolbarHold(original,event);
    if (hold != null && toolbarRouteForOriginal(original,event) != null) {
      hold.originalForwarded=true;
      if (toolbarOriginalEvent == event) toolbarObservedOriginalEvent=event;
    }
  }
  static boolean bypassObservedToolbarTabTarget(View target, KeyEvent event) {
    ToolbarHold hold=toolbarDispatchHold;
    return toolbarOriginalEvent == event && toolbarObservedOriginalEvent == event && event.getAction() == KeyEvent.ACTION_DOWN && event.getKeyCode() == KeyEvent.KEYCODE_TAB &&
        hold != null && hold.originalForwarded && !hold.consumed && "tab".equals(hold.disposition) &&
        target.getRootView() == hold.owner.getRootView() && toolbarRouteForOriginal(hold.original,event) != null;
  }
  static boolean routeOriginalToolbarKey(View target, KeyEvent event, boolean down, boolean cancelled, boolean handled) {
    ToolbarHold hold=originalToolbarHold(target,event);
    if (hold == null || !hold.originalForwarded) return false;
    if (cancelled && !hold.cancelForwarded && toolbarRouteForOriginal(target,event) != null) {
      hold.cancelForwarded=true;
      hold.owner.emitToolbarKey(hold,event,-1,true);
      CUIOrdinaryEditorKeys.dispatchToolbarCancellation(CUIInputWindow.scopes(target),event,hold.original,handled);
      hold.retired=true;
    }
    return true;
  }
  private void retireToolbarHeld() {
    for (int index=0; index<toolbarHeld.size(); index++) {
      ToolbarHold hold=toolbarHeld.valueAt(index);
      if (!hold.retired && hold.event != null) emitToolbarKey(hold, hold.event, -1, true);
      hold.retired=true;
    }
    toolbarHeld.clear();
    for (Toolbar binding : toolbars) binding.last=null;
  }
  private void attachToolbarObserver() {
    if (!isAttachedToWindow() || toolbars.isEmpty()) return;
    android.view.ViewTreeObserver next=getRootView().getViewTreeObserver();
    if (toolbarObserver == next) return;
    detachToolbarObserver(); toolbarObserver=next; toolbarObserver.addOnGlobalFocusChangeListener(toolbarFocusChanged);
  }
  private void detachToolbarObserver() {
    if (toolbarObserver != null && toolbarObserver.isAlive()) toolbarObserver.removeOnGlobalFocusChangeListener(toolbarFocusChanged);
    toolbarObserver=null;
  }

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
    final boolean originalEditorAction;
    Policy(String id, Set<String> tokens, boolean excludeEditable, boolean excludeComposing, int targetTag) {
      this(id,tokens,excludeEditable,excludeComposing,targetTag,false);
    }
    Policy(String id, Set<String> tokens, boolean excludeEditable, boolean excludeComposing, int targetTag, boolean originalEditorAction) {
      this.id = id; this.tokens = new HashSet<>(tokens); this.excludeEditable = excludeEditable;
      this.targetTag = targetTag;
      this.excludeComposing = excludeComposing;
      this.originalEditorAction = originalEditorAction;
    }
    @Override public boolean equals(Object other) {
      if (!(other instanceof Policy)) return false;
      Policy policy = (Policy) other;
      return id.equals(policy.id) && tokens.equals(policy.tokens) && excludeEditable == policy.excludeEditable && excludeComposing == policy.excludeComposing && targetTag == policy.targetTag && originalEditorAction == policy.originalEditorAction;
    }
    @Override public int hashCode() { return Objects.hash(id, tokens, excludeEditable, excludeComposing, targetTag, originalEditorAction); }
  }
  private static final class Hold {
    final Policy policy;
    org.json.JSONObject originalBinding;
    final java.lang.ref.WeakReference<View> original;
    final String policyId;
    final String ownerId;
    final int focusedTarget;
    KeyEvent event;
    boolean retired;
    final String windowId;
    final double epoch;
    final double policyRevision;
    Hold(Policy policy, String ownerId, View focused, KeyEvent event, String windowId, double epoch, double policyRevision) {
      this.policy=policy; this.original=new java.lang.ref.WeakReference<>(focused);
      this.policyId = policy.id; this.ownerId = ownerId; this.focusedTarget = focused == null ? View.NO_ID : focused.getId(); this.event = new KeyEvent(event);
      this.windowId = windowId; this.epoch = epoch; this.policyRevision = policyRevision;
    }
  }

  private String ownerId = "";
  private boolean captureEnabled = true;
  private List<Policy> policies = new ArrayList<>();
  private final SparseArray<Hold> held = new SparseArray<>();
  private long originalEditorDispatchId;
  private static KeyEvent originalEditorActionEvent;
  private static org.json.JSONObject originalEditorActionFrame;
  private static boolean originalEditorDispatchAdmission;
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
    dragInteractions.refreshWindow();
    ordinaryEditorKeys.publish();
    editorWheel.publish();
    publishToolbarStatus();
    CUIWindowPointers.refresh(this);
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
    boolean editable = focused instanceof CUIDateSegment || (focused != null && focused.onCheckIsTextEditor());
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
    dialogs.beginKey(event);
    boolean handled=false;
    try { handled=dispatchOriginalKeyEvent(event); return handled; }
    finally { dialogs.finishKey(event, handled); }
  }
  @Override public View focusSearch(View focused, int direction) {
    View next=super.focusSearch(focused, direction);
    View wrapped=dialogs.redirect(focused, next, direction);
    return wrapped == null ? next : wrapped;
  }
  private boolean dispatchOriginalKeyEvent(KeyEvent event) {
    if (!isAttachedToWindow() || !hasWindowFocus() || (event.getAction() != KeyEvent.ACTION_DOWN && event.getAction() != KeyEvent.ACTION_UP)) return super.dispatchKeyEvent(event);
    boolean down = event.getAction() == KeyEvent.ACTION_DOWN;
    if (down) recordModality("keyboard", event.getEventTime());
    boolean outer = CUIInputWindow.beginKey(this);
    try {
      View toolbarOriginalFocus=getRootView().findFocus();
      boolean originalEditorCaptured=outer && dispatchOriginalEditorAction(event,toolbarOriginalFocus);
      Boolean toolbarRoute=outer ? dispatchToolbarKey(event, toolbarOriginalFocus) : null;
      if (outer && Boolean.FALSE.equals(toolbarRoute)) toolbarOriginalEvent=event;
      if (outer && down) {
        View focused = toolbarOriginalFocus;
        List<CUIKeyboardScope> scopes = CUIInputWindow.scopes(this);
        boolean captured = focused instanceof CUIFocusView && ((CUIFocusView) focused).capturesObservedKey(event);
        for (CUIKeyboardScope candidate : scopes) captured |= candidate.held.get(event.getKeyCode()) != null || candidate.localPolicyFor(event, focused) != null;
        captured |= Boolean.TRUE.equals(toolbarRoute);
        long eventId = CUIInputWindow.nextObservedEvent(this);
        for (CUIKeyboardScope candidate : scopes) candidate.observeKey(event, focused, eventId, captured);
      }
      View focused = toolbarRoute != null ? toolbarOriginalFocus : getRootView().findFocus();
      if (outer && toolbarRoute == null && focused instanceof CUIDateSegment && ((CUIDateSegment)focused).capturesOrdinaryEvent(event)) {
        boolean alreadyHeld = false;
        for (CUIKeyboardScope scope : CUIInputWindow.scopes(this)) alreadyHeld |= scope.held.get(event.getKeyCode()) != null;
        if (!alreadyHeld) return super.dispatchKeyEvent(event);
      }
      boolean captured;
      originalEditorDispatchAdmission=outer && toolbarRoute==null;
      try { captured = originalEditorCaptured || Boolean.TRUE.equals(toolbarRoute) || (toolbarOriginalEvent != event && dispatchCapturedKey(event)); }
      finally { originalEditorDispatchAdmission=false; }
      if (outer && captured && focused instanceof CUIDateSegment) ((CUIDateSegment)focused).observeCapturedOrdinaryKey(event);
      else if (outer && down && Boolean.FALSE.equals(toolbarRoute) && focused instanceof CUIDateSegment) ((CUIDateSegment)focused).observeToolbarOrdinaryKey(event,false);
      if (outer) CUIOrdinaryEditorKeys.dispatch(CUIInputWindow.scopes(this), event, toolbarRoute != null ? toolbarOriginalFocus : getRootView().findFocus(), captured);
      return captured || super.dispatchKeyEvent(event);
    } finally { if (outer) { if (toolbarOriginalEvent == event) toolbarOriginalEvent=null; if (toolbarObservedOriginalEvent == event) toolbarObservedOriginalEvent=null; toolbarDispatchHold=null; originalEditorActionEvent=null; originalEditorActionFrame=null; } CUIInputWindow.endKey(this); }
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
  private boolean originalEditorPolicyStillWins(KeyEvent event, View focused) {
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(this)) if (scope!=this && scope.policyOrder>policyOrder && scope.localPolicyFor(event,focused)!=null) return false;
    return true;
  }
  private boolean dispatchOriginalEditorAction(KeyEvent event, View focused) {
    CUIKeyboardScope owner=null;
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(this)) {
      Hold old=scope.held.get(event.getKeyCode());
      if (old!=null && old.policy.originalEditorAction && event.getAction()==KeyEvent.ACTION_DOWN && event.getRepeatCount()==0) { scope.held.remove(event.getKeyCode());old=null; }
      if (old!=null) { if (old.policy.originalEditorAction) owner=scope; else return false; break; }
      Policy policy=scope.localPolicyFor(event,focused);
      if (policy!=null && (owner==null || scope.policyOrder>owner.policyOrder)) owner=scope;
    }
    if (owner==null) return false;
    Hold heldPolicy=owner.held.get(event.getKeyCode());
    Policy policy=heldPolicy!=null ? heldPolicy.policy : owner.localPolicyFor(event,focused);
    if (policy==null || !policy.originalEditorAction) return false;
    originalEditorDispatchAdmission=true;
    try { return owner.capture(event,focused); } finally { originalEditorDispatchAdmission=false; }
  }
  private boolean dispatchCapturedKey(KeyEvent event) {
    if (toolbarOriginalEvent == event) return false;
    if (!isAttachedToWindow() || !hasWindowFocus() || (event.getAction() != KeyEvent.ACTION_DOWN && event.getAction() != KeyEvent.ACTION_UP)) return false;
    View focused = getRootView().findFocus();
    int code = event.getKeyCode();
    CUIKeyboardScope owner = null;
    boolean segmentOwns = focused instanceof CUIDateSegment && ((CUIDateSegment)focused).capturesOrdinaryEvent(event);
    for (CUIKeyboardScope candidate : CUIInputWindow.scopes(this)) {
      if (candidate.held.get(code) != null) { owner = candidate; break; }
      if (!segmentOwns && candidate.localPolicyFor(event, focused) != null && (owner == null || candidate.policyOrder > owner.policyOrder)) owner = candidate;
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
      if (policy.originalEditorAction && (!originalEditorDispatchAdmission || focused == null || focused.getId()!=policy.targetTag || !ordinaryEditorKeys.canObserveTarget(focused))) return false;
      hold = new Hold(policy, ownerId, focused, event, CUIInputWindow.identity(this), windowEpoch, policyRevision);
      if (policy.originalEditorAction) { hold.originalBinding=ordinaryEditorKeys.actionBinding(focused,event); if (hold.originalBinding==null) return false; }
      hold.retired = event.getRepeatCount() > 0;
      held.put(code, hold);
    }
    if (hold == null) return false;
    hold.event = new KeyEvent(event);
    if (hold.policy.originalEditorAction) {
      if (originalEditorActionEvent==event && originalEditorActionFrame!=null) return originalEditorActionFrame.optBoolean("admitted");
      org.json.JSONObject binding=ordinaryEditorKeys.actionBinding(focused,event);
      boolean fresh=binding!=null && hold.originalBinding!=null && binding.optString("bindingId").equals(hold.originalBinding.optString("bindingId")) && binding.optString("bindingRevision").equals(hold.originalBinding.optString("bindingRevision")) && originalEditorDispatchAdmission && captureReady() && focused!=null && focused==hold.original.get() && focused.getId()==hold.policy.targetTag &&
        ordinaryEditorKeys.canObserveTarget(focused) && hold.policy.equals(localPolicyFor(event,focused)) && originalEditorPolicyStillWins(event,focused) && hold.epoch==windowEpoch && hold.policyRevision==policyRevision && hold.windowId.equals(CUIInputWindow.identity(this));
      if (!fresh || event.isCanceled()) hold.retired=true;
      boolean admitted=down && !hold.retired && fresh && !event.isCanceled();
      try {
        originalEditorActionEvent=event;
        originalEditorActionFrame=new org.json.JSONObject().put("ownerId",hold.ownerId).put("policyId",hold.policyId).put("policyRevision",hold.policyRevision)
          .put("windowId",hold.windowId).put("epoch",hold.epoch).put("targetTag",hold.policy.targetTag).put("bindingId",hold.originalBinding.optString("bindingId")).put("bindingRevision",hold.originalBinding.optString("bindingRevision")).put("dispatchId",++originalEditorDispatchId)
          .put("admitted",admitted).put("isComposing",focused instanceof EditText && ((EditText)focused).getText()!=null && BaseInputConnection.getComposingSpanStart(((EditText)focused).getText())>=0);
        if (admitted) emitKey(hold,true,false);
      } catch (org.json.JSONException unavailable) { originalEditorActionFrame=null; }
      if (!down) held.remove(code);
      return admitted;
    }
    if (!hold.retired) emitKey(hold, down, event.isCanceled());
    if (!down) held.remove(code);
    return true;
  }

  @Override public boolean dispatchTouchEvent(MotionEvent event) {
    CUIInputWindow.pointerEvent(this, event);
    if (event.getActionMasked() == MotionEvent.ACTION_DOWN && hasWindowFocus()) {
      recordModality("pointer", event.getEventTime());
    }
    CUIInputWindow.beginPointer(this);
    try {
      boolean handled=super.dispatchTouchEvent(event);
      dragInteractions.touch(event);
      return handled;
    } finally {
      CUIInputWindow.endPointer(this);
    }
  }
  @Override public boolean dispatchDragEvent(android.view.DragEvent event) {
    CUIDragInteractions.beginDispatch();
    try {
      float[] point=(event.getAction()==android.view.DragEvent.ACTION_DRAG_LOCATION || event.getAction()==android.view.DragEvent.ACTION_DROP)?dragInteractions.point(event.getX(),event.getY()):new float[]{0,0};
      boolean original=super.dispatchDragEvent(event);
      return dragInteractions.drag(event,original,point) || original;
    } finally { CUIDragInteractions.endDispatch(); }
  }
  @Override public boolean dispatchGenericMotionEvent(MotionEvent event) {
    if (event.getActionMasked() == MotionEvent.ACTION_SCROLL) CUIInputWindow.interacted(this);
    return super.dispatchGenericMotionEvent(event);
  }

  static String originalEditorActionForOriginal(View original, KeyEvent event) {
    if (original==null || originalEditorActionEvent!=event || originalEditorActionFrame==null || originalEditorActionFrame.optInt("targetTag")!=original.getId() || !originalEditorActionFrame.optString("windowId").equals(CUIInputWindow.identity(original))) return null;
    return originalEditorActionFrame.toString();
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
    data.putDouble("timestamp", cancelled ? SystemClock.uptimeMillis() : event.getEventTime());
    if (hold.policy.originalEditorAction && originalEditorActionFrame!=null) {
      try {
        originalEditorActionFrame.put("key",CUIInputWindow.keyName(event)).put("nativeCode",event.getKeyCode()).put("characters",characters).put("repeat",down && event.getRepeatCount()>0)
          .put("shiftKey",event.isShiftPressed()).put("altKey",event.isAltPressed()).put("ctrlKey",event.isCtrlPressed()).put("metaKey",event.isMetaPressed()).put("capsLock",event.isCapsLockOn())
          .put("nativeModifierData",Integer.toUnsignedString(event.getMetaState())).put("timestamp",event.getEventTime());
        data.putString("originalEditorAction",originalEditorActionFrame.toString());
      } catch (org.json.JSONException unavailable) { return; }
    }
    emit("topNativeScopedKey", data);
  }
  private void emit(String name, WritableMap data) {
    ThemedReactContext context = (ThemedReactContext) getContext(); EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
    if (dispatcher != null) dispatcher.dispatchEvent(new ScopeEvent(UIManagerHelper.getSurfaceId(this), getId(), name, data));
  }
  boolean emitOrdinaryEditorKey(int target, WritableMap data) {
    ThemedReactContext context = (ThemedReactContext)getContext();
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, target);
    if (dispatcher == null) return false;
    dispatcher.dispatchEvent(new EditorKeyboardEvent(UIManagerHelper.getSurfaceId(this), target, "topNativeOrdinaryEditorKey", data, false));
    return true;
  }
  void emitOrdinaryEditorStatus(WritableMap data) { emitEditorKeyboard("topNativeOrdinaryEditorStatus", data, false); }
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
    @Override protected int getEventCategory() { return data.hasKey("originalEditorAction") ? com.facebook.react.uimanager.events.EventCategoryDef.DISCRETE : super.getEventCategory(); }
    @Override protected WritableMap getEventData() { return data; }
    @Override protected boolean experimental_isSynchronous() { return synchronous; }
  }
  void retireHeld() {
    retireToolbarHeld();
    for (int index = 0; index < held.size(); index++) {
      Hold hold = held.valueAt(index);
      if (!hold.retired && !hold.policy.originalEditorAction) emitKey(hold, false, true);
      hold.retired = true;
    }
  }
  @Override protected void onLayout(boolean changed, int left, int top, int right, int bottom) { super.onLayout(changed, left, top, right, bottom); ordinaryEditorKeys.publish(); editorWheel.publish(); publishToolbarStatus(); dialogs.attach(); dialogs.refresh(); }
  @Override public void onWindowFocusChanged(boolean focused) { retireHeld(); held.clear(); if (!focused) CUIInputWindow.clearPointers(this); windowEpoch++; super.onWindowFocusChanged(focused); publishStatus(); }
  @Override protected void onWindowVisibilityChanged(int visibility) {
    super.onWindowVisibilityChanged(visibility);
    if (boundRoot != null) { retireHeld(); held.clear(); windowEpoch++; publishStatus(); }
  }
  @Override protected void onAttachedToWindow() {
    super.onAttachedToWindow();
    dragMountManager = UIManagerHelper.getUIManagerForReactTag((ThemedReactContext)getContext(), getId());
    if (dragMountManager != null) dragMountManager.addUIManagerEventListener(this);
    boundRoot = getRootView(); CUIInputWindow.register(this); attachToolbarObserver(); policyOrder = CUIInputWindow.nextPolicyOrder(this);
    ViewCompat.addOnUnhandledKeyEventListener(boundRoot, unhandled); windowEpoch++; publishStatus(); dialogs.attach();
  }
  @Override protected void onDetachedFromWindow() {
    dragInteractions.cancelPointer();
    if (dragMountManager != null) dragMountManager.removeUIManagerEventListener(this); dragMountManager = null;
    detachToolbarObserver();
    dialogs.detach();
    floating.stop();
    retireHeld(); held.clear(); if (boundRoot != null) { ViewCompat.removeOnUnhandledKeyEventListener(boundRoot, unhandled); CUIInputWindow.unregister(boundRoot, this); CUIWindowPointers.release(boundRoot); boundRoot = null; }
    windowEpoch++; super.onDetachedFromWindow(); publishStatus();
  }

  private static final class ScopeEvent extends Event<ScopeEvent> {
    private final String name;
    private final WritableMap data;
    ScopeEvent(int surface, int tag, String name, WritableMap data) { super(surface, tag); this.name = name; this.data = data; }
    @Override public String getEventName() { return name; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected int getEventCategory() { return data.hasKey("originalEditorAction") ? com.facebook.react.uimanager.events.EventCategoryDef.DISCRETE : super.getEventCategory(); }
    @Override protected WritableMap getEventData() { return data; }
  }
}
