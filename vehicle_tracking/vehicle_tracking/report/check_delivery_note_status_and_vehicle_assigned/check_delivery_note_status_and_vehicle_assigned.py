# Copyright (c) 2025, sanskar technolab and contributors
# For license information, please see license.txt
# ast(Abstract Syntax Trees) : Module in python
import frappe
import ast
from datetime import datetime


def execute(filters=None):
	columns = get_columns()
	data = get_data(filters)
	return columns, data

def get_columns():
	return [
		{"label": "", "fieldname": "select_checkbox", "fieldtype": "Data", "width": 40},
		{"label": "Delivery Note", "fieldname": "name", "fieldtype": "Link", "options": "Delivery Note","width": 150},
		{"label": "Delivery Details", "fieldname": "custom_delivery_details", "fieldtype": "Data","width": 120},
		{"label": "Vehicle Name", "fieldname": "custom_vehicle_assigned", "fieldtype": "Data","width": 150},
		{"label": "Driver Name", "fieldname": "custom_driver_assigned", "fieldtype": "Data","width": 150},
		{"label": "Delivery Status", "fieldname": "custom_delivery_status", "fieldtype": "Data","width": 120},
	]

def get_data(filters):

	delivery_data = filters.get('delivery_details')

	result = frappe.db.sql(f"""
						SELECT name,custom_delivery_details,custom_vehicle_assigned,custom_driver_assigned,custom_delivery_status 
						from `tabDelivery Note` where custom_delivery_details='{delivery_data}';
						""",as_dict=True)

	return result


@frappe.whitelist()
def assign_vehicle(delivery_notes, vehicle):
	"""
	Assign vehicle to selected delivery notes
	"""
	if isinstance(delivery_notes, str):
		delivery_notes = ast.literal_eval(delivery_notes)

	if not delivery_notes:
		return {"status": "failed", "message": "No Delivery Notes selected"}
	
	driver = frappe.db.get_value("Vehicle", vehicle, "custom_driver_name")
	updated_count = 0
	for dn in delivery_notes:
		doc = frappe.get_doc("Delivery Note", dn)

		if doc.docstatus == 1:
			frappe.db.set_value("Delivery Note", dn, {"custom_vehicle_assigned":vehicle,"custom_driver_assigned":driver})
		else:
			doc.custom_vehicle_assigned = vehicle
			doc.custom_driver_assigned = driver
			doc.save(ignore_permissions=True)
		
		updated_count += 1
	
	frappe.db.commit()
	return {"status": "success", "assigned_to": updated_count}

@frappe.whitelist()
def assign_vehicle_manually(delivery_notes,vehicle_name,driver_name):
	"""
	This updates the vehicle name and driver name entered by user manually 
	i.e. Reason for assiging manually is, if user collects the items in their own vehicle
	"""
	if isinstance(delivery_notes, str):
		delivery_notes = ast.literal_eval(delivery_notes)
	
	if not delivery_notes:
		return {"status": "failed", "message": "No Delivery Notes selected"}
	
	updated_count = 0
	for dn in delivery_notes:
		doc = frappe.get_doc("Delivery Note", dn)

		if doc.docstatus == 1:
			frappe.db.set_value("Delivery Note", dn, {
				"custom_vehicle_assigned":vehicle_name,
				"custom_driver_assigned":driver_name,
				"custom_delivery_status":"Completed",
				"custom_delivery_complete_time":datetime.now()
				})
		else:
			doc.custom_vehicle_assigned = vehicle_name
			doc.custom_driver_assigned = driver_name
			doc.save(ignore_permissions=True)
		
		updated_count += 1
	
	frappe.db.commit()
	return {"status": "success", "assigned_to": updated_count}