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
            for ( var i in data ){
                let s = document.createElement("option");
                    s.value=data[i].state_abbrev;
                    s.innerHTML=data[i].State;
                    if ( currentState == data[i].State ){
                        s.selected = true;
                    }
                    document.getElementById('state').appendChild(s);
            }
            updateData();
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
        })
        .catch(error => {
            console.error('Error getting site data.', error);
        }
    )}


function updateData(){
    let state = document.getElementById("state").value;
    for ( var i in covidStateData ){
        if ( state == covidStateData[i].state_abbrev ){
            document.getElementById("level").innerHTML=covidStateData[i].activity_level_label;
            document.getElementById("level_number").innerHTML = covidStateData[i].activity_level+"/10";
            document.getElementById("collection").innerHTML = covidStateData[i].num_sites;
            document.getElementById("level_number").className="level_"+covidStateData[i].activity_level;
        }
    }
}
fetchStateData();
