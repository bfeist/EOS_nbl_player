var blue = '#3498DB';
var purple = '#9B59B6';
var green = '#1ABB9C';
var aero = '#9CC2CB';
var red = '#E74C3C';
var dark = '#34495E';
var yellow = '#cc9e22';
var orange = '#cc741b';
var labelcolor = '#999999';

var chartWidth = 120;

var gChartLayout = {
    autosize: true,
    height: 200,
    // width: '100%',
    showlegend: false,
    displayModeBar: false,
    plot_bgcolor: '#000000',
    paper_bgcolor: '#000000',
    margin: {
        t: 10, //top margin
        l: 25, //left margin
        r: 0, //right margin
        b: 60 //bottom margin
    },
    xaxis: {
        autorange: true,
        showgrid: true,
        zeroline: false,
        showline: true,
        autotick: true,
        linecolor: '#FFFFFF',
        linewidth: 1,
        showticklabels: true,
        nticks: 50,
        ticks: 'inside',
        tickfont: {
            size: 12,
            color: labelcolor
        },
        tickformat: '%H:%M:%S',
        automargin: true,
        hoverinfo: 'y',
        // hoverformat: '.2r',
        type: 'date'
    },
    yaxis: {
        autorange: true,
        linecolor: labelcolor,
        linewidth: 1,
        showticklabels: true,
        ticks: 'inside',
        tickfont: {
            size: 12,
            color: labelcolor
        }
    }
    // shapes: [{
    //     type: 'line',
    //     xref: 'x',
    //     yref: 'paper',
    //     x0: 1,
    //     y0: 0,
    //     x1: 1,
    //     y1: 1,
    //     line: {
    //         color: '#FF0000',
    //         width: 1
    //     }
    // }]
};

var gSuitTelemetryData = [];
var gTimer;
var gFieldNames = [];

var gRunDataURL = './run_data/';
var gRunsData = []; //loaded from Ajax. Array of run names that are also folder names for that run's data
var gDBFFieldsKeyData = {}; //loaded from Ajax csv
var gDBFTagnameData = [];
var gDBFTelemetryfieldNames = {};
var gDBFTelemetryData = {};
var gDBFChartTelemetryData = {};

var gRunMetadata = {};
var gEventsData = [];
var gEventsIndex = [];
var gEventsDataLookup = [];
var gMissionStartTimeSeconds = 0;
var gMissionDurationSeconds = 0;
var gRunName = '';
var gStreamName = '';
var gSegmentFilename = '';
var gSegmentStartSeconds = 0;

var gVideoPlaying = false;
var gLastEventElement = '';
var gLastEventTimeId = '';


var gMissionSeconds = 0;
var gLastMissionSecondsChecked = 0;
var gSeekClicked = false;

$( document ).ready(function() {
    console.log("ready!");

    $.when(ajaxGetRunsJSON(), ajaxGetDBFFieldsKey()).done(function () {
        initializeRun();
    });
});

function initializeRun() {
    $.when(ajaxGetRunJSON(), ajaxGetRunEventsData()).done(function () {
        //set run start time and length
        var runStartDatetimeString = gRunMetadata['run_metadata']['start_datetime'];
        gMissionStartTimeSeconds = timeStrToSeconds(runStartDatetimeString.split('T')[1]);
        gMissionDurationSeconds = parseInt(gRunMetadata['run_metadata']['duration_seconds']);
        gRunName = document.getElementById("runSelect").value;

        //load events iframe
        document.getElementById("iFrameEvents").src = './run_data/' + gRunName + '/_processed/system_events.html';

        //display run date
        document.getElementById("missionDateDisplay").innerHTML = runStartDatetimeString.split('T')[0];

        //display crew details
        document.getElementById("valCrew0color").innerHTML = gRunMetadata['colors'][0]['color'];
        document.getElementById("valCrew1color").innerHTML = gRunMetadata['colors'][1]['color'];

        document.getElementById("valCrew0ev").innerHTML = gRunMetadata['colors'][0]['EV_number'];
        document.getElementById("valCrew1ev").innerHTML = gRunMetadata['colors'][1]['EV_number'];

        document.getElementById("valCrew0name").innerHTML = gRunMetadata['colors'][0]['lastname'] + ', ' + gRunMetadata['colors'][0]['firstname'];
        document.getElementById("valCrew1name").innerHTML = gRunMetadata['colors'][1]['lastname'] + ', ' + gRunMetadata['colors'][1]['firstname'];

        //populate run video streams dropdown
        var select = document.getElementById("videoStreamnameSelect");
        for(var i = 0; i < gRunMetadata['videos'].length; i++) {
            var opt = gRunMetadata['videos'][i]['stream_name'];
            var el = document.createElement("option");
            el.textContent = opt;
            el.value = opt;
            select.appendChild(el);
        }

        //select first stream by default
        document.getElementById("videoStreamnameSelect").value = gRunMetadata['videos'][0]['stream_name'];
        gStreamName = gRunMetadata['videos'][0]['stream_name'];
        loadVideo();

        // get DBF Tagname JSONs for both colors
        $.when(ajaxGetDBFTagnamesJSON(gRunMetadata['colors'][0]['color']),
            ajaxGetDBFTagnamesJSON(gRunMetadata['colors'][1]['color']),
            ajaxGetDBFTelemetryForChartByIndexNumber(gRunMetadata['colors'][0]['color'], 0),
            ajaxGetDBFTelemetryForChartByIndexNumber(gRunMetadata['colors'][1]['color'], 0),
            ajaxGetDBFTelemetryByIndexNumber(gRunMetadata['colors'][0]['color'], 0),
            ajaxGetDBFTelemetryByIndexNumber(gRunMetadata['colors'][1]['color'], 0)
        ).done(function () {
            //display DBF Tagname and populate dropdowns
            document.getElementById("valTelemetry0color").innerHTML = gRunMetadata['colors'][0]['color'];
            document.getElementById("valTelemetry1color").innerHTML = gRunMetadata['colors'][1]['color'];

            //populate telemetry values dropdowns
            for (var i = 0; i < gRunMetadata['colors'].length; i++) {
                var select = document.getElementById("valTelemetry" + i + "Select");
                var colorTagnames = gDBFTagnameData[gRunMetadata['colors'][i]['color']];
               for (var y = 0; y < colorTagnames.length; y++) {
                   var el = document.createElement("option");
                   el.textContent = colorTagnames[y]['Tagname'];
                   el.value = colorTagnames[y]['TTagIndex'];
                   select.appendChild(el);
               }
            }

            //populate chart dropdowns
            //only put in primary values that are available for both colors
            var color0Tagnames = gDBFTagnameData[gRunMetadata['colors'][0]['color']];
            var color1Tagnames = gDBFTagnameData[gRunMetadata['colors'][1]['color']];
            select = document.getElementById("chartSelect");
            for (i = 0; i < color0Tagnames.length; i++) {
                var tag0Array = color0Tagnames[i]['Tagname'].split('\\');
                if (tag0Array[1] === 'P') { //if primary telemetry value
                    var tag1Array = [];
                    for (y = 0; y < color1Tagnames.length; y++) {
                        tag1Array = color1Tagnames[y]['Tagname'].split('\\');
                        if (tag1Array[1] === 'P' && tag1Array[2] === tag0Array[2]) {
                            var el = document.createElement("option");
                            el.textContent = tag0Array[2];
                            el.value = i + ',' + y;
                            select.appendChild(el);
                            break;
                        }
                    }
                }
            }

            //select default telemetry descriptions
            var sel = document.getElementById("valTelemetry0Select");
            //display description
            var dropdownText = sel.options[sel.selectedIndex].text;
            dropdownText = dropdownText.split("\\")[2];
            document.getElementById("valTelemetry0Description").innerHTML = getDescription(dropdownText);

            sel = document.getElementById("valTelemetry1Select");
            //display description
            dropdownText = sel.options[sel.selectedIndex].text;
            dropdownText = dropdownText.split("\\")[2];
            document.getElementById("valTelemetry1Description").innerHTML = getDescription(dropdownText);

            initNavigator();
            createCharts();
            setEventHandlers();
            startInterval();
        });

    });
}

function setEventHandlers() {
    document.getElementById("player0").addEventListener("play", function() { startInterval();}, true);
    document.getElementById("player0").addEventListener("playing", function() { gVideoPlaying = true;}, true);
    document.getElementById("player0").addEventListener("pause", function() { gVideoPlaying = false; clearInterval(gTimer);}, true);
    document.getElementById('player0').addEventListener('ended',function() {
        gVideoPlaying = false;
        if (gSeekClicked === true) {
            //ignore this event
            gSeekClicked = false;
        } else {
            gMissionSeconds++;
            loadVideo();
        }
    }, true);
    document.getElementById("runSelect").addEventListener("change", function() {
        gRunName = this.value;
    });

    document.getElementById("videoStreamnameSelect").addEventListener("change", function() {
        gStreamName = this.value;
        loadVideo();
    });

    document.getElementById("valTelemetry0Select").addEventListener("change", function() {
        gDBFTelemetryfieldNames[gRunMetadata['colors'][0]['color']] = this.value;
        ajaxGetDBFTelemetryByIndexNumber(gRunMetadata['colors'][0]['color'], this.value);

        //display description
        var dropdownText = this.options[this.selectedIndex].text;
        dropdownText = dropdownText.split("\\")[2];
        document.getElementById("valTelemetry0Description").innerHTML = getDescription(dropdownText);
    });

    document.getElementById("valTelemetry1Select").addEventListener("change", function() {
        gDBFTelemetryfieldNames[gRunMetadata['colors'][1]['color']] = this.value;
        ajaxGetDBFTelemetryByIndexNumber(gRunMetadata['colors'][1]['color'], this.value);

        //display description
        var dropdownText = this.options[this.selectedIndex].text;
        dropdownText = dropdownText.split("\\")[2];
        document.getElementById("valTelemetry1Description").innerHTML = getDescription(dropdownText);
    });

    document.getElementById("chartSelect").addEventListener("change", function() {
        var fieldIndexes = this.value.split(',');
        $.when(
            ajaxGetDBFTelemetryForChartByIndexNumber(gRunMetadata['colors'][0]['color'], fieldIndexes[0]),
            ajaxGetDBFTelemetryForChartByIndexNumber(gRunMetadata['colors'][1]['color'], fieldIndexes[1])
        ).done(function () {
            createCharts();
        });
    });
}

function startInterval() {
    clearInterval(gTimer);
    gTimer = setInterval(function(){

        //calculate how many seconds after start of run this video stream starts
        var runStartTimeSeconds = timeStrToSeconds(gRunMetadata['run_metadata']['start_datetime'].substring(11, 19));
        var videoStreamStartTimeSeconds = timeStrToSeconds(getVideoMetadataByStreamName(document.getElementById("videoStreamnameSelect").value)['stream_start_datetime'].substring(11, 19));
        var videoStartOffsetSeconds = runStartTimeSeconds - videoStreamStartTimeSeconds;

        //calc mission time from video
        if (gVideoPlaying)
            gMissionSeconds = parseInt((gSegmentStartSeconds + document.getElementById("player0").currentTime) - videoStartOffsetSeconds);
        document.getElementById("missionTimeDisplay").innerHTML = secondsToTimeStr(gMissionStartTimeSeconds + gMissionSeconds);
        document.getElementById("missionTimeDisplayGMT").innerHTML = secondsToTimeStr(gMissionStartTimeSeconds + 18000 + gMissionSeconds);

        //scroll events to most recent
        if (gMissionSeconds !== gLastMissionSecondsChecked) {
            gLastMissionSecondsChecked = gMissionSeconds;
            scrollToClosestEvent(secondsToTimeId(runStartTimeSeconds + gMissionSeconds))
        }

        //populate telemetry values
        for (var colorCounter = 0; colorCounter < gRunMetadata['colors'].length; colorCounter++) {
            if (gDBFTelemetryData[gRunMetadata['colors'][colorCounter]['color']]) {
                var telemetryData = gDBFTelemetryData[gRunMetadata['colors'][colorCounter]['color']];
                for (var i = 0; i < telemetryData.length; i++) {
                    if (timeStrToSeconds(telemetryData[i][0]) - gMissionStartTimeSeconds >= gMissionSeconds) {
                        document.getElementById("valTelemetry" + colorCounter + "Value").innerHTML = parseFloat(telemetryData[i][1]).toFixed(2);
                        break;
                    }
                }
            }
        }

        var closestChartIndex = findChartIndexByMissionTime(gMissionSeconds + gMissionStartTimeSeconds, gRunMetadata['colors'][0]['color']);
        // var chartStartEnd = findChartStartEnd(closestChartIndex);
        //
        // setChartRange(chartStartEnd);
        // setChartHover(closestChartIndex);
        //
        Plotly.Fx.hover('allChart', [
            {curveNumber: 0, pointNumber: closestChartIndex},
            {curveNumber: 1, pointNumber: closestChartIndex}
        ]);

        drawCursor(gMissionStartTimeSeconds + gMissionSeconds)

    },1000);
}

function loadVideo() {

    var video = document.getElementById('player0');
    var checkSourceExists = document.getElementById("player0source");
    if(!checkSourceExists) {
        var source = document.createElement('source');
        source.setAttribute("id", "player0source");
        video.appendChild(source);
    } else {
        source = document.getElementById("player0source");
    }

    //get video metadata
    var videoMetadata = getVideoMetadataByStreamName(gStreamName);

    //figure out which video segment to play
    //initialize values to last video segment
    gSegmentFilename = videoMetadata['video_segments'][videoMetadata['video_segments'].length - 1]['segment_filename'];
    gSegmentStartSeconds = parseInt(videoMetadata['video_segments'][videoMetadata['video_segments'].length - 1]['start_time_seconds']);
    //loop through to see if earlier segment should be used
    for (var i = 0; i < videoMetadata['video_segments'].length; i++) {
        if (videoMetadata['video_segments'][i]['start_time_seconds'] > gMissionSeconds) {
            gSegmentFilename = videoMetadata['video_segments'][i - 1]['segment_filename'];
            gSegmentStartSeconds = parseInt(videoMetadata['video_segments'][i - 1]['start_time_seconds']);
            break;
        }
    }

    source.setAttribute('src', gRunDataURL + gRunName + '/video_feeds/' + gSegmentFilename);

    video.load();
    video.muted = true;

    //figure out how many seconds into video to seek to get to gMissionSeconds
    video.currentTime = gMissionSeconds - gSegmentStartSeconds;
    video.play();
}

function getVideoMetadataByStreamName(streamName) {
    for (var i = 0; i < gRunMetadata['videos'].length; i++) {
        if (gRunMetadata['videos'][i]['stream_name'] === streamName) {
            return gRunMetadata['videos'][i];
        }
    }
}

function play() {
    document.getElementById("player0").play();
    startInterval();
}
function pause() {
    clearInterval(gTimer);
    document.getElementById("player0").pause();
}

function seekToTime(timeId) { // events click handling --------------------
    gSeekClicked = true;
    var runStartTimeSeconds = timeStrToSeconds(gRunMetadata['run_metadata']['start_datetime'].substring(11, 19));
    var clickedSeconds = timeIdToSeconds(timeId);
    gMissionSeconds = clickedSeconds - runStartTimeSeconds;
    loadVideo();
    scrollToClosestEvent(timeId);
}

function scrollToClosestEvent(timeIdParam) {
    var timeId = parseInt(timeIdParam);
    var scrollTimeId = gEventsIndex[gEventsIndex.length - 1];
    for (var i = 1; i < gEventsIndex.length; ++i) {
        if (timeId < parseInt(gEventsIndex[i])) {
            scrollTimeId = gEventsIndex[i - 1];
            break;
        }
    }
    scrollEventsToTimeId(scrollTimeId);
}

function scrollEventsToTimeId(timeId) {
    if (gEventsDataLookup.hasOwnProperty(timeId)) {
        var eventsFrame = $('#iFrameEvents');
        var eventsFrameContents = eventsFrame.contents();
        var eventsContainer = eventsFrameContents.find('.events_container');
        var eventsElement = eventsFrameContents.find('.eventid' + timeId);
        eventsFrameContents.find('.eventitem').css("background-color", ""); //clear all element highlights
        eventsElement.css("background-color", '#1e1e1e'); //set new element highlights

        var scrollDestination = eventsContainer.scrollTop() + eventsElement.offset().top;
        eventsContainer.animate({scrollTop: scrollDestination}, 500);

        gLastEventElement = eventsElement;
        gLastEventTimeId = timeId;
    }
}

function getDescription(selectedText) {
    var descStr = gDBFFieldsKeyData[selectedText]['description'] + " "
        + gDBFFieldsKeyData[selectedText]['low_value'] + " to "
        + gDBFFieldsKeyData[selectedText]['high_value'] + " "
        + gDBFFieldsKeyData[selectedText]['units'];
    return descStr;
}

function findChartIndexByMissionTime(seconds, color) {
    var telemetryData = gDBFChartTelemetryData[color];
    for (var i=0; i < telemetryData[0].length; i++) {
        if (timeStrToSeconds(telemetryData[0][i]) > seconds) {
            var closestIndex = i - 1;
            break;
        }
    }
    return closestIndex < 0 ? 0 : closestIndex;
}

function createCharts() {

    var chartAllTrace1 = {
        x:gDBFChartTelemetryData[gRunMetadata['colors'][0]['color']][1],
        y:gDBFChartTelemetryData[gRunMetadata['colors'][0]['color']][2],
        type: 'scatter',
        mode: 'lines',
        line: {
            // width: 1,
            color: gRunMetadata['colors'][0]['color']
        },
        name: gRunMetadata['colors'][0]['color'] + "  Depth"
    };

    var chartAllTrace2 = {
        x:gDBFChartTelemetryData[gRunMetadata['colors'][1]['color']][1],
        y:gDBFChartTelemetryData[gRunMetadata['colors'][1]['color']][2],
        type: 'scatter',
        mode: 'lines',
        line: {
            // width: 1,
            color: gRunMetadata['colors'][1]['color']
        },
        name: gRunMetadata['colors'][1]['color']
    };

    var chartLayout = JSON.parse(JSON.stringify(gChartLayout));
    var sel = document.getElementById("chartSelect");
    if (sel.options[sel.selectedIndex].value === '0,0') { //if depth chart, then reverse y axis
        chartLayout['yaxis']['autorange'] = 'reversed';
    }

    Plotly.newPlot('allChart', [chartAllTrace1, chartAllTrace2], chartLayout, {displayModeBar: false});


    var classname = document.getElementsByClassName("plotlychart");
    for (var i = 0; i < classname.length; i++) {
        classname[i].on('plotly_click', function(data){
            // document.getElementById("player0").currentTime = timeStrToSeconds(data.points[0].x) - gMissionStartTimeSeconds;
            // if (!document.getElementById("player0").paused) {
            //     startInterval();
            // }
            seekToTime(timeStrToTimeId(data.points[0].x.substring(data.points[0].x.indexOf(' ') + 1, data.points[0].x.length)));
        });
    }
}

// function findChartStartEnd(closestIndex) {
//     //this code puts the current data point at the far left of the little charts
//     var chartStart = closestIndex;
//
//     if (closestIndex + chartWidth >= gSuitTelemetryData[gFieldNames['Time']].length) {
//         var chartEnd = gSuitTelemetryData[gFieldNames['Time']].length;
//     } else {
//         chartEnd = closestIndex + chartWidth;
//     }
//     return [chartStart, chartEnd];
// }

// function setChartRange(chartStartEnd) {
//     var linepoint = chartStartEnd[0] + ((chartStartEnd[1] - chartStartEnd[0]) / 2);
//
//     var chartRelayoutProperties = JSON.parse(JSON.stringify(gChartLayout));
//     chartRelayoutProperties.xaxis.range = [chartStartEnd[0], chartStartEnd[1]];
//     chartRelayoutProperties.xaxis.autorange = false;
//
//     var scatterLayoutProperties = JSON.parse(JSON.stringify(gChartLayout));
//     scatterLayoutProperties.xaxis.range = [0, 30];
//     scatterLayoutProperties.yaxis.range = [0, 40];
//     scatterLayoutProperties.xaxis.autorange = false;
//     scatterLayoutProperties.yaxis.autorange = false;
//
//     Plotly.relayout('Chart1', chartRelayoutProperties);
//     Plotly.relayout('Chart2', chartRelayoutProperties);
//     Plotly.relayout('Chart3', chartRelayoutProperties);
//     Plotly.relayout('Chart5', chartRelayoutProperties);
//     Plotly.relayout('Chart6', chartRelayoutProperties);
//     Plotly.relayout('Chart7', chartRelayoutProperties);
//     Plotly.relayout('Chart8', chartRelayoutProperties);
//
//     var chart4Trace1 = {
//         x:gSuitTelemetryData[gFieldNames['EV2_Suit_Pressure_(psig)']].slice(chartStartEnd[0], chartStartEnd[1]),
//         y:gSuitTelemetryData[gFieldNames['EV2_Depth_(feet)']].slice(chartStartEnd[0], chartStartEnd[1]),
//         mode: 'markers',
//         type: 'scatter',
//         marker: {
//             size: 2,
//             color: yellow
//         },
//         name: 'EV2'
//     };
//     Plotly.newPlot('Chart4', [chart4Trace1], scatterLayoutProperties, {displayModeBar: false});
// }

// function setChartHover(activeIndex) {
//     Plotly.Fx.hover('depthChart', [
//         {curveNumber: 0, pointNumber: activeIndex},
//         {curveNumber: 1, pointNumber: activeIndex}
//     ]);
//     Plotly.Fx.hover('airflowSCFMChart', [
//         {curveNumber: 0, pointNumber: activeIndex},
//         {curveNumber: 1, pointNumber: activeIndex},
//         {curveNumber: 2, pointNumber: activeIndex},
//         {curveNumber: 3, pointNumber: activeIndex}
//     ]);
//     Plotly.Fx.hover('airflowACFMChart', [
//         {curveNumber: 0, pointNumber: activeIndex},
//         {curveNumber: 1, pointNumber: activeIndex},
//         {curveNumber: 2, pointNumber: activeIndex},
//         {curveNumber: 3, pointNumber: activeIndex}
//
//     ]);
//     Plotly.Fx.hover('coolingWaterChart', [
//         {curveNumber: 0, pointNumber: activeIndex},
//         {curveNumber: 1, pointNumber: activeIndex}
//     ]);
//     Plotly.Fx.hover('pressureChart', [
//         {curveNumber: 0, pointNumber: activeIndex},
//         {curveNumber: 1, pointNumber: activeIndex},
//         {curveNumber: 2, pointNumber: activeIndex},
//         {curveNumber: 3, pointNumber: activeIndex},
//         {curveNumber: 4, pointNumber: activeIndex},
//         {curveNumber: 5, pointNumber: activeIndex}
//     ]);
// }


function secondsToTimeStr(totalSeconds) {
    var hours = Math.abs(parseInt(totalSeconds / 3600));
    var minutes = Math.abs(parseInt(totalSeconds / 60)) % 60 % 60;
    var seconds = Math.abs(parseInt(totalSeconds)) % 60;
    seconds = Math.floor(seconds);
    var timeStr = padZeros(hours,2) + ":" + padZeros(minutes,2) + ":" + padZeros(seconds,2);
    if (totalSeconds < 0) {
        timeStr = "-" + timeStr.substr(1); //change timeStr to negative, replacing leading zero in hours with "-"
    }
    return timeStr;
}

function timeStrToSeconds(timeStr) {
    var sign = timeStr.substr(0,1);
    var hours = parseInt(timeStr.substr(0,2));
    var minutes = parseInt(timeStr.substr(3,2));
    var seconds = parseInt(timeStr.substr(6,2));
    var signToggle = (sign === "-") ? -1 : 1;
    var totalSeconds = Math.round(signToggle * ((Math.abs(hours) * 60 * 60) + (minutes * 60) + seconds));

    return totalSeconds;
}

function padZeros(num, size) {
    var s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

function timeIdToTimeStr(timeId) {
    return timeId.substr(0,3) + ":" + timeId.substr(3,2) + ":" + timeId.substr(5,2);
}

function timeStrToTimeId(timeStr) {
    return timeStr.split(":").join("");
}

function secondsToTimeId(seconds) {
    return secondsToTimeStr(seconds).split(":").join("");
}

function timeIdToSeconds(timeId) {
    var sign = timeId.substr(0,1);
    var hours = parseInt(timeId.substr(0,2));
    var minutes = parseInt(timeId.substr(2,2));
    var seconds = parseInt(timeId.substr(4,2));
    var signToggle = (sign === "-") ? -1 : 1;
    var totalSeconds = signToggle * ((Math.abs(hours) * 60 * 60) + (minutes * 60) + seconds);
    //if (totalSeconds > 230400)
    //    totalSeconds -= 9600;
    return totalSeconds;
}

