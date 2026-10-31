package com.codonui.input;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.turbomodule.core.interfaces.BindingsInstallerHolder;
import com.facebook.react.turbomodule.core.interfaces.TurboModuleWithJSIBindings;
import java.lang.ref.WeakReference;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

@ReactModule(name = CUIEditorKeyboardDefaultsModule.NAME)
public final class CUIEditorKeyboardDefaultsModule extends NativeCUIEditorKeyboardDefaultsSpec implements TurboModuleWithJSIBindings {
  static { System.loadLibrary("codon_motion"); }
  static final String NAME = "CUIEditorKeyboardDefaults";
  private static final ConcurrentHashMap<String, WeakReference<CUIEditorKeyboardDefaultFrames>> REGISTRY = new ConcurrentHashMap<>();
  private final String lease = UUID.randomUUID().toString();
  private final CUIEditorKeyboardDefaultFrames frames = new CUIEditorKeyboardDefaultFrames();
  private final AtomicBoolean valid = new AtomicBoolean(true);
  private final BindingsInstallerHolder fieldBindings = nativeFieldBindings(lease);
  private static native BindingsInstallerHolder nativeFieldBindings(String lease);
  private static native String nativeTakeFieldRecords(String lease);
  private static native boolean nativeSettleField(String lease, String request);
  private static native boolean nativeAcceptsField(String lease, String request);
  private static native void nativeRetireField(String lease);
  CUIEditorKeyboardDefaultsModule(ReactApplicationContext context) {
    super(context);
    REGISTRY.put(lease, new WeakReference<>(frames));
  }
  static CUIEditorKeyboardDefaultFrames forLease(String lease) {
    WeakReference<CUIEditorKeyboardDefaultFrames> reference = REGISTRY.get(lease);
    return reference == null ? null : reference.get();
  }
  @Override public String takeFieldRecords() { return nativeTakeFieldRecords(lease); }
  @Override public String getLease() { return valid.get() ? lease : ""; }
  @Override public BindingsInstallerHolder getBindingsInstaller() { return fieldBindings; }
  @Override public boolean settleField(String request) { return valid.get() && nativeSettleField(lease, request); }
  @Override public boolean acceptsField(String request) { return valid.get() && nativeAcceptsField(lease, request); }
  @Override public String moveFieldFocus(String request) {
    throw new IllegalStateException("field-input-focus-requires-current-runtime-binding");
  }
  @Override public boolean settle(String encoded) {
    if (!valid.get()) return false;
    try {
      JSONObject request = new JSONObject(encoded);
      for (String name : new String[]{"ownerId", "bindingId", "bindingRevision", "windowId", "phase"})
        if (!(request.get(name) instanceof String)) return false;
      for (String name : new String[]{"target", "epoch", "eventId"}) {
        Object raw = request.get(name);
        if (!(raw instanceof Number)) return false;
        double number = ((Number)raw).doubleValue();
        if (!Double.isFinite(number) || number != Math.rint(number) || number <= 0 || number > 9007199254740991.0) return false;
      }
      if (request.getDouble("target") > Integer.MAX_VALUE || !(request.get("current") instanceof Boolean) ||
        !(request.get("preventDefault") instanceof Boolean)) return false;
      CUIEditorKeyboardDefaultFrames.Identity identity = new CUIEditorKeyboardDefaultFrames.Identity(
        request.getString("ownerId"), request.getString("bindingId"), request.getString("bindingRevision"),
        request.getInt("target"), request.getString("windowId"), request.getLong("epoch"));
      return frames.acknowledge(identity, request.getLong("eventId"), request.getString("phase"),
        request.getBoolean("current"), request.getBoolean("preventDefault"));
    } catch (Exception failure) { return false; }
  }
  @Override public void invalidate() {
    valid.set(false);
    REGISTRY.remove(lease);
    frames.retire();
    nativeRetireField(lease);
    super.invalidate();
  }
}
