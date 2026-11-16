#include "CUINativeFeatures.h"
#include "CUITableFeature.h"

std::shared_ptr<CUINativeTableFeature> CUICreateNativeTableFeature(
    std::shared_ptr<std::atomic<bool>> valid, std::shared_ptr<std::mutex> mutex) {
  return CUICreateTableFeature(std::move(valid), std::move(mutex));
}
