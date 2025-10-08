frappe.listview_settings['Delivery Trip'] = {
    add_fields: ["custom_trip_status"],
    get_indicator: function(doc) {
        if (doc.custom_trip_status === "Scheduled") {
            return [__("Scheduled"), "orange", "status,=,Scheduled"];
        }
        if (doc.custom_trip_status === "In-Transit") {
            return [__("In-Transit"), "blue", "status,=,In-Transit"];
        }
        if (doc.custom_trip_status === "Completed") {
            return [__("Completed"), "green", "status,=,Completed"];
        }
    }
};

let globalDoctype = "Delivery Trip";

function extend_listview_event(doctype, event, callback) {
if (!frappe.listview_settings[doctype]) {
frappe.listview_settings[doctype] = {};
}
const old_event = frappe.listview_settings[doctype][event];
frappe.listview_settings[doctype][event] = function (listview) {
if (old_event) {
old_event(listview);
}
callback(listview);
}
}
// ? EXTENDING THE "ONLOAD" EVENT FOR THE SPECIFIED DOCTYPE
extend_listview_event(globalDoctype, "onload", function (listview) {
});