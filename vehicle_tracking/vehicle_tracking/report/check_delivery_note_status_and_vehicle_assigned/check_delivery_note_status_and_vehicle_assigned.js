// Copyright (c) 2025, sanskar technolab and contributors
// For license information, please see license.txt

frappe.query_reports["Check Delivery Note Status and Vehicle Assigned"] = {
	"filters": [
		{
            fieldname: "delivery_details",
            label: __("Delivery Details"),
            fieldtype: "Select",
            options: ["", "Apex", "Others"],
            default: ""
        }
	],

	onload: function (report) {

		// Reset filters on load
        frappe.query_report.set_filter_value("delivery_details", "");

        // Create Assign Vehicle button (hidden initially)
        if (!report.page.assign_btn) {
            report.page.assign_btn = report.page.add_inner_button(__("Assign Vehicle"), function () {
                let selected = [];
                $(".assign-checkbox:checked").each(function () {
                    selected.push($(this).data("dn"));
                });

                if (selected.length === 0) {
                    frappe.msgprint("Please select at least one Delivery Note");
                    return;
                }

                // Dialog for Vehicle/Driver selection
                let d = new frappe.ui.Dialog({
                    title: "Assign Vehicle",
                    fields: [
                        {
                            label: "Assign Manually",
                            fieldname: "assign_manually",
                            fieldtype: "Check",
                            default: 0
                        },
                        {
                            label: "Vehicle",
                            fieldname: "vehicle",
                            fieldtype: "Link",
                            options: "Vehicle",
                            depends_on: "eval:doc.assign_manually==0"
                        },
                        {
                            label: "Vehicle Name",
                            fieldname: "manual_vehicle",
                            fieldtype: "Data",
                            depends_on: "eval:doc.assign_manually==1"
                        },
                        {
                            label: "Driver Name",
                            fieldname: "driver_name",
                            fieldtype: "Data",
                            depends_on: "eval:doc.assign_manually==1"
                        }
                    ],
                    primary_action_label: "Assign",
                    primary_action(values) {
                        if (values.assign_manually) {
                            // Manual assign
                            if (!values.manual_vehicle || !values.driver_name) {
                                frappe.msgprint("Please enter Vehicle Name and Driver Name");
                                return;
                            }
                            frappe.call({
                                method: "vehicle_tracking.vehicle_tracking.report.check_delivery_note_status_and_vehicle_assigned.check_delivery_note_status_and_vehicle_assigned.assign_vehicle_manually",
                                args: {
                                    delivery_notes: selected,
                                    vehicle_name: values.manual_vehicle,
                                    driver_name: values.driver_name,
                                },
                                callback: function (r) {
                                    if (!r.exc) {
                                        frappe.msgprint("Vehicle & Driver assigned manually!");
                                        frappe.query_report.refresh();
                                    }
                                }
                            });
                        } else {
                            // Normal assign
                            if (!values.vehicle) {
                                frappe.msgprint("Please select a Vehicle");
                                return;
                            }
                            frappe.call({
                                method: "vehicle_tracking.vehicle_tracking.report.check_delivery_note_status_and_vehicle_assigned.check_delivery_note_status_and_vehicle_assigned.assign_vehicle",
                                args: {
                                    delivery_notes: selected,
                                    vehicle: values.vehicle,
                                },
                                callback: function (r) {
                                    if (!r.exc) {
                                        frappe.msgprint("Vehicle assigned successfully!");
                                        frappe.query_report.refresh();
                                    }
                                }
                            });
                        }
                        d.hide();
                    }
                });

                d.show();
            }).addClass("btn-primary");

            // Hide button initially
            report.page.assign_btn.hide();
        }

        // Watch checkbox changes to toggle button
        $(document).on("change", ".assign-checkbox", function () {
            if ($(".assign-checkbox:checked").length > 0) {
                report.page.assign_btn.show();
            } else {
                report.page.assign_btn.hide();
            }
        });
    },
	
	
	get_datatable_options(options) {
        let delivery_filter = frappe.query_report.get_filter_value("delivery_details");

        // If filter == Apex → remove "Select" column
        if (delivery_filter === "Apex") {
            options.columns = options.columns.filter(c => c.fieldname !== "select_checkbox");
        }

        return options;
	},


	formatter: function (value, row, column, data, default_formatter) {
        let delivery_filter = frappe.query_report.get_filter_value("delivery_details");

        // Render checkbox only if filter != Apex and column is "select_checkbox"
        if (column.fieldname === "select_checkbox" && 
			delivery_filter !== "Apex" && 
			(!data.custom_vehicle_assigned && !data.custom_driver_assigned)) 
		{
            return `<input type="checkbox" class="assign-checkbox" data-dn="${data.name}">`;
        }

        return default_formatter(value, row, column, data);
    }
};