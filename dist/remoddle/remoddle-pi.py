#!/usr/bin/env python3

"""Minimal example of watching for edges on multiple lines."""

import sys
import gpiod
from gpiod.line import Bias, Edge, Direction, Value
import signal
import os
import asyncio
import threading
# import queue
from time import time_ns, sleep, time
from datetime import timedelta

import subprocess
from pathlib import Path
from typing import Callable, List, Optional

try:
    from websockets.asyncio.server import serve as ws_serve
except ImportError:
    from websockets import serve as ws_serve

# fifo = os.open('/home/om4aa/paddle-tcvr2', os.O_WRONLY | os.O_NONBLOCK)

chipPath = "/dev/gpiochip0"
ditLine = 13
dahLine = 19
enc0id = '14'
enc0swPin = 16
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
reversed = False

ditDelay = 0
dahDelay = 0
spaceDelay = 0

# posledny prijaty konfiguracny riadok, posiela sa novym klientom (napr. remoddle-pi-tone.py)
lastConfig = None

running = True
cyclesPerSec = 1000

wsHost = "0.0.0.0"
wsPort = 8072
wsClients = set()
wsLoop = None
# wsQueue = queue.Queue()

enc0 = None
enc0btn = None

async def ws_handler(websocket, path=None):
    wsClients.add(websocket)
    try:
        if lastConfig is not None:
            await websocket.send(lastConfig)
        async for message in websocket:
            if isinstance(message, (bytes, bytearray)):
                message = message.decode('utf-8', errors='ignore')
            # if not message.endswith('\n'):
            #     message += '\n'
            # wsQueue.put(message)
            if parse_line(message):
                for c in list(wsClients):
                    if c is not websocket:
                        await ws_send(c, lastConfig)
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


def compute_delays():
    global ditLength, dahLength, spaceLength
    global ditDelay, dahDelay, spaceDelay

    ditDelay = 2 * ditLength / 1000
    dahDelay = dahLength / 1000 + ditLength / 1000
    spaceDelay = spaceLength / 1000


def send(char):
    print(char, end='', flush=True)
    ws_broadcast(char)

def parse_line(line):
    global ditLength, dahLength, spaceLength, reversed, lastConfig

    parts = line.strip().split()
    if len(parts) > 5:
        try:
            ditLength = int(parts[0])
            dahLength = int(parts[1])
            spaceLength = int(parts[2])
            reversed = int(parts[5]) > 0
            # toneFreq, toneAmpl ignored
            compute_delays()
            lastConfig = line.strip()
            return True
        except ValueError:
            pass
    return False

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
    compute_delays()

    # set bias first
    with gpiod.request_lines(chipPath, consumer="remoddle", config=gpioConfig) as request:
        dit_state = request.get_value(ditLine) == Value.INACTIVE
        dah_state = request.get_value(dahLine) == Value.INACTIVE

    with gpiod.request_lines(chipPath, consumer="remoddle", config=gpioConfig) as request:
        while running:
            t0 = now()
            dit_state = (request.get_value(dahLine) if reversed else request.get_value(ditLine)) == Value.INACTIVE
            dah_state = (request.get_value(ditLine) if reversed else request.get_value(dahLine)) == Value.INACTIVE
            # print(f"dit_state: {dit_state}, dah_state: {dah_state}")
            if (dit_state and dit_val < threshold + 1): dit_val += 1
            elif (not dit_state and dit_val > 0): dit_val = 0
            if (dah_state and dah_val < threshold + 1): dah_val += 1
            elif (not dah_state and dah_val > 0): dah_val = 0
            both = (dit_val >= threshold and dah_val >= threshold)

            if (dah_val >= threshold and (not both or last != 2)): 
                send("-")
                last = 2
                spaces = 0
                delay = dahDelay # use delay before value change
                # read_fifo()
                delay -= (now() - t0) / 1000
                if delay > 0: sleep(delay)
                lastTime = now()
            elif (dit_val >= threshold and (not both or last != 1)): 
                send(".")
                last = 1
                spaces = 0
                delay = ditDelay # use delay before value change
                # read_fifo()
                delay -= (now() - t0) / 1000
                if delay > 0: sleep(delay)
                lastTime = now()
            elif (spaces < tailSpaces and now() - lastTime > spaceDelay):
                spaces += 1
                send("_")
                delay = spaceDelay # use delay before value change
                # read_fifo()
                delay -= (now() - t0) / 1000
                if delay > 0: sleep(delay)
                lastTime = now()
            else:
                cycles += 1
                if (cycles % cyclesPerSec == 0):
                    # read_fifo()
                    cycles = 0
                else:
                    if enc0btn is not None:
                        enc0btn.check()
                    sleep(cycleDelay)

# Set up a signal handler, so we can gracefully
# stop the following loop.
def sigint_handler(sig, frame):
    global running
    # print('\rStopping...')
    running = False


class Button:
    def __init__(
        self,
        pin: int,
        id: str,
        tap_cmd: str,
        hold_cmd: str,
        hold_time: int = 500,
        gpio_chip: str = "/dev/gpiochip0",
    ):
        self.id = id
        self.pin = pin
        self._tap_cmd = tap_cmd
        self._hold_cmd = hold_cmd
        self._hold_time = hold_time

        self._state = False
        self._tap_time = 0

        # Zoznam callbackov (poslucháčov) pre zmeny
        self._listeners: List[Callable[[str], None]] = []

        self._gpiod_request = None
        self._init_gpio(gpio_chip)

    def _init_gpio(self, gpio_chip: str) -> None:
        """Inicializuje GPIO s pull-up rezistorom."""
        try:
            self._chip = gpiod.Chip(gpio_chip)
            self._gpiod_request = self._chip.request_lines(
                consumer=f"button_{self.id}",
                config={
                    (self.pin,): gpiod.LineSettings(
                        direction=Direction.INPUT,
                        bias=Bias.PULL_UP
                    )
                }
            )
        except Exception as e:
            print(f"Varovanie: Nepodarilo sa inicializovať gpiod: {e}")

    def _read_gpio(self) -> bool:
        """Číta stav pinu. True = HIGH (uvoľnené), False = LOW (stlačené)."""
        val = self._gpiod_request.get_value(self.pin)
        return val == Value.ACTIVE or val == 1

    def _emit(self, cmd: str) -> None:
        """Odošle príkaz všetkým zaregistrovaným poslucháčom."""
        for listener in list(self._listeners):
            try:
                listener(cmd)
            except Exception as e:
                print(f"Chyba v listeneri: {e}")

    def add_listener(self, callback: Callable[[str], None]) -> None:
        """Zaregistruje callback funkciu pre príjem príkazov (ekvivalent stream.listen)."""
        self._listeners.append(callback)

    def remove_listener(self, callback: Callable[[str], None]) -> None:
        """Odstráni callback funkciu."""
        if callback in self._listeners:
            self._listeners.remove(callback)

    def check(self) -> None:
        """
        Periodická kontrola stavu tlačidla (tap / hold).
        Mala by sa volať napr. každých 100 ms ako v pôvodnom kóde.
        """
        if self._gpiod_request is None:
            return
        state = self._read_gpio()
        now_ms = int(time() * 1000)

        if not state:
            # Tlačidlo je stlačené (LOW pri pull-up)
            if not self._state:
                self._state = True
                self._tap_time = now_ms
        elif self._state:
            # Tlačidlo bolo uvoľnené (HIGH)
            if now_ms - self._tap_time < self._hold_time:
                self._emit(self._tap_cmd)
            else:
                self._emit(self._hold_cmd)
            self._state = False

    def dispose(self) -> None:
        """Uvoľní GPIO."""
        if self._gpiod_request:
            try:
                self._gpiod_request.release()
            except Exception:
                pass
            self._gpiod_request = None


class Encoder:
    def __init__(
        self,
        id: str,
        rotate_cw_cmd: str,
        rotate_ccw_cmd: str,
    ):
        self.id = id
        self._rotate_cw_cmd = rotate_cw_cmd
        self._rotate_ccw_cmd = rotate_ccw_cmd

        self._running = True

        # Zoznam callbackov (poslucháčov) pre zmeny
        self._listeners: List[Callable[[str], None]] = []

        # Spustenie sledovania udalostí evtest v samostatnom vlákne
        self._event_process: Optional[subprocess.Popen] = None
        self._thread: Optional[threading.Thread] = None

        try:
            event_dev = self._rotary_event_device()
            print(f"rotary@{self.id} eventDev: {event_dev}")
            self._start_evtest_listener(event_dev)
        except Exception as e:
            print(f"Chyba pri hľadaní rotary@{self.id} event device: {e}")

    def _rotary_event_device(self) -> str:
        """
        Nájde event device pre rotary encoder z journalctl / sysfs
        ekvivalent k metóde v Dart.
        """
        res = subprocess.run(
            ["journalctl", "--grep", f"input: rotary@{self.id}"],
            capture_output=True,
            text=True,
            check=True
        )
        output = res.stdout.strip()
        if not output:
            raise RuntimeError(f"Nebol nájdený záznam v journalctl pre rotary@{self.id}")

        last_line = output.splitlines()[-1]
        sysfs_path_rel = last_line.split()[-1].strip()
        sysfs_dir = Path(f"/sys{sysfs_path_rel}")

        if not sysfs_dir.exists():
            raise FileNotFoundError(f"Sysfs cesta neexistuje: {sysfs_dir}")

        for entry in sysfs_dir.iterdir():
            if entry.is_dir() and "event" in entry.name:
                return entry.name

        raise RuntimeError(f"V {sysfs_dir} sa nenašiel event priečinok.")

    def _start_evtest_listener(self, event_dev: str) -> None:
        """Spustí proces evtest a spracováva jeho výstup v samostatnom vlákne."""
        def run():
            try:
                self._event_process = subprocess.Popen(
                    ["evtest", f"/dev/input/{event_dev}"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    bufsize=1
                )
                if self._event_process.stdout:
                    for line in iter(self._event_process.stdout.readline, ""):
                        if not self._running:
                            break
                        direction = self._value_to_direction(line)
                        if direction != 0:
                            cmd = self._rotate_cw_cmd if direction > 0 else self._rotate_ccw_cmd
                            self._emit(cmd)
            except Exception as e:
                if self._running:
                    print(f"Chyba pri čítaní evtest pre rotary@{self.id}: {e}")

        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def _value_to_direction(self, event: str) -> int:
        """Prevedie riadok udalosti z evtest na smer (-1, 0, 1)."""
        values = event.split("value")
        value = values[1] if len(values) > 1 else ""
        if value:
            if "-1" in value:
                return -1
            if "1" in value:
                return 1
        return 0

    def _emit(self, cmd: str) -> None:
        """Odošle príkaz všetkým zaregistrovaným poslucháčom."""
        for listener in list(self._listeners):
            try:
                listener(cmd)
            except Exception as e:
                print(f"Chyba v listeneri: {e}")

    def add_listener(self, callback: Callable[[str], None]) -> None:
        """Zaregistruje callback funkciu pre príjem príkazov (ekvivalent stream.listen)."""
        self._listeners.append(callback)

    def remove_listener(self, callback: Callable[[str], None]) -> None:
        """Odstráni callback funkciu."""
        if callback in self._listeners:
            self._listeners.remove(callback)

    def dispose(self) -> None:
        """Uvoľní prostriedky, ukončí proces a zatvorí GPIO."""
        self._running = False

        if self._event_process:
            try:
                self._event_process.terminate()
                self._event_process.kill()
            except Exception:
                pass

        self._listeners.clear()


if __name__ == "__main__":
    signal.signal(signal.SIGINT, sigint_handler)
    
    # os.set_blocking(sys.stdin.fileno(), False)

    ws_start()

    enc0 = Encoder(
        id=enc0id,
        rotate_cw_cmd=">",
        rotate_ccw_cmd="<",
    )
    # Registrácia listenera (ekvivalent enc.changes.listen(...))
    enc0.add_listener(send)
    enc0btn = Button(
        pin=enc0swPin,
        id='enc0btn',
        tap_cmd=";",
        hold_cmd=":",
    )
    enc0btn.add_listener(send)

    try:        
        watch_paddle()
    except OSError as ex:
        print(f"Error in watch_paddle(): {ex}", file=sys.stderr)
    finally:
        enc0.dispose()
