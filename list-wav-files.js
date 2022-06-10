const util = require('util');
const fs = require('fs');
const readFile = util.promisify(fs.readFile);
const readDir = util.promisify(fs.readdir)
const path = require('path');
const mustache = require('mustache')
const compression = require('compression')

module.exports = function(service) {
  service.get('/wavs.xml', compression(), (req, res) => { respond(req, res, 'collection') })
}

const servedExt = ".wav"
const dataDir = process.env.DATA_PATH || 'test'

var RetryENOENTCount = 0
var updateSequencesLock = false
var data = {}
var fileTemplate = ""

async function initModule() {
  fileTemplate = await readFile('public/files.xml.mustache', 'utf8')

  await updateSequences(dataDir, 'dataDir', 'init')
}

initModule()

async function updateSequences(currentDir, manifestName, origin) {
  if (updateSequencesLock) return
  updateSequencesLock = true
  var imageFiles = []
  await getAllFiles(currentDir, currentDir, await readDirRetryENOENT(currentDir, {withFileTypes: true}), imageFiles, manifestName)    
  data[manifestName] = imageFiles
  console.log(origin+': Found '+data[manifestName].length+' files in '+currentDir+' for manifest '+manifestName)
  updateSequencesLock = false
}

async function getAllFiles(rootDir, currentDir, subDirEnts, imageFiles, manifestName) {
    for (let subDirEnt of subDirEnts) {
        try {
            subDirEnt.name = path.resolve(currentDir, subDirEnt.name)
            if (subDirEnt.isDirectory()) {
                await getAllFiles(rootDir, subDirEnt.name, await readDirRetryENOENT(subDirEnt.name, { withFileTypes: true }), imageFiles, manifestName)
            } else if (subDirEnt.name.endsWith(servedExt) && subDirEnt.isFile()) {
                var pathParts = path.relative(dataDir, subDirEnt.name).split(path.sep)
                imageFiles.push({
                  path: pathParts.slice(0, -1).join('/'),
                  fileName: pathParts.slice(-1)
                })
            }
        }
        catch (err) {
            console.log(currentDir+' > '+subDirEnt.name+': '+err.toString())
        }
    }
}

async function readDirRetryENOENT(path, options) {
  var ret
  RetryENOENTCount++
  try {
      ret = await readDir(path, options)
  }
  catch (err) {
      if (err.code === 'ENOENT' && RetryENOENTCount <= 9) {
          console.log('Retry readDir')
          return await readDirRetryENOENT(path, options)
      }
      throw err
  }
  RetryENOENTCount = 0
  return ret
}

async function respond(req, res, type) {
  res.setHeader('Content-Type', 'application/xml');
  var ret = {}
  var retString = ""
  try {
    retString = mustache.render(fileTemplate, data)
    res.send(retString);
  } catch (err) {
      ret.data = data
      ret.err = err.toString()
      ret.stack = err.stack
      ret.tryed = retString
      res.setHeader('Content-Type', 'application/xml');        
      res.send(`<?xml version="1.0"?>
      <error>`+
         JSON.stringify(ret)+
      `</error>`, 500);
  }
}
