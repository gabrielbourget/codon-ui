#include "../../../../packages/react-native/cpp/drag/Motion.h"
#include "../../../../packages/react-native/cpp/drag/Transport.h"
#include <cassert>
#include <iostream>
int main() {
  using namespace codon::drag;
  assert(edgeScrollDelta(0,100)==-20); assert(edgeScrollDelta(20,100)==0);
  assert(edgeScrollDelta(50,100)==0); assert(edgeScrollDelta(80,100)==0); assert(edgeScrollDelta(100,100)==20);
  assert(edgeScrollDelta(-5,100)==-25); assert(edgeScrollDelta(105,100)==25); assert(edgeScrollDelta(50,0)==0);
  HoverActivation hover; hover.update("string::row:1:on","copy",1,2,true,0);
  assert(!hover.ready(799)); hover.update("string::row:1:on","copy",1,2,true,400);
  assert(hover.ready(800)); assert(!hover.ready(1600));
  hover.update("string::row:1:on","copy",2,2,true,2000); assert(!hover.ready(2799)); assert(hover.ready(2800));
  hover.update("string::row:1:on","move",2,2,true,3000); assert(!hover.ready(3799)); assert(hover.ready(3800));
  hover.update("number:0:row:2:on","move",2,2,true,4000); assert(!hover.ready(4799)); assert(hover.ready(4800));
  hover.update("number:0:row:2:on","cancel",2,2,true,5000); assert(!hover.ready(5800));
  hover.update("number:0:row:2:on","copy",2,2,false,6000); assert(!hover.ready(6800));
  hover.update("number:0:row:2:on","copy",2,2,true,7000); hover.stop(); assert(!hover.ready(7800));
  using C = NativeDragCarrier;
  assert(nativeDragCarrier("copy",false,false,false,false,false)==C::Copy);
  assert(nativeDragCarrier("move",false,true,true,true,true)==C::Cancel);
  assert(nativeDragCarrier("link",false,true,true,true,true)==C::Cancel);
  assert(nativeDragCarrier("copy",true,false,true,true,true)==C::Cancel);
  assert(nativeDragCarrier("copy",true,true,false,false,false)==C::Copy);
  assert(nativeDragCarrier("move",true,true,true,false,true)==C::Move);
  assert(nativeDragCarrier("move",true,true,true,false,false)==C::Cancel);
  assert(nativeDragCarrier("move",true,true,false,false,true)==C::Cancel);
  assert(nativeDragCarrier("link",true,false,false,true,false)==C::Copy);
  assert(nativeDragCarrier("link",true,true,true,false,true)==C::Cancel);
  assert(nativeDragCarrier("cancel",true,true,true,true,true)==C::Cancel);
  assert(nativeDragCarrier("unknown",true,true,true,true,true)==C::Cancel);
  assert(completedDragOperation(true,false,false,"move",true,false)=="cancel");
  assert(completedDragOperation(true,false,false,"move",true,true)=="copy");
  assert(completedDragOperation(true,true,true,"link",true,false)=="link");
  assert(completedDragOperation(true,true,true,"move",true,false)=="move");
  assert(completedDragOperation(false,true,true,"move",true,true)=="cancel");
  assert(completedDragOperation(true,true,false,"move",true,true)=="cancel");
  assert(completedDragOperation(true,true,true,"move",false,true)=="cancel");
  assert(completedDragOperation(true,true,true,"unknown",true,true)=="cancel");
  std::cout << "40 actual native C++ motion/transport assertions passed; no UIKit execution\n";
}
