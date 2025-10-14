import frappe
import requests
from datetime import datetime, timezone

from vehicle_tracking.vehicle_tracking.apis.get_wialon_data import wialon_login

logger = frappe.logger("page",file_count=10)
logger.setLevel("INFO")

@frappe.whitelist()
def get_route(trip=None, delivery=None, vehicle=None, start=None, end=None):
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
            vehicle_name = trip_doc.vehicle
            driver_details = [vehicle_doc.custom_driver_name, vehicle_doc.custom_driver_number]
            delivery_details = []
            for d in trip_doc.delivery_stops:
                doc = frappe.get_doc('Customer',d.customer)
                delivery_details.append([d.delivery_note,d.customer,doc.mobile_no])
        
        elif vehicle and start and end:
           
            vehicle_doc = frappe.get_doc("Vehicle", vehicle)
            vehicle_id = vehicle_doc.custom_vehicle_id
            start_time = int(datetime.fromisoformat(start).replace(tzinfo=timezone.utc).timestamp())
            end_time = int(datetime.fromisoformat(end).replace(tzinfo=timezone.utc).timestamp())
            vehicle_name = vehicle
            driver_details = [vehicle_doc.custom_driver_name, vehicle_doc.custom_driver_number]
            delivery_details = []
        
        elif delivery:
            delivery_note_doc = frappe.get_doc("Delivery Note",delivery)
            vehicle_doc = frappe.get_doc("Vehicle", delivery_note_doc.custom_vehicle_assigned)

            trip = frappe.db.get_value("Delivery Stop", {"delivery_note": delivery}, "parent")
            trip_doc = frappe.get_doc("Delivery Trip",trip)

            customer_doc = frappe.get_doc('Customer',delivery_note_doc.customer)

            vehicle_id = vehicle_doc.custom_vehicle_id
            start_time = int(trip_doc.custom_start_time.replace(tzinfo=timezone.utc).timestamp())
            end_time = int(delivery_note_doc.custom_delivery_complete_time.replace(tzinfo=timezone.utc).timestamp())
            vehicle_name = trip_doc.vehicle
            driver_details = [vehicle_doc.custom_driver_name, vehicle_doc.custom_driver_number]
            delivery_details = [[trip,delivery_note_doc.customer,customer_doc.mobile_no]]

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

            if 'error' in data and data['error'] == 1:
                logger.info(f"Invalid Session Id..Relogging again")
                wialon_login()
                settings = frappe.get_single("Vehicle Tracking Settings")
                sid = settings.wialon_session_id

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
        # print("======>>>>>>>",all_points)
        return all_points, vehicle_name, driver_details, delivery_details

    except Exception as e:
        frappe.log_error(f"Error fetching route: {e}", "Get Route API")
        return []


@frappe.whitelist()
def get_address(lon,lat):
    Settings = frappe.get_single("Vehicle Tracking Settings")
    GIS_BASE_URL = "https://geocode-maps.wialon.com/hst-api.wialon.com/gis_geocode"
    GIS_ID = Settings.wialon_gis_id
    
    coords = [{"lon": float(lon), "lat": float(lat)}]
    try:
        url = f"{GIS_BASE_URL}?coords={frappe.as_json(coords)}&flags=1255211008&gis_sid={GIS_ID}"
        result = requests.post(url)
        data = result.json()
    except Exception as e:  
        logger.error(f"Error in get location function : {e}")

    return data