// Turns captured frames into an H.264 MP4 at a constant frame rate.
//   encode <list.tsv: "seconds<TAB>file" per line> <out.mp4> <width> <height> [fps] [bitrate]
import Foundation
import AVFoundation
import CoreGraphics
import ImageIO
import CoreVideo

let a = CommandLine.arguments
let lines = try! String(contentsOfFile: a[1], encoding: .utf8).split(separator: "\n")
let outURL = URL(fileURLWithPath: a[2])
let width = Int(a[3])!, height = Int(a[4])!
let fps = a.count > 5 ? Int(a[5])! : 30
let bitrate = a.count > 6 ? Int(a[6])! : 3_000_000
var frames: [(Double, String)] = []
for l in lines { let p = l.split(separator: "\t"); if p.count == 2, let t = Double(p[0]) { frames.append((t, String(p[1]))) } }
if frames.isEmpty { print("no frames"); exit(1) }
let t0 = frames[0].0
try? FileManager.default.removeItem(at: outURL)
let writer = try! AVAssetWriter(outputURL: outURL, fileType: .mp4)
let settings: [String: Any] = [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: bitrate, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel, AVVideoMaxKeyFrameIntervalKey: fps * 2, AVVideoExpectedSourceFrameRateKey: fps]]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height])
writer.add(input)
guard writer.startWriting() else { print("cannot start: \(String(describing: writer.error))"); exit(1) }
writer.startSession(atSourceTime: .zero)
let total = frames.last!.0 - t0 + 0.5
let count = Int(total * Double(fps))
var idx = 0, lastIdx = -1
var current: CVPixelBuffer? = nil
func load(_ file: String) -> CVPixelBuffer? {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: file) as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { return nil }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  guard let buf = pb else { return nil }
  CVPixelBufferLockBaseAddress(buf, [])
  if let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buf),
                         space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue) {
    ctx.interpolationQuality = .high
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: width, height: height))
  }
  CVPixelBufferUnlockBaseAddress(buf, [])
  return buf
}
for k in 0..<count {
  let t = Double(k) / Double(fps)
  while idx + 1 < frames.count && frames[idx + 1].0 - t0 <= t { idx += 1 }
  if idx != lastIdx { if let b = load(frames[idx].1) { current = b }; lastIdx = idx }
  guard let buf = current else { continue }
  while !input.isReadyForMoreMediaData { usleep(2000) }
  adaptor.append(buf, withPresentationTime: CMTime(value: CMTimeValue(k), timescale: CMTimeScale(fps)))
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
print(writer.status == .completed ? "ok \(count) frames, \(String(format: "%.1f", total)) s" : "failed: \(String(describing: writer.error))")
