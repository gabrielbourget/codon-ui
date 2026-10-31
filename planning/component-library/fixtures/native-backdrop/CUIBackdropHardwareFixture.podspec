Pod::Spec.new do |s|
  s.name = "CUIBackdropHardwareFixture"
  s.version = "0.0.0"
  s.summary = "Non-shipping owned hardware capture source for Codon UI component qualification."
  s.homepage = "https://github.com/gabrielbourget/codon-ui"
  s.author = "Codon UI"
  s.license = "MIT"
  s.source = { :git => "https://github.com/gabrielbourget/codon-ui.git" }
  s.platforms = { :ios => "15.1" }
  s.source_files = "BackdropHardwareTarget.mm"
  s.frameworks = "UIKit", "Metal", "QuartzCore"
  s.dependency "CodonNativeInput"
  install_modules_dependencies(s)
end
