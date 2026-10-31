package com.codonui.input;
public final class MotionTest {
  private static void check(boolean value) { if (!value) throw new AssertionError(); }
  public static void main(String[] args) {
    check(CUIDragMotion.edgeDelta(0,100)==-20); check(CUIDragMotion.edgeDelta(20,100)==0);
    check(CUIDragMotion.edgeDelta(50,100)==0); check(CUIDragMotion.edgeDelta(80,100)==0); check(CUIDragMotion.edgeDelta(100,100)==20);
    check(CUIDragMotion.edgeDelta(-5,100)==-25); check(CUIDragMotion.edgeDelta(105,100)==25); check(CUIDragMotion.edgeDelta(50,0)==0);
    CUIDragMotion.Hover hover=new CUIDragMotion.Hover(); hover.update("string::row:1:on","copy",1,2,true,0);
    check(!hover.ready(799)); hover.update("string::row:1:on","copy",1,2,true,400);
    check(hover.ready(800)); check(!hover.ready(1600));
    hover.update("string::row:1:on","copy",2,2,true,2000); check(!hover.ready(2799)); check(hover.ready(2800));
    hover.update("string::row:1:on","move",2,2,true,3000); check(!hover.ready(3799)); check(hover.ready(3800));
    hover.update("number:0:row:2:on","move",2,2,true,4000); check(!hover.ready(4799)); check(hover.ready(4800));
    hover.update("number:0:row:2:on","cancel",2,2,true,5000); check(!hover.ready(5800));
    hover.update("number:0:row:2:on","copy",2,2,false,6000); check(!hover.ready(6800));
    hover.update("number:0:row:2:on","copy",2,2,true,7000); hover.stop(); check(!hover.ready(7800));
    System.out.println("20 native Java motion assertions passed");
  }
}
