frappe.pages['vehicle-monitoring'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '',
        single_column: true
    });

    // Append the map div to the wrapper
    $(wrapper).html(`
        <div id="map" style="width: 100vw; height: 100vh;"></div>
    `);

    // Initialize the Leaflet map
    var map = L.map('map').setView([-1.286389, 36.817223], 10); // Kenya center

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    setTimeout(() => map.invalidateSize(), 300);
    // Object to store markers by vehicle ID
    var vehicleMarkers = {};

    // Truck icons
    var truckIcons = {
        default: '/assets/vehicle_tracking/icons/green.png',
        green: '/assets/vehicle_tracking/icons/green.png',
        red: '/assets/vehicle_tracking/icons/red.png'
    };

    // Arrow icon
    var arrowImgUrl = '/assets/vehicle_tracking/icons/arrowblue.png';

    // Create combined truck + arrow icon
    function createTruckWithArrow(direction, conn, name) {
        let color = conn === "Active" ? 'green' : 'red';
        let truckImg = truckIcons[color] || truckIcons.default;

        return L.divIcon({
            className: "truck-icon",
            html:`<div style="position: relative; display: flex; flex-direction: column; align-items: center; width: 70px; height: 60px; text-align: center;">
                    <div style="position: relative; width: 55px; height: 35px;">
                        <img src="${truckImg}" style="width:35px; height:35px; position:absolute; left:0; top:0;">
                        <img src="${arrowImgUrl}" style="width:20px; height:20px; position:absolute; left:35px; top:7px; transform: rotate(${direction}deg); transform-origin:center center;">
                    </div>
                    <div style="margin-top:2px; font-size:10px; color:#003366; font-weight:bold; white-space:nowrap;">${name}</div>
                </div>`,

            iconSize: [55, 40],
            iconAnchor: [27, 20]
        });
    }

     // Function to create or update a single vehicle marker
    function showVehicleOnMap(v) {
        var popupContent = `
            <div style="
                font-family: Arial, sans-serif; 
                font-size: 10px; 
                line-height: 1.4; 
                width: 320px; 
                max-width: 320px; 
                height: auto;
            ">
            <div style="
                max-height: 220px; 
                overflow-y: auto; 
                overflow-x: hidden; 
                padding-right: 4px;
            ">
                <h4 style="margin: 0 0 6px; font-size: 12px; font-weight: bold; color: #333;">
                    ${v.name}
                </h4>
                <div style="margin-bottom: 6px; font-size: 11px; color: #555;">
                    <i class="fa fa-map-marker"></i> ${v.location || ''}
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px; flex-wrap: wrap;">
                    <div><b>Speed:</b> ${v.speed} km/h</div>
                    <div><b>Direction:</b> ${v.direction}°</div>
                    <div><b>Vehicle Conn:</b> ${v.conn}</div>
                </div>

                <h4 style="margin: 6px 0 4px; font-size: 12px; font-weight: bold; color: #333;">
                    Driver Details
                </h4>
                <div style="margin-bottom: 4px; font-size: 11px; color: #555;">
                    <i class="fa fa-user-circle"></i> ${v.driver_name || ''}
                </div>
                <div style="margin-bottom: 6px; font-size: 11px; color: #555;">
                    <i class="fa fa-mobile-phone"></i> ${v.driver_number || ''}
                </div>

                ${v.trips && v.trips.length > 0 
                ? `<h4 style="margin: 6px 0 4px; font-size: 12px; font-weight: bold; color: #333;">Delivery Trips</h4>
                    <div style="overflow-x: auto; max-height: 120px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed;">
                            <thead>
                                <tr style="background-color: #f7f7f7;">
                                    <th style="border: 1px solid #ccc; padding: 2px;">Trip ID</th>
                                    <th style="border: 1px solid #ccc; padding: 2px;">Status</th>
                                    <th style="border: 1px solid #ccc; padding: 2px;">Delivery IDs</th>
                                    <th style="border: 1px solid #ccc; padding: 2px;">Customer</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${v.trips.map(trip => `
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 2px; word-break: break-all;">${trip.name}</td>
                                        <td style="border: 1px solid #ccc; padding: 2px;">${trip.custom_trip_status}</td>
                                        <td style="border: 1px solid #ccc; padding: 2px;">${trip.delivery_stops.map(stop => stop.name).join('<br>')}</td>
                                        <td style="border: 1px solid #ccc; padding: 2px;">${trip.delivery_stops.map(stop => stop.customer).join('<br>')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`
                : '<div style="font-size: 10px; color: #888;">No deliveries assigned</div>'
                }
            </div>
            </div>`;

        if (vehicleMarkers[v.id]) {
            vehicleMarkers[v.id].setLatLng([v.lat, v.lon]);
            vehicleMarkers[v.id].setIcon(createTruckWithArrow(v.direction, v.conn, v.name));
            vehicleMarkers[v.id].setPopupContent(popupContent);
        } else {
            var marker = L.marker([v.lat, v.lon], {
                icon: createTruckWithArrow(v.direction, v.conn, v.name)
            })
            .addTo(map)
            .bindPopup(popupContent);

            marker.on('mouseover', function() { this.openPopup(); });
            // marker.on('mouseout', function() { this.closePopup(); });

            vehicleMarkers[v.id] = marker;
        }
    }

    // --------------------------
    // Function to show all vehicles from a list
    // --------------------------
    function showAllVehiclesOnMap(vehicles) {
        vehicles.forEach(function(vehicle) {
            showVehicleOnMap(vehicle);
        });
    }

    // --------------------------
    // Fetch initial data from API
    // --------------------------
    frappe.call({
        method: 'vehicle_tracking.vehicle_tracking.page.vehicle_monitoring.vehicle_monitoring.get_vehicle_positions',
        // args: {},
        callback: function(r) {
            if (r.message) {
                showAllVehiclesOnMap(r.message);
            }
        }
    });


    // --------------------------
    // Listen to real-time updates
    // --------------------------
    frappe.realtime.on('live_vehicle_positions', function(vehicles) {
        // vehicles is a list of vehicle objects
        console.log("Data Received========>>>>")
        showAllVehiclesOnMap(vehicles);
    });

    // --------------------------
    // Persistent Notification Panel (Hidden by default, wide)
    // --------------------------
    var notificationPanel = $(`
        <div id="vehicle-notification-panel"
            style="
                position: absolute;
                top: 15px;
                right: 30px;
                width: 500px;               
                max-height: 400px;
                background-color: #ffffff;
                color: #000000
                padding: 10px;
                border-radius: 8px;
                overflow-y: auto;
                font-size: 13px;
                z-index: 1000;
                display: none;              
            ">
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5px;
                background-color: #e0e0e0;
            ">
                <div style="margin-bottom:6px; padding:6px 8px; color: #000000; font-weight: bold; font-size: 14px;">Notifications</div>
                <span id="close-notification-panel" style="cursor:pointer; font-weight:bold; font-size:16px;">&times;</span>
            </div>
            <div id="vehicle-notification-list" style="max-height: 300px; overflow-y: auto; overflow-x: hidden; padding-right: 2px;"></div>
        </div>
    `);
    $('#map').append(notificationPanel);

    // --------------------------
    // Close button: clear notifications & hide panel
    // --------------------------
    $('#close-notification-panel').on('click', function() {
        $('#vehicle-notification-list').empty();    // remove all notifications
        $('#vehicle-notification-panel').hide();    // hide the panel
    });

        // Enable mouse wheel scrolling
    $('#vehicle-notification-list').on('wheel', function(e){
    e.stopPropagation(); // prevent map zoom
    });

    // --------------------------
    // Listen for notification events
    // --------------------------
    frappe.realtime.on('wialon_notification', function(data) {
        console.log("=======>>>> Notification Received.....")
        let message = data?.text || "Vehicle event received";
        let name = data?.name || "Unknown";
        let notifItem = $(`
            <div style="
                margin-bottom:6px;
                padding:6px 8px;
                background: rgba(173, 216, 230, 0.3);
                border-radius:4px;
            "><b>${name}</b> - ${message}</div>
        `);

    // Add new notification at the top
    $('#vehicle-notification-list').prepend(notifItem);

    // Show panel if hidden
    $('#vehicle-notification-panel').show();

});


};
