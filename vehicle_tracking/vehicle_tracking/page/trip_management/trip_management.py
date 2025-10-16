import frappe
import traceback
from datetime import datetime

import requests
from vehicle_tracking.vehicle_tracking.apis.get_wialon_data import wialon_login

logger = frappe.logger("page",file_count=10)
logger.setLevel("INFO")

@frappe.whitelist()
def update_trip_status(trip_id,status):
    try:
        doc = frappe.get_doc("Delivery Trip", trip_id)
        if doc.docstatus == 1:
            if status != "Completed":
                frappe.db.set_value("Delivery Trip", trip_id, 
                                    {"custom_trip_status":status,
                                    "custom_start_time":datetime.now()
                                    })
            else:
                frappe.db.set_value("Delivery Trip", trip_id, 
                                    {"custom_trip_status":status,
                                    "custom_end_time":datetime.now()
                                    })

        frappe.db.commit()
        return {"success": True, "trip_id": trip_id, "trip_status":status}
    
    except Exception as e:
        logger.error(f"Error in update trip status : {e}",frappe.get_traceback())


def format_timedelta(delta):
    """Format timedelta to HH:MM:SS"""
    total_seconds = int(delta.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02}"


@frappe.whitelist()
def calculate_delivery_time(trip_id, delivery_id=None):
    """
    Calculate time taken for deliveries in a trip.
    - If delivery_id is provided → return only that delivery's time.
    - Otherwise → return dict for all deliveries in the trip.
    """
    try:
        trip = frappe.get_doc("Delivery Trip", trip_id)
        trip_start = trip.custom_start_time

        # Fetch deliveries linked to trip
        stops = frappe.get_all(
            "Delivery Stop",
            filters={"parent": trip_id, "parentfield": "delivery_stops"},
            fields=["delivery_note"]
        )
        delivery_ids = [s["delivery_note"] for s in stops if s.get("delivery_note")]

        deliveries = frappe.get_all(
            "Delivery Note",
            filters={
                "name": ["in", delivery_ids],
                "custom_delivery_complete_time": ["is", "set"]
            },
            fields=["name", "custom_delivery_complete_time"],
            order_by="custom_delivery_complete_time asc"
        )

        times = {}
        prev_time = trip_start

        for d in deliveries:
            comp_time = d["custom_delivery_complete_time"]
            if prev_time:
                diff = comp_time - prev_time
                times[d["name"]] = format_timedelta(diff)
            prev_time = comp_time

        if delivery_id:
            return times.get(delivery_id, "00:00:00")
        return times

    except Exception as e:
        logger.error(f"Error calculating delivery times: {e}")
        logger.error(traceback.format_exc())
        return {}


@frappe.whitelist()
def mark_delivery_completed(delivery_id):
    """Mark delivery note as completed and return time taken"""
    try:
        doc = frappe.get_doc("Delivery Note", delivery_id)
        
        if doc.docstatus == 1:
            now = datetime.now()
            positions_coords = get_live_position(doc.custom_vehicle_assigned)
            latitiude = positions_coords[0]
            longitude = positions_coords[1]

            frappe.db.set_value(
                "Delivery Note",
                delivery_id,
                {
                    "custom_delivery_status": "Completed",
                    "custom_delivery_complete_time": now,
                    "custom_latitude":latitiude,
                    "custom_longitude":longitude
                }
            )

            # Calculate time taken
            trip_id = frappe.db.get_value(
                "Delivery Stop",
                {"delivery_note": delivery_id},
                "parent"
            )
            time_taken = calculate_delivery_time(trip_id, delivery_id)

        frappe.db.commit()

        send_delivery_completed_email(delivery_id,trip_id)

        return {
            "success": True,
            "delivery_id": delivery_id,
            "time_taken": time_taken
        }
    except Exception as e:
        logger.error(f"mark_delivery_completed error: {e}")
        logger.error(traceback.format_exc())
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_trips_by_vehicle(vehicle_name,trip_status):
    """Fetch trips with delivery notes, completed deliveries, and time taken"""
    result = {}

    try:
        if vehicle_name == "All":
            trips = frappe.get_all(
                "Delivery Trip",
                filters={"custom_trip_status": trip_status},
                fields=["name", "custom_trip_status", "vehicle"]
            )
        else:
            trips = frappe.get_all(
                "Delivery Trip",
                filters={"vehicle": vehicle_name,"custom_trip_status": trip_status},
                fields=["name", "custom_trip_status", "vehicle"]
            )

        for trip in trips:
            vehicle = trip.get("vehicle")
            if not vehicle:
                continue

            # Fetch delivery notes from child table (Delivery Stops)
            stops = frappe.get_all(
                "Delivery Stop",
                filters={"parent": trip["name"], "parentfield": "delivery_stops"},
                fields=["delivery_note"]
            )
            delivery_ids = [s["delivery_note"] for s in stops if s.get("delivery_note")]

            # Fetch delivery notes status
            delivery_notes = frappe.get_all(
                "Delivery Note",
                filters={"name": ["in", delivery_ids]},
                fields=["name", "custom_delivery_status"]
            )

            completed_delivery_notes = [
                dn["name"] for dn in delivery_notes if dn["custom_delivery_status"] == "Completed"
            ]

            # Calculate time taken for all deliveries in this trip
            delivery_times = calculate_delivery_time(trip["name"])

            if vehicle not in result:
                result[vehicle] = []

            result[vehicle].append({
                "trip_id": trip["name"],
                "delivery_id": delivery_ids,
                "completed_delivery_ids": completed_delivery_notes,
                "delivery_times": delivery_times,
                "status": trip.get("custom_trip_status")
            })

    except Exception as e:
        logger.error(f"Error in get_trips_by_vehicle: {e}")
        logger.error(traceback.format_exc())
        return {}

    return result


def get_live_position(vehicle_name):

    latitude,longitude = None,None
    Settings = frappe.get_single("Vehicle Tracking Settings")
    WIALON_BASE_URL = Settings.wialon_base_url
    SID = Settings.wialon_session_id

    doc = frappe.get_doc("Vehicle", vehicle_name)
    vehicle_id = doc.custom_vehicle_id
    
    params = {
        "itemId": vehicle_id,
        "lastTime": 0,
        "lastCount": 1,
        "flags": 1,
        "flagsMask": 65281,
        "loadCount": 1
        }
    url = f"{WIALON_BASE_URL}?svc=messages/load_last&params={frappe.as_json(params)}&sid={SID}"
    data = requests.post(url)
    pos = data.json()

    try:

        if 'error' in pos and pos['error'] == 1:
            wialon_login()

            Settings = frappe.get_single("Vehicle Tracking Settings")
            SID = Settings.wialon_session_id

            url = f"{WIALON_BASE_URL}?svc=messages/load_last&params={frappe.as_json(params)}&sid={SID}"
            data = requests.post(url)
            pos = data.json()

        msg = pos.get("messages")

        if 'pos' in msg[0]:
            latitude = msg[0]['pos']['y']
            longitude = msg[0]['pos']['x']
    
    except Exception as e:
        logger.error(f"Error in get live position function: {e}",traceback.format_exc())
    
    return latitude,longitude


def send_delivery_completed_email(delivery_id,trip_id):
    try:
        doc = frappe.get_doc("Delivery Note",delivery_id)

        subject = f"Delivery {delivery_id} Completed"

        message = f"""
        Delivery ID: {delivery_id} <br>
        Vehicle: {doc.custom_vehicle_assigned} <br>
        Trip ID: {trip_id} <br>
        Completed Time: {doc.custom_delivery_complete_time} <br>
        """
        # recipients can be static or fetched dynamically
        recipients = ["kimi@sanskartechnolab.com"]

        frappe.sendmail(
            recipients=recipients,
            subject=subject,
            message=message
        )
        
        logger.info("EMAIL Sent Successfully !!!")
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Delivery Email Failed")