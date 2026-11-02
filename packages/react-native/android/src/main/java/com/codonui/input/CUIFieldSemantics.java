package com.codonui.input;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.core.view.AccessibilityDelegateCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat;
import androidx.core.view.accessibility.AccessibilityNodeProviderCompat;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.views.textinput.ReactEditText;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.WeakHashMap;
import org.json.JSONObject;

final class CUIFieldSemantics implements CUIFormMetadataView.SemanticContribution {
  interface Current { boolean check() throws Exception; }
  private static final WeakHashMap<View, WeakReference<CUIFieldSemantics>> leases = new WeakHashMap<>();
  private final WeakReference<View> editor;
  private final JSONObject plan;
  private final String label, description, errors, details;
  private final WeakReference<View> firstLabel;
  private AccessibilityDelegateCompat original;
  private Delegate delegate;
  private Current current;
  private boolean retired;

  static CUIFieldSemantics bind(UIManager manager, ReactEditText editor, JSONObject plan, Current current) throws Exception {
    if (!current.check()) return null;
    WeakReference<CUIFieldSemantics> previous = leases.get(editor);
    if (previous != null && previous.get() != null) previous.get().retire();
    String label = plan.getJSONObject("text").getString("label");
    String description = plan.getJSONObject("text").getString("description");
    String errors = plan.getJSONObject("text").getString("errorMessage");
    String details = plan.getJSONObject("text").getString("details");
    View firstLabel = null;
    if (!current.check()) return null;
    return new CUIFieldSemantics(editor, plan, label, description, errors, details, firstLabel, current);
  }
  static CUIFormMetadataView.SemanticContribution bindDateField(UIManager manager, ArrayList<CUIDateSegment> segments,
      JSONObject plan, Current current) throws Exception {
    if (segments == null || segments.isEmpty() || !current.check()) return null;
    int first = plan.getJSONObject("dateField").getInt("firstEditableTarget");
    boolean found = false;
    for (CUIDateSegment segment : segments) if (segment.getId() == first) found = true;
    if (!found) return null;
    ArrayList<CUIFieldSemantics> contributions = new ArrayList<>();
    try {
      for (CUIDateSegment segment : segments) {
        if (!current.check()) throw new IllegalStateException("date-semantic-document-retired");
        JSONObject part = new JSONObject(plan.toString());
        if (segment.getId() != first && !plan.getBoolean("invalid")) part.getJSONObject("text").put("description", "");
        part.put("readOnly", segment.segmentReadOnly);
        WeakReference<CUIFieldSemantics> previous = leases.get(segment);
        if (previous != null && previous.get() != null) previous.get().retire();
        String label = part.getJSONObject("text").getString("label");
        String description = part.getJSONObject("text").getString("description");
        String errors = part.getJSONObject("text").getString("errorMessage");
        String details = part.getJSONObject("text").getString("details");
        View firstLabel = null;
        contributions.add(new CUIFieldSemantics(segment, part, label, description, errors, details, firstLabel, current));
      }
      if (!current.check()) throw new IllegalStateException("date-semantic-document-retired");
      return () -> { for (CUIFieldSemantics value : contributions) value.retire(); contributions.clear(); };
    } catch (Exception retired) {
      for (CUIFieldSemantics value : contributions) value.retire();
      throw retired;
    }
  }
  private CUIFieldSemantics(View editor, JSONObject plan, String label, String description, String errors, String details, View firstLabel, Current current) {
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
      boolean dateField = plan.has("dateField");
      if (!label.isEmpty()) {
        CharSequence base = node.getContentDescription();
        node.setContentDescription(dateField && base != null && base.length() > 0 ? base + ", " + label : label);
      }
      View labelledBy = firstLabel.get(); if (labelledBy != null) node.setLabeledBy(labelledBy);
      if (!dateField && (node.getRoleDescription() == null || node.getRoleDescription().length() == 0)) node.setRoleDescription(labels.getString("role"));
      if (plan.getBoolean("disabled")) node.setEnabled(false);
      ArrayList<String> state = new ArrayList<>();
      CharSequence ownerState = node.getStateDescription(); if (ownerState != null && ownerState.length() > 0) state.add(ownerState.toString());
      if (!dateField) state.add(labels.getString(plan.getBoolean("expanded") ? "expanded" : "collapsed"));
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
      if (!details.isEmpty()) node.getExtras().putCharSequence("com.codonui.field.details", details);
    } catch (Exception retired) { retire(); }
  }
  @Override public void retire() {
    if (retired) return;
    retired = true; View view = editor.get();
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
