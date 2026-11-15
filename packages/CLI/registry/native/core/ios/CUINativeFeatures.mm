#include "CUINativeFeatures.h"
#include <stdexcept>

class CUIUnavailableTableFeature final : public CUINativeTableFeature {
 public:
  std::string request(facebook::jsi::Runtime &, const std::string &) override {
    throw std::runtime_error("Table sticky: feature not installed");
  }
  void setSurfacePresenter(RCTSurfacePresenter *) override {}
  void close() override {}
};

std::shared_ptr<CUINativeTableFeature> CUICreateNativeTableFeature(
    std::shared_ptr<std::atomic<bool>>, std::shared_ptr<std::mutex>) {
  return std::make_shared<CUIUnavailableTableFeature>();
}
