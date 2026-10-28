package com.codonui.input;

import android.view.View;
import com.facebook.react.bridge.UiThreadUtil;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.IdentityHashMap;

/** Retain this token while the original target's native compositor can supply complete frames.
 * Registration, replacement and close are UI-thread operations. */
public final class CUIBackdropCaptureRegistration implements AutoCloseable {
  private final WeakReference<View> target;
  private CUIBackdropCaptureSource source;
  private final IdentityHashMap<Object, Runnable> retirements = new IdentityHashMap<>();

  CUIBackdropCaptureRegistration(View target, CUIBackdropCaptureSource source) {
    this.target = new WeakReference<>(target); this.source = source;
  }
  public View getTarget() { return target.get(); }
  public boolean isActive() {
    UiThreadUtil.assertOnUiThread();
    View view = target.get();
    return source != null && view != null && CUIBackdropCaptureRegistry.find(view) == this;
  }
  CUIBackdropCaptureSource source() {
    if (!isActive()) throw new IllegalStateException("Native backdrop: capture registration retired");
    return source;
  }
  Runnable onRetire(Runnable callback) {
    if (!isActive()) throw new IllegalStateException("Native backdrop: capture registration retired");
    Object key = new Object(); retirements.put(key, callback);
    WeakReference<CUIBackdropCaptureRegistration> owner = new WeakReference<>(this);
    return () -> { CUIBackdropCaptureRegistration value = owner.get(); if (value != null) value.retirements.remove(key); };
  }
  @Override public void close() {
    UiThreadUtil.assertOnUiThread();
    if (source == null) return;
    source = null;
    CUIBackdropCaptureRegistry.remove(this);
    ArrayList<Runnable> pending = new ArrayList<>(retirements.values()); retirements.clear();
    for (Runnable callback : pending) callback.run();
  }
}
