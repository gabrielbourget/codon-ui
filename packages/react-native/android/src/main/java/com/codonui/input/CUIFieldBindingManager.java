package com.codonui.input;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.ViewManagerPropertyUpdater;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.CUIFieldBindingManagerDelegate;
import com.facebook.react.viewmanagers.CUIFieldBindingManagerInterface;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@ReactModule(name = CUIFieldBindingManager.NAME)
public final class CUIFieldBindingManager extends ReactViewManager implements CUIFieldBindingManagerInterface<ReactViewGroup> {
  static final String NAME = "CUIFieldBinding";
  private final ViewManagerDelegate<ReactViewGroup> inherited = new ViewManagerPropertyUpdater.GenericViewManagerDelegate<>(this);
  private final CUIFieldBindingManagerDelegate<ReactViewGroup, CUIFieldBindingManager> delegate = new CUIFieldBindingManagerDelegate<>(this) {
    @Override public void setProperty(ReactViewGroup view, String name, Object value) {
      if ("ownerId".equals(name) || "descriptorId".equals(name) || "descriptorRevision".equals(name) || "editorTarget".equals(name) || "hasFormAssociation".equals(name) || "formId".equals(name)) super.setProperty(view, name, value);
      else inherited.setProperty(view, name, value);
    }
  };
  @Override public String getName() { return NAME; }
  @Override protected ViewManagerDelegate<ReactViewGroup> getDelegate() { return delegate; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new CUIFormMetadataView(context, true); }
  @Override @ReactProp(name = "ownerId") public void setOwnerId(ReactViewGroup view, String value) { ((CUIFormMetadataView)view).ownerId = value == null ? "" : value; }
  @Override @ReactProp(name = "descriptorId") public void setDescriptorId(ReactViewGroup view, String value) { ((CUIFormMetadataView)view).descriptorId = value == null ? "" : value; }
  @Override @ReactProp(name = "descriptorRevision") public void setDescriptorRevision(ReactViewGroup view, String value) { ((CUIFormMetadataView)view).descriptorRevision = value == null ? "" : value; }
  @Override @ReactProp(name = "editorTarget") public void setEditorTarget(ReactViewGroup view, int value) { ((CUIFormMetadataView)view).originalTarget = value; }
  @Override @ReactProp(name = "hasFormAssociation") public void setHasFormAssociation(ReactViewGroup view, boolean value) {}
  @Override @ReactProp(name = "formId") public void setFormId(ReactViewGroup view, String value) {}
  @Override protected void onAfterUpdateTransaction(ReactViewGroup view) { super.onAfterUpdateTransaction(view); ((CUICollectionNode)view).enforceMetadata(); }
  @Override public void onDropViewInstance(ReactViewGroup view) { ((CUIFormMetadataView)view).retire(); super.onDropViewInstance(view); }
  @Override public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    Map<String, Object> events = new HashMap<>(); Map<String, Object> inherited = super.getExportedCustomDirectEventTypeConstants();
    if (inherited != null) events.putAll(inherited);
    events.put("topNativeFormCommit", Collections.singletonMap("registrationName", "onNativeFormCommit")); return events;
  }

}
