// frappe.ui.form.on("Delivery Trip", {
//     refresh: function (frm) {
//         // Remove the default button
//         frm.remove_custom_button("Delivery Note", "Get stops from");

//         if (frm.doc.docstatus === 0) {
//             frm.add_custom_button(
//                 __("Delivery Note"),
//                 () => {
//                     erpnext.utils.map_current_doc({
//                         method: "erpnext.stock.doctype.delivery_note.delivery_note.make_delivery_trip",
//                         source_doctype: "Delivery Note",
//                         target: frm,
//                         date_field: "posting_date",
//                         setters: {
//                             company: frm.doc.company,
//                             customer: null,
//                         },
//                         // 👇 Your custom filters here
//                         get_query_filters: {
//                             docstatus: 1,
//                             company: frm.doc.company,
//                             custom_vehicle_assigned:frm.doc.vehicle,
//                             status:["Not In", ["Cancelled"]],
//                             custom_delivery_status: ["Not In", ["Completed",]],  
//                         },
//                     });
//                 },
//                 __("Get stops from")
//             );
//         }
//     },
// });
frappe.ui.form.on("Delivery Trip", {
    refresh: function (frm) {
        // Always remove the default button first
        frm.remove_custom_button("Delivery Note", "Get stops from");

        // Show custom button only if docstatus = 0 AND vehicle is set
        if (frm.doc.docstatus === 0 && frm.doc.vehicle) {
            add_delivery_note_button(frm);
        }
    },

    vehicle: function (frm) {
        // Whenever vehicle is selected/changed, re-render the button
        frm.remove_custom_button("Delivery Note", "Get stops from");

        if (frm.doc.docstatus === 0 && frm.doc.vehicle) {
            add_delivery_note_button(frm);
        }
    },
});

function add_delivery_note_button(frm) {
    frm.add_custom_button(
        __("Delivery Note"),
        () => {
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
                    custom_vehicle_assigned:frm.doc.vehicle,
                    status:["Not In", ["Cancelled"]],
                    custom_delivery_status: ["Not In", ["Completed",]],
                },
            });
        },
        __("Get stops from")
    );
}
