#include "NativeTransformValue.h"

#include <algorithm>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <limits>
#include <locale>
#include <sstream>
#include <string>

using codon::motion::readNativeMotionMatrixScalar;

namespace {
std::size_t assertions = 0;

void require(bool condition, const char *message) {
  ++assertions;
  if (!condition) throw std::runtime_error(message);
}

template <typename T, std::size_t N>
void scalar(const std::array<T, N> &matrix, std::string_view name, double expected) {
  const auto value = readNativeMotionMatrixScalar(matrix, name);
  require(value.has_value(), "expected supported matrix scalar");
  require(std::abs(*value - expected) <= 1e-12 * std::max(1.0, std::abs(expected)), "matrix scalar mismatch");
}

void selfTest() {
  const std::array<double, 6> matrix2d{-2, 3, -4, 5, 6, -7};
  scalar(matrix2d, "translateX", 6);
  scalar(matrix2d, "translateY", -7);
  scalar(matrix2d, "scaleX", -2);
  scalar(matrix2d, "scaleY", 5);
  scalar(matrix2d, "scale", 3.5);
  scalar(matrix2d, "skew", 3.5);
  require(!readNativeMotionMatrixScalar(matrix2d, "z"), "2d must not invent z");
  require(!readNativeMotionMatrixScalar(matrix2d, "rotateX"), "2d must not invent rotateX");
  std::array<double, 16> matrix3d{-2, 3, 80, 0, -4, 5, -6, 0, 0, 0, 1, -.002, 6, -7, 8, 1};
  scalar(matrix3d, "scaleX", std::sqrt(13));
  scalar(matrix3d, "scaleY", std::sqrt(41));
  scalar(matrix3d, "scale", (std::sqrt(13) + std::sqrt(41)) / 2);
  scalar(matrix3d, "skew", 3.5);
  scalar(matrix3d, "translateZ", 8);
  require(!readNativeMotionMatrixScalar(matrix3d, "scaleZ"), "source parser has no scaleZ scalar");
  require(!readNativeMotionMatrixScalar(matrix3d, "rotation"), "native rotation alias belongs to caller");
  require(!readNativeMotionMatrixScalar(matrix3d, "pathRotation"), "native path alias belongs to caller");
  require(!readNativeMotionMatrixScalar(matrix3d, "transformPerspective"), "native perspective belongs to caller");
  matrix3d[0] = 1;
  matrix3d[1] = -1;
  scalar(matrix3d, "rotate", 315);
  scalar(matrix3d, "rotateZ", 315);
  matrix3d[1] = -0.0;
  const auto negativeZero = readNativeMotionMatrixScalar(matrix3d, "rotateZ");
  require(negativeZero && *negativeZero == 0 && std::signbit(*negativeZero), "negative zero must survive angle rebasing");
  matrix3d[2] = std::numeric_limits<double>::infinity();
  bool rejected = false;
  try { readNativeMotionMatrixScalar(matrix3d, "scaleX"); }
  catch (const std::runtime_error &) { rejected = true; }
  require(rejected, "non-finite matrix must fail");
  const std::array<float, 16> floatMatrix{3, 4, 19, 0, 0, 2, 0, 0, 0, 0, 1, 0, 11, 12, 13, 1};
  scalar(floatMatrix, "scaleX", 5);
  scalar(floatMatrix, "scaleY", 2);
  std::cout << "portable transform assertions " << assertions << '\n';
}

template <std::size_t N>
void query(std::istringstream &line, const std::string &name) {
  std::array<double, N> matrix;
  for (auto &value : matrix) {
    std::string token;
    if (!(line >> token)) throw std::runtime_error("missing matrix coefficient");
    char *end = nullptr;
    value = std::strtod(token.c_str(), &end);
    if (!end || *end != '\0') throw std::runtime_error("invalid matrix coefficient");
  }
  std::string extra;
  if (line >> extra) throw std::runtime_error("extra matrix coefficient");
  const auto value = readNativeMotionMatrixScalar(matrix, name);
  if (value) std::cout << *value << '\n';
  else std::cout << "unsupported\n";
}
} // namespace

int main(int argc, char **argv) {
  try {
    std::cout.imbue(std::locale::classic());
    std::cout << std::setprecision(std::numeric_limits<double>::max_digits10);
    if (argc == 2 && std::string_view(argv[1]) == "--self-test") {
      selfTest();
      return 0;
    }
    std::string input;
    while (std::getline(std::cin, input)) {
      std::istringstream line(input);
      line.imbue(std::locale::classic());
      std::size_t dimension;
      std::string name;
      if (!(line >> dimension >> name)) throw std::runtime_error("missing query fields");
      if (dimension == 6) query<6>(line, name);
      else if (dimension == 16) query<16>(line, name);
      else throw std::runtime_error("matrix dimension must be 6 or 16");
    }
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
