import frappe
import json
import urllib.parse

logger = frappe.logger("wialon_webhook",file_count=10)
logger.setLevel("INFO")

#######################################
# message format Required in wialon
# Local test URL : https://jed-dipyramidal-cora.ngrok-free.dev/api/method/vehicle_tracking.vehicle_tracking.apis.wialon_webhook.get_wialon_notifications
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

        frappe.publish_realtime(event='wialon_notification', message=data, user=None)

        existing = frappe.db.exists("Notifications Logs", {"name": data["name"]})

        if existing:
            notif_doc = frappe.get_doc("Notifications Logs", {"name": data["name"]})
        
        else:
            notif_doc = frappe.get_doc({
            "doctype": "Notifications Logs",
            "notification_name": data["name"],
            })
        
        notif_doc.append("notification_details", {
            "notification_name": data["name"],
            "vehicle_name": data["unit"],
            "notification_message": data["text"],
            "notification_trigger_time": data["msg_trigger_time"]
        })

        notif_doc.save(ignore_permissions=True)
        frappe.db.commit()

        # LOGIC FOR GEOFENCE ENTRY and EXIT EMAIL NOTIFICATION
        # if data['name'] in ['Test OUTSIDE GEOFENCES']:
        #     send_notification_mail(data['name'],data['text'])

    except Exception as e:
        frappe.log_error(frappe.get_traceback(),f"Error in Wialon Webhook: {str(e)}")
        return {"status": "error", "message": str(e)}
    

def send_notification_mail(Notification,message):
    try:
        subject = f"Alert Notification Email"

        message = f"""
        {Notification} - {message}
        """
        # recipients can be static or fetched dynamically
        recipients = ["kimi@sanskartechnolab.com"]

        frappe.sendmail(
            recipients=recipients,
            subject=subject,
            message=message
        )
    
    except Exception as e:
        frappe.log_error(frappe.get_traceback(),f"Error in Send Notification Email Function : {str(e)}")