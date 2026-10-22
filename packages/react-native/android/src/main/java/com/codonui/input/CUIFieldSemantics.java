package com.codonui.input;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.TextView;
import androidx.core.view.AccessibilityDelegateCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat;
import androidx.core.view.accessibility.AccessibilityNodeProviderCompat;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.views.textinput.ReactEditText;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.WeakHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

final class CUIFieldSemantics implements CUIFormMetadataView.SemanticContribution {
  interface Current { boolean check() throws Exception; }
  private static final WeakHashMap<ReactEditText, WeakReference<CUIFieldSemantics>> leases = new WeakHashMap<>();
  private final WeakReference<ReactEditText> editor;
  private final JSONObject plan;
  private final String label, description, errors, details;
  private final WeakReference<View> firstLabel;
  private AccessibilityDelegateCompat original;
  private Delegate delegate;
  private Current current;
  private boolean retired;

  private static String text(View view) {
    CharSequence label = view.getContentDescription();
    if (label != null) return label.toString();
    if (view instanceof ReactEditText) return "";
    if (view instanceof TextView) return ((TextView)view).getText().toString();
    ArrayList<String> parts = new ArrayList<>();
    if (view instanceof ViewGroup) for (int index = 0; index < ((ViewGroup)view).getChildCount(); index++) {
      String value = text(((ViewGroup)view).getChildAt(index)); if (!value.isEmpty()) parts.add(value);
    }
    return String.join(" ", parts);
  }
  private static String referencedText(UIManager manager, JSONArray targets) throws Exception {
    ArrayList<String> parts = new ArrayList<>();
    for (int index = 0; index < targets.length(); index++) {
      View view = manager.resolveView(targets.getInt(index));
      if (view == null) throw new IllegalStateException("field-semantic-reference-not-materialized");
      parts.add(text(view));
    }
    return String.join(" ", parts);
  }
  static CUIFieldSemantics bind(UIManager manager, ReactEditText editor, JSONObject plan, Current current) throws Exception {
    if (!current.check()) return null;
    WeakReference<CUIFieldSemantics> previous = leases.get(editor);
    if (previous != null && previous.get() != null) previous.get().retire();
    String label = referencedText(manager, plan.getJSONArray("labelledBy"));
    String description = referencedText(manager, plan.getJSONArray("describedBy"));
    String errors = referencedText(manager, plan.getJSONArray("errorMessageBy"));
    String details = referencedText(manager, plan.getJSONArray("detailsBy"));
    // Resolve control references now too; missing UI never becomes a fabricated relation.
    referencedText(manager, plan.getJSONArray("controls"));
    View firstLabel = plan.getJSONArray("labelledBy").length() == 0 ? null : manager.resolveView(plan.getJSONArray("labelledBy").getInt(0));
    if (!current.check()) return null;
    return new CUIFieldSemantics(editor, plan, label, description, errors, details, firstLabel, current);
  }
  private CUIFieldSemantics(ReactEditText editor, JSONObject plan, String label, String description, String errors, String details, View firstLabel, Current current) {
    this.editor = new WeakReference<>(editor); this.plan = plan; this.label = label; this.description = description;
    this.errors = errors; this.details = details; this.firstLabel = new WeakReference<>(firstLabel); this.current = current;
    original = ViewCompat.getAccessibilityDelegate(editor);
    while (original instanceof Delegate) {
      CUIFieldSemantics owner = ((Delegate)original).owner.get();
      if (owner != null && !owner.retired) break;
      original = ((Delegate)original).restore;
    }
    delegate = new Delegate(this, original);
    leases.put(editor, new WeakReference<>(this)); ViewCompat.setAccessibilityDelegate(editor, delegate);
  }
  private boolean isCurrent(View host) {
    if (retired || editor.get() != host || current == null || ViewCompat.getAccessibilityDelegate(host) != delegate) return false;
    try { return current.check(); } catch (Exception unavailable) { return false; }
  }
  private void augment(View host, AccessibilityNodeInfoCompat node) {
    if (!isCurrent(host)) { retire(); return; }
    try {
      JSONObject labels = plan.getJSONObject("labels");
      if (plan.getJSONArray("labelledBy").length() > 0) node.setContentDescription(label);
      View labelledBy = firstLabel.get(); if (labelledBy != null) node.setLabeledBy(labelledBy);
      if (node.getRoleDescription() == null || node.getRoleDescription().length() == 0) node.setRoleDescription(labels.getString("role"));
      if (plan.getBoolean("disabled")) node.setEnabled(false);
      ArrayList<String> state = new ArrayList<>();
      CharSequence ownerState = node.getStateDescription(); if (ownerState != null && ownerState.length() > 0) state.add(ownerState.toString());
      state.add(labels.getString(plan.getBoolean("expanded") ? "expanded" : "collapsed"));
      for (String key : new String[]{"required", "readOnly", "disabled"}) if (plan.getBoolean(key)) state.add(labels.getString(key));
      node.setStateDescription(String.join(" ", state));
      ArrayList<String> hints = new ArrayList<>(); CharSequence ownerHint = node.getHintText();
      if (ownerHint != null && ownerHint.length() > 0) hints.add(ownerHint.toString());
      if (!description.isEmpty()) hints.add(description);
      if (!hints.isEmpty()) node.setHintText(String.join(" ", hints));
      node.setContentInvalid(plan.getBoolean("invalid") || node.isContentInvalid());
      if (plan.getBoolean("invalid") && !errors.isEmpty()) {
        CharSequence ownerError = node.getError();
        node.setError(ownerError == null || ownerError.length() == 0 ? errors : ownerError + " " + errors);
      }
      // Native relations retain their complete ordered target sets even where
      // Android exposes a single labeledBy slot. Editing/text/actions are untouched.
      for (String key : new String[]{"labelledBy", "describedBy", "errorMessageBy", "detailsBy", "controls"}) {
        JSONArray values = plan.getJSONArray(key); int[] targets = new int[values.length()];
        for (int index = 0; index < targets.length; index++) targets[index] = values.getInt(index);
        node.getExtras().putIntArray("com.codonui.field." + key, targets);
      }
      if (!details.isEmpty()) node.getExtras().putCharSequence("com.codonui.field.details", details);
    } catch (Exception retired) { retire(); }
  }
  @Override public void retire() {
    if (retired) return;
    retired = true; ReactEditText view = editor.get();
    if (view != null) {
      WeakReference<CUIFieldSemantics> currentLease = leases.get(view);
      if (currentLease != null && currentLease.get() == this) leases.remove(view);
      if (ViewCompat.getAccessibilityDelegate(view) == delegate) ViewCompat.setAccessibilityDelegate(view, original);
    }
    original = null; delegate = null; current = null;
  }

  // AccessibilityDelegateCompat's complete public delegate surface forwards
  // to the exact original delegate, including ReactEditText's click behavior.
  private static final class Delegate extends AccessibilityDelegateCompat {
    final WeakReference<CUIFieldSemantics> owner;
    final AccessibilityDelegateCompat source, restore;
    Delegate(CUIFieldSemantics owner, AccessibilityDelegateCompat original) {
      this.owner = new WeakReference<>(owner); restore = original; source = original == null ? new AccessibilityDelegateCompat() : original;
    }
    @Override public void onInitializeAccessibilityNodeInfo(View host, AccessibilityNodeInfoCompat node) {
      source.onInitializeAccessibilityNodeInfo(host, node); CUIFieldSemantics value = owner.get(); if (value != null) value.augment(host, node);
    }
    @Override public boolean performAccessibilityAction(View host, int action, Bundle args) {
      CUIFieldSemantics value = owner.get();
      try { if ((action == AccessibilityNodeInfo.ACTION_CLICK || action == AccessibilityNodeInfo.ACTION_FOCUS) && value != null && value.isCurrent(host) && value.plan.getBoolean("disabled")) return false; }
      catch (Exception retired) { if (value != null) value.retire(); }
      return source.performAccessibilityAction(host, action, args);
    }
    @Override public void sendAccessibilityEvent(View host, int type) { source.sendAccessibilityEvent(host, type); }
    @Override public void sendAccessibilityEventUnchecked(View host, AccessibilityEvent event) { source.sendAccessibilityEventUnchecked(host, event); }
    @Override public boolean dispatchPopulateAccessibilityEvent(View host, AccessibilityEvent event) { return source.dispatchPopulateAccessibilityEvent(host, event); }
    @Override public void onPopulateAccessibilityEvent(View host, AccessibilityEvent event) { source.onPopulateAccessibilityEvent(host, event); }
    @Override public void onInitializeAccessibilityEvent(View host, AccessibilityEvent event) { source.onInitializeAccessibilityEvent(host, event); }
    @Override public boolean onRequestSendAccessibilityEvent(ViewGroup host, View child, AccessibilityEvent event) { return source.onRequestSendAccessibilityEvent(host, child, event); }
    @Override public AccessibilityNodeProviderCompat getAccessibilityNodeProvider(View host) { return source.getAccessibilityNodeProvider(host); }
  }
}
