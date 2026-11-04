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
  private void matchedBound(long deadline) {matchedRequire(SystemClock.uptimeMillis()<deadline,"120s matched cohort deadline exhausted");}
  private void physicalSwipe(UiAutomation automation,Rect bounds,int duration,long deadline,JSONArray inputs,String label) throws Exception {
    matchedBound(deadline);matchedRequire(!bounds.isEmpty()&&bounds.left>=0&&bounds.top>=0&&(duration==200||duration==1000),"Validated numeric actual input bounds/duration required");
    Bitmap screen=automation.takeScreenshot();matchedRequire(screen!=null,"Actual screen size required before physical input");
    try {matchedRequire(bounds.right<=screen.getWidth()&&bounds.bottom<=screen.getHeight()&&screen.getHeight()>screen.getWidth(),"Actual input bounds must be on portrait screen");}finally{screen.recycle();}
    int x=bounds.centerX(),y=bounds.centerY();String gesture=duration==1000?"draganddrop":"swipe";String command="input touchscreen "+gesture+" "+x+" "+y+" "+x+" "+y+" "+duration;
    JSONObject row=new JSONObject();row.put("label",label);row.put("command",command);row.put("startedUptimeMs",SystemClock.uptimeMillis());row.put("bounds",bounds.flattenToString());row.put("transport","UiAutomation.executeShellCommandRw(sh),same connection");inputs.put(row);
    android.os.ParcelFileDescriptor[] pipes=automation.executeShellCommandRw("sh");
    String script=command+" 2>&1\nstatus=$?\nprintf '\\nCODON_INPUT_EXIT=%s\\n' \"$status\"\nexit \"$status\"\n";
    try {
      try(android.os.ParcelFileDescriptor.AutoCloseOutputStream stdin=new android.os.ParcelFileDescriptor.AutoCloseOutputStream(pipes[1])) {stdin.write(script.getBytes(StandardCharsets.UTF_8));stdin.flush();}
      long until=Math.min(deadline,SystemClock.uptimeMillis()+10000);java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();boolean complete=false;
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
        if(!complete)row.put("output",new String(bytes.toByteArray(),StandardCharsets.UTF_8));matchedRequire(complete,"Physical input exit marker not observed within10s; outcome uncertain");
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
    long started=SystemClock.uptimeMillis(),until=Math.min(deadline,started+10000);JSONObject observation=new JSONObject();observation.put("expectedPolicy",policy);observation.put("capMs",10000);observation.put("markerAndScrollRefreshRequired",true);transition.put(phase,observation);int queries=0;
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

  public void onStart() {
    Bundle output=new Bundle();
    try {
      UiAutomation automation=getUiAutomation(); AccessibilityServiceInfo info=automation.getServiceInfo(); info.flags|=AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS|AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS; automation.setServiceInfo(info);
      String id=arguments.getString("id");String operation=arguments.getString("op","inspect");
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
        String label=new String(Base64.decode(arguments.getString("label64",""),Base64.DEFAULT),StandardCharsets.UTF_8);result=false;
        for(AccessibilityNodeInfo.AccessibilityAction action:node.getActionList()) if(label.contentEquals(action.getLabel()==null?"":action.getLabel())) {result=node.performAction(action.getId());break;}
      }
      SystemClock.sleep(350);node.refresh();JSONObject receipt=new JSONObject();receipt.put("id",id);receipt.put("operation",op);receipt.put("nativeActionSucceeded",result);receipt.put("text",String.valueOf(node.getText()));receipt.put("textIsNull",node.getText()==null);receipt.put("selectionStart",node.getTextSelectionStart());receipt.put("selectionEnd",node.getTextSelectionEnd());receipt.put("enabled",node.isEnabled());receipt.put("editable",node.isEditable());
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
