frappe.listview_settings['Delivery Note'] = {
    add_fields: ["custom_delivery_status"],
    get_indicator: function(doc) {
        if (doc.custom_delivery_status === "Pending") {
            return [__("Pending"), "grey", "status,=,Pending"];
        }
        if (doc.custom_delivery_status === "Completed") {
            return [__("Completed"), "green", "status,=,Completed"];
        }
    }
};

let globalDoctype = "Delivery Note";

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