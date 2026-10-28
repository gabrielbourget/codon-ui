#include "../../../../packages/react-native/cpp/drag/Motion.h"
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
  std::cout << "20 native C++ motion assertions passed\n";
}
