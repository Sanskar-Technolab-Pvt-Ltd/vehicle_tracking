import time
import frappe
import requests
from vehicle_tracking.vehicle_tracking.apis.common_utils import login, update_session_id

@frappe.whitelist()
def get_vehicle_locations():
    """
    Returns a list of vehicles with latitude, longitude, name, and status.
    Example return format:
    [
        {"name": "Vehicle 1", "latitude": 20.5937, "longitude": 78.9629, "status": "On Delivery"},
        {"name": "Vehicle 2", "latitude": 19.0760, "longitude": 72.8777, "status": "Idle"}
    ]
    """
    vehicles = [
    {"name": "Fuel niso truck", "latitude": 52.32514, "longitude": 9.78238, "status": "On Delivery"},
    {"name": "Audi_retr", "latitude": 52.32514, "longitude": 9.78238, "status": "On Delivery"},
    {"name": "TestE3", "latitude": 47.0992116, "longitude": 17.5470866, "status": "On Delivery"},
    {"name": "wips emulator", "latitude": 50.4547, "longitude": 30.5238, "status": "On Delivery"},
    {"name": "Truck 101", "latitude": 53.65897, "longitude": 17.60320, "status": "Idle"}
]
    return vehicles


def create_and_update_sessions():
    existing = frappe.get_all("Sessions Management", filters={"session_name": "Vehicle Monitoring"}, limit_page_length=1)

    if not existing:
        new_doc = frappe.get_doc({
            "doctype": "Sessions Management",
            "session_name": "Vehicle Monitoring"
        })
        new_doc.insert(ignore_permissions=True)
        new_doc.save()


def get_vehicle_ids():

    # vehicle_id_list = frappe.get_all("Vehicle", pluck="custom_vehicle_id")
    vehicle_id_list = frappe.get_all("Vehicle", filters={"custom_vehicle_status": "Available"}, pluck="custom_vehicle_id",limit_page_length=0)
    return vehicle_id_list

def get_location(coords):

    doc = frappe.get_doc("Sessions Management","Vehicle Monitoring")
    GIS_BASE_URL = "https://geocode-maps.wialon.com/hst-api.wialon.com/gis_geocode"
    GIS_ID = doc.geolocation_id

    try:
        url = f"{GIS_BASE_URL}?coords={frappe.as_json(coords)}&flags=1255211008&gis_sid={GIS_ID}"
        result = requests.post(url)
        data = result.json()
    except Exception as e:  
        frappe.log_error(frappe.get_traceback(),f"Error in get location function : {e}")

    return data

@frappe.whitelist()
def get_vehicle_positions(): 
    try:

        create_and_update_sessions()
        doc = frappe.get_doc("Sessions Management","Vehicle Monitoring")
        sid = doc.session_id
        gis_id = doc.geolocation_id

        if sid == None or gis_id == None:
            print("None condition")
            sid,gis_id = login()
            update_session_id("Vehicle Monitoring",sid,gis_id)

        vid_list = get_vehicle_ids()
        params = {
        "spec": {
            "itemsType": "avl_unit",
            "propName": "sys_id",
            "propValueMask": ",".join(str(id) for id in vid_list),
            "sortType": "sys_name"
        },
        "force": 1,
        "flags": 2098177,
        "from": 0,
        "to": 0
    }
        url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=core/search_items&params={frappe.as_json(params)}&sid={sid}"
        res = requests.post(url)
        data = res.json()
       
        if 'error' in data and data['error'] == 1:
            sid,gis_id = login()
            update_session_id("Vehicle Monitoring",sid,gis_id)
            url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=core/search_items&params={frappe.as_json(params)}&sid={sid}"
            res = requests.post(url)
            data = res.json()
        
        coords = [{'lon': v['pos']['x'], 'lat': v['pos']['y']} for v in data["items"]]
        address = get_location(coords)

        vehicle_data = []
        for i,loc in zip(data["items"],address):

            trips = frappe.get_all("Delivery Trip", filters=[
            {"vehicle":i["nm"]},
            ["custom_trip_status", "in", ["Scheduled", "In-Transit"]]],
            fields=["name", "custom_trip_status", "vehicle"],limit_page_length=0)

            if trips:
                for trip in trips:
                    doc = frappe.get_doc("Delivery Trip", trip["name"])
                    trip["delivery_stops"] = [{
                        "name":stop.delivery_note,
                        "customer":stop.customer,
                        "location":stop.custom_location,
                        "contact_no": frappe.db.get_value("Delivery Note",stop.delivery_note,"custom_site_contact_person_number")
                        } 
                        for stop in doc.get("delivery_stops")]

            vehicle_doc = frappe.get_doc("Vehicle",i["nm"])

            if "pos" not in i:
                continue
            
            vehicle_data.append({
                "id": i["id"],
                "name": i["nm"],
                "lat": i["pos"]["y"],
                "lon": i["pos"]["x"],
                "speed": i["pos"]["s"],
                "direction": i["pos"]["c"],
                "conn":"Active" if i["netconn"]==1 else "Not Active", # 1-Active, 0-Not Active 
                "location":loc,
                "trips":trips,
                "driver_name":vehicle_doc.custom_driver_name,
                "driver_number":vehicle_doc.custom_driver_number
                })
        
        frappe.publish_realtime(event='live_vehicle_positions', message=vehicle_data, user=None)
        return vehicle_data

    except Exception as e:
        frappe.log_error(frappe.get_traceback(),"Error in Get Vehicle Positions Function - Vehicle Monitoring",e)
    



# def start_realtime_tracking():

#     while True:
#         try:
#             get_vehicle_positions()

#         except Exception as e:
#             frappe.log_error(frappe.get_traceback(),"Error in Start Realtime Tracking function")
        
#         time.sleep(5)

# def get_trips(vehicle_list):
#     trips = frappe.get_all("Delivery Trip", filters=[
#             ["vehicle", "in", vehicle_list],
#             ["custom_trip_status", "in", ["Scheduled", "In-Transit", "Completed"]]],
#         fields=["name", "custom_trip_status", "vehicle"]
#         )
#     # print(f"==========>>>> Trips : {trips}")
#     return trips

