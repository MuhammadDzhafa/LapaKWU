"""Measure every authored anchor against the BGM in the encoded MP4."""

import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np
from scipy import signal


RATE = 16000
FPS = 30
EXPECTED_SECONDS = 55
PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT / "public/demo/audio/music.wav"
FFMPEG = PROJECT / "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe"


def decode(path, ffmpeg, dest, rate=RATE, channels=1):
    subprocess.run([str(ffmpeg), "-loglevel", "error", "-y", "-i", str(path),
                    "-map", "0:a:0", "-ar", str(rate), "-ac", str(channels), "-c:a", "pcm_s16le",
                    str(dest)], check=True)
    with wave.open(str(dest), "rb") as wav:
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").astype(float)


def measure_peaks(stereo_audio):
    channels = stereo_audio.reshape(-1, 2)
    clipped = int(np.count_nonzero((channels >= 32767) | (channels <= -32768)))
    sample_peak = np.max(np.abs(channels)) / 32768
    true_peak = max(
        np.max(np.abs(signal.resample_poly(channel / 32768, 4, 1, window=("kaiser", 8.6))))
        for channel in channels.T
    )
    return {
        "samplePeakDbfs": float(20 * np.log10(max(sample_peak, 1e-9))),
        "estimatedTruePeakDbtp": float(20 * np.log10(max(true_peak, 1e-9))),
        "peakOversampling": 4,
        "clippedSamples": clipped,
    }


def rendered_hit_time(reference, rendered, hit):
    # Locate the same drum attack by matching the original waveform around it.
    radius = round(.14 * RATE)
    search_range = round(.17 * RATE)
    center = round(hit * RATE)
    lo, hi = max(0, center - radius), min(len(reference), center + radius)
    search_lo, search_hi = max(0, lo - search_range), min(len(rendered), hi + search_range)
    sample = reference[lo:hi]
    sample = sample - np.mean(sample)
    search = rendered[search_lo:search_hi]
    covariance = signal.correlate(search, sample, mode="valid")
    powers = np.convolve(search ** 2, np.full(len(sample), 1.0), mode="valid")
    normalized = covariance / np.maximum(np.sqrt(powers) * np.linalg.norm(sample), 1.0)
    index = int(np.argmax(normalized))
    return hit + (search_lo + index - lo) / RATE, float(normalized[index])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("anchors", type=Path, help='JSON array of {"label","frame","t"}')
    parser.add_argument("report", type=Path)
    parser.add_argument("--ffmpeg", type=Path, default=FFMPEG)
    args = parser.parse_args()
    anchors = json.loads(args.anchors.read_text(encoding="utf-8"))
    if not anchors:
        parser.error("at least one time anchor is required")
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        source = decode(SOURCE, args.ffmpeg, temp / "source.wav")
        rendered = decode(args.video, args.ffmpeg, temp / "render.wav")
        stereo = decode(args.video, args.ffmpeg, temp / "stereo.wav", rate=48000, channels=2)
    findings = []
    for anchor in anchors:
        hit = anchor["t"]
        measured, confidence = rendered_hit_time(source, rendered, hit)
        finding = {**anchor, "renderedHitSeconds": measured,
                   "encodingOffsetMs": (measured - hit) * 1000,
                   "frameQuantizationError": anchor["frame"] - hit * FPS,
                   "finalErrorFrames": anchor["frame"] - measured * FPS,
                   "waveformCorrelation": confidence}
        findings.append(finding)
    duration = len(rendered) / RATE
    max_error = max(abs(entry["finalErrorFrames"]) for entry in findings)
    confident = min(entry["waveformCorrelation"] for entry in findings) > .5
    length_error = abs(duration - EXPECTED_SECONDS) * FPS
    passed = bool(max_error <= 3 and length_error <= 3 and confident)
    report = {"renderedAudioDuration": duration, "durationErrorFrames": length_error,
              "maxAbsoluteSyncErrorFrames": max_error, "pass": passed,
              "peaks": measure_peaks(stereo), "anchors": findings}
    args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
