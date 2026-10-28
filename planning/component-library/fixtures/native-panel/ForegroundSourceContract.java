package com.codonui.input;

import android.view.View;
import android.graphics.Rect;
import java.util.Arrays;

/** Actual production native API/registry with minimal host identities; no Android pixel execution. */
public final class ForegroundSourceContract {
  private static int assertions;
  private static void check(boolean value) { assertions++; if (!value) throw new AssertionError("Foreground contract " + assertions); }
  private static void rejects(Runnable work) {
    boolean rejected=false;
    try { work.run(); } catch (IllegalArgumentException | IllegalStateException | ArithmeticException expected) { rejected=true; }
    check(rejected);
  }
  private static CUIForegroundCompositionSource.Request request(View root, View owner, float[] quad) {
    return new CUIForegroundCompositionSource.Request(root,owner,owner,owner,"epoch:4","epoch:4","owner",5,6,new Rect(-2,-3,-1,-2),2,quad,quad);
  }
  public static void main(String[] arguments) {
    View root=new View(1), equalRoot=new View(1), owner=new View(2), child=new View(3);
    owner.setParent(root); child.setParent(owner);
    check(root.equals(equalRoot) && root != equalRoot);
    CUIForegroundCompositionSource provider = request -> null;
    CUIForegroundCompositionRegistry.Registration first=CUIForegroundCompositionRegistry.register(root,provider);
    CUIForegroundCompositionRegistry.Registration other=CUIForegroundCompositionRegistry.register(equalRoot,provider);
    check(first.isActive() && other.isActive());
    check(CUIForegroundCompositionRegistry.find(owner)==first && CUIForegroundCompositionRegistry.find(child)==first);
    check(CUIForegroundCompositionRegistry.find(equalRoot)==other);
    int[] retired={0}; first.onRetire(() -> retired[0]++);
    CUIForegroundCompositionRegistry.Registration replacement=CUIForegroundCompositionRegistry.register(root,provider);
    check(!first.isActive() && replacement.isActive() && other.isActive() && retired[0]==1);
    first.close(); check(retired[0]==1 && replacement.isActive());
    rejects(first::source); rejects(() -> first.onRetire(() -> {}));
    Runnable unwatch=replacement.onRetire(() -> retired[0]+=100); unwatch.run(); unwatch.run();
    replacement.onRetire(() -> retired[0]++); replacement.close(); replacement.close();
    check(retired[0]==2 && CUIForegroundCompositionRegistry.find(child)==null);
    CUIForegroundCompositionRegistry.Registration local=CUIForegroundCompositionRegistry.register(owner,provider);
    check(CUIForegroundCompositionRegistry.find(child)==local && local.getRoot()==owner);
    owner.setParent(equalRoot); check(CUIForegroundCompositionRegistry.find(child)==local);
    local.close(); check(CUIForegroundCompositionRegistry.find(child)==other);
    other.close(); check(CUIForegroundCompositionRegistry.find(child)==null);
    rejects(() -> CUIForegroundCompositionRegistry.register(null,provider));
    rejects(() -> CUIForegroundCompositionRegistry.register(root,null));
    float[] quad={0,0,1,0,1,1,0,1};
    CUIForegroundCompositionSource.Request captured=request(root,owner,quad);
    check(captured.getRegistrationRoot()==root && captured.getOwner()==owner && captured.getSource()==owner && captured.getOutput()==owner);
    check(captured.sourceWindow==owner.getWindowToken() && captured.outputWindow==owner.getWindowToken());
    check(captured.left==-2 && captured.top==-3 && captured.width==1 && captured.height==1 && captured.scale==2);
    check(captured.generation==5 && captured.frameId.equals(captured.ownerId+"-5-6"));
    quad[0]=999; check(captured.getSourceScreenQuad()[0]==0 && captured.getOutputScreenQuad()[0]==0);
    float[] exposed=captured.getSourceScreenQuad(); exposed[0]=222; check(captured.getSourceScreenQuad()[0]==0);
    byte[] pixels={64,32,16,(byte)128};
    CUIForegroundCompositionSource.Frame frame=new CUIForegroundCompositionSource.Frame(captured,1,1,pixels,true,true,false);
    pixels[0]=0; check(frame.copyRGBA()[0]==64);
    byte[] copy=frame.copyRGBA(); copy[1]=0; check(frame.copyRGBA()[1]==32);
    check(Arrays.equals(frame.validatedRGBA(captured),new byte[]{64,32,16,(byte)128}));
    rejects(() -> frame.validatedRGBA(request(root,owner,quad)));
    rejects(() -> new CUIForegroundCompositionSource.Frame(captured,1,1,new byte[3],true,true,false));
    rejects(() -> new CUIForegroundCompositionSource.Frame(captured,-1,1,new byte[4],true,true,false));
    for (int invalid=0;invalid<3;invalid++) {
      CUIForegroundCompositionSource.Frame rejected=new CUIForegroundCompositionSource.Frame(captured,1,1,new byte[4],invalid!=0,invalid!=1,invalid==2);
      rejects(() -> rejected.validatedRGBA(captured));
    }
    CUIForegroundCompositionSource.Frame invalid=new CUIForegroundCompositionSource.Frame(captured,1,1,new byte[]{(byte)255,0,0,0},true,true,false);
    rejects(() -> invalid.validatedRGBA(captured));
    captured.cancel(); captured.cancel(); check(captured.isCancelled()); rejects(() -> frame.validatedRGBA(captured));
    System.out.println(assertions+" actual foreground API/registry/immutable-frame host assertions passed");
  }
}
