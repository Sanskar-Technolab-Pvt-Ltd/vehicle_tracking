// function extend_listview_event(doctype, event, callback) {
//     if (!frappe.listview_settings[doctype]) {
//         frappe.listview_settings[doctype] = {};
//     }

//     const old_event = frappe.listview_settings[doctype][event];
//     frappe.listview_settings[doctype][event] = function (listview) {
//         if (old_event) {
//             old_event(listview);
//         }
//         callback(listview);
//     }
// }

// extend_listview_event("Delivery Note", "onload", function (listview) {
//     // Override get_indicator logic to use custom_delivery_status
//     listview.get_indicator = function (doc) {
//         if (doc.custom_delivery_status === "Pending") {
//             return [__("Pending"), "orange", "custom_delivery_status,=,Pending"];
//         } else if (doc.custom_delivery_status === "Completed") {
//             return [__("Completed"), "green", "custom_delivery_status,=,Completed"];
//         } else if (doc.custom_delivery_status === "Cancelled") {
//             return [__("Cancelled"), "red", "custom_delivery_status,=,Cancelled"];
//         } else {
//             return [__(doc.custom_delivery_status || "Draft"), "grey", "custom_delivery_status,=," + (doc.custom_delivery_status || "Draft")];
//         }
//     };
// });

