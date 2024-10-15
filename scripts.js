var covidStateData;
var covidSiteData;
var currentState;

function getLocation(){
    if ( getURLString() != "" ){
        return
    }
    let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log(tz);
    let p = tz.split("/");
    currentState = p[1].replace("_"," ");
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

fetchStateData();
