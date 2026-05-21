# Replacement for retired CocoaPods artifact ffmpeg-kit-ios-https@6.0.
# Binaries: https://github.com/luthviar/ffmpeg-kit-ios-full (FFmpegKit 6.0 iOS xcframeworks).
Pod::Spec.new do |s|
  s.name             = 'ffmpeg-kit-ios-https'
  s.version          = '6.0'
  s.summary          = 'Self-hosted FFmpegKit iOS frameworks (ffmpeg-kit-ios-https replacement)'
  s.description      = 'Vendored FFmpegKit 6.0 xcframeworks for iOS after arthenica/ffmpeg-kit retirement.'
  s.homepage         = 'https://github.com/luthviar/ffmpeg-kit-ios-full'
  s.license          = { :type => 'LGPL-3.0' }
  s.author           = { 'luthviar' => 'https://github.com/luthviar/ffmpeg-kit-ios-full' }
  s.platform         = :ios, '12.1'
  s.static_framework = true
  s.module_name      = 'ffmpegkit'

  s.source = {
    :http => 'https://github.com/luthviar/ffmpeg-kit-ios-full/releases/download/6.0/ffmpeg-kit-ios-full.zip',
  }

  s.vendored_frameworks = 'ffmpeg-kit-ios-full/*.xcframework'
end
