#include "../../../../packages/react-native/cpp/backdrop/ProjectedBlur.h"
#include <cassert>
#include <cmath>
#include <iostream>
#include <limits>
#include <stdexcept>

using namespace codon::backdrop;
int main() {
  size_t assertions = 0;
  const auto check = [&](bool value) { assert(value); assertions++; };
  const auto live = [] { return true; };
  // Independent known projective map, not recovered from the implementation's corners.
  const auto known = [](double x, double y) -> TPoint {
    const double weight=1+0.01*x+0.005*y;
    return {(x+0.1*y+5)/weight, (0.2*x+y+7)/weight};
  };
  const TQuad perspective{known(0,0), known(20,0), known(20,18), known(0,18)};
  const auto recovered=rectangleProjection(20, 18, perspective);
  for (double y : {0.0, 0.5, 6.25, 12.75, 18.0}) for (double x : {0.0, 0.5, 7.25, 16.75, 20.0}) {
    const auto actual=project(recovered,{x,y}), expected=known(x,y);
    check(std::abs(actual.x-expected.x)<1e-10 && std::abs(actual.y-expected.y)<1e-10);
  }
  const auto rectangle = [](double width, double height) -> TQuad {
    return {{{0,0},{width,0},{width,height},{0,height}}};
  };
  std::vector<uint8_t> gradient(64*64*4);
  for (size_t y=0;y<64;y++) for(size_t x=0;x<64;x++) {
    const size_t offset=(y*64+x)*4;
    gradient[offset]=x*3; gradient[offset+1]=y*4; gradient[offset+2]=40; gradient[offset+3]=255;
  }
  const auto warped=projectedBlur(gradient.data(),64,64,rectangle(64,64),20,18,perspective,0,live);
  for(size_t y=0;y<18;y++) for(size_t x=0;x<20;x++) {
    const auto point=known(x+0.5,y+0.5); const size_t offset=(y*20+x)*4;
    check(std::abs(warped[offset]-std::lround((point.x-0.5)*3))<=1);
    check(std::abs(warped[offset+1]-std::lround((point.y-0.5)*4))<=1);
    check(warped[offset+2]==40 && warped[offset+3]==255);
  }
  const size_t width=9,height=7;
  std::vector<uint8_t> pixels(width*height*4);
  for(size_t index=0;index<pixels.size();index++) pixels[index]=index%4==3?255:(index*41)%256;
  const TQuad quads[]={rectangle(width,height), {{{10.25,-5.75},{19.25,-5.75},{19.25,1.25},{10.25,1.25}}},
      {{{100,20},{100,29},{93,29},{93,20}}}, {{{9,0},{0,0},{0,7},{9,7}}},
      {{{5,4},{22,7},{20,19},{3,15}}}};
  for(const auto &quad:quads) {
    const auto identity=projectedBlur(pixels.data(),width,height,quad,width,height,quad,0,live);
    check(identity==pixels);
  }
  const auto flat=gaussianBlur(pixels.data(),width,height,1.5,live);
  for(const auto &quad:{quads[0],quads[2],quads[3]}) {
    const auto actual=projectedBlur(pixels.data(),width,height,quad,width,height,quad,1.5,live);
    for(size_t index=0;index<flat.size();index++) check(std::abs(actual[index]-flat[index])<=1);
  }
  // A 2x receiver samples the same screen blur as a smaller untransformed viewport,
  // rather than doubling the physical sigma along with the presentation transform.
  const TQuad enlarged=rectangle(18,14);
  const auto physical=projectedBlur(gradient.data(),64,64,rectangle(64,64),9,7,enlarged,1.5,live);
  const auto screen=projectedBlur(gradient.data(),64,64,rectangle(64,64),18,14,enlarged,1.5,live);
  for(size_t y=0;y<7;y++) for(size_t x=0;x<9;x++) for(size_t channel=0;channel<4;channel++) {
    const size_t first=((2*y)*18+2*x)*4+channel;
    const int average=(screen[first]+screen[first+4]+screen[first+18*4]+screen[first+18*4+4]+2)/4;
    check(std::abs(physical[(y*9+x)*4+channel]-average)<=1);
  }
  const double diagonal=std::sqrt(0.5), sigma=2.5;
  const auto rotated=[&](double x,double y)->TPoint{return {20+(x-y)*diagonal,12+(x+y)*diagonal};};
  const TQuad rotatedQuad{rotated(0,0),rotated(9,0),rotated(9,7),rotated(0,7)};
  const auto rotatedPixels=projectedBlur(gradient.data(),64,64,rectangle(64,64),9,7,rotatedQuad,sigma,live);
  const auto reflect=[](double value,double extent){
    value=std::fmod(value,2*extent);if(value<0)value+=2*extent;
    return value<=extent?value:2*extent-value;
  };
  // Independent orthonormal coordinates and direct 2D convolution establish
  // that the mirror boundary is the rotated quad, not its screen bounding box.
  const auto reference=[&](int column,int row,int channel){
    double sum=0,value=0;
    const int radius=static_cast<int>(std::ceil(6*sigma));
    for(int dy=-radius;dy<=radius;dy++)for(int dx=-radius;dx<=radius;dx++){
      const double x=column+0.5+dx-20,y=row+0.5+dy-12;
      const auto point=rotated(reflect((x+y)*diagonal,9),reflect((y-x)*diagonal,7));
      const int sample=static_cast<int>(std::lround(channel==0?(point.x-0.5)*3:(point.y-0.5)*4));
      const double weight=std::exp(-(dx*dx+dy*dy)/(2*sigma*sigma));
      sum+=weight;value+=weight*sample;
    }
    return std::lround(value/sum);
  };
  for(size_t y=0;y<7;y++)for(size_t x=0;x<9;x++){
    const auto point=rotated(x+0.5,y+0.5);
    const int left=static_cast<int>(std::floor(point.x-0.5)),top=static_cast<int>(std::floor(point.y-0.5));
    const double fx=point.x-0.5-left,fy=point.y-0.5-top;
    for(int channel=0;channel<2;channel++){
      const auto expected=std::lround((reference(left,top,channel)*(1-fx)+reference(left+1,top,channel)*fx)*(1-fy)+
          (reference(left,top+1,channel)*(1-fx)+reference(left+1,top+1,channel)*fx)*fy);
      check(std::abs(rotatedPixels[(y*9+x)*4+channel]-expected)<=2);
    }
    check(rotatedPixels[(y*9+x)*4+2]==40 && rotatedPixels[(y*9+x)*4+3]==255);
  }
  const TQuad outside= {{{100,100},{109,100},{109,107},{100,107}}};
  const auto empty=projectedBlur(pixels.data(),9,7,rectangle(9,7),9,7,outside,0,live);
  for(auto value:empty) check(value==0);
  const TQuad folded={{{0,0},{9,7},{9,0},{0,7}}};
  const TQuad singular={{{0,0},{1,0},{2,0},{3,0}}};
  const TQuad nonfinite={{{0,0},{INFINITY,0},{9,7},{0,7}}};
  const TQuad zeroScale={{{5,0},{5,0},{5,7},{5,7}}};
  for(bool sourceCollapsed:{false,true}) {
    const auto transparent=projectedBlur(pixels.data(),9,7,sourceCollapsed?zeroScale:quads[0],
        9,7,sourceCollapsed?quads[0]:zeroScale,2,live);
    for(auto value:transparent)check(value==0);
  }
  for(const auto &quad:{folded,singular,nonfinite}) {
    try {rectangleProjection(9,7,quad);check(false);}
    catch(const std::invalid_argument &){check(true);}
  }
  for(int cutoff:{1,3,40,95}) {
    int calls=0;
    try {projectedBlur(pixels.data(),width,height,quads[0],width,height,quads[0],1.5,[&]{return ++calls<cutoff;});check(false);}
    catch(const std::runtime_error &){check(true);}
  }
  std::cout<<assertions<<" projected backdrop mapping/pixel/cancellation assertions passed\n";
}
