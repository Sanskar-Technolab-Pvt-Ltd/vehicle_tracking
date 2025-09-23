import frappe
import requests

@frappe.whitelist()
def get_vehicle_locations():
    """
    Returns a list of vehicles with latitude, longitude, name, and status.
    Example return format:
    [
        {"name": "Vehicle 1", "latitude": 20.5937, "longitude": 78.9629, "status": "On Delivery"},
        {"name": "Vehicle 2", "latitude": 19.0760, "longitude": 72.8777, "status": "Idle"}
    ]
    """
    vehicles = [
    {"name": "Fuel niso truck", "latitude": 52.32514, "longitude": 9.78238, "status": "On Delivery"},
    {"name": "Audi_retr", "latitude": 52.32514, "longitude": 9.78238, "status": "On Delivery"},
    {"name": "TestE3", "latitude": 47.0992116, "longitude": 17.5470866, "status": "On Delivery"},
    {"name": "wips emulator", "latitude": 50.4547, "longitude": 30.5238, "status": "On Delivery"},
    {"name": "Truck 101", "latitude": 53.65897, "longitude": 17.60320, "status": "Idle"}
]
    return vehicles

