package com.codonui.input;

import android.view.View;
import android.view.ViewTreeObserver;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

// Private original-view focus owner; this does not project or replace accessibility nodes.
final class CUIVirtualDragFocus {
  private static final class Target {
    final String id; final int tag; final boolean descendants;
    boolean resolved; WeakReference<View> original=new WeakReference<>(null);
    Target(String id, int tag, boolean descendants) { this.id=id; this.tag=tag; this.descendants=descendants; }
    View get(CUIKeyboardScope owner) {
      View current=owner.dragInteractions.resolveFocusTarget(tag);
      if (!resolved && current!=null) { resolved=true; original=new WeakReference<>(current); }
      View view=original.get();
      return view!=null && view==current && view.getId()==tag && view.isAttachedToWindow() && view.getRootView()==owner.getRootView()?view:null;
    }
  }
  private final CUIKeyboardScope scope;
  private JSONObject manifest, binding;
  private List<Target> targets=new ArrayList<>();
  private Target source, selected;
  private ViewTreeObserver observer;
  private boolean moving, failed;
  private long appliedSelection;
  private WeakReference<View> lastObserved=new WeakReference<>(null);
  private String lastIdentity="";
  private final ViewTreeObserver.OnGlobalFocusChangeListener focusChanged=(oldView,newView)->refresh();
  private final ViewTreeObserver.OnPreDrawListener beforeDraw=()->{ refresh(); return true; };

  CUIVirtualDragFocus(CUIKeyboardScope scope) { this.scope=scope; }
  boolean active() {
    return !failed && manifest!=null && scope.dragInteractions.canLift()
      && manifest.optString("windowId").equals(scope.dragWindowId()) && manifest.optLong("epoch")==scope.dragEpoch();
  }
  static CUIVirtualDragFocus active(CUIKeyboardScope owner) {
    CUIVirtualDragFocus found=null;
    for (CUIKeyboardScope scope:CUIInputWindow.scopes(owner)) if (scope.dragInteractions.virtualFocus.active()) {
      if (found!=null && found!=scope.dragInteractions.virtualFocus) { found.fail("native-virtual-focus-owners-ambiguous"); scope.dragInteractions.virtualFocus.fail("native-virtual-focus-owners-ambiguous"); return null; }
      found=scope.dragInteractions.virtualFocus;
    }
    return found;
  }
  void update(JSONObject next, JSONObject data) {
    if (next==null) { invalidate(); return; }
    if (manifest!=null && next.toString().equals(manifest.toString()) && data.toString().equals(binding.toString())) { refresh(); return; }
    try {
      if (next.getString("sessionId").isEmpty() || next.getLong("revision")<1) throw new IllegalArgumentException("native-virtual-focus-owner-invalid");
      JSONArray records=next.getJSONArray("targets"); List<Target> nextTargets=new ArrayList<>(); Set<String> ids=new HashSet<>(); Set<Integer> tags=new HashSet<>();
      for (int index=0;index<records.length();index++) {
        JSONObject record=records.getJSONObject(index); String id=record.getString("id"); int tag=record.getInt("tag");
        if (id.isEmpty() || tag<=0 || !ids.add(id) || !tags.add(tag)) throw new IllegalArgumentException("native-virtual-focus-target-invalid");
        Target target=null; boolean descendants=record.getBoolean("descendants");
        for (Target old:targets) if (old.id.equals(id) && old.tag==tag && old.descendants==descendants) { target=old; break; }
        if (target==null) target=new Target(id,tag,descendants); nextTargets.add(target);
      }
      JSONObject original=next.getJSONObject("source"), choice=next.optJSONObject("selected"); Target nextSource=null,nextSelected=null;
      for (Target target:nextTargets) {
        if (target.id.equals(original.getString("id")) && target.tag==original.getInt("tag")) nextSource=target;
        if (choice!=null && target.id.equals(choice.getString("id")) && target.tag==choice.getInt("tag")) nextSelected=target;
      }
      boolean member=false; JSONArray members=data.getJSONArray("members");
      for (int index=0;index<members.length();index++) { JSONObject item=members.getJSONObject(index);
        if (nextSource!=null && !"target".equals(item.optString("role")) && (item.getInt("targetTag")==nextSource.tag || item.getInt("handleTag")==nextSource.tag)) member=true;
      }
      if (nextSource==null || !member) throw new IllegalArgumentException("native-virtual-focus-source-not-original");
      boolean same=manifest!=null && manifest.optString("sessionId").equals(next.getString("sessionId"));
      manifest=next; binding=data; targets=nextTargets; source=nextSource; selected=nextSelected;
      if (!same) { failed=false; lastObserved.clear(); lastIdentity=""; appliedSelection=0; }
      refresh();
    } catch (Exception error) { manifest=next; binding=data; fail(error.getMessage()==null?"native-virtual-focus-manifest-invalid":error.getMessage()); }
  }
  private static boolean contains(View root,View child) {
    for (View view=child;view!=null;view=view.getParent() instanceof View?(View)view.getParent():null) if (view==root) return true;
    return false;
  }
  private Target matching(View view) {
    if (view==null) return null; Target found=null;
    for (Target target:targets) { View original=target.get(scope);
      if (original==view) return target;
      if (target.descendants && original!=null && contains(original,view) && (found==null || contains(found.get(scope),original))) found=target;
    }
    return found;
  }
  private void emit(String kind,Target target,String error) {
    if (binding==null || manifest==null) return;
    try {
      JSONObject data=new JSONObject().put("moduleId",binding.getString("moduleId")).put("bindingId",binding.getString("bindingId")).put("revision",binding.getString("revision")).put("rootTarget",binding.getInt("rootTarget")).put("kind",kind).put("ownerId",scope.formActionOwnerId()).put("windowId",scope.dragWindowId()).put("epoch",scope.dragEpoch())
        .put("sessionId",manifest.optString("sessionId")).put("focusRevision",manifest.optLong("revision")).put("target",target==null?0:target.tag).put("ready",false).put("error",error);
      scope.emitDragStatus(data.toString());
    } catch (Exception errorValue) { throw new IllegalStateException("native-virtual-focus-status-invalid",errorValue); }
  }
  private void fail(String error) { if (failed) return; emit("binding",null,error); failed=true; detach(); }
  private boolean focus(Target target) {
    View view=target==null?null:target.get(scope);
    if (view==null || !view.isShown() || !view.isEnabled() || !view.isFocusable() || !active()) return false;
    View before=scope.getRootView().findFocus();
    if (before==view || (target.descendants && contains(view,before))) return true;
    if (view instanceof CUIFocusView) ((CUIFocusView)view).requestKeyboardFocus(((CUIFocusView)view).fieldInputOwnerId());
    else view.requestFocus();
    View focused=scope.getRootView().findFocus();
    return focused==view || (target.descendants && contains(view,focused));
  }
  void refresh() {
    if (moving) return;
    JSONObject intent=manifest;
    if (!active()) { detach(); return; }
    View sourceView=source.get(scope), selectedView=selected==null?null:selected.get(scope);
    if (sourceView==null || (selected!=null && selectedView==null)) {
      if ((sourceView==null && source.resolved) || (selected!=null && selectedView==null && selected.resolved)) fail("native-virtual-focus-original-target-retired");
      return;
    }
    ViewTreeObserver next=scope.getRootView().getViewTreeObserver();
    if (observer!=next && next.isAlive()) { detach(); observer=next; observer.addOnGlobalFocusChangeListener(focusChanged); observer.addOnPreDrawListener(beforeDraw); }
    if (manifest.optBoolean("nativeSelection") && selected!=null && appliedSelection!=manifest.optLong("revision")) {
      appliedSelection=manifest.optLong("revision"); moving=true; boolean accepted=false;
      try { accepted=focus(selected); } finally { moving=false; }
      if (manifest!=intent || !active()) return;
      if (!accepted) { fail("native-virtual-focus-original-selection-refused"); return; }
    }
    View focused=scope.getRootView().findFocus(); Target target=matching(focused);
    if (target==null) {
      moving=true; boolean accepted=false;
      try { accepted=focus(selected==null?source:selected); } finally { moving=false; }
      if (manifest!=intent || !active()) return;
      if (!accepted) { fail("native-virtual-focus-recovery-refused"); return; }
      focused=scope.getRootView().findFocus(); target=matching(focused);
    }
    if (target!=null && (lastObserved.get()!=focused || !lastIdentity.equals(target.id))) { lastObserved=new WeakReference<>(focused); lastIdentity=target.id; emit("virtualFocus",target,""); }
  }
  static View redirect(CUIKeyboardScope owner,View previous,View proposed) {
    CUIVirtualDragFocus active=active(owner); if (active==null || active.matching(proposed)!=null) return null;
    Target target=active.selected==null?active.source:active.selected;
    View original=target==null?null:target.get(active.scope);
    return original!=null && original.isShown() && original.isEnabled() && original.isFocusable()?original:previous;
  }
  private void detach() {
    if (observer!=null && observer.isAlive()) { observer.removeOnGlobalFocusChangeListener(focusChanged); observer.removeOnPreDrawListener(beforeDraw); }
    observer=null;
  }
  void invalidate() { detach(); manifest=null; binding=null; targets.clear(); source=null; selected=null; lastObserved.clear(); lastIdentity=""; failed=false; appliedSelection=0; }
}
