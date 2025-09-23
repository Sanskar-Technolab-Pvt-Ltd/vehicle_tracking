frappe.ui.form.on("Delivery Note", {
    refresh: function(frm) {
        toggle_vehicle_driver(frm);
    },
    custom_delivery_details: function(frm) {
        toggle_vehicle_driver(frm);
    },
    
});

function toggle_vehicle_driver(frm) {
    if (!frm.doc.custom_delivery_details) {
        // If field empty → hide both
        frm.set_df_property("custom_vehicle_assigned", "hidden", 1);
        frm.set_df_property("custom_driver_assigned", "hidden", 1);

    } else if (frm.doc.custom_delivery_details === "Apex") {
        // Show + editable
        frm.set_df_property("custom_vehicle_assigned", "hidden", 0);
        frm.set_df_property("custom_vehicle_assigned", "read_only", 0);
        frm.set_df_property("custom_driver_assigned", "hidden", 0);
        frm.set_df_property("custom_driver_assigned", "read_only", 0);
    } else {
        // Show + read-only
        frm.set_df_property("custom_vehicle_assigned", "hidden", 0);
        frm.set_df_property("custom_vehicle_assigned", "read_only", 1);
        frm.set_df_property("custom_driver_assigned", "hidden", 0);
        frm.set_df_property("custom_driver_assigned", "read_only", 1);
    }
}
