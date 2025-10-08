frappe.pages['sensor-monitoring'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: '	',
		single_column: true
	});

	// Render the HTML template
    $(frappe.render_template("sensor_monitoring", {})).appendTo(page.main);

	loadVehicles();

	// Trigger when user selects a vehicle
	$("#vehicle-select").on("change", function() {
		$("#sensor-result").empty();
		let selectedVehicle = $(this).val();
		if(selectedVehicle) {
			loadSensors(selectedVehicle);
		} else {
			$("#sensor-container").empty();
			$("#sensor-result").empty();
		}
	});

	// Trigger API call when Result button is clicked
	$("#get-sensor-result").on("click", function() {
		let selectedVehicle = $("#vehicle-select").val();
		let selectedSensors = $(".sensor-checkbox:checked").map(function() {
			return $(this).val();
		}).get();

		if(selectedVehicle && selectedSensors.length > 0) {
			frappe.call({
				method: "vehicle_tracking.vehicle_tracking.page.sensor_monitoring.sensor_monitoring.get_sensor_data",
				args: {
					vehicle: selectedVehicle,
					sensors: selectedSensors
				},
				callback: function(r) {
					// $("#sensor-result").html(JSON.stringify(r.message, null, 2));
					renderSensorResults(r.message || []);
				}
			});
		}
	});

	
	function loadVehicles() {
	
		frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Vehicle",
			fields: ["name"],
			limit_page_length: 0
		},
		callback: function (r) {
			let vehicleSelect = $("#vehicle-select");
			vehicleSelect.empty();
			vehicleSelect.append('<option value="">-- Select Vehicle --</option>');
			if (r.message && r.message.length > 0) {
				r.message.forEach(v => {
					vehicleSelect.append(`<option value="${v.name}">${v.name}</option>`);
				});
			} else {
				vehicleSelect.append('<option value="">No Vehicles Found</option>');
			}
		}
	});
}

	function loadSensors(vehicleName) {
		frappe.call({
			method: "vehicle_tracking.vehicle_tracking.page.sensor_monitoring.sensor_monitoring.get_sensor_names",
			args: {
				vehicle: vehicleName
			},
			callback: function(r) {
				let sensors = r.message || [];
				let container = $("#sensor-container");
				container.empty();
				
				let resultButton = $("#get-sensor-result");
				resultButton.hide();

				if(sensors.length > 0) {
					sensors.forEach(sensor => {
						let checkbox = `
							<div style="margin:5px;">
								<input type="checkbox" class="sensor-checkbox" value="${sensor}" id="sensor_${sensor}">
								<label for="sensor_${sensor}">${sensor}</label>
							</div>
						`;
						container.append(checkbox);
					});

					// Show the button now that sensors exist
					resultButton.show();
					resultButton.prop("disabled", true);

					// Listen for checkbox changes
					$(".sensor-checkbox").on("change", function() {
						let anyChecked = $(".sensor-checkbox:checked").length > 0;
						$("#get-sensor-result").prop("disabled", !anyChecked);
					});
				} else {
					container.append('<p>No sensors found for this vehicle.</p>');
				}
			}
		});
	}

	function renderSensorResults(sensors) {
    let container = $("#sensor-result");
    container.empty(); // clear previous results

    if (!sensors || sensors.length === 0) {
        container.html("<p>No sensor data found.</p>");
        return;
    }

    // Build HTML table
    let table = `
        <table class="table table-bordered" style="margin-top: 15px; font-size: 14px;">
            <thead>
                <tr>
                    <th>Sensor Name</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                ${sensors.map(s => `
                    <tr>
                        <td>${s.sensor}</td>
                        <td>${s.value}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;

    container.html(table);
}

}