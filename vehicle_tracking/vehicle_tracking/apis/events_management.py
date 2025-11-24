import traceback
import frappe
import requests
from datetime import datetime, timezone

logger = frappe.logger("api",file_count=10)
logger.setLevel("INFO")

def update_session(Name,session_id):
    try:

        session_doc = frappe.get_doc("Sessions Management",Name)
        session_doc.session_id = session_id
        session_doc.updated_time = datetime.now()
        session_doc.save()
        # logger.info(f"{Name} Session ID Updated.")
    except Exception as e:
        frappe.log_error(f"Error in Update Session Function (Events Management) - {e}")

def login():
    try:

        Settings = frappe.get_single("Vehicle Tracking Settings")
        WIALON_BASE_URL = Settings.wialon_base_url
        WIALON_TOKEN = Settings.wialon_token_live

        login_result = requests.post(f'{WIALON_BASE_URL}?svc=token/login&params={{"token":"{WIALON_TOKEN}"}}&sid')
        sid = login_result.json().get('eid')
        return sid
    
    except Exception as e:
        frappe.log_error(f"Error in Login Function (Events Management) - {e}")

def add_units_session(sid,units,Name):
    try:

        Settings = frappe.get_single("Vehicle Tracking Settings")
        WIALON_BASE_URL = Settings.wialon_base_url

        params = {
            "mode":"add",
            "units":units
        }

        url = f"{WIALON_BASE_URL}?svc=events/update_units&params={frappe.as_json(params)}&sid={sid}"
        req = requests.post(url)
        res = req.json()

        if "units" in res:
            pass
            # logger.info(f"Units added successfully into the session : {res}")
            frappe.log_error(f"Units added successfully into the session : {res}")

        if "error" in res and res["error"]==1:
            sid = login()
            update_session(Name,sid)
            url = f"{WIALON_BASE_URL}?svc=events/update_units&params={frappe.as_json(params)}&sid={sid}"
            req = requests.post(url)
            res = req.json()
            # logger.info(f"Units added successfully into the New session : {res} ")
            frappe.log_error(f"Units added successfully into the New session : {res}")
    
    except Exception as e:
        frappe.log_error(f"Error in Add units session function (events Management) - {e}")

def events_check_updates(sid):
    try:
        Settings = frappe.get_single("Vehicle Tracking Settings")
        WIALON_BASE_URL = Settings.wialon_base_url

        params = {"lang":"en"}

        url = f"{WIALON_BASE_URL}?svc=events/check_updates&params={frappe.as_json(params)}&sid={sid}"
        
        req = requests.post(url)
        res = req.json()
        
        return res
    
    except Exception as e:
        frappe.log_error(frappe.get_traceback(),f"Error in events_check_updates. {e}")
        # logger.error(traceback.format_exc())

def ignition_event():
    
    try:
        doc = frappe.get_doc("Sessions Management","Ignition")
        sid = doc.session_id

        # vehicle_ids = frappe.get_all("Vehicle", pluck="custom_vehicle_id")
        # units = [{"id":id,"detect":{"ignition":0}} for id in vehicle_ids]
        # add_units_session(sid,units,"Ignition")
        if not getattr(doc, "units_added", False):
            vehicle_ids = frappe.get_all("Vehicle", pluck="custom_vehicle_id")
            units = [{"id": vid, "detect": {"ignition": 0}} for vid in vehicle_ids]

            add_units_session(sid, units, "Ignition")

            # Mark units as added
            doc.units_added = True
            doc.save(ignore_permissions=True)

        doc = frappe.get_doc("Sessions Management","Ignition")
        sid = doc.session_id

        result = events_check_updates(sid)

        if "error" in result and result["error"] == 1:
            doc.units_added = False
            doc.save(ignore_permissions=True)
            sid = login()
            update_session("Ignition",sid)
            ignition_event()


    except Exception as e:
        logger.error(f"Error in Ignition Event Function : {e}")
        logger.error(traceback.format_exc())

    return result


@frappe.whitelist()
def get_ignition_notification_data():

    try:
        result = []
        events_data = ignition_event()

        ign_data = frappe.get_all("Vehicle Ignition Status")

        for k,v in events_data.items():

            if not any(v['name']==k for v in ign_data):
                new_data = frappe.get_doc({
                        "doctype":"Vehicle Ignition Status",
                        "vehicle_id":k
                    })
                new_data.insert(ignore_permissions=True)
                frappe.db.commit()
                
                for value in v:
                   
                    doc = frappe.get_doc("Vehicle Ignition Status",k)
                    if "ignition" in value and value["ignition"]:
                        
                        if len(value["ignition"]) >= 1:
                            first_key,first_value = next(iter(value["ignition"].items()))

                            doc.from_time = datetime.utcfromtimestamp(first_value["from"]["t"]).strftime("%Y-%m-%d %H:%M:%S")
                            doc.to_time   = datetime.utcfromtimestamp(first_value["to"]["t"]).strftime("%Y-%m-%d %H:%M:%S")
                            doc.ignition_status = "ON" if first_value["state"]==1 else "OFF"

                            child_row = doc.append("ignition_logs", {})  # child table fieldname
                            child_row.state = "ON" if first_value["state"]==1 else "OFF"
                            child_row.from_time = doc.from_time
                            child_row.to_time = doc.to_time

                            doc.save()

                            result.append({"name":frappe.db.get_value("Vehicle", {"custom_vehicle_id": k}, "name"),
                                        "id":k,
                                        "ignition":"ON" if first_value["state"]==1 else "OFF",
                                        "time":datetime.utcfromtimestamp(first_value["m"]).strftime("%Y-%m-%d %H:%M:%S")
                                        })
            else:
               
                doc = frappe.get_doc("Vehicle Ignition Status",k)
                prev_status = doc.ignition_status
                # print(v)
                for value in v:

                    if "ignition" in value and value["ignition"] and len(value["ignition"]) >= 1:
                
                        first_key,first_value = next(iter(value["ignition"].items()))

                        curr_status = "ON" if first_value["state"] == 1 else "OFF"
                        if (prev_status == "ON" and curr_status == "OFF") or (prev_status == "OFF" and curr_status == "ON"):
                            doc.from_time = datetime.utcfromtimestamp(first_value["from"]["t"]).strftime("%Y-%m-%d %H:%M:%S")
                            doc.to_time   = datetime.utcfromtimestamp(first_value["to"]["t"]).strftime("%Y-%m-%d %H:%M:%S")
                            doc.ignition_status = curr_status

                            child_row = doc.append("ignition_logs", {})  # child table fieldname
                            child_row.state = "ON" if first_value["state"]==1 else "OFF"
                            child_row.from_time = doc.from_time
                            child_row.to_time = doc.to_time

                            doc.save()

                            result.append({"name":frappe.db.get_value("Vehicle", {"custom_vehicle_id": k}, "name"),
                                        "id":k,
                                        "ignition":curr_status,
                                        "time":datetime.utcfromtimestamp(first_value["m"]).strftime("%Y-%m-%d %H:%M:%S")
                                        })

        return result
    
    except Exception as e:
        logger.error(f"Error in Get ignition notification data : {e}")
        logger.error(traceback.format_exc())
    
            

        
