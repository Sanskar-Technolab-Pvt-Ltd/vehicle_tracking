import frappe
import requests
from datetime import datetime, timezone

@frappe.whitelist()
def get_route(trip=None, vehicle=None, start=None, end=None):
    """
    Unified API for fetching vehicle route.
    - If trip is provided → use trip-based route.
    - If vehicle + start + end are provided → use vehicle + datetime-based route.
    """
    try:
        if trip:
            # --- Trip mode ---
            trip_doc = frappe.get_doc("Delivery Trip", trip)
            vehicle_doc = frappe.get_doc("Vehicle", trip_doc.vehicle)
            vehicle_id = vehicle_doc.custom_vehicle_id
            start_time = int(trip_doc.custom_start_time.replace(tzinfo=timezone.utc).timestamp())
            end_time = int(trip_doc.custom_end_time.replace(tzinfo=timezone.utc).timestamp())
        
        elif vehicle and start and end:
            # --- Vehicle + datetime mode ---
            vehicle_doc = frappe.get_doc("Vehicle", vehicle)
            vehicle_id = vehicle_doc.custom_vehicle_id
            start_time = int(datetime.fromisoformat(start).replace(tzinfo=timezone.utc).timestamp())
            end_time = int(datetime.fromisoformat(end).replace(tzinfo=timezone.utc).timestamp())
        
        else:
            return frappe.throw("Insufficient parameters. Provide either trip or vehicle + start + end.")

        all_points = []

        interval_start = start_time
        interval_end = end_time

        settings = frappe.get_single("Vehicle Tracking Settings")
        sid = settings.wialon_session_id
        base_url = settings.wialon_base_url

        while interval_start <= interval_end:
            params = {
                "itemId": vehicle_id,
                "timeFrom": interval_start,
                "timeTo": interval_end,
                "flags": 1,
                "flagsMask": 65281,
                "loadCount": 10000
            }

            url = f"{base_url}?svc=messages/load_interval&params={frappe.as_json(params)}&sid={sid}"
            response = requests.get(url)
            data = response.json()
            messages = data.get("messages", [])

            if not messages:
                break

            points = [(msg["pos"]["y"], msg["pos"]["x"]) for msg in messages]
            all_points.extend(points)

            last_time = messages[-1]["t"]
            if last_time >= interval_end:
                break

            interval_start = last_time + 1

        print(f"Total points fetched: {len(all_points)}")
        return all_points

    except Exception as e:
        frappe.log_error(f"Error fetching route: {e}", "Get Route API")
        return []
