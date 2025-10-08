// Copyright (c) 2025, sanskar technolab and contributors
// For license information, please see license.txt
frappe.ui.form.on("Vehicle Ignition Status", {
    validate: function(frm) {
        if (frm.doc.name) {
            frappe.db.get_value("Vehicle",
                { custom_vehicle_id: frm.doc.name },
                "name"
            ).then(r => {
                if (r.message) {
                    frm.set_value("vehicle_name", r.message.name);
                }
            });
        }
    }
});