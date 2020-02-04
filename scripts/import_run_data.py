import os, json, shutil

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
for run_name in runList:
    #create a fresh _processed folder in this run data folder
    if os.path.isdir(runDataPath + '/' + run_name + '/_processed'):
        shutil.rmtree(runDataPath + '/' + run_name + '/_processed')
    os.mkdir(runDataPath + '/' + run_name + '/_processed')
