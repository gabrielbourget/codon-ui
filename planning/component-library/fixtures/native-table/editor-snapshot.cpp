#include <react/renderer/components/textinput/CuiTextSnapshot.h>
#include <cassert>
#include <stdexcept>
#include <vector>
using namespace facebook::react;
int main() {
  assert(!findCuiTextSnapshotSource(7));
  assert(!captureCuiTextSnapshot(7,{}));
  int captures=0;
  auto original=std::make_shared<std::vector<int>>(std::initializer_list<int>{1,2,3});
  auto first=registerCuiTextSnapshotSource(7,101,[&](std::shared_ptr<void> value)->std::shared_ptr<const void> {
    captures++;
    return std::make_shared<const std::vector<int>>(*std::static_pointer_cast<std::vector<int>>(value));
  });
  auto retained=first->source();
  bool unavailable=false;
  try { retained->read(); } catch (const std::runtime_error &) { unavailable=true; }
  assert(unavailable);
  assert(captureCuiTextSnapshot(7,original)==retained);
  auto one=retained->read();
  assert(captures==1 && retained->current(one));
  assert((*original==std::vector<int>{1,2,3}));
  original->at(0)=9;
  assert(std::static_pointer_cast<const std::vector<int>>(one->ownedPayload)->at(0)==1);
  captureCuiTextSnapshot(7,original);
  auto two=retained->read();
  assert(two->version==one->version+1 && !retained->current(one) && retained->current(two));
  assert(std::static_pointer_cast<const std::vector<int>>(two->ownedPayload)->at(0)==9);
  auto second=registerCuiTextSnapshotSource(7,202,{});
  assert(!retained->current(two));
  first->dispose();
  assert(findCuiTextSnapshotSource(7)==second->source());
  assert(!publishCuiTextSnapshot(7,101,original));
  assert(publishCuiTextSnapshot(7,202,std::make_shared<const int>(4)));
  auto current=second->source()->read();
  assert(*std::static_pointer_cast<const int>(current->ownedPayload)==4);
  assert(publishCuiTextSnapshot(7,202,{},"isolated source failed"));
  bool failed=false;
  try { second->source()->read(); } catch (const std::runtime_error &) { failed=true; }
  assert(failed && !second->source()->current(current));
  auto throws=registerCuiTextSnapshotSource(9,303,[](std::shared_ptr<void>)->std::shared_ptr<const void> {
    throw std::runtime_error("opaque producer needs cooperation");
  });
  assert(captureCuiTextSnapshot(9,original)==throws->source());
  failed=false;
  try { throws->source()->read(); } catch (const std::runtime_error &) { failed=true; }
  assert(failed);
  second->dispose();
  assert(!findCuiTextSnapshotSource(7));
  assert(!second->source()->current(current));
  assert(!publishCuiTextSnapshot(7,202,original));
}
