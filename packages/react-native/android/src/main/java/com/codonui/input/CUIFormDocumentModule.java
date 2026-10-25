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
import java.util.HashMap;
import android.view.View;
import com.facebook.react.views.textinput.ReactEditText;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

@ReactModule(name = CUIFormDocumentModule.NAME)
public final class CUIFormDocumentModule extends NativeCUIFormDocumentSpec {
  static { System.loadLibrary("codon_motion"); }
  private final AtomicBoolean valid = new AtomicBoolean(true);
  private long session = nativeCreateFormSession(UUID.randomUUID().toString());
  private final String semanticModuleId = UUID.randomUUID().toString();
  private final WeakHashMap<CUIFormMetadataView, String> semanticHosts = new WeakHashMap<>();
  private String semanticDocumentStamp = "";
  private JSONObject semanticDocument;
  private final HashMap<Integer, JSONObject> semanticNodes = new HashMap<>(), semanticFields = new HashMap<>();
  private final WeakHashMap<CUIFormMetadataView, CUIFieldInputBinding> fieldInputs = new WeakHashMap<>();
  private final WeakHashMap<CUIFormMetadataView, String> fieldInputOwners = new WeakHashMap<>();
  CUIFormDocumentModule(ReactApplicationContext context) { super(context); }
  private static native String nativeFormDocument(FabricUIManager manager, int surface, int target, long session, String group);
  private static native String nativeFormDocumentStamp(FabricUIManager manager, int surface, long session);
  private static native String nativeFieldGroupSelection(String document, String snapshot);
  private static native long nativeCreateFormSession(String identity);
  private static native void nativeRetireFormSession(long session);

  private static int positiveInteger(JSONObject request, String key) throws Exception {
    Object raw = request.get(key);
    if (!(raw instanceof Number)) throw new IllegalArgumentException("form-target-invalid");
    double value = ((Number)raw).doubleValue();
    if (!Double.isFinite(value) || value <= 0 || value > Integer.MAX_VALUE || value != Math.rint(value))
      throw new IllegalArgumentException("form-target-invalid");
    return (int)value;
  }

  private synchronized String readSnapshot(FabricUIManager manager, int surface, int target) {
    return readSnapshot(manager, surface, target, "");
  }
  private synchronized String readSnapshot(FabricUIManager manager, int surface, int target, String group) {
    if (!valid.get() || session == 0) throw new IllegalStateException("form-module-retired");
    return nativeFormDocument(manager, surface, target, session, group);
  }
  private synchronized String readStamp(FabricUIManager manager, int surface) {
    if (!valid.get() || session == 0) throw new IllegalStateException("form-module-retired");
    return nativeFormDocumentStamp(manager, surface, session);
  }
  private JSONObject fieldDocument(FabricUIManager manager, int surface, int target) throws Exception {
    String stamp = readStamp(manager, surface);
    if (stamp.equals(semanticDocumentStamp) && semanticNodes.containsKey(target)) {
      JSONObject scoped = new JSONObject(); java.util.Iterator<String> keys = semanticDocument.keys();
      while (keys.hasNext()) { String key = keys.next(); scoped.put(key, semanticDocument.get(key)); }
      return scoped.put("target", target);
    }
    JSONObject document = new JSONObject(readSnapshot(manager, surface, target)), after = new JSONObject(readStamp(manager, surface));
    for (String key : new String[]{"documentId", "surfaceId", "rootTarget", "revision"})
      if (!document.get(key).equals(after.get(key))) throw new IllegalStateException("field-document-retired-during-read");
    HashMap<Integer, JSONObject> nodes = new HashMap<>(), fields = new HashMap<>();
    org.json.JSONArray allNodes = document.getJSONArray("nodes"), allFields = document.getJSONArray("fields");
    for (int index = 0; index < allNodes.length(); index++) { JSONObject node = allNodes.getJSONObject(index); nodes.put(node.getInt("target"), node); }
    for (int index = 0; index < allFields.length(); index++) { JSONObject field = allFields.getJSONObject(index); fields.put(field.getInt("metadataTarget"), field); }
    String indexedStamp = readStamp(manager, surface); JSONObject indexed = new JSONObject(indexedStamp);
    for (String key : new String[]{"documentId", "surfaceId", "rootTarget", "revision"})
      if (!document.get(key).equals(indexed.get(key))) throw new IllegalStateException("field-document-retired-during-index");
    // Keep one metadata-only revision. No original editor props/value or
    // ShadowNode survives the request, and getter guards read only its stamp.
    semanticDocument = document; semanticDocumentStamp = indexedStamp;
    semanticNodes.clear(); semanticNodes.putAll(nodes); semanticFields.clear(); semanticFields.putAll(fields);
    return document;
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
    JSONObject document = fieldDocument(manager, surface, editor.getId());
    JSONObject field = semanticFields.get(metadata.getId()), node = semanticNodes.get(metadata.getId());
    String encoded = metadata.semanticBinding, revision = metadata.descriptorRevision;
    if (field == null || node == null || !field.getString("ownerId").equals(owner) || !field.getString("descriptorId").equals(descriptor) ||
        !field.getString("descriptorRevision").equals(revision) || field.getInt("target") != editor.getId() ||
        !node.getString("fieldSemantics").equals(encoded) || !node.has("semanticPlan")) { metadata.resetSemanticAccessibilityFocus(); return; }
    JSONObject plan = node.getJSONObject("semanticPlan");
    WeakReference<CUIFormDocumentModule> moduleRef = new WeakReference<>(this);
    WeakReference<CUIFormMetadataView> metadataRef = new WeakReference<>(metadata);
    WeakReference<View> editorRef = new WeakReference<>(editor);
    WeakReference<FabricUIManager> managerRef = new WeakReference<>(manager);
    String documentId = document.getString("documentId"), documentRevision = document.getString("revision");
    CUIFieldSemantics.Current current = () -> {
      CUIFormDocumentModule module = moduleRef.get(); CUIFormMetadataView binding = metadataRef.get();
      View original = editorRef.get(); FabricUIManager fabric = managerRef.get();
      if (module == null || !module.valid.get() || !module.getReactApplicationContext().hasActiveReactInstance() ||
          binding == null || original == null || fabric == null || !binding.ownerId.equals(owner) || !binding.descriptorId.equals(descriptor) ||
          !binding.descriptorRevision.equals(revision) || !binding.semanticBinding.equals(encoded) ||
          binding.originalForMountSnapshot(mount) != original) return false;
      JSONObject latest = new JSONObject(module.readStamp(fabric, surface));
      return documentId.equals(latest.getString("documentId")) && documentRevision.equals(latest.getString("revision"));
    };
    boolean dateField = editor instanceof CUIDateSegment;
    if (dateField != plan.has("dateField")) { metadata.resetSemanticAccessibilityFocus(); return; }
    CUIFormMetadataView.SemanticContribution contribution = dateField ? CUIFieldSemantics.bindDateField(manager,
        CUIOwnedDateField.resolveAll(manager, metadata, metadata.ownedEditorBinding, editor.getId(), surface), plan, current) :
        CUIFieldSemantics.bind(manager, (ReactEditText)editor, plan, current);
    metadata.setSemanticContribution(contribution);
    if (dateField || contribution == null || !current.check() || !editor.isFocused() || plan.getBoolean("disabled")) { metadata.resetSemanticAccessibilityFocus(); return; }
    if (!plan.isNull("activeDescendant")) {
      JSONObject active = plan.getJSONObject("activeDescendant"), binding = new JSONObject(active.getString("binding"));
      View root = manager.resolveView(binding.getInt("target")), option = manager.resolveView(active.getInt("target"));
      if (root instanceof CUICollectionRoot && option != null && CUIInputWindow.identity(option).equals(CUIInputWindow.identity(editor)) &&
          ((CUICollectionRoot)root).acceptsPointerBinding(active.getString("binding"), option.getId()) && current.check())
        metadata.requestSemanticAccessibilityFocus(option, binding.getString("descriptorId"), false);
      else metadata.resetSemanticAccessibilityFocus();
    } else if (!plan.getBoolean("expanded")) metadata.requestSemanticAccessibilityFocus(editor, descriptor, true);
    else metadata.resetSemanticAccessibilityFocus();
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
            if (module == null || fabric == null) { binding.setSemanticContribution(null); return; }
            module.refreshField(fabric, binding, editorRef.get(), owner, descriptor);
          } catch (Exception retired) { binding.setSemanticContribution(null); }
        }, token);
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
        if (owned) { ((CUIFormMetadataView)view).clearSemanticRefresh(token); semanticHosts.remove((CUIFormMetadataView)view); }
        promise.resolve(owned);
      } catch (Exception failure) { promise.reject("E_CUI_FIELD_BINDING", failure); }
    });
  }

  private JSONObject fieldInputSnapshot(FabricUIManager manager, CUIFormMetadataView metadata) throws Exception {
    if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("field-input-module-retired");
    JSONObject binding = new JSONObject(metadata.fieldGroupBinding), mount = metadata.formMountSnapshot();
    if (mount == null) throw new IllegalStateException("field-input-original-mount-unavailable");
    JSONObject group = new JSONObject().put("outerTarget", positiveInteger(binding, "outerTarget"))
      .put("inputTarget", positiveInteger(binding, "inputTarget")).put("mount", mount);
    String encoded = readSnapshot(manager, mount.getInt("surfaceId"), metadata.originalTarget, group.toString());
    JSONObject document = new JSONObject(encoded);
    document.put("encodedDocument", encoded).put("fieldGroupSnapshot", CUIFieldGroupDocument.read(manager, document));
    if (!encoded.equals(readSnapshot(manager, mount.getInt("surfaceId"), metadata.originalTarget, group.toString())))
      throw new IllegalStateException("field-input-document-retired-during-read");
    return document;
  }
  @Override public void bindFieldInput(String encoded, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        JSONObject request = new JSONObject(encoded), mount = request.getJSONObject("mount");
        String nonce = request.getString("requestId");
        if (nonce.isEmpty() || !valid.get()) throw new IllegalArgumentException("field-input-bind-request-invalid");
        UIManager selected = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), positiveInteger(mount, "target"));
        if (!(selected instanceof FabricUIManager)) throw new IllegalStateException("field-input-Fabric-unavailable");
        FabricUIManager manager = (FabricUIManager)selected;
        View original = manager.resolveView(positiveInteger(mount, "target"));
        if (!(original instanceof CUIFormMetadataView) || !((CUIFormMetadataView)original).isFieldBinding())
          throw new IllegalStateException("field-input-original-metadata-retired");
        CUIFormMetadataView metadata = (CUIFormMetadataView)original;
        if (metadata.originalForMountSnapshot(mount) == null || !metadata.fieldGroupBinding.equals(request.getString("fieldGroupBinding")))
          throw new IllegalStateException("field-input-bind-original-retired");
        JSONObject declaration = new JSONObject(metadata.fieldGroupBinding);
        if (declaration.length() != 7 || declaration.getInt("version") != 1 || !metadata.ownerId.equals(declaration.getString("ownerId")) ||
            declaration.getString("bindingId").isEmpty() || declaration.getString("bindingRevision").isEmpty() ||
            CUIEditorKeyboardDefaultsModule.forLease(declaration.getString("moduleLease")) == null)
          throw new IllegalStateException("field-input-registration-invalid");
        for (String key : new String[]{"ownerId", "bindingId", "bindingRevision", "moduleLease"})
          if (!(declaration.get(key) instanceof String) || declaration.getString(key).isEmpty())
            throw new IllegalStateException("field-input-registration-invalid");
        View outer = manager.resolveView(positiveInteger(declaration, "outerTarget")), input = manager.resolveView(positiveInteger(declaration, "inputTarget"));
        if (!(outer instanceof com.facebook.react.views.view.ReactViewGroup) || !(input instanceof com.facebook.react.views.view.ReactViewGroup) ||
            outer == input || !CUIOwnedDateField.descendant(input, outer) || !CUIOwnedDateField.descendant(metadata, outer))
          throw new IllegalStateException("field-input-registration-roots-retired");
        java.util.List<CUIDateSegment> segments = CUIOwnedDateField.resolveAll(manager, metadata, metadata.ownedEditorBinding, metadata.originalTarget, mount.getInt("surfaceId"));
        if (segments == null || segments.isEmpty()) throw new IllegalStateException("field-input-registration-segments-retired");
        for (View segment : segments) if (!CUIOwnedDateField.descendant(segment, input)) throw new IllegalStateException("field-input-registration-input-retired");
        CUIFieldInputBinding previous = fieldInputs.get(metadata); if (previous != null) previous.retire();
        WeakReference<CUIFormDocumentModule> module = new WeakReference<>(this);
        WeakReference<CUIFormMetadataView> target = new WeakReference<>(metadata);
        WeakReference<FabricUIManager> fabric = new WeakReference<>(manager);
        String owner = semanticModuleId + ":input:" + nonce;
        JSONObject registration = new JSONObject().put("kind", "binding-status").put("requestId", nonce).put("ownerToken", owner)
          .put("metadataTarget", metadata.getId()).put("ownerId", metadata.ownerId).put("moduleLease", declaration.getString("moduleLease"))
          .put("bindingId", declaration.getString("bindingId")).put("bindingRevision", declaration.getString("bindingRevision"))
          .put("generation", 0).put("ready", false).put("error", "field-input-awaiting-current-document");
        CUIFieldInputBinding binding = new CUIFieldInputBinding(metadata, manager, registration, outer, input, () -> {
          CUIFormDocumentModule current = module.get(); CUIFormMetadataView view = target.get(); FabricUIManager active = fabric.get();
          if (current == null || view == null || active == null) throw new IllegalStateException("field-input-owner-retired");
          return current.fieldInputSnapshot(active, view);
        });
        fieldInputs.put(metadata, binding); fieldInputOwners.put(metadata, owner);
        WeakReference<CUIFieldInputBinding> refresh = new WeakReference<>(binding);
        metadata.setFieldInputRefresh(() -> { CUIFieldInputBinding current = refresh.get(); if (current != null) current.refresh(); }, owner);
        promise.resolve(binding.registrationReceipt().toString());
      } catch (Exception error) { promise.reject("E_CUI_FIELD_INPUT", error); }
    });
  }
  @Override public void unbindFieldInput(String encoded, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        JSONObject request = new JSONObject(encoded); int target = positiveInteger(request, "metadataTarget");
        String owner = request.getString("ownerToken"); UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), target);
        View view = manager == null ? null : manager.resolveView(target);
        boolean current = view instanceof CUIFormMetadataView && owner.equals(fieldInputOwners.get((CUIFormMetadataView)view));
        if (current) {
          CUIFormMetadataView metadata = (CUIFormMetadataView)view; fieldInputs.get(metadata).retire(); metadata.clearFieldInputRefresh(owner);
          fieldInputs.remove(metadata); fieldInputOwners.remove(metadata);
        }
        promise.resolve(current);
      } catch (Exception error) { promise.reject("E_CUI_FIELD_INPUT", error); }
    });
  }
  @Override public void getSnapshot(String encoded, Promise promise) { performRequest(encoded, promise, false); }
  @Override public void focusField(String encoded, Promise promise) { performRequest(encoded, promise, true); }
  private void performRequest(String encoded, Promise promise, boolean focus) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) throw new IllegalStateException("form-module-retired");
        JSONObject request = new JSONObject(encoded);
        int target = positiveInteger(request, "target"), surface = request.has("surfaceId") ? positiveInteger(request, "surfaceId") : 0;
        Object nonce = request.get("requestId");
        if (!(nonce instanceof String) || ((String)nonce).isEmpty()) throw new IllegalArgumentException("form-request-id-invalid");
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), target);
        if (!(manager instanceof FabricUIManager)) throw new IllegalStateException("form-Fabric-unavailable");
        String group = request.has("fieldGroup") ? request.getJSONObject("fieldGroup").toString() : "";
        if (!group.isEmpty() && (focus || request.has("actionAdmission") || request.has("inspect")))
          throw new IllegalArgumentException("field-group-read-only-request-required");
        String snapshot = readSnapshot((FabricUIManager)manager, surface, target, group);
        JSONObject response = new JSONObject(snapshot);
        if (!group.isEmpty()) {
          JSONObject groupSnapshot = CUIFieldGroupDocument.read(manager, response);
          groupSnapshot.put("selection", new JSONObject(nativeFieldGroupSelection(snapshot, groupSnapshot.toString())));
          response.put("fieldGroupSnapshot", groupSnapshot);
          if (!snapshot.equals(readSnapshot((FabricUIManager)manager, surface, target, group)))
            throw new IllegalStateException("field-group-document-retired-during-original-read");
        }
        if (focus) {
          String origin = request.getString("origin");
          if (!("native".equals(origin) && request.has("actionAdmission")) &&
              !("programmatic".equals(origin) && !request.has("actionAdmission"))) throw new IllegalArgumentException("form-focus-origin-invalid");
          if (request.has("inspect")) throw new IllegalArgumentException("form-focus-inspection-not-admitted");
        }
        if (request.has("actionAdmission")) {
          response.put("actionAdmission", CUIFormActionAdmission.admit(manager, response, request.getJSONObject("actionAdmission")));
          if (!snapshot.equals(readSnapshot((FabricUIManager)manager, surface, target))) throw new IllegalStateException("form-document-retired-during-action-admission");
        }
        if (request.optBoolean("inspect", false)) {
          Integer control = request.has("controlTarget") ? positiveInteger(request, "controlTarget") : null;
          response.put("inspection", CUIFormDocumentInspection.inspect(manager, response, control));
          if (!snapshot.equals(readSnapshot((FabricUIManager)manager, surface, target))) throw new IllegalStateException("form-document-retired-during-inspection");
        }
        if (focus) {
          response.put("focus", CUIFormFieldFocus.focus(manager, response, request,
            () -> {
              if (!valid.get() || !getReactApplicationContext().hasActiveReactInstance()) return false;
              if (request.has("actionAdmission")) CUIFormActionAdmission.admit(manager, response, request.getJSONObject("actionAdmission"));
              return snapshot.equals(readSnapshot((FabricUIManager)manager, surface, target));
            }));
        }
        if (!focus && (!valid.get() || !getReactApplicationContext().hasActiveReactInstance())) throw new IllegalStateException("form-module-retired");
        response.put("requestId", nonce);
        promise.resolve(response.toString());
      } catch (Exception failure) { promise.reject("E_CUI_FORM_DOCUMENT", failure); }
    });
  }

  @Override public synchronized void invalidate() {
    valid.set(false);
    UiThreadUtil.runOnUiThread(() -> {
      for (java.util.Map.Entry<CUIFormMetadataView, CUIFieldInputBinding> entry : fieldInputs.entrySet()) {
        entry.getValue().retire(); entry.getKey().clearFieldInputRefresh(fieldInputOwners.get(entry.getKey()));
      }
      fieldInputs.clear(); fieldInputOwners.clear();
      for (java.util.Map.Entry<CUIFormMetadataView, String> entry : semanticHosts.entrySet()) entry.getKey().clearSemanticRefresh(entry.getValue());
      semanticHosts.clear();
      semanticDocument = null; semanticDocumentStamp = ""; semanticNodes.clear(); semanticFields.clear();
    });
    if (session != 0) { nativeRetireFormSession(session); session = 0; }
    super.invalidate();
  }
}
