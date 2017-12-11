let osm = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20,
  attribution: 'Map data Â© <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
  detectRetina: true
});

let carto = new L.TileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
  maxZoom: 20,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
});

let googleStreets = new L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

let googleHybrid = new L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

let googleSat = new L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

let googleTerrain = new L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

let igk = new L.tileLayer('./tiles/{z}/{x}/{y}.png', {
  attribution: '© IGK',
  maxZoom: 20
});


let baseLayers = {
  "OSM Carto": carto,
  "OSM": osm,
  "googleStreets": googleStreets,
  "googleHybrid": googleHybrid,
  "googleSat": googleSat,
  "googleTerrain": googleTerrain
};

let overlays = {
  "IGC": igk
};
igk.setZIndex(99);

let map = L.map('map', {
  center: [48.82597, 2.20487],
  zoom: 14,
  zoomControl: true,
  zoomSnap: 0.5,
  layers: [googleSat, igk]
});


L.control.locate({
  strings: {
    title: "Locate me"
  }
}).addTo(map);

L.control.layers(baseLayers, overlays).addTo(map);

var opacitySlider = new L.Control.opacitySlider();
map.addControl(opacitySlider);
opacitySlider.setOpacityLayer(igk);


map.on("contextmenu", function (event) {
  console.log("user right-clicked on map coordinates: " + event.latlng.toString());
  // L.marker(event.latlng).addTo(map);
});


