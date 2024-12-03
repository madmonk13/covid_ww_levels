let covidStateData;
let covidSiteData;
let currentState;
let x;
let y;

function getLocation(){
    const successCallback = (position) => {
        x = position.coords.longitude;
        y = position.coords.latitude;
        fetchStateData();
        document.getElementById("nearest").style.display = "none";
      };
    const errorCallback = (error) => {
        console.log(error);
        fetchStateData();

    };
    navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
}


function populateSites(data){
    currentState = document.getElementById("state").value;
    if ( data == undefined ){ data = covidSiteData; }
    document.getElementById("site").innerHTML = "";
    for ( var i in alpha(data) ){
        if ( currentState == data[i]['State/Territory'] ){
            let s = document.createElement("option");
                if (data[i].Sewershed_ID != null ){
                    s.value = data[i].Sewershed_ID	;
                    s.innerHTML = data[i].Counties_Served + " (" +data[i].Sewershed_ID	+ ")";
                }

            document.getElementById("site").appendChild(s);
        }
    }
    document.getElementById("loading_site").innerHTML = "&#128994;";
    updateSiteData();
}

function updateStateData(manual){
    if ( manual === true && x != undefined && y != undefined ){
        document.getElementById("nearest").style.display = "block";
    }
    let state = document.getElementById("state").value;
    for ( var i in covidStateData ){
        if ( state == covidStateData[i]['State/Territory'] ){
            document.getElementById("state_location").innerHTML = covidStateData[i]['State/Territory'] + ", Statewide";
            if ( isNaN(parseInt(covidStateData[i].activity_level)) ){
                document.getElementById("state_level").innerHTML = "&#128683;";
                document.getElementById("state_level").className = "not_available";
                document.getElementById("state_desc").className = "not_available";
            }
            else {
                document.getElementById("state_level").innerHTML = covidStateData[i].activity_level;
                document.getElementById("state_level").className = "guage_"+covidStateData[i].activity_level;
                document.getElementById("state_desc").className = "level_"+covidStateData[i].activity_level;
            }
            document.getElementById("state_desc").innerHTML = covidStateData[i].WVAL_Category;
            document.getElementById("state_sites").innerHTML = "Based on results from "+covidStateData[i].Number_of_Sites+" total sites.";
            document.getElementById("state_date").innerHTML = covidStateData[i].Time_Period;
        }
    }
    populateSites();
}

function updateSiteData(manual){
    if ( manual === true && x != undefined && y != undefined ){
        document.getElementById("nearest").style.display = "block";
    }
    let site = document.getElementById("site").value;
    for ( var i in covidSiteData ){
        if ( site == covidSiteData[i].Sewershed_ID ){
            document.getElementById("site_location").innerHTML = covidSiteData[i].Counties_Served + ", " + covidSiteData[i]['State/Territory'];
            if ( covidSiteData[i].activity_level_label == "No Data" ){
                document.getElementById("site_level").innerHTML = "";
            }
            else {
                document.getElementById("site_level").innerHTML = covidSiteData[i].activity_level;
            }
            document.getElementById("site_level").className = "guage_"+covidSiteData[i].activity_level;
            document.getElementById("site_desc").innerHTML = covidSiteData[i].WVAL_Category;
            if ( x === undefined && y === undefined ){
                document.getElementById("site_distance").style.display = "none";
            }
            else {
                document.getElementById("site_distance").innerHTML = "Treatment site roughly "+
                haversine(x,y,covidSiteData[i].longitude,covidSiteData[i].latitude)+
                " miles away.";
                document.getElementById("site_distance").style.display = "block";

            }

            document.getElementById("site_date").innerHTML = covidSiteData[i].Reporting_Week;
            document.getElementById("site_desc").className = "level_"+covidSiteData[i].activity_level;
        }
    }
    document.getElementById("loading").className="fadeout";
    let t = setTimeout(function(){
        document.getElementById("loading").style.display="none";
    },3000)
}

function fetchStateData() {
    const url = 'https://www.cdc.gov/wcms/vizdata/NCEZID_DIDRI/NWSSStateMap.json';
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            covidStateData = data;
            populateStates(data);
            fetchSiteData()
        })
        .catch(error => {
            console.error('Error getting State data.', error);
            document.getElementById("error").style.display="block";
            document.getElementById("loading_state").innerHTML = "&#128308;";
            return

        });
}

function fetchSiteData(){
    const url = 'https://www.cdc.gov/wcms/vizdata/NCEZID_DIDRI/NWSSSC2WVALSiteMapPoints.json';
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
                covidSiteData = alpha(data);
                dataHealth(data);
                populateSites(data);
                updateStateData();
                findNearestSites();
        })
        .catch(error => {
            console.error('Error getting site data.', error);
            document.getElementById("error").style.display="block";
            document.getElementById("loading_site").innerHTML = "&#128308;";
            return
        }
    )}

    function populateStates(data){
    for ( var i in data ){
        let s = document.createElement("option");
            s.value=data[i]['State/Territory'];
            s.innerHTML=data[i]['State/Territory'];
            if ( currentState == data[i]['State/Territory'] ){
                s.selected = true;
            }
            document.getElementById('state').appendChild(s);
    }
    document.getElementById("loading_state").innerHTML = "&#128994;";
}

function findNearestSites(){
    if ( x === undefined && y === undefined ){
        return
    }
    let closest = covidSiteData[0];
    let closestDistance = calculateDistance([x,y], [closest.longitude,closest.latitude]);

    for ( var i in covidSiteData ) {
        let currentDistance = calculateDistance([x,y], [covidSiteData[i].longitude,covidSiteData[i].latitude]);
        covidSiteData[i].distance = currentDistance;
        if (currentDistance < closestDistance) {
            closest = covidSiteData[i];
            closestDistance = currentDistance;
        }
    }
    document.getElementById("state").value = closest['State/Territory'];
    updateStateData();
    document.getElementById("site").value = closest.Sewershed_ID;
    updateSiteData();
    covidSiteData.sort((a, b) => {
        if (a.distance < b.distance) {
          return -1;
        }
        if (a.distance > b.distance ) {
          return 1;
        }
        return 0;
      });

    // return closest;

}

function calculateDistance(point1, point2) {
    let dx = point1[0] - point2[0];
    let dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
}

function alpha(arr){
    return arr.sort((a, b) => {
        if (a.Counties_Served < b.Counties_Served) {
          return -1;
        }
        if (a.Counties_Served > b.Counties_Served ) {
          return 1;
        }
        return 0;
      });
}

function haversine(lat1, lon1, lat2, lon2) {
    // const R = 6371;
    const R = 3959;
    const toRadians = angle => angle * (Math.PI / 180);
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + 
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;   
    return Math.round(distance*100)/100;
}


function dataHealth(data){
    let noDataSites = [];
    let sites = 0;
    let noData = 0;   
    for ( var i = 0; i < data.length; i++ ){
        sites += 1;
        if ( data[i].WVAL_Category == "No Data" ){
            noData += 1;
            if ( noDataSites.indexOf(data[i]['State/Territory']) == -1 ){
                noDataSites.push(data[i]['State/Territory'])
            }
        }

    }
    // console.log(noDataSites);
    document.getElementById("dataHealth").innerHTML = (sites-noData)+"/"+sites;
    if ( noData >= 1 ){
        document.getElementById("no_data").innerHTML = noData+" out of "+sites+" sites returning 'No Data'.";
    }
}