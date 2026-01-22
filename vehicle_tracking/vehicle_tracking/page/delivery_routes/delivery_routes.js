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
            <label><input type="radio" name="result-mode" value="delivery"> Select Delivery Note</label>
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
        } else if (selected === "delivery") {
            loadDelivery();
        } else {
            loadVehicleMode();
        }
    });

    // ===== FUNCTIONS =====
    function loadTripMode() {
        $("#mode-input-container").empty();

        let $tripFieldWrapper = $('<div></div>');
        $("#mode-input-container").append($tripFieldWrapper);

        let tripControl = frappe.ui.form.make_control({
            parent: $tripFieldWrapper,
            df: {
                fieldtype: 'Link',
                label: 'Delivery Trip',
                fieldname: 'delivery_trip',
                options: 'Delivery Trip',
                placeholder: 'Search Delivery Trip',
                get_query: function () {
                    return {
                        filters: {
                            docstatus: 1,
                            custom_trip_status: 'Completed'
                        }
                    };
                },
                onchange: function () {
                    $("#trip-results-container").empty();

                    let selectedTrip = tripControl.get_value();
                    if (selectedTrip) {
                        getRoute({ trip: selectedTrip });
                    }
                }
            },
            render_input: true
        });
    }

    function loadDelivery() {
        $("#mode-input-container").empty();

        let $deliveryFieldWrapper = $('<div></div>');
        $("#mode-input-container").append($deliveryFieldWrapper);

        let deliverycontrol = frappe.ui.form.make_control({
            parent: $deliveryFieldWrapper,
            df: {
                fieldtype: 'Link',
                label: 'Delivery Note',
                fieldname: 'delivery_note',
                options: 'Delivery Note',
                placeholder: 'Search Delivery Note',
                get_query: function () {
                    return {
                        filters: {
                            docstatus: 1,
                            custom_delivery_status: 'Completed'
                        }
                    };
                },
                onchange: function () {
                    $("#trip-results-container").empty();

                    let selectedDelivery = deliverycontrol.get_value();
                    if (selectedDelivery) {
                        getRoute({ delivery: selectedDelivery });
                    }
                }
            },
            render_input: true
        });
    }

    function setDefaultDates() {
    let today = new Date();
    let yyyy = today.getFullYear();
    let mm = String(today.getMonth() + 1).padStart(2, '0'); // Months start at 0
    let dd = String(today.getDate()).padStart(2, '0');

    // From Date = today 00:00
    let fromDate = `${yyyy}-${mm}-${dd}T00:00`;
    // To Date = today 23:59
    let toDate = `${yyyy}-${mm}-${dd}T23:59`;

    return { fromDate, toDate }; // return values instead of directly setting
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

        const { fromDate, toDate } = setDefaultDates();
        $("#start-dt").val(fromDate);
        $("#end-dt").val(toDate);

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
                if (r.message && Array.isArray(r.message) && r.message.length) {
                
                const routePoints = r.message[0];   // first element: list of route points
                const vehicleName = r.message[1];  // second element: vehicle name
                const driverDetails = r.message[2];
                const deliveryDetails = r.message[3];

                // if routePoints list is empty, show message and stop
                if (!routePoints || routePoints.length === 0) {
                    $("#trip-results-container").text("No Route Available");
                    $("#map").hide();   // hide map if it was visible
                    return;
                }

                // valid route points found
                $("#map").show();
                renderTrips(routePoints, vehicleName, driverDetails, deliveryDetails);
            } else {
                $("#trip-results-container").text("No Route Available");
                $("#map").hide();
            }
        }
        });
    }


    function renderTrips(points, vehicle_name=null, driver_details=null,deliveryDetails=null) {
    $("#trip-results-container").html(`
        <div id="trip-map" style="height: 800px; width: 100%;"></div>
    `);
    
    // let vehicle = $("#vehicle-select").val();

    var map = L.map('trip-map').setView(points[0], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var latlngs = points.map(p => [p[0], p[1]]);
    var polyline = L.polyline(latlngs, { color: 'blue', weight: 3, opacity: 0.8 }).addTo(map);

    map.fitBounds(polyline.getBounds());

    // ===== PLAYBACK VARIABLES =====
    var playbackMarker = L.marker(latlngs[0]).addTo(map);
    var index = 0;
    var playing = false;
    var intervalId = null;
    var speed = 500; // default 1x (ms per step)

    if (vehicle_name && driver_details && deliveryDetails.length >0) {
        let deliveryHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #555; margin-top: 6px;">
            <thead>
                <tr>
                    <th style="padding: 4px 6px; border: 1px solid #ddd; background: #f2f2f2; text-align: left;">Delivery ID</th>
                    <th style="padding: 4px 6px; border: 1px solid #ddd; background: #f2f2f2; text-align: left;">Customer Name</th>
                    <th style="padding: 4px 6px; border: 1px solid #ddd; background: #f2f2f2; text-align: left;">Customer Number</th>
                </tr>
            </thead>
            <tbody>
        `;

        deliveryDetails.forEach((item) => {
            deliveryHTML += `
                <tr>
                    <td style="padding: 4px 6px; border: 1px solid #ddd;">${item[0]}</td>
                    <td style="padding: 4px 6px; border: 1px solid #ddd;">${item[1]}</td>
                    <td style="padding: 4px 6px; border: 1px solid #ddd;">${item[2]}</td>
                </tr>`;
        });

        deliveryHTML += `
                </tbody>
            </table>
        `;
        // Popup content

        var popupContent = `
            <div style="font-family: Arial, sans-serif; font-size: 10px; line-height: 1.5; width: 260px;">   
                <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #333;">${vehicle_name}</h4>
                <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #333;">Driver Details</h4>
                <div style="margin-bottom: 6px; font-size: 12px; color: #555;">
                <i class="fa fa-user-circle"></i> ${driver_details[0]}<br>
                ${driver_details[1]}
                </div>
                <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #333;">Delivery Details</h4>
                ${deliveryHTML}  
            </div>`;
            playbackMarker.bindPopup(popupContent).openPopup();
        } 
    
        else if (vehicle_name && driver_details){
            var popupContent = `
            <div style="font-family: Arial, sans-serif; font-size: 10px; line-height: 1.5; width: 260px;">   
                <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #333;">${vehicle_name}</h4>
                <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #333;">Driver Details</h4>
                <div style="margin-bottom: 6px; font-size: 12px; color: #555;">
                <i class="fa fa-user-circle"></i> ${driver_details[0]}<br>
                ${driver_details[1]}
                </div>
            </div>`;
            playbackMarker.bindPopup(popupContent).openPopup();
        }

    // if (vehicle_name && driver_details) {

        // var popupContent = `
        //                 <div style="font-family: Arial, sans-serif; font-size: 10px; line-height: 1.5; width: 260px;">   
        //                     <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #333;">${vehicle_name}</h4>
        //                     <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #333;">Driver Details</h4>
        //                     <div style="margin-bottom: 6px; font-size: 12px; color: #555;">
        //                     <i class="fa fa-user-circle"></i> ${driver_details[0]}<br>
        //                     ${driver_details[1]}
        //                     </div>
        //                     <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: bold; color: #333;">Delivery Details</h4>     
        //                 </div>`;

    //     playbackMarker.bindPopup(popupContent).openPopup();}

    // ====== UPDATE MARKER FUNCTION ======
    function updateMarkerPosition(i) {
        if (i >= 0 && i < latlngs.length) {
            playbackMarker.setLatLng(latlngs[i]);
            // if (vehicle_name) {
            //     playbackMarker.bindPopup(`<b>Vehicle:</b> ${vehicle_name}`).openPopup();
            // }
            sliderInput.value = i;
        }
    }

    function togglePlayback() {
        if (!playing) {
            playing = true;
            playBtn.innerHTML = "⏸"; // pause icon
            intervalId = setInterval(() => {
                if (index < latlngs.length - 1) {
                    updateMarkerPosition(index);
                    index++;
                } else {
                    clearInterval(intervalId);
                    playing = false;
                    playBtn.innerHTML = "▶";
                }
            }, speed);
        } else {
            playing = false;
            playBtn.innerHTML = "▶";
            clearInterval(intervalId);
        }
    }

    function stepForward() {
        if (index < latlngs.length - 1) {
            index++;
            updateMarkerPosition(index);
        }
    }

    function stepBackward() {
        if (index > 0) {
            index--;
            updateMarkerPosition(index);
        }
    }

    // ===== CUSTOM PLAYER CONTROL =====
    var PlayerControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function () {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.style.background = "#fff";
            container.style.padding = "8px";
            container.style.width = "320px";
            container.style.fontSize = "13px";
            container.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";

            // Vehicle name
            var title = L.DomUtil.create('div', '', container);
            // title.innerHTML = `<b>${vehicle}</b>`;
            title.innerHTML = `<b>PlayBack</b>`;
            title.style.marginBottom = "5px";

            // Slider
            sliderInput = L.DomUtil.create('input', '', container);
            sliderInput.type = "range";
            sliderInput.min = 0;
            sliderInput.max = latlngs.length - 1;
            sliderInput.value = 0;
            sliderInput.style.width = "100%";
            sliderInput.style.marginBottom = "5px";

            L.DomEvent.on(sliderInput, 'input', function () {
                index = parseInt(sliderInput.value);
                updateMarkerPosition(index);
            });

            // Controls row
            var controls = L.DomUtil.create('div', '', container);
            controls.style.display = "flex";
            controls.style.justifyContent = "space-between";
            controls.style.alignItems = "center";

            // Backward button
            var backBtn = L.DomUtil.create('button', '', controls);
            backBtn.innerHTML = "⏮";
            backBtn.style.margin = "2px";

            // Play button
            playBtn = L.DomUtil.create('button', '', controls);
            playBtn.innerHTML = "▶";
            playBtn.style.margin = "2px";

            // Forward button
            var fwdBtn = L.DomUtil.create('button', '', controls);
            fwdBtn.innerHTML = "⏭";
            fwdBtn.style.margin = "2px";

            // Speed select
            var speedSelect = L.DomUtil.create('select', '', controls);
            ["1x","2x","5x","10x"].forEach(v=>{
                let opt = document.createElement("option");
                opt.value = v;
                opt.text = v;
                speedSelect.appendChild(opt);
            });
            speedSelect.value = "1x";

            // Event bindings
            L.DomEvent.on(playBtn, 'click', function (e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                togglePlayback();
            });

            L.DomEvent.on(backBtn, 'click', function (e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                stepBackward();
            });

            L.DomEvent.on(fwdBtn, 'click', function (e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                stepForward();
            });

            L.DomEvent.on(speedSelect, 'change', function () {
                let val = speedSelect.value.replace("x","");
                let factor = parseInt(val);
                speed = 500 / factor; // faster playback
                if (playing) {
                    clearInterval(intervalId);
                    intervalId = setInterval(() => {
                        if (index < latlngs.length - 1) {
                            updateMarkerPosition(index);
                            index++;
                        } else {
                            clearInterval(intervalId);
                            playing = false;
                            playBtn.innerHTML = "▶";
                        }
                    }, speed);
                }
            });

            return container;
        }
    });
    map.addControl(new PlayerControl());
}

};
