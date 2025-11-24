import frappe
import requests
from datetime import datetime

# logger = frappe.logger("api",file_count=10)
# logger.setLevel("INFO")

def login():
    try:

        Settings = frappe.get_single("Vehicle Tracking Settings")
        WIALON_BASE_URL = Settings.wialon_base_url
        WIALON_TOKEN = Settings.wialon_token_live

        login_result = requests.post(f'{WIALON_BASE_URL}?svc=token/login&params={{"token":"{WIALON_TOKEN}"}}&sid')
        sid = login_result.json().get('eid')
        gis_id = login_result.json().get("gis_sid")
        return sid,gis_id
    except Exception as e:
        frappe.log_error(frappe.get_traceback(),f"Error in apis/Commonutils file Login function - {e}")

def update_session_id(Name,session_id,geolocation_id):
    try:

        session_doc = frappe.get_doc("Sessions Management",Name)
        session_doc.session_id = session_id
        session_doc.geolocation_id = geolocation_id
        session_doc.updated_time = datetime.now()
        session_doc.save()

    except Exception as e:
        frappe.log_error(frappe.get_traceback(),f"Error in apis/Commonutils file update session Id function - {e}")

##############################################################
# Exceute Command
# bench execute vehicle_tracking.vehicle_tracking.apis.common_utils.get_vehicle_id --kwargs "{'vehicle_name': 'KAE 383V_NRB'}"
##############################################################
@frappe.whitelist()
def get_vehicle_id(vehicle_name):
    try:
        vehicle_id = None
        session_id, gis_id = login()
        params = {
            "spec": {
                "itemsType": "avl_unit",
                "propName": "sys_name",
                "propValueMask":vehicle_name,
                "sortType": "sys_name"
            },
            "force": 1,
            "flags": 1025,
            "from": 0,
            "to": 0
        }
        url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=core/search_items&params={frappe.as_json(params)}&sid={session_id}"
        res = requests.post(url)
        data = res.json().get("items",[])

        vehicle_id = next(item["id"] for item in data if item["nm"] == vehicle_name)

        return vehicle_id

    except Exception as e:
        frappe.log_error(frappe.get_traceback(),f"Error in Get Vehicle Id Function-{e}")

@frappe.whitelist()
def get_sensor_data(vehicle_name):
    try:
        session_id, gis_id = login()
        params = {
            "spec": {
                "itemsType": "avl_unit",
                "propName": "sys_name",
                "propValueMask":vehicle_name,
                "sortType": "sys_name"
            },
            "force": 1,
            "flags": 4097,
            "from": 0,
            "to": 0
        }
        url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=core/search_items&params={frappe.as_json(params)}&sid={session_id}"
        res = requests.post(url)
        data = res.json().get("items",[])

        sens_data = next((item.get("sens") for item in data if "sens" in item), {})

        return sens_data

    except Exception as e:
        frappe.log_error(frappe.get_traceback(),f"Error in Get Sensor data Function-{e}")