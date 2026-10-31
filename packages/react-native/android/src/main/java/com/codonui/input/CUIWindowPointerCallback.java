package com.codonui.input;

import android.os.Build;
import android.util.Log;
import android.view.ActionMode;
import android.view.KeyEvent;
import android.view.KeyboardShortcutGroup;
import android.view.Menu;
import android.view.MenuItem;
import android.view.MotionEvent;
import android.view.SearchEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import java.lang.ref.WeakReference;
import java.util.List;

/** Private per-window observer. Original framework dispatch always goes through the original callback. */
final class CUIWindowPointerCallback implements Window.Callback, AutoCloseable {
  interface Listener {
    Runnable preparePointer(MotionEvent event, boolean generic);
    void focusChanged(boolean focused);
    void detached();
    void failed(RuntimeException failure);
  }

  private final WeakReference<Window> window;
  private Window.Callback original;
  private final Listener listener;
  private boolean closed;

  CUIWindowPointerCallback(Window window, Listener listener) {
    Window.Callback callback = window.getCallback();
    if (callback == null || callback instanceof CUIWindowPointerCallback)
      throw new IllegalStateException("CUI pointer observer: actual unwrapped window callback required");
    this.window = new WeakReference<>(window);
    this.original = callback;
    this.listener = listener;
    window.setCallback(this);
  }

  boolean isInstalled() {
    Window current = window.get();
    return !closed && current != null && current.getCallback() == this;
  }

  // The separate Menu policy sits inside this passive transport; this observer still delegates every original event.
  Window.Callback delegate() { return original; }
  boolean replaceDelegate(Window.Callback expected, Window.Callback next) {
    if (!isInstalled() || original != expected) return false;
    original = next;
    return true;
  }

  private void report(RuntimeException failure) {
    try { listener.failed(failure); }
    catch (RuntimeException reportingFailure) {
      Log.e("CodonInput", "Window pointer observation could not report its failure", reportingFailure);
    }
  }

  private Runnable prepare(MotionEvent snapshot, boolean generic) {
    try {
      return isInstalled() ? listener.preparePointer(snapshot, generic) : null;
    } catch (RuntimeException failure) {
      report(failure);
      return null;
    } finally {
      snapshot.recycle();
    }
  }

  private void observe(Runnable delivery) {
    if (delivery == null || !isInstalled()) return;
    try { delivery.run(); }
    catch (RuntimeException failure) { report(failure); }
  }

  @Override public boolean dispatchTouchEvent(MotionEvent event) {
    Runnable delivery = isInstalled() ? prepare(MotionEvent.obtain(event), false) : null;
    boolean result = original.dispatchTouchEvent(event);
    observe(delivery);
    return result;
  }

  @Override public boolean dispatchGenericMotionEvent(MotionEvent event) {
    Runnable delivery = isInstalled() ? prepare(MotionEvent.obtain(event), true) : null;
    boolean result = original.dispatchGenericMotionEvent(event);
    observe(delivery);
    return result;
  }

  @Override public void onWindowFocusChanged(boolean focused) {
    original.onWindowFocusChanged(focused);
    if (isInstalled()) {
      try { listener.focusChanged(focused); }
      catch (RuntimeException failure) { report(failure); }
    }
  }

  @Override public void onDetachedFromWindow() {
    original.onDetachedFromWindow();
    if (isInstalled()) {
      try { listener.detached(); }
      catch (RuntimeException failure) { report(failure); }
    }
  }

  @Override public void close() {
    if (closed) return;
    Window current = window.get();
    closed = true;
    if (current != null && current.getCallback() == this) current.setCallback(original);
  }

  @Override public boolean dispatchKeyEvent(KeyEvent event) { return original.dispatchKeyEvent(event); }
  @Override public boolean dispatchKeyShortcutEvent(KeyEvent event) { return original.dispatchKeyShortcutEvent(event); }
  @Override public boolean dispatchTrackballEvent(MotionEvent event) { return original.dispatchTrackballEvent(event); }
  @Override public boolean dispatchPopulateAccessibilityEvent(AccessibilityEvent event) { return original.dispatchPopulateAccessibilityEvent(event); }
  @Override public View onCreatePanelView(int feature) { return original.onCreatePanelView(feature); }
  @Override public boolean onCreatePanelMenu(int feature, Menu menu) { return original.onCreatePanelMenu(feature, menu); }
  @Override public boolean onPreparePanel(int feature, View view, Menu menu) { return original.onPreparePanel(feature, view, menu); }
  @Override public boolean onMenuOpened(int feature, Menu menu) { return original.onMenuOpened(feature, menu); }
  @Override public boolean onMenuItemSelected(int feature, MenuItem item) { return original.onMenuItemSelected(feature, item); }
  @Override public void onWindowAttributesChanged(WindowManager.LayoutParams attributes) { original.onWindowAttributesChanged(attributes); }
  @Override public void onContentChanged() { original.onContentChanged(); }
  @Override public void onAttachedToWindow() { original.onAttachedToWindow(); }
  @Override public void onPanelClosed(int feature, Menu menu) { original.onPanelClosed(feature, menu); }
  @Override public boolean onSearchRequested() { return original.onSearchRequested(); }
  @Override public boolean onSearchRequested(SearchEvent event) { return original.onSearchRequested(event); }
  @Override public ActionMode onWindowStartingActionMode(ActionMode.Callback callback) { return original.onWindowStartingActionMode(callback); }
  @Override public ActionMode onWindowStartingActionMode(ActionMode.Callback callback, int type) { return original.onWindowStartingActionMode(callback, type); }
  @Override public void onActionModeStarted(ActionMode mode) { original.onActionModeStarted(mode); }
  @Override public void onActionModeFinished(ActionMode mode) { original.onActionModeFinished(mode); }
  @Override public void onProvideKeyboardShortcuts(List<KeyboardShortcutGroup> groups, Menu menu, int deviceId) { original.onProvideKeyboardShortcuts(groups, menu, deviceId); }
  @Override public void onPointerCaptureChanged(boolean captured) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) original.onPointerCaptureChanged(captured);
  }
}
