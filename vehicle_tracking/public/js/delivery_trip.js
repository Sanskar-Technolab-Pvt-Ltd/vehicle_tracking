frappe.ui.form.on("Delivery Trip", {
    refresh: function (frm) {

        //  Remove default empty row in Delivery Stops
        if (frm.doc.delivery_stops && frm.doc.delivery_stops.length === 1) {
            const row = frm.doc.delivery_stops[0];

            if (!row.customer && !row.delivery_note && !row.location) {
                frm.clear_table("delivery_stops");
                frm.refresh_field("delivery_stops");
            }
        }
        // Always remove the default button first
        frm.remove_custom_button("Delivery Note", "Get stops from");

        // Show custom button only if docstatus = 0 AND vehicle is set
        if (frm.doc.docstatus === 0 && frm.doc.vehicle) {
            add_delivery_note_button(frm);
        }
        // console.log("Referesh..........")
        // Weight Validation
        check_weight_capacity(frm);
    },

    vehicle: function (frm) {
        // console.log("Vehicle Change..........")
        // Whenever vehicle is selected/changed, re-render the button
        frm.remove_custom_button("Delivery Note", "Get stops from");

        if (frm.doc.docstatus === 0 && frm.doc.vehicle) {
            console.log("fvrdfvcd", frm.doc.vehicle)
            add_delivery_note_button(frm);
        }

        // Weight Validation
        check_weight_capacity(frm);
    },

    delivery_stops_add: function (frm) {
        // console.log("Add stops..........")
        // validate when row added
        check_weight_capacity(frm);
    },

    delivery_stops_remove: function (frm) {
        // console.log("Remove stop..........")
        // validate when row removed
        check_weight_capacity(frm);
    },
});

function add_delivery_note_button(frm) {
    console.log("Vehicle name", frm.doc.vehicle)
    frappe.call({
        method: "vehicle_tracking.vehicle_tracking.apis.delivery_trip_utils.get_used_delivery_notes",
        args: {
            custom_vehicle_assigned: frm.doc.vehicle
        },
        callback: function (r) {

            let used_dn = r.message || [];
            console.log("used_dn", used_dn)
            frm.add_custom_button(
                __("Delivery Note"),
                () => {
                    console.log("calling")

                    erpnext.utils.map_current_doc({
                        method: "erpnext.stock.doctype.delivery_note.delivery_note.make_delivery_trip",
                        source_doctype: "Delivery Note",
                        target: frm,
                        date_field: "posting_date",
                        setters: {
                            company: frm.doc.company,
                            customer: null,
                        },
                        get_query_filters: {
                            docstatus: 1,
                            company: frm.doc.company,
                            custom_vehicle_assigned: frm.doc.vehicle,
                            status: ["Not In", ["Cancelled"]],
                            custom_delivery_status: ["Not In", ["Completed",]],
                            name: ["in", used_dn]
                        },

                    });
                },
                __("Get stops from")
            );
            auto_fill_locations(frm);
            // check_weight_capacity(frm);
        }
    });
}

// -------------------------------------------------------
// LOGIC: AUTO-FILL LOCATION FOR EACH STOP
// -------------------------------------------------------
function auto_fill_locations(frm) {

    if (!frm.doc.delivery_stops) return;
    frm.doc.delivery_stops.forEach(row => {
        if (!row.delivery_note) return;
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Delivery Note",
                name: row.delivery_note
            },
            callback: function (r) {
                if (!r.message) return;

                row.custom_location = r.message.custom_location || "";

                frm.refresh_field("delivery_stops");
            }
        });
    });
}

// -------------------------------------------------------
// WEIGHT VALIDATION
// -------------------------------------------------------
function check_weight_capacity(frm) {
    if (!frm.doc.vehicle) return;

    frappe.call({
        method: "vehicle_tracking.vehicle_tracking.apis.delivery_trip_utils.check_weight_capacity",
        args: {
            vehicle: frm.doc.vehicle,
            stops: frm.doc.delivery_stops
        },
        callback: function (r) {
            if (!r.message) return;
            // console.log("==========>>> Weight validation Result :",r.message)
            if (r.message.total_weight > r.message.vehicle_capacity) {
                frappe.msgprint({
                    title: "Vehicle Weight Capacity Warning",
                    message: `
                        <b>Total Delivery Weight:</b> ${r.message.total_weight} kg<br> <b>Vehicle Capacity:</b> ${r.message.vehicle_capacity} kg 
                        Please remove some Delivery Notes.
                    `,
                    indicator: "red"
                });
            }
        }
    });
}