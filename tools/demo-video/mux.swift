// mux <silent video.mp4> <sound.m4a> <out.mp4> : puts the sound track on the video without re-encoding either
import Foundation
import AVFoundation
let a = CommandLine.arguments
let video = AVURLAsset(url: URL(fileURLWithPath: a[1])), audio = AVURLAsset(url: URL(fileURLWithPath: a[2]))
let comp = AVMutableComposition()
guard let vt = video.tracks(withMediaType: .video).first, let at = audio.tracks(withMediaType: .audio).first else { print("missing track"); exit(1) }
let dur = video.duration
let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
try! cv.insertTimeRange(CMTimeRange(start: .zero, duration: dur), of: vt, at: .zero)
let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
try! ca.insertTimeRange(CMTimeRange(start: .zero, duration: CMTimeMinimum(dur, audio.duration)), of: at, at: .zero)
let out = URL(fileURLWithPath: a[3]); try? FileManager.default.removeItem(at: out)
let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough)!
ex.outputURL = out; ex.outputFileType = .mp4; ex.shouldOptimizeForNetworkUse = true
let sem = DispatchSemaphore(value: 0); ex.exportAsynchronously { sem.signal() }; sem.wait()
if ex.status == .completed {
  let r = AVURLAsset(url: out)
  print(String(format: "ok: %.1f s, video tracks %d, audio tracks %d", CMTimeGetSeconds(r.duration), r.tracks(withMediaType: .video).count, r.tracks(withMediaType: .audio).count))
} else { print("failed: \(String(describing: ex.error))"); exit(1) }
