package com.codonui.input;

import android.content.ClipData;
import android.content.ClipDescription;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Point;
import android.graphics.RectF;
import android.os.Handler;
import android.os.Looper;
import android.view.DragEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.view.ViewParent;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.TouchTargetHelper;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.WeakHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

// Observes the owned scope's original dispatch; no caller listener is replaced.
final class CUIDragInteractions {
  static final String LOCAL_TYPE = "application/x-codon-local-drag";
  private static final WeakHashMap<View, Candidate> pointers = new WeakHashMap<>();
  private static long dispatchSerial, nextEpoch;
  private static int dispatchDepth;
  private static long currentDispatch;
  static void beginDispatch() { if (dispatchDepth++ == 0) currentDispatch = ++dispatchSerial; }
  static void endDispatch() { dispatchDepth--; }
  private static final class Member {
    final String key, instance;
    final int tag, handleTag;
    WeakReference<View> view = new WeakReference<>(null), handle = new WeakReference<>(null);
    boolean resolved, handleResolved;
    Member(JSONObject row) throws Exception { key = row.getString("key"); instance = row.getString("instanceId"); tag = tag(row.get("targetTag"), false); handleTag = tag(row.get("handleTag"), true); }
  }
  private static final class Binding {
    JSONObject data;
    final Map<String, Member> members = new LinkedHashMap<>();
    WeakReference<View> root = new WeakReference<>(null), preview = new WeakReference<>(null);
    boolean resolved, ready, retired;
    String previewIdentity = "";
    Binding(JSONObject data) { this.data = data; }
  }
  private static final class Source {
    final String id;
    final CUIDragInteractions owner;
    final Binding binding;
    final Member member;
    final View original;
    final JSONArray maps, operations;
    final long epoch;
    boolean starting = true, started, ended, attempted, accepted, exportedCopy;
    long moved;
    String selected = "cancel";
    Source(String id,CUIDragInteractions owner, Binding binding, Member member, View original, JSONArray maps, JSONArray operations) {
      this.id=id; this.owner = owner; this.binding = binding; this.member = member; this.original = original; this.maps = maps; this.operations = operations; epoch = owner.epoch;
    }
    String identifier() { return id; }
    boolean allows(String operation) { for (int i=0;i<operations.length();i++) if (operation.equals(operations.optString(i))) return true; return false; }
  }
  private static final class Candidate {
    final CUIDragInteractions owner;
    final Binding binding;
    final Member member;
    final int pointer, tool;
    final long downTime, epoch;
    final float x, y;
    float lastX, lastY;
    final Runnable lift;
    Candidate(CUIDragInteractions owner, Binding binding, Member member, MotionEvent event, float[] point) {
      this.owner = owner; this.binding = binding; this.member = member; pointer = event.getPointerId(0); tool = event.getToolType(0);
      downTime = event.getDownTime(); epoch = owner.epoch; x = lastX = point[0]; y = lastY = point[1]; lift = () -> owner.lift(this);
    }
  }
  private final CUIKeyboardScope scope;
  private final Handler main = new Handler(Looper.getMainLooper());
  private final Map<String, Binding> bindings = new LinkedHashMap<>();
  private final Map<String, String> statuses = new HashMap<>();
  private String window = "", owner = "", windowStatus = "", foreignId;
  private long epoch, geometryRevision;
  private int lastSurface;
  private WeakReference<View> windowRoot = new WeakReference<>(null);
  private boolean closed;
  private Source source;

  CUIDragInteractions(CUIKeyboardScope scope) { this.scope = scope; }
  private static int tag(Object value, boolean zero) {
    if (!(value instanceof Number)) throw new IllegalArgumentException("native-drag-original-target-invalid");
    double number = ((Number)value).doubleValue();
    if (!Double.isFinite(number) || number != Math.rint(number) || number < (zero ? 0 : 1) || number > Integer.MAX_VALUE) throw new IllegalArgumentException("native-drag-original-target-invalid");
    return (int)number;
  }
  private static boolean descendant(View view, View root) { for (View child=view;child!=null;child=child.getParent() instanceof View ? (View)child.getParent() : null) if (child==root) return true; return false; }
  private View resolve(int tag) {
    UIManager manager = UIManagerHelper.getUIManagerForReactTag((ThemedReactContext)scope.getContext(), scope.getId());
    return manager == null ? null : manager.resolveView(tag);
  }
  boolean available() { return !closed && scope.isAttachedToWindow() && scope.dragEnabled() && UIManagerHelper.getSurfaceId(scope)>0; }
  boolean canLift() { return available() && scope.hasWindowFocus() && scope.getWindowVisibility()==View.VISIBLE; }
  boolean canDrop() { return available() && scope.getWindowVisibility()==View.VISIBLE; }
  long epoch() { return epoch; }
  String window() { return window; }
  void update(String encoded) {
    UiThreadUtil.assertOnUiThread();
    try {
      JSONArray values = new JSONArray(encoded); Set<String> ids = new HashSet<>(); Set<Integer> roots = new HashSet<>();
      for (int i=0;i<values.length();i++) {
        JSONObject data = values.getJSONObject(i); String id = data.getString("bindingId"); int root = tag(data.get("rootTarget"),false);
        if (id.isEmpty() || data.getString("moduleId").isEmpty() || data.getString("revision").isEmpty() || !ids.add(id) || !roots.add(root)) throw new IllegalArgumentException("native-drag-bindings-ambiguous");
        tag(data.get("previewTarget"),true);
        Binding binding = bindings.get(id);
        if (binding!=null && (!binding.data.getString("revision").equals(data.getString("revision")) || !binding.data.getString("moduleId").equals(data.getString("moduleId")) || binding.data.getInt("rootTarget")!=root)) { retire(binding); bindings.remove(id); statuses.remove(id); binding=null; }
        if (binding==null) { binding=new Binding(data); bindings.put(id,binding); }
        binding.data=data;
      }
      for (String id:new ArrayList<>(bindings.keySet())) if (!ids.contains(id)) { retire(bindings.remove(id)); statuses.remove(id); }
    } catch (Exception error) { throw new IllegalStateException("native-drag-bindings-invalid",error); }
  }
  void refreshWindow() {
    UiThreadUtil.assertOnUiThread(); if (closed) return;
    View root=scope.isAttachedToWindow()?scope.getRootView():null; String identity=scope.formActionOwnerId();
    String nextWindow=root==null?"":CUIInputWindow.identity(scope); int nextSurface=UIManagerHelper.getSurfaceId(scope);
    if (root!=windowRoot.get() || !nextWindow.equals(window) || !identity.equals(owner) || (nextSurface>0 && lastSurface>0 && nextSurface!=lastSurface)) {
      cancelPointer(); for (Binding binding:bindings.values()) { retire(binding); binding.retired=false; }
      windowRoot=new WeakReference<>(root); owner=identity; window=nextWindow; epoch=++nextEpoch; windowStatus=""; statuses.clear();
    }
    if (nextSurface>0) lastSurface=nextSurface;
    int surface=lastSurface; if (surface<=0 || epoch==0) return;
    if (!canLift()) cancelPointer();
    try {
      JSONObject status=new JSONObject().put("kind","window").put("ownerId",owner).put("windowId",window).put("epoch",epoch).put("surfaceId",surface).put("scopeTarget",scope.getId())
        .put("available",available()).put("canLift",canLift()).put("canDrop",canDrop());
      String encoded=status.toString(); if (!encoded.equals(windowStatus)) { windowStatus=encoded; scope.emitDragStatus(encoded); }
    } catch (Exception error) { throw new IllegalStateException("native-drag-window-status-invalid",error); }
  }
  void refresh() {
    refreshWindow(); if (!available()) return;
    for (Binding binding:bindings.values()) {
      binding.ready=false;
      try {
        View root=resolve(binding.data.getInt("rootTarget"));
        if (root==null || !root.isAttachedToWindow() || root.getRootView()!=scope.getRootView() || !descendant(root,scope) || (binding.resolved && root!=binding.root.get())) throw new IllegalStateException("native-drag-original-root-unavailable");
        binding.root=new WeakReference<>(root); binding.resolved=true;
        JSONArray rows=binding.data.getJSONArray("members"); Set<String> keep=new HashSet<>(), keys=new HashSet<>();
        for (int i=0;i<rows.length();i++) {
          JSONObject row=rows.getJSONObject(i); String instance=row.getString("instanceId");
          if (instance.isEmpty() || !keep.add(instance) || !keys.add(row.getString("key"))) throw new IllegalStateException("native-drag-members-ambiguous");
          Member member=binding.members.get(instance); if (member==null) { member=new Member(row); binding.members.put(instance,member); }
          if (!member.key.equals(row.getString("key")) || member.tag!=tag(row.get("targetTag"),false) || member.handleTag!=tag(row.get("handleTag"),true)) throw new IllegalStateException("native-drag-original-member-retargeted");
          View view=resolve(member.tag); if (view==null || !view.isAttachedToWindow() || !descendant(view,root) || (member.resolved && member.view.get()!=view)) throw new IllegalStateException("native-drag-original-member-unavailable");
          member.view=new WeakReference<>(view); member.resolved=true;
          if (member.handleTag!=0) {
            View handle=resolve(member.handleTag); if (handle==null || !descendant(handle,view) || (member.handleResolved && member.handle.get()!=handle)) throw new IllegalStateException("native-drag-original-handle-unavailable");
            member.handle=new WeakReference<>(handle); member.handleResolved=true;
          }
        }
        binding.members.keySet().retainAll(keep);
        int preview=tag(binding.data.get("previewTarget"),true);
        if (preview!=0) {
          String nonce=binding.data.getString("previewInstanceId")+":"+preview; View view=resolve(preview);
          if (view==null || !view.isAttachedToWindow() || view.getRootView()!=root.getRootView() || (nonce.equals(binding.previewIdentity) && binding.preview.get()!=view)) throw new IllegalStateException("native-drag-original-preview-unavailable");
          binding.previewIdentity=nonce; binding.preview=new WeakReference<>(view);
        } else { binding.previewIdentity=""; binding.preview.clear(); }
        binding.ready=true; status(binding,true,"","binding");
      } catch (Exception error) { status(binding,false,error.toString(),"binding"); }
    }
  }
  private boolean current(Binding binding) {
    View root=binding.root.get();
    try { return available() && !binding.retired && binding.ready && bindings.get(binding.data.getString("bindingId"))==binding && root!=null && root.isAttachedToWindow() &&
      root.getRootView()==scope.getRootView() && descendant(root,scope) && resolve(binding.data.getInt("rootTarget"))==root; }
    catch (Exception error) { return false; }
  }
  private boolean owns(Source value) { return !value.ended && value.owner.source==value && value.epoch==value.owner.epoch && value.owner.current(value.binding) &&
    value.binding.members.get(value.member.instance)==value.member && value.member.view.get()==value.original && value.original.isAttachedToWindow() && descendant(value.original,value.binding.root.get()); }
  private void retire(Binding binding) { if (binding==null) return; binding.ready=false; binding.retired=true; binding.resolved=false; binding.root.clear(); binding.preview.clear(); binding.previewIdentity=""; binding.members.clear(); if (source!=null && source.binding==binding) { source.ended=true; source=null; } }
  private void status(Binding binding,boolean ready,String error,String kind) {
    if (epoch==0) return;
    try {
      JSONObject status=new JSONObject().put("kind",kind).put("ownerId",owner).put("windowId",window).put("epoch",epoch)
        .put("moduleId",binding.data.getString("moduleId")).put("bindingId",binding.data.getString("bindingId")).put("revision",binding.data.getString("revision"))
        .put("rootTarget",binding.data.getInt("rootTarget")).put("ready",ready).put("error",error==null?"":error);
      String encoded=status.toString(), key=binding.data.getString("bindingId");
      if (!kind.equals("binding") || !encoded.equals(statuses.get(key))) { statuses.put(key,encoded); scope.emitDragStatus(encoded); }
    } catch (Exception failure) { throw new IllegalStateException("native-drag-binding-status-invalid",failure); }
  }
  private static Matrix transform(View view,View root) {
    Matrix result=new Matrix(); transform(view,root,result); return result;
  }
  private static void transform(View view,View root,Matrix matrix) {
    if (view==root) return;
    ViewParent next=view.getParent(); if (!(next instanceof View)) throw new IllegalStateException("native-drag-original-window-ancestry-retired");
    View parent=(View)next; transform(parent,root,matrix); matrix.preTranslate(-parent.getScrollX(),-parent.getScrollY()); matrix.preTranslate(view.getLeft(),view.getTop()); matrix.preConcat(view.getMatrix());
  }
  private float density() { float value=scope.getResources().getDisplayMetrics().density; if (!Float.isFinite(value) || value<=0) throw new IllegalStateException("native-drag-original-density-invalid"); return value; }
  float[] point(float x,float y) { float[] point={x,y}; transform(scope,scope.getRootView()).mapPoints(point); int[] origin=new int[2]; scope.getRootView().getLocationInWindow(origin); point[0]+=origin[0]; point[1]+=origin[1]; return point; }
  private JSONObject rect(View view) throws Exception {
    RectF rect=new RectF(0,0,view.getWidth(),view.getHeight()); transform(view,scope.getRootView()).mapRect(rect); int[] origin=new int[2]; scope.getRootView().getLocationInWindow(origin); rect.offset(origin[0],origin[1]);
    float scale=density(); if (!Float.isFinite(rect.left) || !Float.isFinite(rect.top) || !Float.isFinite(rect.width()) || !Float.isFinite(rect.height())) throw new IllegalStateException("native-drag-original-geometry-invalid");
    return new JSONObject().put("x",rect.left/scale).put("y",rect.top/scale).put("width",rect.width()/scale).put("height",rect.height()/scale);
  }
  private JSONObject action(Binding binding,String kind,String session,Member member,float[] point,JSONObject values,CUIDragActionDispatch.Current actor) throws Exception {
    if (!current(binding) || !actor.check()) throw new IllegalStateException("native-drag-original-session-retired");
    long epoch=this.epoch; String window=this.window;
    JSONObject identity=new JSONObject().put("moduleId",binding.data.getString("moduleId")).put("ownerId",owner).put("bindingId",binding.data.getString("bindingId"))
      .put("revision",binding.data.getString("revision")).put("windowId",window).put("epoch",epoch).put("sessionId",session).put("kind",kind)
      .put("surfaceId",UIManagerHelper.getSurfaceId(scope)).put("scopeTarget",scope.getId()).put("rootTarget",binding.data.getInt("rootTarget")).put("itemTarget",member==null?0:member.tag);
    JSONArray items=new JSONArray();
    for (Member item:binding.members.values()) if (item.view.get()!=null && item.view.get().isAttachedToWindow() && descendant(item.view.get(),binding.root.get()))
      items.put(new JSONObject().put("key",item.key).put("instanceId",item.instance).put("targetTag",item.tag).put("rect",rect(item.view.get())));
    JSONObject payload=new JSONObject(values.toString()).put("x",point[0]/density()).put("y",point[1]/density())
      .put("geometry",new JSONObject().put("revision",++geometryRevision).put("root",rect(binding.root.get())).put("items",items));
    if (member!=null) payload.put("key",member.key).put("instanceId",member.instance);
    String encoded=CUIDragActionDispatch.run(scope,identity,payload,true,()->current(binding) && this.epoch==epoch && this.window.equals(window) &&
      (member==null || (binding.members.get(member.instance)==member && member.view.get()!=null && descendant(member.view.get(),binding.root.get()))) && actor.check());
    JSONObject response=new JSONObject(encoded); if (response.has("error")) throw new IllegalStateException(response.getString("error")); return response;
  }
  private Member memberAt(Binding binding,float x,float y) {
    if (!current(binding)) return null;
    float[] local={x,y}; int[] origin=new int[2]; scope.getRootView().getLocationInWindow(origin); local[0]-=origin[0]; local[1]-=origin[1]; Matrix inverse=new Matrix();
    if (!transform(scope,scope.getRootView()).invert(inverse)) return null; inverse.mapPoints(local);
    List<TouchTargetHelper.ViewTarget> path=TouchTargetHelper.findTargetPathAndCoordinatesForTouch(local[0],local[1],scope,new float[2]);
    Member selected=null; int depth=Integer.MAX_VALUE;
    for (Member member:binding.members.values()) for (int i=0;i<path.size();i++) if (path.get(i).getViewId()==member.tag && i<depth) { selected=member; depth=i; }
    return selected;
  }
  void touch(MotionEvent event) {
    if (!canLift()) { cancelPointer(); return; }
    int action=event.getActionMasked(); View root=scope.getRootView();
    if (action==MotionEvent.ACTION_DOWN) {
      cancelPointer();
      if (event.getToolType(0)==MotionEvent.TOOL_TYPE_MOUSE && (event.getButtonState() & MotionEvent.BUTTON_PRIMARY)==0) return;
      float[] point=point(event.getX(),event.getY()); Candidate selected=null;
      for (Binding binding:bindings.values()) try {
        if (!binding.data.getBoolean("draggable")) continue; Member member=memberAt(binding,point[0],point[1]);
        if (member!=null && (selected==null || descendant(member.view.get(),selected.member.view.get()))) selected=new Candidate(this,binding,member,event,point);
      } catch (Exception error) { status(binding,false,error.toString(),"binding"); }
      if (selected!=null) {
        Candidate old=pointers.get(root);
        if (old==null || descendant(selected.member.view.get(),old.member.view.get())) {
          if (old!=null) old.owner.main.removeCallbacks(old.lift); pointers.put(root,selected);
          if (selected.tool==MotionEvent.TOOL_TYPE_FINGER) main.postDelayed(selected.lift,ViewConfiguration.getLongPressTimeout());
        }
      }
    } else {
      Candidate pending=pointers.get(root); if (pending==null || pending.owner!=this) return;
      if (action==MotionEvent.ACTION_UP || action==MotionEvent.ACTION_CANCEL || action==MotionEvent.ACTION_POINTER_DOWN || event.findPointerIndex(pending.pointer)<0 || event.getDownTime()!=pending.downTime) { cancelPointer(); return; }
      if (action==MotionEvent.ACTION_MOVE) {
        float[] point=point(event.getX(event.findPointerIndex(pending.pointer)),event.getY(event.findPointerIndex(pending.pointer))); pending.lastX=point[0]; pending.lastY=point[1];
        float slop=ViewConfiguration.get(scope.getContext()).getScaledTouchSlop();
        if (Math.hypot(point[0]-pending.x,point[1]-pending.y)>slop) { if (pending.tool==MotionEvent.TOOL_TYPE_FINGER) cancelPointer(); else lift(pending); }
      }
    }
  }
  void cancelPointer() {
    java.util.Iterator<Map.Entry<View,Candidate>> iterator=pointers.entrySet().iterator();
    while (iterator.hasNext()) { Candidate candidate=iterator.next().getValue(); if (candidate.owner==this) { main.removeCallbacks(candidate.lift); iterator.remove(); } }
  }
  private void lift(Candidate candidate) {
    if (pointers.get(scope.getRootView())!=candidate) { main.removeCallbacks(candidate.lift); pointers.values().removeIf(value->value==candidate); return; } cancelPointer();
    if (!canLift() || candidate.epoch!=epoch || !current(candidate.binding) || candidate.member.view.get()==null || source!=null) return;
    Binding binding=candidate.binding; Source transfer=null;
    try {
      View original=candidate.member.view.get(); String id=UUID.randomUUID().toString();
      JSONObject response=action(binding,"lift",id,candidate.member,new float[]{candidate.lastX,candidate.lastY},new JSONObject(),()->canLift() && candidate.member.view.get()==original);
      JSONArray maps=response.getJSONArray("items"),operations=response.getJSONArray("operations");
      for (int i=0;i<maps.length();i++) {
        JSONArray rows=maps.getJSONArray(i); Set<String> names=new HashSet<>();
        for (int j=0;j<rows.length();j++) { JSONObject row=rows.getJSONObject(j); if (row.length()!=2 || !(row.get("type") instanceof String) || !(row.get("data") instanceof String) || !names.add(row.getString("type"))) throw new IllegalStateException("native-drag-original-representation-invalid"); }
      }
      for (int i=0;i<operations.length();i++) if (!java.util.Arrays.asList("copy","move","link","cancel").contains(operations.getString(i))) throw new IllegalStateException("native-drag-original-operation-invalid");
      if (maps.length()==0) { status(binding,true,"","retired"); return; }
      transfer=new Source(id,this,binding,candidate.member,original,new JSONArray(maps.toString()),new JSONArray(operations.toString())); source=transfer;
      ClipData data=localData(transfer);
      View preview=binding.preview.get(); View.DragShadowBuilder shadow=preview==null?new View.DragShadowBuilder(original):new Shadow(preview,(float)binding.data.getDouble("previewX")*density(),(float)binding.data.getDouble("previewY")*density());
      boolean started=original.startDragAndDrop(data,shadow,transfer,0); transfer.starting=false; transfer.started=started;
      if (!started) { transfer.ended=true; source=null; status(binding,true,"","retired"); }
    } catch (Exception error) { if (transfer!=null) transfer.ended=true; source=null; status(binding,false,error.toString(),"binding"); }
  }
  private static ClipData localData(Source source) {
    Intent token=new Intent().putExtra("com.codonui.drag.SESSION",source.identifier());
    return new ClipData(new ClipDescription("",new String[]{LOCAL_TYPE}),new ClipData.Item(token));
  }
  private static final class Shadow extends View.DragShadowBuilder {
    private final float x,y,left,top;
    Shadow(View view,float x,float y) { super(view); this.x=x; this.y=y; left=Math.max(0,-x); top=Math.max(0,-y); }
    @Override public void onProvideShadowMetrics(Point size,Point touch) {
      View view=getView(); if (view==null) throw new IllegalStateException("native-drag-original-preview-retired");
      size.set((int)Math.ceil(left+Math.max(view.getWidth(),x)),(int)Math.ceil(top+Math.max(view.getHeight(),y))); touch.set(Math.round(left+x),Math.round(top+y));
    }
    @Override public void onDrawShadow(Canvas canvas) { View view=getView(); if (view==null) return; canvas.save(); canvas.translate(left,top); view.draw(canvas); canvas.restore(); }
  }
  private static Source local(DragEvent event) { Object state=event.getLocalState(); return state instanceof Source && !((Source)state).ended ? (Source)state : null; }
  private String identifier(DragEvent event) { Source local=local(event); if (local!=null) return local.identifier(); if (foreignId==null) foreignId=UUID.randomUUID().toString(); return foreignId; }
  private JSONObject types(DragEvent event) throws Exception {
    JSONArray types=new JSONArray(); Set<String> seen=new LinkedHashSet<>(); Source local=local(event);
    if (local!=null) for (int i=0;i<local.maps.length();i++) { JSONArray rows=local.maps.getJSONArray(i); for (int j=0;j<rows.length();j++) seen.add(rows.getJSONObject(j).getString("type")); }
    else { ClipDescription description=event.getClipDescription(); if (description!=null) for (int i=0;i<description.getMimeTypeCount();i++) seen.add(description.getMimeType(i)); }
    for (String type:seen) types.put(type);
    return new JSONObject().put("types",types).put("directory",seen.contains("vnd.android.document/directory"))
      .put("operations",local!=null && local.owner.owns(local)?local.operations:local!=null && !local.allows("copy")?new JSONArray():new JSONArray().put("copy"));
  }
  private Binding targetAt(float[] point) throws Exception {
    Binding selected=null;
    for (Binding binding:bindings.values()) if (current(binding) && binding.data.getBoolean("droppable")) {
      JSONObject rect=rect(binding.root.get()); float x=point[0]/density(),y=point[1]/density();
      if (x>=rect.getDouble("x") && x<=rect.getDouble("x")+rect.getDouble("width") && y>=rect.getDouble("y") && y<=rect.getDouble("y")+rect.getDouble("height") &&
          (selected==null || descendant(binding.root.get(),selected.root.get()))) selected=binding;
    }
    return selected;
  }
  private final Set<Binding> entered=new HashSet<>();
  boolean drag(DragEvent event,boolean original,float[] point) {
    int action=event.getAction(); Source local=local(event); String id=identifier(event);
    try {
      if (action==DragEvent.ACTION_DRAG_STARTED) {
        foreignId=local==null?UUID.randomUUID().toString():null;
        if (local==null && event.getClipDescription()!=null && event.getClipDescription().hasMimeType(LOCAL_TYPE)) return false;
        if (source!=null && !source.ended) return true;
        for (Binding binding:bindings.values()) if (current(binding) && binding.data.getBoolean("droppable")) return true;
        return false;
      }
      if (action==DragEvent.ACTION_DRAG_LOCATION || action==DragEvent.ACTION_DROP) {
        if (local!=null && !local.ended && local.moved!=currentDispatch && local.owner.owns(local)) {
          local.moved=currentDispatch;
          float[] sourcePoint=project(point,scope,local.owner.scope);
          local.owner.action(local.binding,"move",local.identifier(),local.member,sourcePoint,new JSONObject().put("nativeAction",action),()->local.owner.owns(local));
        }
        if (!canDrop() || original) return false;
        Binding target=targetAt(point); if (target==null) return false;
        JSONObject response=action(target,"target",id,null,point,types(event),()->canDrop()); entered.add(target);
        String operation=response.getString("operation");
        for (Binding old:new ArrayList<>(entered)) if (old!=target) { if (current(old)) action(old,"exit",id,null,point,new JSONObject(),()->current(old)); entered.remove(old); }
        if (action==DragEvent.ACTION_DRAG_LOCATION) return !operation.equals("cancel");
        if (operation.equals("cancel")) return false;
        if (local!=null) local.attempted=true;
        CUIDragDataStore store=CUIDragDataStore.forModule(target.data.getString("moduleId")); if (store==null) throw new IllegalStateException("native-drag-data-module-retired");
        String handle=local!=null?store.beginImportTextMaps(local.maps):store.beginImport(activity(),event);
        try {
          JSONObject values=types(event).put("dataHandle",handle).put("nativeAction",action);
          JSONObject dropped=action(target,"drop",id,null,point,values,()->canDrop());
          if (!dropped.getBoolean("accepted")) { store.releaseData(new JSONObject().put("moduleId",store.moduleId).put("handle",handle)); return false; }
          if (local!=null) { local.accepted=true; local.selected=dropped.getString("operation"); }
          return true;
        } catch (Exception error) { store.releaseData(new JSONObject().put("moduleId",store.moduleId).put("handle",handle)); throw error; }
      }
      if (action==DragEvent.ACTION_DRAG_EXITED) {
        for (Binding binding:new ArrayList<>(entered)) if (current(binding)) action(binding,"exit",id,null,new float[]{0,0},new JSONObject().put("nativeAction",action),()->current(binding));
        entered.clear(); return false;
      }
      if (action==DragEvent.ACTION_DRAG_ENDED) {
        if (source!=null && event.getLocalState()==source) {
          Source ending=source;
          try { if (owns(ending)) action(ending.binding,"end",ending.identifier(),ending.member,new float[]{0,0},new JSONObject()
            .put("operation",!event.getResult()?"cancel":ending.attempted?ending.accepted?ending.selected:"cancel":ending.exportedCopy&&ending.allows("copy")?"copy":"cancel")
            .put("nativeResult",event.getResult()),()->owns(ending)); }
          finally { ending.ended=true; source=null; }
        }
        for (Binding binding:new ArrayList<>(entered)) if (current(binding) && (local==null || local.binding!=binding)) action(binding,"end",id,null,new float[]{0,0},new JSONObject().put("operation","cancel").put("external",true).put("nativeResult",event.getResult()),()->current(binding));
        entered.clear(); foreignId=null; return false;
      }
    } catch (Exception error) { for (Binding binding:bindings.values()) if (current(binding)) status(binding,false,error.toString(),"binding"); }
    return false;
  }
  private android.app.Activity activity() {
    android.content.Context context=scope.getContext(); Set<android.content.Context> seen=new HashSet<>();
    while (context instanceof android.content.ContextWrapper && seen.add(context)) { if (context instanceof android.app.Activity) return (android.app.Activity)context; context=((android.content.ContextWrapper)context).getBaseContext(); }
    return context instanceof android.app.Activity?(android.app.Activity)context:null;
  }
  private static float[] project(float[] point,View from,View to) {
    int[] fromScreen=new int[2],fromWindow=new int[2],toScreen=new int[2],toWindow=new int[2];
    from.getRootView().getLocationOnScreen(fromScreen); from.getRootView().getLocationInWindow(fromWindow); to.getRootView().getLocationOnScreen(toScreen); to.getRootView().getLocationInWindow(toWindow);
    return new float[]{point[0]+fromScreen[0]-fromWindow[0]-toScreen[0]+toWindow[0],point[1]+fromScreen[1]-fromWindow[1]-toScreen[1]+toWindow[1]};
  }
  JSONObject geometry(JSONObject request) throws Exception {
    UiThreadUtil.assertOnUiThread(); Binding binding=bindings.get(request.getString("bindingId"));
    if (binding==null || !current(binding) || !request.getString("moduleId").equals(binding.data.getString("moduleId")) ||
        !request.getString("revision").equals(binding.data.getString("revision")) || request.getInt("rootTarget")!=binding.data.getInt("rootTarget") ||
        !request.getString("ownerId").equals(owner) || !request.getString("windowId").equals(window) || request.getLong("epoch")!=epoch || request.getInt("scopeTarget")!=scope.getId())
      throw new IllegalStateException("native-drag-original-geometry-owner-retired");
    JSONArray items=new JSONArray();
    for (Member member:binding.members.values()) if (member.view.get()!=null && member.view.get().isAttachedToWindow() && descendant(member.view.get(),binding.root.get()))
      items.put(new JSONObject().put("key",member.key).put("instanceId",member.instance).put("targetTag",member.tag).put("rect",rect(member.view.get())));
    return new JSONObject().put("requestId",request.getString("requestId")).put("windowId",window).put("epoch",epoch)
      .put("geometry",new JSONObject().put("revision",++geometryRevision).put("root",rect(binding.root.get())).put("items",items));
  }
  void dispose() { if (closed) return; cancelPointer(); for (Binding binding:bindings.values()) retire(binding); bindings.clear(); entered.clear(); closed=true; }
}
