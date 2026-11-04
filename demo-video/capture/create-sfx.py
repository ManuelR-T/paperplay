"""Create original, deterministic UI sounds; no sampled third-party material."""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 48000
DEST = Path(__file__).resolve().parents[1] / 'public' / 'audio'
DEST.mkdir(parents=True, exist_ok=True)

def save(name, duration, sample):
    values = [sample(i / RATE) for i in range(round(duration * RATE))]
    peak = max(abs(v) for v in values) or 1
    with wave.open(str(DEST / f'{name}.wav'), 'wb') as out:
        out.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        out.writeframes(b''.join(struct.pack('<h', round(v / peak * 32767 * .16)) for v in values))

save('soft-click', .11, lambda t: math.sin(2 * math.pi * 760 * t) * math.exp(-70 * t) * min(1, t / .003))

def chime(t):
    value = 0
    for delay, frequency in [(0, 523.25), (.075, 659.25), (.15, 783.99)]:
        u = t - delay
        if u >= 0:
            value += math.sin(2 * math.pi * frequency * u) * math.exp(-6 * u) * min(1, u / .012)
    return value

save('gentle-reveal', .95, chime)
rng = random.Random(42)
filtered = 0
def swoosh(t):
    global filtered
    filtered = .94 * filtered + .06 * rng.uniform(-1, 1)
    return filtered * math.sin(math.pi * t / .45) ** 2

save('soft-transition', .45, swoosh)
