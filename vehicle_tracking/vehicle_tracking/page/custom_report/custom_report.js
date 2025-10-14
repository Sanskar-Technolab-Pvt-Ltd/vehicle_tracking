frappe.require([
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"
], function() {
    console.log("Libraries loaded successfully");
});

frappe.pages['custom-report'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '',
        single_column: true
    });

    page.set_primary_action("Refresh", function () {
    refreshPage();
    }, "refresh");

    // Render the HTML template
    $(frappe.render_template("custom_report", {})).appendTo(page.main);

    // Initialize everything *after* DOM is ready
    initCustomReportPage();

    function initCustomReportPage() {
        loadResources();
        loadVehicles();
        setDefaultDates();

        // When resource changes, load templates
        $(document).on("change", "#resource-select", function () {
            loadTemplates();

        });

        // Handle Execute Report button
        $(document).on("click", "#execute-report", function () {
            executeReport();
        });

        // Clear results
        $(document).on("click", "#clear-result", function () {
            clearReport();
            // $("#result-area").empty();
        });
    }

    // Refersh Page Function
    function refreshPage() {
    // Clear all inputs and results
    $("#resource-select").val("");
    $("#template-select").empty();
    $("#vehicle-select").val("");
    $("#from-date").val("");
    $("#to-date").val("");
    $("#result-area").empty();
    $("#log").empty();

    // Reload dropdowns
    loadResources();
    loadVehicles();
    setDefaultDates()
}
    function setDefaultDates() {
    let today = new Date();
    let yyyy = today.getFullYear();
    let mm = String(today.getMonth() + 1).padStart(2, '0'); // Months start at 0
    let dd = String(today.getDate()).padStart(2, '0');

    // From Date = today 00:00
    let fromDate = `${yyyy}-${mm}-${dd}T00:00`;
    // To Date = today 23:59
    let toDate = `${yyyy}-${mm}-${dd}T23:59`;

    $("#from-date").val(fromDate);
    $("#to-date").val(toDate);
}

    // Load Resources
    function loadResources() {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Resources",
                fields: ["name"]
            },
            callback: function (r) {
                let resourceSelect = $("#resource-select");
                resourceSelect.empty();

                if (r.message && r.message.length > 0) {
                    r.message.forEach(res => {
                        resourceSelect.append(`<option value="${res.name}">${res.name}</option>`);
                    });
                    loadTemplates(); // Load templates for first resource
                } else {
                    resourceSelect.append('<option value="">No Resources Found</option>');
                }
            }
        });
    }

    // Load Templates
    function loadTemplates() {
        let resource = $("#resource-select").val();
        console.log("Selected resource:", resource);

        if (!resource) {
            $("#template-select").empty().append('<option value="">No Templates Found</option>');
            return;
        }

        frappe.call({
            method: "vehicle_tracking.vehicle_tracking.page.custom_report.custom_report.get_template_name",
            args: { resource: resource },
            callback: function (r) {
                let templateSelect = $("#template-select");
                templateSelect.empty();

                if (r.message && r.message.length > 0) {
                    r.message.forEach(t => {
                        templateSelect.append(`<option value="${t}">${t}</option>`);
                    });
                } else {
                    templateSelect.append('<option value="">No Templates Found</option>');
                }
            }
        });
    }

    // Load Vehicles
    function loadVehicles() {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Vehicle",
                fields: ["name"],
                limit_page_length: 0
            },
            callback: function (r) {
                let vehicleSelect = $("#vehicle-select");
                vehicleSelect.empty();

                if (r.message && r.message.length > 0) {
                    r.message.forEach(v => {
                        vehicleSelect.append(`<option value="${v.name}">${v.name}</option>`);
                    });
                } else {
                    vehicleSelect.append('<option value="">No Vehicles Found</option>');
                }
            }
        });
    }

    // Execute Report
    function executeReport() {
        let resource = $("#resource-select").val();
        let template = $("#template-select").val();
        let vehicle = $("#vehicle-select").val();
        let from_date = $("#from-date").val();
        let to_date = $("#to-date").val();

        console.log("Execute clicked:", { resource, template, vehicle, from_date, to_date });

        if (!from_date || !to_date) {
            frappe.msgprint("Please select From and To Date");
            return;
        }

        $("#loader").show();
        $("#result-area").empty();

        let executeBtn = $("#execute-report");
        executeBtn.prop("disabled", true);

        frappe.call({
            
            method: "vehicle_tracking.vehicle_tracking.page.custom_report.custom_report.get_report_result",
            args: {
                resource: resource,
                template: template,
                unit: vehicle,
                start: from_date,
                end: to_date
            },
            callback: function (r) {
                console.log("API Response:", r);
                $("#loader").hide();
                executeBtn.prop("disabled", false);

                if (r.message) {
                    let reportData = r.message;
                    renderReport(reportData);

                    frappe.show_alert({
						message: 'Report executed successfully!',
						indicator: 'green',  
						duration: 3         
					});
                    $("#log").text("Report executed successfully.");
                    // $("#result-area").html(`<pre>${JSON.stringify(r.message, null, 2)}</pre>`);
                } else {
                    $("#log").text("No data returned from report.");
                }
            },
            error: function (err) {
                console.error("Error:", err);
                $("#log").text("Error while executing report. Check console.");
            }
        });
    }

    // Helper: Render report buttons + tables
    function renderReport(reportData) {

        let containerHtml = `
                <div id="table-buttons-container" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <div id="table-buttons">
                        ${Object.keys(reportData).map(tableName => `
                            <button class="btn btn-sm btn-secondary table-btn" data-table="${tableName}">
                                ${tableName}
                            </button>
                        `).join('')}
                    </div>
                    <div id="export-dropdown" class="dropdown">
                        <button class="btn btn-primary btn-sm dropdown-toggle" type="button" data-toggle="dropdown">
                            Export
                        </button>
                        <div class="dropdown-menu dropdown-menu-right">
                            <a class="dropdown-item" href="#" data-format="xlsx">XLSX</a>
                            <a class="dropdown-item" href="#" data-format="pdf">PDF</a>
                        </div>
                    </div>
                </div>
                <div id="table-container"></div>
            `;

            $("#result-area").html(containerHtml);


        let firstTable = Object.keys(reportData)[0];
        renderTable(firstTable);

        $(".table-btn").on("click", function () {
            $(".table-btn").removeClass("active");
            console.log("this selected button ============>>>>>>>",$(".table-btn"))
            $(this).addClass("active");
            let selectedTable = $(this).data("table");
            renderTable(selectedTable);
        });

        function renderTable(tableName) {
            let tableInfo = reportData[tableName];
            if (!tableInfo || !tableInfo.colums || !tableInfo.rows) return;

            let tableRowsHtml = tableInfo.rows.map(row => `
                <tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>
            `).join("");
            let tableHtml = `
                <h5 style="margin-top:4px;">${tableName}</h5>
                <div class="table-scroll-vertical">
                    <table class="table table-bordered table-sm">
                        <thead>
                            <tr style = "font-size=12px;">
                                ${tableInfo.colums.map(col => `<th>${col}</th>`).join("")}
                            </tr>
                        </thead>
                        <tbody style="font-size=12px;">
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>
            `;

            $("#table-container").html(tableHtml);

        }
        // ✅ Excel export function
    function exportTableToExcel(table, filename = 'report.xlsx') {
        let wb = XLSX.utils.book_new();
        let ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, filename);
        }

        function exportTableToPDF(table, filename = 'report.pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: 'a4'
        });

        // Add title
        doc.setFontSize(14);
        // doc.text("Custom Report", 40, 40);

        // Convert HTML table to PDF using autoTable
        doc.autoTable({
            html: table,
            startY: 60,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        // Save file
        doc.save(filename);
    }

    // ✅ Handle Export Clicks
    $(document).on("click", "#export-dropdown .dropdown-item", function (e) {
        e.preventDefault();
        let format = $(this).data("format");
        let tableEl = $("#table-container table")[0]; // Currently displayed table
        let tableName = $(".table-btn.active").text() || firstTable;

        if (!tableEl) {
            frappe.msgprint("No table to export!");
            return;
        }

        let vehicle_name = $("#vehicle-select").val()
        let template_name = $("#template-select").val()
        let fileBase = `${vehicle_name}_${template_name}`;

        // ✅ Print data for debugging
        console.log("Exporting table:", tableName);
        console.log("Table element:", tableEl);
        console.log("Table HTML:", tableEl.outerHTML);

        if (format === "xlsx") {
            
            exportTableToExcel(tableEl, `${fileBase}.xlsx`);
        } 
        else if (format === "pdf") {
            console.log("PDF start....")
            exportTableToPDF(tableEl, `${fileBase}.pdf`);
            console.log("pdf stop")
        }
    });

    }

    // Clear Report Result
    function clearReport() {
    frappe.call({
        method: "vehicle_tracking.vehicle_tracking.page.custom_report.custom_report.clean_up_result",
        callback: function (r) {
            // Always clear UI first
            $("#result-area").empty();
            $("#log").empty();


            // Check API response
            if (r.message && r.message.error === 0) {
                frappe.show_alert({
                    message: "Report cleared successfully!",
                    indicator: "green",
                    duration: 3
                });
                // $("#result-area").html(`<pre>${JSON.stringify(r.message, null, 2)}</pre>`);
            } else {
                frappe.show_alert({
                    message: "Error in report clearing!",
                    indicator: "red",
                    duration: 3
                });
                $("#log").text("Report is not being Cleared. Please Refersh the page");
            }
        },
        error: function (err) {
            console.error("Error:", err);
            frappe.show_alert({
                message: "Error while calling cleanup API.",
                indicator: "red",
                duration: 3
            });
        }
    });
}

};
