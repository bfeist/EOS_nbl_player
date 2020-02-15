import os, json, shutil, fnmatch, re, csv
from datetime import datetime
from datetime import timedelta
from dateutil.relativedelta import relativedelta
from dbfread import DBF
import subprocess
from quik import FileLoader

runDataPath = '../_website/_webroot/run_data'


# get list of runs via directory listing of run_data
runList = []
for name in os.listdir(runDataPath):
    if os.path.isdir(os.path.join(runDataPath, name)):
        runList.append(name)

#write master .json file in run_data directory
masterJSON = json.dumps(runList)
masterJSONDataFile = open(runDataPath + "/runs.json", "w")
masterJSONDataFile.write(json.dumps(json.loads(masterJSON), indent=4, sort_keys=True)) #make output pretty
masterJSONDataFile.close()

#---------------
# process each run data folder
for runName in runList:
    print("Processing: " + runName)
    runProcessedPath = runDataPath + '/' + runName + '/_processed'
    os.makedirs(runProcessedPath, exist_ok=True)

    runVideoFeedsPath = runDataPath + '/' + runName + '/video_feeds'

    #------------------
    #process video feed data using file names of video first segments (000 in filename)
    videoStreamList = []
    EVByLastName = {}
    lastStreamPrefix = ''
    earliestStartTime = datetime.now()
    latestStopTime = datetime.now() - relativedelta(years=100)
    for streamFilename in os.listdir(runVideoFeedsPath):
        if fnmatch.fnmatch(streamFilename, '*000.mp4'):
            filename_root = streamFilename[:-8]
            print("Processing video: " + filename_root)

            #get video start time
            match = re.search(r'\[(.*)_(.*)\]', filename_root)
            if match is not None:
                dateStr = match.group(1)
                timeStr = match.group(2).replace('-', ':')
                startTimeIsoStr = dateStr + "T" + timeStr + '-06:00'
                print("Video start time: " + startTimeIsoStr)

                #track time of earliest video - this is the run start time
                isoStartTimeTimeObj = datetime.strptime(startTimeIsoStr, "%Y-%m-%dT%H:%M:%S-06:00")
                if isoStartTimeTimeObj < earliestStartTime:
                    earliestStartTime = isoStartTimeTimeObj
            else:
                raise NameError('Failed to find valid timestamp in video stream filename')

            #get streamname
            match = re.search(r'(.*?)-\[.*', filename_root)
            if match is not None:
                streamName = match.group(1)
                print("Video streamname: " + streamName)
            else:
                raise NameError('Failed to parse streamName')

            #get EV number and last name from filename if available
            match = re.search(r'(EV.)-(.*)', streamName)
            if match is not None:
                EVNumberStr = match.group(1)
                lastName = match.group(2).lower()
                EVByLastName[lastName] = EVNumberStr
                print("Video lastName: " + match.group(2))
            else:
                raise NameError('Failed to parse lastName')

            #parse number of video segments
            maxDigitVal = 0
            for file in os.listdir(runVideoFeedsPath):
                pattern = streamName + '*.mp4'
                if fnmatch.fnmatch(file, pattern):
                    match = re.search(r'.*\-(\d\d\d).mp4', file)
                    if match is not None:
                        digit = int(match.group(1))
                        if digit > maxDigitVal:
                            maxDigitVal = digit
            if maxDigitVal == 0:
                raise NameError('Something went wrong counting video segments')
            else:
                numberOfVideoSegments = maxDigitVal + 1

            #---------------
            #use external ffprobe command to get each video segment duration
            videoSegmentsList = []
            totalDuration = 0

            #get sorted list of video segments
            lst = os.listdir(runVideoFeedsPath)
            lst.sort()
            for segmentFilename in lst:
                if segmentFilename.startswith(filename_root): #only pay attention to video segments that match this root (000) video
                    print("Processing video segment: " + segmentFilename)
                    tempDict = {}
                    videoFullPath = runVideoFeedsPath + '\\' + segmentFilename
                    # videoFormatString = os.popen('ffprobe -i "' + videoFullPath + '" -show_format').read()
                    tt = subprocess.Popen('ffprobe -i "' + videoFullPath + '" -show_format',
                                          stdout=subprocess.PIPE,
                                          stderr=subprocess.PIPE,
                                          stdin=subprocess.PIPE)
                    videoFormatString, stderr = tt.communicate()
                    videoFormatString = str(videoFormatString)
                    for line in videoFormatString.split('\\r\\n'):
                        if line.startswith('duration'):
                            duration = float(line[9:])
                            tempDict['segment_filename'] = segmentFilename
                            tempDict['duration_seconds'] = duration
                            tempDict['start_time_seconds'] = totalDuration
                            totalDuration = totalDuration + duration
                            break
                    videoSegmentsList.append(tempDict.copy())
            #calculate the stop time of this stream using the start time above and adding the total duration of all segments
            streamStopTime = isoStartTimeTimeObj + timedelta(seconds=totalDuration)
            streamStopTimeIsoStr = datetime.strftime(streamStopTime, "%Y-%m-%dT%H:%M:%S-06:00")
            if streamStopTime > latestStopTime:
                latestStopTime = streamStopTime

            #assemble Dict object for this stream
            streamDict = {}

            streamDict['stream_name'] = streamName
            streamDict['filename_root'] = filename_root
            streamDict['stream_start_datetime'] = startTimeIsoStr
            streamDict['stream_stop_datetime'] = streamStopTimeIsoStr
            streamDict['duration_seconds'] = float(totalDuration)
            streamDict['number_of_segments'] = numberOfVideoSegments
            streamDict['EV_number'] = EVNumberStr
            streamDict['last_name'] = lastName.capitalize()
            streamDict['video_segments'] = videoSegmentsList.copy()

            videoStreamList.append(streamDict.copy())

    #------------------
    #process run telemetry
    runDBFPath = runDataPath + '/' + runName + '/DBF_telemetry'

    #get array of color values for this run
    colors = []
    print('Processing colors')
    for file in os.listdir(runDBFPath):
        if os.path.isdir(os.path.join(runDBFPath, file)):
            colors.append(file)
            print('Color found: ' + file)

    # process event txt files into _processed/system_events.csv
    eventListStr = []
    eventList = []
    print('Processing systems event txt files')
    for file in os.listdir(runDBFPath):
        if fnmatch.fnmatch(file, '*.txt'):
            f = open(runDBFPath + '/' + file, "r")
            for line in f.readlines():
                eventListStr.append(line.strip()) #strip " marks
    for item in eventListStr:
        match = re.search(r'"(.*M)  (.*)"', item)
        if match is not None:
            #get date from the runName string and time from txt for
            timeVal = datetime.strptime(runName[0:10] + " " + match.group(1), "%Y-%m-%d %I:%M:%S %p")
            # if len(timeStamp) == 10:
            #     timeStamp = "0" + timeStamp
            message = match.group(2)
            timeStrISO = datetime.strftime(timeVal, "%Y-%m-%dT%H:%M:%S-06:00")
            eventDataRow = timeStrISO + '|' + message
            eventList.append(eventDataRow)
    eventList.sort()
    f = open(runProcessedPath + "/system_events.csv", "w")
    print('Writing consolidated event list in ' + runProcessedPath + '/system_events.csv')
    for event in eventList:
        f.write(event + '\n')
    f.close()

    # ------------------ Write system events html file
    template_loader = FileLoader('./templates')

    output_TOC_file_name_and_path = runProcessedPath + "/system_events.html"
    output_TOC_file = open(output_TOC_file_name_and_path, "w")
    output_TOC_file.write("")
    output_TOC_file.close()

    output_TOC_file = open(output_TOC_file_name_and_path, "ab")



    # WRITE TOC ITEMS
    prev_depth = 0
    depth_comparison = "false"
    timestamp = ""
    inputFilePath = runProcessedPath + "/system_events.csv"
    csv.register_dialect('pipes', delimiter='|', doublequote=True, escapechar='\\')
    reader = csv.reader(open(inputFilePath, "rU"), dialect='pipes')
    print('Writing consolidated event html to ' + runProcessedPath + '/system_events.html')
    curRow = 0
    for row in reader:
        timestamp = row[0][11:19]
        timeline_index_id = timestamp.replace(":", "")
        if curRow == 0:
            # WRITE HEADER
            template = template_loader.load_template('template_events_header.html')
            output_TOC_file.write(
                template.render(
                    {
                        'initialtimeid': timeline_index_id
                    }, loader=template_loader
                ).encode('utf-8'))
        curRow += 1
        item_text = row[1]
        template = template_loader.load_template('template_events_item.html')
        output_TOC_file.write(
            template.render(            {
                'timestamp': timestamp,
                'itemText': item_text,
                'timeid': timeline_index_id
            }, loader=template_loader
            ).encode('utf-8'))

    # WRITE FOOTER
    template = template_loader.load_template('template_events_footer.html')
    output_TOC_file.write(template.render({'datarow': 0}, loader=template_loader).encode('utf-8'))
    output_TOC_file.close()


    #decode color crew names from converted events txt data (#TODO: this is quite fragile if naming isn't consisten within txt files)
    lastnameByColor = {}
    firstnameByColor = {}
    print('Decoding crew names')
    for event in eventList:
        for color in colors:
            colorEMUMatch = re.search(r'.*' + color.capitalize() + ' EMU.*', event)
            if colorEMUMatch is not None:
                subjectMatch = re.search(r'Subject (.*) (.*) selected', event)
                if subjectMatch is not None:
                    firstnameByColor[color] = subjectMatch.group(1)
                    lastnameByColor[color] = subjectMatch.group(2)
                    print(color + ' crew name: ' + firstnameByColor[color] + ' ' + lastnameByColor[color])


    #------------------
    #convert DBF data to JSON and csv for each color folder
    DBFTagnameData = []
    DBFWideData = []
    print('Processing DBF files')
    os.makedirs(runProcessedPath + '/telemetry', exist_ok=True)
    for color in colors:
        for file in os.listdir(runDBFPath + '/' + color):
            if fnmatch.fnmatch(file, '*(Tagname)*.DBF'):
                print('Importing ' + color.lower() + ' Tagname DBF')
                DBFTagnameData = [rec for rec in DBF(runDBFPath + '/' + color + '/' + file)]
                print('Writing ' + color.lower() + ' Tagname json')
                with open(runProcessedPath + '/telemetry/' + color.lower() + '_tagname.json', 'w') as outfile:
                    json.dump(DBFTagnameData, outfile, indent=4, default=str)

            if fnmatch.fnmatch(file, '*(Wide)*.DBF'):
                print('Importing ' + color.lower() + ' Wide DBF')
                DBFWideData = [rec for rec in DBF(runDBFPath + '/' + color + '/' + file)]

                #write all to one JSON
                # with open(runProcessedPath + '/' + color.lower() + '_wide.json', 'w') as outfile:
                #     json.dump(DBFData, outfile, indent=4, default=str)

                #write all to one CSV
                # writer = csv.writer(open(runProcessedPath + '/' + color.lower() + '_wide.csv', "w"), delimiter='|')
                # for record in DBFData:
                #     writer.writerow(list(record.values()))

                #write individual csvs, one for each data field
                for tagnameRec in DBFTagnameData:
                    print('Writing wide ' + color.lower() + "_" + str(tagnameRec['TTagIndex']) + '.csv')
                    writer = open(runProcessedPath + '/telemetry/' + color.lower() + '_' + str(tagnameRec['TTagIndex']) + '.csv', "w")
                    for wideRec in DBFWideData:
                        outputLine = '{0}|{1}|{2}\n'.format(wideRec['Time'], wideRec['Millitm'], wideRec[str(tagnameRec['TTagIndex'])])
                        writer.write(outputLine)
                    writer.close()

    #------------------
    #create project JSON
    projectDict = {}
    tempDict = {}
    tempDict['run_name'] = runName
    tempDict['start_datetime'] = datetime.strftime(earliestStartTime, "%Y-%m-%dT%H:%M:%S-06:00")
    tempDict['stop_datetime'] = datetime.strftime(latestStopTime, "%Y-%m-%dT%H:%M:%S-06:00")
    tempDict['duration_seconds'] = (latestStopTime - earliestStartTime).total_seconds()
    projectDict['run_metadata'] = tempDict.copy()

    tempDict = []
    for color in colors:
        tempDict2 = {}
        tempDict2['color'] = color.lower()
        tempDict2['firstname'] = firstnameByColor[color]
        tempDict2['lastname'] = lastnameByColor[color]
        #find corresponding last name in video data to infer EV number
        tempDict2['EV_number'] = EVByLastName[lastnameByColor[color].lower()]
        tempDict.append(tempDict2.copy())
    projectDict['colors'] = tempDict.copy()

    projectDict['videos'] = videoStreamList.copy()

    #write project JSON file
    with open(runProcessedPath + '/run_metadata.json', 'w') as outfile:
        json.dump(projectDict, outfile, indent=4, default=str)


print ('done')