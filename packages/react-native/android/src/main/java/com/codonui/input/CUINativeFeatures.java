package com.codonui.input;

import com.facebook.react.bridge.ReactApplicationContext;
import java.util.concurrent.atomic.AtomicBoolean;

final class CUINativeFeatures {
  private CUINativeFeatures() {}
  static CUINativeTableFeature createTable(ReactApplicationContext context, AtomicBoolean valid, Object lock) {
    return new CUITableNativeSession(context, valid, lock);
  }
}
