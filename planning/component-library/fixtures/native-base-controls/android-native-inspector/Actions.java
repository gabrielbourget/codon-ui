package dev.codonui.lab.number;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Rect;
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
  public void onStart() {
    Bundle output=new Bundle();
    try {
      UiAutomation automation=getUiAutomation(); AccessibilityServiceInfo info=automation.getServiceInfo(); info.flags|=AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS|AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS; automation.setServiceInfo(info);
      String id=arguments.getString("id"); AccessibilityNodeInfo node=find(automation.getRootInActiveWindow(),id);
      for(int attempt=0;node==null && attempt<5;attempt++) {
        for(android.view.accessibility.AccessibilityWindowInfo window:automation.getWindows()) { node=find(window.getRoot(),id);if(node!=null)break; }
        if(node==null)SystemClock.sleep(250);
      }
      if(node==null)throw new IllegalStateException("Missing native node "+id);
      String op=arguments.getString("op","inspect"); boolean result=true;
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
