import frappe
import requests
import json
from vehicle_tracking.vehicle_tracking.apis.common_utils import login

# Function for fetching the available sensors details in a particular vehicle unit and update the sensor details in the doctype child table
@frappe.whitelist()
def get_sensor_details():
    try:

        sid = login()
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


