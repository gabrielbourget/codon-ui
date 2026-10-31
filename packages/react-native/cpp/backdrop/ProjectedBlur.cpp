#include "ProjectedBlur.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace codon::backdrop {
namespace {
void check(const std::function<bool()> &current) {
  if (!current || !current()) throw std::runtime_error("Native backdrop: projected frame retired");
}
size_t imageBytes(size_t width, size_t height) {
  if (!width || !height || width > static_cast<size_t>(INT64_MAX / 4) ||
      height > static_cast<size_t>(INT64_MAX / 4) || width > std::numeric_limits<size_t>::max() / 4 / height)
    throw std::invalid_argument("Native backdrop: invalid projected image size");
  return width * height * 4;
}
TProjection inverse(const TProjection &m) {
  TProjection result{m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4],
      m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5],
      m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3]};
  const double determinant = m[0]*result[0] + m[1]*result[3] + m[2]*result[6];
  if (!std::isfinite(determinant) || determinant == 0)
    throw std::invalid_argument("Native backdrop: singular projection");
  for (double &value : result) {
    value /= determinant;
    if (!std::isfinite(value)) throw std::invalid_argument("Native backdrop: projection inverse is not finite");
  }
  return result;
}
void sample(const uint8_t *pixels, size_t width, size_t height, TPoint point, uint8_t *output) {
  if (point.x < 0 || point.y < 0 || point.x >= static_cast<double>(width) || point.y >= static_cast<double>(height)) {
    std::fill_n(output, 4, 0); return;
  }
  const double x = std::clamp(point.x - 0.5, 0.0, static_cast<double>(width - 1));
  const double y = std::clamp(point.y - 0.5, 0.0, static_cast<double>(height - 1));
  const auto left = static_cast<size_t>(std::floor(x)), top = static_cast<size_t>(std::floor(y));
  const auto right = std::min(left + 1, width - 1), bottom = std::min(top + 1, height - 1);
  const double fx = x - left, fy = y - top;
  for (size_t channel = 0; channel < 4; channel++) {
    const auto at = [&](size_t column, size_t row) { return pixels[(row * width + column) * 4 + channel]; };
    output[channel] = static_cast<uint8_t>(std::clamp(std::lround(
        (at(left, top)*(1-fx) + at(right, top)*fx)*(1-fy) +
        (at(left, bottom)*(1-fx) + at(right, bottom)*fx)*fy), 0L, 255L));
  }
}
bool inside(const TQuad &quad, TPoint point) {
  double direction = 0;
  for (size_t index = 0; index < 4; index++) {
    const auto a = quad[index], b = quad[(index+1)%4];
    const double cross = (b.x-a.x)*(point.y-a.y) - (b.y-a.y)*(point.x-a.x);
    if (cross == 0) continue;
    if (direction && std::signbit(cross) != std::signbit(direction)) return false;
    direction = cross;
  }
  return true;
}
bool collapsed(const TQuad &quad) {
  for (const auto &point : quad) if (!std::isfinite(point.x) || !std::isfinite(point.y)) return false;
  for (size_t index = 0; index < 4; index++) {
    const auto a=quad[index], b=quad[(index+1)%4], c=quad[(index+2)%4];
    if ((b.x-a.x)*(c.y-b.y) - (b.y-a.y)*(c.x-b.x) != 0) return false;
  }
  return true;
}
TPoint mirrorIntoQuad(TPoint point, const TQuad &quad, const std::function<bool()> &current) {
  const double winding=(quad[1].x-quad[0].x)*(quad[2].y-quad[1].y) -
      (quad[1].y-quad[0].y)*(quad[2].x-quad[1].x);
  TPoint center{0,0};
  double coordinateScale=std::max({1.0,std::abs(point.x),std::abs(point.y)});
  for (const auto &corner:quad) {
    center.x+=corner.x/4; center.y+=corner.y/4;
    coordinateScale=std::max({coordinateScale,std::abs(corner.x),std::abs(corner.y)});
  }
  const double tolerance=std::numeric_limits<double>::epsilon()*coordinateScale*64;
  for (size_t reflections=0;;reflections++) {
    if (reflections && reflections%64==0) check(current);
    double greatestDistance=0;
    TPoint normal{0,0};
    for (size_t index=0;index<4;index++) {
      const auto a=quad[index], b=quad[(index+1)%4];
      const double length=std::hypot(b.x-a.x,b.y-a.y);
      TPoint outward{(b.y-a.y)/length, (a.x-b.x)/length};
      if (winding<0) {outward.x=-outward.x;outward.y=-outward.y;}
      const double distance=(point.x-a.x)*outward.x+(point.y-a.y)*outward.y;
      if (distance>greatestDistance) {greatestDistance=distance;normal=outward;}
    }
    if (greatestDistance==0) return point;
    if (greatestDistance<=tolerance) {
      const double distance=std::hypot(center.x-point.x,center.y-point.y);
      const double fraction=std::min(1.0,tolerance*4/distance);
      return {point.x+(center.x-point.x)*fraction,point.y+(center.y-point.y)*fraction};
    }
    TPoint reflected{point.x-2*greatestDistance*normal.x,point.y-2*greatestDistance*normal.y};
    if (!std::isfinite(reflected.x) || !std::isfinite(reflected.y) ||
        (reflected.x==point.x && reflected.y==point.y))
      throw std::runtime_error("Native backdrop: unrepresentable mirrored screen coordinate");
    point=reflected;
  }
}
}

TPoint project(const TProjection &m, TPoint point) {
  const double weight = m[6]*point.x + m[7]*point.y + m[8];
  if (!std::isfinite(weight) || weight == 0)
    throw std::invalid_argument("Native backdrop: projection crosses its horizon");
  TPoint result{(m[0]*point.x + m[1]*point.y + m[2])/weight,
      (m[3]*point.x + m[4]*point.y + m[5])/weight};
  if (!std::isfinite(result.x) || !std::isfinite(result.y))
    throw std::invalid_argument("Native backdrop: projection crosses its horizon");
  return result;
}

TProjection rectangleProjection(double width, double height, const TQuad &q) {
  if (!std::isfinite(width) || !std::isfinite(height) || width <= 0 || height <= 0)
    throw std::invalid_argument("Native backdrop: empty projection rectangle");
  double direction = 0;
  for (size_t index = 0; index < 4; index++) {
    const auto a = q[index], b = q[(index+1)%4], c = q[(index+2)%4];
    if (!std::isfinite(a.x) || !std::isfinite(a.y))
      throw std::invalid_argument("Native backdrop: nonfinite screen quad");
    const double cross = (b.x-a.x)*(c.y-b.y) - (b.y-a.y)*(c.x-b.x);
    if (!std::isfinite(cross) || cross == 0 || (index && std::signbit(cross) != std::signbit(direction)))
      throw std::invalid_argument("Native backdrop: folded or singular screen quad");
    direction = cross;
  }
  const double dx1=q[1].x-q[2].x, dx2=q[3].x-q[2].x, dx3=q[0].x-q[1].x+q[2].x-q[3].x;
  const double dy1=q[1].y-q[2].y, dy2=q[3].y-q[2].y, dy3=q[0].y-q[1].y+q[2].y-q[3].y;
  double g=0, h=0;
  if (dx3 != 0 || dy3 != 0) {
    const double determinant=dx1*dy2-dx2*dy1;
    if (!std::isfinite(determinant) || determinant == 0)
      throw std::invalid_argument("Native backdrop: singular screen quad");
    g=(dx3*dy2-dx2*dy3)/determinant;
    h=(dx1*dy3-dx3*dy1)/determinant;
  }
  TProjection result{(q[1].x-q[0].x+g*q[1].x)/width, (q[3].x-q[0].x+h*q[3].x)/height, q[0].x,
      (q[1].y-q[0].y+g*q[1].y)/width, (q[3].y-q[0].y+h*q[3].y)/height, q[0].y, g/width, h/height, 1};
  for (double value : result) if (!std::isfinite(value))
    throw std::invalid_argument("Native backdrop: nonfinite projection");
  for (double weight : {1.0, 1+g, 1+h, 1+g+h})
    if (!std::isfinite(weight) || weight <= 0)
      throw std::invalid_argument("Native backdrop: screen quad crosses its horizon");
  return result;
}

std::vector<uint8_t> projectedBlur(const uint8_t *pixels, size_t width, size_t height,
    const TQuad &source, size_t outputWidth, size_t outputHeight, const TQuad &receiver,
    double sigma, const std::function<bool()> &current) {
  imageBytes(width, height);
  const size_t outputBytes = imageBytes(outputWidth, outputHeight);
  if (!pixels || !std::isfinite(sigma) || sigma < 0)
    throw std::invalid_argument("Native backdrop: invalid projected blur input");
  check(current);
  for (const auto &quad : {source, receiver}) for (const auto &point : quad)
    if (!std::isfinite(point.x) || !std::isfinite(point.y))
      throw std::invalid_argument("Native backdrop: nonfinite projected screen coordinate");
  if (collapsed(source) || collapsed(receiver)) {
    std::vector<uint8_t> empty(outputBytes, 0);
    check(current);
    return empty;
  }
  const auto toSource = inverse(rectangleProjection(width, height, source));
  const auto toScreen = rectangleProjection(outputWidth, outputHeight, receiver);
  std::vector<uint8_t> output;
  const auto sampleSource = [&](TPoint screen, uint8_t *destination) {
    if (inside(source, screen)) sample(pixels, width, height, project(toSource, screen), destination);
    else std::fill_n(destination, 4, 0);
  };
  if (sigma == 0) {
    output.resize(outputBytes);
    for (size_t y = 0; y < outputHeight; y++) {
      check(current);
      for (size_t x = 0; x < outputWidth; x++)
        sampleSource(project(toScreen, {x+0.5, y+0.5}),
            output.data() + (y*outputWidth+x)*4);
    }
    check(current);
    return output;
  }
  double left=receiver[0].x, top=receiver[0].y, right=left, bottom=top;
  for (const auto &point : receiver) {
    left=std::min(left, point.x); top=std::min(top, point.y);
    right=std::max(right, point.x); bottom=std::max(bottom, point.y);
  }
  // Extend the transformed border quad before filtering. Mirroring a bounding
  // rectangle instead would admit unrelated pixels across rotated/skewed edges.
  const double padding=std::ceil(sigma*6)+2;
  if (!std::isfinite(padding)) throw std::length_error("Native backdrop: unaddressable blur padding");
  left=std::floor(left)-padding; top=std::floor(top)-padding;
  right=std::ceil(right)+padding; bottom=std::ceil(bottom)+padding;
  const double screenWidth=right-left, screenHeight=bottom-top;
  if (!std::isfinite(screenWidth) || !std::isfinite(screenHeight) || screenWidth < 1 || screenHeight < 1 ||
      screenWidth >= static_cast<double>(INT64_MAX/4) || screenHeight >= static_cast<double>(INT64_MAX/4))
    throw std::length_error("Native backdrop: unaddressable projected screen region");
  const size_t columns=static_cast<size_t>(screenWidth), rows=static_cast<size_t>(screenHeight);
  std::vector<uint8_t> screen(imageBytes(columns, rows));
  for (size_t y = 0; y < rows; y++) {
    check(current);
    for (size_t x = 0; x < columns; x++)
      sampleSource(mirrorIntoQuad({left+x+0.5, top+y+0.5}, receiver, current), screen.data()+(y*columns+x)*4);
  }
  auto blurred=gaussianBlur(screen.data(), columns, rows, sigma, current);
  std::vector<uint8_t>().swap(screen);
  output.resize(outputBytes);
  for (size_t y = 0; y < outputHeight; y++) {
    check(current);
    for (size_t x = 0; x < outputWidth; x++) {
      auto point=project(toScreen, {x+0.5, y+0.5}); point.x-=left; point.y-=top;
      sample(blurred.data(), columns, rows, point, output.data()+(y*outputWidth+x)*4);
    }
  }
  check(current);
  return output;
}
}
