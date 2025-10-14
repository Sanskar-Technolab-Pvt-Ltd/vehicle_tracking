frappe.pages['trip-management'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Trip Management',
        single_column: true
    });
								 
    // Add Refresh button
    page.set_primary_action("Refresh", function() {
        let selected = $("#vehicle-select").val();
        let status = $("#trip-status-select").val();
        loadTrips(selected,status); // reload only trips
    });

    $(frappe.render_template("trip_management", {})).appendTo(page.main);

    // fetch vehicles from Doctype and build select field
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Vehicle",
            fields: ["name"],
            limit_page_length: 1000
        },
        callback: function(r) {
            if (r.message) {
                // build select field
                let $select = $(`<select id="vehicle-select" class="form-control">
                                    <option value="">Select Vehicle</option>
                                    <option value="All">All</option>
                                </select>`);

                // append vehicle options
                r.message.forEach(v => {
                    $select.append(`<option value="${v.name}">${v.name}</option>`);
                });

                // inject into container
                $("#vehicle-select-container").html($select);

                let $statusSelect = $(`
                    <select id="trip-status-select" class="form-control" style="margin-top:10px;">
                        <option value="Scheduled">Scheduled</option>
                        <option value="In-Transit">In-Transit</option>
                        <option value="Completed">Completed</option>
                    </select>`);
                $("#trip-status-container").html($statusSelect);


                // on change, load trips
                $select.on("change", function() {
                    let selected = $(this).val();
                    let selectedStatus = $("#trip-status-select").val();
                    loadTrips(selected,selectedStatus);
                });

                $statusSelect.on("change", function() {
                    let selectedVehicle = $("#vehicle-select").val();
                    let selectedStatus = $(this).val();
                    loadTrips(selectedVehicle, selectedStatus);
                });

                // Restore saved vehicle AFTER binding change event
                let savedVehicle = sessionStorage.getItem("trip_management_selected_vehicle");
                if (savedVehicle) {
                    $select.val(savedVehicle).trigger("change");  
                    sessionStorage.removeItem("trip_management_selected_vehicle");
                }  
            }
        }
    });

    // reusable function to load trips
    function loadTrips(vehicleName,tripStatus) {
        if (!vehicleName) {
            $("#trip-results-container").html("<p>Please select a vehicle</p>");
            return;
        }

        frappe.call({
            method:"vehicle_tracking.vehicle_tracking.page.trip_management.trip_management.get_trips_by_vehicle",
            args:{ "vehicle_name": vehicleName, "trip_status": tripStatus},
            callback:function(r){
                if (r.message){
                    renderTrips(r.message);
                }
            }
        });
    }

    // reusable function to render trips
    function renderTrips(data) {
        let html = `<table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Action</th>
                                <th>Vehicle</th>
                                <th>Trip Status</th>
                                <th>Trip ID</th>
                                <th>Delivery IDs</th>
                                <th>Change Delivery Status</th>
                                <th>Time Taken</th>
                            </tr>
                        </thead><tbody>`;

        Object.keys(data).forEach(vehicle => {
            data[vehicle].forEach(trip => {
                let deliveryHtml = "", buttonHtml = "", timeHtml = "";

                if (trip.delivery_id.length > 0) {
                    trip.delivery_id.forEach(id => {
                        let isCompleted = trip.completed_delivery_ids && trip.completed_delivery_ids.includes(id);
                        let timeTaken = (trip.delivery_times && trip.delivery_times[id]) ? trip.delivery_times[id] : "";

                        // Delivery ID list
                        deliveryHtml += `<div>${id}</div>`;

                        // Buttons
                        let btnClass = isCompleted ? "btn-success" : "btn-secondary";
                        let btnText = isCompleted ? "Completed" : "Mark Completed";
                        let disabled = isCompleted ? "disabled" : "";

                        buttonHtml += `
                            <div class="mb-1">
                                <button class="btn btn-sm ${btnClass} complete-delivery-btn" 
                                        data-delivery="${id}" ${disabled}>
                                    ${btnText}
                                </button>
                            </div>
                        `;

                        // Time column
                        timeHtml += `<div class="delivery-time" data-delivery="${id}">
                                        ${isCompleted && timeTaken ? timeTaken : ""}
                                     </div>`;
                    });
                }

                // Button styles based on status
                let startClass = "btn-primary", stopClass = "btn-primary";
                let startDisabled = "", stopDisabled = "";

                if (trip.status === "Scheduled") {
					startDisabled = "";
					stopDisabled = "disabled";
                } else if (trip.status === "In-Transit") {
 					startDisabled = "disabled";
					stopDisabled = "";
					startClass = "btn-success";
                } else if (trip.status === "Completed") {
                    startDisabled = "disabled";
					stopDisabled = "disabled";
					stopClass = "btn-danger"; 
                }

                // Action buttons
                let actionButtons = `<div class="d-flex flex-column align-items-center">
                                        <button class="btn btn-sm rounded-circle action-btn start-trip-btn ${startClass}" 
                                                data-trip="${trip.trip_id}" title="Start Trip" ${startDisabled}>▶</button><br>
                                        <button class="btn btn-sm rounded-circle action-btn stop-trip-btn ${stopClass}" 
                                                data-trip="${trip.trip_id}" title="Stop Trip" ${stopDisabled}>■</button>
                                    </div>`;

                html += `<tr>
                            <td class="text-center">${actionButtons}</td>
                            <td>${vehicle}</td>
                            <td>${trip.status || ""}</td>
                            <td>${trip.trip_id}</td>
                            <td>${deliveryHtml}</td>
                            <td>${buttonHtml}</td>
                            <td>${timeHtml}</td>
                        </tr>`;
            });
        });

        html += `</tbody></table>`;
        $("#trip-results-container").html(html);

        // attach button events
        bindTripEvents();
    }

    // reusable function to bind events after rendering
    function bindTripEvents() {
        // Confirm before marking delivery complete
        $(".complete-delivery-btn").on("click", function() {
            let deliveryId = $(this).data("delivery");

            frappe.confirm(
                'Do you really want to mark this delivery as completed?',
                function() {
                    frappe.call({
                        method: "vehicle_tracking.vehicle_tracking.page.trip_management.trip_management.mark_delivery_completed",
                        args: { "delivery_id": deliveryId },
                        callback: function(res) {
                            if (!res.exc && res.message.success) {
                                let timeTaken = res.message.time_taken;
                                frappe.show_alert({
                                    message: `Delivery ${deliveryId} Completed in ${timeTaken}`,
                                    indicator: "green"
                                }, 5);

                                $(`button[data-delivery='${deliveryId}']`)
                                    .text("Completed")
                                    .removeClass("btn-secondary")
                                    .addClass("btn-success")
                                    .prop("disabled", true);

                                $(`.delivery-time[data-delivery='${deliveryId}']`).text(timeTaken);
                            }
                        }
                    });
                },
                function() {
                    // No action on cancel
                }
            );
        });

        // Confirm before starting trip
        $(".start-trip-btn").on("click", function() {
            let tripId = $(this).data("trip");

            frappe.confirm(
                'Do you really want to start this trip?',
                function() {
                    frappe.call({
                        method: "vehicle_tracking.vehicle_tracking.page.trip_management.trip_management.update_trip_status",
                        args: { "trip_id": tripId, "status": "In-Transit" },
                        callback: function(res){
                            if(!res.exc){
                                frappe.show_alert({message: `Trip ${tripId} Started`, indicator: "green"}, 5);
                                loadTrips($("#vehicle-select").val(),$("#trip-status-select").val());
                            }
                        }
                    });
                },
                function() { }
            );
        });

        // Confirm before stopping trip
        $(".stop-trip-btn").on("click", function() {
            let tripId = $(this).data("trip");

            frappe.confirm(
                'Do you really want to complete this trip?',
                function() {
                    frappe.call({
                        method: "vehicle_tracking.vehicle_tracking.page.trip_management.trip_management.update_trip_status",
                        args: { "trip_id": tripId, "status": "Completed" },
                        callback: function(res){
                            if(!res.exc){
                                frappe.show_alert({message: `Trip ${tripId} Completed`, indicator: "red"}, 5);
                                loadTrips($("#vehicle-select").val(),$("#trip-status-select").val());
                            }
                        }
                    });
                },
                function() { }
            );
        });
    }
};
