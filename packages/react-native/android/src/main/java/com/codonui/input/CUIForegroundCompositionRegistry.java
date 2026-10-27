package com.codonui.input;

import android.view.View;
import com.facebook.react.bridge.UiThreadUtil;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.IdentityHashMap;

/** Weak identity index; the producer retains the disposable token and owns the actual original ink. */
public final class CUIForegroundCompositionRegistry {
  private CUIForegroundCompositionRegistry() {}
  private static final class Entry {
    final WeakReference<View> root;
    final WeakReference<Registration> token;
    Entry(View root, Registration token) { this.root = new WeakReference<>(root); this.token = new WeakReference<>(token); }
  }
  private static final ArrayList<Entry> entries = new ArrayList<>();
  public static final class Registration implements AutoCloseable {
    private final WeakReference<View> root;
    private CUIForegroundCompositionSource source;
    private final IdentityHashMap<Object, Runnable> retirements = new IdentityHashMap<>();
    private Registration(View root, CUIForegroundCompositionSource source) { this.root = new WeakReference<>(root); this.source = source; }
    public View getRoot() { return root.get(); }
    public boolean isActive() { UiThreadUtil.assertOnUiThread(); return source != null && root.get() != null; }
    CUIForegroundCompositionSource source() {
      if (!isActive()) throw new IllegalStateException("Native foreground: registration retired");
      return source;
    }
    Runnable onRetire(Runnable callback) {
      source(); Object key = new Object(); retirements.put(key, callback);
      WeakReference<Registration> weak = new WeakReference<>(this);
      return () -> { Registration token = weak.get(); if (token != null) token.retirements.remove(key); };
    }
    @Override public void close() {
      UiThreadUtil.assertOnUiThread(); if (source == null) return; source = null;
      ArrayList<Runnable> pending = new ArrayList<>(retirements.values()); retirements.clear();
      for (Runnable callback : pending) callback.run();
    }
  }
  public static Registration register(View root, CUIForegroundCompositionSource source) {
    UiThreadUtil.assertOnUiThread();
    if (root == null || source == null) throw new IllegalArgumentException("Foreground root/source required");
    Registration old = exact(root); if (old != null) old.close();
    Registration token = new Registration(root, source); entries.add(new Entry(root, token)); return token;
  }
  private static Registration exact(View root) {
    Registration result = null;
    for (int index = entries.size()-1; index >= 0; index--) {
      Entry entry = entries.get(index); Registration token = entry.token.get();
      if (entry.root.get() == null || token == null || !token.isActive()) entries.remove(index);
      else if (entry.root.get() == root) result = token;
    }
    return result;
  }
  static Registration find(View owner) {
    UiThreadUtil.assertOnUiThread();
    for (View view = owner; view != null; view = view.getParent() instanceof View ? (View)view.getParent() : null) {
      Registration token = exact(view); if (token != null) return token;
    }
    return null;
  }
}
