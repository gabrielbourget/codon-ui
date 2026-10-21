package com.codonui.input;

import android.content.Context;
import android.view.View;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UIManagerListener;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.textinput.ReactEditText;
import com.facebook.react.views.view.ReactViewGroup;
import java.lang.ref.WeakReference;
import org.json.JSONArray;

@androidx.annotation.OptIn(markerClass = com.facebook.react.common.annotations.UnstableReactNativeAPI.class)
final class CUIFormMetadataView extends CUICollectionNode implements UIManagerListener {
  int originalTarget;
  private final boolean fieldBinding;
  private UIManager manager;
  private WeakReference<View> original = new WeakReference<>(null);
  private String window = "", identity = "", signature = "";
  private int surface = -1;
  private long epoch, sequence, mountBatch;

  CUIFormMetadataView(Context context, boolean fieldBinding) { super(context); this.fieldBinding = fieldBinding; }

  private void connect() {
    if (manager != null || !isAttachedToWindow() || !(getContext() instanceof ReactContext)) return;
    manager = UIManagerHelper.getUIManagerForReactTag((ReactContext)getContext(), getId());
    if (manager != null) manager.addUIManagerEventListener(this);
  }
  private void disconnect() {
    if (manager != null) manager.removeUIManagerEventListener(this);
    manager = null;
  }
  @Override protected void onAttachedToWindow() {
    super.onAttachedToWindow(); epoch++; window = CUIInputWindow.identity(this); signature = ""; connect();
  }
  @Override protected void onDetachedFromWindow() {
    publish(false, "detached"); disconnect(); epoch++; signature = ""; super.onDetachedFromWindow();
  }
  void retire() {
    publish(false, "retired"); disconnect(); epoch++; signature = ""; identity = ""; original.clear();
    ownerId = ""; descriptorId = ""; descriptorRevision = ""; originalTarget = 0;
  }

  private void publish(boolean attached, String mountRevision) {
    if (ownerId.isEmpty() || descriptorId.isEmpty() || descriptorRevision.isEmpty()) return;
    attached &= isAttachedToWindow();
    String currentWindow = attached ? CUIInputWindow.identity(this) : window;
    View target = attached && originalTarget > 0 ? getRootView().findViewById(originalTarget) : null;
    int currentSurface = UIManagerHelper.getSurfaceId(this);
    String currentIdentity = new JSONArray().put(ownerId).put(descriptorId).put(descriptorRevision).put(originalTarget).toString();
    if (!window.equals(currentWindow) || original.get() != target || !identity.equals(currentIdentity) || surface != currentSurface) {
      epoch++; window = currentWindow; original = new WeakReference<>(target); identity = currentIdentity; surface = currentSurface;
    }
    boolean correctType = fieldBinding ? target instanceof ReactEditText : target instanceof ReactViewGroup && !(target instanceof CUICollectionNode);
    boolean metadataOnly = isMetadataOnly();
    boolean complete = attached && surface > 0 && !window.isEmpty() && target != null && target.isAttachedToWindow()
      && window.equals(CUIInputWindow.identity(target)) && correctType && metadataOnly;
    String error = !attached ? "form-metadata-detached" : target == null ? "form-original-target-unavailable" :
      !correctType ? "form-original-type-mismatch" : !metadataOnly ? "form-metadata-not-inert" : !complete ? "form-metadata-incomplete" : "";
    String originalClass = target == null ? "" : target.getClass().getName();
    String nextSignature = new JSONArray().put(identity).put(getId()).put(surface).put(window).put(epoch)
      .put(attached).put(complete).put(metadataOnly).put(originalClass).put(error).toString();
    if (signature.equals(nextSignature)) return;
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ReactContext)getContext(), getId());
    if (dispatcher == null) return;
    signature = nextSignature;
    WritableMap data = Arguments.createMap();
    data.putString("ownerId", ownerId); data.putString("descriptorId", descriptorId); data.putString("descriptorRevision", descriptorRevision);
    data.putInt("target", getId()); data.putInt("originalTarget", originalTarget); data.putInt("surfaceId", surface);
    data.putString("windowId", window); data.putDouble("epoch", epoch); data.putDouble("sequence", ++sequence);
    data.putString("mountRevision", mountRevision); data.putBoolean("attached", attached); data.putBoolean("complete", complete);
    data.putBoolean("metadataOnly", metadataOnly); data.putString("originalClass", originalClass); data.putString("error", error);
    dispatcher.dispatchEvent(new CommitEvent(surface, getId(), data));
  }
  @Override public void didMountItems(UIManager manager) { if (this.manager == manager) publish(true, "android-ui-mount-batch:" + ++mountBatch); }
  @Override public void willDispatchViewUpdates(UIManager manager) {}
  @Override public void willMountItems(UIManager manager) {}
  @Override public void didDispatchMountItems(UIManager manager) {}
  @Override public void didScheduleMountItems(UIManager manager) {}

  private static final class CommitEvent extends Event<CommitEvent> {
    private final WritableMap data;
    CommitEvent(int surface, int tag, WritableMap data) { super(surface, tag); this.data = data; }
    @Override public String getEventName() { return "topNativeFormCommit"; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
  }
}
