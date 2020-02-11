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
        ticks: 'inside',
        tickfont: {
            size: 12,
            color: labelcolor
        },
        automargin: true,
        hoverinfo: 'y',
        hoverformat: '.2r'
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
var gTOCData = [];
var gTimer;
var gFieldNames = [];

var gRunDataURL = './run_data/';
var gRunsData = []; //loaded from Ajax. Array of run names that are also folder names for that run's data
var gDBFFieldsKeyData = {}; //loaded from Ajax csv

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

        // var timeId = gRunMetadata['videos'][0]['stream_start_datetime'].substring(11, 19).replace(':', '');
        // scrollToClosestEvent(timeId);

        initNavigator();
        createCharts();
        setEventHandlers();
        startInterval();
    });
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

        // var closestChartIndex = findChartIndexByMissionTime(gMissionStartTimeSeconds + missionSeconds);
        // var chartStartEnd = findChartStartEnd(closestChartIndex);

        // setChartRange(chartStartEnd);
        // setChartHover(closestChartIndex);

        // Plotly.Fx.hover('allChart', [
        //     {curveNumber: 0, pointNumber: closestChartIndex},
        //     {curveNumber: 1, pointNumber: closestChartIndex}
        // ]);

        drawCursor(gMissionStartTimeSeconds + gMissionSeconds)

    },1000);
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

function findChartIndexByMissionTime(seconds) {
    for (var i=0; i < gSuitTelemetryData[gFieldNames['Time']].length; i++) {
        if (timeStrToSeconds(gSuitTelemetryData[gFieldNames['Time']][i]) > seconds) {
            var closestIndex = i - 1;
            break;
        }
    }
    return closestIndex < 0 ? 0 : closestIndex;
}

function createCharts() {

    var chartAllTrace1 = {
        x:gSuitTelemetryData[gFieldNames['Time']],
        y:gSuitTelemetryData[gFieldNames['EV2_Depth_(feet)']],
        type: 'line',
        line: {
            width: 1,
            color: yellow
        },
        name: 'EV2 Depth'
    };

    var chartAllTrace2 = {
        x:gSuitTelemetryData[gFieldNames['Time']],
        y:gSuitTelemetryData[gFieldNames['EV2_Subject_Depth_(feet)_Calculated_from_suit_pressure)']],
        type: 'line',
        line: {
            width: 1,
            color: orange
        },
        name: 'EV2 Calc Depth'
    };

    var chartAllTrace3 = {
        x:gSuitTelemetryData[gFieldNames['Time']],
        y:gSuitTelemetryData[gFieldNames['EV1_Depth_(feet)']],
        type: 'line',
        line: {
            width: 1,
            color: green
        },
        name: 'EV1 Depth'
    };

    var depthLayout = JSON.parse(JSON.stringify(gChartLayout));
    depthLayout['yaxis']['autorange'] = 'reversed';
    Plotly.newPlot('allChart', [chartAllTrace1, chartAllTrace2, chartAllTrace3], depthLayout, {displayModeBar: false});


    var classname = document.getElementsByClassName("plotlychart");
    for (i = 0; i < classname.length; i++) {
        classname[i].on('plotly_click', function(data){
            document.getElementById("player0").currentTime = timeStrToSeconds(data.points[0].x) - gMissionStartTimeSeconds;
            if (!document.getElementById("player0").paused) {
                startInterval();
            }
        });
    }
}

function findChartStartEnd(closestIndex) {
    //this code puts the current data point at the far left of the little charts
    var chartStart = closestIndex;

    if (closestIndex + chartWidth >= gSuitTelemetryData[gFieldNames['Time']].length) {
        var chartEnd = gSuitTelemetryData[gFieldNames['Time']].length;
    } else {
        chartEnd = closestIndex + chartWidth;
    }
    return [chartStart, chartEnd];
}

function setChartRange(chartStartEnd) {
    var linepoint = chartStartEnd[0] + ((chartStartEnd[1] - chartStartEnd[0]) / 2);

    var chartRelayoutProperties = JSON.parse(JSON.stringify(gChartLayout));
    chartRelayoutProperties.xaxis.range = [chartStartEnd[0], chartStartEnd[1]];
    chartRelayoutProperties.xaxis.autorange = false;

    var scatterLayoutProperties = JSON.parse(JSON.stringify(gChartLayout));
    scatterLayoutProperties.xaxis.range = [0, 30];
    scatterLayoutProperties.yaxis.range = [0, 40];
    scatterLayoutProperties.xaxis.autorange = false;
    scatterLayoutProperties.yaxis.autorange = false;

    Plotly.relayout('Chart1', chartRelayoutProperties);
    Plotly.relayout('Chart2', chartRelayoutProperties);
    Plotly.relayout('Chart3', chartRelayoutProperties);
    Plotly.relayout('Chart5', chartRelayoutProperties);
    Plotly.relayout('Chart6', chartRelayoutProperties);
    Plotly.relayout('Chart7', chartRelayoutProperties);
    Plotly.relayout('Chart8', chartRelayoutProperties);

    var chart4Trace1 = {
        x:gSuitTelemetryData[gFieldNames['EV2_Suit_Pressure_(psig)']].slice(chartStartEnd[0], chartStartEnd[1]),
        y:gSuitTelemetryData[gFieldNames['EV2_Depth_(feet)']].slice(chartStartEnd[0], chartStartEnd[1]),
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 2,
            color: yellow
        },
        name: 'EV2'
    };
    Plotly.newPlot('Chart4', [chart4Trace1], scatterLayoutProperties, {displayModeBar: false});
}

function setChartHover(activeIndex) {
    Plotly.Fx.hover('depthChart', [
        {curveNumber: 0, pointNumber: activeIndex},
        {curveNumber: 1, pointNumber: activeIndex}
    ]);
    Plotly.Fx.hover('airflowSCFMChart', [
        {curveNumber: 0, pointNumber: activeIndex},
        {curveNumber: 1, pointNumber: activeIndex},
        {curveNumber: 2, pointNumber: activeIndex},
        {curveNumber: 3, pointNumber: activeIndex}
    ]);
    Plotly.Fx.hover('airflowACFMChart', [
        {curveNumber: 0, pointNumber: activeIndex},
        {curveNumber: 1, pointNumber: activeIndex},
        {curveNumber: 2, pointNumber: activeIndex},
        {curveNumber: 3, pointNumber: activeIndex}

    ]);
    Plotly.Fx.hover('coolingWaterChart', [
        {curveNumber: 0, pointNumber: activeIndex},
        {curveNumber: 1, pointNumber: activeIndex}
    ]);
    Plotly.Fx.hover('pressureChart', [
        {curveNumber: 0, pointNumber: activeIndex},
        {curveNumber: 1, pointNumber: activeIndex},
        {curveNumber: 2, pointNumber: activeIndex},
        {curveNumber: 3, pointNumber: activeIndex},
        {curveNumber: 4, pointNumber: activeIndex},
        {curveNumber: 5, pointNumber: activeIndex}
    ]);
}


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
    var signToggle = (sign == "-") ? -1 : 1;
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

