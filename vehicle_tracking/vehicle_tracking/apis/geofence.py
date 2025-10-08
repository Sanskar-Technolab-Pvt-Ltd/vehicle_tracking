import traceback
import frappe
import requests
from vehicle_tracking.vehicle_tracking.apis.get_wialon_data import wialon_login

logger = frappe.logger("api",file_count=10)
logger.setLevel("INFO")


@frappe.whitelist()
def fetch_and_update_geofence_data():
    
    Settings = frappe.get_single("Vehicle Tracking Settings")
    WIALON_BASE_URL = Settings.wialon_base_url
    WIALON_TOKEN = Settings.wialon_token_live
    SESSION_ID = Settings.wialon_session_id

    login_result = requests.post(f'{WIALON_BASE_URL}?svc=token/login&params={{"token":"{WIALON_TOKEN}"}}&sid')
    sid = login_result.json().get('eid')


    if not sid:
        frappe.throw("Wialon Login Failed")

    params = '{"spec": {"itemsType": "avl_unit","propName": "sys_name","propValueMask": "*","sortType": "sys_name"},"force": 1,"flags": 1025,"from": 0,"to": 0}'

    vehicle_details = requests.post(f"{WIALON_BASE_URL}?svc=core/search_items&params={params}&sid={sid}")
    units = vehicle_details.json().get("items",[])

    doc_vehile_list = frappe.get_all("Vehicle")


#Function for updating or inserting records in the Resource Doctype
def get_resources():
    Settings = frappe.get_single("Vehicle Tracking Settings")
    WIALON_BASE_URL = Settings.wialon_base_url
    SESSION_ID = Settings.wialon_session_id

    params = {
        "spec": {
            "itemsType": "avl_resource",
            "propName": "*",
            "propValueMask": "*",
            "sortType": "sys_name"
        },
        "force": 1,
        "flags": 1,
        "from": 0,
        "to": 0
    }
    url = f"{WIALON_BASE_URL}?svc=core/search_items&params={frappe.as_json(params)}&sid={SESSION_ID}"

    data = requests.post(url)
    res = data.json()

    if "error" in res and res["error"] == 1:
        logger.error("Session expired.. Relogging again")
        wialon_login()

        Settings = frappe.get_single("Vehicle Tracking Settings")
        SESSION_ID = Settings.wialon_session_id
        url = f"{WIALON_BASE_URL}?svc=core/search_items&params={frappe.as_json(params)}&sid={SESSION_ID}"

        data = requests.post(url)
        res = data.json()

    resources = res.get("items", [])

    try:
        for r in resources:
            resource_id = r.get("id")
            resource_name = r.get("nm")

            existing = frappe.db.exists("Resources", {"resource_id": resource_id})

            if not existing:
                # Insert new resource
                new_resource = frappe.get_doc({
                    "doctype": "Resources",
                    "resource_name": resource_name,
                    "resource_id": resource_id
                })
                new_resource.insert(ignore_permissions=True)
                frappe.db.commit()
                print(f"Inserted new resource: {resource_name}")
            else:
                # Update existing
                doc = frappe.get_doc("Resources", existing)
                doc.update({
                    "resource_name": resource_name,
                    "resource_id": resource_id
                })
                doc.save(ignore_permissions=True)
                frappe.db.commit()
                print(f"Updated resource: {resource_name}")

    except Exception as e:
        logger.error(f"Error in Get Resource Function : {e}, {traceback.format_exc()}")

    return resources

