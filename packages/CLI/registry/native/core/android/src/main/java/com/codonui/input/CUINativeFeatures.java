package com.codonui.input;

import com.facebook.react.bridge.ReactApplicationContext;
import java.util.concurrent.atomic.AtomicBoolean;

final class CUINativeFeatures {
  private CUINativeFeatures() {}
  static CUINativeTableFeature createTable(ReactApplicationContext context, AtomicBoolean valid, Object lock) {
    return new CUINativeTableFeature() {
      @Override public String request(String encoded) {
        throw new IllegalStateException("Table sticky: feature not installed");
      }
      @Override public void invalidate() {}
    };
  }
}
