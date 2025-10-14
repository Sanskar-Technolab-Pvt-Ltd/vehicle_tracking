import frappe
import json
import urllib.parse

logger = frappe.logger("wialon_webhook",file_count=10)
logger.setLevel("INFO")

#######################################
# message format Required in wialon
# name=%NOTIFICATION%&vehicle=%UNIT%&
# Text=%UNIT%: %LOSE_RESTORE%. At %POS_TIME% it moved with speed %SPEED% near '%LOCATION%'.%LAST_LOCATION%&
# trigger_time=%MSG_TIME%
#######################################

@frappe.whitelist(allow_guest=True)
def get_wialon_notifications():

    try:
        # Collect all expected parameters into one dict
        data = {
            "name": frappe.form_dict.get("name"),
            "unit": frappe.form_dict.get("vehicle"),
            "text": frappe.form_dict.get("Text"),
            "msg_trigger_time":frappe.form_dict.get("trigger_time"),
        }
        print(f"========>>>> data : {data}")

        frappe.publish_realtime(event='wialon_notification', message=data, user=None)
        
        # notif_doc = frappe.get_doc({
        # "doctype": "Notifications Logs",
        # "Notification_name": data["name"],
        # "vehicle_name": data["unit"],
        # "notification_message": data["text"],
        # "notification_trigger_time": data["msg_trigger_time"]
        # })
        # notif_doc.insert()
        # frappe.db.commit()


    except Exception as e:
        frappe.log_error(frappe.get_traceback(),f"Error in Wialon Webhook: {str(e)}")
        return {"status": "error", "message": str(e)}