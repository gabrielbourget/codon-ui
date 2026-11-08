package dev.codonui.lab.number;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Rect;
import android.graphics.Bitmap;
import android.view.MotionEvent;
import android.view.InputDevice;
import java.io.File;
import java.io.FileOutputStream;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Base64;
import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;

public final class Actions extends Instrumentation {
  private Bundle arguments;
  public void onCreate(Bundle args) { super.onCreate(args); arguments=args; start(); }
  private AccessibilityNodeInfo find(AccessibilityNodeInfo node, String id) {
    if (node==null) return null;
    if (id.equals(node.getViewIdResourceName()) || id.contentEquals(node.getContentDescription()==null?"":node.getContentDescription())) return node;
    for(int i=0;i<node.getChildCount();i++) { AccessibilityNodeInfo result=find(node.getChild(i),id); if(result!=null)return result; }
    return null;
  }
  private void addRawNativeFields(JSONObject value,AccessibilityNodeInfo node) throws Exception {
    CharSequence roleDescription=node.getExtras().getCharSequence("AccessibilityNodeInfo.roleDescription");value.put("roleDescription",roleDescription==null?JSONObject.NULL:roleDescription.toString());
    value.put("contentDescription",node.getContentDescription()==null?JSONObject.NULL:node.getContentDescription().toString());
    value.put("stateDescription",android.os.Build.VERSION.SDK_INT>=30?(node.getStateDescription()==null?JSONObject.NULL:node.getStateDescription().toString()):JSONObject.NULL);
    value.put("className",node.getClassName()==null?JSONObject.NULL:node.getClassName().toString());value.put("visible",node.isVisibleToUser());value.put("selected",node.isSelected());value.put("scrollable",node.isScrollable());value.put("nativeUptimeMs",SystemClock.uptimeMillis());value.put("nativeEpochMs",System.currentTimeMillis());
    AccessibilityNodeInfo.RangeInfo range=node.getRangeInfo();
    if(range==null){value.put("rangeInfo",JSONObject.NULL);value.put("currentValue",JSONObject.NULL);}else{JSONObject info=new JSONObject();info.put("min",range.getMin());info.put("max",range.getMax());info.put("current",range.getCurrent());info.put("type",range.getType());value.put("rangeInfo",info);value.put("currentValue",range.getCurrent());}
  }

  private void snapshot(AccessibilityNodeInfo node, JSONArray nodes, int windowId) throws Exception {
    if(node==null)return;
    if(nodes.length()>=2000)throw new IllegalStateException("Native window snapshot exceeds2000 nodes");
    JSONObject row=new JSONObject();Rect frame=new Rect();node.getBoundsInScreen(frame);
    row.put("id",node.getViewIdResourceName());row.put("text",node.getText()==null?JSONObject.NULL:node.getText().toString());row.put("description",node.getContentDescription()==null?JSONObject.NULL:node.getContentDescription().toString());row.put("class",String.valueOf(node.getClassName()));row.put("bounds",frame.flattenToString());row.put("enabled",node.isEnabled());row.put("visible",node.isVisibleToUser());row.put("windowId",windowId);nodes.put(row);
    for(int index=0;index<node.getChildCount();index++)snapshot(node.getChild(index),nodes,windowId);
  }

  private boolean injectContact(UiAutomation automation, long downTime, int action, float x, float y) {
    MotionEvent.PointerProperties pointer=new MotionEvent.PointerProperties();pointer.id=0;pointer.toolType=MotionEvent.TOOL_TYPE_FINGER;
    MotionEvent.PointerCoords coordinates=new MotionEvent.PointerCoords();coordinates.x=x;coordinates.y=y;coordinates.pressure=action==MotionEvent.ACTION_DOWN?1f:0f;coordinates.size=1f;
    MotionEvent event=MotionEvent.obtain(downTime,SystemClock.uptimeMillis(),action,1,new MotionEvent.PointerProperties[]{pointer},new MotionEvent.PointerCoords[]{coordinates},0,0,1f,1f,0,0,InputDevice.SOURCE_TOUCHSCREEN,0);
    try {return automation.injectInputEvent(event,true);} finally {event.recycle();}
  }
  private void savePng(Bitmap bitmap, File path) throws Exception {
    if(bitmap==null)throw new IllegalStateException("Screenshot returned null");
    try(FileOutputStream stream=new FileOutputStream(path)) {
      if(!bitmap.compress(Bitmap.CompressFormat.PNG,100,stream))throw new IllegalStateException("PNG compression failed");
    }
  }
  private JSONObject rangeAfterImages(UiAutomation automation, String id, long started) throws Exception {
    AccessibilityNodeInfo node=find(automation.getRootInActiveWindow(),id);
    if(node==null)for(android.view.accessibility.AccessibilityWindowInfo window:automation.getWindows()) {node=find(window.getRoot(),id);if(node!=null)break;}
    if(node==null)throw new IllegalStateException("Missing retained target after images");
    node.refresh();JSONObject value=new JSONObject();Rect frame=new Rect();node.getBoundsInScreen(frame);
    value.put("elapsedMs",SystemClock.uptimeMillis()-started);value.put("id",id);value.put("text",String.valueOf(node.getText()));
    value.put("selectionStart",node.getTextSelectionStart());value.put("selectionEnd",node.getTextSelectionEnd());value.put("bounds",frame.flattenToString());
    JSONArray windows=new JSONArray();int roots=0;
    for(android.view.accessibility.AccessibilityWindowInfo window:automation.getWindows()) {AccessibilityNodeInfo root=window.getRoot();if(root!=null){roots++;snapshot(root,windows,window.getId());}}
    value.put("windowRoots",roots);value.put("windowNodes",windows);return value;
  }
  private JSONObject heldSelection(UiAutomation automation, AccessibilityNodeInfo node, String id) throws Exception {
    final long started=SystemClock.uptimeMillis();JSONObject receipt=new JSONObject();
    receipt.put("operation","held-selection");receipt.put("toolType",MotionEvent.TOOL_TYPE_FINGER);receipt.put("source",InputDevice.SOURCE_TOUCHSCREEN);receipt.put("pointerId",0);receipt.put("id",id);receipt.put("nativeActionSucceeded",false);
    if(!"text-g02-context-target".equals(id)||!"Choose a context item".contentEquals(node.getText()==null?"":node.getText()))throw new IllegalArgumentException("Unexpected diagnostic target/content");
    String supplied=arguments.getString("outputDir","");
    if(!"/sdcard/Android/data/dev.codonui.lab.number/files/held-selection-3".equals(supplied))throw new IllegalArgumentException("Fixed diagnostic output path required");
    File external=getContext().getExternalFilesDir(null);if(external==null)throw new IllegalStateException("App external files unavailable");
    File directory=new File(external,"held-selection-3").getCanonicalFile();
    if(!directory.equals(new File(supplied).getCanonicalFile()))throw new IllegalArgumentException("Output path does not identify app files");
    if(directory.exists())throw new IllegalStateException("Diagnostic output already exists; do not repeat");
    if(!directory.mkdirs())throw new IllegalStateException("Could not create diagnostic output");
    Rect frame=new Rect();node.getBoundsInScreen(frame);
    if(!node.isVisibleToUser()||frame.isEmpty()||frame.left<0||frame.top<0)throw new IllegalStateException("Target must have actual visible bounds");
    float x=frame.centerX(),y=frame.centerY();receipt.put("bounds",frame.flattenToString());receipt.put("x",x);receipt.put("y",y);receipt.put("outputDir",directory.toString());
    long downTime=SystemClock.uptimeMillis();boolean downAttempted=false,released=false;Bitmap held=null,after=null;
    try {
      downAttempted=true;receipt.put("downTimeUptimeMs",downTime);
      boolean accepted=injectContact(automation,downTime,MotionEvent.ACTION_DOWN,x,y);receipt.put("acceptedDown",accepted);
      if(!accepted)throw new IllegalStateException("DOWN was not accepted");
      SystemClock.sleep(1100);
      receipt.put("heldScreenshotStartedElapsedMs",SystemClock.uptimeMillis()-started);held=automation.takeScreenshot();receipt.put("heldScreenshotFinishedElapsedMs",SystemClock.uptimeMillis()-started);
      if(held==null)throw new IllegalStateException("Held screenshot returned null");
      receipt.put("upStartedElapsedMs",SystemClock.uptimeMillis()-started);released=injectContact(automation,downTime,MotionEvent.ACTION_UP,x,y);receipt.put("acceptedUp",released);
      if(!released)throw new IllegalStateException("UP was not accepted");
      receipt.put("releasedScreenshotStartedElapsedMs",SystemClock.uptimeMillis()-started);after=automation.takeScreenshot();receipt.put("releasedScreenshotFinishedElapsedMs",SystemClock.uptimeMillis()-started);
      if(after==null)throw new IllegalStateException("Released screenshot returned null");
    } catch(Throwable error) {receipt.put("error",error.toString());}
    finally {
      if(downAttempted&&!released) {
        try {boolean cancelled=injectContact(automation,downTime,MotionEvent.ACTION_CANCEL,x,y);receipt.put("finallyCancelAccepted",cancelled);released=cancelled;
          if(!released){released=injectContact(automation,downTime,MotionEvent.ACTION_UP,x,y);receipt.put("finallyUpAccepted",released);}
        } catch(Throwable cleanupError) {receipt.put("cleanupError",cleanupError.toString());}
      }
      receipt.put("contactReleased",released);
    }
    try {
      if(held!=null)savePng(held,new File(directory,"held.png"));
      if(after!=null)savePng(after,new File(directory,"released.png"));
      if(held!=null&&after!=null&&released&&!receipt.has("error")) {
        JSONArray queries=new JSONArray();queries.put(rangeAfterImages(automation,id,started));SystemClock.sleep(350);queries.put(rangeAfterImages(automation,id,started));receipt.put("afterImageQueries",queries);
        receipt.put("nativeActionSucceeded",true);
      }
    } catch(Throwable error) {receipt.put("error",error.toString());receipt.put("nativeActionSucceeded",false);}
    finally {if(held!=null)held.recycle();if(after!=null)after.recycle();receipt.put("elapsedMs",SystemClock.uptimeMillis()-started);}
    try(FileOutputStream stream=new FileOutputStream(new File(directory,"receipt.json"))) {stream.write(receipt.toString(2).getBytes(StandardCharsets.UTF_8));}
    return receipt;
  }


  private void rejectAnr(AccessibilityNodeInfo node, int[] count) {
    if(node==null)return;if(++count[0]>2000)throw new IllegalStateException("Setup AX tree exceeds2000 nodes");
    if(node.getText()!=null&&node.getText().toString().contains("isn't responding"))throw new IllegalStateException("ANR during diagnostic setup; no dismissal");
    for(int i=0;i<node.getChildCount();i++)rejectAnr(node.getChild(i),count);
  }
  private AccessibilityNodeInfo fresh(UiAutomation automation, String id) {
    AccessibilityNodeInfo root=automation.getRootInActiveWindow();rejectAnr(root,new int[]{0});AccessibilityNodeInfo node=find(root,id);if(node!=null)return node;
    for(android.view.accessibility.AccessibilityWindowInfo window:automation.getWindows()) {root=window.getRoot();rejectAnr(root,new int[]{0});node=find(root,id);if(node!=null)return node;}
    return null;
  }
  private void setupBound(long deadline) {if(SystemClock.uptimeMillis()>=deadline)throw new IllegalStateException("30s setup deadline exhausted before DOWN");}
  private boolean whollyVisible(AccessibilityNodeInfo node, AccessibilityNodeInfo scroll) {
    if(node==null||scroll==null||!node.isVisibleToUser())return false;Rect frame=new Rect(),viewport=new Rect();node.getBoundsInScreen(frame);scroll.getBoundsInScreen(viewport);
    return !frame.isEmpty()&&!viewport.isEmpty()&&frame.top>=viewport.top+2&&frame.bottom<=viewport.bottom-2&&frame.left>=viewport.left&&frame.right<=viewport.right;
  }
  private AccessibilityNodeInfo seekVisible(UiAutomation automation, String id, long deadline, int[] scrolls, JSONArray steps) throws Exception {
    while(true) {
      setupBound(deadline);AccessibilityNodeInfo node=fresh(automation,id),scroll=fresh(automation,"showcase-scroll");
      Rect viewport=new Rect();if(scroll==null||!scroll.isVisibleToUser()||!scroll.isEnabled())throw new IllegalStateException("Actual visible enabled showcase-scroll required");scroll.getBoundsInScreen(viewport);if(viewport.isEmpty())throw new IllegalStateException("Actual scroll viewport must be nonempty");
      if(whollyVisible(node,scroll))return node;
      if(!scroll.isScrollable()||scrolls[0]>=20)throw new IllegalStateException("Cannot reach actual visible setup node within20 forward scrolls: "+id);
      boolean result=scroll.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);scrolls[0]++;
      JSONObject step=new JSONObject();step.put("action","ACTION_SCROLL_FORWARD");step.put("scrollId","showcase-scroll");step.put("seeking",id);step.put("accepted",result);step.put("sequence",scrolls[0]);steps.put(step);
      if(!result)throw new IllegalStateException("Actual showcase-scroll rejected forward scroll before reaching "+id);
      SystemClock.sleep(150);
    }
  }
  private void clickSetup(UiAutomation automation, String label, long deadline, int[] scrolls, JSONArray steps) throws Exception {
    AccessibilityNodeInfo control=seekVisible(automation,label,deadline,scrolls,steps);setupBound(deadline);
    if(!control.isEnabled()||!label.contentEquals(control.getContentDescription()==null?"":control.getContentDescription()))throw new IllegalStateException("Unexpected fixture setup control "+label);
    boolean accepted=control.performAction(AccessibilityNodeInfo.ACTION_CLICK);JSONObject row=new JSONObject();row.put("action","ACTION_CLICK");row.put("label",label);row.put("accepted",accepted);steps.put(row);
    if(!accepted)throw new IllegalStateException("Fixture control rejected ACTION_CLICK: "+label);SystemClock.sleep(200);
  }
  private JSONObject contextState(UiAutomation automation) throws Exception {
    AccessibilityNodeInfo readout=fresh(automation,"text-g02-context-state"),scroll=fresh(automation,"showcase-scroll");
    if(readout==null||scroll==null||!readout.refresh()||!scroll.refresh())throw new IllegalStateException("Actual marker and scroll refresh required; no stale fallback");
    if(!whollyVisible(readout,scroll)||readout.getContentDescription()==null)throw new IllegalStateException("Actual context JSON readout must remain visible after refreshed seek admission");
    JSONObject state=new JSONObject(readout.getContentDescription().toString());JSONArray events=state.getJSONArray("receipts");
    if(state.getInt("parentOrdinary")!=events.length())throw new IllegalStateException("Parent receipt count mismatch");return state;
  }
  private int callerActions(AccessibilityNodeInfo originalOwner) {
    if(originalOwner==null||!originalOwner.refresh())throw new IllegalStateException("Original library action owner refresh failed; no stale fallback");
    AccessibilityNodeInfo owner=originalOwner;if(!"library-state".equals(owner.getViewIdResourceName())||owner.getText()==null)throw new IllegalStateException("Original library action owner identity/text unavailable after refresh");
    java.util.regex.Matcher match=java.util.regex.Pattern.compile("Library action count: (\\d+)").matcher(owner.getText());
    if(!match.find())throw new IllegalStateException("Unrecognized library action readout: "+owner.getText());return Integer.parseInt(match.group(1));
  }
  private void sameBinding(JSONObject initial, JSONObject current) throws Exception {
    for(String key:new String[]{"rootTag","refIdentity","attaches","detaches"})if(initial.getLong(key)!=current.getLong(key))throw new IllegalStateException("Original Text binding changed during setup: "+key);
    if(!initial.getJSONArray("receipts").toString().equals(current.getJSONArray("receipts").toString())||initial.getInt("parentOrdinary")!=current.getInt("parentOrdinary"))throw new IllegalStateException("Programmatic setup fabricated a parent ordinary action");
  }
  private AccessibilityNodeInfo prepareContext(UiAutomation automation, JSONObject trace) throws Exception {
    long start=SystemClock.uptimeMillis(),deadline=start+30000;int[] scrolls={0};JSONArray steps=new JSONArray();trace.put("steps",steps);trace.put("setupLimitMs",30000);trace.put("scrollLimit",20);
    AccessibilityNodeInfo originalCaller=seekVisible(automation,"library-state",deadline,scrolls,steps);
    int callerBefore=callerActions(originalCaller);trace.put("callerActionsBefore",callerBefore);trace.put("callerNodeInitiallyVisible",true);
    if(callerBefore!=0)throw new IllegalStateException("Fresh diagnostic setup requires zero actual library actions");
    clickSetup(automation,"G02 prepare Text button context",deadline,scrolls,steps);
    seekVisible(automation,"text-g02-context-state",deadline,scrolls,steps);JSONObject initial=contextState(automation);while(initial.optLong("rootTag",0)<=0||initial.optLong("refIdentity",0)<=0){setupBound(deadline);SystemClock.sleep(50);initial=contextState(automation);}trace.put("initialState",initial);
    if(!"default".equals(initial.getString("policy"))||initial.getLong("rootTag")<=0||initial.getLong("refIdentity")<=0||initial.getInt("parentOrdinary")!=0||initial.getJSONArray("receipts").length()!=0)throw new IllegalStateException("Expected fresh actual default-policy Text and quiet parent");
    clickSetup(automation,"G02 enable Text context selection",deadline,scrolls,steps);
    seekVisible(automation,"text-g02-context-state",deadline,scrolls,steps);JSONObject enabled=contextState(automation);while(!"explicit-true".equals(enabled.optString("policy"))){sameBinding(initial,enabled);setupBound(deadline);SystemClock.sleep(50);enabled=contextState(automation);}trace.put("enabledState",enabled);
    if(!"explicit-true".equals(enabled.getString("policy")))throw new IllegalStateException("Explicit true policy not observed");sameBinding(initial,enabled);
    setupBound(deadline);SystemClock.sleep(500);setupBound(deadline);JSONObject quiet=contextState(automation);sameBinding(initial,quiet);
    int callerAfter=callerActions(originalCaller);trace.put("callerActionsAfter",callerAfter);trace.put("originalCallerRefreshAfterControls",true);
    if(!"explicit-true".equals(quiet.getString("policy"))||callerAfter!=callerBefore)throw new IllegalStateException("Setup was not quiet");
    AccessibilityNodeInfo scroll=fresh(automation,"showcase-scroll"),owner=fresh(automation,"text-g02-context-owner"),target=fresh(automation,"text-g02-context-target"),readout=fresh(automation,"text-g02-context-state");
    if(!whollyVisible(owner,scroll)||!whollyVisible(target,scroll)||!whollyVisible(readout,scroll))throw new IllegalStateException("Actual owner, original Text and JSON readout must be jointly visible before DOWN");
    Rect outer=new Rect(),inner=new Rect();owner.getBoundsInScreen(outer);target.getBoundsInScreen(inner);
    if(!outer.contains(inner)||!"Choose a context item".contentEquals(target.getText()==null?"":target.getText()))throw new IllegalStateException("Unexpected actual child bounds/content");
    AccessibilityNodeInfo actualChild=find(owner,"text-g02-context-target");if(actualChild==null||!actualChild.equals(target))throw new IllegalStateException("Target is not actual public Button's Text child");
    setupBound(deadline);trace.put("quietState",quiet);trace.put("callerActionsAfter",callerAfter);trace.put("ownerBounds",outer.flattenToString());trace.put("targetBounds",inner.flattenToString());trace.put("scrolls",scrolls[0]);trace.put("setupElapsedMs",SystemClock.uptimeMillis()-start);trace.put("inputBeforeHeldSelection","Only standard scroll/control click accessibility actions; no target contact");return target;
  }

  private void matchedRequire(boolean condition,String message) {if(!condition)throw new IllegalStateException(message);}
  private void writeJson(File directory,String name,JSONObject value) throws Exception {
    try(FileOutputStream stream=new FileOutputStream(new File(directory,name))) {stream.write(value.toString(2).getBytes(StandardCharsets.UTF_8));}
  }
  private void matchedBound(long deadline) {matchedRequire(SystemClock.uptimeMillis()<deadline,"Admitted native work deadline exhausted");}
  private void physicalSwipe(UiAutomation automation,Rect bounds,int duration,long deadline,JSONArray inputs,String label) throws Exception {
    matchedBound(deadline);matchedRequire(!bounds.isEmpty()&&bounds.left>=0&&bounds.top>=0&&(duration==200||duration==1000||duration==3000),"Validated numeric actual input bounds/duration required");
    Bitmap screen=automation.takeScreenshot();matchedRequire(screen!=null,"Actual screen size required before physical input");
    try {matchedRequire(bounds.right<=screen.getWidth()&&bounds.bottom<=screen.getHeight()&&screen.getHeight()>screen.getWidth(),"Actual input bounds must be on portrait screen");}finally{screen.recycle();}
    int x=bounds.centerX(),y=bounds.centerY();String gesture=duration==1000?"draganddrop":"swipe";String command="input touchscreen "+gesture+" "+x+" "+y+" "+x+" "+y+" "+duration;
    JSONObject row=new JSONObject();row.put("label",label);row.put("command",command);row.put("startedUptimeMs",SystemClock.uptimeMillis());row.put("bounds",bounds.flattenToString());row.put("transport","UiAutomation.executeShellCommandRw(sh),same connection");inputs.put(row);
    android.os.ParcelFileDescriptor[] pipes=automation.executeShellCommandRw("sh");
    String script=command+" 2>&1\nstatus=$?\nprintf '\\nCODON_INPUT_EXIT=%s\\n' \"$status\"\nexit \"$status\"\n";
    try {
      try(android.os.ParcelFileDescriptor.AutoCloseOutputStream stdin=new android.os.ParcelFileDescriptor.AutoCloseOutputStream(pipes[1])) {stdin.write(script.getBytes(StandardCharsets.UTF_8));stdin.flush();}
      long until=deadline;java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();boolean complete=false;
      try(android.os.ParcelFileDescriptor.AutoCloseInputStream stdout=new android.os.ParcelFileDescriptor.AutoCloseInputStream(pipes[0])) {
        byte[] buffer=new byte[1024];
        while(SystemClock.uptimeMillis()<until) {
          int available=stdout.available();
          if(available>0) {int size=stdout.read(buffer,0,Math.min(buffer.length,available));if(size<0)break;bytes.write(buffer,0,size);matchedRequire(bytes.size()<=65536,"Unexpected shell output size");}
          String value=new String(bytes.toByteArray(),StandardCharsets.UTF_8);
          java.util.regex.Matcher marker=java.util.regex.Pattern.compile("(?:^|\\n)CODON_INPUT_EXIT=([0-9]+)\\r?\\n").matcher(value);
          if(marker.find()) {int exit=Integer.parseInt(marker.group(1));row.put("output",value);row.put("exitCode",exit);complete=true;matchedRequire(exit==0,"Physical input command failed: "+command);break;}
          SystemClock.sleep(10);
        }
        if(!complete)row.put("output",new String(bytes.toByteArray(),StandardCharsets.UTF_8));matchedRequire(complete,"Physical input exit marker not observed before the admitted work deadline; outcome uncertain");
      }
    } finally {for(android.os.ParcelFileDescriptor pipe:pipes)try{pipe.close();}catch(java.io.IOException ignored){}row.put("finishedUptimeMs",SystemClock.uptimeMillis());row.put("commandElapsedMs",row.getLong("finishedUptimeMs")-row.getLong("startedUptimeMs"));}
  }
  private void physicalControl(UiAutomation automation,String label,long deadline,int[] scrolls,JSONArray steps) throws Exception {
    AccessibilityNodeInfo node=seekVisible(automation,label,deadline,scrolls,steps);matchedRequire(node.isEnabled()&&label.contentEquals(node.getContentDescription()==null?"":node.getContentDescription()),"Actual enabled fixture control required");
    Rect frame=new Rect();node.getBoundsInScreen(frame);physicalSwipe(automation,frame,200,deadline,steps,label);
  }
  private int contextTargetCount(AccessibilityNodeInfo node) {
    if(node==null)return 0;int count="text-g02-context-target".equals(node.getViewIdResourceName())?1:0;
    for(int i=0;i<node.getChildCount();i++)count+=contextTargetCount(node.getChild(i));return count;
  }
  private AccessibilityNodeInfo actualContextTarget(UiAutomation automation) throws Exception {return actualContextTarget(automation,null);}
  private AccessibilityNodeInfo actualContextTarget(UiAutomation automation,JSONObject evidence) throws Exception {
    AccessibilityNodeInfo scroll=fresh(automation,"showcase-scroll"),owner=fresh(automation,"text-g02-context-owner"),target=fresh(automation,"text-g02-context-target"),readout=fresh(automation,"text-g02-context-state");
    matchedRequire(whollyVisible(owner,scroll)&&whollyVisible(target,scroll)&&whollyVisible(readout,scroll),"Actual owner/Text/readout must be jointly visible");
    Rect outer=new Rect(),inner=new Rect();owner.getBoundsInScreen(outer);target.getBoundsInScreen(inner);matchedRequire(outer.contains(inner)&&"Choose a context item".contentEquals(target.getText()==null?"":target.getText()),"Actual original Text child/content required");
    int matches=contextTargetCount(owner);if(evidence!=null)evidence.put("targetMatchCount",matches);matchedRequire(matches==1,"Exactly one matching original Text target under actual public Button required");
    AccessibilityNodeInfo child=find(owner,"text-g02-context-target");matchedRequire(child!=null&&child.equals(target),"Original target must be actual public Button child");return target;
  }
  private void retainedContext(JSONObject original,JSONObject current,AccessibilityNodeInfo caller,int callerBase) throws Exception {
    for(String key:new String[]{"rootTag","refIdentity","attaches","detaches"})matchedRequire(original.getLong(key)==current.getLong(key),"Original Text binding changed: "+key);
    JSONArray events=current.getJSONArray("receipts");matchedRequire(events.length()==current.getInt("parentOrdinary"),"Parent count and event ledger differ");
    for(int i=0;i<events.length();i++){JSONObject event=events.getJSONObject(i);matchedRequire(event.getInt("sequence")==i+1&&"parentPress".equals(event.getString("kind"))&&event.getLong("rootTag")==original.getLong("rootTag")&&event.getLong("refIdentity")==original.getLong("refIdentity"),"Invalid original parent event trace");}
    matchedRequire(callerActions(caller)==callerBase+current.getInt("parentOrdinary")-original.getInt("parentOrdinary"),"Business counter differs from all parent delivery");
  }
  private JSONObject expectedPolicy(UiAutomation automation,String policy,long deadline,JSONObject transition,String phase) throws Exception {
    long started=SystemClock.uptimeMillis(),until=deadline;JSONObject observation=new JSONObject();observation.put("expectedPolicy",policy);observation.put("deadlineUptimeMs",until);observation.put("markerAndScrollRefreshRequired",true);transition.put(phase,observation);int queries=0;
    try {
      while(true){matchedBound(deadline);JSONObject state=contextState(automation);queries++;if(queries==1)observation.put("firstRefreshedPolicyJSON",state);observation.put("lastRefreshedPolicyJSON",state);long now=SystemClock.uptimeMillis();observation.put("elapsedMs",now-started);observation.put("queries",queries);
        if(now>=until)throw new IllegalStateException("Refreshed policy acknowledgment exceeded10s: "+policy);
        if(policy.equals(state.optString("policy")))return state;SystemClock.sleep(Math.min(50,until-now));
      }
    } catch(Exception error){observation.put("error",error.toString());throw error;}
    finally{observation.put("elapsedMs",SystemClock.uptimeMillis()-started);observation.put("queries",queries);}
  }
  private String nativeString(JSONObject row,String key) throws Exception {return row.isNull(key)?"":row.optString(key,"");}
  private JSONObject exactCopy(JSONObject nativeWindows) throws Exception {
    JSONArray rows=nativeWindows.getJSONArray("windowNodes");java.util.ArrayList<JSONObject> candidates=new java.util.ArrayList<>();
    matchedRequire(nativeWindows.getInt("windowRoots")>0&&rows.length()>0,"Actual native window roots required");
    for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(row.getBoolean("visible")&&"android:id/copy".equals(nativeString(row,"id")))candidates.add(row);}
    if(candidates.isEmpty())for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);String text=nativeString(row,"text"),description=nativeString(row,"description");if(row.getBoolean("visible")&&"copy".equalsIgnoreCase(text.isEmpty()?description:text))candidates.add(row);}
    if(candidates.size()==2){JSONObject title=null,container=null;int titles=0,containers=0;
      for(JSONObject row:candidates){String text=nativeString(row,"text"),description=nativeString(row,"description");if("android:id/floating_toolbar_menu_item_text".equals(nativeString(row,"id"))&&"copy".equalsIgnoreCase(text)){title=row;titles++;}if(text.isEmpty()&&"copy".equalsIgnoreCase(description)){container=row;containers++;}}
      if(titles==1&&containers==1){Rect inner=Rect.unflattenFromString(title.getString("bounds")),outer=Rect.unflattenFromString(container.getString("bounds"));matchedRequire(inner!=null&&outer!=null&&!inner.isEmpty()&&!outer.isEmpty(),"Actual Copy bounds required");if(title.getInt("windowId")==container.getInt("windowId")&&outer.contains(inner)){candidates.clear();candidates.add(title);}}
    }
    matchedRequire(candidates.size()<=1,"Ambiguous native Copy action");return candidates.isEmpty()?null:candidates.get(0);
  }
  private JSONObject matchedNative(UiAutomation automation,long started) throws Exception {
    JSONObject nativeState=rangeAfterImages(automation,"text-g02-context-target",started);AccessibilityNodeInfo target=fresh(automation,"text-g02-context-target");matchedRequire(target!=null&&target.refresh(),"Actual target refresh required");nativeState.put("editable",target.isEditable());nativeState.put("enabled",target.isEnabled());
    matchedRequire("Choose a context item".equals(nativeState.getString("text"))&&!nativeState.getBoolean("editable"),"Original passive noneditor Text content required");return nativeState;
  }
  private void matchedImage(UiAutomation automation,File directory,String name) throws Exception {
    Bitmap image=automation.takeScreenshot();matchedRequire(image!=null,"Actual screenshot unavailable");try{matchedRequire(image.getHeight()>image.getWidth(),"Actual portrait screenshot required");savePng(image,new File(directory,name));}finally{image.recycle();}
  }
  private void matchedHold(UiAutomation automation,String name,String policy,boolean selection,JSONObject original,AccessibilityNodeInfo caller,int callerBase,long deadline,long started,File directory,JSONArray cases,JSONArray inputs) throws Exception {
    matchedBound(deadline);JSONObject row=new JSONObject();row.put("name",name);row.put("expectedPolicy",policy);row.put("expectedSelection",selection);cases.put(row);
    AccessibilityNodeInfo target=actualContextTarget(automation,row);JSONObject before=contextState(automation);row.put("before",before);matchedRequire(policy.equals(before.getString("policy")),"Unexpected prehold policy");retainedContext(original,before,caller,callerBase);
    Rect frame=new Rect();target.getBoundsInScreen(frame);row.put("targetBounds",frame.flattenToString());physicalSwipe(automation,frame,1000,deadline,inputs,name+" hold");
    matchedImage(automation,directory,name+"-menu.png");SystemClock.sleep(350);JSONObject first=matchedNative(automation,started);row.put("firstNative",first);writeJson(directory,name+"-native-1.json",first);
    matchedImage(automation,directory,name+"-range.png");SystemClock.sleep(350);JSONObject second=matchedNative(automation,started);row.put("secondNative",second);writeJson(directory,name+"-native-2.json",second);
    JSONArray parentTimestamps=new JSONArray();boolean parentReadoutFound=false;JSONArray observedNodes=second.getJSONArray("windowNodes");
    for(int i=0;i<observedNodes.length();i++){JSONObject observedNode=observedNodes.getJSONObject(i);if("text-g02-context-state".equals(observedNode.optString("id"))&&!observedNode.isNull("description")){JSONObject observedState=new JSONObject(observedNode.getString("description"));JSONArray events=observedState.getJSONArray("receipts");for(int j=before.getInt("parentOrdinary");j<events.length();j++){JSONObject event=events.getJSONObject(j),stamp=new JSONObject();stamp.put("sequence",event.getInt("sequence"));stamp.put("policy",event.getString("policy"));stamp.put("parentNativeEventTimestamp",event.getJSONObject("native").opt("timestamp"));parentTimestamps.put(stamp);}parentReadoutFound=true;break;}}
    row.put("parentReadoutPresentInSecondSnapshot",parentReadoutFound);row.put("parentNativeEventTimestampsFromSecondSnapshot",parentTimestamps);row.put("timestampMeaning","Recorded parent onPress native event timestamp; no separate child ACTION_UP observer added");
    JSONObject firstCopy=exactCopy(first),secondCopy=exactCopy(second);row.put("firstCopy",firstCopy==null?JSONObject.NULL:firstCopy);row.put("secondCopy",secondCopy==null?JSONObject.NULL:secondCopy);
    for(JSONObject state:new JSONObject[]{first,second}){int start=state.getInt("selectionStart"),end=state.getInt("selectionEnd");if(selection)matchedRequire(start>=0&&start<end&&end<="Choose a context item".length(),"Expected genuine nonempty selection");else matchedRequire(start<0||end<=start,"Default context selection must remain suppressed/collapsed");}
    matchedRequire((firstCopy!=null)==selection&&(secondCopy!=null)==selection,"Copy visibility does not match explicit/default selection policy");
    JSONObject after=contextState(automation);row.put("afterHold",after);retainedContext(original,after,caller,callerBase);int delta=after.getInt("parentOrdinary")-before.getInt("parentOrdinary");matchedRequire(delta>=0&&delta<=1,"Real hold delivered more than one parent ordinary action");
    if(selection){matchedRequire(secondCopy.getBoolean("enabled"),"Actual Copy action is disabled");Rect copyFrame=Rect.unflattenFromString(secondCopy.getString("bounds"));matchedRequire(copyFrame!=null&&!copyFrame.isEmpty(),"Actual Copy bounds required");physicalSwipe(automation,copyFrame,200,deadline,inputs,name+" Copy");matchedImage(automation,directory,name+"-copy.png");JSONObject copied=contextState(automation);row.put("afterCopy",copied);sameBinding(after,copied);retainedContext(original,copied,caller,callerBase);}
    SystemClock.sleep(750);matchedBound(deadline);JSONObject quiet=contextState(automation);row.put("quiet750ms",quiet);retainedContext(original,quiet,caller,callerBase);delta=quiet.getInt("parentOrdinary")-before.getInt("parentOrdinary");matchedRequire(delta>=0&&delta<=1,"Delayed hold delivered more than one parent ordinary action");row.put("status","SCOPED_ASSERTIONS_PASSED");
  }
  private void matchedPolicy(UiAutomation automation,String label,String policy,JSONObject original,AccessibilityNodeInfo caller,int callerBase,long deadline,int[] scrolls,JSONArray inputs,JSONArray transitions,File directory) throws Exception {
    JSONObject row=new JSONObject();row.put("policy",policy);transitions.put(row);JSONObject before=contextState(automation);row.put("before",before);clickSetup(automation,label,deadline,scrolls,inputs);matchedImage(automation,directory,"policy-"+policy+"-control.png");seekVisible(automation,"text-g02-context-state",deadline,scrolls,inputs);JSONObject current=expectedPolicy(automation,policy,deadline,row,"acknowledgmentObservation");row.put("acknowledged",current);sameBinding(before,current);retainedContext(original,current,caller,callerBase);
    SystemClock.sleep(750);matchedBound(deadline);JSONObject quiet=expectedPolicy(automation,policy,deadline,row,"quietObservation");row.put("quiet750ms",quiet);sameBinding(before,quiet);retainedContext(original,quiet,caller,callerBase);
  }
  private JSONObject matchedTextS03(UiAutomation automation) throws Exception {
    long started=SystemClock.uptimeMillis(),deadline=started+120000,setupDeadline=started+30000;JSONObject result=new JSONObject();JSONArray inputs=new JSONArray(),cases=new JSONArray(),transitions=new JSONArray();int[] scrolls={0};result.put("operation","matched-text-s03");result.put("nativeActionSucceeded",false);result.put("inputs",inputs);result.put("cases",cases);result.put("transitions",transitions);result.put("holdDurationMs",1000);result.put("copyDurationMs",200);result.put("fixtureControlAction","ACTION_CLICK");result.put("quietDurationMs",750);result.put("diagnosticOnly",true);result.put("longPressTimeoutMs",android.view.ViewConfiguration.getLongPressTimeout());result.put("holdGesture","draganddrop");result.put("copyGesture","swipe");result.put("holdDurationArgumentMs",1000);result.put("durationSemantics","Android16 captures down before its longPressTimeout pause and sets endTime=down+duration:1000 includes the pause, not1000 additional movement; dispatch/runtime overhead can extend wall time");
    String supplied=arguments.getString("outputDir","");matchedRequire("/sdcard/Android/data/dev.codonui.lab.number/files/held-selection-7".equals(supplied),"Fixed fresh output7 required");File external=getContext().getExternalFilesDir(null);matchedRequire(external!=null,"App-specific external files unavailable");File directory=new File(external,"held-selection-7").getCanonicalFile();matchedRequire(directory.equals(new File(supplied).getCanonicalFile())&&!directory.exists()&&directory.mkdirs(),"Fresh actual app output7 directory required");result.put("outputDir",directory.toString());
    try {
      AccessibilityNodeInfo caller=seekVisible(automation,"library-state",setupDeadline,scrolls,inputs);int callerBase=callerActions(caller);matchedRequire(callerBase==0,"Fresh actual caller counter must be zero");result.put("callerActionsBefore",callerBase);
      clickSetup(automation,"G02 prepare Text button context",setupDeadline,scrolls,inputs);matchedImage(automation,directory,"prepare-default-control.png");seekVisible(automation,"text-g02-context-state",setupDeadline,scrolls,inputs);JSONObject initial=contextState(automation);while(initial.optLong("rootTag",0)<=0||initial.optLong("refIdentity",0)<=0){setupBound(setupDeadline);SystemClock.sleep(50);initial=contextState(automation);}result.put("initial",initial);matchedRequire("default".equals(initial.getString("policy"))&&initial.getInt("parentOrdinary")==0&&initial.getJSONArray("receipts").length()==0,"Fresh default Text/quiet parent required");
      SystemClock.sleep(750);setupBound(setupDeadline);JSONObject quiet=contextState(automation);sameBinding(initial,quiet);retainedContext(initial,quiet,caller,callerBase);actualContextTarget(automation);result.put("setupElapsedMs",SystemClock.uptimeMillis()-started);result.put("setupScrolls",scrolls[0]);
      matchedHold(automation,"initial-default","default",false,initial,caller,callerBase,deadline,started,directory,cases,inputs);
      matchedPolicy(automation,"G02 enable Text context selection","explicit-true",initial,caller,callerBase,deadline,scrolls,inputs,transitions,directory);
      matchedHold(automation,"explicit-true","explicit-true",true,initial,caller,callerBase,deadline,started,directory,cases,inputs);
      matchedPolicy(automation,"G02 default Text context selection","default",initial,caller,callerBase,deadline,scrolls,inputs,transitions,directory);
      matchedHold(automation,"restored-default","default",false,initial,caller,callerBase,deadline,started,directory,cases,inputs);
      result.put("final",contextState(automation));result.put("callerActionsAfter",callerActions(caller));result.put("nativeActionSucceeded",true);result.put("status","MATCHED_S03_SCOPED_ASSERTIONS_PASSED");
    } catch(Throwable error){result.put("error",error.toString());result.put("status","FAILED_STOP_FIRST_ASSERTION");try{matchedImage(automation,directory,"failure.png");result.put("failureScreenshot","failure.png");}catch(Throwable captureError){result.put("failureScreenshotError",captureError.toString());}}
    finally{result.put("elapsedMs",SystemClock.uptimeMillis()-started);result.put("scrolls",scrolls[0]);writeJson(directory,"receipt.json",result);}
    return result;
  }

  private File lpDirectory;
  private JSONObject lpCase;
  private JSONArray lpLastReceipts=new JSONArray();
  private int lpMethodBaseline;
  private long lpDeadline,lpBatchDeadline;
  private static final String LP_TARGET="linear-progress-g02-target",LP_STATE="linear-progress-g02-state",LP_NAME="G02 linear progress";
  private String lpTarget=LP_TARGET,lpState=LP_STATE,lpName=LP_NAME,lpPrepareLabel="G02 prepare LinearProgress";
  private boolean lpMeterFixture=false;
  private String lpFixtureControl(String label){return lpMeterFixture&&label.startsWith("G02 LP ")?"G02 MT "+label.substring(7):label;}

  private void lpCheck(boolean condition,String message){if(!condition)throw new AssertionError(message);}
  private void lpBound(){if(SystemClock.uptimeMillis()>=lpDeadline)throw new IllegalStateException("Admitted overall work deadline exhausted");}
  private void lpSleep(long milliseconds){lpBound();SystemClock.sleep(milliseconds);lpBound();}
  private boolean lpEqual(Object a,Object b) throws Exception {
    if(a==null||a==JSONObject.NULL)return b==null||b==JSONObject.NULL;
    if(a instanceof JSONObject&&b instanceof JSONObject){JSONObject x=(JSONObject)a,y=(JSONObject)b;if(x.length()!=y.length())return false;java.util.Iterator<String> keys=x.keys();while(keys.hasNext()){String k=keys.next();if(!y.has(k)||!lpEqual(x.get(k),y.get(k)))return false;}return true;}
    if(a instanceof JSONArray&&b instanceof JSONArray){JSONArray x=(JSONArray)a,y=(JSONArray)b;if(x.length()!=y.length())return false;for(int i=0;i<x.length();i++)if(!lpEqual(x.get(i),y.get(i)))return false;return true;}
    if(a instanceof Number&&b instanceof Number)return Double.compare(((Number)a).doubleValue(),((Number)b).doubleValue())==0;
    return a.equals(b);
  }
  private JSONObject lpStates() throws Exception{return lpCase.getJSONObject("states");}
  private JSONArray lpActions() throws Exception{return lpCase.getJSONArray("actions");}
  private void lpPrefix(JSONObject state) throws Exception {
    JSONArray rows=state.getJSONArray("receipts");
    if(state.getInt("dropped")!=0||rows.length()<lpLastReceipts.length())throw new IllegalStateException("LinearProgress cumulative fixture evidence dropped/cleared");
    for(int i=0;i<rows.length();i++){if(rows.getJSONObject(i).getInt("sequence")!=i+1)throw new IllegalStateException("LinearProgress receipt sequence corrupted");if(i<lpLastReceipts.length()&&!lpEqual(rows.get(i),lpLastReceipts.get(i)))throw new IllegalStateException("LinearProgress prior cumulative evidence changed");}
    lpLastReceipts=rows;
  }
  private AccessibilityNodeInfo lpVisible(UiAutomation automation,String id) throws Exception {
    requireFixtureNavigation();
    for(int attempt=0;attempt<24;attempt++){
      lpBound();AccessibilityNodeInfo node=fresh(automation,id),scroll=fresh(automation,"showcase-scroll");
      if(scroll==null||!scroll.refresh()||!scroll.isVisibleToUser()||!scroll.isEnabled())throw new IllegalStateException("Actual responsive LinearProgress scroll host required");
      if(node!=null&&!node.refresh())node=null;
      if(whollyVisible(node,scroll))return node;
      Rect viewport=new Rect(),frame=new Rect();scroll.getBoundsInScreen(viewport);if(viewport.isEmpty())throw new IllegalStateException("Actual nonempty viewport required");if(node!=null)node.getBoundsInScreen(frame);
      int action=node!=null&&frame.top<viewport.top+2?AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD:AccessibilityNodeInfo.ACTION_SCROLL_FORWARD;
      boolean accepted=scroll.performAction(action);JSONObject row=new JSONObject();row.put("action",action==AccessibilityNodeInfo.ACTION_SCROLL_FORWARD?"ACTION_SCROLL_FORWARD":"ACTION_SCROLL_BACKWARD");row.put("seeking",id);row.put("accepted",accepted);row.put("nativeEpochMs",System.currentTimeMillis());lpActions().put(row);
      if(!accepted)throw new IllegalStateException("Actual scroll rejected navigation to "+id);lpSleep(150);
    }
    throw new IllegalStateException("LinearProgress actual visible node not reached within24 scrolls: "+id);
  }
  private void lpClick(UiAutomation automation,String label) throws Exception {
    requireFixtureNavigation();
    label=lpFixtureControl(label);
    AccessibilityNodeInfo control=lpVisible(automation,label);if(!control.isEnabled()||!label.contentEquals(control.getContentDescription()==null?"":control.getContentDescription()))throw new IllegalStateException("Actual named fixture control required: "+label);
    boolean accepted=control.performAction(AccessibilityNodeInfo.ACTION_CLICK);JSONObject row=new JSONObject();row.put("action","ACTION_CLICK");row.put("label",label);row.put("accepted",accepted);row.put("nativeEpochMs",System.currentTimeMillis());lpActions().put(row);
    if(!accepted)throw new IllegalStateException("Fixture ACTION_CLICK rejected: "+label);lpSleep(200);
  }
  private JSONObject lpRawState(UiAutomation automation) throws Exception {
    lpBound();AccessibilityNodeInfo marker=fresh(automation,lpState);if(marker==null||!marker.refresh()||marker.getContentDescription()==null)throw new IllegalStateException("Fresh actual LinearProgress JSON marker required");
    JSONObject state=new JSONObject(marker.getContentDescription().toString());lpPrefix(state);return state;
  }
  private JSONObject lpRead(UiAutomation automation) throws Exception {
    JSONObject state=lpRawState(automation);JSONArray rows=state.getJSONArray("receipts");
    for(int i=lpMethodBaseline;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);String kind=row.getString("kind");if(kind.equals("layout")||kind.startsWith("touch")){lpCheck(!row.getBoolean("afterDetach")&&!row.isNull("rootTag")&&lpEqual(row.getJSONObject("data").get("currentTarget"),row.get("rootTag")),"Native delivery attributed to missing/retired/wrong root");}}
    return state;
  }
  private JSONArray lpDelta(JSONObject before,JSONObject after,String... kinds) throws Exception {
    JSONArray out=new JSONArray(),a=before.getJSONArray("receipts"),b=after.getJSONArray("receipts");lpCheck(b.length()>=a.length(),"Cumulative receipts shrank");for(int i=0;i<a.length();i++)lpCheck(lpEqual(a.get(i),b.get(i)),"Prior receipt changed");
    for(int i=a.length();i<b.length();i++){JSONObject row=b.getJSONObject(i);if(kinds.length==0||java.util.Arrays.asList(kinds).contains(row.getString("kind")))out.put(row);}return out;
  }
  private void lpRetained(JSONObject original,JSONObject current) throws Exception {
    lpCheck(current.getBoolean("visible")&&!current.isNull("rootTag")&&current.getLong("rootTag")>0&&!current.isNull("refIdentity")&&current.getLong("refIdentity")>0,"Original public root must remain present");
    for(String key:new String[]{"rootTag","refIdentity","attaches","detaches"})lpCheck(lpEqual(original.get(key),current.get(key)),"Original LinearProgress binding changed: "+key);
  }
  private JSONObject lpAck(UiAutomation automation,String field,Object expected,String label) throws Exception {
    long started=SystemClock.uptimeMillis(),until=lpDeadline;JSONObject first=null,last=null,trace=new JSONObject();trace.put("label",label);trace.put("field",field);trace.put("deadlineUptimeMs",until);lpStates().getJSONArray("acknowledgments").put(trace);
    while(SystemClock.uptimeMillis()<until){last=lpRead(automation);if(first==null){first=last;trace.put("first",first);}trace.put("last",last);trace.put("elapsedMs",SystemClock.uptimeMillis()-started);if(lpEqual(last.opt(field),expected))return last;lpSleep(50);}
    throw new AssertionError("Fresh LinearProgress state not acknowledged before the admitted work deadline: "+label);
  }
  private JSONObject lpPositiveRoot(UiAutomation automation,String label) throws Exception {
    long until=lpDeadline;JSONObject current=null,record=new JSONObject();record.put("label",label);record.put("field","positive-original-root-ref");record.put("deadlineUptimeMs",until);lpStates().getJSONArray("acknowledgments").put(record);
    while(SystemClock.uptimeMillis()<until){current=lpRead(automation);if(!record.has("first"))record.put("first",current);record.put("last",current);if(current.getBoolean("visible")&&!current.isNull("rootTag")&&current.getLong("rootTag")>0&&!current.isNull("refIdentity")&&current.getLong("refIdentity")>0)return current;lpSleep(50);}
    throw new AssertionError("Fresh positive root/ref not acknowledged before the admitted work deadline: "+label);
  }
  private JSONObject lpQuiet(UiAutomation automation,JSONObject original,JSONObject before,String label,boolean allowLayout) throws Exception {
    lpSleep(750);JSONObject current=lpRead(automation);lpRetained(original,current);lpCheck(lpEqual(before.get("owner"),current.get("owner")),"Owner changed during quiet observation: "+label);lpCheck(lpDelta(before,current,"touchStart","touchEnd","touchCancel").length()==0,"Programmatic update fabricated native touch: "+label);if(!allowLayout)lpCheck(lpDelta(before,current,"layout").length()==0,"Value/callback-only update fabricated layout: "+label);return current;
  }
  private JSONObject lpOwner(UiAutomation automation,String label,String expectedOwner,JSONObject original,boolean allowLayout) throws Exception {
    label=lpFixtureControl(label);
    JSONObject before=lpRead(automation),record=new JSONObject(),expected=new JSONObject(expectedOwner);record.put("label",label);record.put("expectedOwner",expected);record.put("before",before);lpStates().getJSONArray("ownerUpdates").put(record);lpClick(automation,label);JSONObject current=lpAck(automation,"owner",expected,label);lpCheck(current.isNull("pending"),"Owner operation remained pending: "+label);lpRetained(original,current);lpCheck(lpDelta(before,current,"touchStart","touchEnd","touchCancel").length()==0,"Owner control fabricated native touch");if(!allowLayout)lpCheck(lpDelta(before,current,"layout").length()==0,"Owner value-only control fabricated layout");record.put("acknowledged",current);JSONObject quiet=lpQuiet(automation,original,current,label,allowLayout);record.put("quiet",quiet);return quiet;
  }
  private JSONObject lpFlag(UiAutomation automation,String label,String field,Object expected,JSONObject original) throws Exception {
    label=lpFixtureControl(label);
    JSONObject before=lpRead(automation),record=new JSONObject();record.put("label",label);record.put("flag",field);record.put("expected",expected);record.put("before",before);lpStates().getJSONArray("flagUpdates").put(record);lpClick(automation,label);JSONObject current=lpAck(automation,field,expected,label);lpRetained(original,current);record.put("acknowledged",current);JSONObject quiet=lpQuiet(automation,original,before,label,false);record.put("quiet",quiet);return quiet;
  }
  private void lpPanel(UiAutomation automation,String panel,JSONObject original) throws Exception{lpFlag(automation,"G02 LP "+panel+" controls","panel",panel,original);}
  private JSONObject lpPrepare(UiAutomation automation,String panel) throws Exception {
    lpMethodBaseline=lpLastReceipts.length();lpVisible(automation,lpPrepareLabel);AccessibilityNodeInfo previous=fresh(automation,lpState);JSONObject before=previous==null?null:lpRawState(automation);lpStates().put("prepareBaseline",before==null?JSONObject.NULL:before);lpClick(automation,lpPrepareLabel);lpVisible(automation,lpState);JSONObject initial=lpAck(automation,"owner",new JSONObject("{\"value\":0}"),"prepare");initial=lpPositiveRoot(automation,"prepare-original-ref");
    lpCheck(initial.getBoolean("expanded")&&initial.getBoolean("visible")&&"original".equals(initial.getString("callback"))&&"auto".equals(initial.getString("pointerEvents"))&&!initial.getBoolean("retireOnStart")&&initial.isNull("pending"),"Prepared fixture flags not actual current defaults");if(before!=null&&before.getBoolean("visible"))lpRetained(before,initial);
    lpVisible(automation,lpTarget);lpSleep(750);JSONObject settled=lpRead(automation);lpRetained(initial,settled);JSONArray rows=settled.getJSONArray("receipts");boolean layout=false;for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if("layout".equals(row.getString("kind"))&&lpEqual(row.opt("rootTag"),settled.get("rootTag")))layout=true;}lpCheck(layout,"Actual initial onLayout receipt required");lpStates().put("prepare",settled);lpCase.put("initialState",settled);lpPanel(automation,panel,settled);return settled;
  }
  private JSONObject lpWindows(UiAutomation automation) throws Exception {
    JSONObject value=new JSONObject();JSONArray nodes=new JSONArray();int roots=0;for(android.view.accessibility.AccessibilityWindowInfo window:automation.getWindows()){AccessibilityNodeInfo root=window.getRoot();rejectAnr(root,new int[]{0});if(root!=null){roots++;snapshot(root,nodes,window.getId());}}if(roots==0)throw new IllegalStateException("No responsive native window roots");value.put("windowRoots",roots);value.put("windowNodes",nodes);value.put("nativeEpochMs",System.currentTimeMillis());value.put("nativeUptimeMs",SystemClock.uptimeMillis());return value;
  }
  private int lpTargets(JSONObject windows) throws Exception{int count=0;JSONArray nodes=windows.getJSONArray("windowNodes");for(int i=0;i<nodes.length();i++)if(lpTarget.equals(nodes.getJSONObject(i).optString("id")))count++;return count;}
  private JSONObject lpNative(UiAutomation automation) throws Exception {
    lpVisible(automation,lpState);AccessibilityNodeInfo root=lpVisible(automation,lpTarget),marker=fresh(automation,lpState),scroll=fresh(automation,"showcase-scroll");if(marker==null||scroll==null||!marker.refresh()||!scroll.refresh()||!root.refresh())throw new IllegalStateException("Fresh actual target/marker/scroll required");lpCheck(whollyVisible(root,scroll)&&whollyVisible(marker,scroll),"Actual root and JSON marker must be jointly visible");JSONObject value=new JSONObject();addRawNativeFields(value,root);Rect frame=new Rect();root.getBoundsInScreen(frame);value.put("id",lpTarget);value.put("bounds",frame.flattenToString());value.put("text",root.getText()==null?JSONObject.NULL:root.getText().toString());value.put("textIsNull",root.getText()==null);JSONObject windows=lpWindows(automation);value.put("windowRoots",windows.getInt("windowRoots"));value.put("windowNodes",windows.getJSONArray("windowNodes"));lpCheck(lpTargets(windows)==1,"Exactly one actual named public progress target required");return value;
  }
  private boolean lpFrenchText(String value){String prefix=lpName+", 1";if(!value.startsWith(prefix)||!value.endsWith("250")||value.length()!=prefix.length()+4)return false;char separator=value.charAt(prefix.length());return Character.isWhitespace(separator)||Character.isSpaceChar(separator);}
  private void lpSemantics(JSONObject value,Double minimum,Double maximum,Double current,String text) throws Exception {
    lpCheck("android.view.View".equals(value.getString("className"))&&"Progress Bar".equals(value.optString("roleDescription")),"Actual pinned RN progressbar class and native role description required");if(current==null)lpCheck(value.isNull("rangeInfo")&&value.isNull("currentValue"),"Unknown progress retained determinate numeric range");else{lpCheck(!value.isNull("rangeInfo"),"Actual numeric native range missing");JSONObject range=value.getJSONObject("rangeInfo");lpCheck(Math.abs(range.getDouble("min")-minimum)<0.00001&&Math.abs(range.getDouble("max")-maximum)<0.00001&&Math.abs(range.getDouble("current")-current)<0.00001,"Actual native range differs from bounded caller value");}
    String description=value.isNull("contentDescription")?null:value.getString("contentDescription");lpCheck(description!=null&&description.startsWith(lpName),"Actual root name missing");if(text==null)lpCheck(description.equals(lpName)||description.equals(lpName+", "),"Empty/unknown native value retained determinate text");else if(text.equals("french-decimal"))lpCheck(lpFrenchText(description),"Actual French formatter separator/text differs");else lpCheck(description.equals(lpName+", "+text),"Actual native formatter/value label differs: "+description);
  }
  private JSONObject lpObserve(UiAutomation automation,String name,JSONObject original,Double minimum,Double maximum,Double current,String text,Double fraction) throws Exception {
    lpBound();long captureStarted=System.currentTimeMillis();JSONObject state=lpRead(automation);lpRetained(original,state);JSONObject nativeValue=lpNative(automation);Rect frame=Rect.unflattenFromString(nativeValue.getString("bounds"));Bitmap bitmap=automation.takeScreenshot();if(bitmap==null)throw new IllegalStateException("Native screenshot unavailable");String filename=lpCase.getString("name")+"-"+name+".png";JSONObject image=new JSONObject();
    try{lpCheck(bitmap.getHeight()>bitmap.getWidth(),"Actual portrait image required");savePng(bitmap,new File(lpDirectory,filename));image.put("png",filename);image.put("rootRect",new JSONArray(new int[]{frame.left,frame.top,frame.width(),frame.height()}));image.put("screenRect",new JSONArray(new int[]{0,0,bitmap.getWidth(),bitmap.getHeight()}));}finally{bitmap.recycle();}
    JSONObject observed=new JSONObject();observed.put("name",name);observed.put("state",state);observed.put("native",nativeValue);observed.put("image",image);observed.put("captureStartedEpochMs",captureStarted);observed.put("captureFinishedEpochMs",System.currentTimeMillis());observed.put("calibrationKey",state.getLong("rootTag")+":"+state.getLong("refIdentity")+":"+frame.width()+":"+frame.height());observed.put("presentation",current==null?"unknown":"determinate");observed.put("expectedFraction",fraction==null?JSONObject.NULL:fraction);lpCase.getJSONArray("observations").put(observed);lpSemantics(nativeValue,minimum,maximum,current,text);return observed;
  }
  private void lpCalibrate(UiAutomation automation,JSONObject original,String panel,String prefix) throws Exception {
    lpPanel(automation,"values",original);lpOwner(automation,"G02 LP zero defaults","{\"value\":0}",original,false);lpObserve(automation,prefix+"zero-baseline",original,0.,100.,0.,"0%",0.);lpOwner(automation,"G02 LP upper clamp","{\"value\":80,\"minValue\":-50,\"maxValue\":50}",original,false);lpObserve(automation,prefix+"full-baseline",original,-50.,50.,50.,"100%",1.);lpOwner(automation,"G02 LP zero defaults","{\"value\":0}",original,false);lpPanel(automation,panel,original);
  }
  private void lpValues(UiAutomation automation) throws Exception {
    JSONObject original=lpPrepare(automation,"values");lpCalibrate(automation,original,"values","");
    lpOwner(automation,"G02 LP value 25","{\"value\":25}",original,false);lpObserve(automation,"value25",original,0.,100.,25.,"25%",.25);
    lpOwner(automation,"G02 LP explicit zero bounds","{\"value\":0,\"minValue\":0,\"maxValue\":100,\"isIndeterminate\":false}",original,false);lpObserve(automation,"explicit-zero",original,0.,100.,0.,"0%",0.);
    lpOwner(automation,"G02 LP negative bounded","{\"value\":-25,\"minValue\":-50,\"maxValue\":50}",original,false);lpObserve(automation,"negative25",original,-50.,50.,-25.,"25%",.25);
    lpOwner(automation,"G02 LP lower clamp","{\"value\":-80,\"minValue\":-50,\"maxValue\":50}",original,false);lpObserve(automation,"lower-clamp",original,-50.,50.,-50.,"0%",0.);
    lpOwner(automation,"G02 LP upper clamp","{\"value\":80,\"minValue\":-50,\"maxValue\":50}",original,false);lpObserve(automation,"upper-clamp",original,-50.,50.,50.,"100%",1.);
    lpOwner(automation,"G02 LP restore default bounds","{\"value\":80}",original,false);lpObserve(automation,"default-bounds80",original,0.,100.,80.,"80%",.8);
    JSONObject before=lpRead(automation);lpOwner(automation,"G02 LP deferred 35","{\"value\":35,\"minValue\":-5,\"maxValue\":75,\"valueLabel\":\"\"}",original,false);JSONObject after=lpRead(automation);JSONArray scheduled=lpDelta(before,after,"scheduled");boolean found=false;for(int i=0;i<scheduled.length();i++)if("deferred-35".equals(scheduled.getJSONObject(i).getJSONObject("data").getString("operation")))found=true;lpCheck(found,"Actual owner Promise scheduling receipt missing");lpObserve(automation,"deferred35",original,-5.,75.,35.,null,.5);
  }
  private void lpFormat(UiAutomation automation) throws Exception {
    JSONObject original=lpPrepare(automation,"format");lpCalibrate(automation,original,"format","");
    lpOwner(automation,"G02 LP English decimal","{\"value\":1250,\"maxValue\":2000,\"locale\":\"en-US\",\"formatOptions\":{\"style\":\"decimal\"}}",original,false);lpObserve(automation,"english1250",original,0.,2000.,1250.,"1,250",.625);
    lpOwner(automation,"G02 LP French decimal","{\"value\":1250,\"maxValue\":2000,\"locale\":\"fr-CA\",\"formatOptions\":{\"style\":\"decimal\"}}",original,false);lpObserve(automation,"french1250",original,0.,2000.,1250.,"french-decimal",.625);
    lpOwner(automation,"G02 LP authored label","{\"value\":25,\"valueLabel\":\"One quarter\"}",original,false);lpObserve(automation,"authored-label25",original,0.,100.,25.,"One quarter",.25);
    lpOwner(automation,"G02 LP empty label","{\"value\":0,\"valueLabel\":\"\"}",original,false);lpObserve(automation,"empty-label0",original,0.,100.,0.,null,0.);
    JSONObject before=lpRead(automation);lpClick(automation,"Dark theme");lpClick(automation,"Compact width");JSONObject changed=lpQuiet(automation,original,before,"context-change",true);lpStates().put("contextChanged",changed);lpObserve(automation,"context-changed0",original,0.,100.,0.,null,0.);
    before=lpRead(automation);lpClick(automation,"Light theme");lpClick(automation,"Live window");JSONObject restored=lpQuiet(automation,original,before,"context-restored",true);lpStates().put("contextRestored",restored);lpObserve(automation,"context-restored0",original,0.,100.,0.,null,0.);
  }
  private JSONObject lpRemove(UiAutomation automation,String label,JSONObject original,String name) throws Exception {
    JSONObject before=lpRead(automation),record=new JSONObject();record.put("name",name);record.put("before",before);lpStates().getJSONArray("retirements").put(record);lpClick(automation,label);JSONObject removed=lpAck(automation,"rootTag",JSONObject.NULL,name);lpCheck(!removed.getBoolean("visible")&&removed.getInt("detaches")==original.getInt("detaches")+1,"Actual retirement/refnull/single detach missing");JSONObject absence=lpWindows(automation);lpCheck(lpTargets(absence)==0,"Retired public native host still present");record.put("removed",removed);record.put("absence",absence);lpSleep(750);JSONObject quiet=lpRead(automation);lpCheck(!quiet.getBoolean("visible")&&quiet.isNull("rootTag")&&lpTargets(lpWindows(automation))==0,"Retired host/visual work reappeared during quiet interval");record.put("quietRemoved",quiet);return record;
  }
  private JSONObject lpReinsert(UiAutomation automation,JSONObject original,String panel,JSONObject retirement) throws Exception {
    lpClick(automation,"G02 LP reinsert default zero");JSONObject fresh=lpAck(automation,"visible",true,"reinsert-default-zero");fresh=lpPositiveRoot(automation,"reinsert-current-ref");lpCheck(lpEqual(fresh.get("owner"),new JSONObject("{\"value\":0}"))&&!lpEqual(fresh.get("rootTag"),original.get("rootTag"))&&!lpEqual(fresh.get("refIdentity"),original.get("refIdentity"))&&fresh.getInt("attaches")==original.getInt("attaches")+1,"New default public root/ref lifetime missing");retirement.put("reinserted",fresh);lpObserve(automation,"reinsert-zero-before-calibration",fresh,0.,100.,0.,"0%",0.);lpCalibrate(automation,fresh,panel,"reinsert-");return fresh;
  }
  private void lpMotion(UiAutomation automation) throws Exception {
    JSONObject original=lpPrepare(automation,"motion");lpCalibrate(automation,original,"motion","");lpOwner(automation,"G02 LP value 25","{\"value\":25}",original,false);lpObserve(automation,"known25",original,0.,100.,25.,"25%",.25);
    lpOwner(automation,"G02 LP unknown","{\"value\":25,\"isIndeterminate\":true}",original,false);lpObserve(automation,"unknown25",original,null,null,null,null,null);
    lpOwner(automation,"G02 LP update unknown value","{\"value\":75,\"isIndeterminate\":true}",original,false);lpObserve(automation,"unknown75",original,null,null,null,null,null);
    lpOwner(automation,"G02 LP known","{\"value\":75,\"isIndeterminate\":false}",original,false);lpObserve(automation,"known75",original,0.,100.,75.,"75%",.75);
    JSONObject before=lpRead(automation);lpClick(automation,"G02 LP supersede fill");JSONObject current=lpAck(automation,"owner",new JSONObject("{\"value\":10}"),"supersede-latest");lpCheck(current.isNull("pending"),"Latest replacement remained pending");JSONArray scheduled=lpDelta(before,current,"scheduled");boolean found=false;for(int i=0;i<scheduled.length();i++)if("supersede-latest".equals(scheduled.getJSONObject(i).getJSONObject("data").getString("operation")))found=true;lpCheck(found,"Actual superseding owner timer receipt missing");lpStates().put("supersedeBefore",before);lpStates().put("supersedeDelivered",current);
    for(int i=0;i<3;i++){JSONObject quiet=lpQuiet(automation,original,current,"latest10-"+i,false);lpCheck(lpEqual(quiet.get("owner"),new JSONObject("{\"value\":10}")),"Obsolete owner returned");lpObserve(automation,"latest10-"+i,original,0.,100.,10.,"10%",.1);}
    JSONObject retired=lpRemove(automation,"G02 LP retire moving fill",original,"visual-retirement"),fresh=lpReinsert(automation,original,"motion",retired);JSONArray quiets=new JSONArray();retired.put("quietStates",quiets);for(int i=0;i<2;i++){JSONObject quiet=lpQuiet(automation,fresh,lpRead(automation),"fresh-zero-"+i,false);quiets.put(quiet);lpObserve(automation,"reinsert-zero-quiet"+i,fresh,0.,100.,0.,"0%",0.);}
  }
  private void lpContact(UiAutomation automation,String name,JSONObject original,String recipient,boolean enabled) throws Exception {
    JSONObject before=lpRead(automation),nativeValue=lpNative(automation),record=new JSONObject();lpRetained(original,before);Rect frame=Rect.unflattenFromString(nativeValue.getString("bounds"));record.put("name",name);record.put("durationMs",200);record.put("enabled",enabled);record.put("recipient",recipient);record.put("before",before);record.put("nativeBefore",nativeValue);lpStates().getJSONArray("contacts").put(record);physicalSwipe(automation,frame,200,lpDeadline,lpActions(),name);lpSleep(750);JSONObject after=lpRead(automation);lpRetained(original,after);lpCheck(lpEqual(before.get("owner"),after.get("owner")),"Physical contact changed passive caller owner");JSONArray events=lpDelta(before,after,"touchStart","touchEnd","touchCancel");record.put("after",after);record.put("events",events);
    if(!enabled){lpCheck(events.length()==0,"pointerEventsnone fabricated root touch delivery");return;}
    lpCheck(events.length()==2&&"touchStart".equals(events.getJSONObject(0).getString("kind"))&&"touchEnd".equals(events.getJSONObject(1).getString("kind")),"Exactly one raw touchStart/touchEnd required");JSONObject first=events.getJSONObject(0),last=events.getJSONObject(1);for(int i=0;i<events.length();i++){JSONObject event=events.getJSONObject(i),data=event.getJSONObject("data");lpCheck(recipient.equals(data.getString("recipient"))&&lpEqual(data.get("currentTarget"),original.get("rootTag"))&&!event.getBoolean("afterDetach"),"Native touch reached obsolete/wrong listener or root");JSONArray changed=data.getJSONObject("native").getJSONArray("changedTouches");lpCheck(changed.length()==1,"Actual one-contact payload required");}
    JSONObject startNative=first.getJSONObject("data").getJSONObject("native"),endNative=last.getJSONObject("data").getJSONObject("native");lpCheck(lpEqual(startNative.getJSONArray("changedTouches").getJSONObject(0).get("identifier"),endNative.getJSONArray("changedTouches").getJSONObject(0).get("identifier"))&&startNative.getDouble("timestamp")<=endNative.getDouble("timestamp"),"Actual contact identity/time differs across native phases");
  }
  private void lpEvents(UiAutomation automation) throws Exception {
    JSONObject original=lpPrepare(automation,"events");lpObserve(automation,"initial-default0",original,0.,100.,0.,"0%",0.);lpContact(automation,"original-contact",original,"original",true);lpFlag(automation,"G02 LP replace callbacks","callback","current",original);lpContact(automation,"current-contact",original,"current",true);lpFlag(automation,"G02 LP ignore pointer input","pointerEvents","none",original);lpContact(automation,"ignored-contact",original,"current",false);lpFlag(automation,"G02 LP accept pointer input","pointerEvents","auto",original);lpContact(automation,"restored-contact",original,"current",true);
    JSONObject before=lpRead(automation),nativeBefore=lpNative(automation);lpOwner(automation,"G02 LP widen root","{\"value\":0,\"width\":180}",original,true);JSONObject after=lpRead(automation),nativeAfter=lpNative(automation);JSONArray layouts=lpDelta(before,after,"layout");lpCheck(layouts.length()>0,"Actual changed root onLayout missing");for(int i=0;i<layouts.length();i++){JSONObject data=layouts.getJSONObject(i).getJSONObject("data");lpCheck("current".equals(data.getString("recipient"))&&lpEqual(data.get("currentTarget"),original.get("rootTag")),"Layout reached obsolete/wrong listener");}lpCheck(Math.abs(layouts.getJSONObject(layouts.length()-1).getJSONObject("data").getJSONObject("native").getJSONObject("layout").getDouble("width")-180)<.01,"Actual layout payload width differs from authored180");lpCheck(Rect.unflattenFromString(nativeAfter.getString("bounds")).width()>Rect.unflattenFromString(nativeBefore.getString("bounds")).width(),"Actual native root frame did not widen");JSONObject layout=new JSONObject();layout.put("before",before);layout.put("after",after);layout.put("nativeBefore",nativeBefore);layout.put("nativeAfter",nativeAfter);layout.put("newLayouts",layouts);lpStates().put("layout",layout);
    lpFlag(automation,"G02 LP retire on touch start","retireOnStart",true,original);before=lpRead(automation);JSONObject nativeValue=lpNative(automation),retired=new JSONObject();retired.put("name","held-retirement");retired.put("before",before);lpStates().getJSONArray("retirements").put(retired);physicalSwipe(automation,Rect.unflattenFromString(nativeValue.getString("bounds")),3000,lpDeadline,lpActions(),"held-retirement-contact");JSONObject removed=lpAck(automation,"rootTag",JSONObject.NULL,"touchStart-retirement");lpCheck(!removed.getBoolean("visible")&&removed.getInt("detaches")==original.getInt("detaches")+1,"Actual postgesture retirement/refnull/single detach required");JSONArray starts=lpDelta(before,removed,"touchStart"),detaches=lpDelta(before,removed,"detach");lpCheck(starts.length()==1&&detaches.length()==1&&starts.getJSONObject(0).getInt("sequence")<detaches.getJSONObject(0).getInt("sequence"),"Ordered actual touchStart/detach missing");JSONObject start=starts.getJSONObject(0);lpCheck("current".equals(start.getJSONObject("data").getString("recipient"))&&lpEqual(start.getJSONObject("data").get("currentTarget"),original.get("rootTag")),"Retirement start did not reach current original root listener");JSONArray all=lpDelta(before,removed);for(int i=0;i<all.length();i++){JSONObject event=all.getJSONObject(i);lpCheck(!event.getString("kind").startsWith("touch")||event.getInt("sequence")<detaches.getJSONObject(0).getInt("sequence"),"Retired callback after detach");}JSONObject absence=lpWindows(automation);lpCheck(lpTargets(absence)==0,"Actual retired host still visible");retired.put("removed",removed);retired.put("absence",absence);retired.put("observationScope","Postgesture actual retirement; no new pre-UP criterion");JSONObject fresh=lpReinsert(automation,original,"events",retired);JSONObject quiet=lpQuiet(automation,fresh,lpRead(automation),"held-reinsert-quiet",false);JSONArray quiets=new JSONArray();quiets.put(quiet);retired.put("quietStates",quiets);lpObserve(automation,"reinsert-zero-quiet",fresh,0.,100.,0.,"0%",0.);
  }
  private void lpAdmitConnection(UiAutomation automation,JSONObject result) throws Exception {
    long started=SystemClock.uptimeMillis(),until=lpBatchDeadline;JSONObject admission=new JSONObject();JSONArray observations=new JSONArray();admission.put("deadlineUptimeMs",until);admission.put("componentInputBeforeAdmission",false);admission.put("observations",observations);result.put("connectionAdmission",admission);
    while(SystemClock.uptimeMillis()<until){
      JSONObject row=new JSONObject();row.put("nativeEpochMs",System.currentTimeMillis());observations.put(row);AccessibilityNodeInfo active=automation.getRootInActiveWindow();rejectAnr(active,new int[]{0});row.put("activePackage",active==null||active.getPackageName()==null?JSONObject.NULL:active.getPackageName().toString());
      AccessibilityNodeInfo scroll=fresh(automation,"showcase-scroll"),prepare=fresh(automation,lpPrepareLabel),scene=fresh(automation,"Progress/Meter scene");boolean scrollFresh=scroll!=null&&scroll.refresh(),prepareFresh=prepare!=null&&prepare.refresh(),sceneFresh=scene!=null&&scene.refresh();row.put("scrollFresh",scrollFresh);row.put("prepareFresh",prepareFresh);row.put("sceneFresh",sceneFresh);row.put("scrollVisible",scrollFresh&&scroll.isVisibleToUser());row.put("scrollEnabled",scrollFresh&&scroll.isEnabled());row.put("sceneSelected",sceneFresh&&scene.isSelected());
      if(scrollFresh&&scroll.isVisibleToUser()&&scroll.isEnabled()&&prepareFresh&&prepare.isEnabled()&&sceneFresh&&scene.isSelected()){Rect frame=new Rect();scroll.getBoundsInScreen(frame);row.put("scrollBounds",frame.flattenToString());if(!frame.isEmpty()){admission.put("status","READY_FROM_ACTUAL_NEW_CONNECTION");admission.put("elapsedMs",SystemClock.uptimeMillis()-started);return;}}
      SystemClock.sleep(50);
    }
    admission.put("status","NOT_READY_NO_INPUT");admission.put("elapsedMs",SystemClock.uptimeMillis()-started);throw new IllegalStateException("Actual new UiAutomation connection did not admit Range scene/scroll/prepare before the admitted work deadline");
  }
  private JSONObject linearProgressG02Batch(UiAutomation automation) throws Exception {
    long started=SystemClock.uptimeMillis();lpBatchDeadline=meterAttemptDeadline(started,arguments.getString("attemptRemainingMs"));JSONObject result=new JSONObject();JSONArray cases=new JSONArray();result.put("operation","linear-progress-g02-batch");result.put("epochStartedMs",System.currentTimeMillis());result.put("methodLimitMs",JSONObject.NULL);result.put("batchLimitMs",lpBatchDeadline-started);result.put("cohorts",cases);result.put("ledgerPromotion",false);result.put("nativeActionSucceeded",false);result.put("status","STOP_UNSAFE");JSONObject profile=new JSONObject();android.util.DisplayMetrics metrics=getContext().getResources().getDisplayMetrics();profile.put("densityDpi",metrics.densityDpi);profile.put("pixelsPerLogicalPoint",metrics.density);profile.put("rawDensity","Instrumentation context DisplayMetrics");result.put("profile",profile);
    String output=arguments.getString("outputDir","");if(!"/sdcard/Android/data/dev.codonui.lab.number/files/linear-progress-g02-native-6".equals(output))throw new IllegalArgumentException("Fixed fresh LP native output required");File external=getContext().getExternalFilesDir(null);if(external==null)throw new IllegalStateException("App external files unavailable");lpDirectory=new File(external,"linear-progress-g02-native-6").getCanonicalFile();if(!lpDirectory.equals(new File(output).getCanonicalFile())||lpDirectory.exists()||!lpDirectory.mkdirs())throw new IllegalStateException("Fresh actual LP native output directory required");result.put("outputDir",lpDirectory.toString());
    boolean safe=true,failed=false;String[] names={"motion"};if(names.length!=1||!"motion".equals(names[0]))throw new IllegalStateException("Exactly the motion regression method must be selected");result.put("selectedMethods",new JSONArray(java.util.Arrays.asList(names)));result.put("selectedMethodCount",names.length);
    try{
      lpAdmitConnection(automation,result);
      for(int i=0;i<names.length;i++){
        lpCase=new JSONObject();lpCase.put("name",names[i]);lpCase.put("startedEpochMs",System.currentTimeMillis());lpCase.put("observations",new JSONArray());lpCase.put("actions",new JSONArray());JSONObject states=new JSONObject();for(String key:new String[]{"ownerUpdates","flagUpdates","contacts","retirements","acknowledgments"})states.put(key,new JSONArray());lpCase.put("states",states);cases.put(lpCase);long methodStart=SystemClock.uptimeMillis();lpDeadline=lpBatchDeadline;
        try{if(lpBatchDeadline-methodStart<=0)throw new IllegalStateException("Admitted overall work deadline exhausted");if(!names[i].equals("motion"))throw new IllegalStateException("Unexpected non-motion regression method");lpMotion(automation);lpCase.put("finalState",lpRead(automation));lpCase.put("status","NATIVE_ASSERTIONS_PASSED_PENDING_PAINT");}
        catch(AssertionError error){failed=true;lpCase.put("status","FAILED_CASE_ASSERTION");lpCase.put("error",error.toString());if(i+1<names.length){try{lpBound();JSONObject current=lpRawState(automation),windows=lpWindows(automation);AccessibilityNodeInfo scroll=fresh(automation,"showcase-scroll");if(scroll==null||!scroll.refresh()||lpBatchDeadline-SystemClock.uptimeMillis()<=0)throw new IllegalStateException("Unsafe/insufficient next-method admission");JSONObject admission=new JSONObject();admission.put("state",current);admission.put("windows",windows);admission.put("noANR",true);admission.put("physicalCommandReturnedBeforeContinuation",true);admission.put("nextPrepareResetsCurrentFixture",true);lpCase.put("continuationAdmission",admission);}catch(Throwable unsafe){safe=false;lpCase.put("batchStop",unsafe.toString());}}}
        catch(Throwable error){safe=false;lpCase.put("status","INFRASTRUCTURE_OR_UNSAFE_STOP_BATCH");lpCase.put("error",error.toString());}
        finally{lpCase.put("lastRawReceipts",lpLastReceipts);lpCase.put("elapsedMs",SystemClock.uptimeMillis()-methodStart);lpCase.put("finishedEpochMs",System.currentTimeMillis());writeJson(lpDirectory,"receipt.json",result);}
        if(!safe){for(int j=i+1;j<names.length;j++){JSONObject skipped=new JSONObject();skipped.put("name",names[j]);skipped.put("status","NOT_RUN_UNSAFE");skipped.put("error","Prior native infrastructure/unsafe condition stopped batch");cases.put(skipped);}break;}
      }
      result.put("hasFailedCohorts",failed);result.put("nativeActionSucceeded",safe&&cases.length()==names.length);result.put("status",safe&&cases.length()==names.length?"NATIVE_BATCH_COMPLETE_PENDING_HOST_PAINT":"STOP_UNSAFE");
    }finally{result.put("epochFinishedMs",System.currentTimeMillis());result.put("elapsedMs",SystemClock.uptimeMillis()-started);writeJson(lpDirectory,"receipt.json",result);}
    return result;
  }

  private void mtValues(UiAutomation automation) throws Exception {
    JSONObject original=lpPrepare(automation,"values");lpCalibrate(automation,original,"values","");
    lpOwner(automation,"G02 MT value 25","{\"value\":25}",original,false);lpObserve(automation,"value25",original,0.,100.,25.,"25%",.25);
    lpOwner(automation,"G02 MT explicit zero bounds","{\"value\":0,\"minValue\":0,\"maxValue\":100}",original,false);lpObserve(automation,"explicit-zero",original,0.,100.,0.,"0%",0.);
    lpOwner(automation,"G02 MT negative bounded","{\"value\":-25,\"minValue\":-50,\"maxValue\":50}",original,false);lpObserve(automation,"negative25",original,-50.,50.,-25.,"25%",.25);
    lpOwner(automation,"G02 MT lower clamp","{\"value\":-80,\"minValue\":-50,\"maxValue\":50}",original,false);lpObserve(automation,"lower-clamp",original,-50.,50.,-50.,"0%",0.);
    lpOwner(automation,"G02 MT upper clamp","{\"value\":80,\"minValue\":-50,\"maxValue\":50}",original,false);lpObserve(automation,"upper-clamp",original,-50.,50.,50.,"100%",1.);
    lpOwner(automation,"G02 MT restore default bounds","{\"value\":80}",original,false);lpObserve(automation,"default-bounds80",original,0.,100.,80.,"80%",.8);
    JSONObject before=lpRead(automation);lpOwner(automation,"G02 MT deferred 35","{\"value\":35,\"minValue\":-5,\"maxValue\":75,\"valueLabel\":\"\"}",original,false);JSONObject after=lpRead(automation);JSONArray scheduled=lpDelta(before,after,"scheduled");boolean found=false;for(int i=0;i<scheduled.length();i++)if("deferred-35".equals(scheduled.getJSONObject(i).getJSONObject("data").getString("operation")))found=true;lpCheck(found,"Actual owner Promise scheduling receipt missing");lpObserve(automation,"deferred35",original,-5.,75.,35.,null,.5);
  }
  private void mtMotion(UiAutomation automation) throws Exception {
    JSONObject original=lpPrepare(automation,"motion");lpCalibrate(automation,original,"motion","");lpOwner(automation,"G02 MT value 25","{\"value\":25}",original,false);lpObserve(automation,"known25",original,0.,100.,25.,"25%",.25);
    lpOwner(automation,"G02 MT value 75","{\"value\":75}",original,false);lpObserve(automation,"known75",original,0.,100.,75.,"75%",.75);
    JSONObject before=lpRead(automation);lpClick(automation,"G02 MT supersede fill");JSONObject current=lpAck(automation,"owner",new JSONObject("{\"value\":10}"),"supersede-latest");lpCheck(current.isNull("pending"),"Latest replacement remained pending");JSONArray scheduled=lpDelta(before,current,"scheduled");boolean found=false;for(int i=0;i<scheduled.length();i++)if("supersede-latest".equals(scheduled.getJSONObject(i).getJSONObject("data").getString("operation")))found=true;lpCheck(found,"Actual superseding owner timer receipt missing");lpStates().put("supersedeBefore",before);lpStates().put("supersedeDelivered",current);
    for(int i=0;i<3;i++){JSONObject quiet=lpQuiet(automation,original,current,"latest10-"+i,false);lpCheck(lpEqual(quiet.get("owner"),new JSONObject("{\"value\":10}")),"Obsolete owner returned");lpObserve(automation,"latest10-"+i,original,0.,100.,10.,"10%",.1);}
    JSONObject retired=lpRemove(automation,"G02 MT retire moving fill",original,"visual-retirement"),fresh=lpReinsert(automation,original,"motion",retired);JSONArray quiets=new JSONArray();retired.put("quietStates",quiets);for(int i=0;i<2;i++){JSONObject quiet=lpQuiet(automation,fresh,lpRead(automation),"fresh-zero-"+i,false);quiets.put(quiet);lpObserve(automation,"reinsert-zero-quiet"+i,fresh,0.,100.,0.,"0%",0.);}
  }
  private JSONObject meterG02Batch(UiAutomation automation) throws Exception {
    lpTarget="meter-g02-target";lpState="meter-g02-state";lpName="G02 meter";lpPrepareLabel="G02 prepare Meter";lpMeterFixture=true;lpLastReceipts=new JSONArray();lpMethodBaseline=0;
    try{return meterG02BatchCurrent(automation);}
    finally{lpTarget=LP_TARGET;lpState=LP_STATE;lpName=LP_NAME;lpPrepareLabel="G02 prepare LinearProgress";lpMeterFixture=false;}
  }
  private void meterSelectScene(UiAutomation automation,JSONObject result) throws Exception { meterSelectScene(automation,result,"Progress/Meter scene"); }
  private void meterSelectScene(UiAutomation automation,JSONObject result,String scene) throws Exception {
    lpDeadline=lpBatchDeadline;
    JSONObject setup=new JSONObject();setup.put("actions",new JSONArray());setup.put("status","CHECKING_BEFORE_INPUT");result.put("setup",setup);lpCase=setup;
    ReadinessGate gate=new ReadinessGate();
    gate.admit(()->{
      long clearSince=-1;
      while(SystemClock.uptimeMillis()<lpDeadline){
        JSONObject windows=tgStartupWindows(automation);setup.put("lastWindows",windows);boolean anr=false;JSONArray nodes=windows.getJSONArray("windowNodes");for(int i=0;i<nodes.length();i++)if(nodes.getJSONObject(i).optString("text","").contains("isn't responding"))anr=true;
        AccessibilityNodeInfo root=automation.getRootInActiveWindow(),scroll=fresh(automation,"showcase-scroll");
        boolean ready=meterStartupSnapshotReady(windows.getInt("windowRoots"),root!=null&&root.refresh()&&"dev.codonui.showcase".contentEquals(root.getPackageName())&&scroll!=null&&scroll.refresh()&&scroll.isVisibleToUser()&&scroll.isEnabled(),anr);
        Rect viewport=new Rect();if(scroll!=null)scroll.getBoundsInScreen(viewport);ready=ready&&!viewport.isEmpty();
        if(!ready)clearSince=-1;
        else {long now=SystemClock.uptimeMillis();if(clearSince<0)clearSince=now;setup.put("clearObservedMs",now-clearSince);if(now-clearSince>=30000)return true;}
        lpSleep(250);
      }
      return false;
    });
    gate.run(()->lpClick(automation,scene));
    setup.put("status","READY_BEFORE_NAVIGATION");
  }

  private JSONObject meterG02BatchCurrent(UiAutomation automation) throws Exception {
    long started=SystemClock.uptimeMillis();lpBatchDeadline=meterAttemptDeadline(started,arguments.getString("attemptRemainingMs"));JSONObject result=new JSONObject();JSONArray cases=new JSONArray();result.put("operation","meter-g02-batch");result.put("epochStartedMs",System.currentTimeMillis());result.put("methodLimitMs",JSONObject.NULL);result.put("batchLimitMs",lpBatchDeadline-started);result.put("cohorts",cases);result.put("ledgerPromotion",false);result.put("nativeActionSucceeded",false);result.put("status","STOP_UNSAFE");JSONObject profile=new JSONObject();android.util.DisplayMetrics metrics=getContext().getResources().getDisplayMetrics();profile.put("densityDpi",metrics.densityDpi);profile.put("pixelsPerLogicalPoint",metrics.density);profile.put("rawDensity","Instrumentation context DisplayMetrics");result.put("profile",profile);
    String output=arguments.getString("outputDir","");String directoryName=new File(output).getName();if(!directoryName.matches("meter-g02-native-[A-Za-z0-9_-]+"))throw new IllegalArgumentException("Fresh Meter native output name required");File external=getContext().getExternalFilesDir(null);if(external==null)throw new IllegalStateException("App external files unavailable");lpDirectory=new File(external,directoryName).getCanonicalFile();if(!lpDirectory.equals(new File(output).getCanonicalFile())||lpDirectory.exists()||!lpDirectory.mkdirs())throw new IllegalStateException("Fresh actual Meter native output directory required");result.put("outputDir",lpDirectory.toString());
    boolean safe=true,failed=false;String[] names={"values","format","motion","events"};if(names.length!=4)throw new IllegalStateException("Exactly the four Meter G02 methods must be selected");result.put("selectedMethods",new JSONArray(java.util.Arrays.asList(names)));result.put("selectedMethodCount",names.length);
    try{
      meterSelectScene(automation,result);
      lpAdmitConnection(automation,result);
      for(int i=0;i<names.length;i++){
        lpCase=new JSONObject();lpCase.put("name",names[i]);lpCase.put("startedEpochMs",System.currentTimeMillis());lpCase.put("observations",new JSONArray());lpCase.put("actions",new JSONArray());JSONObject states=new JSONObject();for(String key:new String[]{"ownerUpdates","flagUpdates","contacts","retirements","acknowledgments"})states.put(key,new JSONArray());lpCase.put("states",states);cases.put(lpCase);long methodStart=SystemClock.uptimeMillis();lpDeadline=lpBatchDeadline;
        try{if(lpBatchDeadline-methodStart<=0)throw new IllegalStateException("Admitted overall work deadline exhausted");if(names[i].equals("values"))mtValues(automation);else if(names[i].equals("format"))lpFormat(automation);else if(names[i].equals("motion"))mtMotion(automation);else if(names[i].equals("events"))lpEvents(automation);else throw new IllegalStateException("Unexpected Meter method");lpCase.put("finalState",lpRead(automation));lpCase.put("status","NATIVE_ASSERTIONS_PASSED_PENDING_PAINT");}
        catch(AssertionError error){failed=true;lpCase.put("status","FAILED_CASE_ASSERTION");lpCase.put("error",error.toString());if(i+1<names.length){try{lpBound();JSONObject current=lpRawState(automation),windows=lpWindows(automation);AccessibilityNodeInfo scroll=fresh(automation,"showcase-scroll");if(scroll==null||!scroll.refresh()||lpBatchDeadline-SystemClock.uptimeMillis()<=0)throw new IllegalStateException("Unsafe/insufficient next-method admission");JSONObject admission=new JSONObject();admission.put("state",current);admission.put("windows",windows);admission.put("noANR",true);admission.put("physicalCommandReturnedBeforeContinuation",true);admission.put("nextPrepareResetsCurrentFixture",true);lpCase.put("continuationAdmission",admission);}catch(Throwable unsafe){safe=false;lpCase.put("batchStop",unsafe.toString());}}}
        catch(Throwable error){safe=false;lpCase.put("status","INFRASTRUCTURE_OR_UNSAFE_STOP_BATCH");lpCase.put("error",error.toString());}
        finally{lpCase.put("lastRawReceipts",lpLastReceipts);lpCase.put("elapsedMs",SystemClock.uptimeMillis()-methodStart);lpCase.put("finishedEpochMs",System.currentTimeMillis());writeJson(lpDirectory,"receipt.json",result);}
        if(!safe){for(int j=i+1;j<names.length;j++){JSONObject skipped=new JSONObject();skipped.put("name",names[j]);skipped.put("status","NOT_RUN_UNSAFE");skipped.put("error","Prior native infrastructure/unsafe condition stopped batch");cases.put(skipped);}break;}
      }
      result.put("hasFailedCohorts",failed);result.put("nativeActionSucceeded",safe&&!failed&&cases.length()==names.length);result.put("status",safe&&!failed&&cases.length()==names.length?"NATIVE_BATCH_COMPLETE_PENDING_HOST_PAINT":"STOP_UNSAFE");
    }finally{result.put("epochFinishedMs",System.currentTimeMillis());result.put("elapsedMs",SystemClock.uptimeMillis()-started);writeJson(lpDirectory,"receipt.json",result);}
    return result;
  }


  private static final String[] MS_CASES={"semantic","fractional","zero-width","zero-height","percentage","auto-height","physical-left","vertical-up","vertical-down","orthogonal","independent-radii","primary","explicit-colors","registered-array","post-custom-final","native-color","zero-opacity","raised"};
  public static boolean meterStartupSnapshotReady(int windowRoots,boolean appReady,boolean anr) {
    if(anr)throw new IllegalStateException("ANR during Meter startup readiness");return windowRoots>0&&appReady;
  }
  private File msDirectory;
  private JSONObject msResult,msOriginal;
  public static void meterStyleFrameCheck(double[] actual,double[] expected,double scale) {
    if(actual.length!=4||expected.length!=4||!Double.isFinite(scale)||scale<=0)throw new AssertionError("Finite actual frame and scale required");for(int i=0;i<4;i++)if(!Double.isFinite(actual[i])||!Double.isFinite(expected[i])||Math.abs(actual[i]-expected[i])*scale>1.00001)throw new AssertionError("Meter frame exceeds one physical pixel at "+i);
  }
  public static void meterStyleColorCheck(int actual,int reference,boolean absent) {
    if(actual!=reference||(absent&&actual!=0xffffffff))throw new AssertionError("Exact Meter/reference color or white absence failed");
  }
  public static void meterStyleIdentityCheck(String id,int count) {
    if(!"meter-style-target".equals(id)||count!=1)throw new AssertionError("Exactly one original Meter target required");
  }
  public static double meterStyleExpectedHeight(int index,double fixedHeight,double referenceHeight) {
    if(index!=5)return fixedHeight;if(!Double.isFinite(referenceHeight)||referenceHeight<0)throw new AssertionError("Finite independent automatic reference height required");return referenceHeight;
  }
  public static long meterAttemptDeadline(long started,String remaining) {
    if(remaining==null||!remaining.matches("[0-9]{1,7}"))throw new AssertionError("Admitted remaining attempt budget required");long budget=Long.parseLong(remaining);if(budget<=0||budget>1800000)throw new AssertionError("Remaining budget must fit admitted30minute limit");return started+budget;
  }
  public static String[] meterStyleMethods(String selected) {
    if("dimensions".equals(selected))return new String[]{"dimensions"};if("".equals(selected))return new String[]{"dimensions","geometry","slots","context-motion"};throw new AssertionError("Unknown Meter style cohort selection");
  }
  private double[] msFrame(JSONObject state,String owner) throws Exception {
    JSONObject receipt=state.getJSONObject("layouts").getJSONObject(owner),frame=receipt.getJSONObject("layout");lpCheck(receipt.getLong("nativeTarget")>0&&lpEqual(receipt.get("nativeTarget"),receipt.get("currentTarget")),"Original actual native layout event binding required");if(owner.equals("target"))lpCheck(lpEqual(receipt.get("nativeTarget"),state.get("rootTag")),"Meter onLayout belongs to another root");return new double[]{frame.getDouble("x"),frame.getDouble("y"),frame.getDouble("width"),frame.getDouble("height")};
  }
  private void msPaint(Bitmap bitmap,JSONObject row,JSONObject state) throws Exception {
    double scale=getContext().getResources().getDisplayMetrics().density;int index=state.getInt("index");double[][] sizes={{150,10},{73.25,13.75},{0,10},{150,0},{108,20},{150,0},{160,20},{20,140},{20,140},{150,10},{150,24},{150,20},{150,20},{91,20},{84,20},{150,20},{150,10},{150,20}};
    double[] a=msFrame(state,"target"),b=msFrame(state,"reference");double[] expected={12,12+(index==14?5:0),sizes[index][0],meterStyleExpectedHeight(index,sizes[index][1],b[3])};meterStyleFrameCheck(a,expected,scale);meterStyleFrameCheck(b,expected,scale);JSONObject geometry=new JSONObject();geometry.put("expected",new JSONArray(expected));geometry.put("target",new JSONArray(a));geometry.put("reference",new JSONArray(b));geometry.put("scale",scale);row.put("geometry",geometry);
    Rect pa=Rect.unflattenFromString(row.getJSONObject("nativeParent").getString("bounds")),pb=Rect.unflattenFromString(row.getJSONObject("nativeReferenceParent").getString("bounds"));lpCheck(pa!=null&&pb!=null&&new Rect(0,0,bitmap.getWidth(),bitmap.getHeight()).contains(pa)&&new Rect(0,0,bitmap.getWidth(),bitmap.getHeight()).contains(pb),"Both isolated measurement parents must be wholly captured");meterStyleFrameCheck(new double[]{0,0,pa.width()/scale,pa.height()/scale},new double[]{0,0,240,170},scale);meterStyleFrameCheck(new double[]{0,0,pb.width()/scale,pb.height()/scale},new double[]{0,0,240,170},scale);
    boolean absent=index==16;JSONArray samples=new JSONArray();row.put("samples",samples);
    if(absent){long count=0;for(Rect parent:new Rect[]{pa,pb})for(int y=parent.top;y<parent.bottom;y++)for(int x=parent.left;x<parent.right;x++){meterStyleColorCheck(bitmap.getPixel(x,y),0xffffffff,true);count++;}row.put("absencePixelsChecked",count);return;}
    if(index==2||index==3||index==5){lpCheck(pa.width()==pb.width()&&pa.height()==pb.height(),"Matched physical parent dimensions required");long count=0,nonwhite=0;for(int y=0;y<pa.height();y++)for(int x=0;x<pa.width();x++){int actual=bitmap.getPixel(pa.left+x,pa.top+y),reference=bitmap.getPixel(pb.left+x,pb.top+y);meterStyleColorCheck(actual,reference,false);count++;if(actual!=0xffffffff)nonwhite++;}lpCheck(nonwhite>0,"Retained bordered track must have nonwhite paint");row.put("wholeParentPixelsChecked",count);row.put("wholeParentNonWhitePixels",nonwhite);return;}
    JSONObject target=row.getJSONObject("nativeTarget");meterStyleIdentityCheck(target.getString("id"),row.getInt("targetCount"));lpCheck(target.getBoolean("visible")&&"android.view.View".equals(target.getString("className"))&&"Progress Bar".equals(target.getString("roleDescription")),"Actual named Meter role/visibility required");JSONObject range=target.getJSONObject("rangeInfo");lpCheck(range.getDouble("min")==0&&range.getDouble("max")==100&&range.getDouble("current")==state.getInt("value")&&target.getString("contentDescription").equals("Style meter, "+state.getInt("value")+"%"),"Actual Meter value/text semantics differ");Rect nativeFrame=Rect.unflattenFromString(target.getString("bounds"));meterStyleFrameCheck(new double[]{nativeFrame.left,nativeFrame.top,nativeFrame.width(),nativeFrame.height()},new double[]{pa.left+a[0]*scale,pa.top+a[1]*scale,a[2]*scale,a[3]*scale},1);
    boolean vertical=index==7||index==8,reverse=index==6||index==7;double fraction=state.getDouble("value")/100;double filled=reverse?1-fraction/2:fraction/2,empty=reverse?(1-fraction)/2:fraction+(1-fraction)/2;int colors[]=new int[2];
    for(int sample=0;sample<2;sample++){double axis=sample==0?filled:empty;int x=(int)Math.floor(pa.left+(a[0]+a[2]*(vertical?.5:axis))*scale+.5),y=(int)Math.floor(pa.top+(a[1]+a[3]*(vertical?axis:.5))*scale+.5),rx=(int)Math.floor(pb.left+(b[0]+b[2]*(vertical?.5:axis))*scale+.5),ry=(int)Math.floor(pb.top+(b[1]+b[3]*(vertical?axis:.5))*scale+.5);int color=bitmap.getPixel(x,y),reference=bitmap.getPixel(rx,ry);meterStyleColorCheck(color,reference,false);JSONObject pixel=new JSONObject();pixel.put("name",sample==0?"bar":"track");pixel.put("point",new JSONArray(new int[]{x,y}));pixel.put("referencePoint",new JSONArray(new int[]{rx,ry}));pixel.put("argb",color);pixel.put("referenceARGB",reference);samples.put(pixel);colors[sample]=color;}
    lpCheck(colors[0]!=colors[1],"Nonvacuous independent native bar/track contrast required");if(index==12){lpCheck(colors[0]==0xff087f8c&&colors[1]==0xffffcc66,"Explicit opaque bar/track colors did not override order");}
    if(index==14){for(int offset:new int[]{1,2}){int x=(int)Math.floor(pa.left+(a[0]+a[2]*.75)*scale+.5),y=(int)Math.floor(pa.top+a[1]*scale+.5)+offset,rx=(int)Math.floor(pb.left+(b[0]+b[2]*.75)*scale+.5),ry=(int)Math.floor(pb.top+b[1]*scale+.5)+offset;meterStyleColorCheck(bitmap.getPixel(x,y),bitmap.getPixel(rx,ry),false);JSONObject pixel=new JSONObject();pixel.put("name","solid-border-"+offset);pixel.put("point",new JSONArray(new int[]{x,y}));pixel.put("referencePoint",new JSONArray(new int[]{rx,ry}));pixel.put("argb",bitmap.getPixel(x,y));pixel.put("referenceARGB",bitmap.getPixel(rx,ry));samples.put(pixel);}}
  }
  private void msPersist() throws Exception{writeJson(msDirectory,"receipt.json",msResult);}
  private JSONObject msRead(UiAutomation automation) throws Exception {
    lpBound();AccessibilityNodeInfo marker=fresh(automation,"meter-style-state");lpCheck(marker!=null&&marker.refresh()&&marker.getContentDescription()!=null,"Fresh actual Meter style marker required");return new JSONObject(marker.getContentDescription().toString());
  }
  private JSONObject msWait(UiAutomation automation,String field,Object expected) throws Exception {
    long until=lpDeadline;JSONObject current=null;
    while(SystemClock.uptimeMillis()<until){current=msRead(automation);if(lpEqual(current.opt(field),expected))return current;lpSleep(50);}throw new AssertionError("Meter style acknowledgment missing: "+field+"="+expected+" actual="+current);
  }
  private void msRetained(JSONObject state) throws Exception {
    lpCheck(state.getLong("rootTag")>0,"Actual public Meter View ref required");if(msOriginal!=null)for(String key:new String[]{"rootTag","attaches","detaches"})lpCheck(lpEqual(msOriginal.get(key),state.get(key)),"Meter style root lifetime changed: "+key);
  }
  private void msSelect(UiAutomation automation,int index) throws Exception {
    for(int step=0;step<=MS_CASES.length;step++){JSONObject current=msRead(automation);if(current.getInt("index")==index){lpCheck(MS_CASES[index].equals(current.getString("case")),"Wrong Meter case identity");return;}int next=(current.getInt("index")+1)%MS_CASES.length;tgClick(automation,"Next Meter style");msWait(automation,"index",next);}throw new IllegalStateException("Bounded Meter style selection failed");
  }
  private JSONObject msObserve(UiAutomation automation,String name) throws Exception {
    tgVisible(automation,"meter-style-pair");lpSleep(500);JSONObject before=msRead(automation);msRetained(before);JSONObject row=new JSONObject();row.put("name",name);row.put("state",before);row.put("captureStartedEpochMs",System.currentTimeMillis());row.put("windows",lpWindows(automation));
    for(String[] pair:new String[][]{{"nativeParent","meter-style-parent"},{"nativeReferenceParent","meter-style-reference-parent"},{"nativeReference","meter-style-reference"}}){AccessibilityNodeInfo node=fresh(automation,pair[1]);lpCheck(node!=null&&node.refresh(),"Actual Meter style parent/reference missing: "+pair[1]);row.put(pair[0],tgNode(node));}
    AccessibilityNodeInfo target=fresh(automation,"meter-style-target");row.put("nativeTarget",target==null?JSONObject.NULL:tgNode(target));
    JSONObject windows=row.getJSONObject("windows");int matches=0;JSONArray nodes=windows.getJSONArray("windowNodes");for(int i=0;i<nodes.length();i++)if("meter-style-target".equals(nodes.getJSONObject(i).optString("id")))matches++;lpCheck(matches<=1,"Duplicate actual Meter style target");row.put("targetCount",matches);
    Bitmap image=automation.takeScreenshot();lpCheck(image!=null,"Actual Meter style PNG required");String png=lpCase.getString("name")+"-"+name+".png";row.put("png",png);lpCase.getJSONArray("observations").put(row);try{savePng(image,new File(msDirectory,png));row.put("screenRect",new JSONArray(new int[]{0,0,image.getWidth(),image.getHeight()}));msPaint(image,row,before);}finally{image.recycle();msPersist();}JSONObject after=msRead(automation);msRetained(after);for(String key:new String[]{"index","case","value","mode","layouts","rootTag","attaches","detaches"})lpCheck(lpEqual(before.get(key),after.get(key)),"Meter style changed during capture: "+key);row.put("afterState",after);row.put("captureFinishedEpochMs",System.currentTimeMillis());msPersist();return row;
  }
  public static boolean motionPreferenceCommandAllowed(String command) {
    return command!=null&&command.matches("settings (get|delete) global (transition_animation_scale|animator_duration_scale)|settings put global (transition_animation_scale|animator_duration_scale) [0-9.]+");
  }
  private String msShell(UiAutomation automation,String command) throws Exception {
    lpCheck(motionPreferenceCommandAllowed(command),"Only the captured motion preference is writable");JSONObject record=new JSONObject();record.put("command",command);record.put("startedUptimeMs",SystemClock.uptimeMillis());lpActions().put(record);android.os.ParcelFileDescriptor[] pipes=automation.executeShellCommandRw("sh");String script=command+" 2>&1\nstatus=$?\nprintf '\\nCODON_MOTION_EXIT=%s\\n' \"$status\"\nexit \"$status\"\n";
    try{try(android.os.ParcelFileDescriptor.AutoCloseOutputStream stdin=new android.os.ParcelFileDescriptor.AutoCloseOutputStream(pipes[1])){stdin.write(script.getBytes(StandardCharsets.UTF_8));stdin.flush();}long until=lpDeadline;java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();try(android.os.ParcelFileDescriptor.AutoCloseInputStream stdout=new android.os.ParcelFileDescriptor.AutoCloseInputStream(pipes[0])){byte[] buffer=new byte[1024];while(SystemClock.uptimeMillis()<until){int available=stdout.available();if(available>0){int size=stdout.read(buffer,0,Math.min(buffer.length,available));if(size<0)break;bytes.write(buffer,0,size);}String text=new String(bytes.toByteArray(),StandardCharsets.UTF_8);java.util.regex.Matcher marker=java.util.regex.Pattern.compile("(?:^|\\n)CODON_MOTION_EXIT=([0-9]+)\\r?\\n").matcher(text);if(marker.find()){record.put("output",text);record.put("exitCode",Integer.parseInt(marker.group(1)));lpCheck(marker.group(1).equals("0"),"Motion preference command failed");return text.substring(0,marker.start()).trim();}lpCheck(bytes.size()<8192,"Unexpected motion preference output");lpSleep(10);}}throw new IllegalStateException("Motion preference outcome uncertain before the method deadline");}
    finally{for(android.os.ParcelFileDescriptor pipe:pipes)try{pipe.close();}catch(java.io.IOException ignored){}record.put("finishedUptimeMs",SystemClock.uptimeMillis());msPersist();}
  }
  private void msMotionEvent(UiAutomation automation,int priorLength,boolean expected) throws Exception {
    long until=lpDeadline;while(SystemClock.uptimeMillis()<until){JSONArray events=msRead(automation).getJSONArray("motionEvents");if(events.length()>priorLength&&events.getBoolean(events.length()-1)==expected)return;lpSleep(50);}throw new AssertionError("Actual public Reduce Motion event not delivered: "+expected);
  }
  private void msContext(UiAutomation automation) throws Exception {
    msSelect(automation,0);tgClick(automation,"Dark theme");msWait(automation,"mode","dark");for(int index:new int[]{0,11,14,15}){msSelect(automation,index);msObserve(automation,"dark-"+MS_CASES[index]);}
    msSelect(automation,4);JSONObject before=msObserve(automation,"before-compact");tgClick(automation,"Compact width");msObserve(automation,"compact");tgClick(automation,"Live window");msObserve(automation,"live-restored");lpCase.put("windowBefore",before);
    tgClick(automation,"Light theme");msWait(automation,"mode","light");msSelect(automation,0);String original=msShell(automation,"settings get global transition_animation_scale");lpCase.put("originalMotionSetting",original);
    try{msShell(automation,"settings put global transition_animation_scale 1");lpSleep(500);int initial=msRead(automation).getJSONArray("motionEvents").length();msShell(automation,"settings put global transition_animation_scale 0");msMotionEvent(automation,initial,true);tgClick(automation,"Change Meter style value");msWait(automation,"value",75);msObserve(automation,"reduced-value75");int reduced=msRead(automation).getJSONArray("motionEvents").length();msShell(automation,"settings put global transition_animation_scale 1");msMotionEvent(automation,reduced,false);tgClick(automation,"Change Meter style value");msWait(automation,"value",25);msObserve(automation,"motion-restored-value25");}
    finally{msShell(automation,original.equals("null")?"settings delete global transition_animation_scale":"settings put global transition_animation_scale "+original);lpCheck(msShell(automation,"settings get global transition_animation_scale").equals(original),"Exact motion preference restoration required");lpCase.put("motionRestorationVerified",true);}
    msSelect(automation,11);tgClick(automation,"Change Meter style value");msWait(automation,"value",75);tgClick(automation,"Prepare Meter styles");msWait(automation,"case","semantic");msWait(automation,"value",25);msObserve(automation,"explicit-reset");
  }
  private JSONObject meterStyleBatch(UiAutomation automation) throws Exception {
    long started=SystemClock.uptimeMillis();lpBatchDeadline=meterAttemptDeadline(started,arguments.getString("attemptRemainingMs"));msResult=new JSONObject();msResult.put("operation","meter-style-batch");msResult.put("epochStartedMs",System.currentTimeMillis());msResult.put("methodLimitMs",JSONObject.NULL);msResult.put("cohorts",new JSONArray());msResult.put("nativeActionSucceeded",false);msResult.put("status","STOP_UNSAFE");msOriginal=null;String output=arguments.getString("outputDir","");String name=new File(output).getName();lpCheck(name.matches("meter-style-native-[A-Za-z0-9_-]+"),"Fresh Meter style output required");msDirectory=new File(getContext().getExternalFilesDir(null),name).getCanonicalFile();lpCheck(msDirectory.equals(new File(output).getCanonicalFile())&&!msDirectory.exists()&&msDirectory.mkdirs(),"Fresh exact Meter style output directory required");String previousPrepare=lpPrepareLabel;lpPrepareLabel="Prepare Meter styles";String[] methods=meterStyleMethods(arguments.getString("cohorts",""));msResult.put("selectedMethods",new JSONArray(java.util.Arrays.asList(methods)));boolean safe=true,failed=false;
    try{meterSelectScene(automation,msResult);lpAdmitConnection(automation,msResult);lpCase=new JSONObject();lpCase.put("actions",new JSONArray());msResult.put("prepare",lpCase);lpDeadline=lpBatchDeadline;tgClick(automation,"Prepare Meter styles");msWait(automation,"case","semantic");lpSleep(500);msOriginal=msRead(automation);msRetained(msOriginal);msResult.put("original",msOriginal);
      for(int group=0;group<methods.length;group++){long begin=SystemClock.uptimeMillis();lpDeadline=lpBatchDeadline;lpCase=new JSONObject();lpCase.put("name",methods[group]);lpCase.put("actions",new JSONArray());lpCase.put("observations",new JSONArray());lpCase.put("startedEpochMs",System.currentTimeMillis());msResult.getJSONArray("cohorts").put(lpCase);
        try{if(group<3){for(int index=group*6;index<(group+1)*6;index++){msSelect(automation,index);msObserve(automation,MS_CASES[index]);}}else msContext(automation);lpCase.put("status","NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW");}
        catch(AssertionError error){failed=true;lpCase.put("status","FAILED_CASE_ASSERTION");lpCase.put("error",error.toString());try{lpWindows(automation);msRetained(msRead(automation));}catch(Throwable unsafe){safe=false;lpCase.put("continuationError",unsafe.toString());}}
        catch(Throwable error){safe=false;lpCase.put("status","INFRASTRUCTURE_OR_UNSAFE_STOP_BATCH");lpCase.put("error",error.toString());}
        finally{lpCase.put("elapsedMs",SystemClock.uptimeMillis()-begin);lpCase.put("finishedEpochMs",System.currentTimeMillis());msPersist();}if(!safe)break;
      }msResult.put("hasFailedCohorts",failed);boolean complete=safe&&!failed&&msResult.getJSONArray("cohorts").length()==methods.length;msResult.put("nativeActionSucceeded",complete);msResult.put("status",complete?"NATIVE_STYLE_COMPLETE_PENDING_HOST_REVIEW":"FAILED_OR_INCOMPLETE");
    }finally{lpPrepareLabel=previousPrepare;msResult.put("epochFinishedMs",System.currentTimeMillis());msResult.put("elapsedMs",SystemClock.uptimeMillis()-started);msPersist();}return msResult;
  }


  private Integer progressRiskTrackColor;
  public static int progressRiskContrastCount(int[] pixels,int background) {
    if(pixels==null||pixels.length==0)throw new AssertionError("Actual native center required");int count=0;for(int color:pixels)if(color!=background)count++;return count;
  }
  private int[] progressRiskCapture(UiAutomation automation,String name,boolean unknown) throws Exception {
    tgVisible(automation,"range-progress");AccessibilityNodeInfo target=fresh(automation,"range-progress");lpCheck(target!=null&&target.refresh(),"Fresh actual LinearProgress root required");JSONObject nativeValue=new JSONObject();addRawNativeFields(nativeValue,target);Rect frame=new Rect();target.getBoundsInScreen(frame);nativeValue.put("id","range-progress");nativeValue.put("bounds",frame.flattenToString());lpSemantics(nativeValue,0.,100.,unknown?null:25.,unknown?null:"25%");
    JSONObject windows=lpWindows(automation);lpCheck(lpTargets(windows)==1,"One original public LinearProgress target required");double scale=getContext().getResources().getDisplayMetrics().density;lpCheck(Math.abs(frame.height()/scale-14)<=1/scale,"Actual public progress height changed");Bitmap bitmap=automation.takeScreenshot();lpCheck(bitmap!=null&&new Rect(0,0,bitmap.getWidth(),bitmap.getHeight()).contains(frame),"Complete progress screenshot required");
    JSONObject row=new JSONObject();row.put("name",name);row.put("unknown",unknown);row.put("nativeTarget",nativeValue);row.put("windows",windows);row.put("scale",scale);row.put("captureEpochMs",System.currentTimeMillis());row.put("motionEvents",msRead(automation).getJSONArray("motionEvents"));row.put("png",name+".png");row.put("frame",new JSONArray(new int[]{frame.left,frame.top,frame.right,frame.bottom}));JSONArray samples=new JSONArray();row.put("samples",samples);
    try{savePng(bitmap,new File(msDirectory,name+".png"));row.put("screenSize",new JSONArray(new int[]{bitmap.getWidth(),bitmap.getHeight()}));int[] pixels=new int[frame.width()*frame.height()];bitmap.getPixels(pixels,0,frame.width(),frame.left,frame.top,frame.width(),frame.height());
      if(unknown){int painted=0;Rect center=new Rect((int)(frame.exactCenterX()-6*scale),(int)(frame.top+3*scale),(int)(frame.exactCenterX()+6*scale),(int)(frame.bottom-3*scale));lpCheck(frame.contains(center)&&!center.isEmpty(),"Actual unknown center crop required");lpCheck(progressRiskTrackColor!=null,"Captured actual empty-track color required");int[] centerPixels=new int[center.width()*center.height()];bitmap.getPixels(centerPixels,0,center.width(),center.left,center.top,center.width(),center.height());painted=progressRiskContrastCount(centerPixels,progressRiskTrackColor);row.put("centerBackgroundARGB",progressRiskTrackColor);lpCheck(painted>0,"Visible unknown cue must remain inside its native center");row.put("center",new JSONArray(new int[]{center.left,center.top,center.right,center.bottom}));row.put("centerPaintedPixels",painted);}
      else{AccessibilityNodeInfo reference=fresh(automation,"range-meter");lpCheck(reference!=null&&reference.refresh(),"Actual known shared-host reference required");Rect ref=new Rect();reference.getBoundsInScreen(ref);lpCheck(new Rect(0,0,bitmap.getWidth(),bitmap.getHeight()).contains(ref)&&Math.abs(frame.width()-ref.width())<=1&&Math.abs(frame.height()-ref.height())<=1,"Matched native sibling frames required");int[] colors=new int[2];for(int i=0;i<2;i++){double part=i==0?.125:.625;int x=(int)Math.floor(frame.left+frame.width()*part),y=frame.centerY(),rx=(int)Math.floor(ref.left+ref.width()*part),ry=ref.centerY();colors[i]=bitmap.getPixel(x,y);int expected=bitmap.getPixel(rx,ry);lpCheck(colors[i]==expected,"Exact original LP/Meter opaque paint differs");JSONObject sample=new JSONObject();sample.put("point",new JSONArray(new int[]{x,y}));sample.put("referencePoint",new JSONArray(new int[]{rx,ry}));sample.put("argb",colors[i]);sample.put("referenceARGB",expected);samples.put(sample);}lpCheck(colors[0]!=colors[1],"Nonvacuous actual known fill/track required");progressRiskTrackColor=colors[1];}
      lpCase.getJSONArray("observations").put(row);msPersist();return pixels;
    }finally{bitmap.recycle();}
  }
  private JSONObject linearProgressRiskBatch(UiAutomation automation) throws Exception {
    long started=SystemClock.uptimeMillis();lpBatchDeadline=meterAttemptDeadline(started,arguments.getString("attemptRemainingMs"));msResult=new JSONObject();msResult.put("operation","linear-progress-risk-batch");msResult.put("selectedMethods",new JSONArray(java.util.Arrays.asList("live-motion")));msResult.put("cohorts",new JSONArray());msResult.put("nativeActionSucceeded",false);msResult.put("status","RUNNING");String output=arguments.getString("outputDir","");String name=new File(output).getName();lpCheck(name.matches("linear-progress-risk-native-[A-Za-z0-9_-]+"),"Fresh LP risk output required");msDirectory=new File(getContext().getExternalFilesDir(null),name).getCanonicalFile();lpCheck(msDirectory.equals(new File(output).getCanonicalFile())&&!msDirectory.exists()&&msDirectory.mkdirs(),"Exact fresh LP output required");String oldTarget=lpTarget,oldName=lpName;lpTarget="range-progress";lpName="Task progress";
    try{meterSelectScene(automation,msResult);lpAdmitConnection(automation,msResult);lpCase=new JSONObject();lpCase.put("actions",new JSONArray());lpDeadline=lpBatchDeadline;tgClick(automation,"Prepare Meter styles");msWait(automation,"case","semantic");tgClick(automation,"Toggle range styles");
      long begin=SystemClock.uptimeMillis();lpDeadline=lpBatchDeadline;lpCase=new JSONObject();lpCase.put("name","live-motion");lpCase.put("actions",new JSONArray());lpCase.put("observations",new JSONArray());msResult.getJSONArray("cohorts").put(lpCase);JSONObject originals=new JSONObject();String firstError=null;boolean restored=true;
      try{for(String key:new String[]{"transition_animation_scale","animator_duration_scale"})originals.put(key,msShell(automation,"settings get global "+key));lpCase.put("originalMotionSettings",originals);progressRiskCapture(automation,"known-styled",false);int prior=msRead(automation).getJSONArray("motionEvents").length();String transition=originals.getString("transition_animation_scale");if(transition.equals("null")||Double.parseDouble(transition)!=0){msShell(automation,"settings put global transition_animation_scale 0");msMotionEvent(automation,prior,true);}prior=msRead(automation).getJSONArray("motionEvents").length();msShell(automation,"settings put global animator_duration_scale 1");msShell(automation,"settings put global transition_animation_scale 1");msMotionEvent(automation,prior,false);tgClick(automation,"Toggle unknown progress");lpSleep(500);int[] a=progressRiskCapture(automation,"moving-0",true);lpSleep(170);int[] b=progressRiskCapture(automation,"moving-1",true);lpSleep(290);int[] c=progressRiskCapture(automation,"moving-2",true);boolean moving=!java.util.Arrays.equals(a,b)||!java.util.Arrays.equals(b,c);lpCase.put("movingPixelsDiffer",moving);lpCheck(moving,"A real native unknown motion interval is required");prior=msRead(automation).getJSONArray("motionEvents").length();msShell(automation,"settings put global transition_animation_scale 0");msMotionEvent(automation,prior,true);lpSleep(500);a=progressRiskCapture(automation,"stopped-0",true);lpSleep(170);b=progressRiskCapture(automation,"stopped-1",true);lpSleep(290);c=progressRiskCapture(automation,"stopped-2",true);boolean stopped=java.util.Arrays.equals(a,b)&&java.util.Arrays.equals(b,c);lpCase.put("stoppedPixelsExact",stopped);lpCheck(stopped,"Reduced unknown cue must remain visible and static");tgClick(automation,"Toggle unknown progress");lpSleep(500);progressRiskCapture(automation,"known-restored",false);lpCase.put("status","NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW");}
      catch(Throwable error){firstError=error.toString();lpCase.put("error",firstError);lpCase.put("status","FAILED_ASSERTION");}
      finally{JSONObject actual=new JSONObject();for(String key:new String[]{"transition_animation_scale","animator_duration_scale"})if(originals.has(key))try{String v=originals.getString(key);msShell(automation,v.equals("null")?"settings delete global "+key:"settings put global "+key+" "+v);String current=msShell(automation,"settings get global "+key);actual.put(key,current);lpCheck(current.equals(v),"Original motion key restoration differs");}catch(Throwable error){restored=false;lpCase.put("restorationError",error.toString());}lpCase.put("restoredMotionSettings",actual);lpCase.put("motionRestorationVerified",restored&&originals.length()==2&&lpEqual(originals,actual));lpCase.put("elapsedMs",SystemClock.uptimeMillis()-begin);}
      boolean success=firstError==null&&lpCase.getBoolean("motionRestorationVerified")&&SystemClock.uptimeMillis()<=lpBatchDeadline;msResult.put("hasFailedCohorts",!success);msResult.put("nativeActionSucceeded",success);msResult.put("status",success?"NATIVE_COMPLETE_PENDING_HOST_REVIEW":"FAILED_OR_INCOMPLETE");
    }finally{lpTarget=oldTarget;lpName=oldName;msResult.put("elapsedMs",SystemClock.uptimeMillis()-started);msPersist();}return msResult;
  }


  public static boolean isSceneSelectionControl(String label) {return label.endsWith(" scene")&&!label.equals("Reset scene");}
  private static final String TEXT_STYLE_CONTENT="Native text remains readable: sélectionnez les paramètres et continuez lorsque vous êtes prêt.";
  private JSONObject textStyleCapture(UiAutomation automation,String name,boolean dark) throws Exception {
    AccessibilityNodeInfo target=tgVisible(automation,"library-text-preview");Rect frame=new Rect();target.getBoundsInScreen(frame);
    lpCheck(TEXT_STYLE_CONTENT.contentEquals(target.getText()==null?"":target.getText()),"Actual current public Text content required");
    lpCheck("android.widget.TextView".contentEquals(target.getClassName()),"Actual native TextView required");
    lpSleep(350);Bitmap image=automation.takeScreenshot();lpCheck(image!=null,"Actual Text screenshot required");
    try {
      lpCheck(frame.left>=0&&frame.top>=0&&frame.right<=image.getWidth()&&frame.bottom<=image.getHeight()&&!frame.isEmpty(),"Full actual Text bounds must be inside image");
      int expected=dark?0xffffffff:0xff171717,count=0;int[] crop=new int[frame.width()*frame.height()];image.getPixels(crop,0,frame.width(),frame.left,frame.top,frame.width(),frame.height());for(int pixel:crop)if(pixel==expected)count++;lpCheck(count>0,"Expected actual foreground must paint native text");
      JSONObject row=new JSONObject();row.put("name",name);row.put("text",String.valueOf(target.getText()));row.put("frame",new JSONArray(new int[]{frame.left,frame.top,frame.right,frame.bottom}));row.put("scale",getContext().getResources().getDisplayMetrics().density);row.put("expectedRGB",dark?16777215:1513239);row.put("foregroundPixels",count);row.put("className",String.valueOf(target.getClassName()));row.put("captureEpochMs",System.currentTimeMillis());row.put("imageWidth",image.getWidth());row.put("imageHeight",image.getHeight());savePng(image,new File(msDirectory,name+".png"));
      AccessibilityNodeInfo after=fresh(automation,"library-text-preview");Rect current=new Rect();lpCheck(after!=null&&after.refresh(),"Text must survive screenshot");after.getBoundsInScreen(current);lpCheck(frame.equals(current)&&TEXT_STYLE_CONTENT.contentEquals(after.getText()==null?"":after.getText()),"Text frame/content changed during capture");row.put("stableFrameAndContent",true);lpCase.getJSONArray("observations").put(row);msPersist();return row;
    }finally{image.recycle();}
  }
  private JSONObject textStyleBatch(UiAutomation automation) throws Exception {
    long started=SystemClock.uptimeMillis();lpBatchDeadline=meterAttemptDeadline(started,arguments.getString("attemptRemainingMs"));lpDeadline=lpBatchDeadline;msResult=new JSONObject();msResult.put("operation","text-style-batch");msResult.put("methodLimitMs",JSONObject.NULL);msResult.put("cohorts",new JSONArray());msResult.put("nativeActionSucceeded",false);String[] methods={"typography","provider-constraint"};msResult.put("selectedMethods",new JSONArray(java.util.Arrays.asList(methods)));String output=arguments.getString("outputDir","");String name=new File(output).getName();lpCheck(name.matches("text-style-native-[A-Za-z0-9_-]+"),"Fresh Text output required");msDirectory=new File(getContext().getExternalFilesDir(null),name).getCanonicalFile();lpCheck(msDirectory.equals(new File(output).getCanonicalFile())&&!msDirectory.exists()&&msDirectory.mkdirs(),"Fresh exact Text output required");boolean complete=false;
    try {
      meterSelectScene(automation,msResult,"Text/Button scene");
      for(String method:methods){long begin=SystemClock.uptimeMillis();lpDeadline=lpBatchDeadline;lpCase=new JSONObject();lpCase.put("name",method);lpCase.put("actions",new JSONArray());lpCase.put("observations",new JSONArray());msResult.getJSONArray("cohorts").put(lpCase);
        try {tgClick(automation,"Reset scene");lpClick(automation,"Text/Button scene");while(true){lpBound();AccessibilityNodeInfo scene=fresh(automation,"Text/Button scene");if(scene!=null&&scene.refresh()&&scene.isSelected())break;lpSleep(50);}tgClick(automation,"Light theme");tgClick(automation,"Live window");
          if(method.equals("typography")){JSONObject initial=textStyleCapture(automation,"default",false);tgClick(automation,"Toggle library styles");JSONObject custom=textStyleCapture(automation,"custom",false);lpCheck(custom.getJSONArray("frame").getInt(3)-custom.getJSONArray("frame").getInt(1)>initial.getJSONArray("frame").getInt(3)-initial.getJSONArray("frame").getInt(1),"Custom font/line height must alter actual native layout");tgClick(automation,"Clear text typography");textStyleCapture(automation,"cleared",false);tgClick(automation,"Toggle library styles");tgClick(automation,"Clear text typography");textStyleCapture(automation,"restored",false);}
          else {textStyleCapture(automation,"light",false);tgClick(automation,"Dark theme");textStyleCapture(automation,"dark",true);tgClick(automation,"Light theme");tgClick(automation,"Compact width");JSONObject compact=textStyleCapture(automation,"compact",false);lpCheck((compact.getJSONArray("frame").getInt(2)-compact.getJSONArray("frame").getInt(0))/compact.getDouble("scale")<=320,"Actual compact native Text constraint required");tgClick(automation,"Live window");textStyleCapture(automation,"live-restored",false);}
          lpCase.put("status","NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW");
        }catch(Throwable error){lpCase.put("status","FAILED_ASSERTION");lpCase.put("error",error.toString());throw error;}
        finally{lpCase.put("elapsedMs",SystemClock.uptimeMillis()-begin);msPersist();}
      }complete=true;
    }finally{msResult.put("hasFailedCohorts",!complete);msResult.put("nativeActionSucceeded",complete);msResult.put("status",complete?"NATIVE_COMPLETE_PENDING_HOST_REVIEW":"FAILED_OR_INCOMPLETE");msResult.put("elapsedMs",SystemClock.uptimeMillis()-started);msPersist();}return msResult;
  }


  public static boolean circularPixelsMatch(int[] actual,int[] expected){return actual!=null&&expected!=null&&actual.length>0&&java.util.Arrays.equals(actual,expected);}
  private static final String[] CIRCULAR_CASES={"quarter","zero","full","lower-clamp","upper-clamp","empty-range","half","reverse","round","square","wide","zero-width","zero-height","six-slots","named-paint","current-color","context-label","empty-label","node-label","unknown"};
  private JSONObject circularRead(UiAutomation automation) throws Exception {
    lpBound();AccessibilityNodeInfo marker=fresh(automation,"circular-native-state");lpCheck(marker!=null&&marker.refresh()&&marker.getContentDescription()!=null,"Actual CircularProgress fixture state required");return new JSONObject(marker.getContentDescription().toString());
  }
  private JSONObject circularWait(UiAutomation automation,String field,Object expected) throws Exception {
    while(true){lpBound();JSONObject state=circularRead(automation);if(lpEqual(state.opt(field),expected))return state;lpSleep(25);}
  }
  private void circularSelect(UiAutomation automation,int index) throws Exception {
    for(int count=0;count<=CIRCULAR_CASES.length;count++){JSONObject state=circularRead(automation);int current=state.getInt("index");if(current==index){lpCheck(CIRCULAR_CASES[index].equals(state.getString("case")),"Actual CircularProgress case identity differs");return;}tgClick(automation,"Next CircularProgress check");circularWait(automation,"index",(current+1)%CIRCULAR_CASES.length);}throw new AssertionError("CircularProgress selection did not converge");
  }
  private JSONObject circularCapture(UiAutomation automation,String name,long rootTag) throws Exception {
    tgVisible(automation,"circular-native-pair");lpSleep(500);JSONObject state=circularRead(automation);int index=state.getInt("index");
    lpCheck(state.getLong("rootTag")==rootTag&&state.getInt("detaches")==0,"Actual public CircularProgress ref changed during updates");
    JSONObject event=state.getJSONObject("layouts").getJSONObject("target"),layout=event.getJSONObject("layout");double density=getContext().getResources().getDisplayMetrics().density;
    lpCheck(event.getLong("target")==rootTag&&event.getLong("currentTarget")==rootTag,"Delivered native layout target differs from public ref");
    lpCheck(Math.abs(layout.getDouble("width")-state.getDouble("width"))*density<=1&&Math.abs(layout.getDouble("height")-state.getDouble("height"))*density<=1,"Actual root dimensions differ from authored/final style");
    AccessibilityNodeInfo parent=tgVisible(automation,"circular-native-parent"),reference=tgVisible(automation,"circular-native-reference-parent"),target=fresh(automation,"circular-native-target");Rect a=new Rect(),b=new Rect();parent.getBoundsInScreen(a);reference.getBoundsInScreen(b);
    Bitmap image=automation.takeScreenshot();lpCheck(image!=null,"Actual CircularProgress PNG required");JSONObject row=new JSONObject();row.put("name",name);row.put("state",state);row.put("scale",density);row.put("nativeParent",tgNode(parent));row.put("nativeReferenceParent",tgNode(reference));row.put("nativeTarget",target==null?JSONObject.NULL:tgNode(target));row.put("captureEpochMs",System.currentTimeMillis());row.put("png",name+".png");lpCase.getJSONArray("observations").put(row);
    try {savePng(image,new File(msDirectory,name+".png"));lpCheck(a.width()==b.width()&&a.height()==b.height()&&a.left>=0&&a.top>=0&&a.right<=image.getWidth()&&a.bottom<=image.getHeight()&&b.right<=image.getWidth()&&b.bottom<=image.getHeight(),"Full matched native drawing parents required");int[] actual=new int[a.width()*a.height()],expected=new int[actual.length];image.getPixels(actual,0,a.width(),a.left,a.top,a.width(),a.height());image.getPixels(expected,0,b.width(),b.left,b.top,b.width(),b.height());int ink=0;for(int color:actual)if(android.graphics.Color.red(color)<245||android.graphics.Color.green(color)<245||android.graphics.Color.blue(color)<245)ink++;boolean exact=circularPixelsMatch(actual,expected);row.put("referenceExact",exact);row.put("inkPixels",ink);row.put("imageWidth",image.getWidth());row.put("imageHeight",image.getHeight());
      if(index!=11&&index!=12&&index!=16)lpCheck(ink>0&&exact,"Actual CircularProgress SVG differs from independent primitive reference: "+CIRCULAR_CASES[index]);if(index==11||index==12)lpCheck(ink==0,"Zero dimension must not paint neighboring geometry");
      if(target!=null&&target.refresh()&&index!=11&&index!=12){String description=String.valueOf(target.getContentDescription());lpCheck(description.contains(index==16?"Scoped circular task":"Circular verification"),"Current native CircularProgress name required");AccessibilityNodeInfo.RangeInfo range=target.getRangeInfo();if(index==5||index==19)lpCheck(range==null,"Invalid/unknown numeric range must be omitted");else{lpCheck(range!=null,"Actual native ProgressBar range required");double current=index==1||index==3?0:index==2||index==4?100:25;lpCheck(range.getCurrent()==current&&range.getMin()==0&&range.getMax()==(index==16?200:100),"Current native CircularProgress range differs");}if(index==18)lpCheck(description.contains("[object Object]"),"ReactNode remains semantic data");}
      lpCheck(fresh(automation,"Semantic node stays unmounted")==null,"Semantic ReactNode was mounted as content");
    } finally{image.recycle();msPersist();}return row;
  }
  private JSONObject circularMotion(UiAutomation automation,String label,boolean reduced) throws Exception {
    tgVisible(automation,"circular-native-pair");AccessibilityNodeInfo arm=fresh(automation,"Arm CircularProgress interruption and retirement"),scroll=fresh(automation,"showcase-scroll"),parent=fresh(automation,"circular-native-parent"),reference=fresh(automation,"circular-native-reference-parent");lpCheck(whollyVisible(arm,scroll)&&whollyVisible(parent,scroll),"Arm control and drawing must be ready together before timers");Rect a=new Rect(),b=new Rect();parent.getBoundsInScreen(a);reference.getBoundsInScreen(b);JSONObject before=circularRead(automation);tgClick(automation,"Arm CircularProgress interruption and retirement");long until=SystemClock.uptimeMillis()+10000;JSONArray samples=new JSONArray();lpCase.put(label+"Samples",samples);
    while(SystemClock.uptimeMillis()<until){lpBound();long start=System.currentTimeMillis();Bitmap image=automation.takeScreenshot();lpCheck(image!=null,"Actual native motion frame required");try{int[] actual=new int[a.width()*a.height()],expected=new int[actual.length];image.getPixels(actual,0,a.width(),a.left,a.top,a.width(),a.height());image.getPixels(expected,0,b.width(),b.left,b.top,b.width(),b.height());int ink=0;for(int color:actual)if(android.graphics.Color.red(color)<245||android.graphics.Color.green(color)<245||android.graphics.Color.blue(color)<245)ink++;JSONObject row=new JSONObject();row.put("captureStartedEpochMs",start);row.put("captureEpochMs",System.currentTimeMillis());row.put("inkPixels",ink);row.put("referenceExact",circularPixelsMatch(actual,expected));String png=label+"-"+samples.length()+".png";row.put("png",png);savePng(image,new File(msDirectory,png));samples.put(row);}finally{image.recycle();}lpSleep(100);}
    JSONObject end=circularRead(automation);JSONArray scheduled=end.getJSONArray("scheduled");String[] kinds={"to-full","supersede-ten","to-sixty","to-twenty","to-ninety","retire","reinsert-zero"};lpCheck(scheduled.length()==kinds.length,"All actual owner deliveries required");for(int n=0;n<kinds.length;n++)lpCheck(kinds[n].equals(scheduled.getJSONObject(n).getString("kind")),"Actual timer order differs");long first=scheduled.getJSONObject(0).getLong("epochMs"),retired=scheduled.getJSONObject(5).getLong("epochMs");int moving=0;boolean intermediate=false,absent=false;
    for(int n=0;n<samples.length();n++){JSONObject row=samples.getJSONObject(n);if(row.getInt("inkPixels")==0)absent=true;if(row.getLong("captureStartedEpochMs")>=first&&row.getLong("captureEpochMs")<retired){moving++;if(!row.getBoolean("referenceExact"))intermediate=true;}}
    lpCheck(moving>2&&(!reduced?intermediate:!intermediate),"Actual discriminating moving/reduced frames required");lpCheck(absent&&end.getInt("value")==0&&end.getBoolean("visible")&&end.getInt("detaches")==before.getInt("detaches")+1&&end.getInt("attaches")==before.getInt("attaches")+1&&end.getLong("rootTag")!=before.getLong("rootTag"),"Original retirement and fresh zero required");lpCase.put(label+"FinalState",end);return end;
  }
  private JSONObject circularProgressBatch(UiAutomation automation) throws Exception {
    long started=SystemClock.uptimeMillis();lpBatchDeadline=meterAttemptDeadline(started,arguments.getString("attemptRemainingMs"));lpDeadline=lpBatchDeadline;msResult=new JSONObject();msResult.put("operation","circular-progress-batch");msResult.put("methodLimitMs",JSONObject.NULL);msResult.put("cohorts",new JSONArray());msResult.put("nativeActionSucceeded",false);String[] methods={"geometry-semantics-slots","providers-constraint","interruption-retirement"};msResult.put("selectedMethods",new JSONArray(java.util.Arrays.asList(methods)));String output=arguments.getString("outputDir","");String name=new File(output).getName();lpCheck(name.matches("circular-progress-native-[A-Za-z0-9_-]+"),"Fresh CircularProgress output required");msDirectory=new File(getContext().getExternalFilesDir(null),name).getCanonicalFile();lpCheck(msDirectory.equals(new File(output).getCanonicalFile())&&!msDirectory.exists()&&msDirectory.mkdirs(),"Fresh owned exact CircularProgress output required");boolean complete=false;
    try {meterSelectScene(automation,msResult,"Circular/Counter scene");
      for(String method:methods){long begin=SystemClock.uptimeMillis();lpCase=new JSONObject();lpCase.put("name",method);lpCase.put("actions",new JSONArray());lpCase.put("observations",new JSONArray());msResult.getJSONArray("cohorts").put(lpCase);
        try {tgClick(automation,"Reset scene");tgClick(automation,"Circular/Counter scene");tgClick(automation,"Light theme");tgClick(automation,"Live window");tgClick(automation,"Prepare CircularProgress checks");JSONObject initial=circularWait(automation,"case","quarter");while(initial.isNull("rootTag")||!initial.getJSONObject("layouts").has("target")){lpSleep(50);initial=circularRead(automation);}long tag=initial.getLong("rootTag");
          if(method.equals("geometry-semantics-slots")){for(int index=0;index<CIRCULAR_CASES.length;index++){circularSelect(automation,index);circularCapture(automation,CIRCULAR_CASES[index],tag);}}
          else if(method.equals("providers-constraint")){circularCapture(automation,"light",tag);tgClick(automation,"Dark theme");circularWait(automation,"mode","dark");circularCapture(automation,"dark",tag);tgClick(automation,"Compact width");circularCapture(automation,"compact",tag);tgClick(automation,"Live window");circularCapture(automation,"live-restored",tag);tgClick(automation,"Change CircularProgress value");circularWait(automation,"value",75);lpSleep(500);AccessibilityNodeInfo target=fresh(automation,"circular-native-target");lpCheck(target!=null&&target.refresh()&&target.getRangeInfo()!=null&&target.getRangeInfo().getCurrent()==75,"Latest native caller value75 required");}
          else {String original=msShell(automation,"settings get global transition_animation_scale");lpCase.put("originalMotionSetting",original);msShell(automation,"settings put global transition_animation_scale 1");JSONObject normal=circularMotion(automation,"motion",false);int count=normal.getJSONArray("motionEvents").length();msShell(automation,"settings put global transition_animation_scale 0");while(true){lpBound();JSONArray events=circularRead(automation).getJSONArray("motionEvents");if(events.length()>count&&events.getBoolean(events.length()-1))break;lpSleep(50);}circularMotion(automation,"reduced",true);msShell(automation,original.equals("null")?"settings delete global transition_animation_scale":"settings put global transition_animation_scale "+original);lpCheck(original.equals(msShell(automation,"settings get global transition_animation_scale")),"Exact motion restoration required");lpCase.put("motionRestorationVerified",true);
          }lpCase.put("status","NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW");
        }catch(Throwable error){lpCase.put("status","FAILED_ASSERTION");lpCase.put("error",error.toString());throw error;}finally{lpCase.put("elapsedMs",SystemClock.uptimeMillis()-begin);msPersist();}
      }complete=true;
    }finally{msResult.put("hasFailedCohorts",!complete);msResult.put("nativeActionSucceeded",complete);msResult.put("status",complete?"NATIVE_COMPLETE_PENDING_HOST_REVIEW":"FAILED_OR_INCOMPLETE");msResult.put("elapsedMs",SystemClock.uptimeMillis()-started);msPersist();}return msResult;
  }

  private boolean tgHasAction(JSONArray values,int action) throws Exception{for(int i=0;i<values.length();i++)if(values.getInt(i)==action)return true;return false;}
  private File tgDirectory;
  private JSONObject tgResult;
  private AccessibilityNodeInfo tgMarker,tgOriginal;
  private static final String TG_TARGET="tag-example",TG_STATIC="tag-status",TG_STATE="tag-state";
  private void tgPersist() throws Exception{writeJson(tgDirectory,"receipt.json",tgResult);}
  private JSONObject tgNode(AccessibilityNodeInfo node) throws Exception {
    if(node==null||!node.refresh())throw new IllegalStateException("Actual Tag node refresh required");JSONObject row=new JSONObject();addRawNativeFields(row,node);Rect frame=new Rect();node.getBoundsInScreen(frame);row.put("id",node.getViewIdResourceName());row.put("bounds",frame.flattenToString());row.put("enabled",node.isEnabled());row.put("clickable",node.isClickable());row.put("checkable",node.isCheckable());row.put("checked",node.isChecked());row.put("windowId",node.getWindowId());row.put("text",node.getText()==null?JSONObject.NULL:node.getText().toString());JSONArray actions=new JSONArray();for(AccessibilityNodeInfo.AccessibilityAction action:node.getActionList())actions.put(action.getId());row.put("actions",actions);return row;
  }
  private String tgField(String raw,String pattern) {
    java.util.regex.Matcher match=java.util.regex.Pattern.compile(pattern).matcher(raw);if(!match.find())throw new IllegalStateException("Unrecognized actual Tag readout: "+raw+" / "+pattern);return match.group(1);
  }
  private JSONObject tgRead() throws Exception {
    if(tgMarker==null||!tgMarker.refresh()||!TG_STATE.equals(tgMarker.getViewIdResourceName())||tgMarker.getText()==null)throw new IllegalStateException("Retained original Tag state marker must refresh; no stale fallback");String raw=tgMarker.getText().toString();JSONObject row=new JSONObject();row.put("rawText",raw);row.put("owner",Boolean.parseBoolean(tgField(raw,"Owner: (true|false)\\.")));row.put("echo",Boolean.parseBoolean(tgField(raw,"Echo: (true|false)\\.")));row.put("requests",Integer.parseInt(tgField(raw,"Requests: ([0-9]+)\\.")));row.put("last",tgField(raw,"Last: (.*?)\\. ID:"));row.put("id",tgField(raw,"ID: (.*?)\\. Exposed:"));row.put("exposed",tgField(raw,"Exposed: (.*?)\\. Size:"));row.put("size",tgField(raw,"Size: (.*?)\\. Geometry:"));row.put("armed",Boolean.parseBoolean(tgField(raw,"Armed guard: (true|false)\\.")));java.util.regex.Matcher frame=java.util.regex.Pattern.compile("Frame: ([0-9.]+) x ([0-9.]+)\\. Armed guard:").matcher(raw);if(frame.find()){row.put("frameWidth",Double.parseDouble(frame.group(1)));row.put("frameHeight",Double.parseDouble(frame.group(2)));}row.put("nativeEpochMs",System.currentTimeMillis());row.put("nativeUptimeMs",SystemClock.uptimeMillis());return row;
  }
  private JSONObject tgWait(String key,Object value) throws Exception {
    long until=lpDeadline;JSONObject row=null;while(SystemClock.uptimeMillis()<until){lpBound();row=tgRead();if(lpEqual(row.opt(key),value))return row;SystemClock.sleep(25);}throw new AssertionError("Actual Tag acknowledgment missing: "+key+"="+value+" last="+row);
  }
  private JSONObject tgQuiet(int requests,boolean owner) throws Exception {
    lpSleep(750);JSONObject row=tgRead();lpCheck(row.getInt("requests")==requests&&row.getBoolean("owner")==owner,"Programmatic/quiet interval fabricated a business request or changed owner");return row;
  }
  private void tgShot(UiAutomation automation,String filename) throws Exception {Bitmap image=automation.takeScreenshot();if(image==null)throw new IllegalStateException("Actual Tag screenshot required");try{savePng(image,new File(tgDirectory,filename));}finally{image.recycle();}}
  private JSONObject tgObserve(UiAutomation automation,String name) throws Exception {
    AccessibilityNodeInfo node=tgVisible(automation,TG_TARGET);JSONObject row=new JSONObject();row.put("name",name);row.put("captureStartedEpochMs",System.currentTimeMillis());row.put("state",tgRead());row.put("target",tgNode(node));row.put("sameNativeAXSource",tgOriginal!=null&&tgOriginal.equals(node));row.put("windows",lpWindows(automation));AccessibilityNodeInfo scroll=fresh(automation,"showcase-scroll");row.put("scroll",tgNode(scroll));String file=lpCase.getString("name")+"-"+name+".png";tgShot(automation,file);row.put("png",file);row.put("captureFinishedEpochMs",System.currentTimeMillis());lpCase.getJSONArray("observations").put(row);tgPersist();return row;
  }
  private void tgPress(UiAutomation automation,String label) throws Exception {
    AccessibilityNodeInfo node=tgVisible(automation,label);Rect frame=new Rect();node.getBoundsInScreen(frame);physicalSwipe(automation,frame,200,lpDeadline,lpActions(),label);
  }
  private JSONObject tgPrepare(UiAutomation automation) throws Exception {
    tgMarker=null;tgOriginal=null;tgClick(automation,"Indicator/Segment scene");tgClick(automation,"Tag scene");tgMarker=AccessibilityNodeInfo.obtain(tgVisible(automation,TG_STATE));tgOriginal=AccessibilityNodeInfo.obtain(tgVisible(automation,TG_TARGET));JSONObject row=tgWait("requests",0);lpCheck(!row.getBoolean("owner")&&row.getBoolean("echo")&&!row.getBoolean("armed")&&"number 0".equals(row.getString("id"))&&"default".equals(row.getString("exposed")),"Fresh actual cached TagScene defaults required");lpCase.put("prepared",row);return row;
  }
  private void tgBaseline(UiAutomation automation) throws Exception {
    tgPrepare(automation);tgObserve(automation,"initial");AccessibilityNodeInfo passive=tgVisible(automation,TG_STATIC);JSONObject staticValue=tgNode(passive);lpCase.put("staticNode",staticValue);lpCheck(!staticValue.getBoolean("clickable")&&!tgHasAction(staticValue.getJSONArray("actions"),AccessibilityNodeInfo.ACTION_CLICK),"Static Tag must expose no native click action");tgPress(automation,TG_STATIC);tgQuiet(0,false);tgObserve(automation,"static-quiet");
    tgPress(automation,TG_TARGET);tgWait("requests",1);tgWait("owner",true);tgObserve(automation,"first-action");tgClick(automation,"Toggle tag owner echo");tgWait("echo",false);tgClick(automation,"Toggle tag owner value");tgWait("owner",false);tgQuiet(1,false);tgObserve(automation,"veto-owner-false");
    tgPress(automation,TG_TARGET);tgWait("requests",2);tgQuiet(2,false);tgObserve(automation,"veto-first");tgPress(automation,TG_TARGET);tgWait("requests",3);tgQuiet(3,false);tgObserve(automation,"veto-second");
    tgClick(automation,"Toggle tag owner value");tgWait("owner",true);tgClick(automation,"Next tag accessibility override");tgWait("exposed","false");tgQuiet(3,true);tgObserve(automation,"alias-false");tgPress(automation,TG_TARGET);tgWait("requests",4);tgQuiet(4,true);tgObserve(automation,"alias-request");for(int i=0;i<3;i++)tgClick(automation,"Next tag accessibility override");tgWait("exposed","default");tgQuiet(4,true);tgObserve(automation,"alias-default");
  }
  private void tgHeld(UiAutomation automation,boolean takeover) throws Exception {
    AccessibilityNodeInfo node=tgVisible(automation,TG_TARGET);Rect frame=new Rect();node.getBoundsInScreen(frame);JSONObject before=tgRead(),row=new JSONObject();row.put("before",before);row.put("takeover",takeover);row.put("bounds",frame.flattenToString());row.put("pointerId",0);row.put("toolType",MotionEvent.TOOL_TYPE_FINGER);row.put("source",InputDevice.SOURCE_TOUCHSCREEN);lpCase.getJSONArray("contacts").put(row);long down=SystemClock.uptimeMillis();boolean attempted=false,released=false;
    try{attempted=true;row.put("downUptimeMs",down);boolean accepted=injectContact(automation,down,MotionEvent.ACTION_DOWN,frame.centerX(),frame.centerY());row.put("downAccepted",accepted);lpCheck(accepted,"Actual finger DOWN rejected");if(takeover){long until=lpDeadline;boolean seen=false;while(SystemClock.uptimeMillis()<until){AccessibilityNodeInfo current=fresh(automation,TG_TARGET);JSONObject state=tgRead();if(current!=null&&current.refresh()&&!current.isEnabled()&&!state.getBoolean("armed")){row.put("heldState",state);row.put("heldTarget",tgNode(current));seen=true;break;}lpSleep(25);}lpCheck(seen,"Disabled owner takeover must be observed before UP");}else lpSleep(150);
      String held=lpCase.getString("name")+(takeover?"-takeover-held.png":"-cancel-held.png");tgShot(automation,held);row.put("heldPNG",held);row.put("heldSnapshotFinishedUptimeMs",SystemClock.uptimeMillis());int action=takeover?MotionEvent.ACTION_UP:MotionEvent.ACTION_CANCEL;row.put("releaseAction",action);row.put("releaseUptimeMs",SystemClock.uptimeMillis());boolean releasedAccepted=injectContact(automation,down,action,frame.centerX(),frame.centerY());row.put("releaseAccepted",releasedAccepted);released=releasedAccepted;lpCheck(releasedAccepted,"Owned contact release/cancel rejected");
    }finally{if(attempted&&!released){row.put("finallyCancelAttempted",true);try{row.put("finallyCancelAccepted",injectContact(automation,down,MotionEvent.ACTION_CANCEL,frame.centerX(),frame.centerY()));}catch(Throwable error){row.put("contactCleanupError",error.toString());throw error;}}row.put("finishedUptimeMs",SystemClock.uptimeMillis());tgPersist();}
    row.put("after",tgQuiet(before.getInt("requests"),before.getBoolean("owner")));tgPersist();
  }
  private void tgGuard(UiAutomation automation) throws Exception {
    tgPrepare(automation);tgObserve(automation,"initial");tgClick(automation,"Toggle tag disabled");tgPress(automation,TG_TARGET);tgQuiet(0,false);tgObserve(automation,"disabled-contact");tgClick(automation,"Toggle tag owner value");tgWait("owner",true);tgQuiet(0,true);tgObserve(automation,"disabled-programmatic-owner");tgClick(automation,"Toggle tag owner value");tgWait("owner",false);tgClick(automation,"Toggle tag disabled");tgClick(automation,"Arm tag disable during press");tgWait("armed",true);tgHeld(automation,true);tgObserve(automation,"takeover-released");tgClick(automation,"Toggle tag disabled");tgHeld(automation,false);tgObserve(automation,"canceled");tgPress(automation,TG_TARGET);tgWait("requests",1);tgWait("owner",true);tgObserve(automation,"fresh-action");
    AccessibilityNodeInfo old=AccessibilityNodeInfo.obtain(tgOriginal);tgClick(automation,"Indicator/Segment scene");JSONObject retired=new JSONObject();lpCase.put("retirement",retired);retired.put("windows",lpWindows(automation));lpCheck(fresh(automation,TG_TARGET)==null&&fresh(automation,TG_STATE)==null,"Old actual Tag hosts remain after scene teardown");retired.put("oldNodeRefresh",old.refresh());retired.put("absent",true);lpSleep(750);retired.put("quietWindows",lpWindows(automation));lpCheck(fresh(automation,TG_TARGET)==null&&fresh(automation,TG_STATE)==null,"Retired Tag reappeared during quiet interval");retired.put("quietAbsent",true);retired.put("scope","Actual native scene teardown/absence only; JS ref and retired callback contracts reuse bound source assertions, not invented fixture counters");tgClick(automation,"Tag scene");tgMarker=AccessibilityNodeInfo.obtain(tgVisible(automation,TG_STATE));tgOriginal=AccessibilityNodeInfo.obtain(tgVisible(automation,TG_TARGET));tgQuiet(0,false);tgObserve(automation,"reentry-quiet");tgPress(automation,TG_TARGET);tgWait("requests",1);tgWait("owner",true);tgObserve(automation,"reentry-first-action");
  }
  private void tgLong(UiAutomation automation) throws Exception {
    tgPrepare(automation);tgObserve(automation,"short-baseline");tgClick(automation,"Toggle long tag label");tgClick(automation,"Toggle tag width constraint");tgWait("size","140");tgQuiet(0,false);tgObserve(automation,"long-before-first-action");tgPress(automation,TG_TARGET);tgWait("requests",1);tgWait("owner",true);tgObserve(automation,"long-first-action");lpCase.put("requiredVisualReview","Original PNG must show the full French label wrapping and reachable unclipped first action; explicit Controlled tag AX label may collapse child text. No OCR/decoder or source-only label verdict is substituted.");
  }
  private JSONObject tgStartupWindows(UiAutomation automation) throws Exception {
    JSONObject value=new JSONObject();JSONArray nodes=new JSONArray();int roots=0;
    for(android.view.accessibility.AccessibilityWindowInfo window:automation.getWindows()){AccessibilityNodeInfo root=window.getRoot();if(root!=null){roots++;snapshot(root,nodes,window.getId());}}
    if(roots==0){AccessibilityNodeInfo root=automation.getRootInActiveWindow();if(root!=null){roots++;snapshot(root,nodes,root.getWindowId());}}
    value.put("windowRoots",roots);value.put("windowNodes",nodes);value.put("nativeEpochMs",System.currentTimeMillis());value.put("nativeUptimeMs",SystemClock.uptimeMillis());return value;
  }
  private boolean tgStartupAnr(UiAutomation automation,JSONObject setup,JSONObject windows) throws Exception {
    JSONArray nodes=windows.getJSONArray("windowNodes");JSONObject title=null,wait=null;int titles=0,waits=0,alerts=0;
    for(int i=0;i<nodes.length();i++){JSONObject node=nodes.getJSONObject(i);String text=node.optString("text","");if(text.contains("isn't responding")){alerts++;if("android:id/alertTitle".equals(node.optString("id"))&&"System UI isn't responding".equals(text)){title=node;titles++;}}
      if("android:id/aerr_wait".equals(node.optString("id"))&&"Wait".equals(text)&&node.optBoolean("enabled")&&node.optBoolean("visible")){wait=node;waits++;}}
    if(alerts==0)return false;
    if(setup.optBoolean("systemUIWaitUsed")||tgResult.optBoolean("systemUIWaitUsed")||alerts!=1||titles!=1||waits!=1||title.getInt("windowId")!=wait.getInt("windowId"))throw new IllegalStateException("Only one exact stock System UI Wait is admitted before component input; recurring/other ANR stops");
    setup.put("systemUIWaitUsed",true);tgResult.put("systemUIWaitUsed",true);JSONObject recovery=new JSONObject();setup.put("systemUIRecovery",recovery);recovery.put("beforeWindows",windows);recovery.put("title",title);recovery.put("wait",wait);String image="setup-systemui-before-wait.png";tgShot(automation,image);recovery.put("png",image);tgPersist();Rect frame=Rect.unflattenFromString(wait.getString("bounds"));if(frame==null||frame.isEmpty())throw new IllegalStateException("Actual stock Wait bounds required");physicalSwipe(automation,frame,200,lpDeadline,lpActions(),"one startup SystemUI Wait");recovery.put("accepted",true);
    long until=lpDeadline;while(SystemClock.uptimeMillis()<until){JSONObject after=tgStartupWindows(automation);recovery.put("lastWindows",after);boolean alert=false;JSONArray rows=after.getJSONArray("windowNodes");for(int i=0;i<rows.length();i++)if(rows.getJSONObject(i).optString("text","").contains("isn't responding"))alert=true;if(!alert){recovery.put("clearedUptimeMs",SystemClock.uptimeMillis());tgPersist();return true;}lpSleep(100);}throw new IllegalStateException("Stock Wait did not clear exact setup ANR before the admitted work deadline; no retry");
  }
  private static String tagOutputName(String remote) {
    String prefix="/sdcard/Android/data/dev.codonui.lab.number/files/";
    if(!remote.startsWith(prefix))throw new IllegalArgumentException("Owned Tag output root required");
    String name=remote.substring(prefix.length());if(!name.matches("tag-g02-native-[A-Za-z0-9-]{1,80}"))throw new IllegalArgumentException("Fresh bounded Tag output name required");return name;
  }
  private interface SceneSelectionObservation { boolean selected() throws Exception; }
  private static void awaitSceneSelection(SceneSelectionObservation observation,java.util.function.LongSupplier clock,java.util.function.LongConsumer pause,long deadline) throws Exception {
    while(clock.getAsLong()<deadline){
      boolean selected=observation.selected();
      if(selected&&clock.getAsLong()<deadline)return;
      long remaining=deadline-clock.getAsLong();if(remaining>0)pause.accept(Math.min(100,remaining));
    }
    throw new IllegalStateException("Actual selected scene acknowledgement missing before the admitted work deadline after one accepted action");
  }
  private void tgAwaitSelectedScene(UiAutomation automation,String label,JSONObject action) throws Exception {
    long until=lpDeadline;JSONArray observations=new JSONArray();action.put("selectionObservations",observations);action.put("selectionDeadlineUptimeMs",until);
    awaitSceneSelection(()->{
      lpBound();AccessibilityNodeInfo current=fresh(automation,label);boolean refreshed=current!=null&&current.refresh();boolean selected=refreshed&&current.isSelected();boolean actual=refreshed&&"dev.codonui.showcase".contentEquals(current.getPackageName()==null?"":current.getPackageName())&&label.contentEquals(current.getContentDescription()==null?"":current.getContentDescription())&&current.isEnabled()&&current.isVisibleToUser();JSONObject row=new JSONObject();row.put("nativeUptimeMs",SystemClock.uptimeMillis());row.put("refreshed",refreshed);row.put("selected",selected);row.put("actualNamedControl",actual);observations.put(row);tgPersist();return actual&&selected;
    },SystemClock::uptimeMillis,SystemClock::sleep,until);
    action.put("selectionAcknowledgedUptimeMs",SystemClock.uptimeMillis());tgPersist();
  }
  private JSONObject tgSetupNode(AccessibilityNodeInfo node) throws Exception {JSONObject value=tgNode(node);value.put("packageName",node.getPackageName()==null?JSONObject.NULL:node.getPackageName().toString());return value;}
  private void tgConnectionSetup(UiAutomation automation,long started) throws Exception {tgConnectionSetup(automation,started,"Tag scene",TG_STATE,TG_TARGET,false);}
  private void tgConnectionSetup(UiAutomation automation,long started,String sceneLabel,String stateId,String targetId,boolean placeholderSetup) throws Exception {
    lpDeadline=lpBatchDeadline;JSONObject setup=new JSONObject();tgResult.put("setup",setup);setup.put("status","RUNNING");setup.put("deadlineUptimeMs",lpDeadline);setup.put("startedUptimeMs",SystemClock.uptimeMillis());setup.put("systemUIWaitUsed",false);setup.put("componentInputBeforeAdmission",false);setup.put("connectionCount",1);setup.put("actions",new JSONArray());lpCase=setup;
    try {
      long rootUntil=lpDeadline;JSONObject initial=null;int queries=0;
      while(SystemClock.uptimeMillis()<rootUntil){lpBound();initial=tgStartupWindows(automation);queries++;setup.put("initialWindows",initial);if(initial.getInt("windowRoots")>0){tgStartupAnr(automation,setup,initial);break;}lpSleep(100);}
      setup.put("initialRootQueries",queries);if(initial==null||initial.getInt("windowRoots")==0)throw new IllegalStateException("No actual native app root within15s; no input");
      tgClick(automation,sceneLabel);AccessibilityNodeInfo currentScene=fresh(automation,sceneLabel);if(currentScene==null||!currentScene.refresh()||!currentScene.isSelected())throw new IllegalStateException("Actual selected Tag scene required after single native selection");AccessibilityNodeInfo scene=AccessibilityNodeInfo.obtain(currentScene);
      tgMarker=AccessibilityNodeInfo.obtain(placeholderSetup?lpVisible(automation,stateId):tgVisible(automation,stateId));tgOriginal=AccessibilityNodeInfo.obtain(placeholderSetup?lpVisible(automation,targetId):tgVisible(automation,targetId));long clearSince=-1;int clearQueries=0;
      while(SystemClock.uptimeMillis()<lpDeadline){lpBound();JSONObject windows=tgStartupWindows(automation);if(tgStartupAnr(automation,setup,windows)){clearSince=-1;continue;}if(windows.getInt("windowRoots")==0){clearSince=-1;lpSleep(100);continue;}
        if(!scene.refresh()||!scene.isSelected()||!tgOriginal.refresh()||!tgMarker.refresh())throw new IllegalStateException("Actual selected scene/target/state source retired during setup");AccessibilityNodeInfo scroll=fresh(automation,"showcase-scroll");if(scroll==null||!scroll.refresh()||!scroll.isEnabled()||!whollyVisible(tgOriginal,scroll))throw new IllegalStateException("Actual target/viewport not responsive and wholly visible during setup");
        JSONObject observation=new JSONObject();observation.put("windows",lpWindows(automation));observation.put("scene",tgSetupNode(scene));observation.put("target",tgSetupNode(tgOriginal));observation.put("marker",tgSetupNode(tgMarker));observation.put("viewport",tgSetupNode(scroll));observation.put("state",placeholderSetup?phtState(automation):tgRead());observation.put("nativeUptimeMs",SystemClock.uptimeMillis());if(clearSince<0){clearSince=observation.getLong("nativeUptimeMs");setup.put("firstClearObservation",observation);}setup.put("lastClearObservation",observation);long observedElapsed=observation.getLong("nativeUptimeMs")-clearSince;clearQueries++;setup.put("clearQueries",clearQueries);setup.put("clearObservedMs",observedElapsed);tgPersist();
        if(observedElapsed>=30000){setup.put("status","READY_FROM_ACTUAL_SINGLE_CONNECTION");long finishedUptimeMs=SystemClock.uptimeMillis();setup.put("finishedUptimeMs",finishedUptimeMs);setup.put("elapsedMs",finishedUptimeMs-setup.getLong("startedUptimeMs"));setup.put("nativeInputCounts",new JSONObject().put("sceneSelections",1).put("componentContacts",0).put("systemUIWait",setup.optBoolean("systemUIWaitUsed")?1:0));tgResult.put("connectionAdmission","READY_FROM_ACTUAL_NEW_CONNECTION");tgPersist();return;}lpSleep(250);
      }
      throw new IllegalStateException("No actual selected Tag/target/state/viewport clear30s interval within90s setup bound");
    } catch(Throwable error){setup.put("status","FAILED");setup.put("error",error.toString());long finishedUptimeMs=SystemClock.uptimeMillis();setup.put("finishedUptimeMs",finishedUptimeMs);setup.put("elapsedMs",finishedUptimeMs-setup.getLong("startedUptimeMs"));try{setup.put("failureWindows",tgStartupWindows(automation));tgShot(automation,"setup-failure.png");}catch(Throwable capture){setup.put("failureCaptureError",capture.toString());}tgPersist();throw error;}
  }

  private JSONObject tagG02Batch(UiAutomation automation) throws Exception {
    long started=SystemClock.uptimeMillis();lpBatchDeadline=meterAttemptDeadline(started,arguments.getString("attemptRemainingMs"));tgResult=new JSONObject();tgResult.put("operation","tag-g02-batch");tgResult.put("methodLimitMs",JSONObject.NULL);tgResult.put("batchLimitMs",lpBatchDeadline-started);tgResult.put("epochStartedMs",System.currentTimeMillis());tgResult.put("nativeActionSucceeded",false);tgResult.put("status","STOP_UNSAFE");JSONArray cohorts=new JSONArray();tgResult.put("cohorts",cohorts);String[] names={"baseline-actions","guard-cancel-lifetime","long-label-wrap"};boolean safe=true,failed=false;
    String remote=arguments.getString("outputDir","");String outputName=tagOutputName(remote);File external=getContext().getExternalFilesDir(null);if(external==null)throw new IllegalStateException("Owned inspector files unavailable");tgDirectory=new File(external,outputName).getCanonicalFile();if(!tgDirectory.equals(new File(remote).getCanonicalFile())||tgDirectory.exists()||!tgDirectory.mkdirs())throw new IllegalStateException("Fresh owned Tag output directory required");tgResult.put("outputDir",remote);
    try{tgConnectionSetup(automation,started);
      for(int i=0;i<names.length;i++){long begin=SystemClock.uptimeMillis();lpDeadline=lpBatchDeadline;lpCase=new JSONObject();lpCase.put("name",names[i]);lpCase.put("actions",new JSONArray());lpCase.put("observations",new JSONArray());lpCase.put("contacts",new JSONArray());lpCase.put("status","RUNNING");cohorts.put(lpCase);try{if(i==0)tgBaseline(automation);else if(i==1)tgGuard(automation);else tgLong(automation);lpCase.put("status","NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW");}catch(AssertionError error){failed=true;lpCase.put("status","FAILED_ASSERTION");lpCase.put("error",error.toString());try{lpCase.put("failureWindows",lpWindows(automation));tgShot(automation,names[i]+"-failure.png");if(lpBatchDeadline-SystemClock.uptimeMillis()<=0)throw new IllegalStateException("Admitted overall work deadline exhausted");}catch(Throwable unsafe){safe=false;lpCase.put("batchStop",unsafe.toString());}}catch(Throwable error){safe=false;lpCase.put("status","INFRASTRUCTURE_OR_UNSAFE_STOP");lpCase.put("error",error.toString());try{lpCase.put("failureWindows",lpWindows(automation));tgShot(automation,names[i]+"-failure.png");}catch(Throwable ignored){}}finally{lpCase.put("elapsedMs",SystemClock.uptimeMillis()-begin);tgPersist();}if(!safe){for(int j=i+1;j<names.length;j++){JSONObject skipped=new JSONObject();skipped.put("name",names[j]);skipped.put("status","NOT_RUN_UNSAFE");cohorts.put(skipped);}break;}}
      boolean success=safe&&!failed&&cohorts.length()==3;tgResult.put("nativeActionSucceeded",success);tgResult.put("hasFailedCohorts",failed);tgResult.put("status",success?"NATIVE_COMPLETE_PENDING_HOST_VISUAL_AND_SOURCE_JOIN":"FAILED_OR_INCOMPLETE");
    }catch(Throwable error){tgResult.put("batchError",error.toString());}finally{tgResult.put("epochFinishedMs",System.currentTimeMillis());tgResult.put("elapsedMs",SystemClock.uptimeMillis()-started);tgPersist();}return tgResult;
  }

  private void tgMeasuredNavigation(UiAutomation automation,Rect viewport,Rect frame,String id) throws Exception {
    int maximum=Math.max(1,(viewport.height()-4)/3),delta=Math.max(-maximum,Math.min(maximum,viewport.centerY()-frame.centerY()));if(delta==0)throw new IllegalStateException("Actual parent cannot fit the required wholly-visible viewport; no larger scrolling limit");
    int x=viewport.right-Math.max(4,viewport.width()/50),startY=viewport.centerY()-delta/2,endY=startY+delta;lpCheck(x>viewport.left&&x<viewport.right&&startY>viewport.top&&startY<viewport.bottom&&endY>viewport.top&&endY<viewport.bottom,"Actual measured scroll coordinates must stay within owned viewport");
    String command="input touchscreen swipe "+x+" "+startY+" "+x+" "+endY+" 250";JSONObject row=new JSONObject();row.put("action","MEASURED_TAG_NAVIGATION_SCROLL");row.put("seeking",id);row.put("viewportBefore",viewport.flattenToString());row.put("frameBefore",frame.flattenToString());row.put("command",command);row.put("startedUptimeMs",SystemClock.uptimeMillis());row.put("transport","UiAutomation.executeShellCommandRw(sh),same connection");lpActions().put(row);android.os.ParcelFileDescriptor[] pipes=automation.executeShellCommandRw("sh");
    String script=command+" 2>&1\nstatus=$?\nprintf '\\nCODON_PARENT_SCROLL_EXIT=%s\\n' \"$status\"\nexit \"$status\"\n";
    try{try(android.os.ParcelFileDescriptor.AutoCloseOutputStream stdin=new android.os.ParcelFileDescriptor.AutoCloseOutputStream(pipes[1])){stdin.write(script.getBytes(StandardCharsets.UTF_8));stdin.flush();}long until=lpDeadline;java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();boolean complete=false;
      try(android.os.ParcelFileDescriptor.AutoCloseInputStream stdout=new android.os.ParcelFileDescriptor.AutoCloseInputStream(pipes[0])){byte[] buffer=new byte[1024];while(SystemClock.uptimeMillis()<until){int available=stdout.available();if(available>0){int size=stdout.read(buffer,0,Math.min(buffer.length,available));if(size<0)break;bytes.write(buffer,0,size);if(bytes.size()>65536)throw new IllegalStateException("Unexpected parent scroll shell output size");}String output=new String(bytes.toByteArray(),StandardCharsets.UTF_8);java.util.regex.Matcher marker=java.util.regex.Pattern.compile("(?:^|\\n)CODON_PARENT_SCROLL_EXIT=([0-9]+)\\r?\\n").matcher(output);if(marker.find()){int exit=Integer.parseInt(marker.group(1));row.put("output",output);row.put("exitCode",exit);complete=true;if(exit!=0)throw new IllegalStateException("Actual parent alignment scroll failed");break;}SystemClock.sleep(10);}if(!complete)row.put("output",new String(bytes.toByteArray(),StandardCharsets.UTF_8));if(!complete)throw new IllegalStateException("Parent scroll exit marker absent before the admitted work deadline; outcome uncertain, stop batch");}}
    finally{for(android.os.ParcelFileDescriptor pipe:pipes)try{pipe.close();}catch(java.io.IOException ignored){}row.put("finishedUptimeMs",SystemClock.uptimeMillis());}
  }

  private boolean tgNavigationAdmitted(AccessibilityNodeInfo node,AccessibilityNodeInfo scroll,boolean partialCopy) {
    if(!partialCopy)return whollyVisible(node,scroll);if(node==null||scroll==null||!node.isVisibleToUser())return false;Rect frame=new Rect(),viewport=new Rect();node.getBoundsInScreen(frame);scroll.getBoundsInScreen(viewport);return Rect.intersects(frame,viewport);
  }

  private String tgDiscoveryViewport(UiAutomation automation,Rect viewport,JSONObject row) throws Exception {
    JSONObject windows=lpWindows(automation);JSONArray visible=new JSONArray(),nodes=windows.getJSONArray("windowNodes");for(int i=0;i<nodes.length();i++){JSONObject node=nodes.getJSONObject(i);Rect frame=Rect.unflattenFromString(node.getString("bounds"));if(frame==null||frame.isEmpty()||!Rect.intersects(frame,viewport))continue;JSONArray item=new JSONArray();item.put(node.opt("id"));item.put(node.opt("text"));item.put(TG_STATE.equals(node.optString("id"))?"<actual-state-marker>":node.opt("description"));item.put(node.getString("bounds"));visible.put(item);}row.put("discoveryNativeWindows",windows);row.put("discoveryVisibleNodes",visible);return visible.toString();
  }

  private AccessibilityNodeInfo tgVisible(UiAutomation automation,String id) throws Exception {return tgVisible(automation,id,false);}

  private AccessibilityNodeInfo tgVisible(UiAutomation automation,String id,boolean partialCopy) throws Exception {
    requireFixtureNavigation();
    if(partialCopy&&!"indicator-g04-long-copy".equals(id))throw new IllegalArgumentException("Only the original long-copy paragraph admits partial intersection");boolean searchDown=false;String previousDiscovery=null;int stable=0;
    for(int attempt=0;attempt<24;attempt++){
      lpBound();AccessibilityNodeInfo node=fresh(automation,id),scroll=fresh(automation,"showcase-scroll");if(scroll==null||!scroll.refresh()||(!partialCopy&&(!scroll.isVisibleToUser()||!scroll.isEnabled())))throw new IllegalStateException("Actual responsive native scroll viewport required");if(node!=null&&!node.refresh())node=null;Rect viewport=new Rect(),frame=new Rect();scroll.getBoundsInScreen(viewport);if(viewport.isEmpty())throw new IllegalStateException("Actual nonempty native viewport required");if(node!=null)node.getBoundsInScreen(frame);JSONObject row=new JSONObject();row.put("seeking",id);row.put("attempt",attempt);row.put("partialCopy",partialCopy);row.put("viewportBefore",viewport.flattenToString());row.put("frameBefore",node==null?JSONObject.NULL:frame.flattenToString());row.put("nodeVisibleBefore",node!=null&&node.isVisibleToUser());lpActions().put(row);
      if(tgNavigationAdmitted(node,scroll,partialCopy)){row.put("action","ADMITTED_VISIBLE");return node;}
      if(node!=null){boolean shown=node.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.getId());row.put("action","ACTION_SHOW_ON_SCREEN");row.put("accepted",shown);lpSleep(150);node=fresh(automation,id);scroll=fresh(automation,"showcase-scroll");if(scroll==null||!scroll.refresh())throw new IllegalStateException("Actual viewport must refresh after show-on-screen");if(node!=null&&!node.refresh())node=null;scroll.getBoundsInScreen(viewport);if(node!=null)node.getBoundsInScreen(frame);row.put("frameAfterShow",node==null?JSONObject.NULL:frame.flattenToString());row.put("viewportAfterShow",viewport.flattenToString());if(tgNavigationAdmitted(node,scroll,partialCopy))return node;
        if(node!=null&&!frame.isEmpty()){tgMeasuredNavigation(automation,viewport,frame,id);lpSleep(150);node=fresh(automation,id);scroll=fresh(automation,"showcase-scroll");if(scroll==null||!scroll.refresh())throw new IllegalStateException("Actual viewport must refresh after measured alignment");if(node!=null&&!node.refresh())node=null;scroll.getBoundsInScreen(viewport);if(node!=null)node.getBoundsInScreen(frame);row.put("frameAfterMeasured",node==null?JSONObject.NULL:frame.flattenToString());row.put("viewportAfterMeasured",viewport.flattenToString());if(tgNavigationAdmitted(node,scroll,partialCopy))return node;previousDiscovery=null;stable=0;searchDown=false;continue;}
      }
      String signature=tgDiscoveryViewport(automation,viewport,row);stable=signature.equals(previousDiscovery)?stable+1:0;previousDiscovery=signature;if(!searchDown&&stable>=2){searchDown=true;stable=0;previousDiscovery=null;row.put("upperViewportStable",true);}else if(searchDown&&stable>=2)throw new IllegalStateException("Actual selector absent after bounded stable upper/lower viewport discovery: "+id);int action=searchDown?AccessibilityNodeInfo.ACTION_SCROLL_FORWARD:AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD;boolean accepted=scroll.performAction(action);row.put("discoveryAction",searchDown?"ACTION_SCROLL_FORWARD":"ACTION_SCROLL_BACKWARD");row.put("discoveryAccepted",accepted);row.put("discoveryStableObservations",stable);if(!accepted){if(!searchDown){searchDown=true;stable=0;previousDiscovery=null;row.put("upperBoundaryRejected",true);}else throw new IllegalStateException("Actual selector absent at lower discovery boundary: "+id);}else lpSleep(150);AccessibilityNodeInfo afterScroll=fresh(automation,"showcase-scroll"),afterNode=fresh(automation,id);if(afterScroll==null||!afterScroll.refresh())throw new IllegalStateException("Actual viewport must refresh after discovery");Rect afterViewport=new Rect(),afterFrame=new Rect();afterScroll.getBoundsInScreen(afterViewport);if(afterNode!=null&&!afterNode.refresh())afterNode=null;if(afterNode!=null)afterNode.getBoundsInScreen(afterFrame);row.put("viewportAfterDiscovery",afterViewport.flattenToString());row.put("frameAfterDiscovery",afterNode==null?JSONObject.NULL:afterFrame.flattenToString());
    }
    throw new IllegalStateException("Actual Indicator selector not admitted within original24 bounded navigation attempts: "+id);
  }

  private void tgClick(UiAutomation automation,String label) throws Exception {
    requireFixtureNavigation();
    AccessibilityNodeInfo control=tgVisible(automation,label);if(!control.isEnabled()||!label.contentEquals(control.getContentDescription()==null?"":control.getContentDescription()))throw new IllegalStateException("Actual named fixture control required: "+label);boolean accepted=control.performAction(AccessibilityNodeInfo.ACTION_CLICK);JSONObject row=new JSONObject();row.put("action","ACTION_CLICK");row.put("label",label);row.put("accepted",accepted);row.put("nativeEpochMs",System.currentTimeMillis());lpActions().put(row);if(!accepted)throw new IllegalStateException("Fixture ACTION_CLICK rejected: "+label);if(isSceneSelectionControl(label))tgAwaitSelectedScene(automation,label,row);else lpSleep(200);
  }




  private interface ReadinessProbe { boolean ready() throws Exception; }
  private interface AdmittedAction { void run() throws Exception; }
  private static final class ReadinessGate {
    private boolean admitted=false;
    void admit(ReadinessProbe probe) throws Exception {
      admitted=false;
      if(!probe.ready())throw new IllegalStateException("Actual readiness did not pass");
      admitted=true;
    }
    void revoke() {admitted=false;}
    void requireReady() {if(!admitted)throw new IllegalStateException("Readiness must pass before fixture navigation or input");}
    void run(AdmittedAction action) throws Exception {requireReady();action.run();}
  }
  private static void admitPlaceholderReadiness(ReadinessGate navigation,ReadinessGate input,ReadinessProbe host,ReadinessProbe component) throws Exception {
    navigation.revoke();input.revoke();
    try{navigation.admit(host);input.admit(component);}catch(Exception|Error failure){navigation.revoke();input.revoke();throw failure;}
  }
  private boolean placeholderGuardActive=false;
  private final ReadinessGate placeholderNavigationGate=new ReadinessGate();
  private final ReadinessGate placeholderInputGate=new ReadinessGate();
  private void requireFixtureNavigation() {if(placeholderGuardActive)placeholderNavigationGate.requireReady();}
  private boolean placeholderHostReady(UiAutomation automation,long started) throws Exception {
    lpDeadline=lpBatchDeadline;JSONObject admission=new JSONObject();admission.put("status","CHECKING");admission.put("fixtureNavigationBeforeReady",0);admission.put("testInputBeforeReady",0);admission.put("actions",new JSONArray());tgResult.put("preNavigationReadiness",admission);lpCase=admission;
    long clearSince=-1;int count=0;
    try {
      while(SystemClock.uptimeMillis()<lpDeadline){
        JSONObject windows=tgStartupWindows(automation);admission.put("lastWindows",windows);
        if(tgStartupAnr(automation,admission,windows)){clearSince=-1;continue;}
        AccessibilityNodeInfo root=automation.getRootInActiveWindow(),scroll=fresh(automation,"showcase-scroll"),control=fresh(automation,"Text/Button scene");
        boolean ready=root!=null&&root.refresh()&&"dev.codonui.showcase".contentEquals(root.getPackageName())&&scroll!=null&&scroll.refresh()&&scroll.isVisibleToUser()&&scroll.isEnabled()&&control!=null&&control.refresh()&&control.isVisibleToUser()&&control.isEnabled()&&"dev.codonui.showcase".contentEquals(control.getPackageName());
        Rect viewport=new Rect();if(scroll!=null)scroll.getBoundsInScreen(viewport);ready=ready&&!viewport.isEmpty();
        if(!ready){clearSince=-1;lpSleep(100);continue;}
        long now=SystemClock.uptimeMillis();if(clearSince<0)clearSince=now;count++;
        admission.put("viewport",tgSetupNode(scroll));admission.put("sceneControl",tgSetupNode(control));admission.put("clearQueries",count);admission.put("clearObservedMs",now-clearSince);tgPersist();
        if(now-clearSince>=30000){admission.put("status","READY");return true;}lpSleep(250);
      }
      throw new IllegalStateException("Actual app/window/control clear30s readiness did not pass before navigation");
    } catch(Throwable error){admission.put("status","FAILED");admission.put("error",error.toString());try{admission.put("failureWindows",tgStartupWindows(automation));tgShot(automation,"pre-navigation-failure.png");}catch(Throwable capture){admission.put("captureError",capture.toString());}tgPersist();throw error;}
  }

  private JSONObject phtState(UiAutomation automation) throws Exception {
    AccessibilityNodeInfo marker=fresh(automation,"placeholder-g02-state");
    lpCheck(marker!=null&&marker.refresh()&&marker.getContentDescription()!=null,"Fresh actual Placeholder state required");
    JSONObject state=new JSONObject(marker.getContentDescription().toString());
    lpCheck(state.getInt("dropped")==0&&state.getLong("rootTag")>0&&state.getLong("refIdentity")>0,"Live original Placeholder binding/trace required");return state;
  }
  private void phtRetained(JSONObject original,JSONObject state) throws Exception {
    for(String key:new String[]{"rootTag","refIdentity","attaches","detaches"})lpCheck(lpEqual(original.get(key),state.get(key)),"Original Placeholder binding changed: "+key);
  }
  private static int[] placeholderPaintRows(int[] pixels,int width,int color) {
    if(width<=0||pixels.length%width!=0)throw new IllegalArgumentException("Whole positive raster rows required");
    int count=0,bands=0;boolean previous=false;for(int y=0;y<pixels.length/width;y++){boolean painted=false;for(int x=0;x<width;x++)if(pixels[y*width+x]==color){count++;painted=true;}if(painted&&!previous)bands++;previous=painted;}return new int[]{count,bands};
  }
  private JSONObject phtObserve(UiAutomation automation,String name,int color,String expected,JSONObject original) throws Exception {
    placeholderInputGate.requireReady();
    lpSleep(350);AccessibilityNodeInfo target=lpVisible(automation,"library-placeholder");JSONObject before=phtState(automation);phtRetained(original,before);
    lpCheck(target.refresh()&&target.getText()!=null&&expected.contentEquals(target.getText()),"Exact original Placeholder native text required");
    Rect frame=new Rect();target.getBoundsInScreen(frame);JSONObject row=new JSONObject();row.put("name",name);row.put("state",before);row.put("target",tgNode(target));row.put("expectedARGB",color);row.put("nativeEpochMs",System.currentTimeMillis());
    Bitmap image=automation.takeScreenshot();lpCheck(image!=null,"Native Placeholder image required");
    try{lpCheck(image.getHeight()>image.getWidth()&&frame.left>=0&&frame.top>=0&&frame.right<=image.getWidth()&&frame.bottom<=image.getHeight(),"Actual visible portrait crop required");int[] pixels=new int[frame.width()*frame.height()];image.getPixels(pixels,0,frame.width(),frame.left,frame.top,frame.width(),frame.height());int[] paint=placeholderPaintRows(pixels,frame.width(),color);lpCheck(paint[0]>=5,"Expected opaque glyph paint absent");row.put("opaquePixelCount",paint[0]);row.put("paintedRowBands",paint[1]);row.put("frame",new JSONArray(new int[]{frame.left,frame.top,frame.width(),frame.height()}));row.put("png",name+".png");savePng(image,new File(lpDirectory,name+".png"));}finally{image.recycle();}
    AccessibilityNodeInfo after=lpVisible(automation,"library-placeholder");Rect freshFrame=new Rect();after.getBoundsInScreen(freshFrame);lpCheck(frame.equals(freshFrame)&&expected.contentEquals(after.getText()),"Capture target/text/frame changed");phtRetained(original,phtState(automation));lpCase.getJSONArray("observations").put(row);return row;
  }
  private JSONObject phtPrepare(UiAutomation automation) throws Exception {
    placeholderInputGate.requireReady();
    lpClick(automation,"Live window");lpClick(automation,"Light theme");lpClick(automation,"Text/Button scene");awaitSceneSelection(()->{AccessibilityNodeInfo control=fresh(automation,"Text/Button scene");return control!=null&&control.refresh()&&control.isVisibleToUser()&&control.isEnabled()&&control.isSelected()&&"dev.codonui.showcase".contentEquals(control.getPackageName());},SystemClock::uptimeMillis,SystemClock::sleep,lpDeadline);lpClick(automation,"Reset scene");lpClick(automation,"G02 prepare placeholder");lpSleep(500);

    JSONObject state=phtState(automation);lpCheck(state.getInt("actions")==0&&state.getJSONArray("receipts").length()==0,"Fresh original Placeholder must be quiet");return state;
  }
  private void phtLight(UiAutomation automation) throws Exception {
    JSONObject original=phtPrepare(automation);phtObserve(automation,"light-default",0xff707070,"Choose an item",original);
    lpClick(automation,"Toggle placeholder alignment");phtObserve(automation,"light-center",0xff707070,"Choose an item",original);
    lpClick(automation,"Toggle placeholder custom styles");JSONObject custom=phtObserve(automation,"light-custom",0xffa66b00,"Choose an item",original);
    lpClick(automation,"Toggle placeholder final styles");JSONObject finalStyle=phtObserve(automation,"light-final",0xff7e22ce,"Choose an item",original);
    lpCheck(finalStyle.getJSONArray("frame").getInt(3)>custom.getJSONArray("frame").getInt(3),"Final22 glyph layout must exceed custom18 layout");
    lpClick(automation,"Toggle placeholder final styles");phtObserve(automation,"light-custom-restored",0xffa66b00,"Choose an item",original);
    lpClick(automation,"Toggle placeholder custom styles");phtObserve(automation,"light-computed-restored",0xff707070,"Choose an item",original);
    lpCheck(phtState(automation).getInt("actions")==0,"Style changes fabricated a caller action");
  }
  private void phtDark(UiAutomation automation) throws Exception {
    JSONObject original=phtPrepare(automation);lpClick(automation,"Dark theme");phtObserve(automation,"dark-default",0xff878787,"Choose an item",original);
    lpClick(automation,"Toggle placeholder custom styles");lpClick(automation,"Toggle placeholder final styles");phtObserve(automation,"dark-final",0xff7e22ce,"Choose an item",original);
    lpClick(automation,"Light theme");phtObserve(automation,"light-explicit-retained",0xff7e22ce,"Choose an item",original);
    lpClick(automation,"Toggle placeholder final styles");lpClick(automation,"Toggle placeholder custom styles");phtObserve(automation,"light-after-provider",0xff707070,"Choose an item",original);
    lpClick(automation,"G02 scene placeholder content");lpClick(automation,"Toggle empty placeholder");AccessibilityNodeInfo empty=fresh(automation,"library-placeholder");lpCheck(empty==null||empty.getText()==null||empty.getText().length()==0,"Empty caller content must have no native glyphs");phtRetained(original,phtState(automation));lpClick(automation,"Toggle empty placeholder");phtObserve(automation,"empty-restored",0xff707070,"Choose an item",original);
  }
  private void phtNarrow(UiAutomation automation) throws Exception {
    JSONObject original=phtPrepare(automation);phtObserve(automation,"full-default",0xff707070,"Choose an item",original);
    lpClick(automation,"Toggle placeholder final styles");lpClick(automation,"G02 deferred placeholder content");lpSleep(500);JSONObject full=phtObserve(automation,"full-final-deferred",0xff7e22ce,"Deferred owner content",original);
    lpClick(automation,"Vertical blocked region");
    JSONObject narrow=phtObserve(automation,"narrow-final-deferred",0xff7e22ce,"Deferred owner content",original);
    lpCheck(narrow.getJSONArray("frame").getInt(2)<full.getJSONArray("frame").getInt(2)&&narrow.getJSONArray("frame").getInt(3)>full.getJSONArray("frame").getInt(3)*1.5,"Measured narrower wrapped original Placeholder required");
    AccessibilityNodeInfo target=lpVisible(automation,"library-placeholder");Rect frame=new Rect();target.getBoundsInScreen(frame);placeholderInputGate.requireReady();physicalSwipe(automation,frame,200,lpDeadline,lpActions(),"Original Placeholder first action");lpSleep(750);JSONObject after=phtState(automation);phtRetained(original,after);lpCheck(after.getInt("actions")==1&&after.getJSONArray("receipts").length()==3,"One original pressIn/pressOut/press required");
    String[] kinds={"pressIn","pressOut","press"};for(int i=0;i<3;i++){JSONObject row=after.getJSONArray("receipts").getJSONObject(i);lpCheck(kinds[i].equals(row.getString("kind"))&&"original".equals(row.getString("callback"))&&!row.getBoolean("afterDetach")&&row.getJSONObject("native").getLong("target")==original.getLong("rootTag"),"Original native callback/target mismatch");}
    phtObserve(automation,"narrow-after-first-action",0xff7e22ce,"Deferred owner content",original);
    lpClick(automation,"Live window");lpClick(automation,"Reset scene");lpClick(automation,"G02 prepare placeholder");JSONObject reset=phtState(automation);lpCheck(reset.getInt("actions")==0,"Scene reset must restore caller state");phtObserve(automation,"reset-default",0xff707070,"Choose an item",reset);lpCase.put("requiredVisualReview","Inspect full original deferred phrase in both narrow PNGs: complete glyphs, wrapping, padding and unclipped first action; no OCR or AX-label-only appearance pass.");
  }
  private JSONObject placeholderG04Batch(UiAutomation automation) throws Exception {
    long started=SystemClock.uptimeMillis();lpBatchDeadline=meterAttemptDeadline(started,arguments.getString("attemptRemainingMs"));JSONObject result=new JSONObject();result.put("operation","placeholder-g04-batch");result.put("nativeActionSucceeded",false);JSONArray cohorts=new JSONArray();result.put("cohorts",cohorts);
    String remote=arguments.getString("outputDir","");String prefix="/sdcard/Android/data/dev.codonui.lab.number/files/";lpCheck(remote.startsWith(prefix)&&remote.substring(prefix.length()).matches("placeholder-g04-native-[A-Za-z0-9-]{1,80}"),"Fresh owned Placeholder output required");lpDirectory=new File(remote).getCanonicalFile();lpCheck(!lpDirectory.exists()&&lpDirectory.mkdirs(),"Never overwrite prior native evidence");result.put("outputDir",remote);
    tgResult=result;tgDirectory=lpDirectory;
    placeholderGuardActive=true;
    try{admitPlaceholderReadiness(placeholderNavigationGate,placeholderInputGate,()->placeholderHostReady(automation,started),()->{tgConnectionSetup(automation,started,"Text/Button scene","placeholder-g02-state","library-placeholder",true);return true;});}catch(Throwable error){result.put("status","STOP_UNSAFE");result.put("error",error.toString());result.put("elapsedMs",SystemClock.uptimeMillis()-started);writeJson(lpDirectory,"receipt.json",result);return result;}
    boolean failed=false;String[] names={"light-style","dark-and-reset","narrow-pane"};for(String name:names){lpCase=new JSONObject();lpCase.put("name",name);lpCase.put("actions",new JSONArray());lpCase.put("observations",new JSONArray());cohorts.put(lpCase);long begin=SystemClock.uptimeMillis();lpDeadline=lpBatchDeadline;try{placeholderInputGate.run(()->{if(name.equals("light-style"))phtLight(automation);else if(name.equals("dark-and-reset"))phtDark(automation);else phtNarrow(automation);});lpCase.put("status","NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW");}catch(Throwable error){failed=true;lpCase.put("status","FAILED_ASSERTION");lpCase.put("error",error.toString());}finally{lpCase.put("elapsedMs",SystemClock.uptimeMillis()-begin);writeJson(lpDirectory,"receipt.json",result);}if(failed)break;}
    result.put("nativeActionSucceeded",!failed&&cohorts.length()==3);result.put("status",!failed?"NATIVE_ASSERTIONS_PASSED_PENDING_HOST_REVIEW":"FAILED_ASSERTION");result.put("elapsedMs",SystemClock.uptimeMillis()-started);writeJson(lpDirectory,"receipt.json",result);return result;
  }

  public void onStart() {
    Bundle output=new Bundle();
    try {
      UiAutomation automation=getUiAutomation(); AccessibilityServiceInfo info=automation.getServiceInfo(); info.flags|=AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS|AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS; automation.setServiceInfo(info);
      String id=arguments.getString("id");String operation=arguments.getString("op","inspect");
      if(operation.equals("placeholder-g04-batch")){JSONObject batch=placeholderG04Batch(automation);JSONObject summary=new JSONObject();for(String key:new String[]{"operation","status","nativeActionSucceeded"})summary.put(key,batch.get(key));output.putString("codon",summary.toString());finish(batch.optBoolean("nativeActionSucceeded")?-1:1,output);return;}
      if(operation.equals("tag-g02-batch")){JSONObject batch=tagG02Batch(automation);JSONObject summary=new JSONObject();for(String key:new String[]{"operation","status","nativeActionSucceeded","outputDir"})summary.put(key,batch.get(key));summary.put("cohortCount",batch.getJSONArray("cohorts").length());output.putString("codon",summary.toString());finish(batch.optBoolean("nativeActionSucceeded")?-1:1,output);return;}
      if(operation.equals("circular-progress-batch")){JSONObject batch=circularProgressBatch(automation);output.putString("codon",batch.toString());finish(batch.optBoolean("nativeActionSucceeded")?-1:1,output);return;}
      if(operation.equals("text-style-batch")){JSONObject batch=textStyleBatch(automation);output.putString("codon",batch.toString());finish(batch.optBoolean("nativeActionSucceeded")?-1:1,output);return;}
      if(operation.equals("linear-progress-risk-batch")){JSONObject batch=linearProgressRiskBatch(automation);output.putString("codon",batch.toString());finish(batch.optBoolean("nativeActionSucceeded")?-1:1,output);return;}
      if(operation.equals("meter-style-batch")){JSONObject batch=meterStyleBatch(automation);JSONObject summary=new JSONObject();for(String key:new String[]{"operation","status","nativeActionSucceeded"})summary.put(key,batch.get(key));summary.put("cohortCount",batch.getJSONArray("cohorts").length());output.putString("codon",summary.toString());finish(batch.optBoolean("nativeActionSucceeded")?-1:1,output);return;}
      if(operation.equals("meter-g02-batch")){JSONObject batch=meterG02Batch(automation);JSONObject summary=new JSONObject();for(String key:new String[]{"operation","status","nativeActionSucceeded","outputDir"})summary.put(key,batch.get(key));summary.put("cohortCount",batch.getJSONArray("cohorts").length());output.putString("codon",summary.toString());finish(batch.optBoolean("nativeActionSucceeded")?-1:1,output);return;}
      if(operation.equals("linear-progress-g02-batch")){JSONObject batch=linearProgressG02Batch(automation);JSONObject summary=new JSONObject();for(String key:new String[]{"operation","status","nativeActionSucceeded","outputDir"})summary.put(key,batch.get(key));summary.put("cohortCount",batch.getJSONArray("cohorts").length());output.putString("codon",summary.toString());finish(batch.optBoolean("nativeActionSucceeded")?-1:1,output);return;}
      if(operation.equals("matched-text-s03")){JSONObject matched=matchedTextS03(automation);output.putString("codon",matched.toString());finish(matched.optBoolean("nativeActionSucceeded")?-1:1,output);return;}
      if(operation.equals("setup-held-selection")) {
        JSONObject setup=new JSONObject();
        try {
          if(!"text-g02-context-target".equals(id))throw new IllegalArgumentException("Fixed diagnostic target required");
          AccessibilityNodeInfo target=prepareContext(automation,setup);JSONObject held=heldSelection(automation,target,id);held.put("setup",setup);output.putString("codon",held.toString());finish(held.optBoolean("nativeActionSucceeded")?-1:1,output);
        } catch(Throwable error) {setup.put("error",error.toString());output.putString("setup",setup.toString());output.putString("error",error.toString());finish(1,output);}
        return;
      }
      AccessibilityNodeInfo node=find(automation.getRootInActiveWindow(),id);
      for(int attempt=0;node==null && attempt<5;attempt++) {
        for(android.view.accessibility.AccessibilityWindowInfo window:automation.getWindows()) { node=find(window.getRoot(),id);if(node!=null)break; }
        if(node==null)SystemClock.sleep(250);
      }
      if(node==null)throw new IllegalStateException("Missing native node "+id);
      String op=arguments.getString("op","inspect"); boolean result=true;
      if(op.equals("held-selection")) {JSONObject held=heldSelection(automation,node,id);output.putString("codon",held.toString());finish(held.optBoolean("nativeActionSucceeded")?-1:1,output);return;}
      String text=new String(Base64.decode(arguments.getString("data",""),Base64.DEFAULT),StandardCharsets.UTF_8);
      if(op.equals("set")) { Bundle value=new Bundle(); value.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,text);result=node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,value); }
      if(op.equals("paste")) {
        ClipboardManager clipboard=(ClipboardManager)getTargetContext().getSystemService(Context.CLIPBOARD_SERVICE);clipboard.setPrimaryClip(ClipData.newPlainText("Codon native test",text));
        Bundle empty=new Bundle();empty.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,"");node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,empty);
        node.performAction(AccessibilityNodeInfo.ACTION_FOCUS); result=node.performAction(AccessibilityNodeInfo.ACTION_PASTE);
      }
      if(op.equals("action")) {
        if(arguments.containsKey("actionId")) {
          int actionId=Integer.parseInt(arguments.getString("actionId"));
          if(actionId!=AccessibilityNodeInfo.ACTION_CLICK&&actionId!=AccessibilityNodeInfo.ACTION_SCROLL_FORWARD&&actionId!=AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)throw new IllegalArgumentException("Only standard fixture click/scroll actions admitted");
          result=node.performAction(actionId);
        } else {
          String label=new String(Base64.decode(arguments.getString("label64",""),Base64.DEFAULT),StandardCharsets.UTF_8);result=false;
          for(AccessibilityNodeInfo.AccessibilityAction action:node.getActionList()) if(label.contentEquals(action.getLabel()==null?"":action.getLabel())) {result=node.performAction(action.getId());break;}
        }
      }
      SystemClock.sleep(350);if(!node.refresh())throw new IllegalStateException("Native observer target refresh failed; no stale fallback");JSONObject receipt=new JSONObject();receipt.put("id",id);receipt.put("operation",op);receipt.put("nativeActionSucceeded",result);receipt.put("text",String.valueOf(node.getText()));receipt.put("textIsNull",node.getText()==null);receipt.put("selectionStart",node.getTextSelectionStart());receipt.put("selectionEnd",node.getTextSelectionEnd());receipt.put("enabled",node.isEnabled());receipt.put("editable",node.isEditable());
      addRawNativeFields(receipt,node);
      Rect bounds=new Rect();node.getBoundsInScreen(bounds);receipt.put("bounds",bounds.flattenToString());JSONArray actions=new JSONArray();for(AccessibilityNodeInfo.AccessibilityAction action:node.getActionList()){JSONObject a=new JSONObject();a.put("id",action.getId());a.put("label",String.valueOf(action.getLabel()));actions.put(a);}receipt.put("actions",actions);
      if(arguments.getString("windows","false").equals("true")) {
        JSONArray windows=new JSONArray();int roots=0;
        for(android.view.accessibility.AccessibilityWindowInfo window:automation.getWindows()) {
          AccessibilityNodeInfo root=window.getRoot();if(root!=null){roots++;snapshot(root,windows,window.getId());}
        }
        if(roots==0)throw new IllegalStateException("No interactive window roots");
        receipt.put("windowRoots",roots);receipt.put("windowNodes",windows);
      }
      output.putString("codon",receipt.toString());if(!result)throw new IllegalStateException(receipt.toString());finish(-1,output);
    } catch(Throwable error) {output.putString("error",error.toString());finish(1,output);}
  }
}
