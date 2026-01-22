frappe.pages['vehicle-monitoring'].on_page_load = function(wrapper) {
    
    let AUTO_REFRESH_INTERVAL = 10000; // 10 seconds
    let autoRefreshTimer = null;
    
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '',
        single_column: true
    });

    page.set_primary_action("Refresh Vehicles", function () {
    refreshVehiclePositions();}, "refresh");


    // Append the map div to the wrapper
    $(wrapper).html(`
        <div id="map" style="width: 100vw; height: 100vh; position: relative;"></div>
    `);

    $('#map').append(`
    <button id="refresh-map-btn"
        style="
            position: fixed;
            top: 125px;
            left: 10px;
            z-index: 9999;
            width: 35px;
            height: 35px;
            background: white;
            color: black;
            border: none;
            box-shadow: 0px 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            font-size: 9px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;">Refresh</button> `);

    $('#map').append(`
    <input type="text" id="vehicle-search"
        placeholder="Search vehicle..."
        style="
            position: fixed;
            top: 60px;
            left: 50px;
            width: 180px;
            padding: 6px 10px;
            font-size: 13px;
            border-radius: 6px;
            border: 1px solid #999;
            z-index: 9999;
            background: white;
        ">
        `);
    
    $(document).on('click', '#refresh-map-btn', function () {refreshVehiclePositions();});

    // --------------------------
    // SEARCH VEHICLE + ZOOM
    // --------------------------
    $(document).on("input", "#vehicle-search", function() {
        let query = $(this).val().trim().toLowerCase();
        // if (!query) return;

        // when search bar is empty
        if (!query){

            clearAllHighlights();

            // Reset map to original center & zoom
            map.setView([-1.286389, 36.817223], 10, { animate: true });

            // Re-show all vehicles normally (existing markers already there)
            refreshVehiclePositions();

            return;
        }

        // find vehicle marker by name
        for (let id in vehicleMarkers) {
            let marker = vehicleMarkers[id];
            let vehicleName = marker.options.icon.options.html.toLowerCase();

            if (vehicleName.includes(query)) {
                // zoom and highlight
                map.setView(marker.getLatLng(), 14, { animate: true });

                // simple highlight: bounce effect
                marker._icon.style.transition = "transform 0.2s ease";
                marker._icon.style.transform = "scale(1.25)";

                // add highlight glow border
                marker._icon.style.boxShadow = "0px 0px 12px 4px grey";
                marker._icon.style.border = "0";
                marker._icon.style.borderRadius = "50%";
                marker._icon.style.background = "rgba(135, 206, 250, 0.6)";

                // remove highlight after 3 seconds
                // setTimeout(() => {
                //     marker._icon.style.transform = "scale(1)";
                //     marker._icon.style.boxShadow = "";
                //     marker._icon.style.border = "";
                //     marker._icon.style.background = "";
                // }, 3000);

                // setTimeout(() => {
                //     marker._icon.style.transform = "scale(1)";
                // }, 800);

                break;
            }
        }
    });

    // // ----------------------------
    // // RESET MAP TO DEFAULT
    // // ----------------------------
    // // Default map view
    // const DEFAULT_CENTER = [-1.286389, 36.817223];
    // const DEFAULT_ZOOM = 10;

    // // Reset Map Button Logic
    // $(document).on("click", "#reset-map-btn", function () {

    //     console.log("==========",DEFAULT_CENTER,DEFAULT_ZOOM)
    //     //Reset zoom & center
    //     map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });

    //     //Clear search bar
    //     $("#vehicle-search").val("");

    //     clearAllHighlights();

    //     // Re-render all vehicles
    //     refreshVehiclePositions();

    //     frappe.show_alert({
    //         message: "Map reset to default view",
    //         indicator: "blue"
    //     });
    // });

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
        <div style="font-family: Arial, sans-serif;font-size: 11px;line-height: 1.4;width: 600px;max-width: 600px;height: auto;">
        
        <div style="max-height: 600px;overflow-y: auto;overflow-x: hidden;padding-right: 6px;">
            <h4 style="margin: 0 0 6px; font-size: 12px; font-weight: bold; color: #333;">${v.name}</h4>
            
            <div style="margin-bottom: 6px; font-size: 11px; color: #555;">
                <i class="fa fa-map-marker"></i> ${v.location || ''}
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px; flex-wrap: wrap;">
                <div><b>Speed:</b> ${v.speed} km/h</div>
                <div><b>Direction:</b> ${v.direction}°</div>
                <div><b>Vehicle Conn:</b> ${v.conn}</div>
            </div>

            <h4 style="margin: 6px 0 4px; font-size: 12px; font-weight: bold; color: #333;">Driver Details</h4>
            
            <div style="margin-bottom: 4px; font-size: 11px; color: #555;">
                <i class="fa fa-user-circle"></i> ${v.driver_name || ''}
            </div>
            
            <div style="margin-bottom: 6px; font-size: 11px; color: #555;">
                <i class="fa fa-mobile-phone"></i> ${v.driver_number || ''}
            </div>

            ${v.trips && v.trips.length > 0 
            ? `
            <h4 style="margin: 6px 0 4px; font-size: 12px; font-weight: bold; color: #333;">Delivery Trips</h4>

            <div style="overflow-x: auto; max-height: 150px;">
                <table style="width: 100%;border-collapse: collapse;font-size: 10px;table-layout: fixed;">
                    <thead>
                        <tr style="background-color: #f7f7f7;">
                            <th style="border: 1px solid #ccc; padding: 2px; width: 80px;">Trip ID</th>
                            <th style="border: 1px solid #ccc; padding: 2px; width: 80px;">Status</th>
                            <th style="border: 1px solid #ccc; padding: 2px; width: 90px;">Delivery ID</th>
                            <th style="border: 1px solid #ccc; padding: 2px; width: 70px;">Delivery Net Weight</th>
                            <th style="border: 1px solid #ccc; padding: 2px; width: 160px;">Location</th>
                            <th style="border: 1px solid #ccc; padding: 2px; width: 100px;">Contact</th>
                            <th style="border: 1px solid #ccc; padding: 2px; width: 140px;">Customer</th>
                        </tr>
                    </thead>

                    <tbody>
                    ${v.trips.map(trip => {
                        const stops = trip.delivery_stops || [];
                        const rowspan = stops.length || 1;

                        return stops.length > 0
                            ? stops.map((stop, index) => `
                                <tr style="vertical-align: middle;">
                                    ${index === 0 ? `
                                        <td rowspan="${rowspan}" style="border: 1px solid #ccc;padding: 4px;text-align: center;vertical-align: middle;word-break: break-word;">
                                            ${trip.name}
                                        </td>
                                        <td rowspan="${rowspan}" style="border: 1px solid #ccc;padding: 4px;text-align: center;vertical-align: middle;">
                                            ${trip.custom_trip_status}
                                        </td>
                                    ` : ''}

                                    <td style="border: 1px solid #ccc;padding: 4px;white-space: nowrap;overflow: hidden;text-overflow: ellipsis;" title="${stop.name || ''}">
                                        ${stop.name || ''}
                                    </td>

                                    <td style="border: 1px solid #ccc;padding: 4px;text-align: right;white-space: nowrap;">
                                        ${stop.weight || ''}
                                    </td>

                                    <td style="border: 1px solid #ccc;padding: 4px;white-space: normal;word-break: break-word;" title="${stop.location || ''}">
                                        ${stop.location || ''}
                                    </td>

                                    <td style="border: 1px solid #ccc;padding: 4px;white-space: nowrap;">
                                        ${stop.contact_no || ''}
                                    </td>

                                    <td style="border: 1px solid #ccc;padding: 4px;white-space: normal;word-break: break-word;" title="${stop.customer || ''}">
                                        ${stop.customer || ''}
                                    </td>
                                </tr>`).join(''): `

                                <tr>
                                    <td style="border: 1px solid #ccc; padding: 4px;">${trip.name}</td>
                                    <td style="border: 1px solid #ccc; padding: 4px;">${trip.custom_trip_status}</td>
                                    <td colspan="5" style="border: 1px solid #ccc;padding: 4px;text-align: center;color: #888;">No delivery stops</td>
                                </tr>
                            `;
                    }).join('')}
                    </tbody>
                </table>
            </div>
            `
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
            .bindPopup(popupContent,{
                maxWidth: 600,        // increase popup width
                maxHeight: 500,       // increase popup height
                autoPanPaddingTopLeft: [50, 50],
                autoPanPaddingBottomRight: [50, 50],
            });

            marker.on('mouseover', function() { this.openPopup(); });
            // marker.on('mouseout', function() { this.closePopup(); });

            vehicleMarkers[v.id] = marker;
        }
    }

    // Remove Highlighted Marker 
    function clearAllHighlights() {
        for (let id in vehicleMarkers) {
            let marker = vehicleMarkers[id];

            if (marker && marker._icon) {
                marker._icon.style.transform = "scale(1)";
                marker._icon.style.boxShadow = "";
                marker._icon.style.border = "";
                marker._icon.style.background = "";
            }
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

    function refreshVehiclePositions() {
    frappe.call({
        method: 'vehicle_tracking.vehicle_tracking.page.vehicle_monitoring.vehicle_monitoring.get_vehicle_positions',
        callback: function(r) {
            if (r.message) {
                showAllVehiclesOnMap(r.message);
                // frappe.show_alert({message: "Vehicle positions refreshed", indicator: "green"});
            }
        }
    });
}

    // --------------------------
    // AUTO REFRESH EVERY 10 SECONDS
    // --------------------------
    if (!autoRefreshTimer) {
        autoRefreshTimer = setInterval(function () {
            refreshVehiclePositions();
        }, AUTO_REFRESH_INTERVAL);
        console.log("Auto refresh function called...")
    }

    // --------------------------
    // Listen to real-time updates
    // --------------------------
    // frappe.realtime.on('live_vehicle_positions', function(vehicles) {
    //     // vehicles is a list of vehicle objects
    //     showAllVehiclesOnMap(vehicles);
    // });

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
        // console.log("Notification Received......")
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
    // --------------------------
    // CLEANUP INTERVAL ON PAGE DESTROY
    // --------------------------
    $(wrapper).on('page:destroy', function () {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
    });

};
