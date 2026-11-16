#include "CUITableFeature.h"
#import "CUITableStickyPresentation.h"
#include <react/renderer/uimanager/UIManagerBinding.h>
#include <folly/json.h>
#include <stdexcept>

struct CUITableSession {
  std::shared_ptr<std::mutex> mutex;
  std::shared_ptr<codon::table::NativeTableStickyPresentation> table;
  __strong CUITableStickyPresentation *tableDriver;
  __weak RCTSurfacePresenter *presenter;
  bool retired{false};
  void close() {
    std::shared_ptr<codon::table::NativeTableStickyPresentation> sticky;
    CUITableStickyPresentation *driver;
    {
      std::lock_guard lock(*mutex);
      retired = true;
      sticky = std::move(table); driver = tableDriver; tableDriver = nil;
    }
    dispatch_async(dispatch_get_main_queue(), ^{
      [driver invalidate];
      if (sticky) sticky->close();
    });
  }
};

static void CUIUpdateStickyDriver(const std::shared_ptr<CUITableSession> &session,
    const std::shared_ptr<std::atomic<bool>> &valid) {
  dispatch_async(dispatch_get_main_queue(), ^{
    CUITableStickyPresentation *driver;
    {
      std::lock_guard lock(*session->mutex);
      if (session->retired || !valid->load() || !session->table) return;
      if (!session->tableDriver && session->presenter)
        session->tableDriver = [[CUITableStickyPresentation alloc] initWithPresenter:session->presenter service:session->table];
      driver = session->tableDriver;
    }
    [driver synchronize];
  });
}

class CUITableFeature final : public CUINativeTableFeature {
 public:
  CUITableFeature(std::shared_ptr<std::atomic<bool>> valid, std::shared_ptr<std::mutex> mutex)
      : valid_(std::move(valid)), session_(std::make_shared<CUITableSession>()) {
    session_->mutex = std::move(mutex);
  }
  std::string request(facebook::jsi::Runtime &runtime, const std::string &encoded) override {
    const auto request = folly::parseJson(encoded);
    std::shared_ptr<codon::table::NativeTableStickyPresentation> table;
    {
      std::lock_guard lock(*session_->mutex);
      if (session_->retired || !valid_->load()) {
        if (request.at("action").asString() == "release")
          return folly::toJson(folly::dynamic::object("lease", request.at("lease"))("released", true));
        throw std::runtime_error("Table sticky: module retired");
      }
      if (!session_->table) {
        const auto binding = facebook::react::UIManagerBinding::getBinding(runtime);
        if (!binding) throw std::runtime_error("Table sticky: calling Fabric binding unavailable");
        auto manager = std::shared_ptr<facebook::react::UIManager>(binding, &binding->getUIManager());
        session_->table = std::make_shared<codon::table::NativeTableStickyPresentation>(std::move(manager));
      }
      table = session_->table;
    }
    const auto response = table->request(encoded);
    CUIUpdateStickyDriver(session_, valid_);
    return response;
  }
  void setSurfacePresenter(RCTSurfacePresenter *presenter) override {
    std::lock_guard lock(*session_->mutex);
    session_->presenter = presenter;
  }
  void close() override { session_->close(); }
 private:
  std::shared_ptr<std::atomic<bool>> valid_;
  std::shared_ptr<CUITableSession> session_;
};

std::shared_ptr<CUINativeTableFeature> CUICreateTableFeature(
    std::shared_ptr<std::atomic<bool>> valid, std::shared_ptr<std::mutex> mutex) {
  return std::make_shared<CUITableFeature>(std::move(valid), std::move(mutex));
}
