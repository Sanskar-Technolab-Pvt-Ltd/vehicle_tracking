frappe.pages['vehicle-monitoring'].on_page_load = function(wrapper) {
    new VehicleMonitoring(wrapper);
};

class VehicleMonitoring {
    constructor(wrapper) {
        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'Vehicle Monitoring',
            single_column: true
        });

        $(frappe.render_template("vehicle_monitoring", {})).appendTo(this.page.main);

        this.init_map();
    }

    async init_map() {
        // this.map = L.map('leaflet-map').setView([20.5937, 78.9629], 5);
        this.map = L.map('leaflet-map').setView([-1.2921, 36.8219], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);

        this.markers = {};
        this.bounds = L.latLngBounds();

        // Fetch vehicle locations from backend
        await this.load_vehicle_data();

        // Adjust map view to fit all markers
        if (Object.keys(this.markers).length > 0) {
            this.map.fitBounds(this.bounds, { padding: [5, 5], maxZoom: 5 });
        }

        // Force redraw
        setTimeout(() => {
            this.map.invalidateSize();
        }, 500);
    }

    async load_vehicle_data() {
        try {
            let res = await frappe.call({
                method: "vehicle_tracking.vehicle_tracking.page.vehicle_monitoring.vehicle_monitoring.get_vehicle_locations"
            });

            let vehicles = res.message || [];

            vehicles.forEach(vehicle => {
                if (vehicle.latitude && vehicle.longitude) {
                    this.add_marker(vehicle);
                }
            });
        } catch (e) {
            console.error("Error fetching vehicle data:", e);
        }
    }

    add_marker(vehicle) {
        let latLng = [vehicle.latitude, vehicle.longitude];
        let marker = L.marker(latLng, { icon: this.getIcon(vehicle.status) }).addTo(this.map);
        marker.bindPopup(`<b>${vehicle.name}</b><br>Status: ${vehicle.status}`);
        this.markers[vehicle.name] = marker;
        this.bounds.extend(latLng);
    }

    getIcon(status) {
        let iconUrl;
        if (status === 'On Delivery') {
            iconUrl = '/assets/vehicle_tracking/icons/greentruck.png';
        } else if (status === 'Idle'){
            iconUrl = '/assets/vehicle_tracking/icons/redtruck.png';
        }else {
            iconUrl = '/assets/vehicle_tracking/icons/truckicon.jpeg';
        }
        return L.icon({
            iconUrl: iconUrl,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });
    }
}
