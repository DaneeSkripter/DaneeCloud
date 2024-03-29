const express = require('express')
const router = express.Router()
const router2 = express.Router()
const router3 = express.Router()
const {checkAuth, checkVerify} = require("../handlers/authVerify")
const users = require("../models/users");
const config = require("../config.json")
const logger = require("../handlers/logger")
const fs = require("fs")
const sanitize = require("sanitize-filename")
const osu = require("node-os-utils")
const ms = require("ms")
const rolesModel = require("../models/roles")
const apiKeys = require("../models/apiKeys")
const lang = require("../lang/default.json")
const moment = require("moment")
const axios = require("axios")

router.get("/", checkAuth, checkVerify, async function (req, res) {
    const user = await users.findOne({ username: req.user.username})
    const allusers = await users.find()
    if (user.role == "admin") {
      const roles = await rolesModel.find()
      const allApiKeys = await apiKeys.find()
      const cpu = osu.cpu
      const md5 = require("md5")
      const response = await axios.get("https://version.daneeskripter.dev/daneecloud/version.txt")
      cpu.usage().then((cpuUsage) => {
        res.render(__dirname + "/../views/admin.ejs", {users: allusers,  cloudname: config.cloudname, cpuUsage: cpuUsage, packages: require("../package.json"), stableVersion: response.data, ms: ms, roles: roles, config: config, apiKeys: allApiKeys, csrfToken: req.csrfToken(), md5: md5, lang: lang, moment: moment})
      })
    } else {
      res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-xmark"></i>&nbsp;${lang["Error401"]}`,  cloudname: config.cloudname, lang: lang})
    }
  })

router2.get("/:account", checkAuth, checkVerify, async function (req, res) {
    const account = sanitize(req.params.account)
    const loggeduser = await users.findOne({username: req.user.username})
    if (loggeduser.role == "admin") {
      const findusertodelete = await users.findOne({username: account})
      if (!findusertodelete) {
        res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-xmark"></i>&nbsp;${lang["Account-Not-Found"]}`,  cloudname: config.cloudname, lang: lang})
      } else {
        const usertodelete = await users.findOneAndRemove({ username: account})
        fs.rmdirSync(__dirname + "/.." + config.uploadsfolder + `${account}/`)
        res.render(__dirname + "/../views/message.ejs", {message: `<i class="fa-solid fa-square-check"></i>&nbsp;${lang["Account-Deleted2"].replace("${account}", account)}`,  cloudname: config.cloudname, lang: lang})
      }
    } else {
      res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-xmark"></i>&nbsp;${lang["Error401"]}`,  cloudname: config.cloudname, lang: lang})
      logger.logInfo(`${req.user.username} deleted account ${account}!`)
    }
  })


router3.get("/:account", checkAuth, checkVerify, function (req, res) {
    const account = req.params.account
    res.render(__dirname + "/../views/editaccount.ejs", { account: account,  cloudname: config.cloudname, editaccurl: "/editaccount/", csrfToken: req.csrfToken(), lang: lang})
  })
  
router3.post("/:account", checkAuth, checkVerify, async function (req, res) {
    const account = sanitize(req.params.account)
    const newaccountname = sanitize(req.body.newname)
    const newaccountemail = sanitize(req.body.newemail)
    const loggeduser = await users.findOne({ username: req.user.username})
    if (loggeduser.role == "admin") {
      const findusertorename = await users.findOne({username: account})
      if (!findusertorename) {
        res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-xmark"></i>&nbsp;${lang["Account-Not-Found"]}`,  cloudname: config.cloudname, lang: lang})
      } else {
      const usertorename = await users.findOneAndUpdate({username: account}, {username: newaccountname, email: newaccountemail})
      fs.renameSync(__dirname + config.uploadsfolder + `${account}/`, __dirname + config.uploadsfolder + `${newaccountname}/`)
      res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-check"></i>&nbsp;${lang["Account-Renamed"].replace("${account}", account).replace("${findusertorename.email}", findusertorename.email).replace("${newaccountname}", newaccountname).replace("${newaccountemail}", newaccountemail)}`,  cloudname: config.cloudname, lang: lang})
      logger.logInfo(`${account} with ${findusertorename.email} email has been renamed to ${newaccountname} with ${newaccountemail} email by ${req.user.username}`)
    }
    } else {
      res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-xmark"></i>&nbsp;${lang["Error401"]}`,  cloudname: config.cloudname, lang: lang})
    }
  })

module.exports.admin = router
module.exports.del = router2
module.exports.edit = router3