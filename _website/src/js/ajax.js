
function ajaxGetRunsJSON() {
    return $.getJSON(gRunDataURL + 'runs.json', function(data) {
        for (var i = 0; i < data.length; i++) {
            gRunsData.push(data[i]);
        }

        //Populate dropdown
        var select = document.getElementById("runSelect");
        for(i = 0; i < gRunsData.length; i++) {
            var opt = gRunsData[i];
            var el = document.createElement("option");
            el.textContent = opt;
            el.value = opt;
            select.appendChild(el);
        }
        document.getElementById("runSelect").value = gRunsData[0];
        gRunName = gRunsData[0];
        console.log("runs dropdown loaded");
    });
}

function ajaxGetDBFFieldsKey() {
    var urlStr = "./indexes/dbf_fields_key.csv";
    return $.ajax({
        type: "GET",
        url: urlStr,
        dataType: "text",
        success: function(data) {processDBFFieldsKey(data);}
    });
}

function processDBFFieldsKey(allText) {
    var allTextLines = allText.split(/\r\n|\n/);

    //create dictionary from headers
    var headers = allTextLines[0].split('|');
    var fieldlabels = [];
    for (var i = 0; i < headers.length; i++) {
        fieldlabels.push(headers[i]);
    }
    for (i = 1; i < allTextLines.length; i++) {
        var data = allTextLines[i].split('|');
        var rec = {};
        for (var j = 1; j < data.length; j++) {
            rec[fieldlabels[j]] = data[j];
        }
        gDBFFieldsKeyData[data[0]] = rec;
    }
    console.log("DBF fields key data loaded");
}

function ajaxGetDBFTagnamesJSON(colorName) {
    var urlStr = gRunDataURL + gRunName + '/_processed/telemetry/' + colorName + "_tagname.json";
    return $.getJSON(urlStr,
       function(data) {
           gDBFTagnameData[colorName] = data;
    });
}

function ajaxGetRunJSON() {
    return $.getJSON(gRunDataURL + gRunName + '/_processed/run_metadata.json', function(data) {
        gRunMetadata = data;

        console.log("run metadata loaded for " + gRunName);
    });
}

function ajaxGetRunEventsData() {
    var urlStr = "./run_data/" + gRunName + "/_processed/system_events.csv";
    return $.ajax({
        type: "GET",
        url: urlStr,
        dataType: "text",
        success: function(data) {processRunEventsData(data);}
    });
}

function processRunEventsData(allText) {
    var allTextLines = allText.split(/\r\n|\n/);

    for (var i = 0; i < allTextLines.length; i++) {
        var data = allTextLines[i].split('|');
        var curRow = 0;
        if (data[0] !== "") {
            data[0] = data[0].substring(11, 19);
            var timeId = timeStrToTimeId(data[0]);
            gEventsIndex[i] = timeId;
            gEventsDataLookup[timeId] = curRow;
            gEventsData.push(data);
            curRow++;
        }
    }
    console.log("RunEventsData loaded");
}

function ajaxGetDBFTelemetryByIndexNumber(colorName, indexNumber) {
    var urlStr = gRunDataURL + gRunName + '/_processed/telemetry/' + colorName + "_" + indexNumber + ".csv";
    return $.ajax({
        type: "GET",
        url: urlStr,
        dataType: "text",
        success: function(data) {
            var allTextLines = data.split(/\r\n|\n/);
            var resultArray = [];
            for (var i = 0; i < allTextLines.length; i++) {
                var rowArray = allTextLines[i].split('|');

                var curRow = 0;
                resultArray.push([rowArray[0], rowArray[2]])
            }
            gDBFTelemetryData[colorName] = resultArray;
        }
    });
}


function processSuitTelemetryData(allText) {
    //console.log("processSuitTelemetryData");
    var allTextLines = allText.split(/\r\n|\n/);

    //create dictionary from headers
    var headers = allTextLines[0].split('|');
    gFieldNames['Time'] = 0;
    for (var i = 1; i < headers.length; i++) {
        gFieldNames[headers[i]] = i;
    }

    var allDataArray = [];
    for (i = 1; i < allTextLines.length; i++) {
        var data = allTextLines[i].split('|');
        allDataArray.push(data);
    }
    // pivot array to have one subarray per column
    for (var telemetryIndexCounter = 0; telemetryIndexCounter <= 88; telemetryIndexCounter++) {
        var tempArray = [];
        for (var datapointCounter = 0; datapointCounter < allDataArray.length; datapointCounter++) {
            if (telemetryIndexCounter === 0) {
                // ADD FUDGE for telemetry data being 1 minute fast in provided data stream
                var tempsec = timeStrToSeconds(allDataArray[datapointCounter][telemetryIndexCounter]);
                tempArray.push(secondsToTimeStr(tempsec + 170));
            } else {
                tempArray.push(allDataArray[datapointCounter][telemetryIndexCounter]);
            }
        }
        gSuitTelemetryData.push(tempArray)
    }
}