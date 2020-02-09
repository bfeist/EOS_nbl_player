var gNavGroup;
var gCursorGroup;
var gNavCursorGroup;

var gNavigatorWidth;
var gNavigatorHeight;
var gFontScaleFactor;

var gNavigatorPixelsPerSecond;
var gNavigatorSecondsPerPixel;

var gColorCursor = 'red';
var gColorNavCursor = '#ffff00'; //'yellow';
var gColorTimeTicks = '#333333';
var gColorTOCText = "#999999";
var gColorTOCStroke = "orange";

var gMouseOnNavigator;

function initNavigator() {
    $("body").css("overflow", "hidden");
    paper.install(window);
    paper.setup('navCanvas');

    gNavigatorWidth = paper.view.size.width - 2;
    gNavigatorHeight = paper.view.size.height - 20;
    gFontScaleFactor = Math.floor(gNavigatorHeight * .020) - 1;

    gNavigatorPixelsPerSecond = gNavigatorWidth / missionDurationSeconds ;
    gNavigatorSecondsPerPixel = missionDurationSeconds / gNavigatorWidth;

    gNavGroup = new paper.Group;
    gCursorGroup = new paper.Group;
    gNavCursorGroup = new paper.Group;

    paper.view.onMouseMove = function (event) {
        gMouseOnNavigator = true;

        var mouseXSeconds;
        gNavCursorGroup.removeChildren();

        mouseXSeconds = (event.point.x - 1) * gNavigatorSecondsPerPixel + 1;

        drawNavCursor(mouseXSeconds + missionStartTimeSeconds);
    };

    paper.view.onMouseUp = function (event) {
        var mouseXSeconds = (event.point.x - 1) * gNavigatorSecondsPerPixel + 1;
        document.getElementById("player0").currentTime = mouseXSeconds;

        var closestChartIndex = findChartIndexByMissionTime(missionStartTimeSeconds + mouseXSeconds);
        var chartStartEnd = findChartStartEnd(closestChartIndex);
        setChartRange(chartStartEnd);
    };

    paper.view.onMouseLeave = function(event) {
        // trace("paper.view.onMouseLeave triggered");
        onMouseOutHandler();
    };

    drawNavigator();
}

function drawNavigator() {
    var tierRect = new paper.Rectangle(1.5, 1.5, gNavigatorWidth, gNavigatorHeight);
    var cornerSize = new paper.Size(5, 5);
    var tierRectPath = paper.Path.RoundRectangle(tierRect, cornerSize);
    //var tierRectPath = paper.Path.Rectangle(tierRect);
    tierRectPath.strokeColor = labelcolor;
    gNavGroup.addChild(tierRectPath);

    //display time ticks
    for (var i = 0; i < missionDurationSeconds; i++) {

        if ((i - 7) % (10 * 60) === 0) {
            var itemLocX = i * gNavigatorPixelsPerSecond;
            var topPoint = new paper.Point(itemLocX, 1);
            var bottomPoint = new paper.Point(itemLocX, 10);
            var aLine = new paper.Path.Line(topPoint, bottomPoint);
            aLine.strokeColor = gColorTimeTicks;

            var stageText = new paper.PointText({
                justification: 'left',
                // fontFamily: graphFontFamily,
                //fontWeight: 'bold',
                fontSize: 12 + gFontScaleFactor,
                fillColor: gColorTimeTicks
            });
            var textTop = 1 + gNavigatorHeight - 5;
            stageText.point = new paper.Point(itemLocX - 2 , textTop);
            stageText.rotate(-90);
            var tickTimeSeconds = i + missionStartTimeSeconds;
            stageText.content = secondsToTimeStr(tickTimeSeconds);

            gNavGroup.addChild(stageText);
            gNavGroup.addChild(aLine);
        }
    }

    //display TOC ticks and text
    //display TOC ticks at varying heights
    for (i = 0; i < gTOCData.length; i++) {
        var itemSecondsFromLeft = timeStrToSeconds(gTOCData[i][0]) - missionStartTimeSeconds;

        itemLocX = itemSecondsFromLeft * gNavigatorPixelsPerSecond;

        var barTop = i * 10;

        var barBottom = barTop + 12 + gFontScaleFactor;
        topPoint = new paper.Point(itemLocX, barTop);
        bottomPoint = new paper.Point(itemLocX, barBottom);
        aLine = new paper.Path.Line(topPoint, bottomPoint);
        aLine.strokeColor = gColorTOCStroke;
        gNavGroup.addChild(aLine);
        var itemText = new paper.PointText({
            justification: 'left',
            // fontFamily: graphFontFamily,
            fontSize: 10 + gFontScaleFactor,
            fillColor: gColorTOCText
        });
        itemText.point = new paper.Point(itemLocX + 2 , barBottom - 2);
        itemText.content = gTOCData[i][1];
        gNavGroup.addChild(itemText);
    }
}

function drawCursor(seconds) {
    gCursorGroup.removeChildren();

    var cursorLocX = 1 + ((seconds - missionStartTimeSeconds)  * gNavigatorPixelsPerSecond);
    var topPoint = new paper.Point(cursorLocX, 1);
    var bottomPoint = new paper.Point(cursorLocX, gNavigatorHeight);
    var aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = gColorCursor;
    gCursorGroup.addChild(aLine);

    var timeText = new paper.PointText({
        justification: 'left',
        fontWeight: 'bold',
        // fontFamily: graphFontFamily,
        fontSize: 11 + gFontScaleFactor,
        fillColor: gColorCursor
    });
    timeText.content = secondsToTimeStr(seconds);
    timeText.point = new paper.Point(cursorLocX - timeText.bounds.width / 2 , gNavigatorHeight + 14.5);
    var cornerSize = new paper.Size(3, 3);
    var timeTextRect = new paper.Path.RoundRectangle(timeText.bounds, cornerSize);
    //var timeTextRect = new paper.Path.Rectangle(timeText.bounds);
    timeTextRect.strokeColor = gColorCursor;
    timeTextRect.fillColor = "black";
    //timeTextRect.opacity = 0.5;
    timeTextRect.scale(1.1, 1.2);
    gCursorGroup.addChild(timeTextRect);
    gCursorGroup.addChild(timeText);
}

function drawNavCursor(seconds) {
    gNavCursorGroup.removeChildren();

    var cursorLocX = 1 + ((seconds - missionStartTimeSeconds)  * gNavigatorPixelsPerSecond);
    var topPoint = new paper.Point(cursorLocX, 1);
    var bottomPoint = new paper.Point(cursorLocX, gNavigatorHeight);
    var aLine = new paper.Path.Line(topPoint, bottomPoint);
    aLine.strokeColor = gColorNavCursor;
    gNavCursorGroup.addChild(aLine);

    var timeText = new paper.PointText({
        justification: 'left',
        fontWeight: 'bold',
        // fontFamily: graphFontFamily,
        fontSize: 11 + gFontScaleFactor,
        fillColor: gColorNavCursor
    });
    timeText.content = secondsToTimeStr(seconds);
    timeText.point = new paper.Point(cursorLocX - timeText.bounds.width / 2 , gNavigatorHeight + 14.5);
    if (timeText.point.x < 5) {
        timeText.point.x = 5;
    } else if (timeText.point.x > gNavigatorWidth - timeText.bounds.width - 5) {
        timeText.point.x = gNavigatorWidth - timeText.bounds.width - 5;
    }
    var cornerSize = new paper.Size(3, 3);
    var timeTextRect = new paper.Path.RoundRectangle(timeText.bounds, cornerSize);
    //var timeTextRect = new paper.Path.Rectangle(timeText.bounds);
    timeTextRect.strokeColor = gColorNavCursor;
    timeTextRect.fillColor = 'black';
    //timeTextRect.opacity = 0.5;
    timeTextRect.scale(1.1, 1.2);
    gNavCursorGroup.addChild(timeTextRect);
    gNavCursorGroup.addChild(timeText);
}

function onMouseOutHandler() {
    //trace("onMouseOutHandler()");
    gMouseOnNavigator = false;

    // $('#navigatorKey').css('display', '');
    // if (typeof gNavCursorGroup != "undefined") {
    gNavCursorGroup.removeChildren();
    // }
    drawNavigator();
}