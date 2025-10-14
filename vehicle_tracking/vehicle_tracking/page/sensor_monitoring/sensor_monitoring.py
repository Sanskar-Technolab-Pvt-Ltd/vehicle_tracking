import frappe
import requests
import json
from vehicle_tracking.vehicle_tracking.apis.common_utils import login, update_session_id

# Function for fetching the available sensors details in a particular vehicle unit and update the sensor details in the doctype child table
@frappe.whitelist()
def get_sensor_details():
    try:

        sid,gis_id = login()
        params = {
            "spec": {
                "itemsType": "avl_unit",
                "propName": "sys_name",
                "propValueMask": "*",
                "sortType": "sys_name"
            },
            "force": 1,
            "flags": 4097,
            "from": 0,
            "to": 0
        }
        url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=core/search_items&params={frappe.as_json(params)}&sid={sid}"
        res = requests.post(url)
        data = res.json().get("items",[])
        req = data[:31]
        for d in req:
            doc = frappe.get_doc("Vehicle", d["nm"])
            if doc and "sens" in d:
                ins_data = None  # initialize by default
                for k, v in d["sens"].items():
                    # print(v)
                    for row in doc.custom_sensors:
                        if row.id == v['id']:
                            row.set("mode", v['m'])
                            if v['t'] == 'custom':
                                data = json.loads(v["c"])
                                ci = data.get("ci", {})
                                ins_data = {int(ki): vi["t"] for ki, vi in ci.items()}
                                row.set("custom_json",ins_data)
                            
                doc.save(ignore_permissions=True)

            # print(f"====>>>> Sensor details Inserted : {d['nm']}")
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error in get sensor details Function, {e}")

@frappe.whitelist()
def get_sensor_names(vehicle):
    try:

        doc = frappe.get_doc("Vehicle",vehicle)

        sensor_data = doc.custom_sensors
        sensor_name = [row.sensor_name for row in sensor_data]

        return sensor_name

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error in Get sensor name Function", {e})

@frappe.whitelist()
def get_sensor_data(vehicle,sensors):
    try:
        existing = frappe.get_all("Sessions Management", filters={"session_name": "Sensor Monitoring"}, limit_page_length=1)

        if not existing:
            new_doc = frappe.get_doc({
                "doctype": "Sessions Management",
                "session_name": "Sensor Monitoring"
            })
            new_doc.insert(ignore_permissions=True)
            new_doc.save()
            doc = frappe.get_doc("Sessions Management","Sensor Monitoring")
            
        else:
            print("already there")
            doc = frappe.get_doc("Sessions Management","Sensor Monitoring")

        sid = doc.session_id

        if sid == None:
            sid,gis_id = login()
            update_session_id("Sensor Monitoring",sid, gis_id)

        vehicle_doc = frappe.get_doc("Vehicle",vehicle)
        sens_ids = [row.id for row in vehicle_doc.custom_sensors if row.sensor_name in sensors]
        matching_sensors = {
            row.id:
            {"name": row.sensor_name,
            "type": row.type,
            "mode": row.mode,
            "json": json.loads(row.custom_json) if row.custom_json != None else None,
            }
        for row in vehicle_doc.custom_sensors if row.sensor_name in sensors}

        params = {
                "unitId": vehicle_doc.custom_vehicle_id,
                "sensors": sens_ids
        }

        url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=unit/calc_last_message&params={frappe.as_json(params)}&sid={sid}"

        req = requests.post(url)
        data = req.json()
    
        if "error" in data and data["error"] == 1:
            sid, gis_id = login()
            update_session_id("Sensor Monitoring",sid, gis_id)
            url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=unit/calc_last_message&params={frappe.as_json(params)}&sid={sid}"
            req = requests.post(url)
            data = req.json()

        final_result = []
        for k,v in data.items():
            sens_data = matching_sensors[int(k)]

            if sens_data['type'] == 'custom':
                json_data = sens_data['json']
                final_result.append({
                    "sensor":sens_data['name'],
                    "value": f"{json_data[str(v)]}" if v != -348201.3876 and str(v) in json_data else "N/A"
                })
            else:
                final_result.append({
                    "sensor":sens_data['name'],
                    "value":f"{v} ({sens_data['mode']})" if v != -348201.3876 else "N/A"
                })

        return final_result

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error in Get Sensor data function",{e})
        return()