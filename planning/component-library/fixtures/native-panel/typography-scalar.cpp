#include <react/renderer/attributedstring/FontWeightScalar.h>
#include <react/renderer/attributedstring/TextStyleFields.h>
#include <cassert>
#include <iostream>
#include <locale>
#include <set>

using namespace facebook::react;
int main() {
  size_t assertions=0;
  const auto check=[&](bool value) { if (!value) std::cerr << "Typography scalar assertion " << assertions << "\n"; assert(value); assertions++; };
  for (double value : {1.0,100.0,400.0,750.5,750.123456789,999.999999,1000.0}) {
    std::ostringstream encoded; encoded.imbue(std::locale::classic()); encoded.precision(17); encoded<<value;
    check(parseFontWeightScalar(encoded.str())==value);
    check(fontWeightScalarEqual(value,value));
  }
  check(parseFontWeightScalar("normal")==400 && parseFontWeightScalar("regular")==400 && parseFontWeightScalar("bold")==700);
  check(parseFontWeightScalar("7.505e2")==750.5);
  for (const auto *value : {"", "0", "1000.01", "-1", "NaN", "inf", "750px", "750,5", " 750", "750 ", "bolder", "inherit"})
    check(std::isnan(parseFontWeightScalar(value)));
  struct Comma : std::numpunct<char> { char do_decimal_point() const override { return ','; } };
  const auto old=std::locale(); std::locale::global(std::locale(old,new Comma));
  check(parseFontWeightScalar("750.25")==750.25);
  check(std::isnan(parseFontWeightScalar("750,25")));
  std::locale::global(old);
  check(fontWeightScalarEqual(NAN,std::numeric_limits<double>::signaling_NaN()));
  check(!fontWeightScalarEqual(750.5,750.50000001));
  check(!fontWeightScalarEqual(NAN,400));
  const std::array<double,9> traits={-.8,-.6,-.4,0,.23,.30,.40,.56,.62};
  for (size_t index=0;index<traits.size();index++) check(interpolateFontWeight(100.0*(index+1),traits)==traits[index]);
  check(std::abs(interpolateFontWeight(750.5,traits)-.4808)<1e-12);
  check(std::abs(interpolateFontWeight(425,traits)-.0575)<1e-12);
  check(interpolateFontWeight(1,traits)==traits.front() && interpolateFontWeight(1000,traits)==traits.back());
  std::set<uint64_t> bits;
  for (const auto name : TextStyleFieldNames) { auto bit=textStyleFieldBit(name); check(bit && !(bit&(bit-1))); bits.insert(bit); }
  check(bits.size()==TextStyleFieldNames.size());
  check(textStyleFieldBit("text")==0 && textStyleFieldBit("selection")==0 && textStyleFieldBit("value")==0);
  uint64_t declarations=textStyleFieldBit("fontWeight")|textStyleFieldBit("letterSpacing");
  declarations&=~textStyleFieldBit("fontWeight");
  check(!(declarations&textStyleFieldBit("fontWeight")) && (declarations&textStyleFieldBit("letterSpacing")));
  std::cout<<assertions<<" actual SDK font scalar/trait/field-identity assertions passed\n";
}
