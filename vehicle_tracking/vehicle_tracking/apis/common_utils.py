import frappe
import requests
from datetime import datetime

logger = frappe.logger("api",file_count=10)
logger.setLevel("INFO")

def login():    
    Settings = frappe.get_single("Vehicle Tracking Settings")
    WIALON_BASE_URL = Settings.wialon_base_url
    WIALON_TOKEN = Settings.wialon_token_live

    login_result = requests.post(f'{WIALON_BASE_URL}?svc=token/login&params={{"token":"{WIALON_TOKEN}"}}&sid')
    sid = login_result.json().get('eid')
    return sid

def update_session_id(Name,session_id):
    session_doc = frappe.get_doc("Sessions Management",Name)
    session_doc.session_id = session_id
    session_doc.updated_time = datetime.now()
    session_doc.save()

    logger.info(f"{Name} Session ID Updated. Function: update_session_id")