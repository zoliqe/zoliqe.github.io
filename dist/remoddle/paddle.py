#!/usr/bin/env python3

"""Minimal example of watching for edges on multiple lines."""

import sys
import gpiod
import signal
import math
import struct
import pasimple
import os
from time import time_ns, sleep
from gpiod.line import Bias, Edge, Direction, Value
from datetime import timedelta, datetime

# Globalna premenna pre zvukovy stream
sampleRate = 16000
# Inicializacia globalnej premennej tu v casti main
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
# fifo = os.open('/home/om4aa/paddle-tcvr2', os.O_WRONLY | os.O_NONBLOCK)

chipPath = "/dev/gpiochip0"
ditLine = 13
dahLine = 19
gpioConfig={tuple([ditLine, dahLine]): gpiod.LineSettings(
	edge_detection=Edge.BOTH,
	direction=Direction.INPUT,
	bias=Bias.PULL_UP,
	debounce_period=timedelta(milliseconds=1),
)}

tailSpaces = 2
threshold = 2
ditLength = 40
dahLength = 120
spaceLength = 40

ditDelay = 0
dahDelay = 0
spaceDelay = 0

toneFreq = 700
# toneAmpl = 0.5
ditTone = None
dahTone = None

running = True
fifo_buffer = ""
cyclesPerSec = 1000


def generate_tone(duration_ms=120, frequency=700):
    global sampleRate
    
    # Calculate the number of samples
    num_samples = int(sampleRate * (duration_ms / 1000.0))
    
    # Generate the sine wave as raw bytes
    audio_data = bytearray()
    max_val = 32767  # Max value for 16-bit signed integer
    
    for i in range(num_samples):
        # Calculate the sample value
        t = i / sampleRate
        sample = math.sin(2 * math.pi * frequency * t)
        
        # Scale to 16-bit range and pack into bytes
        int_sample = int(sample * max_val)
        audio_data.extend(struct.pack('<h', int_sample))

    return audio_data

def generate_tones():
    global ditLength, dahLength, spaceLength, toneFreq
    global ditDelay, dahDelay, spaceDelay
    global ditTone, dahTone

    ditDelay = 2 * ditLength / 1000
    dahDelay = dahLength / 1000 + ditLength / 1000
    spaceDelay = spaceLength / 1000
    # Update tones
    ditTone = generate_tone(duration_ms=ditLength, frequency=toneFreq)
    dahTone = generate_tone(duration_ms=dahLength, frequency=toneFreq)


def write_fifo(char):
    print(char, end='', flush=True)

def read_fifo():
    global ditLength, dahLength, spaceLength, toneFreq, fifo_buffer

    # Read from stdin if data is available
    try:
        data = os.read(sys.stdin.fileno(), 1024)
        if data:
            fifo_buffer += data.decode('utf-8')
            while '\n' in fifo_buffer:
                line, fifo_buffer = fifo_buffer.split('\n', 1)
                parts = line.strip().split()
                if len(parts) >= 4:
                    try:
                        ditLength = int(parts[0])
                        dahLength = int(parts[1])
                        spaceLength = int(parts[2])
                        toneFreq = int(parts[3])
                        generate_tones()
                    except ValueError:
                        pass
    except BlockingIOError:
        pass
    except OSError:
        pass

    

def play_tone(audio_data):
    global pa
    
    # Hranie zvuku cez globalnu premennu `pa`
    if pa is not None:
        try:
            pa.write(bytes(audio_data))
            # pa.drain()  # Wait for the audio to finish playing
        except pasimple.PaSimpleError as e:
            print(f"PulseAudio Error: {e}", file=sys.stderr)

# Time in milliseconds
def now():
    return int(time_ns() / 1_000_000)

def watch_paddle():
    global running, threshold, tailSpaces, cyclesPerSec
    global chipPath, ditLine, dahLine, gpioConfig
    global ditDelay, dahDelay, spaceDelay
    
    dit_val = 0
    dah_val = 0
    last = 0
    cycles = 0
    delay = 0
    spaces = tailSpaces
    cycleDelay = 1 / cyclesPerSec
    lastTime = now()
    generate_tones()    

    # set bias first
    with gpiod.request_lines(chipPath, consumer="remoddle-paddle", config=gpioConfig) as request:
        dit_state = request.get_value(ditLine) == Value.INACTIVE
        dah_state = request.get_value(dahLine) == Value.INACTIVE

    with gpiod.request_lines(chipPath, consumer="remoddle-paddle", config=gpioConfig) as request:
        while running:
            t0 = now()
            dit_state = request.get_value(ditLine) == Value.INACTIVE
            dah_state = request.get_value(dahLine) == Value.INACTIVE
            # print(f"dit_state: {dit_state}, dah_state: {dah_state}")
            if (dit_state and dit_val < threshold + 1): dit_val += 1
            elif (not dit_state and dit_val > 0): dit_val = 0
            if (dah_state and dah_val < threshold + 1): dah_val += 1
            elif (not dah_state and dah_val > 0): dah_val = 0
            both = (dit_val >= threshold and dah_val >= threshold)

            if (dah_val >= threshold and (not both or last != 2)): 
                write_fifo("-")
                last = 2
                spaces = 0
                play_tone(dahTone)
                delay = dahDelay # use delay before value change
                read_fifo()
                delay -= (now() - t0) / 1000
                if delay > 0: sleep(delay)
                lastTime = now()
            elif (dit_val >= threshold and (not both or last != 1)): 
                write_fifo(".")
                last = 1
                spaces = 0
                play_tone(ditTone)
                delay = ditDelay # use delay before value change
                read_fifo()
                delay -= (now() - t0) / 1000
                if delay > 0: sleep(delay)
                lastTime = now()
            elif (spaces < tailSpaces and now() - lastTime > spaceDelay):
                spaces += 1
                write_fifo("_")
                delay = spaceDelay # use delay before value change
                read_fifo()
                delay -= (now() - t0) / 1000
                if delay > 0: sleep(delay)
                lastTime = now()
            else:
                cycles += 1
                if (cycles % cyclesPerSec == 0):
                    read_fifo()
                    cycles = 0
                else:
                    sleep(cycleDelay)

# Set up a signal handler, so we can gracefully
# stop the following loop.
def sigint_handler(sig, frame):
    global running
    # print('\rStopping...')
    running = False


if __name__ == "__main__":
    signal.signal(signal.SIGINT, sigint_handler)
    
    os.set_blocking(sys.stdin.fileno(), False)
        
    try:        
        watch_paddle()
    except OSError as ex:
        print(f"Error in watch_paddle(): {ex}", file=sys.stderr)
    finally:
        # Vzdy bezpecne ukoncit stream ak bol otvoreny
        if pa is not None:
            pa.close()
