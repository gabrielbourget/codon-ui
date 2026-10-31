#include "../../../../packages/react-native/cpp/overlay/NativeTypographySource.h"
#include "../../../../packages/react-native/cpp/motion/NativeIntrinsicSource.h"
#include "../../../../packages/react-native/cpp/table/ClampContentSource.h"
#include "../../../../packages/react-native/cpp/table/ClampFlow.h"

#ifdef __cplusplus
#include <type_traits>

static_assert(std::is_abstract_v<codon::typography::TNativeTypographySource>);
static_assert(std::is_abstract_v<codon::motion::CUIIntrinsicSource>);
static_assert(std::is_abstract_v<codon::table::CUIClampContentSource>);
codon::table::TClampViewport viewport;
#endif
