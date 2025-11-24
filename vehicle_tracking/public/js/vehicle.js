frappe.ui.form.on("Vehicle", {
    refresh(frm) {
        // Remove duplicates on every refresh
        // frm.clear_custom_buttons();

        // Always show both buttons
        show_vehicle_buttons(frm);
    }
});

function show_vehicle_buttons(frm) {
    frm.add_custom_button("Fetch Vehicle ID", () => {
        if (!frm.doc.license_plate){
            frappe.throw("Enter the Vehicle Name First");
            return;
        }

        frappe.call({
            method: "vehicle_tracking.vehicle_tracking.apis.common_utils.get_vehicle_id",
            args: {
                vehicle_name: frm.doc.license_plate 
            },
            callback(r) {
                if (r.message) {
                    
                    frm.set_value("custom_vehicle_id", r.message);
                    frm.save()
                    frappe.show_alert("Vehicle ID set Successfully", 3); 

                } else {
                    frappe.throw("Enter Valid Vehicle Name-Vehicle ID not found!");
                }
            }
        });

    }).addClass("btn-primary");

    frm.add_custom_button("Fetch Sensors", () => {

        if (!frm.doc.license_plate){
            frappe.throw("Enter the Vehicle Name First");
            return;
        }
        frappe.call({
                method: "vehicle_tracking.vehicle_tracking.apis.common_utils.get_sensor_data",
                args: {
                    vehicle_name: frm.doc.license_plate
                },
                callback(r) {

                    if (r.message && Object.keys(r.message).length !== 0) {

                        let sensors = r.message;

                        // Loop through each key in sensors object
                        for (let key in sensors) {

                            let v = sensors[key];

                            // Check if row with same id exists
                            let existing_row = null;
                            (frm.doc.custom_sensors || []).forEach(row => {
                                if (row.id == v.id) {
                                    existing_row = row;
                                }
                            });

                            if (existing_row) {
                                // Update existing row
                                frappe.model.set_value(existing_row.doctype, existing_row.name, "mode", v.m);

                                if (v.t === "custom") {
                                    let data = JSON.parse(v.c);
                                    let ci = data.ci || {};
                                    let ins_data = {};

                                    Object.keys(ci).forEach(ki => {
                                        ins_data[parseInt(ki)] = ci[ki].t;
                                    });

                                    frappe.model.set_value(existing_row.doctype, existing_row.name, "custom_json", ins_data);
                                }

                            } else {
                                // Add new row
                                let child = frm.add_child("custom_sensors");
                                frappe.model.set_value(child.doctype, child.name, "id", v.id);
                                frappe.model.set_value(child.doctype, child.name, "sensor_name", v.n);
                                frappe.model.set_value(child.doctype, child.name, "type", v.t);
                                frappe.model.set_value(child.doctype, child.name, "mode", v.m);
                                // frappe.model.set_value(child.doctype, child.name, "custom_json", v.p);

                                if (v.t === "custom") {
                                    let data = JSON.parse(v.c);
                                    let ci = data.ci || {};
                                    let ins_data = {};

                                    Object.keys(ci).forEach(ki => {
                                        ins_data[parseInt(ki)] = ci[ki].t;
                                    });

                                    frappe.model.set_value(child.doctype, child.name, "custom_json", ins_data);
                                }
                                frm.save()
                            }
                        }

                        frm.refresh_field("custom_sensors");
                        frappe.show_alert("Sensors fetched and updated successfully!",3);

                    } else {
                        frappe.throw("Enter Valid Vehicle Name – Vehicle ID not found!");
                    }
                }
            });
    }).addClass("btn-primary");
}