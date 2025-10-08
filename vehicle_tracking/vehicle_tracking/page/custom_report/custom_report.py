from datetime import datetime, timezone
import frappe
import requests
from vehicle_tracking.vehicle_tracking.apis.common_utils import login, update_session_id


# Function for fetching the resources details and resource report template details and update it in the doctype
@frappe.whitelist()
def get_resource_details():
    try:

        sid = login()
        params = {
            "spec": {
                "itemsType": "avl_resource",
                "propName": "sys_name",
                "propValueMask": "*",
                "sortType": "sys_name"
            },
            "force": 1,
            "flags": 8913,
            "from": 0,
            "to": 0
        }
        url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=core/search_items&params={frappe.as_json(params)}&sid={sid}"
        res = requests.post(url)
        data = res.json().get("items",[])

        for d in data:
            doc = frappe.get_doc("Resources",d["nm"])
            if "rep" in d:
                for k,v in d["rep"].items():
                    child_row = doc.append("templates", {})  # child table fieldname
                    child_row.template_id = v["id"]
                    child_row.template_name = v["n"]
                    doc.save()
    
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error in get resource details Function, {e}")


@frappe.whitelist()
def get_template_name(resource):
    doc = frappe.get_doc("Resources", resource)
    return [row.template_name for row in doc.templates]

@frappe.whitelist()
def get_report_result(resource,template,unit,start,end):
    try:
        start_dt = datetime.fromisoformat(start) 
        end_dt = datetime.fromisoformat(end)

        doc = frappe.get_doc("Sessions Management","Report Execution")
        sid = doc.session_id

        print(f"sid = {sid}")
        if sid == None:
            print("IFFFF")
            sid = login()
            update_session_id("Report Execution",sid)
        
        params = {
                "reportResourceId": frappe.db.get_value("Resources", resource, "resource_id"),
                "reportTemplateId": frappe.db.get_value("Resource Report Template", {"parent": resource,"template_name":template},"template_id"),
                "reportTemplate": None,
                "reportObjectId": frappe.db.get_value("Vehicle", unit, "custom_vehicle_id"),
                "reportObjectSecId": 0,
                "interval": {
                    "from": int(start_dt.replace(tzinfo=timezone.utc).timestamp()),
                    "to": int(end_dt.replace(tzinfo=timezone.utc).timestamp()),
                    "flags": 0
                }
            }
        
        url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=report/exec_report&params={frappe.as_json(params)}&sid={sid}"
        print(url)
        res = requests.post(url)
        data = res.json()
        print(f"DATA:{data}")

        if "error" in data and data["error"] == 1:
            print(f"old sid : {sid}")
            print("2nd IFFFFFFFFFfff")
            sid = login()
            print(f"new sid : {sid}")
            update_session_id("Report Execution",sid)

            url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=report/exec_report&params={frappe.as_json(params)}&sid={sid}"
            res = requests.post(url)
            data = res.json()
            print(f"DATA:{data}")
            tables = data["reportResult"]["tables"]
            print(f"TABLES:{tables}")
        else:
            print("ELSEEEEE")
            tables = data["reportResult"]["tables"]
            print(f"TABLES:{tables}")
        
        final_result = {t['label']:{'colums':t['header'],'rows':[],"total_rows":t['rows'],"table_index":index} for index,t in enumerate(tables)}
        print(f"final_result==========>>> {final_result}")
        print(f"==========>>>> send sid:{sid}")
        result = get_result_rows(sid,final_result)
        print("*******************")
        print(result)
        return result
    except Exception as e:
        print(f"=>>>> ERROR : {e}")
        frappe.log_error(frappe.get_traceback(), f"Error in get report result Function, {e}")


@frappe.whitelist()
def clean_up_result():
    doc = frappe.get_doc("Sessions Management","Report Execution")
    sid = doc.session_id

    try:
        url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=report/cleanup_result&params={{}}&sid={sid}"
        res = requests.post(url)
        data = res.json()
        print("=================")
        print(data)
        # if "error" in data and data["error"] == 0:
        #     frappe.log_error("Report Cleared successfully")
        return data
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error in get clean up result Function, {e}")


def get_result_rows(sid,result):

    try:
        for k,v in result.items():

            params = {
                "tableIndex": v['table_index'],
                "indexFrom": 0,
                "indexTo": v['total_rows']
            }

            url = f"https://hst-api.wialon.com/wialon/ajax.html?svc=report/get_result_rows&params={frappe.as_json(params)}&sid={sid}"
            res = requests.post(url)
            data = res.json()

            for i in data:
                if "c" not in i:
                    continue
                # List comprehension version of your loop
                row = [item.get("t") if isinstance(item, dict) else item for item in i["c"]]
                v.setdefault('rows', []).append(row)

        return result

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error in get result row Function, {e}")