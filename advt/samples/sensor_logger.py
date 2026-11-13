"""Temperature logger for the Raspberry Pi lab."""
import csv
import time
from datetime import datetime

READINGS_FILE = "readings.csv"
INTERVAL_SECONDS = 5


def read_temperature(sensor_path="/sys/bus/w1/devices/28-0000/w1_slave"):
    """Return the temperature in degrees Celsius from a DS18B20 sensor."""
    with open(sensor_path) as sensor:
        lines = sensor.readlines()
    if "YES" not in lines[0]:
        return None
    raw = lines[1].split("t=")[-1]
    return round(int(raw) / 1000, 2)


def log_readings(count=10):
    with open(READINGS_FILE, "a", newline="") as f:
        writer = csv.writer(f)
        for _ in range(count):
            temp = read_temperature()
            if temp is not None:
                writer.writerow([datetime.now().isoformat(), temp])
                print(f"{datetime.now():%H:%M:%S}  {temp} °C")
            time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    log_readings()
