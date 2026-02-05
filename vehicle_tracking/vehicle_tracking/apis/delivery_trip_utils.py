import frappe
@frappe.whitelist()
def get_used_delivery_notes(custom_vehicle_assigned):
    """
    Returns Delivery Notes that are pending to be assigned to a Delivery Trip
    (i.e., not already used in any Delivery Stop)
    """
    try:
        # 1. Get all Delivery Notes already used in Delivery Stops
        used_dn_list = frappe.get_all(
            "Delivery Stop",
            filters={"delivery_note": ["!=", ""]},
            pluck="delivery_note"
        )

        # 2. Build filters for pending Delivery Notes
        filters = {
            "custom_vehicle_assigned": custom_vehicle_assigned
        }

        # Exclude already-used delivery notes
        if used_dn_list:
            filters["name"] = ["not in", used_dn_list]

        # 3. Fetch pending Delivery Notes
        pending_delivery_notes = frappe.get_all(
            "Delivery Note",
            filters=filters,
            pluck="name"
        )

        return pending_delivery_notes

    except Exception as e:
        frappe.log_error(
            title="Error in get_used_delivery_notes",
            message=frappe.get_traceback()
        )
        return []

# @frappe.whitelist()
# def get_used_delivery_notes(custom_vehicle_assigned):
#     """
#     Returns Delivery Notes already used in any Delivery Trip's Delivery Stops
#     """
#     try:

#         dn_list = frappe.get_all(
#             "Delivery Stop",
#             filters={"delivery_note": ["!=", ""]},
#             pluck="delivery_note"
#         )
#         actual_delivery_note =  frappe.get_all(
#             "Delivery Note",
#             filters={"name": ["not in", dn_list] ,"custom_vehicle_assigned":["Equals",custom_vehicle_assigned]},
#             pluck="name"
#         )
#         return actual_delivery_note
#     except Exception as e:
#         frappe.log_error(frappe.get_traceback(),f"Error in Get used delivery note Function-{e}")

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