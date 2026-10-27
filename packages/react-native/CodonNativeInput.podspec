require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
cui_state_peer_headers = ["react-native-safe-area-context", "react-native-teleport"].map do |name|
  package_json = Pod::Executable.execute_command("node", ["--print", "require.resolve('#{name}/package.json', {paths: [#{__dir__.to_json}]})"]).strip
  '"' + File.join(File.dirname(package_json), "common/cpp") + '"'
end

Pod::Spec.new do |s|
  s.name = "CodonNativeInput"
  s.version = package["version"]
  s.summary = package["description"]
  s.homepage = "https://github.com/gabrielbourget/codon-ui"
  s.license = "MIT"
  s.author = "Tendril Systems"
  s.platforms = { :ios => min_ios_version_supported }
  s.source = { :git => "https://github.com/gabrielbourget/codon-ui.git", :tag => s.version.to_s }
  s.source_files = "ios/**/*.{h,mm,swift}", "cpp/**/*.{h,cpp}"
  s.public_header_files = "ios/CUIBackdropCaptureSource.h", "ios/CUIForegroundCompositionSource.h", "cpp/overlay/NativeTypographySource.h"
  s.private_header_files = Dir.glob(File.join(__dir__, "{ios,cpp}/**/*.h")).map { |path| path.delete_prefix("#{__dir__}/") }.reject { |path| ["ios/CUIBackdropCaptureSource.h", "ios/CUIForegroundCompositionSource.h", "cpp/overlay/NativeTypographySource.h"].include?(path) }
  s.frameworks = "Accessibility"
  s.pod_target_xcconfig = { "HEADER_SEARCH_PATHS" => "$(inherited) #{cui_state_peer_headers.join(' ')}" }
  install_modules_dependencies(s)
end
