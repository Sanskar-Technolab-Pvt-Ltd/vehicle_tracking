import frappe
import traceback
from datetime import datetime

logger = frappe.logger("page",file_count=10)
logger.setLevel("INFO")

@frappe.whitelist()
def get_trips_by_vehicle(vehicle_name):
    result = {}

    try:
        if vehicle_name == "All":
            trips = frappe.get_all(
                "Delivery Trip",
                fields=["name", "custom_trip_status", "vehicle"]
            )
        else:
            trips = frappe.get_all(
                "Delivery Trip",
                filters={"vehicle": vehicle_name},
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
            delivery_notes = frappe.get_all(
                "Delivery Note",
                filters={"name": ["in", delivery_ids]},
                fields=["name", "custom_delivery_status"]
            )
            completed_delivery_notes = [dn["name"] for dn in delivery_notes if dn["custom_delivery_status"] == "Completed"]


            # Initialize list for vehicle if not exists
            if vehicle not in result:
                result[vehicle] = []

            result[vehicle].append({
                "trip_id": trip["name"],
                "delivery_id": delivery_ids,
                "completed_delivery_ids":completed_delivery_notes,
                "status": trip.get("custom_trip_status")
            })

    except Exception as e:
        logger.error(f"Error in getting trips for all vehicles: {e}")
        logger.error(traceback.format_exc())
        return {}

    return result


@frappe.whitelist()
def mark_delivery_completed(delivery_id):
    try:
        doc = frappe.get_doc("Delivery Note", delivery_id)
        if doc.docstatus == 1:
            frappe.db.set_value("Delivery Note", delivery_id, {"custom_delivery_status":"Completed","custom_delivery_complete_time":datetime.now()})

        frappe.db.commit()
        return {"success": True, "delivery_id": delivery_id}
    except Exception as e:
        logger.error({e},frappe.get_traceback(), "mark_delivery_completed error")
        return {"success": False, "error": str(e)}
    

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
