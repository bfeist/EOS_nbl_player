import os, json, shutil, fnmatch, re

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
    runProcessedPath = runDataPath + '/' + runName + '/_processed'
    #create a fresh _processed folder in this run data folder
    # if os.path.isdir(runProcessedPath):
    #     shutil.rmtree(runProcessedPath)
    os.makedirs(runProcessedPath, exist_ok=True)

    #get video stream names from video file names of video first segments (000 in filename)
    videoStreamList = []
    runVideoFeedsPath = runDataPath + '/' + runName + '/video_feeds'
    lastStreamPrefix = ''
    for streamFilename in os.listdir(runVideoFeedsPath):
        if fnmatch.fnmatch(streamFilename, '*000.mp4'):
            filename_root = streamFilename[:-8]

            #get video start time
            match = re.search(r'\[(.*)_(.*)\]', filename_root)
            if match is not None:
                dateStr = match.group(1)
                timeStr = match.group(2).replace('-', ':')
                isoStartTime = dateStr + "T" + timeStr + '-06:00'
            else:
                raise NameError('Failed to find valid timestamp in video stream filename')

            #get crew sirname
            match = re.search(r'.*?-(.*?)-\[.*', filename_root)
            if match is not None:
                crewSirname = match.group(1).capitalize()
            else:
                raise NameError('Failed to parse sirname')

            #parse number of video segments
            maxDigitVal = 0
            for file in os.listdir(runVideoFeedsPath):
                pattern = '*' + crewSirname.upper() + '*.mp4'
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

            #assemble Dict object
            streamDict = {}

            streamDict['filename_root'] = filename_root
            streamDict['start_time'] = isoStartTime
            streamDict['number_of_segments'] = numberOfVideoSegments

            videoStreamList.append(streamDict.copy())

print ('done')
# print (videoStreamList)
