require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |spec|
  spec.name = 'InttegroReactNative'
  spec.version = package['version']
  spec.summary = package['description']
  spec.homepage = package['homepage'] || 'https://inttegro.com'
  spec.license = package['license']
  spec.author = package['author']
  spec.source = {
    git: 'https://github.com/inttegro/inttegro-sdk-react-native.git',
    tag: spec.version.to_s,
  }
  spec.source_files = 'ios/**/*.{h,m,mm,swift}'
  spec.ios.deployment_target = '16.0'
  spec.requires_arc = true

  spec.dependency 'Inttegro', '0.3.0'
  install_modules_dependencies(spec)
end
