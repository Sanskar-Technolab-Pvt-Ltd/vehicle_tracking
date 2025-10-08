frappe.ui.form.on("Delivery Note", {
    refresh: function(frm) {
        toggle_vehicle_driver(frm);
        if (frm.doc.custom_latitude && frm.doc.custom_longitude){
            showDeliveryLocationOnMap(frm);
        }

    },
    custom_delivery_details: function(frm) {
        toggle_vehicle_driver(frm);
    },
    custom_latitude: function(frm) {
        showDeliveryLocationOnMap(frm);
    },
    custom_longitude: function(frm) {
        showDeliveryLocationOnMap(frm);
    }
});


function showDeliveryLocationOnMap(frm) {
  const latitude = frm.doc.custom_latitude;
  const longitude = frm.doc.custom_longitude;

  if (latitude && longitude) {
    addMarkerToMap(frm, latitude, longitude);
  } else {
    console.log("Latitude or Longitude missing, cannot show location on map.");
  }
}

function addMarkerToMap(frm, latitude, longitude) {
  const mapField = frm.fields_dict["custom_delivery_complete_map"];
  
  // Wait for map to be initialized (GeoLocation fields need this)
  if (!mapField || !mapField.map) {
    console.log("Map not initialized yet. Retrying...");
    setTimeout(() => addMarkerToMap(frm, latitude, longitude), 1000);
    return;
  }

  // Clear existing markers
//   mapField.map.eachLayer(layer => {
//     if (layer instanceof L.Marker) {
//       layer.remove();
//     }
//   });

  // Add a new marker and center map
  console.log(mapField.map)
  mapField.map.setView([latitude, longitude], 19);
  L.marker([latitude, longitude]).addTo(mapField.map);
  
  console.log("Marker added at:", latitude, longitude);
}

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

// function showDeliveryLocationOnMap(frm) {
//   const latitude = frm.doc.custom_latitude;
//   const longitude = frm.doc.custom_longitude;

//   if (latitude && longitude) {
//     initMapWhenReady(frm, latitude, longitude);
//   } else {
//     console.log("Latitude or Longitude missing, cannot show location on map.");
//   }
// }

// function initMapWhenReady(frm, latitude, longitude, attempts = 0) {
//   const mapField = frm.fields_dict["custom_delivery_complete_map"];
//   console.log("====>>>>Mapfield : ",mapField)
//   if (!mapField || !mapField.map) {
//     if (attempts > 10) {
//       console.warn("Map failed to initialize after several attempts.");
//       return;
//     }
//     console.log("Waiting for map to initialize...");
//     setTimeout(() => initMapWhenReady(frm, latitude, longitude, attempts + 1), 500);
//     return;
//   }

//   // Listen for leaflet 'load' event to ensure map tiles and layers are ready
//   mapField.map.once("load", () => {
//     addMarkerToMap(mapField, latitude, longitude);
//   });

//   // Sometimes 'load' doesn't trigger if already loaded
//   if (mapField.map._loaded) {
//     addMarkerToMap(mapField, latitude, longitude);
//   }
// }

// function addMarkerToMap(mapField, latitude, longitude) {
//   // Keep our markers in a persistent layer group
//   if (!mapField.custom_marker_layer) {
//     mapField.custom_marker_layer = L.layerGroup().addTo(mapField.map);
//   }

//   // Clear previous markers
//   mapField.custom_marker_layer.clearLayers();

//   // Add marker
//   L.marker([latitude, longitude]).addTo(mapField.custom_marker_layer);
//   mapField.map.setView([latitude, longitude], 18);

//   console.log("✅ Marker shown at:", latitude, longitude);
// }