import frappe

@frappe.whitelist()
def get_used_delivery_notes():
    """
    Returns Delivery Notes already used in any Delivery Trip's Delivery Stops
    """
    try:

        dn_list = frappe.get_all(
            "Delivery Stop",
            filters={"delivery_note": ["!=", ""]},
            pluck="delivery_note"
        )
        return dn_list
    except Exception as e:
        frappe.log_error(frappe.get_traceback(),f"Error in Get used delivery note Function-{e}")

@frappe.whitelist()
def check_weight_capacity(vehicle,stops):

    stops = frappe.parse_json(stops)

    vehicle_capacity = frappe.db.get_value("Vehicle", vehicle, "max_weight_capacity")
    total_weight = 0

    for row in stops:
        if row.get("delivery_note"):
            total_weight += frappe.db.get_value(
                "Delivery Note",
                row["delivery_note"],
                "total_net_weight"
            )

    return {
        "vehicle_capacity": vehicle_capacity,
        "total_weight": total_weight
    }