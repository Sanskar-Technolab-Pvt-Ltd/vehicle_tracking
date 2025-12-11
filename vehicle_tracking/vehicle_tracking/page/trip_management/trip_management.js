frappe.pages['trip-management'].on_page_load = function(wrapper) {

    // ==========================
    // Adding CSS for Proper Alignment
    // ==========================
    $(`<style>
        .multi-col {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .multi-col > div {
        min-height: 30px; /* ensures all delivery rows align */
        display: flex;
        align-items: center; /* vertical center */
    }

    .delivery-action {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .delivery-btn {
        padding: 4px 10px !important;
        font-size: 12px !important;
        height: 24px !important;
        line-height: 14px !important;
        white-space: nowrap;
    }

    .delivery-time {
        text-align: left;
        font-size: 13px;
    }

    /* optional: vertically center table cells */
    .table td, .table th {
        vertical-align: middle;
    }

    </style>`).appendTo("head");

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

    $("#vehicle-select-container").html(`
        <div class="row justify-content-center mt-3">
            <div class="col-md-4">
                <label><strong>Select Vehicle</strong></label>
                <div id="vehicle-select-inner"></div>
            </div>

            <div class="col-md-4">
                <label><strong>Trip Status</strong></label>
                <div id="trip-status-inner"></div>
            </div>
        </div>
    `);

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
                let $select = $(`
                    <select id="vehicle-select" class="form-control">
                        <option value="">Select Vehicle</option>
                        <option value="All">All</option>
                    </select>
                `);

                // append vehicle options
                r.message.forEach(v => {
                    $select.append(`<option value="${v.name}">${v.name}</option>`);
                });

                // inject into inner container
                $("#vehicle-select-inner").html($select);

                let $statusSelect = $(`
                    <select id="trip-status-select" class="form-control">
                        <option value="Scheduled">Scheduled</option>
                        <option value="In-Transit">In-Transit</option>
                        <option value="Completed">Completed</option>
                    </select>
                `);

                $("#trip-status-inner").html($statusSelect);

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
                    // renderTrips(r.message);
                    renderTrips(r.message.trips, r.message.running);
                }
            }
        });
    }

    // reusable function to render trips
    // function renderTrips(data) {
    function renderTrips(data, runningMap){
        let html = `<table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Action</th>
                                <th>Vehicle</th>
                                <th>Trip Status</th>
                                <th>Trip ID</th>
                                <th>Delivery IDs</th>
                                <th>Location</th>
                                <th>Change Delivery Status</th>
                                <th>Time Taken</th>
                            </tr>
                        </thead><tbody>`;

        Object.keys(data).forEach(vehicle => {
            
            let vehicleHasRunningTrip = runningMap[vehicle] === true;
            
            data[vehicle].forEach(trip => {
                let deliveryHtml = "", buttonHtml = "", timeHtml = "", locationHtml = "";

                // Loop all deliveries once & build four aligned columns
                trip.delivery_id.forEach(id => {

                    let isCompleted = trip.completed_delivery_ids?.includes(id);
                    let timeTaken = trip.delivery_times?.[id] || "";
                    let location = trip.delivery_locations?.[id] || "";

                    let btnClass = isCompleted ? "btn-success" : "btn-info";
                    let btnText = isCompleted ? "Completed" : "Mark Completed";
                    let disabled = isCompleted ? "disabled" : "";

                    // Delivery ID column
                    deliveryHtml += `
                        <div class="delivery-cell delivery-id">${id}</div>
                    `;

                    // Location column
                    locationHtml += `
                        <div class="delivery-cell">${location}</div>
                    `;

                    // Button column
                    buttonHtml += `
                        <div class="delivery-action">
                            <img src="/assets/vehicle_tracking/icons/complete.png" style="width:18px; height:18px;">
                            <button class="btn delivery-btn ${btnClass} complete-delivery-btn"
                                    data-delivery="${id}" ${disabled}>
                                ${btnText}
                            </button>
                        </div>
                    `;

                    // Time column
                    timeHtml += `
                        <div class="delivery-time" data-delivery="${id}">
                            ${isCompleted ? timeTaken : ""}
                        </div>
                    `;
                });

                // Button styles based on status
                let startClass = "btn-primary", stopClass = "btn-primary";
                let startDisabled = "", stopDisabled = "";

                if (vehicleHasRunningTrip && trip.status === "Scheduled") {
                    startDisabled = "disabled";
                    stopDisabled = "disabled";
                }
                else if (trip.status === "Scheduled") {
					startDisabled = "";
					stopDisabled = "disabled";
                } 
                else if (trip.status === "In-Transit") {
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
                                                data-trip="${trip.trip_id}" title="End Trip" ${stopDisabled}>■</button>
                                    </div>`;
                
                html += `<tr>
                            <td class="text-center">${actionButtons}</td>
                            <td>${vehicle}</td>
                            <td>${trip.status || ""}</td>
                            <td>${trip.trip_id}</td>

                            <!-- FIXED: ALIGN ALL FOUR COLUMNS -->
                            <td><div class="multi-col">${deliveryHtml}</div></td>
                            <td><div class="multi-col">${locationHtml}</div></td>
                            <td><div class="multi-col">${buttonHtml}</div></td>
                            <td><div class="multi-col">${timeHtml}</div></td>
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
        // VALIDATION FOR MARK COMPLETE BUTTON
        $(document).on("click", ".complete-delivery-btn", function (event) {

            event.preventDefault();
            event.stopImmediatePropagation();   

            let deliveryId = $(this).data("delivery");

            // Find trip status from table row (3rd column)
            let tripStatus = $(this)
                .closest("tr")
                .find("td:nth-child(3)")
                .text()
                .trim();

            // VALIDATION: Trip must be started
            if (tripStatus !== "In-Transit") {
                frappe.msgprint({
                    title: "Trip Not Started",
                    indicator: "red",
                    message: "Please start the trip first."
                });
                // Stop execution
                return; 
            }

            // Call your backend method
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
                                    .removeClass("btn-info")
                                    .addClass("btn-success")
                                    .prop("disabled", true);

                                $(`.delivery-time[data-delivery='${deliveryId}']`).text(timeTaken);
                            }
                        }
                    });
                },
                function () {
                    // No action on cancel
            });
        });

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

        $(".stop-trip-btn").on("click", function() {
            let tripId = $(this).data("trip");
            let row = $(this).closest("tr");

            // Collect all delivery IDs
            let deliveries = [];
            row.find("td:nth-child(5) .delivery-id").each(function() {
                let val = $(this).text().trim();
                if (val) deliveries.push(val);
            });

            let completed = [];
            row.find(".complete-delivery-btn").each(function() {
                if ($(this).prop("disabled")) completed.push($(this).data("delivery"));
            });

            let pending = deliveries.filter(d => !completed.includes(d));

            if (pending.length === 0) {
                // All deliveries completed → just confirm trip completion
                frappe.confirm(
                    'Do you really want to complete this trip?',
                    function() {
                        frappe.call({
                            method: "vehicle_tracking.vehicle_tracking.page.trip_management.trip_management.update_trip_status",
                            args: { "trip_id": tripId, "status": "Completed" },
                            callback: function(res){
                                if(!res.exc){
                                    frappe.show_alert({ message: `Trip ${tripId} Completed`, indicator: "red" }, 5);
                                    loadTrips($("#vehicle-select").val(), $("#trip-status-select").val());
                                }
                            }
                        });
                    }
                );
                return;
            }

            // CASE 2: Pending deliveries → Ask for reason
            let pendingList = pending.join(", ");
            frappe.prompt(
                [
                    {
                        label: `Reason for NOT completing Delivery(s): ${pendingList}`,
                        fieldname: "reason",
                        fieldtype: "Small Text",
                        reqd: 1
                    }
                ],
                function(values) {
                    // After entering reason → Save and complete trip
                    frappe.call({
                        method: "vehicle_tracking.vehicle_tracking.page.trip_management.trip_management.store_incomplete_delivery_reason",
                        args: {
                            "trip_id": tripId,
                            "pending_deliveries": pending,
                            "reason": values.reason
                        },
                        callback: function(r) {
                            // If backend returned success = true
                            if (r.message && r.message.success === true) {
                                frappe.show_alert({
                                    message: `Trip ${tripId} Completed with Pending Deliveries Saved`,
                                    indicator: "green"
                                }, 3);

                                // reload trips on success
                                loadTrips($("#vehicle-select").val(), $("#trip-status-select").val());
                            } 
                            
                            // If backend returned success = false
                            else {
                                frappe.show_alert({
                                    message: `Failed to update trip ${tripId} and Delivery Ids ${pending}. Please try again.`,
                                    indicator: "red"
                                }, 3);
                            }
                        }
                    });
                },
                "Pending Deliveries",
                "Save"
            );
        });

    }
};
