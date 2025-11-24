import frappe
import requests
import json
from vehicle_tracking.vehicle_tracking.apis.common_utils import login, update_session_id

# logger = frappe.logger("notifications",file_count=10)
# logger.setLevel("INFO")

def update_data_flags():
    try:
        sid,gis_id = login()
        update_session_id("notification",sid,gis_id)

        Settings = frappe.get_single("Vehicle Tracking Settings")
        WIALON_BASE_URL = Settings.wialon_base_url

        PARAMS = {"spec":[{"type":"type","data":"avl_resource","flags":1057,"mode":1}]}

        url = f"{WIALON_BASE_URL}?svc=core/update_data_flags&params={frappe.as_json(PARAMS)}&sid={sid}"

        response = requests.post(url)
        
        if "error" not in response:
            doc = frappe.get_doc("Sessions Management","notification")
            doc.units_added = True
            doc.save(ignore_permissions=True)
            return sid

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error in Update Data Flag Function, {e}")

@frappe.whitelist()
def get_notifications():
    try:
        
        doc = frappe.get_doc("Sessions Management","notification")
        result = []

        if  doc.units_added:
            url = f"https://hst-api.wialon.com/avl_evts?sid={doc.session_id}"
            res = requests.post(url)
            data = res.json()
            if "error" in data and data["error"] == 1:
                sid = update_data_flags()
                get_notifications()

            notification_data = data.get("events")

            if notification_data:
                for n in notification_data:
                    
                    if ("d" in n) and ("unfu" not in n["d"]) and ("name" in n["d"]) and (("txt") in n["d"]):
                        result.append({
                            "name" : n["d"]["name"],
                            "text" : n["d"]["txt"]
                        })

                    elif ("d" in n) and ("unfu"in n["d"]):
                        result.append({
                            "name":n["d"]["unfu"][1]["n"],
                            "text":n["d"]["unfu"][1]["txt"],
                        })
                    else :
                        continue
        else:
            sid = update_data_flags()
            get_notifications()

        frappe.publish_realtime("Notification_Data",result, user=None)
        return result
    
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error in get notifications Function, {e}")

    

