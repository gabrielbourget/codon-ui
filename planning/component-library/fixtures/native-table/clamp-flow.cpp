#include "../../../../packages/react-native/cpp/table/ClampFlow.h"

#include <cassert>
#include <cmath>
#include <limits>
#include <stdexcept>

using namespace codon::table;

int main() {
  const std::vector<TClampFragment> paragraph{
      {{{0,0},{180,24}},18,101,0,101}, {{{0,24},{180,24}},42,101,1,101},
      {{{0,48},{180,24}},66,101,2,101}, {{{0,72},{180,24}},90,101,3,101},
      {{{0,96},{180,24}},114,101,4,101}, {{{0,120},{180,24}},138,101,5,101}};
  // The unchanged canonical browser has 24/48/72px viewports and 144px retained content.
  assert(resolveClampViewport(paragraph,144,0,1).height == 144);
  assert(resolveClampViewport(paragraph,144,1,1).height == 24);
  auto two = resolveClampViewport(paragraph,144,2,1);
  assert(two.height == 48 && two.contentHeight == 144 && two.clipped);
  assert(two.lastLine.size() == 1 && two.lastLine[0].line == 1);
  assert(resolveClampViewport(paragraph,144,3,1).height == 72);
  assert(!resolveClampViewport(paragraph,144,6,1).clipped);
  auto blocks = paragraph;
  blocks[1].flow = 202; blocks[1].tag = 202; blocks[1].line = 0;
  assert(resolveClampViewport(blocks,192,2,1).height == 48);
  auto inlineRuns = paragraph;
  inlineRuns.push_back({{{30,24},{45,24}},42,101,1,101});
  assert(resolveClampViewport(inlineRuns,144,2,1).height == 48);
  assert(resolveClampViewport(inlineRuns,144,2,1).lastLine.size() == 2);
  const std::vector<TClampFragment> variable{
      {{{0,0},{80,20}},15,201,0,201}, {{{0,20},{80,39.25}},50,202,0,202},
      {{{0,59.25},{80,12}},68,203,0,203}};
  assert(resolveClampViewport(variable,71.25,2,2).height == 59.5);
  const std::vector<TClampFragment> widget{
      {{{0,0},{100,24}},18,301,0,301},
      {{{0,24},{100,80}},100,302,0,302,ClampFragmentKind::Atomic},
      {{{0,104},{100,24}},122,303,0,303}};
  assert(resolveClampViewport(widget,128,2,1).height == 104);
  auto rtl = paragraph;
  for (auto &line : rtl) line.frame.origin.x = 25;
  assert(resolveClampViewport(rtl,144,2,1).height == 48);
  assert(revealClampRect(0,48,192,140,164) == 116);
  assert(revealClampRect(116,48,192,140,164) == 116);
  assert(revealClampRect(116,48,192,0,24) == 0);
  assert(revealClampRect(150,48,192,180,200) == 144);
  assert(revealClampRect(0,48,192,24,104) == 24);
  assert(revealClampRect(116,192,192,0,24) == 0);
  // An RTL/end-aligned oversized original control can extend before the content origin.
  assert(revealClampRect(0,180,300,-120,-20,-120) == -120);
  assert(revealClampRect(-120,180,300,140,180,-120) == 0);
  assert(revealClampRect(0,180,360,200,240,-120) == 60);
  bool rejected = false;
  try { resolveClampViewport(paragraph,144,2,0); } catch (const std::runtime_error &) { rejected = true; }
  assert(rejected);
  auto invalid = paragraph;
  invalid[0].baseline = std::numeric_limits<double>::quiet_NaN();
  rejected = false;
  try { resolveClampViewport(invalid,144,2,1); } catch (const std::runtime_error &) { rejected = true; }
  assert(rejected);
}
