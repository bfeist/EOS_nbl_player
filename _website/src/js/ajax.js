
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
    var urlStr = gRunDataURL + gRunName + "/_processed/system_events.csv";
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

function ajaxGetDBFTelemetryForChartByIndexNumber(colorName, indexNumber) {
    var urlStr = gRunDataURL + gRunName + '/_processed/telemetry/' + colorName + "_" + indexNumber + ".csv";
    return $.ajax({
        type: "GET",
        url: urlStr,
        dataType: "text",
        success: function(data) {
            gDBFChartTelemetryData[colorName] = [];
            var allTextLines = data.split(/\r\n|\n/);
            var timeStrValuesArray = [];
            var timeDisplayValuesArray = [];
            var dataValuesArray = [];
            for (var i = 0; i < allTextLines.length; i++) {
                var rowArray = allTextLines[i].split('|');
                // timeValuesArray.push(timeStrToSeconds(rowArray[0]));
                if (rowArray[0] !== '') {
                    timeStrValuesArray.push(rowArray[0]);
                    timeDisplayValuesArray.push('2020-01-23 ' + rowArray[0]);
                    dataValuesArray.push(parseFloat(rowArray[2]));
                }
            }

            gDBFChartTelemetryData[colorName].push(timeStrValuesArray);
            gDBFChartTelemetryData[colorName].push(timeDisplayValuesArray);
            gDBFChartTelemetryData[colorName].push(dataValuesArray);
        }
    });
}