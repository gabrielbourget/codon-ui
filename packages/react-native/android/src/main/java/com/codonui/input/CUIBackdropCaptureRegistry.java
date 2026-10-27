package com.codonui.input;

import android.view.View;
import com.facebook.react.bridge.UiThreadUtil;
import java.lang.ref.WeakReference;
import java.util.ArrayList;

/** Weak view/token index. Callers, rather than this registry, own the provider's lifetime. */
public final class CUIBackdropCaptureRegistry {
  private static final class Entry {
    final WeakReference<View> target;
    final WeakReference<CUIBackdropCaptureRegistration> token;
    Entry(View view, CUIBackdropCaptureRegistration value) {
      target = new WeakReference<>(view); token = new WeakReference<>(value);
    }
  }
  private static final ArrayList<Entry> entries = new ArrayList<>();
  private CUIBackdropCaptureRegistry() {}
  public static CUIBackdropCaptureRegistration register(View target, CUIBackdropCaptureSource source) {
    UiThreadUtil.assertOnUiThread();
    if (target == null || source == null) throw new IllegalArgumentException("Native backdrop: target/source required");
    CUIBackdropCaptureRegistration previous = find(target);
    if (previous != null) previous.close();
    CUIBackdropCaptureRegistration next = new CUIBackdropCaptureRegistration(target, source);
    entries.add(new Entry(target, next)); return next;
  }
  static CUIBackdropCaptureRegistration find(View target) {
    UiThreadUtil.assertOnUiThread();
    CUIBackdropCaptureRegistration found = null;
    for (int index = entries.size() - 1; index >= 0; index--) {
      Entry entry = entries.get(index);
      View view = entry.target.get(); CUIBackdropCaptureRegistration token = entry.token.get();
      if (view == null || token == null) entries.remove(index);
      else if (view == target) found = token;
    }
    return found;
  }
  static void remove(CUIBackdropCaptureRegistration token) {
    entries.removeIf(entry -> entry.token.get() == null || entry.target.get() == null || entry.token.get() == token);
  }
}
