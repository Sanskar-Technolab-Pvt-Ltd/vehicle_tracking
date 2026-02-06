import requests
import frappe
import traceback
from datetime import datetime

logger = frappe.logger("wialon",file_count=10)
logger.setLevel("INFO")


def wialon_login():

    Settings = frappe.get_single("Vehicle Tracking Settings")
    WIALON_BASE_URL = Settings.wialon_base_url
    WIALON_TOKEN = Settings.wialon_token_live

    try:

        response = requests.post(f'{WIALON_BASE_URL}?svc=token/login&params={{"token":"{WIALON_TOKEN}"}}&sid')
        session_id = response.json().get("eid")
        gis_id = response.json().get("gis_sid")

        if session_id:

            Settings.wialon_session_id = session_id
            Settings.save(ignore_permissions=True)
            frappe.log_error(f"Login Successful and Session id updated Sucessfully. New session id : {session_id}")
            # logger.info(f"Login Successful and Session id updated Sucessfully. New session id : {session_id}")
        
        if gis_id:

            Settings.wialon_gis_id = gis_id
            Settings.save(ignore_permissions=True)
            frappe.log_error(f"Login Successful and Session id updated Sucessfully. New session id : {session_id}")
            # logger.info(f"Login Successful and GIS id updated Sucessfully. New gis id : {gis_id}")
            
    except Exception as e:
        # logger.error(f"Error in wialon login : {e}")
        frappe.log_error(title="Error in wialon Login",message=f"{e}\n{frappe.get_traceback()}")

    

def get_vehicle_ids():

    # vehicle_id_list = frappe.get_all("Vehicle", pluck="custom_vehicle_id")
    vehicle_id_list = frappe.get_all("Vehicle", filters={"custom_vehicle_status": "Available"}, pluck="custom_vehicle_id")
    return vehicle_id_list

def get_search_items():

    Settings = frappe.get_single("Vehicle Tracking Settings")
    WIALON_BASE_URL = Settings.wialon_base_url
    SESSION_ID = Settings.wialon_session_id
    vid_list = get_vehicle_ids()

    vehicle_ids = ",".join(str(id) for id in vid_list)
    params = {
    "spec": {
        "itemsType": "avl_unit",
        "propName": "sys_id",
        "propValueMask": vehicle_ids,
        "sortType": "sys_name"
    },
    "force": 1,
    "flags": 1025,
    "from": 0,
    "to": 0
    }

    try:
        url = f"{WIALON_BASE_URL}?svc=core/search_items&params={frappe.as_json(params)}&sid={SESSION_ID}"
        result = requests.post(url)
        data = result.json()
    except Exception as e:
        # logger.error(f"Error in getting searchy_items : {e}")
        frappe.log_error(f"Error in getting searchy_items : {e}")
    
    return data


def get_location(coords):

    Settings = frappe.get_single("Vehicle Tracking Settings")
    GIS_BASE_URL = "https://geocode-maps.wialon.com/hst-api.wialon.com/gis_geocode"
    GIS_ID = Settings.wialon_gis_id

    try:
        url = f"{GIS_BASE_URL}?coords={frappe.as_json(coords)}&flags=1255211008&gis_sid={GIS_ID}"
        result = requests.post(url)
        data = result.json()
    except Exception as e:  
        frappe.log_error(f"Error in get location function : {e}")
        # logger.error(f"Error in get location function : {e}")

    return data

@frappe.whitelist()
def fetch_vehicle_positions():
    """
    Fetch positions of selected vehicles from Wialon and push to ERPNext frontend
    """
    vehicles = []
    try:
        vehicle_data = get_search_items()

        # handle expired session once
        if "error" in vehicle_data:
            logger.info(f"Error in result. Wialon session Expired {vehicle_data}. Re-logging in for session id")
            wialon_login()
            vehicle_data = get_search_items()

        if "items" not in vehicle_data:
            return vehicles

        items = vehicle_data["items"]
        if not items:
            return vehicles

        # collect all vehicle names first
        vehicle_names = [unit["nm"] for unit in items if "pos" in unit]

        # fetch Vehicle → Driver mapping in bulk
        vehicle_driver_map = {
            v.name: v.custom_driver_name
            for v in frappe.get_all(
                "Vehicle",
                filters={"name": ["in", vehicle_names]},
                fields=["name", "custom_driver_name"]
            )
        }

        # collect all driver names to fetch phone numbers in bulk
        driver_names = list(set(vehicle_driver_map.values()))
        driver_phone_map = {
            d.name: d.custom_mobile_number
            for d in frappe.get_all(
                "Driver",
                filters={"name": ["in", driver_names]},
                fields=["name", "custom_mobile_number"]
            )
        }

        # now build vehicles list in one loop
        for unit in items:
            if "pos" not in unit:
                continue

            driver_name = vehicle_driver_map.get(unit["nm"])
            driver_phone_number = driver_phone_map.get(driver_name) if driver_name else None

            vehicles.append({
                "id": unit["id"],
                "name": unit["nm"],
                "lat": unit["pos"]["y"],
                "lon": unit["pos"]["x"],
                "time": unit["pos"]["t"],
                "speed": unit["pos"]["s"],
                "direction": unit["pos"]["c"],
                "location": (get_location([{"lon": unit["pos"]["x"], "lat": unit["pos"]["y"]}]))[0],
                "driver_name": driver_name,
                "driver_number": driver_phone_number
            })

        return vehicles

    except Exception as e:
        frappe.log_error(frappe.get_traceback(),f"Error in get vehicle positions API : {e}")
        return []

# @frappe.whitelist()
# def fetch_vehicle_positions():
#     """
#     Fetch positions of selected vehicles from Wialon and push to ERPNext frontend
#     """
    
#     vehicle_data = get_search_items()

#     try:
#         if "error" in vehicle_data:
           
#             logger.info(f"Error in result. Wialon session Expired {vehicle_data}. Re-logging in for session id")
#             wialon_login()
#             vehicle_data = get_search_items()
#             if "items" in vehicle_data:
#                 vehicles = []
#                 for unit in vehicle_data["items"]:
#                     driver_name = frappe.get_value("Vehicle", unit["nm"], "custom_driver_name")
#                     driver_phone_number = frappe.get_value("Driver", driver_name, "custom_mobile_number")
#                     if "pos" in unit:
#                         vehicles.append({
#                             "id": unit["id"],
#                             "name": unit["nm"],
#                             "lat": unit["pos"]["y"],
#                             "lon": unit["pos"]["x"],
#                             "time": unit["pos"]["t"],
#                             "speed": unit["pos"]["s"],
#                             "direction": unit["pos"]["c"],
#                             "location":(get_location([{"lon":unit["pos"]["x"],"lat":unit["pos"]["y"]}]))[0],
#                             "driver_name":driver_name,
#                             "driver_number":driver_phone_number
#                         })                
#         else:
#             if "items" in vehicle_data:
#                 vehicles = []
#                 for unit in vehicle_data["items"]:
#                     driver_name = frappe.get_value("Vehicle", unit["nm"], "custom_driver_name")
#                     driver_phone_number = frappe.get_value("Driver", driver_name, "custom_mobile_number")
#                     if "pos" in unit:
#                         vehicles.append({
#                             "id": unit["id"],
#                             "name": unit["nm"],
#                             "lat": unit["pos"]["y"],
#                             "lon": unit["pos"]["x"],
#                             "time": unit["pos"]["t"],
#                             "speed": unit["pos"]["s"],
#                             "direction": unit["pos"]["c"],
#                             "location":(get_location([{"lon":unit["pos"]["x"],"lat":unit["pos"]["y"]}]))[0],
#                             "driver_name":driver_name,
#                             "driver_number":driver_phone_number
#                         })

#             # frappe.publish_realtime(
#             #     event="vehicle_location_update",
#             #     message=vehicles,
#             #     after_commit=True
#             # )
#         return vehicles

#     except Exception as e:
#         logger.error(f"Error in get vehicle positions API : {e}")
#         logger.error(f"Traceback Execution : {traceback.format_exc()}")