package com.codonui.input;

import android.view.MotionEvent;
import android.view.ViewGroup;
import com.facebook.react.uimanager.JSPointerDispatcher;
import com.facebook.react.uimanager.events.BatchEventDispatchedListener;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.uimanager.events.EventDispatcherListener;
import java.util.Set;
import java.lang.ref.WeakReference;
import java.util.WeakHashMap;

// One original SDK dispatcher, scoped to the admitted field's logical targets.
// The original native MotionEvent still reaches its normal native owner once.
final class CUIFieldPointerDispatcher implements EventDispatcher {
  private static final WeakHashMap<ViewGroup, WeakReference<CUIFieldPointerDispatcher>> surfaces = new WeakHashMap<>();
  private final ViewGroup surface;
  private final JSPointerDispatcher pointers;
  private final EventDispatcher original;
  private Set<Integer> members;

  CUIFieldPointerDispatcher(ViewGroup surface, EventDispatcher original) {
    this.surface = surface;
    this.original = original;
    pointers = new JSPointerDispatcher(surface);
  }
  static CUIFieldPointerDispatcher forSurface(ViewGroup surface, EventDispatcher original) {
    WeakReference<CUIFieldPointerDispatcher> reference = surfaces.get(surface);
    CUIFieldPointerDispatcher current = reference == null ? null : reference.get();
    if (current == null || !current.matches(surface, original)) {
      current = new CUIFieldPointerDispatcher(surface, original);
      surfaces.put(surface, new WeakReference<>(current));
    }
    return current;
  }
  boolean matches(ViewGroup surface, EventDispatcher original) { return this.surface == surface && this.original == original; }
  ViewGroup surface() { return surface; }
  void dispatch(MotionEvent event, Set<Integer> members) {
    Set<Integer> previous = this.members;
    this.members = members;
    MotionEvent inSurface = MotionEvent.obtain(event);
    try {
      int[] position = new int[2]; surface.getLocationOnScreen(position);
      inSurface.setLocation(event.getRawX() - position[0], event.getRawY() - position[1]);
      pointers.handleMotionEvent(inSurface, this, false);
    } finally { inSurface.recycle(); this.members = previous; }
  }
  @Override public void dispatchEvent(Event event) {
    if (members != null && members.contains(event.getViewTag())) original.dispatchEvent(event);
    else event.dispose();
  }
  @Override public void dispatchAllEvents() { original.dispatchAllEvents(); }
  @Override public void addListener(EventDispatcherListener listener) { original.addListener(listener); }
  @Override public void removeListener(EventDispatcherListener listener) { original.removeListener(listener); }
  @Override public void addBatchEventDispatchedListener(BatchEventDispatchedListener listener) { original.addBatchEventDispatchedListener(listener); }
  @Override public void removeBatchEventDispatchedListener(BatchEventDispatchedListener listener) { original.removeBatchEventDispatchedListener(listener); }
  @Override public void onCatalystInstanceDestroyed() { original.onCatalystInstanceDestroyed(); }
}
