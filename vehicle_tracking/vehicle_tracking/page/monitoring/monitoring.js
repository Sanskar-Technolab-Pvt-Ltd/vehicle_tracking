frappe.pages['monitoring'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Monitoring',
        single_column: true
    });

    $(frappe.render_template("monitoring", {})).appendTo(page.main);

    var map = L.map('map').setView([-1.286389, 36.817223], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    setTimeout(() => map.invalidateSize(), 300);

    var vehicleMarkers = {};

    // Truck icons - you can prepare multiple colored PNGs
    var truckIcons = {
        default: '/assets/vehicle_tracking/icons/green.png',
        green: '/assets/vehicle_tracking/icons/green.png',
        red: '/assets/vehicle_tracking/icons/red.png'
    };  

    // Arrow icon (transparent background, green arrow)
    var arrowImgUrl = '/assets/vehicle_tracking/icons/arrowblue.png';

    // Create combined icon with truck + arrow
    function createTruckWithArrow(direction, color) {
    let truckImg = truckIcons[color] || truckIcons.default;

    return L.divIcon({
        className: "truck-icon",
        html: `
            <div style="position: relative; width:40px; height:40px;">
                <!-- Truck stays upright -->
                <img src="${truckImg}" 
                     style="width:35px; height:35px; position:absolute; left:0; top:2px;">

                <!-- Arrow rotates (placed to the right of truck) -->
                <img src="${arrowImgUrl}" 
                     style="width:20px; height:20px; position:absolute; left:35px; top:10px;
                            transform: rotate(${direction}deg); transform-origin: center center;">
            </div>
        `,
        iconSize: [60, 40],
        iconAnchor: [30, 20]
    });
}

    // Function to update markers
    function updateVehiclePositions() {
        frappe.call({
            method: "vehicle_tracking.vehicle_tracking.apis.get_wialon_data.fetch_vehicle_positions",
            callback: function(r) {
                if (r.message) {
                    r.message.forEach(function(v) {

                        var popupContent = `
                            <div style="font-family: Arial, sans-serif; font-size: 10px; line-height: 1.5; width: 260px;">   
                                <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #333;">${v.name}</h4>
                                <div style="margin-bottom: 6px; font-size: 12px; color: #555;">
                                    <i class="fa fa-map-marker"></i> ${v.location}</div>
                                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                                    <div><b>Speed:</b> ${v.speed} km/h</div>
                                    <div><b>Direction:</b> ${v.direction}°</div>
                                </div>
                                <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #333;">Driver Details</h4>
                                <div style="margin-bottom: 6px; font-size: 12px; color: #555;">
                                <i class="fa fa-user-circle"></i> ${v.driver_name}<br>
                                ${v.driver_number}
                                </div>

                            </div>
                        `;

                        // pick truck color (backend can send `v.color` or assign by ID)
                        var truckColor = v.color || "default";

                        if (vehicleMarkers[v.id]) {
                            vehicleMarkers[v.id].setLatLng([v.lat, v.lon]);
                            vehicleMarkers[v.id].setIcon(createTruckWithArrow(v.direction, truckColor));
                            vehicleMarkers[v.id].setPopupContent(popupContent);
                        } else {
                            var marker = L.marker([v.lat, v.lon], {
                                icon: createTruckWithArrow(v.direction, truckColor)
                            })
                            .addTo(map)
                            .bindPopup(popupContent);

                            vehicleMarkers[v.id] = marker;
                        }
                    });
                }
            }
        });
    }

    // poll every 10 seconds
    setInterval(updateVehiclePositions, 5000);

    // initial call immediately
    updateVehiclePositions();
};




// [-1.286389, 36.817223] Kenya center