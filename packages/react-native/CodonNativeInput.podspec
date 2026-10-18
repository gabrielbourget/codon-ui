require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name = "CodonNativeInput"
  s.version = package["version"]
  s.summary = package["description"]
  s.homepage = "https://github.com/gabrielbourget/codon-ui"
  s.license = "MIT"
  s.author = "Tendril Systems"
  s.platforms = { :ios => min_ios_version_supported }
  s.source = { :git => "https://github.com/gabrielbourget/codon-ui.git", :tag => s.version.to_s }
  s.source_files = "ios/**/*.{h,mm}"
  s.private_header_files = "ios/**/*.h"
  install_modules_dependencies(s)
end
