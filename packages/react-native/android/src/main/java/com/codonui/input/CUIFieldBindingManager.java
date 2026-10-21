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
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new CUICollectionNode(context); }
  @Override @ReactProp(name = "ownerId") public void setOwnerId(ReactViewGroup view, String value) {}
  @Override @ReactProp(name = "descriptorId") public void setDescriptorId(ReactViewGroup view, String value) {}
  @Override @ReactProp(name = "descriptorRevision") public void setDescriptorRevision(ReactViewGroup view, String value) {}
  @Override @ReactProp(name = "editorTarget") public void setEditorTarget(ReactViewGroup view, int value) {}
  @Override @ReactProp(name = "hasFormAssociation") public void setHasFormAssociation(ReactViewGroup view, boolean value) {}
  @Override @ReactProp(name = "formId") public void setFormId(ReactViewGroup view, String value) {}
  @Override protected void onAfterUpdateTransaction(ReactViewGroup view) { super.onAfterUpdateTransaction(view); ((CUICollectionNode)view).enforceMetadata(); }
}
