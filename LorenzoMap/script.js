/* jshint esversion: 6, asi: true */

// Mapbox access token
L.mapbox.accessToken = 'pk.eyJ1Ijoiam9pbmVkIiwiYSI6ImNqMGdoNHJvODAwMXkycW1qNno5Nmh0ZDUifQ.umfdxK36OL4yvBpYNTyrGA'

// Global constants
const amsCenterCoords = [52.3702, 4.8952] // Coordinates of the center of Amsterdam
const mapBounds = [[52.2781742, 4.7292418], [52.4310638, 5.0791622]] // Bounding box of the city of Amsterdam
const initialZoom = 13 // Initial zoom level
const minZoom = 11 // Minimum zoom level
const maxZoom = 17 // Maximum zoom level
const mapContainerId = 'map' // Id of the element where the map should be placed
const positiveColor = '#8BC34A' // Color for the positive tweets
const neutralColor = '#9E9E9E' // Color for the neutral tweets
const negativeColor = '#F44336' // Color for the negative tweets
const mapStyle = 'mapbox://styles/mapbox/dark-v9'
const clusteringRadius = 70 // Maximum radius for clustering
const tweetsFile = 'amsterdam_tweets.geojson'
const tweetMarkerRadius = 8 // Radius of the marker of a single tweet

// Map creation
const map = L.mapbox.map('map', 'mapbox.streets', {
  container: mapContainerId,
  center: amsCenterCoords,
  zoom: initialZoom,
  minZoom: minZoom,
  maxZoom: maxZoom,
  maxBounds: mapBounds
})

// Add custom style over map
L.mapbox.styleLayer(mapStyle).addTo(map)

/**
 * Given the donut properties, create it
 * and return the rendered HTML
 */
function bakeTheDonut (properties) {
  // Compute the center of the icon
  let center = properties.iconSize / 2
  // Create the SVG element
  let svgElement = document.createElementNS(d3.namespaces.svg, 'svg')

  let svg = d3.select(svgElement)
    .attr('width', properties.iconSize)
    .attr('height', properties.iconSize)

  // Scale Sentiment -> Color
  let color = d3.scaleOrdinal([positiveColor, neutralColor, negativeColor])
    .domain(['positive', 'neutral', 'negative'])

  // Scale for the donut, using the count property of the 
  // sentiments to determine the percentages
  let pie = d3.pie()
    .sort(null)
    .value((d) => d.count)

  let path = d3.arc()
    .outerRadius(properties.outerRadius)
    .innerRadius(properties.innerRadius)

  let g = svg.append('g')
    .attr('transform', `translate(${properties.iconSize / 2},${properties.iconSize / 2})`)

  let arc = g.selectAll('.arc')
    .data(pie(properties.sentiments))
    .enter().append('g')
      .attr('class', 'arc')

  arc.append('path')
    .attr('d', path)
    .attr('fill', (d) => color(d.data.type))

  svg.append('text')
    .attr('x', center)
    .attr('y', center)
    .attr('class', properties.pieLabelClass)
    .attr('text-anchor', 'middle')
    .attr('dy', '.3em')
    .text(properties.pieLabel)

  return svgElement.outerHTML
}

/**
 * Custom icon creator for the cluster markers
 */
function iconCreator (cluster) {
  const childMarkers = cluster.getAllChildMarkers()
  const numberChilds = childMarkers.length
  const radiusMax = 22
  // Dynamic radius basing on the number of childs of the cluster
  const radius = radiusMax - (numberChilds < 10 ? 8 : numberChilds < 100 ? 6 : numberChilds < 1000 ? 4 : 0)
  // Thickness of the ring
  const ringThickness = 6
  const iconSize = radius * 2
  const pieLabelClass = 'marker-cluster-label'

  // Compute number of positive, neutral and negative tweets
  let positive = 0
  let neutral = 0
  let negative = 0

  for (let marker of childMarkers) {
    let sentiment = marker.feature.properties.sentiment
    if (sentiment > 0) { positive++ } else if (sentiment < 0) { negative++ } else { neutral++ }
  }

  let markerHtml = bakeTheDonut({
    sentiments: [
      {'type': 'positive', 'count': positive},
      {'type': 'neutral', 'count': neutral},
      {'type': 'negative', 'count': negative}
    ],
    outerRadius: radius,
    innerRadius: radius - ringThickness,
    pieLabel: numberChilds,
    pieLabelClass: pieLabelClass,
    iconSize: iconSize
  })

  return L.divIcon({
    html: markerHtml,
    iconSize: [iconSize, iconSize],
    className: 'marker-cluster-icon'
  })
}

// Marker clustering
const markers = new L.MarkerClusterGroup({
  maxClusterRadius: clusteringRadius,
  showCoverageOnHover: true,
  iconCreateFunction: iconCreator
})

// Load the tweets asynchronously and add them to the map
$.getJSON(tweetsFile, function (tweets) {
  const geoJsonLayer = L.geoJson(tweets, {
    pointToLayer: (feature, latlng) => {
      const sentiment = feature.properties.sentiment

      let color
      if (sentiment > 0) { color = positiveColor } else if (sentiment < 0) { color = negativeColor } else { color = neutralColor }

      return L.circleMarker(latlng, { radius: tweetMarkerRadius, color: color })
    },
    onEachFeature: (feature, layer) => layer.bindPopup(feature.properties.text)
  })

  markers.addLayer(geoJsonLayer)
  map.addLayer(markers)
})
