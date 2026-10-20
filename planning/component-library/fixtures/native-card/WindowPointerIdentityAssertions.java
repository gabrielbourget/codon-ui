package com.codonui.input;

/** Executes the production native identity mapper on the JVM, without Android event/default proof. */
public final class WindowPointerIdentityAssertions {
  private static int assertions;
  private static void require(boolean value) {
    assertions++;
    if (!value) throw new AssertionError("Window pointer identity assertion " + assertions);
  }
  public static void main(String[] arguments) {
    CUIWindowPointers.PointerIdentities pointers = new CUIWindowPointers.PointerIdentities();
    int first = pointers.start(10, 1, 0, 100);
    int secondDevice = pointers.start(20, 1, 0, 100);
    int secondTouch = pointers.start(10, 1, 1, 100);
    int pen = pointers.start(10, 2, 0, 100);
    require(first != secondDevice && first != secondTouch && first != pen);
    require(secondDevice != secondTouch && secondDevice != pen && secondTouch != pen);
    require(pointers.start(10, 1, 0, 100) == first);
    require(pointers.get(10, 1, 0, 100) == first);
    require(pointers.get(20, 1, 0, 100) == secondDevice);
    require(pointers.get(10, 1, 0, 101) == null);
    require(pointers.get(30, 1, 0, 100) == null);
    require(pointers.isPrimary(1, first));
    require(!pointers.isPrimary(1, secondDevice));
    require(!pointers.isPrimary(1, secondTouch));
    require(pointers.isPrimary(2, pen));
    pointers.end(20, 1, 0, 100);
    require(pointers.get(20, 1, 0, 100) == null);
    require(pointers.get(10, 1, 0, 100) == first);
    pointers.end(10, 1, 0, 100);
    require(!pointers.isPrimary(1, secondTouch));
    pointers.end(10, 1, 1, 100);
    int replacement = pointers.start(10, 1, 0, 200);
    require(replacement != first);
    require(pointers.isPrimary(1, replacement));
    pointers.end(10, 1, 0, 100);
    require(pointers.get(10, 1, 0, 200) == replacement);
    pointers.clear();
    require(pointers.get(10, 1, 0, 200) == null);
    require(pointers.get(10, 2, 0, 100) == null);
    int afterCancellation = pointers.start(10, 1, 0, 200);
    require(afterCancellation != replacement);
    require(pointers.isPrimary(1, afterCancellation));
    System.out.println("Production window pointer identity assertions passed: " + assertions);
  }
}
