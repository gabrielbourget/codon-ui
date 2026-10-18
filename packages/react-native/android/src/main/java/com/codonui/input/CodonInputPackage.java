package com.codonui.input;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Collections;
import java.util.Arrays;
import java.util.List;

public final class CodonInputPackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    return Collections.emptyList();
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Arrays.asList(new CUIFocusViewManager(), new CUIKeyboardScopeManager());
  }
}
