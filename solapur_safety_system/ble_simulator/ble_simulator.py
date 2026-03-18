import time
import random
import requests

URL = "http://localhost:3000/api/simulator"

def generate_data():
    return {
        "worker_id": random.randint(1, 2),
        "h2s": round(random.uniform(0, 20), 2),
        "ch4": round(random.uniform(0, 10), 2),
        "co": round(random.uniform(0, 50), 2),
        "o2": round(random.uniform(18, 21), 2),
        "timestamp": time.time()
    }

while True:
    data = generate_data()

    print("📡 Sending:", data)

    try:
        res = requests.post(URL, json=data)
        print("✅ Status:", res.status_code)
    except Exception as e:
        print("❌ Error:", e)

    time.sleep(2)