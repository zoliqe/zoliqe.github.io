#!/usr/bin/env python3

"""

"""

import sys
import serial
import signal
import math
import struct
from time import time_ns, sleep
import asyncio
import threading

try:
    import pasimple
    _SIDETONE = True
except ImportError:
    _SIDETONE = False
    print("pasimple module missing - no sidetone")


try:
    from websockets.asyncio.server import serve as ws_serve
except ImportError:
    from websockets import serve as ws_serve

sampleRate = 16000
ditLength = 40
dahLength = 120
toneFreq = 700

# 4. Konfigurácia sériového portu pre RP2040
SERIAL_PORT = '/dev/cu.usbmodem101' #  '/dev/ttyACM0'
BAUD_RATE = 115200

wsHost = "0.0.0.0"
wsPort = 8072

ditDelay = 0
dahDelay = 0
reversed = False
ditTone = None
dahTone = None

wsClients = set()
wsLoop = None

serial_port = None

running = True

if _SIDETONE:
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
else:
    pa = None


async def ws_handler(websocket, path=None):
    global serial_port
    wsClients.add(websocket)
    try:
        async for message in websocket:
            if isinstance(message, (bytes, bytearray)):
                message = message.decode('utf-8', errors='ignore')
            # if not message.endswith('\n'):
            #     message += '\n'
            # wsQueue.put(message)
            if serial_port is not None:
                serial_port.write(message.encode('utf-8'))
                serial_port.flush()
            parse_line(message)
    except Exception:
        pass
    finally:
        wsClients.discard(websocket)


async def ws_send(client, message):
    try:
        await client.send(message)
    except Exception:
        wsClients.discard(client)


def ws_broadcast(message):
    global wsLoop

    if wsLoop is None or not wsClients:
        return
    # volane z vlakna paddle slucky, preto cez call_soon_threadsafe
    wsLoop.call_soon_threadsafe(
        lambda: [wsLoop.create_task(ws_send(c, message)) for c in list(wsClients)])


def ws_serve_forever():
    global wsLoop

    wsLoop = asyncio.new_event_loop()
    asyncio.set_event_loop(wsLoop)

    async def run():
        async with ws_serve(ws_handler, wsHost, wsPort):
            await asyncio.Future()

    try:
        wsLoop.run_until_complete(run())
    except Exception as ex:
        print(f"WebSocket server error: {ex}", file=sys.stderr)
    finally:
        wsLoop.close()


def ws_start():
    thread = threading.Thread(target=ws_serve_forever, daemon=True)
    thread.start()
    return thread


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
    global ditLength, dahLength, toneFreq
    global ditDelay, dahDelay
    global ditTone, dahTone

    ditDelay = 2 * ditLength / 1000
    dahDelay = dahLength / 1000 + ditLength / 1000
    # Update tones
    ditTone = generate_tone(duration_ms=ditLength, frequency=toneFreq)
    dahTone = generate_tone(duration_ms=dahLength, frequency=toneFreq)


def send(char):
    print(char, end='', flush=True)
    ws_broadcast(char)

def parse_line(line):
    global ditLength, dahLength, spaceLength, toneFreq

    parts = line.strip().split()
    if len(parts) >= 4:
        try:
            ditLength = int(parts[0])
            dahLength = int(parts[1])
            spaceLength = int(parts[2])
            toneFreq = int(parts[3])
            reversed = parts[4] == "1"
            generate_tones()
        except ValueError:
            pass

# def read_fifo():
#     global ditLength, dahLength, toneFreq, fifo_buffer

#     # Read from stdin if data is available
#     try:
#         data = os.read(sys.stdin.fileno(), 1024)
#         if data:
#             fifo_buffer += data.decode('utf-8')
#             while '\n' in fifo_buffer:
#                 line, fifo_buffer = fifo_buffer.split('\n', 1)
#                 parts = line.strip().split()
#                 if len(parts) >= 4:
#                     try:
#                         ditLength = int(parts[0])
#                         dahLength = int(parts[1])
#                         # spaceLength = int(parts[2])
#                         toneFreq = int(parts[3])
#                         generate_tones()
#                     except ValueError:
#                         pass
#     except BlockingIOError:
#         pass
#     except OSError:
#         pass

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
    global running, ditTone, dahTone, serial_port
    
    generate_tones()    

    print("Pripájam sa k RP2040 a štartujem odposluch...")

    try:
        serial_port = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.005)
        
        while running:
            if serial_port.in_waiting > 0:
                char = serial_port.read().decode('utf-8', errors='ignore')
                send(char)
                
                if char == '.':
                    # Natívny a okamžitý zápis do audio vyrovnávacej pamäte Androidu
                    play_tone(ditTone)
                elif char == '-':
                    play_tone(dahTone)
            else:
                # Sleep for a short time to reduce CPU usage
                sleep(0.001) 
        
        serial_port.close()

    except serial.SerialException:
        print(f"\nChyba: RP2040 odpojené alebo nedostupné na {SERIAL_PORT}.")
    except KeyboardInterrupt:
        print("\nUkončovanie...")

# Set up a signal handler, so we can gracefully
# stop the following loop.
def sigint_handler(sig, frame):
    global running
    # print('\rStopping...')
    running = False


if __name__ == "__main__":
    signal.signal(signal.SIGINT, sigint_handler)
    
    # os.set_blocking(sys.stdin.fileno(), False)
        
    ws_start()

    try:        
        watch_paddle()
    except OSError as ex:
        print(f"Error in watch_paddle(): {ex}", file=sys.stderr)
    finally:
        # Vzdy bezpecne ukoncit stream ak bol otvoreny
        if pa is not None:
            pa.close()
