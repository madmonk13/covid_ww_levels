// Covid-19 Wastewater Levels
// Data source (updated 2026): CDC National Wastewater Surveillance System (NWSS)
// open-data feed "CDC Wastewater Viral Activity Level for SARS-CoV-2, Influenza A and RSV"
// https://data.cdc.gov/resource/atcp-73re.json  (updated weekly on Fridays)
//
// The legacy CDC vizdata JSON feeds (NWSSStateMap.json / NWSSSC2WVALSiteMapPoints.json)
// were removed. This feed is site-level only, so statewide values are aggregated here
// from the site rows.
//
// The new feed no longer includes per-site latitude/longitude, so the geolocation
// feature can no longer rank sites by exact distance. Instead it uses the browser's
// location + the U.S. Census geocoder (no API key) to find the user's county, then
// auto-selects the wastewater site serving that county.

const DATA_RESOURCE = 'https://data.cdc.gov/resource/atcp-73re.json';
const PATHOGEN = 'SARS-CoV-2';
const CENSUS_GEOCODER = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates';

// State/territory FIPS code -> name, to match the Census geocoder's numeric state
// code against the feed's full state/territory names.
const STATE_FIPS = {
    '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
    '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
    '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
    '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa', '20': 'Kansas',
    '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine', '24': 'Maryland',
    '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota', '28': 'Mississippi',
    '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada',
    '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico', '36': 'New York',
    '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio', '40': 'Oklahoma',
    '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island', '45': 'South Carolina',
    '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas', '49': 'Utah', '50': 'Vermont',
    '51': 'Virginia', '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin',
    '56': 'Wyoming', '60': 'American Samoa', '66': 'Guam',
    '69': 'Northern Mariana Islands', '72': 'Puerto Rico', '78': 'U.S. Virgin Islands'
};

let covidStateData;   // aggregated per-state rows
let covidSiteData;    // per-site rows for the latest reporting week
let currentState;

// Map a continuous Wastewater Viral Activity Level (WVAL) to the 1-10 gauge/level
// scale used by the CSS. WVAL runs roughly 0 (none) to ~11+ (very high).
function wvalToLevel(wval) {
    if (wval === null || wval === undefined || isNaN(wval)) return 0;
    let lvl = Math.round(wval);
    if (lvl < 1) lvl = 1;
    if (lvl > 10) lvl = 10;
    return lvl;
}

// Derive the WVAL category label from a numeric value, matching CDC's cut-offs.
function wvalToCategory(wval) {
    if (wval === null || wval === undefined || isNaN(wval)) return 'No Data';
    if (wval <= 2) return 'Very Low';
    if (wval <= 3.4) return 'Low';
    if (wval <= 5.3) return 'Moderate';
    if (wval <= 7.8) return 'High';
    return 'Very High';
}

function median(nums) {
    if (nums.length === 0) return NaN;
    const s = nums.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function init() {
    fetchData();
}

// Find the most recent reporting week, then pull every site for that week.
function fetchData() {
    const latestUrl = DATA_RESOURCE +
        '?$select=max(week_end) as mw&pathogen_target=' + encodeURIComponent(PATHOGEN);
    fetch(latestUrl)
        .then(r => {
            if (!r.ok) throw new Error('Network response was not ok ' + r.statusText);
            return r.json();
        })
        .then(rows => {
            const week = rows && rows[0] && rows[0].mw;
            if (!week) throw new Error('No reporting week returned');
            document.getElementById('loading_state').innerHTML = '&#128994;';
            return fetchWeek(week);
        })
        .catch(error => {
            console.error('Error getting latest reporting week.', error);
            showError();
        });
}

function fetchWeek(week) {
    const url = DATA_RESOURCE +
        '?pathogen_target=' + encodeURIComponent(PATHOGEN) +
        '&week_end=' + encodeURIComponent(week) +
        '&$limit=50000';
    return fetch(url)
        .then(r => {
            if (!r.ok) throw new Error('Network response was not ok ' + r.statusText);
            return r.json();
        })
        .then(rows => {
            buildData(rows);
            document.getElementById('loading_site').innerHTML = '&#128994;';
            populateStates(covidStateData);
            dataHealth(covidSiteData);
            updateStateData();
            const hadDefault = setFromCookie();
            // If the user hasn't pinned a default site, try to jump to their county.
            if (!hadDefault) locateUser();
        })
        .catch(error => {
            console.error('Error getting site data.', error);
            showError();
        });
}

// Transform the raw feed rows into the shape the rest of the app expects, and
// aggregate statewide summaries from the site rows.
function buildData(rows) {
    const sites = [];
    const seenSite = {};
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.site || seenSite[r.site]) continue;   // de-dupe by site id
        seenSite[r.site] = true;
        const wval = (r.site_wval === undefined || r.site_wval === '') ? NaN : parseFloat(r.site_wval);
        sites.push({
            'State/Territory': r.state_territory,
            Sewershed_ID: r.site,
            Counties_Served: r.counties_served || 'Unknown',
            wval: wval,
            activity_level: wvalToLevel(wval),
            WVAL_Category: r.site_wval_category || wvalToCategory(wval),
            Reporting_Week: r.week_end,
            Population_Served: r.population_served,
            Source: r.source
        });
    }
    covidSiteData = alpha(sites);

    // Aggregate per state/territory.
    const byState = {};
    for (const s of covidSiteData) {
        const st = s['State/Territory'];
        if (!byState[st]) byState[st] = [];
        byState[st].push(s);
    }
    const states = [];
    for (const st of Object.keys(byState)) {
        const group = byState[st];
        const vals = group.map(g => g.wval).filter(v => !isNaN(v));
        const med = median(vals);
        states.push({
            'State/Territory': st,
            activity_level: wvalToLevel(med),
            WVAL_Category: wvalToCategory(med),
            Number_of_Sites: group.length,
            Time_Period: group[0].Reporting_Week
        });
    }
    states.sort((a, b) => a['State/Territory'] < b['State/Territory'] ? -1 :
                          a['State/Territory'] > b['State/Territory'] ? 1 : 0);
    covidStateData = states;
}

function populateStates(data) {
    const stateSelect = document.getElementById('state');
    stateSelect.innerHTML = '';
    for (const row of data) {
        const s = document.createElement('option');
        s.value = row['State/Territory'];
        s.innerHTML = row['State/Territory'];
        if (currentState === row['State/Territory']) s.selected = true;
        stateSelect.appendChild(s);
    }
}

function populateSites(data, set) {
    currentState = document.getElementById('state').value;
    if (data === undefined) data = covidSiteData;
    document.getElementById('site').innerHTML = '';
    for (const row of alpha(data)) {
        if (currentState === row['State/Territory'] && row.Sewershed_ID != null) {
            const s = document.createElement('option');
            s.value = row.Sewershed_ID;
            s.innerHTML = row.Counties_Served + ' (' + row.Sewershed_ID + ')';
            document.getElementById('site').appendChild(s);
        }
    }
    if (set !== undefined) document.getElementById('site').value = set;
    updateSiteData();
}

function updateStateData() {
    const state = document.getElementById('state').value;
    for (const row of covidStateData) {
        if (state === row['State/Territory']) {
            document.getElementById('state_location').innerHTML = row['State/Territory'] + ', Statewide';
            if (isNaN(parseInt(row.activity_level)) || row.activity_level === 0) {
                document.getElementById('state_level').innerHTML = '&#128683;';
                document.getElementById('state_level').className = 'not_available';
                document.getElementById('state_desc').className = 'not_available';
            } else {
                document.getElementById('state_level').innerHTML = row.activity_level;
                document.getElementById('state_level').className = 'guage_' + row.activity_level;
                document.getElementById('state_desc').className = 'level_' + row.activity_level;
            }
            document.getElementById('state_desc').innerHTML = row.WVAL_Category;
            document.getElementById('state_sites').innerHTML =
                'Based on results from ' + row.Number_of_Sites + ' total sites.';
            document.getElementById('state_date').innerHTML = 'Week ending ' + row.Time_Period;
        }
    }
    populateSites();
}

function updateSiteData() {
    const site = document.getElementById('site').value;
    for (const row of covidSiteData) {
        if (site === row.Sewershed_ID) {
            document.getElementById('site_location').innerHTML =
                row.Counties_Served + ', ' + row['State/Territory'];
            if (row.WVAL_Category === 'No Data' || row.activity_level === 0) {
                document.getElementById('site_level').innerHTML = '&#128683;';
                document.getElementById('site_level').className = 'not_available';
                document.getElementById('site_desc').className = 'not_available';
            } else {
                document.getElementById('site_level').innerHTML = row.activity_level;
                document.getElementById('site_level').className = 'guage_' + row.activity_level;
                document.getElementById('site_desc').className = 'level_' + row.activity_level;
            }
            document.getElementById('site_desc').innerHTML = row.WVAL_Category;
            document.getElementById('site_distance').style.display = 'none';
            document.getElementById('site_date').innerHTML = 'Week ending ' + row.Reporting_Week;
        }
    }
    document.getElementById('loading').className = 'fadeout';
    setTimeout(function () {
        document.getElementById('loading').style.display = 'none';
    }, 3000);
}

function alpha(arr) {
    return arr.sort((a, b) => {
        if (a.Counties_Served < b.Counties_Served) return -1;
        if (a.Counties_Served > b.Counties_Served) return 1;
        return 0;
    });
}

function dataHealth(data) {
    let sites = 0;
    let noData = 0;
    for (let i = 0; i < data.length; i++) {
        sites += 1;
        if (data[i].activity_level === 0) noData += 1;
    }
    document.getElementById('dataHealth').innerHTML = (sites - noData) + '/' + sites;
    if (noData >= 1) {
        document.getElementById('no_data').innerHTML =
            noData + " out of " + sites + " sites returning 'No Data'.";
    }
}

function goToNextData() {
    for (let i = 0; i < covidSiteData.length; i++) {
        if (covidSiteData[i].activity_level !== 0) {
            document.getElementById('state').value = covidSiteData[i]['State/Territory'];
            populateSites(undefined, covidSiteData[i].Sewershed_ID);
            return;
        }
    }
}

function showError() {
    document.getElementById('error').style.display = 'block';
    document.getElementById('loading_state').innerHTML = '&#128308;';
    document.getElementById('loading_site').innerHTML = '&#128308;';
}

function setDefaultSite() {
    if (document.getElementById('myDefault').checked === true) {
        const state = document.getElementById('state').value;
        const site = document.getElementById('site').value;
        document.cookie = state + '|' + site;
    } else {
        document.cookie = 'null';
    }
}

function setFromCookie() {
    const parts = document.cookie.split('|');
    if (parts.length === 2 && parts[0] && parts[1] !== 'null') {
        document.getElementById('state').value = parts[0];
        updateStateData();
        document.getElementById('site').value = parts[1];
        updateSiteData();
        const chk = document.getElementById('myDefault');
        if (chk) chk.checked = true;
        return true;
    }
    return false;
}

// --- Geolocation: find and select the site serving the user's county ---------

// Toggle the "Use My Location" button into a clear locating state so a slow
// browser location lookup never looks like a frozen page.
function setLocating(on) {
    const btn = document.getElementById('locate');
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? '⏳ Locating…' : '📍 Use My Location';
}

// Ask the browser for the user's location, then look up their county.
function locateUser() {
    if (!navigator.geolocation) return;
    const note = document.getElementById('geo_status');
    setLocating(true);
    if (note) note.innerHTML = 'Finding your area…';
    navigator.geolocation.getCurrentPosition(
        pos => geocodeCounty(pos.coords.longitude, pos.coords.latitude),
        err => {
            console.log('Geolocation unavailable:', err && err.message);
            setLocating(false);
            if (note) note.innerHTML =
                err && err.code === 1 ? 'Location permission denied — choose a state and site above.' : '';
        },
        // Fast, low-power fix; accept a cached position up to 10 min old.
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
}

// Reverse-geocode a lon/lat to a county using the free U.S. Census geocoder.
// The geocoder does not send CORS headers, so a normal fetch() is blocked by the
// browser. It does support JSONP, which loads via a <script> tag and is not subject
// to the same-origin policy, so we use that instead.
function geocodeCounty(lon, lat) {
    const note = document.getElementById('geo_status');
    const cbName = 'censusCb_' + Date.now();
    const script = document.createElement('script');
    let done = false;

    const cleanup = () => {
        try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
    };
    const fail = (msg) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        setLocating(false);
        console.log('County lookup failed:', msg);
        if (note) note.innerHTML = '';
    };
    const timer = setTimeout(() => fail('timeout'), 8000);

    window[cbName] = (data) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        setLocating(false);
        try {
            const counties = data && data.result && data.result.geographies &&
                data.result.geographies.Counties;
            if (!counties || !counties.length) throw new Error('No county found');
            const county = counties[0].BASENAME;               // e.g. "Montgomery"
            const stateName = STATE_FIPS[counties[0].STATE];    // e.g. "Maryland"
            selectByCounty(county, stateName);
        } catch (e) {
            console.log('County lookup failed:', e && e.message);
            if (note) note.innerHTML = '';
        }
    };

    script.onerror = () => fail('script error');
    script.src = CENSUS_GEOCODER +
        '?x=' + encodeURIComponent(lon) + '&y=' + encodeURIComponent(lat) +
        '&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties' +
        '&format=jsonp&callback=' + cbName;
    document.body.appendChild(script);
}

// Select the state + site that serves the given county name, if one exists.
function selectByCounty(county, stateName) {
    const note = document.getElementById('geo_status');
    if (!county || !stateName) { if (note) note.innerHTML = ''; return; }
    const wanted = county.toLowerCase();
    const match = covidSiteData.find(s =>
        s['State/Territory'] === stateName &&
        s.Counties_Served.toLowerCase().split(',').map(c => c.trim()).includes(wanted)
    );
    if (match) {
        document.getElementById('state').value = stateName;
        updateStateData();
        document.getElementById('site').value = match.Sewershed_ID;
        updateSiteData();
        const dist = document.getElementById('site_distance');
        dist.innerHTML = 'Serving your county (' + county + ').';
        dist.style.display = 'block';
        if (note) note.innerHTML = '';
    } else if (STATE_FIPS && covidStateData.some(s => s['State/Territory'] === stateName)) {
        // No site in the exact county; fall back to the user's state.
        document.getElementById('state').value = stateName;
        updateStateData();
        if (note) note.innerHTML = 'No site found for ' + county + ' County; showing ' + stateName + '.';
    } else if (note) {
        note.innerHTML = '';
    }
}
