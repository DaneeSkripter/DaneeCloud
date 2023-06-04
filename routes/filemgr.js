const express = require('express')
const router = express.Router()
const router2 = express.Router()
const router3 = express.Router()
const router4 = express.Router()
const {checkAuth, checkVerify} = require("../handlers/authVerify")
const users = require("../models/users");
const config = require("../config.json")
const logger = require("../handlers/logger")
const fs = require("fs")
const sanitize = require("sanitize-filename")
const isimg = require("is-image")
const isvid = require("is-video")
const roles = require("../models/roles")
const isaudio = require("is-audio")
const vidSubtitles = require("../models/vidsubtitles")
const lang = require("../lang/default.json")

router.get("/", checkAuth, checkVerify, async function (req, res) {
    const user = await users.findOne({username: req.user.username})
    const role = await roles.findOne({name: user.role})
    const files = user.files
    const sharedFiles = user.sharedFiles
    const folders = user.folders
    res.render(__dirname + "/../views/myfiles.ejs", {files: files,  cloudname: config.cloudname, fs: fs, config: config, req: req, __dirname: __dirname, isImg: isimg, Buffer: Buffer, sharedFiles: sharedFiles, isVid: isvid, maxStorage: role.maxStorage, usedStorage: user.usedStorage, isAudio: isaudio, vidSubtitles: vidSubtitles, lang: lang, folders: folders})
  })



router2.get("/:file", checkAuth, checkVerify, function (req, res) {
    const file = sanitize(req.params.file)
    fs.readFile( __dirname + "/.." + config.uploadsfolder + `${req.user.username}/` + file, async (err, data) =>{
      if (err) {
        res.render(__dirname + "/../views/message.ejs", {message: `<span class="material-icons">cloud_off</span>&nbsp;${lang["File-Not-Found"].replace("${file}", file)}`,  cloudname: config.cloudname, lang: lang})
      } else {
        const user = await users.findOne({ username: req.user.username})
        const filesize = Math.floor(fs.statSync(__dirname + "/.."  + config.uploadsfolder + `${req.user.username}/` + file).size / (1024 * 1024))
        const updateStorage = await users.findOneAndUpdate({ username: req.user.username}, {usedStorage: user.usedStorage - filesize})
        fs.unlinkSync(__dirname + "/.." + config.uploadsfolder + `${req.user.username}/` + file)
        user.files.pull(file)
        if (user.sharedFiles.includes(file)) {
          user.sharedFiles.pull(file)
        }
        user.save()
        res.redirect("/myfiles")
        logger.logInfo(`${req.user.username} deleted ${file}!`)
      }
    })
  })

router3.get("/:file", checkAuth, checkVerify, function (req, res) {
  const file = req.params.file
  if (fs.readdirSync(__dirname + "/.." + config.uploadsfolder + `${req.user.username}/`).includes(file)) {
    res.render(__dirname + "/../views/rename.ejs", { file: file,  cloudname: config.cloudname, csrfToken: req.csrfToken(), lang: lang})
  } else {
    res.render(__dirname + "/../views/message.ejs", {message: `<span class="material-icons">cloud_off</span>&nbsp;${lang["File-Not-Found"].replace("${file}", file)}`,  cloudname: config.cloudname, lang: lang})
  }
})

router3.post("/:file", checkAuth, checkVerify, async function (req, res) {
  const oldname = sanitize(req.params.file)
  const newname = sanitize(req.body.newname.replace(/ /g, "_")) + "." + oldname.split(".").pop()
  fs.renameSync(__dirname + "/.." + config.uploadsfolder + `${req.user.username}/` + oldname, __dirname + "/.."  + config.uploadsfolder + `${req.user.username}/` + newname)
  const user = await users.findOne({ username: req.user.username})
  user.files.pull(oldname)
  user.files.push(newname)
  if (user.sharedFiles.includes(oldname)) {
    user.sharedFiles.pull(oldname)
    user.sharedFiles.push(newname)
  }
  user.save()
  res.render(__dirname + "/../views/message.ejs", {message: `<span class="material-icons">cloud_done</span>&nbsp;${lang["File-Renamed"].replace("${oldname}", oldname).replace("${newname}", newname)}`,  cloudname: config.cloudname, lang: lang})
  logger.logInfo(`${req.user.username} renamed ${oldname} to ${newname}!`)
})

router4.get("/", checkAuth, checkVerify, function (req, res) {
  res.render(__dirname + "/../views/createFolder.ejs", {cloudname: config.cloudname, lang: lang, csrfToken: req.csrfToken()})
})

router4.post("/", checkAuth, checkVerify, async function (req, res) {
  const username = req.user.username
  const checkFolder = await fs.readdirSync(__dirname + "/.." + config.uploadsfolder + `${username}/`)
  if (checkFolder.includes(req.body.name)) {
    res.render(__dirname + "/../views/message.ejs", {message: `<span class="material-icons">cloud_off</span>&nbsp;${lang["Folder-Exist"]}`,  cloudname: config.cloudname, lang: lang})
  } else {
    const createFolder = await fs.mkdirSync(__dirname + "/.." + config.uploadsfolder + `${username}/` + req.body.name)
    const user = await users.findOne({username: username})
    user.folders.push(req.body.name)
    user.save()
    res.render(__dirname + "/../views/message.ejs", {message: `<span class="material-icons">cloud_done</span>&nbsp;${lang["Folder-Created"].replace("${req.body.name}", req.body.name)}`,  cloudname: config.cloudname, lang: lang})
  }
})
module.exports.myfiles = router
module.exports.del = router2
module.exports.ren = router3
module.exports.createfolder = router4