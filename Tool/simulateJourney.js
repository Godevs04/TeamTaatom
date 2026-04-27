#!/usr/bin/env node
var http = require('http');
var https = require('https');
var path = require('path');
var fs = require('fs');

function parseArgs() {
  var args = process.argv.slice(2);
  var opts = {
    token: null,
    baseUrl: 'http://localhost:5001',
    route: 'chennai-pondy',
    speed: 1000,
    noPause: false,
    dryRun: false,
    mongoUrl: null,
  };
  for (var i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--token': opts.token = args[++i]; break;
      case '--base-url': opts.baseUrl = args[++i]; break;
      case '--route': opts.route = args[++i]; break;
      case '--speed': opts.speed = parseInt(args[++i], 10); break;
      case '--no-pause': opts.noPause = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--mongo-url': opts.mongoUrl = args[++i]; break;
      default: console.warn('Unknown arg: ' + args[i]);
    }
  }
  if (!opts.token && !opts.dryRun) {
    console.error('[ERROR] --token is required.');
    console.error('Usage: node Tool/simulateJourney.js --token YOUR_JWT_TOKEN');
    process.exit(1);
  }
  return opts;
}

function apiCall(method, url, token, body) {
  return new Promise(function(resolve, reject) {
    var parsed = new URL(url);
    var isHttps = parsed.protocol === 'https:';
    var lib = isHttps ? https : http;
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    var req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: method,
      headers: headers,
    }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

var ROUTES = {
  'chennai-pondy': {
    title: 'Chennai to Pondicherry (ECR)',
    durationHours: 3.5,
    points: [
      [13.0827, 80.2707], [13.0490, 80.2780], [12.9900, 80.2500],
      [12.9400, 80.2350], [12.8700, 80.2270], [12.8200, 80.2100],
      [12.7800, 80.1900], [12.7200, 80.1800], [12.6200, 80.1700],
      [12.5000, 79.9500], [12.4000, 79.8800], [12.2500, 79.8500],
      [12.1500, 79.8300], [11.9416, 79.8083],
    ],
  },
  'marina-walk': {
    title: 'Marina Beach Walk (Loop)',
    durationHours: 3,
    points: [
      [13.0604, 80.2870], [13.0620, 80.2875], [13.0650, 80.2878],
      [13.0680, 80.2880], [13.0710, 80.2882], [13.0740, 80.2883],
      [13.0770, 80.2880], [13.0800, 80.2878], [13.0827, 80.2876],
      [13.0827, 80.2850], [13.0810, 80.2830], [13.0780, 80.2835],
      [13.0750, 80.2840], [13.0720, 80.2845], [13.0690, 80.2850],
      [13.0660, 80.2855], [13.0630, 80.2860], [13.0604, 80.2870],
    ],
  },
  'bangalore-mysore': {
    title: 'Bangalore to Mysore (Highway)',
    durationHours: 3,
    points: [
      [12.9716, 77.5946], [12.9200, 77.5500], [12.8500, 77.4800],
      [12.8000, 77.3800], [12.7500, 77.2900], [12.6500, 77.1500],
      [12.5500, 77.0000], [12.4500, 76.9000], [12.3100, 76.6600],
    ],
  },
};

function interpolateRoute(routePoints, durationHours, pointsPerSegment) {
  durationHours = durationHours || 3;
  pointsPerSegment = pointsPerSegment || 8;
  var result = [];
  var totalPoints = (routePoints.length - 1) * pointsPerSegment + 1;
  var durationMs = durationHours * 60 * 60 * 1000;
  var journeyStartTime = Date.now() - durationMs;
  var pointIndex = 0;
  for (var i = 0; i < routePoints.length - 1; i++) {
    var lat1 = routePoints[i][0], lng1 = routePoints[i][1];
    var lat2 = routePoints[i+1][0], lng2 = routePoints[i+1][1];
    for (var j = 0; j < pointsPerSegment; j++) {
      var t = j / pointsPerSegment;
      var lat = lat1 + (lat2 - lat1) * t;
      var lng = lng1 + (lng2 - lng1) * t;
      var jLat = (Math.random() - 0.5) * 0.0004;
      var jLng = (Math.random() - 0.5) * 0.0004;
      var baseTime = journeyStartTime + (pointIndex / totalPoints) * durationMs;
      var jMs = (Math.random() - 0.5) * 60000;
      result.push({
        lat: parseFloat((lat + jLat).toFixed(6)),
        lng: parseFloat((lng + jLng).toFixed(6)),
        accuracy: parseFloat((5 + Math.random() * 15).toFixed(1)),
        timestamp: Math.round(baseTime + jMs),
      });
      pointIndex++;
    }
  }
  var last = routePoints[routePoints.length - 1];
  result.push({ lat: last[0], lng: last[1], accuracy: 5.0, timestamp: journeyStartTime + durationMs });
  return result;
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function fmt(meters) {
  return meters >= 1000 ? (meters/1000).toFixed(2) + ' km' : Math.round(meters) + ' m';
}

function log(tag, msg) {
  console.log('  [' + tag + '] [' + new Date().toLocaleTimeString() + '] ' + msg);
}

function getJ(d) {
  if (d.data && d.data.journey) return d.data.journey;
  if (d.journey) return d.journey;
  return null;
}

function getMongoUrl(opts) {
  if (opts.mongoUrl) return opts.mongoUrl;
  var envPaths = [
    path.join(__dirname, '..', 'backend', '.env'),
    path.join(__dirname, '..', 'backend', '.env.development'),
  ];
  for (var i = 0; i < envPaths.length; i++) {
    try {
      var content = fs.readFileSync(envPaths[i], 'utf8');
      var match = content.match(/MONGO_URL\s*=\s*(.+)/);
      if (match) return match[1].trim().replace(/^["']|["']$/g, '');
    } catch(e) {}
  }
  return null;
}

async function patchTimestamps(journeyId, allPoints, opts) {
  var mongoUrl = getMongoUrl(opts);
  if (!mongoUrl) {
    log('SKIP', 'No MongoDB URL found. Use --mongo-url or set MONGO_URL in backend/.env');
    return false;
  }
  try {
    var mongoose = require(path.join(__dirname, '..', 'backend', 'node_modules', 'mongoose'));
    var envPath = path.join(__dirname, '..', 'backend', '.env');
    var dbName = 'taatom';
    try {
      var envContent = fs.readFileSync(envPath, 'utf8');
      var dbMatch = envContent.match(/DB_NAME\s*=\s*(.+)/);
      if (dbMatch) dbName = dbMatch[1].trim().replace(/^["']|["']$/g, '');
    } catch(e) {}

    log('DB', 'Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, { dbName: dbName });

    var first = allPoints[0];
    var last = allPoints[allPoints.length - 1];
    var startDate = new Date(first.timestamp);
    var endDate = new Date(last.timestamp);
    var midIdx = Math.floor(allPoints.length / 2);
    var pauseDate = new Date(allPoints[midIdx].timestamp);
    var resumeDate = new Date(pauseDate.getTime() + 15 * 60 * 1000);

    var ObjectId = mongoose.Types.ObjectId;
    var updateFields = {
      startedAt: startDate,
      completedAt: endDate,
      lastActiveAt: endDate,
      createdAt: startDate,
      updatedAt: endDate,
    };

    // Also patch session timestamps if pause was used
    if (!opts.noPause) {
      updateFields['sessions.0.startedAt'] = startDate;
      updateFields['sessions.0.stoppedAt'] = pauseDate;
      updateFields['sessions.1.startedAt'] = resumeDate;
      updateFields['sessions.1.stoppedAt'] = endDate;
    } else {
      updateFields['sessions.0.startedAt'] = startDate;
      updateFields['sessions.0.stoppedAt'] = endDate;
    }

    var result = await mongoose.connection.db.collection('journeys').updateOne(
      { _id: new ObjectId(journeyId) },
      { $set: updateFields }
    );

    await mongoose.connection.close();

    if (result.modifiedCount === 1) {
      log('OK', 'Timestamps patched successfully!');
      log('OK', 'Started:   ' + startDate.toLocaleString());
      if (!opts.noPause) {
        log('OK', 'Paused:    ' + pauseDate.toLocaleString());
        log('OK', 'Resumed:   ' + resumeDate.toLocaleString());
      }
      log('OK', 'Completed: ' + endDate.toLocaleString());
      return true;
    } else {
      log('WARN', 'Journey not found in DB for patching');
      return false;
    }
  } catch(err) {
    log('WARN', 'Timestamp patch failed: ' + err.message);
    return false;
  }
}

async function simulate() {
  var opts = parseArgs();
  var routeData = ROUTES[opts.route];
  if (!routeData) {
    console.error('[ERROR] Unknown route: "' + opts.route + '"');
    console.error('Available: ' + Object.keys(ROUTES).join(', '));
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('   JOURNEY SIMULATOR - TeamTaatom');
  console.log('========================================\n');
  console.log('  Route:     ' + routeData.title);
  console.log('  Server:    ' + opts.baseUrl);
  console.log('  Speed:     ' + opts.speed + 'ms between batches');
  console.log('  Pause:     ' + (opts.noPause ? 'Skipped' : 'Yes (mid-journey)'));

  var allPoints = interpolateRoute(routeData.points, routeData.durationHours);
  var t1 = new Date(allPoints[0].timestamp).toLocaleString();
  var t2 = new Date(allPoints[allPoints.length-1].timestamp).toLocaleString();
  console.log('  Duration:  ' + routeData.durationHours + ' hours');
  console.log('  Timeline:  ' + t1 + ' --> ' + t2);
  console.log('  GPS pts:   ' + allPoints.length + '\n');
  console.log('----------------------------------------');

  if (opts.dryRun) {
    console.log('\n  [DRY RUN] Would call: start -> ' + Math.ceil(allPoints.length/10) + ' batches -> pause/resume -> complete -> verify\n');
    return;
  }

  var BASE = opts.baseUrl + '/api/v1/journey';

  // Step 1: Start
  log('START', 'Starting journey: "' + routeData.title + '"...');
  var startRes = await apiCall('POST', BASE + '/start', opts.token, {
    startCoords: { lat: allPoints[0].lat, lng: allPoints[0].lng },
    title: routeData.title,
  });
  if (startRes.status !== 201) {
    console.error('[ERROR] Failed to start:', JSON.stringify(startRes.data));
    process.exit(1);
  }
  var journeyId = getJ(startRes.data)._id;
  log('OK', 'Journey created: ' + journeyId);

  // Step 2: Location batches
  var BATCH = 10;
  var batches = [];
  for (var i = 1; i < allPoints.length; i += BATCH) {
    batches.push(allPoints.slice(i, i + BATCH));
  }
  var pauseAt = Math.floor(batches.length / 2);

  for (var b = 0; b < batches.length; b++) {
    var batch = batches[b];
    var coords = batch.map(function(pt) {
      return { lat: pt.lat, lng: pt.lng, accuracy: pt.accuracy, timestamp: pt.timestamp };
    });

    if (!opts.noPause && b === pauseAt) {
      log('PAUSE', 'Pausing journey...');
      var pRes = await apiCall('POST', BASE + '/' + journeyId + '/pause', opts.token);
      if (pRes.status === 200) {
        log('OK', 'Paused. Distance: ' + fmt(getJ(pRes.data).distanceTraveled));
      } else {
        log('WARN', 'Pause failed: ' + JSON.stringify(pRes.data));
      }
      log('WAIT', 'Waiting 2s...');
      await sleep(2000);
      log('RESUME', 'Resuming...');
      var rRes = await apiCall('POST', BASE + '/' + journeyId + '/resume', opts.token);
      if (rRes.status === 200) { log('OK', 'Resumed!'); }
      else { log('WARN', 'Resume failed: ' + JSON.stringify(rRes.data)); }
    }

    var locRes = await apiCall('PUT', BASE + '/' + journeyId + '/location', opts.token, { coordinates: coords });
    if (locRes.status === 200) {
      var lj = getJ(locRes.data);
      log('GPS', 'Batch ' + (b+1) + '/' + batches.length + ' - ' + batch.length + ' pts, total: ' + lj.polyline.length + ', dist: ' + fmt(lj.distanceTraveled));
    } else {
      log('WARN', 'Batch ' + (b+1) + ' failed');
    }
    if (opts.speed > 0 && b < batches.length - 1) await sleep(opts.speed);
  }

  // Step 3: Complete
  console.log('\n----------------------------------------');
  log('FINISH', 'Completing journey...');
  var cRes = await apiCall('POST', BASE + '/' + journeyId + '/complete', opts.token);
  if (cRes.status !== 200) {
    console.error('[ERROR] Failed to complete:', JSON.stringify(cRes.data));
    process.exit(1);
  }
  log('OK', 'Journey completed!');

  // Step 4: Patch timestamps
  log('PATCH', 'Patching timestamps to be realistic...');
  await patchTimestamps(journeyId, allPoints, opts);

  // Step 5: Verify
  log('VERIFY', 'Fetching final journey data...');
  var dRes = await apiCall('GET', BASE + '/' + journeyId, opts.token);
  if (dRes.status === 200) {
    var j = getJ(dRes.data);
    console.log('\n========================================');
    console.log('  JOURNEY SUMMARY');
    console.log('========================================');
    console.log('  ID:            ' + j._id);
    console.log('  Title:         ' + j.title);
    console.log('  Status:        ' + j.status);
    console.log('  Start:         ' + j.startCoords.lat.toFixed(4) + ', ' + j.startCoords.lng.toFixed(4));
    console.log('  End:           ' + j.endCoords.lat.toFixed(4) + ', ' + j.endCoords.lng.toFixed(4));
    console.log('  Distance:      ' + fmt(j.distanceTraveled));
    console.log('  Polyline pts:  ' + j.polyline.length);
    console.log('  Sessions:      ' + j.sessions.length);
    console.log('  Waypoints:     ' + j.waypoints.length);
    console.log('  Privacy:       ' + j.privacy);
    console.log('  Auto-ended:    ' + j.autoEnded);
    console.log('  Started at:    ' + new Date(j.startedAt).toLocaleString());
    console.log('  Completed at:  ' + new Date(j.completedAt).toLocaleString());
    console.log('========================================');
    console.log('\n  Done! Open the app to see it on the map.\n');
  } else {
    log('WARN', 'Could not verify: ' + JSON.stringify(dRes.data));
  }
}

simulate().catch(function(err) {
  console.error('[CRASH] ' + err.message);
  process.exit(1);
});
