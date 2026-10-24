import java.util.*;

// Surrounding native hit/listener/event models. The included down/up/intersection
// bodies are extracted unchanged from the locked Android SDK by the verifier.
final class FieldPointerStreamContract {
  static final int UNSET_POINTER_ID = -1;
  final Set<Integer> mHoveringPointerIds = new HashSet<>();
  final Map<Integer,List<ViewTarget>> mCurrentlyDownPointerIdsToHitPath = new HashMap<>();
  int mPrimaryPointerId = UNSET_POINTER_ID;
  enum EVENT { OVER, OVER_CAPTURE, ENTER, ENTER_CAPTURE, DOWN, DOWN_CAPTURE, UP, UP_CAPTURE, OUT, OUT_CAPTURE, LEAVE, LEAVE_CAPTURE, CLICK, CLICK_CAPTURE }
  record ViewTarget(int getViewId) {}
  record MotionEvent(int action) { static final int ACTION_UP=1; int getActionMasked() { return action; } }
  record PointerEventState(int getActivePointerId, Map<Integer,List<ViewTarget>> getHitPathByPointerId) {
    List<Integer> getHitPathViewIdsForActivePointer() { return List.of(); }
  }
  record PointerEvent(String type,int target) {
    static PointerEvent obtain(String type,int target,PointerEventState state,MotionEvent event) { return new PointerEvent(type,target); }
    static PointerEvent obtain(String type,int target,PointerEventState state,MotionEvent event,List<Integer> path) { return obtain(type,target,state,event); }
  }
  interface EventDispatcher { void dispatchEvent(PointerEvent event); }
  static final class PointerEventHelper {
    static final String POINTER_OVER="over", POINTER_ENTER="enter", POINTER_DOWN="down", POINTER_UP="up", POINTER_OUT="out", POINTER_LEAVE="leave", CLICK="click";
  }
  static final class ReactNativeFeatureFlags { static boolean cxxNativeAnimatedEnabled() { return false; } }
  static boolean isAnyoneListeningForBubblingEvent(List<ViewTarget> path,EVENT a,EVENT b) { return true; }
  static List<ViewTarget> filterByShouldDispatch(List<ViewTarget> path,EVENT a,EVENT b,boolean value) { return new ArrayList<>(); }
  static void dispatchEventForViewTargets(String kind,PointerEventState state,MotionEvent event,List<ViewTarget> views,EventDispatcher dispatcher) {}
  void incrementCoalescingKey() {}

  // SDK_METHODS

  void receive(boolean down,int pointer,List<ViewTarget> path,EventDispatcher dispatcher) {
    var state=new PointerEventState(pointer,Map.of(pointer,path));
    if (down) onDown(path.get(0).getViewId(),state,new MotionEvent(0),dispatcher);
    else onUp(path.get(0).getViewId(),state,new MotionEvent(MotionEvent.ACTION_UP),dispatcher);
  }
  static final List<ViewTarget> FIELD_A=List.of(new ViewTarget(10),new ViewTarget(100));
  static final List<ViewTarget> FIELD_B=List.of(new ViewTarget(20),new ViewTarget(100));
  static final List<ViewTarget> OUTSIDE=List.of(new ViewTarget(30),new ViewTarget(100));
  static int checks;
  static void check(boolean value) { if (!value) throw new AssertionError("Pointer stream assertion "+(checks+1)); checks++; }
  public static void main(String[] args) {
    var broken=new FieldPointerStreamContract();var oldEvents=new ArrayList<PointerEvent>();
    broken.receive(true,0,FIELD_A,oldEvents::add);
    // The former field-hit admission drops both original outside phases.
    broken.receive(false,0,FIELD_A,oldEvents::add);
    check(oldEvents.stream().filter(e->e.type.equals("click")&&e.target==10).count()==1);
    var full=new FieldPointerStreamContract();var received=new ArrayList<PointerEvent>();
    EventDispatcher fieldOnly=e->{if(e.target==10||e.target==20)received.add(e);};
    full.receive(true,0,FIELD_A,fieldOnly);
    full.receive(false,0,OUTSIDE,fieldOnly);
    check(full.mCurrentlyDownPointerIdsToHitPath.isEmpty());
    full.receive(true,0,OUTSIDE,fieldOnly);
    full.receive(false,0,FIELD_A,fieldOnly);
    check(received.stream().noneMatch(e->e.type.equals("click")));
    check(received.stream().noneMatch(e->e.target==30||e.target==100));
    for (var path:List.of(FIELD_A,FIELD_B,FIELD_A)) {
      full.receive(true,0,path,fieldOnly);full.receive(false,0,path,fieldOnly);
      check(full.mCurrentlyDownPointerIdsToHitPath.isEmpty());
    }
    check(received.stream().filter(e->e.type.equals("click")&&e.target==10).count()==2);
    check(received.stream().filter(e->e.type.equals("click")&&e.target==20).count()==1);
    full.receive(true,0,FIELD_A,fieldOnly);full.receive(true,1,FIELD_B,fieldOnly);
    check(full.mCurrentlyDownPointerIdsToHitPath.size()==2);
    full.receive(false,1,FIELD_B,fieldOnly);check(full.mCurrentlyDownPointerIdsToHitPath.containsKey(0));
    full.receive(false,0,FIELD_A,fieldOnly);check(full.mCurrentlyDownPointerIdsToHitPath.isEmpty());
    System.out.println(checks+" exact SDK pointer down/up/retirement assertions passed; explicit surrounding native models, no installed verdict");
  }
}
