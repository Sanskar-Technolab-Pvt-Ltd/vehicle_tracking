import requests
import time
from datetime import datetime
import frappe   

def test():
    # Wialon session ID and vehicle ID
    sid = "05ddb4abccb9abbd3ce5e84dcede33f5"
    vehicle_id = 29318451
    load_count = 10000

    # Input start and end time as datetime objects
    start_time_dt = datetime(2025, 9, 20, 10, 00, 0)
    end_time_dt = datetime(2025, 9, 21, 23, 59, 59)

    # Convert datetime to UNIX timestamps
    start_time = int(start_time_dt.timestamp())
    end_time = int(end_time_dt.timestamp())

    base_url = "https://hst-api.wialon.com/wialon/ajax.html"
    all_messages = []

    interval_start = start_time
    interval_end = end_time

    try:
        while interval_start <= interval_end:
            # params = {
            #     "itemId": vehicle_id,
            #     "timeFrom": interval_start,
            #     "timeTo": interval_end,
            #     "flags": 1,
            #     "flagsMask": 0,
            #     "loadCount": load_count
            # }
            print(f"======>>>>>> interval start:{interval_start}  interval end : {interval_end}")
            params = {"itemId": vehicle_id, "timeFrom": interval_start,"timeTo": interval_end,"flags": 1,"flagsMask": 0,"loadCount": 10000}

            url = f"{base_url}?svc=messages/load_interval&sid={sid}&params={frappe.as_json(params)}"
            # print(url)
            resp = requests.post(url)
            data = resp.json()

            # Check for error in response
            if "error" in data:
                print(f"API Error: {data['error']}")
                break

            messages = data.get("messages", [])
            if not messages:
                break

            all_messages.extend(messages)

            # Update interval_start to the last message timestamp + 1
            last_time = messages[-1]["t"]
            if last_time >= interval_end:
                break

            interval_start = last_time + 1
            print("==========")

            # Optional delay to avoid server overload
            time.sleep(0.1)

        print(f"Total messages fetched: {len(all_messages)}")
        print(all_messages[0], all_messages[-1])
    except Exception as e:
        print(f"Error: {e}")

