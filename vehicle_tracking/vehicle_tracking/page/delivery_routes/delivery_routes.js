frappe.pages['delivery-routes'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Delivery Route',
        single_column: true
    });

    // Render template container
    $(frappe.render_template("delivery_routes", {})).appendTo(page.main);

    // Add checkboxes for mode selection
    let $modeSelection = $(`
        <div style="margin-bottom: 15px;">
            <label><input type="radio" name="result-mode" value="trip" checked> Select Delivery Trip</label>
            &nbsp;&nbsp;
            <label><input type="radio" name="result-mode" value="vehicle"> Select Vehicle</label>
        </div>
        <div id="mode-input-container"></div>
        <div id="trip-results-container"></div>
    `);

    $("#delivery-select-container").html($modeSelection);

    // Load default mode
    loadTripMode();

    // Handle mode change
    $("input[name='result-mode']").on("change", function() {
        $("#trip-results-container").empty(); // clear previous map
        let selected = $(this).val();
        if (selected === "trip") {
            loadTripMode();
        } else {
            loadVehicleMode();
        }
    });

    // ===== FUNCTIONS =====
    function loadTripMode() {
        $("#mode-input-container").html("<p>Loading trips...</p>");
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Delivery Trip",
                fields: ["name"],
                limit_page_length: 1000
            },
            callback: function(r) {
                if (r.message && r.message.length) {
                    let $select = $(`
                        <select id="trip-select" class="form-control">
                            <option value="">Select Trip</option>
                        </select>
                    `);

                    r.message.forEach(v => {
                        $select.append(`<option value="${v.name}">${v.name}</option>`);
                    });

                    $("#mode-input-container").html($select);

                    $select.on("change", function() {
                        $("#trip-results-container").empty(); // clear previous map
                        let selectedTrip = $(this).val();
                        if (selectedTrip) getRoute({ trip: selectedTrip });
                    });
                } else {
                    $("#mode-input-container").html("<p>No trips found</p>");
                }
            }
        });
    }

    function loadVehicleMode() {
        let $inputs = $(`
            <div>
                <select id="vehicle-select" class="form-control" style="margin-bottom:10px;">
                    <option value="">Select Vehicle</option>
                </select>
                <input type="datetime-local" id="start-dt" class="form-control" style="margin-bottom:10px;">
                <input type="datetime-local" id="end-dt" class="form-control" style="margin-bottom:10px;">
                <button class="btn btn-primary" id="vehicle-submit">Get Route</button>
            </div>
        `);

        $("#mode-input-container").html($inputs);

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Vehicle",
                fields: ["name"],
                limit_page_length: 1000
            },
            callback: function(r) {
                if (r.message && r.message.length) {
                    r.message.forEach(v => {
                        $("#vehicle-select").append(`<option value="${v.name}">${v.name}</option>`);
                    });
                }
            }
        });

        $("#vehicle-submit").on("click", function() {
            $("#trip-results-container").empty(); // clear previous map
            let vehicle = $("#vehicle-select").val();
            let start = $("#start-dt").val();
            let end = $("#end-dt").val();

            if (!vehicle || !start || !end) {
                frappe.msgprint("Please select vehicle, start and end datetime");
                return;
            }

            getRoute({ vehicle: vehicle, start: start, end: end });
        });
    }

    // ===== API Call =====
    function getRoute(args) {
        frappe.call({
            method: "vehicle_tracking.vehicle_tracking.page.delivery_routes.delivery_routes.get_route",
            args: args,
            callback: function(r) {
                if (r.message && r.message.length) {
                    renderTrips(r.message);
                } else {
                    frappe.msgprint("No Route Available !!");
                }
            }
        });
    }

    // ===== Render Map =====
    function renderTrips(points) {
        $("#trip-results-container").html('<div id="trip-map" style="height: 800px; width: 100%;"></div>');

        var map = L.map('trip-map').setView(points[0], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        var latlngs = points.map(p => [p[0], p[1]]);
        var polyline = L.polyline(latlngs, { color: 'blue', weight: 3, opacity: 0.8 }).addTo(map);

        latlngs.forEach(coord => {
            L.circleMarker(coord, {
                radius: 1,
                color: "green",
                fillColor: "red",
                fillOpacity: 0.5
            }).addTo(map);
        });

        map.fitBounds(polyline.getBounds());
    }
};
