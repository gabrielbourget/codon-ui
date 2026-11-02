package com.codonui.input;

import android.graphics.RectF;
import android.graphics.Matrix;
import android.view.View;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.IllegalViewOperationException;
import com.facebook.react.views.textinput.ReactEditText;
import org.json.JSONArray;
import org.json.JSONObject;

// Explicit participants retain native order and eligibility without a form document snapshot.
final class CUIFieldGroupDocument {
  private static View resolve(UIManager manager, int target) {
    try { return manager.resolveView(target); }
    catch (IllegalViewOperationException unavailable) { return null; }
  }
  private static boolean descendant(View view, View ancestor) {
    if (ancestor == null) return false;
    for (View current = view; current != null; current = current.getParent() instanceof View ? (View)current.getParent() : null)
      if (current == ancestor) return true;
    return false;
  }
  private static boolean visible(View view, View outer) {
    if (view == null || !view.isAttachedToWindow() || !view.isShown() || view.getRootView() != outer.getRootView()) return false;
    for (View current = view; current != null; current = current.getParent() instanceof View ? (View)current.getParent() : null)
      if (current.getAlpha() <= 0) return false;
    return true;
  }
  private static void transformToRoot(View target, View root, Matrix matrix) {
    if (target == root) return;
    if (!(target.getParent() instanceof View)) throw new IllegalStateException("field-group-original-geometry-ancestry-retired");
    View parent = (View)target.getParent(); transformToRoot(parent, root, matrix);
    matrix.preTranslate(-parent.getScrollX(), -parent.getScrollY());
    matrix.preTranslate(target.getLeft(), target.getTop());
    matrix.preConcat(target.getMatrix());
  }
  static JSONObject readFocusParticipants(FabricUIManager manager, JSONObject request) throws Exception {
    int rootTag = request.getInt("rootTarget"); View root = manager.resolveView(rootTag);
    if (root == null || !root.isAttachedToWindow() || !root.hasWindowFocus() || !root.isShown())
      throw new IllegalStateException("focus-participant-root-retired");
    View focused = root.getRootView().findFocus(), scope = null;
    int focusedTarget = 0;
    for (View view = focused; view != null; view = view.getParent() instanceof View ? (View)view.getParent() : null)
      if (view.getId() > 0 && resolve(manager, view.getId()) == view) { focusedTarget = view.getId(); break; }
    if (request.has("scopeTarget")) {
      scope = resolve(manager, request.getInt("scopeTarget"));
      if (scope == null || !descendant(scope, root)) throw new IllegalStateException("focus-participant-input-retired");
    } else {
      JSONArray inputs = request.optJSONArray("inputRoots");
      for (int index = 0; inputs != null && index < inputs.length(); index++) {
        View input = resolve(manager, inputs.getInt(index));
        if (input == null || !descendant(input, root)) throw new IllegalStateException("focus-participant-input-retired");
        if (descendant(focused, input)) {
          if (scope != null) throw new IllegalStateException("focus-participant-input-ambiguous");
          scope = input;
        }
      }
    }
    java.util.Map<Integer, JSONObject> members = new java.util.HashMap<>();
    JSONArray targets = request.getJSONArray("targets");
    for (int index = 0; index < targets.length(); index++) {
      int tag = targets.getInt(index);
      if (tag <= 0 || members.containsKey(tag)) throw new IllegalArgumentException("focus-participant-target-invalid");
      View target = manager.resolveView(tag);
      if (target == null || target == root || !descendant(target, root) || target.getRootView() != root.getRootView())
        throw new IllegalStateException("focus-participant-outside-root");
      if (!(target instanceof ReactEditText) && !(target instanceof CUIFocusView) && !(target instanceof CUIDateSegment))
        throw new IllegalArgumentException("focus-participant-control-unsupported");
      boolean eligible = (scope == null || descendant(target, scope)) && target.isAttachedToWindow() && visible(target, root) && target.isEnabled() && target.isFocusable();
      Matrix matrix = new Matrix(); transformToRoot(target, target.getRootView(), matrix);
      RectF rectangle = new RectF(0, 0, target.getWidth(), target.getHeight()); matrix.mapRect(rectangle);
      if (!Float.isFinite(rectangle.left)) throw new IllegalStateException("focus-participant-geometry-invalid");
      members.put(tag, new JSONObject().put("target", tag).put("eligible", eligible)
        .put("tabStop", !(target instanceof CUIFocusView) || ((CUIFocusView)target).fieldFocusTabStop()).put("x", rectangle.left));
    }
    JSONArray rows = new JSONArray(); int[] before = new int[]{0}; boolean[] found = new boolean[]{false};
    int pressTag = request.optInt("pressTarget", 0);
    View hit = pressTag > 0 ? resolve(manager, pressTag) : null;
    boolean focusedMember = false;
    for (View view = focused; view != null && view != root; view = view.getParent() instanceof View ? (View)view.getParent() : null)
      if (members.containsKey(view.getId())) focusedMember = true;
    boolean independent = !focusedMember && hit != null && hit != root && !members.containsKey(hit.getId()) && hit.hasFocus();
    for (View view = hit; view != null && view != root; view = view.getParent() instanceof View ? (View)view.getParent() : null)
      if (view.isFocusable() && !members.containsKey(view.getId())) independent = true;
    appendFocusParticipants(root, members, rows, pressTag, before, found);
    if (pressTag > 0 && !found[0]) throw new IllegalStateException("focus-participant-press-retired");
    if (rows.length() != members.size()) throw new IllegalStateException("focus-participant-order-retired");
    return new JSONObject().put("rootTarget", rootTag).put("windowId", CUIInputWindow.identity(root)).put("focusedTarget", focusedTarget).put("rows", rows).put("before", before[0] == 0 ? JSONObject.NULL : before[0]).put("pressIndependent", independent);
  }
  private static void appendFocusParticipants(View view, java.util.Map<Integer, JSONObject> members, JSONArray rows, int pressTag, int[] before, boolean[] found) throws Exception {
    if (view.getId() == pressTag) found[0] = true;
    JSONObject member = members.get(view.getId());
    if (member != null) { rows.put(member); if (!found[0] && member.getBoolean("eligible") && member.getBoolean("tabStop")) before[0] = view.getId(); }
    if (view instanceof android.view.ViewGroup) {
      android.view.ViewGroup group = (android.view.ViewGroup)view;
      for (int index = 0; index < group.getChildCount(); index++) appendFocusParticipants(group.getChildAt(index), members, rows, pressTag, before, found);
    }
  }
}
