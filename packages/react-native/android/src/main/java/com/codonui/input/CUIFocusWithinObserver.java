package com.codonui.input;

import android.os.SystemClock;
import android.view.View;
import android.view.ViewTreeObserver;
import android.widget.EditText;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import java.lang.ref.WeakReference;
import org.json.JSONObject;

final class CUIFocusWithinObserver {
  interface Environment { JSONObject read() throws Exception; }
  interface Emitter { void emit(WritableMap packet); }
  private final WeakReference<View> root;
  private final Environment environment;
  private final Emitter emitter;
  private ViewTreeObserver tree;
  private String binding = "", signature = "";
  private long sequence;
  private boolean detached;
  private final ViewTreeObserver.OnGlobalFocusChangeListener focus = (oldView, newView) -> sample();
  private final ViewTreeObserver.OnGlobalLayoutListener layout = this::sample;

  CUIFocusWithinObserver(View root, Environment environment, Emitter emitter) {
    this.root = new WeakReference<>(root); this.environment = environment; this.emitter = emitter;
  }
  void configure(String value) {
    value = value == null ? "" : value;
    if (!binding.equals(value)) { binding = value; signature = ""; }
    synchronize();
  }
  void synchronize() {
    detached = false;
    View view = root.get();
    ViewTreeObserver next = view != null && view.isAttachedToWindow() && !binding.isEmpty() ? view.getViewTreeObserver() : null;
    if (tree != next) {
      detachTree(); tree = next;
      if (tree != null && tree.isAlive()) { tree.addOnGlobalFocusChangeListener(focus); tree.addOnGlobalLayoutListener(layout); }
    }
    sample();
  }
  private static boolean contains(View parent, View candidate) {
    for (View current = candidate; current != null; current = current.getParent() instanceof View ? (View)current.getParent() : null) if (current == parent) return true;
    return false;
  }
  void sample() {
    View view = root.get();
    if (view == null || binding.isEmpty()) return;
    try {
      JSONObject state = environment.read();
      if (state.optString("viewOwnerId").isEmpty() || view.getId() <= 0) return;
      boolean attached = !detached && view.isAttachedToWindow();
      boolean active = attached && view.hasWindowFocus() && view.getWindowVisibility() == View.VISIBLE && state.optInt("surfaceId") > 0;
      View focused = active ? view.getRootView().findFocus() : null;
      boolean within = focused != null && contains(view, focused);
      int focusedTag = 0;
      for (View candidate = within ? focused : null; candidate != null && focusedTag <= 0; candidate = candidate.getParent() instanceof View ? (View)candidate.getParent() : null) focusedTag = candidate.getId();
      JSONObject next = new JSONObject().put("ownerId", state.optString("viewOwnerId")).put("bindingId", binding)
        .put("target", view.getId()).put("surfaceId", state.optInt("surfaceId"))
        .put("windowId", state.optString("windowId")).put("scopeOwnerId", state.optString("scopeOwnerId"))
        .put("scopeEpoch", state.optDouble("scopeEpoch")).put("attached", attached).put("active", active)
        .put("within", within).put("focusedTarget", Math.max(0, focusedTag))
        .put("textInputFocused", within && (focused instanceof EditText || focused instanceof CUIDateSegment)).put("origin", CUIInputWindow.modality(view));
      String encoded = next.toString();
      if (encoded.equals(signature)) return;
      signature = encoded;
      WritableMap packet = Arguments.createMap();
      for (String name : new String[]{"ownerId", "bindingId", "windowId", "scopeOwnerId", "origin"}) packet.putString(name, next.optString(name));
      for (String name : new String[]{"target", "surfaceId", "focusedTarget"}) packet.putInt(name, next.optInt(name));
      for (String name : new String[]{"attached", "active", "within", "textInputFocused"}) packet.putBoolean(name, next.optBoolean(name));
      long timestamp = SystemClock.uptimeMillis();
      packet.putDouble("scopeEpoch", next.optDouble("scopeEpoch")); packet.putDouble("sequence", ++sequence); packet.putDouble("observedAt", timestamp);
      packet.putDouble("timestamp", timestamp); packet.putBoolean("isFocused", within);
      packet.putBoolean("isFocusVisible", within && CUIInputWindow.modality(view).equals("keyboard"));
      emitter.emit(packet);
    } catch (Exception ignored) { signature = ""; }
  }
  private void detachTree() {
    if (tree != null && tree.isAlive()) { tree.removeOnGlobalFocusChangeListener(focus); tree.removeOnGlobalLayoutListener(layout); }
    tree = null;
  }
  void detached() { detached = true; detachTree(); sample(); }
  void invalidate() { detachTree(); binding = ""; signature = ""; }
}
