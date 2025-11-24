__version__ = "0.0.1"


from erpnext.stock.doctype.delivery_trip.delivery_trip import DeliveryTrip
from vehicle_tracking.public.py.delivery_trip import custom_validate_stop_addresses

DeliveryTrip.validate_stop_addresses  = custom_validate_stop_addresses