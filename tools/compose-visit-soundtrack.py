#!/usr/bin/env python3
"""Reproduce Artbitrage's original, sample-free gallery soundtrack offline.

Requires existing Python/numpy and ffmpeg/ffprobe. No network calls or samples.
The soft keys are additive synthesis, not a recording of an acoustic piano.
Five 40-second passages share a small melodic idea; a 10-second coda lets the
last D-major harmony settle. Intermediate PCM, reverb, and measurements stay
in --scratch. The committed MP3 and credits are the only public artifacts.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import wave

import numpy as np


RATE = 44100
DURATION = 210
SEED = 2799215
TARGET_LUFS = -20
TARGET_PEAK = -2.5  # Leave encoding headroom below the -2 dBTP delivery limit.
ROOT = Path(__file__).resolve().parents[1]

CHORDS = {
    "Dmaj9": [50, 57, 61, 64, 66],
    "Bm9": [47, 54, 57, 61, 62],
    "Gmaj9": [43, 50, 54, 57, 59],
    "Asus2": [45, 52, 57, 59, 64],
    "Em9": [40, 47, 54, 55, 62],
    "Dadd9/F#": [42, 50, 57, 64, 66],
    "G6": [43, 50, 55, 59, 64],
}

# Original pitch sequences, with Dadd9/F#/E/A as the recurring melodic thought.
# Each row lasts eight seconds, leaving room between the notes and phrases.
PASSAGES = [
    ("water", "Water / reflections", ["Dmaj9", "Bm9", "Gmaj9", "Asus2", "Dmaj9"],
     [[74, 78, 76, 69], [74, 73, 69], [71, 74, 78, 76], [76, 71, 69], [74, 78, 76, 74]]),
    ("dusk", "Dusk / a distant light", ["Bm9", "Gmaj9", "Em9", "Asus2", "Bm9"],
     [[74, 73, 69], [71, 69, 66], [67, 71, 74], [71, 76, 73], [74, 69, 66]]),
    ("form", "Form / space around an object", ["Dmaj9", "G6", "Dadd9/F#", "Em9", "Asus2"],
     [[66, 69], [67, 71], [69, 74, 73], [71, 67], [69, 76]]),
    ("poems", "Poems / a line opening", ["Gmaj9", "Dmaj9", "Em9", "Bm9", "Asus2"],
     [[71, 74, 78, 76], [78, 76, 74, 69], [71, 74, 78], [78, 74, 73, 69], [76, 73, 71]]),
    ("colour", "Colour / returning to light", ["Dmaj9", "Gmaj9", "Bm9", "Em9", "Dmaj9"],
     [[74, 78, 81, 78, 76], [79, 78, 74, 71], [78, 74, 73, 69], [76, 78, 74, 71], [74, 78, 76, 74]]),
]


def frequency(midi: int) -> float:
    return 440 * 2 ** ((midi - 69) / 12)


def envelope_edges(signal: np.ndarray, attack: float, release: float) -> np.ndarray:
    a = min(len(signal), int(attack * RATE))
    r = min(len(signal), int(release * RATE))
    signal[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    signal[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return signal


def soft_key(midi: int, strength: float, length: float, rng) -> np.ndarray:
    t = np.arange(int(length * RATE), dtype=np.float64) / RATE
    f = frequency(midi)
    signal = np.zeros_like(t)
    # Upper partials decay first. Slight inharmonicity gives the soft, struck
    # timbre definition while keeping the fundamental comfortably forward.
    for harmonic, gain, decay in [(1, 1, 3.4), (2, .30, 1.65), (3, .12, 1.1),
                                  (4, .047, .70), (5, .016, .45)]:
        hz = f * harmonic * math.sqrt(1 + .00007 * harmonic * harmonic)
        signal += gain * np.sin(2 * np.pi * hz * t) * np.exp(-t / decay)
    signal += .075 * np.sin(2 * np.pi * f * 1.0012 * t) * np.exp(-t / 2.5)
    # A quiet, deterministic hammer-like breath; no recorded source audio.
    strike = rng.normal(0, 1, len(t))
    strike = np.convolve(strike, np.ones(9) / 9, mode="same")
    signal += .022 * strike * np.exp(-t / .014)
    return (envelope_edges(signal, .013, .32) * strength).astype(np.float32)


def warm_pad(midi: int, strength: float, length: float, phase: float) -> np.ndarray:
    t = np.arange(int(length * RATE), dtype=np.float64) / RATE
    f = frequency(midi)
    signal = (np.sin(2 * np.pi * f * t + phase)
              + .23 * np.sin(2 * np.pi * f * 2 * t + phase * .7)
              + .055 * np.sin(2 * np.pi * f * 3 * t))
    signal += .13 * np.sin(2 * np.pi * (f + .11) * t + phase)
    signal *= .97 + .03 * np.sin(2 * np.pi * .12 * t + phase)
    return (envelope_edges(signal, 2.2, 3.8) * strength).astype(np.float32)


def place(mix: np.ndarray, signal: np.ndarray, when: float, pan: float) -> None:
    start = int(when * RATE)
    count = min(len(signal), len(mix) - start)
    if count <= 0:
        return
    angle = (pan + 1) * np.pi / 4
    mix[start:start + count, 0] += signal[:count] * np.cos(angle)
    mix[start:start + count, 1] += signal[:count] * np.sin(angle)


def convolution(signal: np.ndarray, impulse: np.ndarray) -> np.ndarray:
    """Overlap-add FFT convolution, bounded memory even for a long track."""
    block = 65536
    fft_size = 1 << (block + len(impulse) - 2).bit_length()
    transfer = np.fft.rfft(impulse, fft_size)
    out = np.zeros(len(signal) + len(impulse) - 1, np.float32)
    for start in range(0, len(signal), block):
        part = signal[start:start + block]
        rendered = np.fft.irfft(np.fft.rfft(part, fft_size) * transfer, fft_size)
        count = min(len(out) - start, len(part) + len(impulse) - 1)
        out[start:start + count] += rendered[:count].astype(np.float32)
    return out[:len(signal)]


def room_reverb(signal: np.ndarray, rng) -> np.ndarray:
    count = int(4.4 * RATE)
    t = np.arange(count) / RATE
    impulse = rng.normal(0, 1, count)
    # A dark, diffuse room, with a short predelay that preserves note attacks.
    kernel = np.hanning(29)
    impulse = np.convolve(impulse, kernel / kernel.sum(), mode="same")
    impulse *= np.exp(-t / .85)
    impulse[:int(.032 * RATE)] = 0
    impulse *= .25 / np.sqrt(np.sum(impulse * impulse))
    for delay, gain in [(.047, .085), (.079, -.055), (.113, .04), (.173, .025)]:
        impulse[int(delay * RATE)] += gain
    return convolution(signal, impulse.astype(np.float32))


def write_wav(path: Path, audio: np.ndarray) -> None:
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())


def command(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=True, text=True, capture_output=True)


def measurements(path: Path) -> tuple[dict, str]:
    result = command(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
                      "-af", f"loudnorm=I={TARGET_LUFS}:TP={TARGET_PEAK}:LRA=7:print_format=json",
                      "-f", "null", "-"])
    values = re.findall(r'\{\s*"input_i"[\s\S]*?\}', result.stderr)
    if not values:
        raise RuntimeError("ffmpeg did not return loudness measurements")
    return json.loads(values[-1]), result.stderr


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch", type=Path,
                        default=Path(tempfile.gettempdir()) / "artbitrage-original-soundtrack")
    args = parser.parse_args()
    args.scratch.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)
    mix = np.zeros((DURATION * RATE, 2), dtype=np.float32)
    event_count = 0

    for section, (room, _, progression, phrases) in enumerate(PASSAGES):
        quiet = .74 if room == "form" else .88 if room == "dusk" else 1
        for phrase, (harmony, melody) in enumerate(zip(progression, phrases)):
            start = section * 40 + phrase * 8
            chord = CHORDS[harmony]
            for voice, pitch in enumerate(chord):
                place(mix, warm_pad(pitch, .011 * quiet, 11.2, rng.uniform(0, 2 * np.pi)),
                      start, -.5 + voice * .25)
            # Quiet broken chords, with deliberate gaps rather than a clockwork ostinato.
            if not (room == "form" and phrase in [1, 3]):
                for step, pitch in enumerate(chord[1:4]):
                    place(mix, soft_key(pitch, .055 * quiet, 5.3, rng),
                          start + .35 + step * .37, -.28 + step * .16)
                    event_count += 1
            if phrase in [0, 2, 4] and room != "form":
                place(mix, soft_key(chord[0] + 12, .047 * quiet, 4.5, rng),
                      start + 5.2, -.12)
                event_count += 1
            # The returning motif changes register, rhythm, and density by room.
            offsets = {2: [1.9, 5.1], 3: [1.45, 3.3, 5.65],
                       4: [1.25, 2.8, 4.45, 6.05], 5: [1.1, 2.25, 3.6, 5.0, 6.3]}[len(melody)]
            for index, (pitch, offset) in enumerate(zip(melody, offsets)):
                strength = (.098 if index == 0 else .085) * quiet * rng.uniform(.92, 1.06)
                place(mix, soft_key(pitch, strength, 6.1, rng),
                      start + offset + rng.uniform(-.026, .026), .13 * np.sin(phrase + index))
                event_count += 1
            if room in ["water", "poems", "colour"] and phrase in [1, 4]:
                place(mix, soft_key(chord[-1] + 12, .031, 5.8, rng),
                      start + 7.05, .36)
                event_count += 1

    # A final restrained D-major arrival, followed by enough space for its tail.
    for index, pitch in enumerate([57, 62, 66, 74]):
        place(mix, soft_key(pitch, .043 if pitch < 74 else .067, 9.5, rng),
              199.8 + index * .22, -.15 + index * .1)
        event_count += 1

    print(f"Synthesized {event_count} soft-key notes across five passages.", flush=True)
    # The shared mid signal provides a cohesive room; separate impulses give
    # restrained stereo width and remain comfortable when summed to mono.
    send = mix.mean(axis=1)
    for channel in range(2):
        mix[:, channel] += room_reverb(send, rng)
    mix -= mix.mean(axis=0)
    fade_in = int(3 * RATE)
    fade_out = int(8 * RATE)
    mix[:fade_in] *= (np.sin(np.linspace(0, np.pi / 2, fade_in)) ** 2)[:, None]
    mix[-fade_out:] *= (np.cos(np.linspace(0, np.pi / 2, fade_out)) ** 2)[:, None]
    mix *= .80 / np.max(np.abs(mix))
    source = args.scratch / "rooms-of-light-source.wav"
    write_wav(source, mix)

    before, log = measurements(source)
    (args.scratch / "loudness-source.txt").write_text(log)
    output = ROOT / "assets/audio/rooms-of-light.mp3"
    output.parent.mkdir(parents=True, exist_ok=True)
    normalizer = (f"loudnorm=I={TARGET_LUFS}:TP={TARGET_PEAK}:LRA=7:"
                  f"measured_I={before['input_i']}:measured_TP={before['input_tp']}:"
                  f"measured_LRA={before['input_lra']}:measured_thresh={before['input_thresh']}:"
                  f"offset={before['target_offset']}:linear=true:print_format=json")
    command(["ffmpeg", "-hide_banner", "-y", "-i", str(source), "-af", normalizer,
             "-ar", str(RATE), "-c:a", "libmp3lame", "-b:a", "160k", "-map_metadata", "-1",
             "-metadata", "title=Rooms of Light", "-metadata", "artist=Artbitrage",
             "-metadata", "comment=Original algorithmic composition; synthesized soft keys and pads; no samples.",
             str(output)])
    after, log = measurements(output)
    (args.scratch / "loudness-mp3.txt").write_text(log)
    if float(after["input_tp"]) > -2:
        raise RuntimeError(f"Encoded true peak exceeds limit: {after['input_tp']} dBTP")
    if not -21.0 <= float(after["input_i"]) <= -19.0:
        raise RuntimeError(f"Encoded integrated loudness outside target: {after['input_i']} LUFS")
    if output.stat().st_size > 8_000_000:
        raise RuntimeError("Encoded track exceeds the 8 MB delivery limit")
    report = {
        "duration_seconds": DURATION, "sample_rate": RATE, "channels": 2,
        "seed": SEED, "soft_key_notes": event_count,
        "source_peak": float(np.max(np.abs(mix))),
        "source_dc": mix.mean(axis=0).astype(float).tolist(),
        "source_rms_each_10_seconds": [float(np.sqrt(np.mean(mix[s:s + 10 * RATE] ** 2)))
                                      for s in range(0, len(mix), 10 * RATE)],
        "encoded_loudness": after, "mp3_bytes": output.stat().st_size,
        "listening_review": "Not performed; verified by signal and ffmpeg measurements only.",
    }
    (args.scratch / "measurements.json").write_text(json.dumps(report, indent=2) + "\n")
    credits = {
        "title": "Rooms of Light", "file": "rooms-of-light.mp3", "duration_seconds": DURATION,
        "created_for": "Artbitrage", "creation": "Original algorithmic composition and digital synthesis created for Artbitrage with Codex.",
        "instruments": "Synthesized soft keys, warm sustained pads, and algorithmic room reverberation. The keys are not a recording of an acoustic piano.",
        "sources": "No sampled audio, third-party music, or external sound recordings.",
        "composition": "A recurring original motif moves through five gentle passages: water, dusk, form, poems, and colour, followed by a short closing tail.",
        "passages": [{"room": room, "title": title, "starts_at_seconds": n * 40,
                      "ends_at_seconds": (n + 1) * 40, "harmony": chords}
                     for n, (room, title, chords, _) in enumerate(PASSAGES)],
        "playback": {"opt_in": True, "suggested_initial_volume": .65,
                     "note": "A continuous soundtrack; passage changes are not synchronized to scrolling."},
        "render": {"script": "tools/compose-visit-soundtrack.py", "seed": SEED,
                   "sample_rate": RATE, "bitrate_kbps": 160,
                   "integrated_lufs": float(after["input_i"]), "true_peak_dbtp": float(after["input_tp"])},
    }
    credit_file = output.with_name("credits.json")
    credit_file.write_text(json.dumps(credits, indent=2) + "\n")
    mirror = ROOT / "dist/assets/audio"
    mirror.mkdir(parents=True, exist_ok=True)
    for file in [output, credit_file]:
        shutil.copy2(file, mirror / file.name)
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
