package com.codonui.input;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.UIManagerHelper;
import java.util.UUID;
import java.lang.ref.WeakReference;
import java.util.WeakHashMap;
import android.view.View;
import com.facebook.react.views.textinput.ReactEditText;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

@ReactModule(name = CUIFormDocumentModule.NAME)
public final class CUIFormDocumentModule extends NativeCUIFormDocumentSpec {
  private final AtomicBoolean valid = new AtomicBoolean(true);
  private final String semanticModuleId = UUID.randomUUID().toString();
  private final WeakHashMap<CUIFormMetadataView, String> semanticHosts = new WeakHashMap<>();
  CUIFormDocumentModule(ReactApplicationContext context) { super(context); }

  private static int positiveInteger(JSONObject request, String key) throws Exception {
    Object raw = request.get(key);
    if (!(raw instanceof Number)) throw new IllegalArgumentException("form-target-invalid");
    double value = ((Number)raw).doubleValue();
    if (!Double.isFinite(value) || value <= 0 || value > Integer.MAX_VALUE || value != Math.rint(value))
      throw new IllegalArgumentException("form-target-invalid");
    return (int)value;
  }

  private void refreshField(FabricUIManager manager, CUIFormMetadataView metadata, View editor, String owner, String descriptor) throws Exception {
    metadata.setSemanticContribution(null);
    JSONObject mount = metadata.formMountSnapshot();
    if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance() || editor == null ||
        !metadata.ownerId.equals(owner) || !metadata.descriptorId.equals(descriptor) ||
        metadata.originalForMountSnapshot(mount) != editor || metadata.semanticBinding.isEmpty() || manager.resolveView(editor.getId()) != editor) {
      metadata.resetSemanticAccessibilityFocus(); return;
    }
    int surface = mount.getInt("surfaceId");
    String encoded = metadata.semanticBinding, revision = metadata.descriptorRevision;
    JSONObject plan = new JSONObject(encoded);
    plan.getJSONObject("text");
    WeakReference<CUIFormDocumentModule> moduleRef = new WeakReference<>(this);
    WeakReference<CUIFormMetadataView> metadataRef = new WeakReference<>(metadata);
    WeakReference<View> editorRef = new WeakReference<>(editor);
    WeakReference<FabricUIManager> managerRef = new WeakReference<>(manager);
    CUIFieldSemantics.Current current = () -> {
      CUIFormDocumentModule module = moduleRef.get(); CUIFormMetadataView binding = metadataRef.get();
      View original = editorRef.get(); FabricUIManager fabric = managerRef.get();
      if (module == null || !module.valid.get() || !module.getReactApplicationContext().hasActiveReactInstance() ||
          binding == null || original == null || fabric == null || !binding.ownerId.equals(owner) || !binding.descriptorId.equals(descriptor) ||
          !binding.descriptorRevision.equals(revision) || !binding.semanticBinding.equals(encoded) ||
          binding.originalForMountSnapshot(mount) != original) return false;
      return true;
    };
    boolean dateField = editor instanceof CUIDateSegment;
    if (dateField != plan.has("dateField")) { metadata.resetSemanticAccessibilityFocus(); return; }
    CUIFormMetadataView.SemanticContribution contribution = dateField ? CUIFieldSemantics.bindDateField(manager,
        CUIOwnedDateField.resolveAll(manager, metadata, metadata.ownedEditorBinding, editor.getId(), surface), plan, current) :
        CUIFieldSemantics.bind(manager, (ReactEditText)editor, plan, current);
    metadata.setSemanticContribution(contribution);
    if (dateField || contribution == null || !current.check() || !editor.isFocused() || plan.getBoolean("disabled")) { metadata.resetSemanticAccessibilityFocus(); return; }
    if (!plan.getBoolean("expanded")) {
      if (current.check()) metadata.requestSemanticAccessibilityFocus(editor, descriptor, editor, true);
      else metadata.resetSemanticAccessibilityFocus();
      return;
    }
    if (!plan.isNull("activeDescendant")) {
      JSONObject active = plan.getJSONObject("activeDescendant");
      CUICollectionRoot.Admission admission = CUICollectionRoot.resolveCurrentOption(
        active.getString("binding"), active.getInt("target"), editor, () -> {
          try { return current.check(); } catch (Exception retired) { return false; }
        });
      if (admission != null && admission.current())
        metadata.requestSemanticAccessibilityFocus(admission.originalOption, admission.opaqueFocusIdentity, editor, false);
      else if (current.check()) metadata.clearSemanticAccessibilityRequest();
      else metadata.resetSemanticAccessibilityFocus();
    } else metadata.clearSemanticAccessibilityRequest();
  }

  @Override public void bindField(String encoded, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("field-module-retired");
        JSONObject request = new JSONObject(encoded), mount = request.getJSONObject("mount");
        String nonce = request.getString("requestId"); if (nonce.isEmpty()) throw new IllegalArgumentException("field-binding-request-invalid");
        UIManager selected = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), positiveInteger(mount, "originalTarget"));
        if (!(selected instanceof FabricUIManager)) throw new IllegalStateException("field-Fabric-unavailable");
        FabricUIManager manager = (FabricUIManager)selected;
        View target = manager.resolveView(positiveInteger(mount, "target")), original = manager.resolveView(positiveInteger(mount, "originalTarget"));
        if (!(target instanceof CUIFormMetadataView) || !((CUIFormMetadataView)target).isFieldBinding() || (!(original instanceof ReactEditText) && !(original instanceof CUIDateSegment)))
          throw new IllegalStateException("field-binding-original-editor-retired");
        CUIFormMetadataView metadata = (CUIFormMetadataView)target; View editor = original;
        if (metadata.originalForMountSnapshot(mount) != editor || !metadata.semanticBinding.equals(request.getString("semanticBinding")))
          throw new IllegalStateException("field-binding-original-editor-retired");
        String owner = metadata.ownerId, descriptor = metadata.descriptorId, token = semanticModuleId + ":binding:" + nonce;
        WeakReference<CUIFormDocumentModule> moduleRef = new WeakReference<>(this);
        WeakReference<CUIFormMetadataView> metadataRef = new WeakReference<>(metadata);
        WeakReference<View> editorRef = new WeakReference<>(editor);
        WeakReference<FabricUIManager> managerRef = new WeakReference<>(manager);
        metadata.setSemanticRefresh(() -> {
          CUIFormDocumentModule module = moduleRef.get(); CUIFormMetadataView binding = metadataRef.get(); FabricUIManager fabric = managerRef.get();
          if (binding == null) return;
          try {
            if (module == null || fabric == null) { binding.setSemanticContribution(null); binding.resetSemanticAccessibilityFocus(); return; }
            module.refreshField(fabric, binding, editorRef.get(), owner, descriptor);
          } catch (Exception retired) { binding.setSemanticContribution(null); binding.resetSemanticAccessibilityFocus(); }
        }, token, semanticModuleId);
        semanticHosts.put(metadata, token);
        promise.resolve(new JSONObject().put("requestId", nonce).put("ownerToken", token).put("metadataTarget", metadata.getId()).toString());
      } catch (Exception failure) { promise.reject("E_CUI_FIELD_BINDING", failure); }
    });
  }
  @Override public void unbindField(String encoded, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        JSONObject request = new JSONObject(encoded); int target = positiveInteger(request, "metadataTarget");
        String token = request.getString("ownerToken"); UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), target);
        View view = manager == null ? null : manager.resolveView(target);
        boolean owned = view instanceof CUIFormMetadataView && token.equals(semanticHosts.get((CUIFormMetadataView)view));
        if (owned) { ((CUIFormMetadataView)view).clearSemanticRefresh(token, false); semanticHosts.remove((CUIFormMetadataView)view); }
        promise.resolve(owned);
      } catch (Exception failure) { promise.reject("E_CUI_FIELD_BINDING", failure); }
    });
  }

  @Override public void readFocusParticipants(String encoded, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("focus-participant-module-retired");
        JSONObject request = new JSONObject(encoded);
        int rootTarget = positiveInteger(request, "rootTarget");
        UIManager selected = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), rootTarget);
        if (!(selected instanceof FabricUIManager)) throw new IllegalStateException("focus-participant-Fabric-unavailable");
        promise.resolve(CUIFieldGroupDocument.readFocusParticipants((FabricUIManager)selected, request).toString());
      } catch (Exception failure) { promise.reject("E_CUI_FOCUS_PARTICIPANTS", failure); }
    });
  }
  @Override public void admitForm(String encoded, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("form-module-retired");
        JSONObject request = new JSONObject(encoded);
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), positiveInteger(request.getJSONObject("form"), "target"));
        CUIFormActionAdmission.admitModel(manager, request);
        promise.resolve(new JSONObject().put("accepted", true).put("requestId", request.getString("requestId"))
          .put("formRevision", request.getJSONObject("form").getString("descriptorRevision")).toString());
      } catch (Exception failure) { promise.reject("E_CUI_FORM_ADMISSION", failure); }
    });
  }
  @Override public void focusField(String encoded, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("form-module-retired");
        JSONObject request = new JSONObject(encoded);
        String origin = request.getString("origin");
        if (!("native".equals(origin) && request.has("actionLease")) && !("programmatic".equals(origin) && !request.has("actionLease")))
          throw new IllegalStateException("form-focus-origin-invalid");
        JSONObject admission = new JSONObject(request.toString()).put("fields", new org.json.JSONArray().put(
          new JSONObject().put("field", request.getJSONObject("field")).put("mount", request.getJSONObject("mount"))));
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), positiveInteger(request.getJSONObject("form"), "target"));
        CUIFormActionAdmission.admitModel(manager, admission);
        promise.resolve(CUIFormFieldFocus.focus(manager, request, () -> {
          if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) return false;
          CUIFormActionAdmission.admitModel(manager, admission); return true;
        }).toString());
      } catch (Exception failure) { promise.reject("E_CUI_FORM_FOCUS", failure); }
    });
  }

  @Override public synchronized void invalidate() {
    valid.set(false);
    UiThreadUtil.runOnUiThread(() -> {
      for (java.util.Map.Entry<CUIFormMetadataView, String> entry : semanticHosts.entrySet()) entry.getKey().clearSemanticRefresh(entry.getValue(), true);
      semanticHosts.clear();
    });
    super.invalidate();
  }
}
