import os, json, shutil, fnmatch, re, time
from datetime import datetime
from dbfread import DBF
import csv

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

    #------------------
    #process video feed data using file names of video first segments (000 in filename)
    videoStreamList = []
    runVideoFeedsPath = runDataPath + '/' + runName + '/video_feeds'
    lastStreamPrefix = ''
    earliestStartTime = datetime.now()
    for streamFilename in os.listdir(runVideoFeedsPath):
        if fnmatch.fnmatch(streamFilename, '*000.mp4'):
            filename_root = streamFilename[:-8]
            print("Processing video: " + filename_root)

            #get video start time
            match = re.search(r'\[(.*)_(.*)\]', filename_root)
            if match is not None:
                dateStr = match.group(1)
                timeStr = match.group(2).replace('-', ':')
                isoStartTime = dateStr + "T" + timeStr + '-06:00'
                print("Video start time: " + isoStartTime)

                #track time of earliest video - this is the run start time
                isoStartTimeTimeObj = datetime.strptime(isoStartTime, "%Y-%m-%dT%H:%M:%S-06:00")
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
                print("Video segments: " + str(numberOfVideoSegments))

            #assemble Dict object
            streamDict = {}

            streamDict['stream_name'] = streamName
            streamDict['filename_root'] = filename_root
            streamDict['start_time'] = isoStartTime
            streamDict['number_of_segments'] = numberOfVideoSegments

            videoStreamList.append(streamDict.copy())


    #------------------
    #process run DBF telemetry
    runDBFPath = runDataPath + '/' + runName + '/DBF_telemetry'

    #get array of color values for this run
    colors = []
    print('Processing colors')
    for file in os.listdir(runDBFPath):
        if os.path.isdir(os.path.join(runDBFPath, file)):
            colors.append(file)
            print('Color found: ' + file)

    #process event txt files into _processed/system_events.csv
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
            timeVal = time.strptime(runName[0:10] + " " + match.group(1), "%Y-%m-%d %I:%M:%S %p")
            # if len(timeStamp) == 10:
            #     timeStamp = "0" + timeStamp
            message = match.group(2)
            isoTimeStr = time.strftime("%Y-%m-%dT%H:%M:%S-06:00", timeVal)
            eventDataRow = isoTimeStr + '|' + message
            eventList.append(eventDataRow)
    eventList.sort()
    f = open(runProcessedPath + "/system_events.csv", "w")
    print('Writing consolidated event list in ' + runProcessedPath + '/system_events.csv')
    for event in eventList:
        f.write(event + '\n')
    f.close()

    #decode color crew names from converted events txt data (#TODO: this is quite crude)
    sirnameByColor = {}
    firstnameByColor = {}
    print('Decoding crew names')
    for event in eventList:
        for color in colors:
            colorEMUMatch = re.search(r'.*' + color.capitalize() + ' EMU.*', event)
            if colorEMUMatch is not None:
                subjectMatch = re.search(r'Subject (.*) (.*) selected', event)
                if subjectMatch is not None:
                    firstnameByColor[color] = subjectMatch.group(1)
                    sirnameByColor[color] = subjectMatch.group(2)
                    print(color + ' crew name: ' + firstnameByColor[color] + ' ' + sirnameByColor[color])


    #------------------
    #convert DBF data to JSON for each color folder
    DBFTagnameData = []
    DBFWideData = []
    print('Converting DBF files to JSON')
    for color in colors:
        for file in os.listdir(runDBFPath + '/' + color):
            if fnmatch.fnmatch(file, '*(Tagname)*.DBF'):
                print('Importing Tagname DBF')
                DBFTagnameData = [rec for rec in DBF(runDBFPath + '/' + color + '/' + file)]
                print('Writing Tagname json')
                with open(runProcessedPath + '/' + color.lower() + '_tagname.json', 'w') as outfile:
                    json.dump(DBFTagnameData, outfile, indent=4, default=str)

            if fnmatch.fnmatch(file, '*(Wide)*.DBF'):
                print('Reading Wide DBF')
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
                    print('Writing ' + color.lower() + "_" + str(tagnameRec['TTagIndex']) + '.csv')
                    writer = open(runProcessedPath + '/' + color.lower() + '_' + str(tagnameRec['TTagIndex']) + '.csv', "w")
                    for wideRec in DBFWideData:
                        outputLine = '{0}|{1}|{2}\n'.format(wideRec['Time'], wideRec['Millitm'], wideRec[str(tagnameRec['TTagIndex'])])
                        writer.write(outputLine)
                    writer.close()

print ('done')
# print (videoStreamList)
