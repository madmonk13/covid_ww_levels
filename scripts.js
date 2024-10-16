var covidStateData;
var covidSiteData;
var currentState;
var x;
var y;

function getLocation(){
    const successCallback = (position) => {
        x = position.coords.longitude;
        y = position.coords.latitude;
        fetchStateData();
      };
      
    const errorCallback = (error) => {
        console.log(error);
    };
      
    navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
      


}


function populateSites(data){
    currentState = document.getElementById("state").value;
    if ( data == undefined ){ data = covidSiteData; }
    document.getElementById("site").innerHTML = "";
    for ( var i in data ){
        if ( currentState == data[i].State ){
            let s = document.createElement("option");
                s.value = data[i].sewershed;
                s.innerHTML = data[i].counties
            document.getElementById("site").appendChild(s);
        }
    }
    updateSiteData();
}

function updateStateData(){
    let state = document.getElementById("state").value;
    for ( var i in covidStateData ){
        if ( state == covidStateData[i].State ){
            document.getElementById("level_state").innerHTML = 
            covidStateData[i].State + ", Statewide: "+
            covidStateData[i].activity_level_label + ", " +
            covidStateData[i].activity_level + "/10";
        }
    }
    populateSites();
}

function updateSiteData(){
    let site = document.getElementById("site").value;
    for ( var i in covidSiteData ){
        if ( site == covidSiteData[i].sewershed ){
            document.getElementById("level_local").innerHTML = 
                covidSiteData[i].State + ", "+
                covidSiteData[i].counties + ": "+
                covidSiteData[i].activity_level_label + ", " +
                covidSiteData[i].activity_level + "/10";
        }
    }
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
                covidSiteData = data;
                populateSites(data);
                updateStateData();
                findNearestSites();
        })
        .catch(error => {
            console.error('Error getting site data.', error);
        }
    )}

    function populateStates(data){
    for ( var i in data ){
        let s = document.createElement("option");
            s.value=data[i].State;
            s.innerHTML=data[i].State;
            if ( currentState == data[i].State ){
                s.selected = true;
            }
            document.getElementById('state').appendChild(s);
    }
}

function findNearestSites(){
    let closest = covidSiteData[0];
    let closestDistance = calculateDistance([x,y], [closest.longitude,closest.latitude]);


    for ( var i in covidSiteData ) {
        let currentDistance = calculateDistance([x,y], [covidSiteData[i].longitude,covidSiteData[i].latitude]);

        if (currentDistance < closestDistance) {
            closest = covidSiteData[i];
            closestDistance = currentDistance;
        }
    }
    document.getElementById("state").value = closest.State;
    updateStateData();
    document.getElementById("site").value = closest.sewershed;
    updateSiteData();
    return closest;

}

function calculateDistance(point1, point2) {
    let dx = point1[0] - point2[0];
    let dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
}