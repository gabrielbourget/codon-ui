package com.codonui.input;

import com.facebook.react.BaseReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import java.util.HashMap;
import java.util.Arrays;
import java.util.List;

public final class CodonInputPackage extends BaseReactPackage {
  @Override
  public NativeModule getModule(String name, ReactApplicationContext context) {
    if (CUIEditorKeyboardDefaultsModule.NAME.equals(name)) return new CUIEditorKeyboardDefaultsModule(context);
    if (CUIFormDocumentModule.NAME.equals(name)) return new CUIFormDocumentModule(context);
    return CUIMotionSnapshotModule.NAME.equals(name) ? new CUIMotionSnapshotModule(context) : null;
  }

  @Override
  public ReactModuleInfoProvider getReactModuleInfoProvider() {
    return () -> {
      HashMap<String, ReactModuleInfo> modules = new HashMap<>();
      modules.put(CUIMotionSnapshotModule.NAME, new ReactModuleInfo(CUIMotionSnapshotModule.NAME,
        CUIMotionSnapshotModule.class.getName(), false, false, false, true));
      modules.put(CUIFormDocumentModule.NAME, new ReactModuleInfo(CUIFormDocumentModule.NAME,
        CUIFormDocumentModule.class.getName(), false, false, false, true));
      modules.put(CUIEditorKeyboardDefaultsModule.NAME, new ReactModuleInfo(CUIEditorKeyboardDefaultsModule.NAME,
        CUIEditorKeyboardDefaultsModule.class.getName(), false, false, false, true));
      return modules;
    };
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Arrays.asList(new CUIFocusViewManager(), new CUIKeyboardScopeManager(), new CUICollectionRootManager(), new CUICollectionNodeManager(), new CUIFormRootManager(), new CUIFieldBindingManager(), new CUIDateSegmentManager());
  }
}
