var covidStateData;
var covidSiteData;
var currentState;
var x;
var y;

function getLocation(){
    if ( getURLString() != "" ){
        // return
    }
    let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let p = tz.split("/");
    currentState = p[1].replace("_"," ");


    const successCallback = (position) => {
        console.log(position);
        x = position.coords.longitude;
        y = position.coords.latitude;
        console.log(x,y);
      };
      
    const errorCallback = (error) => {
    console.log(error);
    };
      
    navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
      


}

function getURLString(){
    let url=document.location.toString();
    let p = url.split("?");
    if ( p[1] != "" ){
        let s = p[1].split("=");
        currentState = decodeURI(s[1]);
    }
}

function populateSites(data){
    currentState = document.getElementById("state").value;
    if ( data == undefined ){ data = covidSiteData; }
    document.getElementById("site").innerHTML = "";
    console.log(currentState);
    for ( var i in data ){
        if ( currentState == data[i].State ){
            let s = document.createElement("option");
                s.value = data[i].sewershed;
                s.innerHTML = data[i].counties
            document.getElementById("site").appendChild(s);
        }
    }
}

function updateData(){
    let state = document.getElementById("state").value;
    for ( var i in covidStateData ){
        if ( state == covidStateData[i].State ){
            document.getElementById("level").innerHTML=covidStateData[i].activity_level_label;
            document.getElementById("level_number").innerHTML = covidStateData[i].activity_level+"/10";
            document.getElementById("collection").innerHTML = covidStateData[i].num_sites;
            document.getElementById("level_number").className="level_"+covidStateData[i].activity_level;
        }
    }
    populateSites();
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
            // updateData();
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
                updateData();
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
        console.log(currentDistance,closestDistance);

        if (currentDistance < closestDistance) {
            closest = covidSiteData[i];
            closestDistance = currentDistance;
        }
    }
    document.getElementById("state").value = closest.State;
    updateData();
    document.getElementById("site").value = closest.sewershed;
    return closest;

}

function calculateDistance(point1, point2) {
    let dx = point1[0] - point2[0];
    let dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
}

fetchStateData();
