#!/usr/bin/env python3

"""Sidetone generator - websocket klient pre remoddle-pi.py."""

import sys
import math
import struct
import signal
import asyncio
import pasimple

try:
    from websockets.asyncio.client import connect as ws_connect
except ImportError:
    from websockets import connect as ws_connect

wsUrl = sys.argv[1] if len(sys.argv) > 1 else "ws://127.0.0.1:8072"
reconnectDelay = 2

sampleRate = 16000
pa = pasimple.PaSimple(
    direction=pasimple.PA_STREAM_PLAYBACK,
    format=pasimple.PA_SAMPLE_S16LE,
    channels=1,
    rate=sampleRate,
    app_name="remoddle-paddle",
    stream_name="sidetone",
    maxlength=320,
    tlength=320,
    minreq=64
)

ditLength = 40
dahLength = 120
toneFreq = 700
toneAmpl = 100  # TODO use in generate_tone()
ditTone = None
dahTone = None


def generate_tone(duration_ms=120, frequency=700):
    num_samples = int(sampleRate * (duration_ms / 1000.0))
    audio_data = bytearray()
    max_val = 32767

    for i in range(num_samples):
        t = i / sampleRate
        sample = math.sin(2 * math.pi * frequency * t)
        audio_data.extend(struct.pack('<h', int(sample * max_val)))

    return bytes(audio_data)


def generate_tones():
    global ditTone, dahTone

    ditTone = generate_tone(duration_ms=ditLength, frequency=toneFreq)
    dahTone = generate_tone(duration_ms=dahLength, frequency=toneFreq)


def play_tone(audio_data):
    try:
        pa.write(audio_data)
    except pasimple.PaSimpleError as e:
        print(f"PulseAudio Error: {e}", file=sys.stderr)


def parse_line(line):
    """Konfiguracia v tvare: dit dah space freq ampl [reversed]"""
    global ditLength, dahLength, toneFreq, toneAmpl

    parts = line.strip().split()
    if len(parts) < 5:
        return False
    try:
        dit, dah, freq, ampl = int(parts[0]), int(parts[1]), int(parts[3]), int(parts[4])
    except ValueError:
        return False
    if (dit, dah, freq, ampl) != (ditLength, dahLength, toneFreq, toneAmpl):
        ditLength, dahLength, toneFreq, toneAmpl = dit, dah, freq, ampl
        generate_tones()
    return True


def handle_message(message):
    if isinstance(message, (bytes, bytearray)):
        message = message.decode('utf-8', errors='ignore')
    if parse_line(message):
        return
    # jeden ws frame moze obsahovat aj viac znakov
    for char in message:
        if char == '.':
            play_tone(ditTone)
        elif char == '-':
            play_tone(dahTone)


async def run(stop):
    while not stop.is_set():
        try:
            async with ws_connect(wsUrl) as ws:
                print(f"Connected to {wsUrl}", file=sys.stderr)
                stop_task = asyncio.ensure_future(stop.wait())
                try:
                    while True:
                        recv_task = asyncio.ensure_future(ws.recv())
                        done, _ = await asyncio.wait(
                            {recv_task, stop_task}, return_when=asyncio.FIRST_COMPLETED)
                        if stop_task in done:
                            recv_task.cancel()
                            return
                        handle_message(recv_task.result())
                finally:
                    stop_task.cancel()
        except Exception as ex:
            print(f"WebSocket client error: {ex}", file=sys.stderr)
        try:
            await asyncio.wait_for(stop.wait(), timeout=reconnectDelay)
        except asyncio.TimeoutError:
            pass


async def main():
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    await run(stop)


if __name__ == "__main__":
    generate_tones()
    try:
        asyncio.run(main())
    finally:
        pa.close()
