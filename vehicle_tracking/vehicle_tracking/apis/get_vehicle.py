import traceback
import frappe
import requests
from datetime import datetime


@frappe.whitelist()
def fetch_and_update_vehicles():
    
    Settings = frappe.get_single("Vehicle Tracking Settings")
    WIALON_BASE_URL = Settings.wialon_base_url
    WIALON_TOKEN = Settings.wialon_token_live

    login_result = requests.post(f'{WIALON_BASE_URL}?svc=token/login&params={{"token":"{WIALON_TOKEN}"}}&sid')
    sid = login_result.json().get('eid')

    if not sid:
        frappe.throw("Wialon Login Failed")

    params = '{"spec": {"itemsType": "avl_unit","propName": "sys_name","propValueMask": "*","sortType": "sys_name"},"force": 1,"flags": 1025,"from": 0,"to": 0}'

    vehicle_details = requests.post(f"{WIALON_BASE_URL}?svc=core/search_items&params={params}&sid={sid}")
    units = vehicle_details.json().get("items",[])

    doc_vehile_list = frappe.get_all("Vehicle")

    try:
        for data in units:

            if not any(v['name']==data['nm'] for v in doc_vehile_list):
                
                new_vehicle = frappe.get_doc({
                    "doctype":"Vehicle",
                    "name":data['nm'],
                    "license_plate":data['nm'],
                    "custom_vehicle_id":data['id'],
                    "custom_latitude":data['pos']['y'] if data['pos'] is not None else 0.0,
                    "custom_longitude":data['pos']['x'] if data['pos'] is not None else 0.0,
                    "custom_direction":data['pos']['c'] if data['pos'] is not None else 0.0,
                    "custom_odometer_reading": data['lmsg']['p']['odometer'] if data.get('lmsg') is not None and data['lmsg'].get('p') and 'odometer' in data['lmsg']['p'] else 0.0,
                    "last_odometer":0,
                    "uom":"Litre",
                    "custom_last_updated":datetime.now()
                })

                new_vehicle.insert(ignore_permissions=True)
                frappe.db.commit()
                print(f"Inserted : {data['nm']}")
            
            else:
                
                doc = frappe.get_doc("Vehicle", data['nm'])
                doc.update({
                    "custom_latitude":data['pos']['y'] if data['pos'] is not None else 0.0,
                    "custom_longitude":data['pos']['x'] if data['pos'] is not None else 0.0,
                    "custom_direction":data['pos']['c'] if data['pos'] is not None else 0.0,
                    "custom_odometer_reading": data['lmsg']['p']['odometer'] if data.get('lmsg') is not None and data['lmsg'].get('p') and 'odometer' in data['lmsg']['p'] else 0.0,
                    "custom_last_updated":datetime.now(),
                })
                doc.save()
                frappe.db.commit()

    except Exception as e:
        print(f"ERROR : {e}, {traceback.format_exc()}")