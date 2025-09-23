// frappe.ui.form.on("Delivery Trip", {
//     refresh: function (frm) {
//         // First clear existing custom buttons to avoid duplicates
//         frm.clear_custom_buttons();

//         // Show the "Notify Customers via Email" button if doc is submitted
//         if (frm.doc.docstatus == 1 && frm.doc.delivery_stops?.length > 0) {
//             frm.add_custom_button(__("Notify Customers via Email"), function () {
//                 frm.trigger("notify_customers");
//             });
//         }

//         // Only show "Delivery Note" button if in Draft AND Vehicle is selected
//         if (frm.doc.vehicle) {
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
//                             vehicle: frm.doc.vehicle   // <-- pass vehicle into filter
//                         },
//                         get_query_filters: {
//                             docstatus: 1,
//                             company: frm.doc.company,
//                             custom_vehicle_assignes: frm.doc.vehicle, // <-- restrict to selected vehicle
//                             status: ["Not In", ["Completed", "Cancelled"]],
//                         },
//                     });
//                 },
//                 __("Get stops from")
//             );
//         }
//     }
// });
