package com.codonui.input;

import android.view.View;
import android.view.ViewGroup;
import android.view.accessibility.AccessibilityEvent;
import android.os.Bundle;
import androidx.core.view.AccessibilityDelegateCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat;
import androidx.core.view.accessibility.AccessibilityNodeProviderCompat;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.WeakHashMap;

final class CUINativeDescription {
  private static final WeakHashMap<View, WeakReference<State>> states = new WeakHashMap<>();
  private static final class State {
    final List<CUINativeDescription> bindings = new ArrayList<>();
    AccessibilityDelegateCompat original;
    AccessibilityDelegateCompat installed;
  }
  private WeakReference<View> target = new WeakReference<>(null);
  private WeakReference<View> description = new WeakReference<>(null);
  private State state;

  void bind(View next, View describedBy) {
    if (!next.isAttachedToWindow() || next.getWindowToken() != describedBy.getWindowToken()) { invalidate(); return; }
    if (target.get() != next || description.get() != describedBy) {
      invalidate(); target = new WeakReference<>(next); description = new WeakReference<>(describedBy);
      WeakReference<State> previous = states.get(next);
      state = previous == null ? null : previous.get();
      if (state == null) { state = new State(); states.put(next, new WeakReference<>(state)); }
      state.bindings.add(this);
    }
    AccessibilityDelegateCompat current = ViewCompat.getAccessibilityDelegate(next);
    if (state.installed == null || current != state.installed) {
      state.original = current;
      State active = state;
      AccessibilityDelegateCompat original = current == null ? new AccessibilityDelegateCompat() : current;
      state.installed = new AccessibilityDelegateCompat() {
        @Override public void sendAccessibilityEvent(View host, int type) { original.sendAccessibilityEvent(host, type); }
        @Override public void sendAccessibilityEventUnchecked(View host, AccessibilityEvent event) { original.sendAccessibilityEventUnchecked(host, event); }
        @Override public boolean dispatchPopulateAccessibilityEvent(View host, AccessibilityEvent event) { return original.dispatchPopulateAccessibilityEvent(host, event); }
        @Override public void onPopulateAccessibilityEvent(View host, AccessibilityEvent event) { original.onPopulateAccessibilityEvent(host, event); }
        @Override public void onInitializeAccessibilityEvent(View host, AccessibilityEvent event) { original.onInitializeAccessibilityEvent(host, event); }
        @Override public boolean onRequestSendAccessibilityEvent(ViewGroup host, View child, AccessibilityEvent event) { return original.onRequestSendAccessibilityEvent(host, child, event); }
        @Override public AccessibilityNodeProviderCompat getAccessibilityNodeProvider(View host) { return original.getAccessibilityNodeProvider(host); }
        @Override public boolean performAccessibilityAction(View host, int action, Bundle arguments) { return original.performAccessibilityAction(host, action, arguments); }
        @Override public void onInitializeAccessibilityNodeInfo(View host, AccessibilityNodeInfoCompat info) {
          original.onInitializeAccessibilityNodeInfo(host, info);
          for (int index = active.bindings.size() - 1; index >= 0; index--) {
            CUINativeDescription binding = active.bindings.get(index);
            View body = binding.description.get();
            if (binding.target.get() != host || body == null || !host.isAttachedToWindow() || body.getWindowToken() != host.getWindowToken() || host.getRootView().findViewById(body.getId()) != body) continue;
            CUIAccessibilityReferences.Text text = CUIAccessibilityReferences.resolve(host, Collections.emptyList(), body.getId(), true);
            if (text.available) {
              if (info.getHintText() == null && info.getTooltipText() != null) info.setHintText(info.getTooltipText());
              info.setTooltipText(text.value);
              break;
            }
          }
        }
      };
      ViewCompat.setAccessibilityDelegate(next, state.installed);
    }
  }
  void invalidate() {
    View view = target.get();
    if (state != null) {
      state.bindings.remove(this);
      if (state.bindings.isEmpty() && view != null) {
        AccessibilityDelegateCompat current = ViewCompat.getAccessibilityDelegate(view);
        if (current == state.installed) ViewCompat.setAccessibilityDelegate(view, state.original);
        states.remove(view);
      }
    }
    target.clear(); description.clear(); state = null;
  }
}
