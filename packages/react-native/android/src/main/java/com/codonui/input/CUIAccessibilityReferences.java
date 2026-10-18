package com.codonui.input;

import android.text.TextUtils;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.TextView;
import androidx.annotation.RequiresApi;
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat;
import com.facebook.react.uimanager.util.ReactFindViewUtil;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class CUIAccessibilityReferences {
  private static final String supplementalDescriptionKey = "androidx.view.accessibility.AccessibilityNodeInfoCompat.SUPPLEMENTAL_DESCRIPTION_KEY";

  static void setDetails(AccessibilityNodeInfoCompat node, CharSequence details) {
    if (Build.VERSION.SDK_INT >= 36) Api36.setDetails(node.unwrap(), details);
    else node.getExtras().putCharSequence(supplementalDescriptionKey, details);
  }
  static CharSequence details(AccessibilityNodeInfoCompat node) {
    return Build.VERSION.SDK_INT >= 36 ? Api36.details(node.unwrap()) : node.getExtras().getCharSequence(supplementalDescriptionKey);
  }
  @RequiresApi(36)
  private static final class Api36 {
    static void setDetails(AccessibilityNodeInfo node, CharSequence details) { node.setSupplementalDescription(details); }
    static CharSequence details(AccessibilityNodeInfo node) { return node.getSupplementalDescription(); }
  }
  static final class Text {
    final boolean available;
    final String value;
    Text(boolean available, String value) { this.available = available; this.value = value; }
  }
  private static final ThreadLocal<Set<View>> resolving = new ThreadLocal<Set<View>>() {
    @Override protected Set<View> initialValue() { return new HashSet<>(); }
  };

  static Text resolve(View source, List<String> ids, int tag, boolean bodyOnly) {
    if (ids.isEmpty() && tag <= 0) return new Text(false, "");
    Set<View> active = resolving.get();
    if (!source.isAttachedToWindow() || !active.add(source)) return new Text(false, "");
    try {
      List<String> values = new ArrayList<>();
      for (String id : ids) {
        View target = ReactFindViewUtil.findView(source.getRootView(), id);
        append(source, target, bodyOnly, values);
      }
      if (tag > 0) append(source, source.getRootView().findViewById(tag), bodyOnly, values);
      return new Text(!values.isEmpty(), TextUtils.join(" ", values));
    } finally { active.remove(source); }
  }
  private static void append(View source, View target, boolean bodyOnly, List<String> values) {
    if (target == null || target == source || !target.isAttachedToWindow() || target.getWindowToken() != source.getWindowToken()) return;
    CharSequence text = read(target, bodyOnly, new HashSet<>());
    if (text != null) values.add(text.toString());
  }
  private static CharSequence read(View view, boolean bodyOnly, Set<View> seen) {
    if (!seen.add(view) || resolving.get().contains(view)) return null;
    if (bodyOnly && view instanceof TextView) return ((TextView) view).getText();
    CharSequence label = view instanceof CUIFocusView ? ((CUIFocusView) view).accessibilityReferenceLabel() : view.getContentDescription();
    if (!bodyOnly && label != null) return label;
    if (view instanceof TextView) return ((TextView) view).getText();
    if (view instanceof ViewGroup) {
      List<String> children = new ArrayList<>();
      ViewGroup group = (ViewGroup) view;
      for (int i = 0; i < group.getChildCount(); i++) {
        CharSequence child = read(group.getChildAt(i), bodyOnly, seen);
        if (child != null) children.add(child.toString());
      }
      if (!children.isEmpty()) return TextUtils.join(" ", children);
    }
    return label;
  }
}
