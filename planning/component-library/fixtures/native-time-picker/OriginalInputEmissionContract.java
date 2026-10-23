package com.codonui.input;

public final class OriginalInputEmissionContract {
  private static int assertions;
  private static void check(boolean condition) {
    if (!condition) throw new AssertionError("original input emission contract failed");
    assertions++;
  }
  public static void main(String[] arguments) {
    int[] calls = {0};
    CUIOriginalInputEmission emission = new CUIOriginalInputEmission(() -> calls[0]++);
    check(!emission.wasInvoked());
    emission.rethrowOriginalFailure();
    emission.run();
    check(emission.wasInvoked() && calls[0] == 1);
    try { emission.run(); throw new AssertionError("duplicate emitter returned"); }
    catch (IllegalStateException expected) { check(calls[0] == 1); }
    RuntimeException original = new IllegalArgumentException("original SDK failure");
    CUIOriginalInputEmission failed = new CUIOriginalInputEmission(() -> { calls[0]++; throw original; });
    try { failed.run(); throw new AssertionError("throwing emitter returned"); }
    catch (RuntimeException actual) { check(actual == original); }
    check(failed.wasInvoked() && calls[0] == 2);
    try { failed.rethrowOriginalFailure(); throw new AssertionError("original failure lost"); }
    catch (RuntimeException actual) { check(actual == original); }
    try { failed.run(); throw new AssertionError("failed emitter repeated"); }
    catch (IllegalStateException expected) { check(calls[0] == 2); }
    try { failed.rethrowOriginalFailure(); throw new AssertionError("original failure replaced"); }
    catch (RuntimeException actual) { check(actual == original); }
    Error fatal = new AssertionError("original SDK error");
    CUIOriginalInputEmission errored = new CUIOriginalInputEmission(() -> { throw fatal; });
    try { errored.run(); throw new AssertionError("original error lost"); }
    catch (Error actual) { check(actual == fatal); }
    try { errored.rethrowOriginalFailure(); throw new AssertionError("original error replaced"); }
    catch (Error actual) { check(actual == fatal); }
    System.out.println(assertions + " actual Java original-input emission assertions passed; no SDK input verdict");
  }
}
