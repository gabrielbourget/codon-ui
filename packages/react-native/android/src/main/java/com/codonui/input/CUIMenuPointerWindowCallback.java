package com.codonui.input;

import android.view.ActionMode;
import android.os.Build;
import android.util.Log;
import android.view.KeyEvent;
import android.view.KeyboardShortcutGroup;
import android.view.Menu;
import android.view.MenuItem;
import android.view.MotionEvent;
import android.view.SearchEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import java.lang.ref.WeakReference;
import java.util.List;

/** Separate native default policy. Every dispatch keeps the original MotionEvent and callback path. */
final class CUIMenuPointerWindowCallback implements Window.Callback, AutoCloseable {
  interface Listener {
    boolean before(MotionEvent event, boolean generic);
    void after(MotionEvent event, boolean generic);
    void keyboard(KeyEvent event);
    void lostWindow();
    void failed(RuntimeException failure);
  }
  private final WeakReference<Window> window;
  private final Window.Callback original;
  private final Listener listener;
  private boolean closed;

  CUIMenuPointerWindowCallback(Window window, Listener listener) {
    this.window = new WeakReference<>(window);
    this.listener = listener;
    Window.Callback callback = window.getCallback();
    if (callback instanceof CUIWindowPointerCallback) {
      CUIWindowPointerCallback passive = (CUIWindowPointerCallback) callback;
      original = passive.delegate();
      if (original instanceof CUIMenuPointerWindowCallback || !passive.replaceDelegate(original, this))
        throw new IllegalStateException("Native Menu: original passive callback lease unavailable");
    } else {
      if (callback == null || callback instanceof CUIMenuPointerWindowCallback)
        throw new IllegalStateException("Native Menu: original window callback unavailable");
      original = callback;
      window.setCallback(this);
    }
  }
  boolean isInstalled() {
    Window current = window.get();
    if (closed || current == null) return false;
    Window.Callback callback = current.getCallback();
    return callback == this || callback instanceof CUIWindowPointerCallback && ((CUIWindowPointerCallback) callback).delegate() == this;
  }
  private void report(RuntimeException failure) {
    try { listener.failed(failure); }
    catch (RuntimeException reportingFailure) { Log.e("CodonInput", "Native Menu policy could not report its failure", reportingFailure); }
  }
  private boolean dispatch(MotionEvent event, boolean generic) {
    boolean preventFocus = false;
    if (isInstalled()) {
      try { preventFocus = listener.before(event, generic); }
      catch (RuntimeException failure) { report(failure); }
    }
    Window current = window.get();
    View decor = current == null ? null : current.getDecorView();
    ViewGroup root = preventFocus && decor instanceof ViewGroup ? (ViewGroup) decor : null;
    int previous = root == null ? 0 : root.getDescendantFocusability();
    if (root != null) root.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
    try {
      return generic ? original.dispatchGenericMotionEvent(event) : original.dispatchTouchEvent(event);
    } finally {
      if (root != null) root.setDescendantFocusability(previous);
      if (isInstalled()) {
        try { listener.after(event, generic); }
        catch (RuntimeException failure) { report(failure); }
      }
    }
  }
  @Override public boolean dispatchTouchEvent(MotionEvent event) { return dispatch(event, false); }
  @Override public boolean dispatchGenericMotionEvent(MotionEvent event) { return dispatch(event, true); }
  @Override public boolean dispatchKeyEvent(KeyEvent event) {
    if (isInstalled()) { try { listener.keyboard(event); } catch (RuntimeException failure) { report(failure); } }
    return original.dispatchKeyEvent(event);
  }
  @Override public void onWindowFocusChanged(boolean focused) {
    if (!focused && isInstalled()) { try { listener.lostWindow(); } catch (RuntimeException failure) { report(failure); } }
    original.onWindowFocusChanged(focused);
  }
  @Override public void onDetachedFromWindow() {
    if (isInstalled()) { try { listener.lostWindow(); } catch (RuntimeException failure) { report(failure); } }
    original.onDetachedFromWindow();
  }
  @Override public void close() {
    if (closed) return;
    Window current = window.get();
    closed = true;
    if (current == null) return;
    Window.Callback callback = current.getCallback();
    if (callback == this) current.setCallback(original);
    else if (callback instanceof CUIWindowPointerCallback) ((CUIWindowPointerCallback) callback).replaceDelegate(this, original);
  }
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
    if (Build.VERSION.SDK_INT >= 26) original.onPointerCaptureChanged(captured);
  }
}
