import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getApiBaseUrl } from '../../src/config/network';

export type MapLatLng = { latitude: number; longitude: number };

export type MapDestination = MapLatLng & {
  kind: 'pickup' | 'stop' | 'dropoff';
  label?: string;
};

type LiveMapProps = {
  driverLocation?: MapLatLng | null;
  riderLocation?: MapLatLng | null;
  route?: MapLatLng[] | null;
  destinations?: MapDestination[];
  darkMode?: boolean;
  height?: number | '100%';
  rounded?: boolean;
  followDriver?: boolean;
};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function resolveIconUrl(icon: string): string {
  try {
    const base = getApiBaseUrl().replace(/\/api\/?$/, '');
    return `${base}/map-icons/${icon}`;
  } catch {
    return `/map-icons/${icon}`;
  }
}

const DRIVER_ICON_URL = resolveIconUrl('car-online.png');

const DESTINATION_STYLES: Record<MapDestination['kind'], { bg: string; label: string }> = {
  pickup: { bg: '#22c55e', label: 'P' },
  stop: { bg: '#f59e0b', label: 'S' },
  dropoff: { bg: '#ef4444', label: 'D' },
};

function pinSvg(color: string, letter: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 1.3C7.9 1.3 4.5 4.7 4.5 8.9c0 4.9 7.5 13.3 7.5 13.3s7.5-8.4 7.5-13.3c0-4.2-3.4-7.6-7.5-7.6z" fill="${color}" stroke="#ffffff" stroke-width="1.3"/><circle cx="12" cy="8.9" r="3.4" fill="#ffffff"/><text x="12" y="10.7" text-anchor="middle" font-size="5.5" font-weight="700" font-family="sans-serif" fill="${color}">${letter}</text></svg>`;
}

const RIDER_MARKER_COLOR = '#2563eb';
const RIDER_MARKER_BORDER = '#374151';

type HtmlState = {
  driver: [number, number] | null;
  rider: [number, number] | null;
  route: [number, number][];
  destinations: Array<{ lat: number; lng: number; kind: string; label?: string }>;
  followDriver: boolean;
  darkMode: boolean;
};

function buildHtml(initial: HtmlState, darkMode: boolean) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET_CSS}" />
<script src="${LEAFLET_JS}"></script>
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e5e7eb; }
  body.dark #map { background: #0f172a; }
  body.dark .leaflet-tile { filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.55); }
  body.dark .leaflet-control-attribution { background: rgba(15, 23, 42, 0.7); color: #94a3b8; }
  body.dark .leaflet-control-attribution a { color: #cbd5e1; }
  .fallback { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; color: #64748b; text-align: center; padding: 24px; }
  .fallback strong { margin-bottom: 6px; }
</style>
</head>
<body class="${darkMode ? 'dark' : ''}">
<div id="map"></div>
<script>
(function () {
  var INITIAL = ${JSON.stringify(initial)};
  var DEST_STYLES = ${JSON.stringify(DESTINATION_STYLES)};
  var TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var DRIVER_ICON_URL = ${JSON.stringify(DRIVER_ICON_URL)};
  var RIDER_MARKER_COLOR = ${JSON.stringify(RIDER_MARKER_COLOR)};
  var RIDER_MARKER_BORDER = ${JSON.stringify(RIDER_MARKER_BORDER)};

  // أيقونة المستخدم: أزرق بحدود رمادية غامقة، والتوهج الأزرق يُطبق كـ drop-shadow
  function personSvg(color, border) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.2" fill="' + color + '" stroke="' + border + '" stroke-width="2.4"/><circle cx="12" cy="8.6" r="2.9" fill="#ffffff"/><path d="M5.7 18.3c0-3.1 2.8-5.2 6.3-5.2s6.3 2.1 6.3 5.2" fill="#ffffff"/></svg>';
  }

  var map = null;
  var driverMarker = null;
  var driverImg = null;
  var riderMarker = null;
  var prevDriverLatLng = null;
  var driverRotation = 0;
  var DRIVER_BASE_SIZE = 58;
  var driverSize = DRIVER_BASE_SIZE;
  var routeLayer = null;
  var currentRoutePoints = [];
  var destLayer = null;
  var followDriver = INITIAL.followDriver !== false;
  var wasFollowing = followDriver;
  var autoFit = true;
  var fittingNow = false;
  var MAX_FIT_ZOOM = 18;
  var DRIVER_VIEW_ZOOM = 16;
  var RECENTER_DELAY = 30000; // 30s — auto-return to the driver after a manual pan
  var recenterTimer = null;

  function scheduleRecenter() {
    if (recenterTimer) clearTimeout(recenterTimer);
    recenterTimer = setTimeout(function () {
      recenterTimer = null;
      followDriver = true;
      wasFollowing = true;
      resetToDriver();
    }, RECENTER_DELAY);
  }

  function cancelRecenter() {
    if (recenterTimer) {
      clearTimeout(recenterTimer);
      recenterTimer = null;
    }
  }

  function zoomScale(z) { return Math.min(1.7, Math.max(0.7, 1 + (z - 14) * 0.09)); }

  function bearing(a, b) {
    var toRad = function (d) { return d * Math.PI / 180; };
    var p1 = toRad(a.lat), p2 = toRad(b.lat), dl = toRad(b.lng - a.lng);
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function updateDriverIcon() {
    if (!driverImg) return;
    driverImg.style.width = driverSize + 'px';
    driverImg.style.height = driverSize + 'px';
    driverImg.style.transform = 'rotate(' + driverRotation + 'deg)';
    driverImg.style.transformOrigin = 'center center';
    driverImg.style.transition = 'transform 0.5s ease';
  }

  function setTheme(dark) {
    var body = document.body;
    if (dark) body.classList.add('dark'); else body.classList.remove('dark');
  }

  function initMap() {
    map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView(INITIAL.driver || [55.6761, 12.5683], 15);
    setTheme(document.body.classList.contains('dark'));
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // "My location" button — recenters on the driver and re-enables follow
    var locateControl = L.control({ position: 'topright' });
    locateControl.onAdd = function () {
      var btn = L.DomUtil.create('button', '');
      btn.type = 'button';
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="7" stroke="#374151" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="#f97316"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#374151" stroke-width="2" stroke-linecap="round"/></svg>';
      btn.style.cssText = 'width:36px;height:36px;background:#fff;border:2px solid rgba(0,0,0,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;padding:0;';
      L.DomEvent.disableClickPropagation(btn);
      btn.addEventListener('click', function () {
        cancelRecenter();
        followDriver = true;
        wasFollowing = true;
        resetToDriver();
      });
      return btn;
    };
    locateControl.addTo(map);

    map.on('dragstart', function () {
      followDriver = false;
      if (!fittingNow) autoFit = false;
      scheduleRecenter();
    });
    map.on('zoomstart', function () {
      if (!fittingNow) autoFit = false;
    });
    map.on('zoomend', function () {
      driverSize = Math.round(DRIVER_BASE_SIZE * zoomScale(map.getZoom()));
      updateDriverIcon();
    });
  }

  function setDriver(lat, lng) {
    if (!map) return;
    var newPos = L.latLng(lat, lng);
    if (driverMarker) {
      if (prevDriverLatLng && prevDriverLatLng.distanceTo(newPos) > 0.008) {
        driverRotation = bearing(prevDriverLatLng, newPos);
      }
      driverMarker.setLatLng(newPos);
      updateDriverIcon();
    } else {
      driverMarker = L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: DRIVER_ICON_URL,
          iconSize: [DRIVER_BASE_SIZE, DRIVER_BASE_SIZE],
          iconAnchor: [DRIVER_BASE_SIZE / 2, DRIVER_BASE_SIZE / 2]
        })
      }).addTo(map);
      driverImg = driverMarker.getElement().querySelector('img');
      if (driverImg) {
        driverImg.style.filter = 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))';
      }
      updateDriverIcon();
    }
    prevDriverLatLng = newPos;
    if (followDriver) {
      map.panTo([lat, lng], { animate: true, duration: 0.4 });
    }
  }

  function setRoute(points) {
    if (!map) return;
    currentRoutePoints = points && points.length ? points : [];
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    if (currentRoutePoints.length > 1) {
      routeLayer = L.layerGroup([
        L.polyline(currentRoutePoints, { color: '#1f2937', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }),
        L.polyline(currentRoutePoints, { color: '#f97316', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' })
      ]).addTo(map);
    }
  }

  function setDestinations(dests) {
    if (!map) return;
    if (destLayer) { map.removeLayer(destLayer); destLayer = null; }
    if (dests && dests.length) {
      destLayer = L.layerGroup().addTo(map);
      dests.forEach(function (d) {
        var style = DEST_STYLES[d.kind] || { bg: '#64748b', label: '?' };
        L.marker([d.lat, d.lng], {
          icon: L.divIcon({
            className: '',
            html: '<img src="data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(pinSvg(style.bg, style.label)) + '" style="display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));width:30px;height:30px;"/>',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
          }),
          title: d.label || d.kind
        }).addTo(destLayer);
      });
    }
  }

  function resetToDriver() {
    if (!map || !driverMarker) return;
    fittingNow = true;
    map.flyTo(driverMarker.getLatLng(), DRIVER_VIEW_ZOOM, { animate: true, duration: 0.8 });
    setTimeout(function () { fittingNow = false; }, 900);
  }

  function setRider(lat, lng) {
    if (!map) return;
    if (riderMarker) {
      riderMarker.setLatLng([lat, lng]);
    } else {
      riderMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<img src="data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(personSvg(RIDER_MARKER_COLOR, RIDER_MARKER_BORDER)) + '" style="display:block;width:32px;height:32px;filter:drop-shadow(0 0 6px rgba(37,99,235,0.7)) drop-shadow(0 1px 3px rgba(0,0,0,0.35));"/>',
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        }),
        title: 'Rider'
      }).addTo(map);
    }
  }

  function clearRider() {
    if (!map) return;
    if (riderMarker) {
      map.removeLayer(riderMarker);
      riderMarker = null;
    }
  }

  function fitRemainingRoute() {
    if (!map) return;
    var bounds = [];
    if (driverMarker) bounds.push(driverMarker.getLatLng());
    if (currentRoutePoints.length > 0) {
      var latlngs = currentRoutePoints.map(function (p) { return L.latLng(p[0], p[1]); });
      var nearestIdx = 0;
      var nearestDist = Infinity;
      for (var i = 0; i < latlngs.length; i++) {
        var d = latlngs[i].distanceTo(driverMarker.getLatLng());
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }
      for (var j = Math.max(0, nearestIdx); j < latlngs.length; j++) {
        bounds.push(latlngs[j]);
      }
    }
    if (destLayer) destLayer.eachLayer(function (l) { bounds.push(l.getLatLng()); });
    if (bounds.length > 1) {
      fittingNow = true;
      map.fitBounds(L.latLngBounds(bounds), {
        maxZoom: MAX_FIT_ZOOM,
        animate: true,
        duration: 0.4,
        paddingTopLeft: [60, 70],
        paddingBottomRight: [60, 200]
      });
      setTimeout(function () { fittingNow = false; }, 600);
    }
  }

  if (typeof L === 'undefined') {
    document.getElementById('map').innerHTML =
      '<div class="fallback"><strong>Map unavailable</strong>Failed to load the map library. Check your internet connection.</div>';
    return;
  }

  initMap();
  if (INITIAL.driver) setDriver(INITIAL.driver[0], INITIAL.driver[1]);
  if (INITIAL.rider) setRider(INITIAL.rider[0], INITIAL.rider[1]);
  if (INITIAL.route && INITIAL.route.length) setRoute(INITIAL.route);
  if (INITIAL.destinations && INITIAL.destinations.length) setDestinations(INITIAL.destinations);
  if (INITIAL.driver || (INITIAL.route && INITIAL.route.length) || (INITIAL.destinations && INITIAL.destinations.length)) {
    fitRemainingRoute();
  }

  window.applyState = function (state) {
    if (state.darkMode !== undefined) setTheme(!!state.darkMode);
    if (state.followDriver !== undefined) {
      var newFollow = !!state.followDriver;
      var justEnabled = newFollow && !wasFollowing;
      followDriver = newFollow;
      wasFollowing = newFollow;
      if (justEnabled) {
        cancelRecenter();
        resetToDriver();
      }
    }
    if (state.fit) autoFit = true;
    if (state.driver) setDriver(state.driver[0], state.driver[1]);
    if (state.rider !== undefined) {
      if (state.rider) setRider(state.rider[0], state.rider[1]);
      else clearRider();
    }
    if (state.route !== undefined) setRoute(state.route);
    if (state.destinations !== undefined) setDestinations(state.destinations);
    if (autoFit) fitRemainingRoute();
  };
  window.fitAll = fitRemainingRoute;
})();
</script>
</body>
</html>`;
}

type RuntimeState = {
  driver: [number, number] | null;
  rider: [number, number] | null;
  route: [number, number][] | null;
  destinations: Array<{ lat: number; lng: number; kind: string; label?: string }>;
  followDriver: boolean;
  fit: boolean;
  darkMode: boolean;
};

export default function LiveMap({
  driverLocation,
  riderLocation,
  route,
  destinations,
  darkMode = false,
  height = 300,
  rounded = true,
  followDriver = false,
}: LiveMapProps) {
  const webViewRef = useRef<WebView>(null);
  const webViewReadyRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const latestState = useRef<RuntimeState>({
    driver: null,
    rider: null,
    route: null,
    destinations: [],
    followDriver,
    fit: false,
    darkMode,
  });
  const prevRouteKey = useRef('');
  const prevDestKey = useRef('');

  const [html] = useState(() =>
    buildHtml(
      {
        driver: driverLocation
          ? ([driverLocation.latitude, driverLocation.longitude] as [number, number])
          : null,
        rider: riderLocation
          ? ([riderLocation.latitude, riderLocation.longitude] as [number, number])
          : null,
        route: (route || []).map((p) => [p.latitude, p.longitude] as [number, number]),
        destinations: (destinations || []).map((d) => ({
          lat: d.latitude,
          lng: d.longitude,
          kind: d.kind,
          label: d.label,
        })),
        followDriver,
        darkMode,
      },
      darkMode,
    ),
  );

  const injectLatest = useCallback(() => {
    if (!webViewReadyRef.current || !webViewRef.current) return;
    webViewRef.current.injectJavaScript(
      `window.applyState(${JSON.stringify(latestState.current)}); true;`,
    );
  }, []);

  useEffect(() => {
    const routeKey = JSON.stringify(route ?? null);
    const destKey = JSON.stringify(destinations ?? null);
    const geometryChanged = routeKey !== prevRouteKey.current || destKey !== prevDestKey.current;
    prevRouteKey.current = routeKey;
    prevDestKey.current = destKey;

    latestState.current = {
      driver: driverLocation
        ? ([driverLocation.latitude, driverLocation.longitude] as [number, number])
        : null,
      rider: riderLocation
        ? ([riderLocation.latitude, riderLocation.longitude] as [number, number])
        : null,
      route: (route || []).map((p) => [p.latitude, p.longitude] as [number, number]),
      destinations: (destinations || []).map((d) => ({
        lat: d.latitude,
        lng: d.longitude,
        kind: d.kind,
        label: d.label,
      })),
      followDriver,
      fit: geometryChanged,
      darkMode,
    };
    injectLatest();
  }, [driverLocation, riderLocation, route, destinations, followDriver, darkMode, injectLatest]);

  if (failed) {
    return (
      <View style={[styles.container, { height }, !rounded && styles.containerFull]}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>Map unavailable</Text>
          <Text style={styles.fallbackText}>
            Could not load the map. Check your internet connection.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }, !rounded && styles.containerFull]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={[styles.webview, { backgroundColor: darkMode ? '#0f172a' : '#e5e7eb' }]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        setSupportMultipleWindows={false}
        onLoadEnd={() => {
          webViewReadyRef.current = true;
          injectLatest();
        }}
        onError={() => setFailed(true)}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#2563eb" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  containerFull: {
    borderRadius: 0,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#e5e7eb',
  },
  fallbackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  fallbackText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
});
