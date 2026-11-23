"""Measure the constant beat grid and classify percussive attacks in the music."""

import json
from pathlib import Path

import librosa
import numpy as np
from scipy import optimize, signal


MUSIC = Path(__file__).resolve().parents[1] / "public/demo/audio/music.wav"
HOP = 110
RATE = 22050


def unit_strength(onset):
    return onset / max(float(np.quantile(onset, 0.98)), 1e-6)


def attacks(stem, low, high):
    band = signal.sosfilt(signal.butter(3, (low, high), fs=RATE,
                                       btype="bandpass", output="sos"), stem)
    band = band[:len(band) // HOP * HOP].reshape(-1, HOP)
    envelope = np.sqrt(np.mean(band ** 2, axis=1))
    rise = np.maximum(0, envelope - np.roll(envelope, 2))
    rise[:2] = envelope[:2]
    return unit_strength(rise)


def fit_grid(track, hits, weights, start_bpm):
    period = 60 / start_bpm
    start = np.angle(np.sum(np.exp(2j * np.pi * track / period)))
    start = (start * period / (2 * np.pi)) % period

    def score(values):
        step, phase = values
        delta = (hits - phase + step / 2) % step - step / 2
        return -np.sum(weights * np.exp(-0.5 * (delta / 0.015) ** 2))

    bounds = [(period * 0.96, period * 1.04), (start - period / 2, start + period / 2)]
    fit = optimize.differential_evolution(score, bounds, seed=22, tol=1e-7)
    step, phase = map(float, fit.x)
    phase %= step
    beats = np.arange(phase, 55, step)
    offsets = np.asarray([hits[np.abs(hits - beat).argmin()] - beat for beat in beats])
    close = np.abs(offsets) < 0.035
    return {
        "bpm": 60 / step,
        "period": step,
        "phase": phase,
        "coverage35ms": float(np.mean(close)),
        "meanAbsoluteErrorMs": float(np.mean(np.abs(offsets[close])) * 1000) if close.any() else None,
        "score": float(-fit.fun),
    }


def main():
    source, _ = librosa.load(MUSIC, sr=RATE)
    _, stem = librosa.effects.hpss(source, margin=(1, 2))
    onset = librosa.onset.onset_strength(y=stem, sr=RATE, hop_length=HOP)
    tempo, beat_track = librosa.beat.beat_track(onset_envelope=onset, sr=RATE,
                                                hop_length=HOP, tightness=400, units="time")
    tempo = float(np.atleast_1d(tempo)[0])

    bands = {
        "kick": attacks(stem, 40, 160),
        "snare": np.sqrt(attacks(stem, 150, 500) * attacks(stem, 1000, 3000)),
        "hihat": attacks(stem, 6000, 10000),
    }
    hits = []
    for kind, strengths in bands.items():
        peaks, _ = signal.find_peaks(strengths, height=.18, prominence=.12,
                                     distance=round(.075 * RATE / HOP))
        hits.extend({"t": float((p + .5) * HOP / RATE), "k": kind, "s": float(strengths[p])}
                    for p in peaks)
    hits.sort(key=lambda hit: hit["t"])
    drums = [hit for hit in hits if hit["k"] != "hihat"]
    times = np.asarray([hit["t"] for hit in drums])
    weights = np.asarray([min(hit["s"], 3.0) ** 1.3 for hit in drums])
    # The onset autocorrelation can favor a recurring three-subdivision drum pattern.
    # A Fourier scan independently checks for a repeated phase across the whole extract.
    frequencies = np.linspace(1.25, 4.5, 1600)
    spectral_lock = np.abs(np.exp(2j * np.pi * frequencies[:, None] * times) @ weights)
    spectral_pulse = float(frequencies[np.argmax(spectral_lock)] * 60)
    seeds = (tempo / 2, tempo, tempo * 2, spectral_pulse / 2, spectral_pulse)
    candidates = [fit_grid(beat_track, times, weights, bpm) for bpm in seeds]
    # Use the musically useful half-time pulse if the best fit is a fast subdivision
    # and the corresponding half-rate fit retains a clear, consistently timed attack.
    best = max(candidates, key=lambda candidate: candidate["score"] * candidate["coverage35ms"])
    if best["bpm"] > 180:
        subharmonics = [candidate for candidate in candidates
                        if abs(candidate["bpm"] * 2 - best["bpm"]) < 1]
        if subharmonics:
            half = max(subharmonics, key=lambda candidate: candidate["score"])
            if half["coverage35ms"] >= best["coverage35ms"] * .85:
                best = half
    period, phase = best["period"], best["phase"]
    beats = []
    for index, grid_time in enumerate(np.arange(phase, len(source) / RATE, period)):
        nearby = [hit for hit in drums if abs(hit["t"] - grid_time) < .085]
        hit = max(nearby, key=lambda hit: hit["s"] * np.exp(-abs(hit["t"] - grid_time) / .045),
                  default=None)
        beats.append({"n": index, "grid": float(grid_time), "hit": hit})
    rms = librosa.feature.rms(y=source, frame_length=2048, hop_length=2205)[0]
    result = {"bpm": best["bpm"], "t0": phase, "T": period, "trackerBpm": tempo,
              "sourceOffset": 0, "spectralPulseBpm": spectral_pulse,
              "candidates": candidates, "beats": beats, "hits": hits, "rms": rms.tolist()}
    dest = MUSIC.with_name("beat-data.json")
    dest.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"tracker": tempo, "candidates": candidates, "selected": best}, indent=2))
    print(f"Wrote {dest} with {len(beats)} beats and {len(hits)} attacks")


if __name__ == "__main__":
    main()
