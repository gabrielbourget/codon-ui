require "xcodeproj"
require "fileutils"

# A private test-only project targets the one product already launched by the cohort.
destination, source = ARGV
raise "Expected fresh project destination and canonical Swift source" unless destination && source && !File.exist?(destination)
FileUtils.mkdir_p(destination)
project = Xcodeproj::Project.new(File.join(destination, "TimeEntryTrial.xcodeproj"))
target = project.new_target(:ui_test_bundle, "TimeEntryTrial", :ios, "15.1")
target.add_file_references([project.main_group.new_file(File.expand_path(source))])
target.build_configurations.each do |config|
  config.build_settings.merge!({
    "GENERATE_INFOPLIST_FILE" => "YES",
    "PRODUCT_BUNDLE_IDENTIFIER" => "dev.codonui.timeentrytrial",
    "SWIFT_VERSION" => "5.0",
    "CODE_SIGNING_ALLOWED" => "NO",
    "CODE_SIGNING_REQUIRED" => "NO",
    "TARGETED_DEVICE_FAMILY" => "1,2",
    "ARCHS" => "x86_64",
    "SUPPORTED_PLATFORMS" => "iphonesimulator"
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, "TimeEntryTrial", true)
