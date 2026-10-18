package com.codonui.input;

import android.text.TextUtils;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import com.facebook.react.uimanager.util.ReactFindViewUtil;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class CUIAccessibilityReferences {
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
    CharSequence label = view.getContentDescription();
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
