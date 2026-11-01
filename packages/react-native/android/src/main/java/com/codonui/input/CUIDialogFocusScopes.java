package com.codonui.input;

import android.view.KeyEvent;
import android.view.View;
import android.view.ViewTreeObserver;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class CUIDialogFocusScopes {
  static class Target {
    final String id; final int tag; boolean resolved; WeakReference<View> original;
    Target(String id, int tag) { this.id = id; this.tag = tag; }
    View get(CUIKeyboardScope owner) {
      View current = owner.getRootView().findViewById(tag);
      if (!resolved && current != null) { resolved = true; original = new WeakReference<>(current); }
      View view = original == null ? null : original.get();
      return view != null && view == current && view.getId() == tag && view.isAttachedToWindow()
          && view.getRootView() == owner.getRootView() ? view : null;
    }
  }
  static final class Entry extends Target {
    final boolean allowed; boolean processed; String failure="";
    Entry(String id, int tag, boolean allowed) { super(id, tag); this.allowed=allowed; }
  }
  static final class Binding {
    final String id, parentId, bindingId; final Target root; final List<Target> members; final List<Entry> entries;
    final boolean enabled, entryAllowed;
    boolean entered; long activationOrder; String failure=""; WeakReference<View> last;
    Binding(String id, String parentId, String bindingId, int tag, List<Target> members, List<Entry> entries, boolean enabled, boolean entryAllowed) {
      this.id=id; this.parentId=parentId; this.bindingId=bindingId; this.root=new Target(bindingId, tag);
      this.members=members; this.entries=entries; this.enabled=enabled; this.entryAllowed=entryAllowed;
    }
  }
  private final CUIKeyboardScope owner;
  private List<Binding> bindings = new ArrayList<>();
  private double revision;
  private boolean moving;
  private String published = "";
  private KeyEvent originalKey;
  private WeakReference<View> pendingWrap;
  private String pendingBinding;
  private ViewTreeObserver observer;
  private boolean refreshQueued;
  private final ViewTreeObserver.OnGlobalFocusChangeListener focusChanged = (before, after) -> {
    Binding binding=active();
    if (!moving && binding != null && eligible(binding, after)) {
      binding.entered=true; binding.last=new WeakReference<>(after);
      if (pendingWrap != null && pendingWrap.get() == after && binding.bindingId.equals(pendingBinding)) {
        pendingWrap=null; pendingBinding=null; action(binding, after, "wrapped");
      }
    }
    scheduleRefresh();
  };
  private final ViewTreeObserver.OnPreDrawListener beforeDraw = () -> { refresh(); return true; };
  CUIDialogFocusScopes(CUIKeyboardScope owner) { this.owner=owner; }

  void update(List<Binding> next) {
    for (Binding binding : next) for (Binding prior : bindings) if (binding.id.equals(prior.id) && binding.bindingId.equals(prior.bindingId) && binding.root.tag == prior.root.tag) {
      binding.root.resolved=prior.root.resolved; binding.root.original=prior.root.original;
      binding.entered=prior.entered; binding.last=prior.last; binding.failure=prior.failure;
      if (prior.enabled && binding.enabled) binding.activationOrder=prior.activationOrder;
      for (Target member : binding.members) for (Target old : prior.members) if (member.id.equals(old.id) && member.tag == old.tag) {
        member.resolved=old.resolved; member.original=old.original;
      }
      for (Entry entry : binding.entries) for (Entry old : prior.entries) if (entry.id.equals(old.id) && entry.tag == old.tag) {
        entry.resolved=old.resolved; entry.original=old.original; entry.processed=old.processed; entry.failure=old.failure;
      }
    }
    for (Binding binding : next) if (binding.enabled && binding.activationOrder == 0) binding.activationOrder=CUIInputWindow.nextPolicyOrder(owner);
    bindings=next;
    if (next.isEmpty()) detach(); else attach();
  }
  void setRevision(double next) { revision=next; }
  private void scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued=true;
    owner.post(() -> { refreshQueued=false; if (owner.isAttachedToWindow()) refresh(); });
  }
  void attach() {
    if (bindings.isEmpty() || !owner.isAttachedToWindow()) return;
    ViewTreeObserver next=owner.getRootView().getViewTreeObserver();
    if (observer == next) return;
    detach(); observer=next;
    observer.addOnGlobalFocusChangeListener(focusChanged); observer.addOnPreDrawListener(beforeDraw);
  }
  void detach() {
    if (observer != null && observer.isAlive()) { observer.removeOnGlobalFocusChangeListener(focusChanged); observer.removeOnPreDrawListener(beforeDraw); }
    observer=null; published=""; originalKey=null; pendingWrap=null; pendingBinding=null;
  }
  private static boolean contains(View root, View view) {
    for (View current=view; current != null; current=current.getParent() instanceof View ? (View)current.getParent() : null)
      if (current == root) return true;
    return false;
  }
  private int depth(Binding binding) {
    Set<String> visited=new HashSet<>(); int depth=0; String parent=binding.parentId;
    visited.add(binding.id);
    while (!parent.isEmpty()) {
      if (!visited.add(parent)) return -1;
      Binding found=null; for (Binding candidate : bindings) if (candidate.id.equals(parent)) { found=candidate; break; }
      if (found == null) return -1;
      depth++; parent=found.parentId;
    }
    return depth;
  }
  private Binding localActive() {
    if (!owner.dialogFocusReady()) return null;
    Binding result=null; int deepest=-1;
    for (Binding binding : bindings) {
      int depth=depth(binding); View root=binding.root.get(owner);
      if (binding.enabled && depth >= deepest && depth >= 0 && root != null && root.isShown()) { result=binding; deepest=depth; }
    }
    return result;
  }
  private Binding active() {
    Binding binding=localActive();
    if (binding == null) return null;
    View root=binding.root.get(owner);
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(owner)) {
      if (scope == owner) continue;
      CUIDialogFocusScopes other=scope.dialogs; Binding candidate=other.localActive();
      if (candidate == null) continue;
      View otherRoot=candidate.root.get(scope);
      boolean containsOther=inside(binding, otherRoot), otherContains=other.inside(candidate, root);
      if ((containsOther && !otherContains) || (containsOther == otherContains && candidate.activationOrder > binding.activationOrder)) return null;
    }
    return binding;
  }
  private boolean inside(Binding binding, View view) {
    if (view == null) return false;
    View root=binding.root.get(owner);
    if (root != null && contains(root, view)) return true;
    for (Target member : binding.members) { View target=member.get(owner); if (target != null && contains(target, view)) return true; }
    return false;
  }
  private boolean eligible(Binding binding, View view) {
    return view != null && view.isAttachedToWindow() && view.getRootView() == owner.getRootView()
        && view.isShown() && view.isEnabled() && view.isFocusable() && inside(binding, view);
  }
  private List<View> candidates(Binding binding, int direction) {
    List<View> result=new ArrayList<>(); List<View> roots=new ArrayList<>();
    roots.add(binding.root.get(owner)); for (Target member : binding.members) roots.add(member.get(owner));
    Set<View> seen=new HashSet<>();
    for (View root : roots) if (root != null) for (View candidate : root.getFocusables(direction))
      if (candidate != binding.root.get(owner) && eligible(binding, candidate) && seen.add(candidate)) result.add(candidate);
    return result;
  }
  private View fallback(Binding binding) {
    View previous=binding.last == null ? null : binding.last.get();
    if (eligible(binding, previous)) return previous;
    for (int index=binding.entries.size()-1; index >= 0; index--) {
      View target=binding.entries.get(index).get(owner); if (eligible(binding, target)) return target;
    }
    return binding.root.get(owner);
  }
  private void status(boolean ready, String error) {
    String signature=owner.formActionOwnerId()+":"+owner.formActionEpoch()+":"+revision+":"+ready+":"+error;
    if (signature.equals(published)) return;
    published=signature; WritableMap data=Arguments.createMap(); owner.writeActivationSession(data);
    data.putString("ownerId", owner.formActionOwnerId()); data.putDouble("revision", revision);
    data.putBoolean("ready", ready); data.putString("error", error); owner.emitDialogFocus("topNativeDialogStatus", data);
  }
  private boolean focus(Binding binding, View target, String phase) {
    if (moving || active() != binding || !eligible(binding, target)) return false;
    if (owner.getRootView().findFocus() == target) return true;
    moving=true;
    try {
      if (target instanceof CUIFocusView) ((CUIFocusView)target).requestKeyboardFocus(((CUIFocusView)target).fieldInputOwnerId());
      else target.requestFocus();
      if (!target.isFocused() || active() != binding) return false;
      binding.entered=true; binding.last=new WeakReference<>(target);
      action(binding, target, phase); return true;
    } finally { moving=false; }
  }
  private void action(Binding binding, View target, String phase) {
    WritableMap data=Arguments.createMap(); owner.writeActivationSession(data);
    data.putString("ownerId", owner.formActionOwnerId()); data.putDouble("revision", revision);
    data.putString("id", binding.id); data.putString("bindingId", binding.bindingId); data.putString("phase", phase);
    data.putInt("target", target.getId()); owner.emitDialogFocus("topNativeDialogAction", data);
  }
  void refresh() {
    if (moving || bindings.isEmpty()) return;
    Binding binding=active();
    if (binding == null) { status(false, ""); return; }
    if (!binding.failure.isEmpty()) { status(false, binding.failure); return; }
    View focused=owner.getRootView().findFocus(), root=binding.root.get(owner);
    for (Entry entry : binding.entries) {
      if (!entry.failure.isEmpty()) { status(false, entry.failure); return; }
      if (entry.processed) continue;
      View target=entry.get(owner);
      if (target == null) { status(false, ""); return; }
      if (!target.isShown()) { entry.processed=true; continue; }
      if (!entry.allowed) { if (inside(binding, focused)) entry.processed=true; continue; }
      if (contains(target, focused)) { entry.processed=true; continue; }
      entry.processed=true;
      if (!focus(binding, target, "entered")) { entry.failure="original-dialog-root-not-focusable"; status(false, entry.failure); return; }
      focused=owner.getRootView().findFocus();
    }
    if (inside(binding, focused)) {
      binding.entered=true; if (eligible(binding, focused)) binding.last=new WeakReference<>(focused);
      if (pendingWrap != null && pendingWrap.get() == focused && binding.bindingId.equals(pendingBinding)) {
        pendingWrap=null; pendingBinding=null; action(binding, focused, "wrapped");
      }
      status(true, ""); return;
    }
    if (binding.entered) {
      View previous=binding.last == null ? null : binding.last.get();
      List<View> available=candidates(binding, View.FOCUS_FORWARD);
      if (!focus(binding, eligible(binding, previous) ? previous : available.isEmpty() ? fallback(binding) : available.get(0), "restored") && active() == binding) {
        binding.failure="original-dialog-focus-recovery-refused"; status(false, binding.failure); return;
      }
    } else if (binding.entryAllowed && !focus(binding, root, "entered") && active() == binding) { binding.failure="original-dialog-root-not-focusable"; status(false, binding.failure); return; }
    status(true, "");
  }
  View redirect(View focused, View next, int direction) {
    if (direction != View.FOCUS_FORWARD && direction != View.FOCUS_BACKWARD) return null;
    if (focused instanceof android.widget.EditText) {
      android.text.Editable text=((android.widget.EditText)focused).getText();
      if (text != null && android.view.inputmethod.BaseInputConnection.getComposingSpanStart(text) >= 0) return null;
    }
    if (focused instanceof CUIDateSegment && ((CUIDateSegment)focused).isSegmentComposing()) return null;
    Binding binding=active();
    if (binding == null || !inside(binding, focused) || (inside(binding, next) && next != binding.root.get(owner))) return null;
    List<View> candidates=candidates(binding, direction);
    View wrapped=candidates.isEmpty() ? eligible(binding, focused) ? focused : fallback(binding) : candidates.get(direction == View.FOCUS_BACKWARD ? candidates.size()-1 : 0);
    if (originalKey != null) { pendingWrap=new WeakReference<>(wrapped); pendingBinding=binding.bindingId; }
    return wrapped;
  }
  void beginKey(KeyEvent event) {
    if (event.getAction() != KeyEvent.ACTION_DOWN || event.getKeyCode() != KeyEvent.KEYCODE_TAB || event.isCanceled()
        || event.isAltPressed() || event.isCtrlPressed() || event.isMetaPressed()) return;
    View originalFocus=owner.getRootView().findFocus();
    if (originalFocus instanceof android.widget.EditText) {
      android.text.Editable text=((android.widget.EditText)originalFocus).getText();
      if (text != null && android.view.inputmethod.BaseInputConnection.getComposingSpanStart(text) >= 0) return;
    }
    originalKey=event;
    owner.post(() -> { if (originalKey == event) { originalKey=null; pendingWrap=null; pendingBinding=null; } });
  }
  void finishKey(KeyEvent event, boolean handled) { if (handled && originalKey == event) { originalKey=null; pendingWrap=null; pendingBinding=null; } }
  boolean isRoot(View view) {
    if (!owner.dialogFocusReady()) return false;
    for (Binding binding : bindings) if (binding.enabled && binding.root.get(owner) == view) return true;
    for (Binding binding : bindings) if (binding.enabled) for (Entry entry : binding.entries) if (entry.get(owner) == view) return true;
    return false;
  }
  static boolean isDialogRoot(View view) {
    for (CUIKeyboardScope scope : CUIInputWindow.scopes(view)) if (scope.dialogs.isRoot(view)) return true;
    return false;
  }
}
