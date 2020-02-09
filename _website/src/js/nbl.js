
var missionStartTimeSeconds = 30233.5;
var missionDurationSeconds = 4988;

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

$( document ).ready(function() {
    console.log("ready!");

    $.when(ajaxGetRunsJSON(), ajaxGetDBFFieldsKey()).done(function () {

        initializeRun(document.getElementById("runSelect").value);

        initNavigator();
        createCharts();
        setEventHandlers();

        // startInterval();
    });
});

function initializeRun(runName) {
    $.when(ajaxGetRunJSON(runName)).done(function () {
        loadVideo(runName, gRunMetadata['videos'][0]['filename_root'])
    });
}

function loadVideo(runName, filenameRoot) {
    var video = document.getElementById('player0');
    var source = document.createElement('source');
    source.setAttribute('src', gRunDataURL + runName + '/video_feeds/' + filenameRoot + '-000.mp4');

    video.appendChild(source);
    video.load();
    video.muted = true;
    video.play();
}

function setEventHandlers() {
    var slider = document.getElementById("myRange");

    document.getElementById("player0").addEventListener("play", function() { startInterval();}, true);
    document.getElementById("player0").addEventListener("pause", function() { clearInterval(gTimer);}, true);
}

function startInterval() {
    clearInterval(gTimer);
    gTimer = setInterval(function(){
        var missionSeconds = document.getElementById("player0").currentTime;
        document.getElementById("missionTimeDisplay").innerHTML = secondsToTimeStr(missionStartTimeSeconds + missionSeconds);
        document.getElementById("missionTimeDisplayGMT").innerHTML = secondsToTimeStr(missionStartTimeSeconds + 18000 + missionSeconds);
        // document.getElementById("myRange").value = (missionSeconds * 100) / missionDurationSeconds;

        // console.log(document.getElementById("myRange").value);

        var closestChartIndex = findChartIndexByMissionTime(missionStartTimeSeconds + missionSeconds);
        var chartStartEnd = findChartStartEnd(closestChartIndex);

        setChartRange(chartStartEnd);
        // setChartHover(closestChartIndex);

        Plotly.Fx.hover('allChart', [
            {curveNumber: 0, pointNumber: closestChartIndex},
            {curveNumber: 1, pointNumber: closestChartIndex}
        ]);

        drawCursor(missionStartTimeSeconds + missionSeconds)

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
            document.getElementById("player0").currentTime = timeStrToSeconds(data.points[0].x) - missionStartTimeSeconds;
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

