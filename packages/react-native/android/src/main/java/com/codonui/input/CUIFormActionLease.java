package com.codonui.input;

import android.view.View;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.common.LifecycleState;
import java.lang.ref.WeakReference;
import org.json.JSONObject;

final class CUIFormActionLease implements LifecycleEventListener {
  interface Environment { JSONObject read() throws Exception; }
  interface Emitter { void emit(JSONObject value); }
  private final WeakReference<ReactContext> context;
  private final Environment environment;
  private final Emitter emitter;
  private JSONObject binding, snapshot;
  private String signature = "";
  private long epoch, sequence;
  private boolean observing, resumed, attached;

  CUIFormActionLease(View root, Environment environment, Emitter emitter) {
    context = new WeakReference<>(root.getContext() instanceof ReactContext ? (ReactContext)root.getContext() : null);
    attached = root.isAttachedToWindow();
    this.environment = environment; this.emitter = emitter;
  }
  void configure(String encoded) {
    try {
      JSONObject value = new JSONObject(encoded);
      if (!(value.get("ownerId") instanceof String) || value.getString("ownerId").isEmpty() ||
          !(value.get("descriptorRevision") instanceof String) || value.getString("descriptorRevision").isEmpty() ||
          !(value.get("enabled") instanceof Boolean)) throw new IllegalArgumentException("form-action-binding-invalid");
      if (binding == null || !binding.toString().equals(value.toString())) { binding = value; signature = ""; }
      ReactContext react = context.get();
      if (!observing && react != null) {
        resumed = react.getLifecycleState() == LifecycleState.RESUMED;
        observing = true; react.addLifecycleEventListener(this);
      }
      snapshot();
    } catch (Exception invalid) { invalidate(); }
  }
  JSONObject snapshot() {
    if (binding == null) return null;
    try {
      JSONObject value = environment.read();
      value.put("attached", attached && value.getBoolean("attached"));
      value.put("ownerId", binding.getString("ownerId")).put("descriptorRevision", binding.getString("descriptorRevision"));
      value.put("active", value.getBoolean("active") && resumed && attached).put("enabled", value.getBoolean("enabled") && binding.getBoolean("enabled"));
      String next = value.toString();
      if (!signature.equals(next)) {
        signature = next; value.put("epoch", ++epoch).put("sequence", ++sequence); snapshot = value; emitter.emit(value);
      }
      return snapshot == null ? null : new JSONObject(snapshot.toString());
    } catch (Exception unavailable) { return null; }
  }
  void attachmentChanged(boolean value) { attached = value; snapshot(); }
  void invalidate() {
    ReactContext react = context.get();
    if (observing && react != null) react.removeLifecycleEventListener(this);
    observing = false; binding = null; snapshot = null; signature = ""; epoch++;
  }
  @Override public void onHostResume() { resumed = true; snapshot(); }
  @Override public void onHostPause() { resumed = false; snapshot(); }
  @Override public void onHostDestroy() { resumed = false; snapshot(); invalidate(); }
}
