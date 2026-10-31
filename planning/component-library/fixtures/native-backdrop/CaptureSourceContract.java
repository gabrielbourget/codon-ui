package com.codonui.input;

import android.view.View;
import java.util.Arrays;

/** Host contract controls use minimal View/thread identities, not an Android renderer or pixel oracle. */
public final class CaptureSourceContract {
  private static int assertions;
  private static void require(boolean value) {
    assertions++;
    if (!value) throw new AssertionError("Capture source assertion " + assertions);
  }
  private static void rejects(Runnable work) {
    boolean rejected = false;
    try { work.run(); } catch (IllegalArgumentException | IllegalStateException | ArithmeticException expected) { rejected = true; }
    require(rejected);
  }
  private static CUIBackdropCaptureSource.Request request(View target, View receiver, float[] quad) {
    return new CUIBackdropCaptureSource.Request(target, receiver, "source:2", "receiver:3", "owner", "frame:4", 5, quad, quad);
  }
  public static void main(String[] arguments) {
    View target = new View(10, 1, 1), receiver = new View(20, 2, 3), otherTarget = new View(10, 1, 1);
    require(target.equals(otherTarget)); // The host deliberately gives distinct Views equal values.
    CUIBackdropCaptureSource source = (request, completion) -> () -> {};
    CUIBackdropCaptureRegistration first = CUIBackdropCaptureRegistry.register(target, source);
    CUIBackdropCaptureRegistration other = CUIBackdropCaptureRegistry.register(otherTarget, source);
    require(first.isActive() && other.isActive());
    require(first.getTarget() == target && other.getTarget() == otherTarget);
    require(CUIBackdropCaptureRegistry.find(target) == first);
    require(CUIBackdropCaptureRegistry.find(otherTarget) == other);
    require(first.source() == source);
    int[] retired = {0};
    first.onRetire(() -> retired[0]++);
    CUIBackdropCaptureRegistration replacement = CUIBackdropCaptureRegistry.register(target, source);
    require(retired[0] == 1 && !first.isActive() && replacement.isActive() && other.isActive());
    rejects(first::source);
    rejects(() -> first.onRetire(() -> {}));
    first.close(); require(retired[0] == 1 && replacement.isActive());
    Runnable unwatch = replacement.onRetire(() -> retired[0] += 100);
    unwatch.run(); unwatch.run();
    replacement.onRetire(() -> retired[0]++);
    replacement.onRetire(() -> retired[0]++);
    replacement.close(); replacement.close();
    require(retired[0] == 3 && CUIBackdropCaptureRegistry.find(target) == null && other.isActive());
    other.close(); require(CUIBackdropCaptureRegistry.find(otherTarget) == null);
    rejects(() -> CUIBackdropCaptureRegistry.register(null, source));
    rejects(() -> CUIBackdropCaptureRegistry.register(target, null));

    float[] quad = {0, 0, 1, 0, 1, 1, 0, 1};
    CUIBackdropCaptureSource.Request captured = request(target, receiver, quad);
    require(captured.getTarget() == target && captured.getReceiver() == receiver);
    require(captured.targetWindow == target.getWindowToken() && captured.receiverWindow == receiver.getWindowToken());
    require(captured.width == 1 && captured.height == 1 && captured.receiverWidth == 2 && captured.receiverHeight == 3);
    require(captured.targetTag == 10 && captured.receiverTag == 20 && captured.generation == 5);
    require(captured.ownerId.equals("owner") && captured.frameId.equals("frame:4"));
    require(captured.targetEpoch.equals("source:2") && captured.receiverEpoch.equals("receiver:3"));
    quad[0] = 999; require(captured.getTargetScreenQuad()[0] == 0 && captured.getReceiverScreenQuad()[0] == 0);
    float[] exposed = captured.getTargetScreenQuad(); exposed[0] = 222;
    require(captured.getTargetScreenQuad()[0] == 0);
    byte[] pixels = {64, 32, 16, (byte)128};
    CUIBackdropCaptureSource.Frame frame = new CUIBackdropCaptureSource.Frame(captured, 1, 1, pixels, true, true, false);
    pixels[0] = 0; require(frame.copyRGBA()[0] == 64);
    byte[] output = frame.copyRGBA(); output[1] = 0;
    require(frame.copyRGBA()[1] == 32);
    require(Arrays.equals(frame.validatedRGBA(captured), new byte[]{64, 32, 16, (byte)128}));
    rejects(() -> frame.validatedRGBA(request(target, receiver, quad)));
    rejects(() -> new CUIBackdropCaptureSource.Frame(captured, 1, 1, new byte[3], true, true, false));
    rejects(() -> new CUIBackdropCaptureSource.Frame(captured, -1, 1, new byte[4], true, true, false));
    rejects(() -> new CUIBackdropCaptureSource.Frame(captured, Integer.MAX_VALUE, 2, new byte[4], true, true, false));
    rejects(() -> new CUIBackdropCaptureSource.Frame(captured, 1, 1, pixels, false, true, false).validatedRGBA(captured));
    rejects(() -> new CUIBackdropCaptureSource.Frame(captured, 1, 1, pixels, true, false, false).validatedRGBA(captured));
    rejects(() -> new CUIBackdropCaptureSource.Frame(captured, 1, 1, pixels, true, true, true).validatedRGBA(captured));
    rejects(() -> new CUIBackdropCaptureSource.Frame(captured, 2, 1, new byte[8], true, true, false).validatedRGBA(captured));
    rejects(() -> new CUIBackdropCaptureSource.Frame(captured, 1, 1, new byte[]{2, 0, 0, 1}, true, true, false).validatedRGBA(captured));
    rejects(() -> new CUIBackdropCaptureSource.Frame(captured, 1, 1, new byte[]{0, 2, 0, 1}, true, true, false).validatedRGBA(captured));
    rejects(() -> new CUIBackdropCaptureSource.Frame(captured, 1, 1, new byte[]{0, 0, 2, 1}, true, true, false).validatedRGBA(captured));
    require(!captured.isCancelled()); captured.cancel(); captured.cancel(); require(captured.isCancelled());
    rejects(() -> frame.validatedRGBA(captured));
    System.out.println("Production capture-source host contract controls passed: " + assertions);
  }
}
