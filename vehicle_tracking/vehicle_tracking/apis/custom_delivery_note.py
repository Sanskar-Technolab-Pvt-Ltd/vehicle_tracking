import frappe

@frappe.whitelist()
def update_vehicle_ready_status(vehicle):
    v = frappe.get_doc("Vehicle", vehicle)
    v.custom_vehicle_status = "Ready For Delivery"
    v.save(ignore_permissions=True)

    return {"status": "success", "msg": "Vehicle marked as Ready for Delivery"}

@frappe.whitelist()
def start_delivery(delivery_note):
    if delivery_note:

        dn = frappe.get_doc("Delivery Note", delivery_note)
        dn.db_set("custom_delivery_status", "Started")
        dn.save(ignore_permissions=True)

        if dn.custom_vehicle_assigned:
            v = frappe.get_doc("Vehicle", dn.custom_vehicle_assigned)
            v.custom_vehicle_status = "On Delivery"
            v.save(ignore_permissions=True)
        
        frappe.db.commit()

    return {"status": "success", "msg": "Vehicle marked as On Delivery"}

@frappe.whitelist()
def stop_delivery(delivery_note):
    if delivery_note:

        dn = frappe.get_doc("Delivery Note", delivery_note)
        dn.db_set("custom_delivery_status", "Stopped")
        dn.save(ignore_permissions=True)

        if dn.custom_vehicle_assigned:
            v = frappe.get_doc("Vehicle", dn.custom_vehicle_assigned)
            v.custom_vehicle_status = "Available"
            v.save(ignore_permissions=True)
        
        frappe.db.commit()
        
    return {"status": "success", "msg": "Vehicle marked as Available"}
