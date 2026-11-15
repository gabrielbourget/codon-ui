'Focused JVM source controls for the owned Android window-pointer transport.\n\nRun against a checkout with an existing JDK17+, without an emulator or native build:\n  python3 planning/component-library/fixtures/native-card/WindowPointerDispatchSourceProbe.py     --source . --out /tmp/codon-window-pointer-controls --java-home "$JAVA_HOME"\n\nThe probe executes the whole producer, exact callback/forwarder methods and the\nexisting identity assertions with Android/RN test doubles. It does not certify\ninstalled native hit testing, default event dispatch or component readiness.\n'

from pathlib import Path

import argparse, json, subprocess, hashlib, os, time

P = argparse.ArgumentParser(description=__doc__)

P.add_argument('--source', required=True, help='Codon checkout containing the Java sources')

P.add_argument('--out', required=True, help='Directory for generated control sources, classes and results')

P.add_argument('--java-home', default=os.environ.get('JAVA_HOME'), help='Existing JDK home; defaults to JAVA_HOME')

a = P.parse_args()

if not a.java_home:
    P.error('Provide --java-home or set JAVA_HOME to an existing JDK17+ installation')

jdk = Path(a.java_home).expanduser().resolve() / 'bin'

for tool in ['javac', 'java']:
    if not (jdk / tool).is_file():
        P.error('Existing JDK tool not found: ' + str(jdk / tool))

src = Path(a.source).resolve()

out = Path(a.out).resolve()

out.mkdir(parents=True, exist_ok=True)

base = src / 'packages/react-native/android/src/main/java/com/codonui/input'

def method(text, signature):
    start = text.index(signature)
    brace = text.index('{', start)
    depth = 1
    i = brace + 1
    while depth:
        depth += (text[i] == '{') - (text[i] == '}')
        i += 1
    return text[start:i]

def put(path, text):
    p = out / 'src' / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)

producer = (base / 'CUIWindowPointers.java').read_text()

put('com/codonui/input/CUIWindowPointers.java', producer)

callback = (base / 'CUIWindowPointerCallback.java').read_text()

prefix = callback[callback.index('/** Private'):callback.index('  @Override public void onWindowFocusChanged')]

prefix = prefix.replace('implements Window.Callback, AutoCloseable', 'implements Window.Callback, AutoCloseable')

put('com/codonui/input/CUIWindowPointerCallback.java', 'package com.codonui.input; import android.view.*; import android.util.Log; import java.lang.ref.WeakReference;' + prefix + method(callback, '@Override public void close()') + '}')

put('android/graphics/Matrix.java', 'package android.graphics; public class Matrix { public float sx=1,sy=1,tx,ty; public void mapPoints(float[] p){ p[0]=p[0]*sx+tx; p[1]=p[1]*sy+ty; } }')

put('android/util/Log.java', 'package android.util; public class Log { public static int e(String a,String b,Throwable c){ return 0; } }')

put('android/util/DisplayMetrics.java', 'package android.util; public class DisplayMetrics { public float density=2; }')

put('android/content/res/Resources.java', 'package android.content.res; public class Resources { final android.util.DisplayMetrics d=new android.util.DisplayMetrics(); public android.util.DisplayMetrics getDisplayMetrics(){ return d; } }')

put('android/os/SystemClock.java', 'package android.os; public class SystemClock { public static long uptimeMillis(){ return 900; } }')

put('android/view/KeyEvent.java', 'package android.view; public class KeyEvent { public static final int META_SHIFT_ON=1,META_CTRL_ON=2,META_ALT_ON=4,META_META_ON=8; }')

put('android/view/ViewTreeObserver.java', 'package android.view; public class ViewTreeObserver { public interface OnPreDrawListener{ boolean onPreDraw(); } public boolean isAlive(){ return true; } public void addOnPreDrawListener(OnPreDrawListener v){ } public void removeOnPreDrawListener(OnPreDrawListener v){ } }')

put('android/view/View.java', 'package android.view; public class View { public static final int NO_ID=-1; public int id,left,top,width=800,height=1600; public ViewGroup parent; public boolean attached=true,focused=true; public Object context; public final android.graphics.Matrix matrix=new android.graphics.Matrix(); final android.content.res.Resources resources=new android.content.res.Resources(); final ViewTreeObserver observer=new ViewTreeObserver(); public View(){ } public View(int i){ id=i; } public int getId(){ return id; } public ViewGroup getParent(){ return parent; } public View getRootView(){ return parent==null?this:parent.getRootView(); } public boolean isAttachedToWindow(){ return attached; } public boolean hasWindowFocus(){ return focused; } public Object getWindowToken(){ return getRootView(); } public android.content.res.Resources getResources(){ return resources; } public Object getContext(){ return context; } public ViewTreeObserver getViewTreeObserver(){ return observer; } public android.graphics.Matrix getMatrix(){ return matrix; } public int getLeft(){ return left; } public int getTop(){ return top; } public int getWidth(){ return width; } public int getHeight(){ return height; } public void getLocationOnScreen(int[] p){ p[0]=left; p[1]=top; } public View findViewById(int n){ return id==n?this:null; } }')

put('android/view/ViewGroup.java', 'package android.view; import java.util.*; public class ViewGroup extends View { public int scrollX,scrollY; public final List<View> children=new ArrayList<>(); public ViewGroup(){ } public ViewGroup(int i){ super(i); } public void add(View v){ children.add(v); v.parent=this; } public int getChildCount(){ return children.size(); } public View getChildAt(int n){ return children.get(n); } public int getScrollX(){ return scrollX; } public int getScrollY(){ return scrollY; } @Override public View findViewById(int n){ View v=super.findViewById(n); if(v!=null)return v; for(View c:children){ v=c.findViewById(n); if(v!=null)return v; } return null; } }')

put('android/view/MotionEvent.java', 'package android.view; public class MotionEvent { public static final int ACTION_DOWN=0,ACTION_UP=1,ACTION_MOVE=2,ACTION_CANCEL=3,ACTION_POINTER_DOWN=5,ACTION_POINTER_UP=6,TOOL_TYPE_FINGER=1,TOOL_TYPE_MOUSE=2,TOOL_TYPE_STYLUS=3,TOOL_TYPE_ERASER=4,BUTTON_PRIMARY=1,BUTTON_SECONDARY=2,BUTTON_TERTIARY=4,BUTTON_BACK=8,BUTTON_FORWARD=16,BUTTON_STYLUS_PRIMARY=32,BUTTON_STYLUS_SECONDARY=64; public int action,index,device=10,tool=1,buttons,changed,modifiers; public long down=100,time=110; public int[] ids={ 0 } ; public float[] xs={ 205 } ,ys={ 307 } ; public boolean recycled; public static int obtains,recycles; public static MotionEvent obtain(MotionEvent e){ obtains++; MotionEvent n=new MotionEvent(); n.action=e.action; n.index=e.index; n.device=e.device; n.tool=e.tool; n.buttons=e.buttons; n.changed=e.changed; n.modifiers=e.modifiers; n.down=e.down; n.time=e.time; n.ids=e.ids.clone(); n.xs=e.xs.clone(); n.ys=e.ys.clone(); return n; } public void recycle(){ if(recycled)throw new AssertionError("double recycle"); recycled=true; recycles++; } public int getActionMasked(){ return action; } public int getActionIndex(){ return index; } public int getPointerCount(){ return ids.length; } public int getPointerId(int n){ return ids[n]; } public int getDeviceId(){ return device; } public int getToolType(int n){ return tool; } public long getDownTime(){ return down; } public long getEventTime(){ return time; } public float getX(int n){ return xs[n]; } public float getY(int n){ return ys[n]; } public int getButtonState(){ return buttons; } public int getActionButton(){ return changed; } public int getMetaState(){ return modifiers; } }')

put('android/view/Window.java', 'package android.view; public class Window { public interface Callback { boolean dispatchTouchEvent(MotionEvent e); boolean dispatchGenericMotionEvent(MotionEvent e); } public View decor; public Callback callback; public Window(View d,Callback c){ decor=d; callback=c; } public View getDecorView(){ return decor; } public Callback getCallback(){ return callback; } public void setCallback(Callback c){ callback=c; } }')

put('android/app/Activity.java', 'package android.app; public class Activity { public android.view.Window window; public android.view.Window getWindow(){ return window; } }')

put('android/app/Dialog.java', 'package android.app; public class Dialog { public android.view.Window getWindow(){ return null; } }')

put('com/facebook/react/uimanager/ThemedReactContext.java', 'package com.facebook.react.uimanager; public class ThemedReactContext { public android.app.Activity activity; public android.app.Activity getCurrentActivity(){ return activity; } }')

put('com/facebook/react/uimanager/RootView.java', 'package com.facebook.react.uimanager; public interface RootView { }')

put('com/facebook/react/views/modal/ReactModalHostView.java', 'package com.facebook.react.views.modal; public class ReactModalHostView extends android.view.ViewGroup { public android.app.Dialog getDialog(){ return null; } }')

put('com/facebook/react/uimanager/TouchTargetHelper.java', 'package com.facebook.react.uimanager; import java.util.*; import android.view.*; public class TouchTargetHelper { public static int calls; public static ViewGroup lastRoot; public static float lastX,lastY; public static boolean fail; public static List<ViewTarget> findTargetPathAndCoordinatesForTouch(float x,float y,ViewGroup root,float[] out){ calls++; lastRoot=root; lastX=x; lastY=y; if(fail)throw new IllegalStateException("hit error"); if(root instanceof RootView)return Arrays.asList(new ViewTarget(3606),new ViewTarget(3608),new ViewTarget(4000),new ViewTarget(root.id)); return Arrays.asList(new ViewTarget(3208),new ViewTarget(root.id)); } public static class ViewTarget{ int id; public ViewTarget(int n){ id=n; } public int getViewId(){ return id; } } }')

put('com/facebook/react/bridge/WritableMap.java', 'package com.facebook.react.bridge; import java.util.*; public class WritableMap { public final Map<String,Object> values=new LinkedHashMap<>(); public boolean consumed; void put(String k,Object v){ if(consumed)throw new AssertionError("mutating consumed map"); values.put(k,v); } public void putInt(String k,int v){ put(k,v); } public void putDouble(String k,double v){ put(k,v); } public void putString(String k,String v){ put(k,v); } public void putBoolean(String k,boolean v){ put(k,v); } public void putArray(String k,WritableArray v){ put(k,v); } public int getInt(String k){ return ((Number)values.get(k)).intValue(); } }')

put('com/facebook/react/bridge/WritableArray.java', 'package com.facebook.react.bridge; import java.util.*; public class WritableArray { public final List<WritableMap> values=new ArrayList<>(); public void pushMap(WritableMap m){ if(m.consumed)throw new AssertionError("second map transfer"); m.consumed=true; values.add(m); } }')

put('com/facebook/react/bridge/Arguments.java', 'package com.facebook.react.bridge; public class Arguments { public static int maps,arrays; public static WritableMap createMap(){ maps++; return new WritableMap(); } public static WritableArray createArray(){ arrays++; return new WritableArray(); } }')

window = (base / 'CUIInputWindow.java').read_text()

pointer = method(window, '  static void pointerEvent(View view, MotionEvent event)')

put('com/codonui/input/CUIInputWindow.java', 'package com.codonui.input; import android.view.*; import java.util.*; class CUIInputWindow { static final List<CUIKeyboardScope> registered=new ArrayList<>(); static final Map<View,State> states=new WeakHashMap<>(); static class State{ long inputRevision,sequence; final Set<Integer> pointers=new HashSet<>(); } static State state(View v){ return states.computeIfAbsent(v.getRootView(),k->new State()); } static String identity(View v){ return "window:"+v.getRootView().id; } static long nextWindowPointer(View v){ return ++state(v).sequence; } static List<CUIKeyboardScope> scopes(View v){ List<CUIKeyboardScope> r=new ArrayList<>(); for(CUIKeyboardScope s:registered)if(s.getRootView()==v.getRootView())r.add(s); return r; }' + pointer + '}')

scope = (base / 'CUIKeyboardScope.java').read_text()

append = method(scope, '  boolean appendPointerRegistrations(')

put('com/codonui/input/CUIKeyboardScope.java', 'package com.codonui.input; import android.view.*; import java.util.*; import com.facebook.react.bridge.*; class CUIKeyboardScope extends ViewGroup { String ownerId="scope"; double windowEpoch=2,pointerRevision=75; List<CUIWindowPointers.Registration> pointerRegistrations=new ArrayList<>(); static final List<WritableMap> emitted=new ArrayList<>(); CUIKeyboardScope(int id){ super(id); } boolean hasPointerRegistrations(){ return !pointerRegistrations.isEmpty(); } private View pointerTarget(CUIWindowPointers.Registration r){ return getRootView().findViewById(r.targetTag); } void writePointerSession(WritableMap d){ d.putString("ownerId",ownerId); d.putString("windowId",CUIInputWindow.identity(this)); d.putDouble("epoch",windowEpoch); } void emitPointer(WritableMap d){ emitted.add(d); } void publishPointerStatus(boolean a,String e){ }' + append + '}')

identity = Path(__file__).with_name('WindowPointerIdentityAssertions.java').read_text()

put('com/codonui/input/WindowPointerIdentityAssertions.java', identity)

put(
    'com/codonui/input/WindowPointerDispatchAssertions.java',
    r"""package com.codonui.input;
import android.view.*;
import android.app.*;
import java.util.*;
import java.lang.reflect.*;
import com.facebook.react.bridge.*;
import com.facebook.react.uimanager.*;
public final class WindowPointerDispatchAssertions {
  static int assertions,cases;
  static void require(boolean b,String s){
    assertions++;
    if(!b)throw new AssertionError(s);
  }
  static class Surface extends ViewGroup implements RootView{
    Surface(int n){
      super(n);
    }
  }
  interface Action{
    boolean run(MotionEvent e);
  }
  static class Fixture {
    final ViewGroup decor=new ViewGroup(100);
    final Surface surface=new Surface(500);
    final CUIKeyboardScope scope=new CUIKeyboardScope(4000);
    final View day=new View(3608);
    final Window window;
    Action action;
    Fixture(){
      CUIInputWindow.registered.clear();
      CUIInputWindow.states.clear();
      CUIKeyboardScope.emitted.clear();
      TouchTargetHelper.calls=0;
      TouchTargetHelper.fail=false;
      decor.add(surface);
      surface.left=5;
      surface.top=7;
      surface.scrollX=3;
      surface.scrollY=4;
      surface.add(scope);
      scope.left=10;
      scope.top=20;
      scope.matrix.sx=2;
      scope.matrix.sy=2;
      scope.matrix.tx=7;
      scope.matrix.ty=11;
      scope.add(day);
      scope.pointerRegistrations.add(new CUIWindowPointers.Registration("day",3608));
      scope.pointerRegistrations.add(new CUIWindowPointers.Registration("calendar",4000));
      Activity a=new Activity();
      ThemedReactContext c=new ThemedReactContext();
      c.activity=a;
      scope.context=c;
      window=new Window(decor,new Window.Callback(){
        public boolean dispatchTouchEvent(MotionEvent e){
          return action==null?true:action.run(e);
        }
        public boolean dispatchGenericMotionEvent(MotionEvent e){
          return false;
        }
      }
      );
      a.window=window;
      CUIInputWindow.registered.add(scope);
      CUIWindowPointers.refresh(scope);
    }
    MotionEvent event(int phase){
      MotionEvent e=new MotionEvent();
      e.action=phase;
      return e;
    }
    void reached(MotionEvent e){
      MotionEvent local=MotionEvent.obtain(e);
      for(int i=0;
      i<local.xs.length;
      i++){
        local.xs[i]=(e.xs[i]-surface.left+surface.scrollX-scope.left-scope.matrix.tx)/scope.matrix.sx;
        local.ys[i]=(e.ys[i]-surface.top+surface.scrollY-scope.top-scope.matrix.ty)/scope.matrix.sy;
      }
      CUIInputWindow.pointerEvent(scope,local);
      local.recycle();
    }
    boolean send(MotionEvent e){
      return window.getCallback().dispatchTouchEvent(e);
    }
    WritableMap data(){
      return CUIKeyboardScope.emitted.get(CUIKeyboardScope.emitted.size()-1);
    }
    WritableArray entries(){
      return (WritableArray)data().values.get("registrations");
    }
    void close(){
      CUIInputWindow.registered.clear();
      CUIWindowPointers.release(decor);
    }
  }
  static int depth(WritableMap data,int tag){
    for(WritableMap e:((WritableArray)data.values.get("registrations")).values)if(e.getInt("targetTag")==tag)return e.getInt("depth");
    return -999;
  }
  static int pending(Window w)throws Exception{
    Object o=w.getCallback();
    if(!(o instanceof CUIWindowPointerCallback))return 0;
    Field l=o.getClass().getDeclaredField("listener");
    l.setAccessible(true);
    Object p=l.get(o);
    try{
      Field f=p.getClass().getDeclaredField("dispatches");
      f.setAccessible(true);
      return ((List<?>)f.get(p)).size();
    }
    catch(NoSuchFieldException ex){
      return 0;
    }
  }
  public static void main(String[] args)throws Exception{
    Fixture f=new Fixture();
    final Fixture a=f;
    int before=Arguments.maps;
    f.action=e->{
      a.reached(e);
      return false;
    }
    ;
    require(!f.send(f.event(0)),"original false result retained");
    require(f.data().getInt("target")==3606,"actual reached RN root must replace wrong Decor target3208");
    require(depth(f.data(),3608)==1 && depth(f.data(),4000)==2,"day and calendar have actual native hit depths");
    require(TouchTargetHelper.lastRoot==f.surface && TouchTargetHelper.lastX==200 && TouchTargetHelper.lastY==300,"scope point maps through matrix to actual RN root");
    require(((Number)f.data().values.get("pageX")).doubleValue()==102.5 && ((Number)f.data().values.get("pageY")).doubleValue()==153.5,"window page coordinates unchanged");
    require(Arguments.maps-before==3,"one envelope plus two original registration maps");
    require(pending(f.window)==0,"completed frame removed");
    f.close();
    cases++;
    f=new Fixture();
    final Fixture b=f;
    f.action=e->{
      View fresh=new View(9999);
      b.scope.add(fresh);
      b.scope.pointerRegistrations.add(new CUIWindowPointers.Registration("new-popup",9999));
      b.scope.pointerRevision=76;
      b.reached(e);
      return true;
    }
    ;
    f.send(f.event(0));
    require(f.entries().values.size()==2,"new popup during original dispatch excluded from frozen packet");
    require(((Number)f.entries().values.get(0).values.get("revision")).doubleValue()==75,"registration revision frozen before dispatch");
    f.close();
    cases++;
    f=new Fixture();
    f.action=e->true;
    f.send(f.event(0));
    require(f.data().getInt("target")==View.NO_ID && depth(f.data(),3608)==-1,"occluded non-scope dispatch cannot hit a registered view behind it");
    require(TouchTargetHelper.calls==0,"no guessed native root traversal without actual scope dispatch");
    f.close();
    cases++;
    f=new Fixture();
    final Fixture c=f;
    RuntimeException boom=new IllegalStateException("original error");
    f.action=e->{
      c.reached(e);
      throw boom;
    }
    ;
    try{
      f.send(f.event(0));
      throw new AssertionError("original throw swallowed");
    }
    catch(RuntimeException ex){
      require(ex==boom,"same original throwable propagates");
    }
    require(CUIKeyboardScope.emitted.isEmpty()&&pending(f.window)==0,"throw discards delivery and removes deferred frame");
    f.close();
    cases++;
    f=new Fixture();
    final Fixture d=f;
    f.action=e->{
      d.reached(e);
      if(e.down==100){
        MotionEvent inner=d.event(0);
        inner.down=200;
        inner.time=210;
        d.send(inner);
      }
      return true;
    }
    ;
    f.send(f.event(0));
    require(CUIKeyboardScope.emitted.size()==2 && pending(f.window)==0,"nested dispatch frames both finalize independently");
    for(WritableMap data:CUIKeyboardScope.emitted)require(data.getInt("target")==3606,"nested hit stays on reached RN root");
    f.close();
    cases++;
    f=new Fixture();
    final Fixture efix=f;
    f.action=e->{
      efix.reached(e);
      efix.close();
      return true;
    }
    ;
    require(f.send(f.event(0)),"disposal preserves original result");
    require(CUIKeyboardScope.emitted.isEmpty(),"disposed observer cannot deliver retained packet");
    cases++;
    f=new Fixture();
    final Fixture g=f;
    f.action=e->{
      g.reached(e);
      return true;
    }
    ;
    MotionEvent down=f.event(0);
    f.send(down);
    int identity=((Number)f.data().values.get("pointerId")).intValue();
    MotionEvent move=f.event(2);
    move.time=120;
    f.send(move);
    require(f.data().getInt("pointerId")==identity && "move".equals(f.data().values.get("phase")),"MOVE keeps native pointer identity");
    MotionEvent up=f.event(1);
    up.time=130;
    f.send(up);
    require(f.data().getInt("pointerId")==identity&&"end".equals(f.data().values.get("phase")),"UP keeps native pointer identity");
    MotionEvent next=f.event(0);
    next.down=300;
    next.time=310;
    f.send(next);
    int second=f.data().getInt("pointerId");
    MotionEvent cancel=f.event(3);
    cancel.down=300;
    cancel.time=320;
    f.send(cancel);
    require(f.data().getInt("pointerId")==second&&"cancel".equals(f.data().values.get("phase")),"CANCEL keeps native pointer identity");
    f.close();
    cases++;
    f=new Fixture();
    final Fixture h=f;
    f.action=e->{
      h.reached(e);
      return true;
    }
    ;
    f.send(f.event(0));
    MotionEvent multi=f.event(5);
    multi.index=1;
    multi.ids=new int[]{
      0,1
    }
    ;
    multi.xs=new float[]{
      205,225
    }
    ;
    multi.ys=new float[]{
      307,327
    }
    ;
    multi.time=120;
    f.send(multi);
    require(f.data().getInt("pointerId")==2&&!((Boolean)f.data().values.get("isPrimary")),"second pointer keeps separate identity and primary status");
    f.close();
    cases++;
    f=new Fixture();
    final Fixture i=f;
    f.action=e->{
      MotionEvent wrong=MotionEvent.obtain(e);
      wrong.index=0;
      i.reached(wrong);
      wrong.recycle();
      return true;
    }
    ;
    MotionEvent indexed=f.event(5);
    indexed.index=1;
    indexed.ids=new int[]{
      0,1
    }
    ;
    indexed.xs=new float[]{
      205,225
    }
    ;
    indexed.ys=new float[]{
      307,327
    }
    ;
    f.send(indexed);
    require(depth(f.data(),3608)==-1,"mismatched action index cannot supply this frame's hit");
    f.close();
    cases++;
    f=new Fixture();
    final Fixture split=f;
    f.action=e->{
      MotionEvent local=MotionEvent.obtain(e);
      local.action=0;
      local.index=0;
      local.ids=new int[]{
        1
      }
      ;
      local.xs=new float[]{
        225
      }
      ;
      local.ys=new float[]{
        327
      }
      ;
      split.reached(local);
      local.recycle();
      return true;
    }
    ;
    MotionEvent splitDown=f.event(5);
    splitDown.index=1;
    splitDown.ids=new int[]{
      0,1
    }
    ;
    splitDown.xs=new float[]{
      205,225
    }
    ;
    splitDown.ys=new float[]{
      307,327
    }
    ;
    f.send(splitDown);
    require(f.data().getInt("target")==3606&&depth(f.data(),3608)==1,"split POINTER_DOWN-to-DOWN is correlated by selected native pointer ID");
    f.close();
    cases++;
    f=new Fixture();
    final Fixture j=f;
    f.action=e->{
      j.reached(e);
      Surface other=new Surface(600);
      CUIKeyboardScope s=new CUIKeyboardScope(700);
      j.decor.add(other);
      other.add(s);
      CUIInputWindow.pointerEvent(s,e);
      return true;
    }
    ;
    f.send(f.event(0));
    require(depth(f.data(),3608)==-1&&f.data().getInt("target")==-1,"multiple reached RN roots fail closed instead of choosing a layer");
    f.close();
    cases++;
    f=new Fixture();
    final Fixture k=f;
    f.action=e->{
      TouchTargetHelper.fail=true;
      k.reached(e);
      return false;
    }
    ;
    require(!f.send(f.event(0)),"observer failure cannot change original result");
    require(CUIKeyboardScope.emitted.isEmpty(),"hit helper failure cannot publish partial packet");
    f.close();
    cases++;
    f=new Fixture();
    final Fixture replaced=f;
    Window.Callback foreign=new Window.Callback(){
      public boolean dispatchTouchEvent(MotionEvent e){
        return false;
      }
      public boolean dispatchGenericMotionEvent(MotionEvent e){
        return false;
      }
    }
    ;
    f.action=e->{
      replaced.reached(e);
      replaced.window.setCallback(foreign);
      return true;
    }
    ;
    require(f.send(f.event(0)),"callback replacement retains original result");
    require(f.window.getCallback()==foreign&&CUIKeyboardScope.emitted.isEmpty(),"observer cannot emit or overwrite a replacement callback");
    f.close();
    cases++;
    f=new Fixture();
    MotionEvent virtual=f.event(0);
    CUIWindowPointers.activate(f.day);
    require("activation".equals(f.data().values.get("phase"))&&depth(f.data(),3608)==0,"virtual activation retains actual target ancestry");
    f.close();
    cases++;
    f=new Fixture();
    MotionEvent generic=f.event(0);
    require(!f.window.getCallback().dispatchGenericMotionEvent(generic)&&CUIKeyboardScope.emitted.isEmpty()&&pending(f.window)==0,"generic event delegation is unchanged");
    f.close();
    cases++;
    require(MotionEvent.obtains==MotionEvent.recycles,"all observer and local snapshots recycled exactly once");
    System.out.println("Production window dispatch assertions passed: "+assertions+" in "+cases+" cases");
  }
}
"""
)

javac = jdk / 'javac'

java = jdk / 'java'

classes = out / 'classes'

classes.mkdir(exist_ok=True)

steps = []

for name, argv in [('compile', [str(javac), '-d', str(classes), *[str(p) for p in (out / 'src').rglob('*.java')]]), ('dispatch', [str(java), '-cp', str(classes), 'com.codonui.input.WindowPointerDispatchAssertions']), ('identities', [str(java), '-cp', str(classes), 'com.codonui.input.WindowPointerIdentityAssertions'])]:
    start = time.time()
    p = subprocess.run(argv, capture_output=True, text=True)
    (out / (name + '.stdout')).write_text(p.stdout)
    (out / (name + '.stderr')).write_text(p.stderr)
    steps.append({'name': name, 'exitCode': p.returncode, 'seconds': time.time() - start, 'stdout': p.stdout[-1800:], 'stderr': p.stderr[-3000:]})
    print(json.dumps(steps[-1]), flush=True)
    if p.returncode:
        break

result = {'source': str(src), 'status': 'PASS' if len(steps) == 3 and all((x['exitCode'] == 0 for x in steps)) else 'FAIL', 'steps': steps, 'limits': ['Source-extracted actual callback/forwarder and whole actual producer, stubbed Android/RN dispatch environment; not an installed native event proof.', 'Root selection fixture models retained3208-versus3606 trace; it does not execute real pinned Android TouchTargetHelper.'], 'productionSHA256': {str(p.relative_to(src)): hashlib.sha256(p.read_bytes()).hexdigest() for p in base.glob('*.java') if p.name in ['CUIWindowPointers.java', 'CUIWindowPointerCallback.java', 'CUIInputWindow.java', 'CUIKeyboardScope.java']}}

(out / 'result.json').write_text(json.dumps(result, indent=2) + '\n')

raise SystemExit(0 if result['status'] == 'PASS' else 1)
