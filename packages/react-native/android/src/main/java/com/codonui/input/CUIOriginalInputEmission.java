package com.codonui.input;

// A protocol failure may fall back only before this original emitter ran.
final class CUIOriginalInputEmission implements Runnable {
  private final Runnable original;
  private boolean invoked;
  private Throwable failure;
  CUIOriginalInputEmission(Runnable original) { this.original = original; }
  boolean wasInvoked() { return invoked; }
  @Override public void run() {
    if (invoked) throw new IllegalStateException("field-input-original-emitter-already-invoked");
    invoked = true;
    try { original.run(); }
    catch (RuntimeException | Error error) { failure = error; throw error; }
  }
  void rethrowOriginalFailure() {
    if (failure instanceof RuntimeException) throw (RuntimeException)failure;
    if (failure instanceof Error) throw (Error)failure;
  }
}
