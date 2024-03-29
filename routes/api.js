const express = require("express") 
const router = express.Router()
const router2 = express.Router()
const router3 = express.Router()
const users = require("../models/users");
const config = require("../config.json")
const logger = require("../handlers/logger")
const fs = require("fs")
const sanitize = require("sanitize-filename")
const apiKeys = require("../models/apiKeys")
const bcrypt = require("bcrypt")
const roles = require("../models/roles")
const { transporter } = require("../handlers/smtpconfig")
const osu = require("node-os-utils")
const ms = require("ms")
const packages = require("../package.json");
const { checkAuth, checkVerify } = require("../handlers/authVerify");
const lang = require("../lang/default.json")

router.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, API-Key')
  next()
})

async function keyAuth(req, res, next) {
    const APIKey = req.get("API-Key")
    const findAPIKey = await apiKeys.findOne({apiKey: APIKey})
    if (findAPIKey) {
        next()
    } else {
        res.status(401).json({error: "Error 401 - Unauthorized"})
    }
}

function makeid(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

// ADD API KEY

router2.get("/", checkAuth, checkVerify, async function (req, res) {
    const user = await users.findOne({username: req.user.username})
    if (user.role == "admin") {
        res.render(__dirname + "/../views/addapikey.ejs", {cloudname: config.cloudname, csrfToken: req.csrfToken(), lang: lang})
    } else {
        res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-xmark"></i>&nbsp;${lang["Error401"]}`,  cloudname: config.cloudname, lang: lang})
    }
})

router2.post("/", checkAuth, checkVerify, async function (req, res) {
    const user = await users.findOne({username: req.user.username})
    const apiKeyName = req.body.name
    const apiKey = makeid(25)
    if (user.role == "admin") {
        const findAPIKey = await apiKeys.findOne({ name: apiKeyName})
        if (findAPIKey) {
            res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-xmark"></i>&nbsp;${lang["API-Key-Exist"]}`,  cloudname: config.cloudname, lang: lang})
        } else {
            const ApiKey = new apiKeys({
                name: apiKeyName,
                apiKey: apiKey.toString()
            })
            ApiKey.save()
            res.render(__dirname + "/../views/message.ejs", {message: `<i class="fa-solid fa-square-check"></i>&nbsp;${lang["API-Key-Generated"].replace("${apiKeyName}", apiKeyName).replace("${apiKey.toString()}", apiKey.toString())}`,  cloudname: config.cloudname, lang: lang})
        }
    } else {
        res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-xmark"></i>&nbsp;${lang["Error401"]}`,  cloudname: config.cloudname, lang: lang})
    }
})

// DELETE API KEY

router3.get("/:name", checkAuth, checkVerify, async function (req, res) {
    const user = await users.findOne({username: req.user.username})
    const apiKeyName = req.params.name
    const findApiKey = await apiKeys.findOne({name: apiKeyName})
    if (user.role == "admin") {
        if (!findApiKey) {
            res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-xmark"></i>&nbsp;${lang["API-Key-Not-Found"]}`,  cloudname: config.cloudname, lang: lang})
        } else {
                const deleteApiKey = await apiKeys.findOneAndRemove({ name: apiKeyName})
                res.render(__dirname + "/../views/message.ejs", {message: `<i class="fa-solid fa-square-check"></i>&nbsp;${lang["API-Key-Deleted"].replace("${apiKeyName}", apiKeyName)}`,  cloudname: config.cloudname, lang: lang})
            }
    } else {
        res.render(__dirname + "/../views/message.ejs", { message: `<i class="fa-solid fa-square-xmark"></i>&nbsp;${lang["Error401"]}`,  cloudname: config.cloudname, lang: lang})
    }
})

// API: USER

router.get("/user", keyAuth, async function (req, res) {
    const User = await users.findOne({ username: sanitize(req.query.username)})
    if (User) {
        res.status(200).send(User)
        logger.logInfo(`${req.query.username}'s account details was requested via API`)
    } else { 
        res.status(404).json({error: "Error 404 - User not found"})
    }
})

router.get("/user/all", keyAuth, async function (req, res) {
    const allusers = await users.find()
    res.status(200).send(allusers)
    logger.logInfo("All users were requested via API")
})

router.post("/user/create", keyAuth, async function (req, res) {
    const username = sanitize(req.query.username)
    const findUser = await users.findOne({username: sanitize(req.query.username)})
    if (findUser) {
           res.status(409).json({msg: "Response 409 - Already exist"})
    } else {
    const email = req.query.email
    const password = req.query.password
    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = new users({
        username: username,
        email: email,
        password: hashedPassword,
        id: Date.now().toString(),
        files: [],
        isVerified: false,
        verifyCode: null,
        sharedFiles: [],
        usedStorage: 0,
        role: "user"
    })
    newUser.save()
    fs.mkdirSync(__dirname + "/../uploads/" + username)
    res.status(201).json({msg: "Response 201 - Created"})
    logger.logInfo(`New user ${username} was created via API`)
    }
})

router.post("/user/delete", keyAuth, async function (req, res) {
    const findUser = await users.findOne({ username: sanitize(req.query.username)})
    if (findUser) {
        const deleteUser = await users.findOneAndRemove({ username: sanitize(req.query.username)})
        fs.rmdirSync(__dirname + "/.." + config.uploadsfolder + `${sanitize(req.query.username)}/`)
        res.status(200).json({msg: "Response 200 - OK"})
        logger.logInfo(`User ${req.query.username} was deleted via API`)
    } else {
        res.status(404).json({error: "Error 404 - User not found"})
    }

})


router.post("/user/edit/", keyAuth, async function (req, res) {
    const username = req.query.username
    const newusername = req.query.newusername
    const newemail = req.query.newemail
    const newpassword = req.query.newpassword
    const hashedpassword = await bcrypt.hash(newpassword, 10)
    const findUser = await users.findOne({username: sanitize(username)})
    if (findUser) {
        const updateUser = await users.findOneAndUpdate({username: sanitize(username)}, {
            username: sanitize(newusername),
            email: sanitize(newemail),
            password: sanitize(hashedpassword)
        })
        fs.renameSync(__dirname + "/.." + config.uploadsfolder + `${sanitize(req.query.username)}/`, __dirname + "/.." + config.uploadsfolder + `${sanitize(req.query.newusername)}/`)
        res.status(201).json({msg: "Response 201 - User edited"})
        logger.logInfo(`User ${username} was edited via API (New username: ${newusername}, New email: ${newemail})`)
    } else {
        res.status(404).json({error: "Error 404 - User not found"})
    }

})

router.post("/user/role", keyAuth, async function (req, res) {
    const rolename = req.query.name
    const username = req.query.username
    const findUser = await users.findOne({username: sanitize(username)})
    const findRole = await roles.findOne({name: sanitize(rolename)})
    if (findUser) {
        if (!findRole) {
            res.status(404).json({error: "Error 404 - Role not found"})
        } else {
        const updateUser = await users.findOneAndUpdate({username: sanitize(username)}, {role: sanitize(rolename)})
        res.status(201).json({msg: "Response 201 - User role changed"})
        logger.logInfo(`Role of user ${username} was changed to ${rolename} via API`)
        }
    } else {
        res.status(404).json({error: "Error 404 - User not found"})
    }
})

router.post("/user/verify", keyAuth, async function (req, res) {
    const username = req.query.username
    const verifycode = Math.floor(Math.random() * 9000) + 1000
    const user = await users.findOne({ username: sanitize(username)})
    if (!user) {
        res.status(404).json({error: "Error 404 - User not found"})
    } else {
    const addverifycode = await users.findOneAndUpdate({username: sanitize(username)}, {verifyCode: verifycode.toString()}) 
    transporter.sendMail({
        from: {
        name: config.cloudname + " | Verify",
        address: process.env.emailSender
        },
        to: user.email,
        subject: "Verify your account",
        text: "Hello,\n please verify your account with this code: " + verifycode.toString() + "\n If you didn't registered on " + config.cloudurl + ", ignore this mail.\nThe code will expire in next 10 minutes.\n\n\nRegards,\nVerification bot from " + config.cloudname
        }, function (error, info) {
        if (error) {
        logger.logError(error)
        } else {
          logger.logInfo("Verification email has been sent to " + user.email)
          setTimeout(async () => {
            const removeverifycode = await users.findOneAndUpdate({username: req.user.username}, {verifyCode: null})
          }, 600000);
        }
        })
        res.status(200).json({msg: "Verification email has been sent to " + user.email})
    }
})

// API: FILES

router.get("/files/", keyAuth, async function (req, res) {
    const username = req.query.username
    const findUser = await users.findOne({username: sanitize(username)})
    if (findUser) {
        const files = findUser.files
        res.status(200).json({files: files})
        logger.logInfo(`${username}'s files was requested via API`)
    } else {
         res.status(404).json({error: "Error 404 - User not found"})
    }
})

router.post("/files/delete/", keyAuth, async function (req, res) {
    const username = sanitize(req.query.username)
    const file = req.query.file
    const findUser = await users.findOne({username: username})
    if (findUser) {
        if (findUser.files.includes(file)) {
            findUser.files.pull(file)
            fs.unlinkSync(__dirname + "/.." + config.uploadsfolder + `${username}/` + file)
            if (findUser.sharedFiles.includes(file)) {
                findUser.sharedFiles.pull(file)
            }
            findUser.save()
            res.status(200).json({msg: "Response 200 - OK"})
            logger.logInfo(`${username}'s file ${file} was deleted via API`)
        } else {
            res.status(404).json({error: "Error 404 - File not found"})
        }
    } else {
        res.status(404).json({error: "Error 404 - User not found"})
    }
})

router.post("/files/rename/", keyAuth, async function (req, res) {
    const username = sanitize(req.query.username)
    const file = sanitize(req.query.file)
    const newname = sanitize(req.query.newname)
    const findUser = await users.findOne({username: username})
    if (findUser) {
        if (findUser.files.includes(file)) {
            findUser.files.pull(file)
            findUser.files.push(newname)
            fs.renameSync(__dirname + "/.." + config.uploadsfolder + `${username}/` + file, __dirname + "/.."  + config.uploadsfolder + `${username}/` + newname)
            if (findUser.sharedFiles.includes(file)) {
                findUser.sharedFiles.pull(file)
                findUser.sharedFiles.push(newname)
            }
            findUser.save()
            res.status(201).json({msg: "Response 201 - File renamed"})
            logger.logInfo(`${username}'s file ${file} was renamed to ${newname} via API`)
        } else {
        res.status(404).json({error: "Error 404 - File not found"})
        }
    } else {
        res.status(404).json({error: "Error 404 - User not found"})
    }
})

router.post("/files/share/", keyAuth, async function (req, res) {
    const username = sanitize(req.query.username)
    const file = req.query.file
    const findUser = await users.findOne({username: username})
    if (findUser) {
        if (findUser.files.includes(file)) {
            if (findUser.sharedFiles.includes(file)) {
                res.status(409).json({error: "Error 409 - File already exist in sharedFiles"})
            } else {
                findUser.sharedFiles.push(file)
                findUser.save()
                res.status(201).json({msg: "Response 200 - File shared"})
                logger.logInfo(`${username}'s file ${file} was set as shared via API`)
            }
        } else {
            res.status(404).json({error: "Error 404 - File not found"})
        }
    } else {
        res.status(404).json({error: "Error 404 - User not found"})
    }
})

router.post("/files/noshare/", keyAuth, async function (req, res) {
    const username = sanitize(req.query.username)
    const file = req.query.file
    const findUser = await users.findOne({username: username})
    if (findUser) {
        if (findUser.files.includes(file)) {
            if (!findUser.sharedFiles.includes(file)) {
                res.status(404).json({error: "Error 404 - File not found in sharedFiles"})
            } else {
                findUser.sharedFiles.pull(file)
                findUser.save()
                res.status(201).json({msg: "Response 201 - File set as not shared"})
                logger.logInfo(`${username}'s file ${file} was set as not shared via API`)
            }
        } else {
            res.status(404).json({error: "Error 404 - File not found"})
        }
    } else {
        res.status(404).json({error: "Error 404 - User not found"})
    }
})

// API: ROLES

router.get("/role/", keyAuth, async function (req, res) {
    const rolename = sanitize(req.query.name)
    const role = await roles.findOne({ name: rolename})
    if (role) {
        res.status(200).send(role)
        logger.logInfo(`${role.name}'s details were requested via API`)
    } else {
        res.status(404).json({error: "Error 404 - Role not found"})
    }
})

router.get("/role/all/", keyAuth, async function (req, res) {
    const allroles = await roles.find()
    res.status(200).send(allroles)
    logger.logInfo(`All roles were requested via API`)
})

router.post("/role/create", keyAuth, async function (req, res) {
    const rolename = sanitize(req.query.name)
    const maxStorage = req.query.maxStorage
    const badgeUrl = req.query.badge
    const findRole = await roles.findOne({name: rolename})
    if (findRole) {
        res.status(409).json({error: "Error 409 - Role already exist"})
    } else {
    const role = new roles({
        name: rolename,
        maxStorage: Number(maxStorage),
        badge: badgeUrl
    })
    role.save()
    res.status(201).json({msg: "Response 201 - Role created"})
    logger.logInfo(`Role ${rolename} was created via API`)
}
})

router.post("/role/delete", keyAuth, async function (req, res) {
    const rolename = sanitize(req.query.name)
    const findRole = await roles.findOne({ name: rolename})
    if (findRole) {
        if (rolename == "admin" || rolename == "user") {
            res.status(409).json({error: "Error 409 - You can't delete admin or user role"})
        } else {
    const deleteRole = await roles.findOneAndRemove({ name: rolename })
    res.status(200).json({msg: "Response 200 - Role deleted"})
    logger.logInfo(`Role ${rolename} was deleted via API`)
        }
    } else {
        res.status(404).json({error: "Error 404 - Role not found"})
    }
})

router.post("/role/edit", keyAuth, async function (req, res) {
    const rolename = sanitize(req.query.name)
    const newname = sanitize(req.query.newname)
    const newmaxStorage = sanitize(req.query.maxStorage)
    const newbadgeUrl = req.query.badge
    const findRole = await roles.findOne({ name: rolename})
    if (findRole) {
        if (rolename == "admin" || rolename == "user") {
           res.status(409).json({error: "Error 409 - You can't edit admin or user role"})
        } else {
    const updateRole = await roles.findOneAndUpdate({ name: rolename}, { name: newname, maxStorage: newmaxStorage, badge: newbadgeUrl})
    res.status(201).json({msg: "Response 201 - Role edited"})
    logger.logInfo(`Role ${rolename} was edited via API`)
        }
    } else {
        res.status(404).json({error: "Error 404 - Role not found"})
    }
})

// API: DASHBOARD

router.get("/dash", keyAuth, async function (req, res) {
    const cpu = osu.cpu
    const ram = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    const uptime = ms(ms(Math.floor(process.uptime()).toString() + "s"), {long: true})
    cpu.usage().then((cpuUsage) => {
        res.status(200).json({cpuUsage: `${cpuUsage.toString()} %`, ramUsage: `${ram} MB`, uptime: uptime, version: `v${packages.version}`, developer: "DaneeSkripter", license: "MIT"})
    })

})

// API: FOLDERS

router.get("/folders/", keyAuth, async function (req, res) {
    const username = sanitize(req.query.username)
    const user = await users.findOne({username: username})
    if (user) {
        const folders = user.folders
        res.status(200).json({folders: folders})
        logger.logInfo(`${username}'s folders were requested via API`)
    } else {
         res.status(404).json({error: "Error 404 - User not found"})
    }
})

router.get("/folders/files", keyAuth, async function (req, res) {
    const username = santize(req.query.username)
    const folder = req.query.folder
    const user = await users.findOne({username: username})
    if (user) {
    const checkFolder = await fs.readdirSync(__dirname + "/.." + config.uploadsfolder + `${username}/`)
    if (checkFolder.includes(folder)) {
    const files = await fs.readdirSync(__dirname + `/../${config.uploadsfolder}/${sanitize(username)}/${sanitize(folder)}`)
    res.status(200).json({files: files})
    logger.logInfo(`${username}'s files in ${folder} were requested via API`)
    } else {
        res.status(404).json({error: "Error 404 - Folder not found"})
    }
    } else {
        res.status(404).json({error: "Error 404 - User not found"})
    }
})

router.post("/folders/create", keyAuth, async function (req, res) {
    const username = sanitize(req.query.username)
    const folder = req.query.folder
    const user = await users.findOne({username: username})
    if (user) { 
        const checkFolder = await fs.readdirSync(__dirname + "/.." + config.uploadsfolder + `${username}/`)
        if (checkFolder.includes(folder)) {
            res.status(409).json({error: "Error 409 - Folder already exist"})
        } else {        
        const createFolder = await fs.mkdirSync(__dirname + `/../${config.uploadsfolder}/${sanitize(username)}/${sanitize(folder)}`)
        user.folders.push(folder)
        user.save()
        res.status(201).json({msg: "Response 201 - Folder created"})
        logger.logInfo(`Folder ${folder} was created via API for ${username}`)
        }
        } else {
            res.status(404).json({error: "Error 404 - User not found"})
        }
})

router.post("/folders/delete", keyAuth, async function (req, res) {
    const username = sanitize(req.query.username)
    const folder = req.query.folder
    const user = await users.findOne({username: username})
    if (user) { 
        const checkFolder = await fs.readdirSync(__dirname + "/.." + config.uploadsfolder + `${username}/`)
        if (checkFolder.includes(folder)) {
            const deleteFolder = await fs.rmdirSync(__dirname + `/../${config.uploadsfolder}/${sanitize(username)}/${sanitize(folder)}`)
            user.folders.pull(folder)
            user.save()
            res.status(200).json({msg: "Response 200 - Folder deleted"})
            logger.logInfo(`${username}'s folder ${folder} was deleted!`)
        } else {
            res.status(404).json({error: "Error 404 - Folder not found"})
        }
        } else {
            res.status(404).json({error: "Error 404 - User not found"})
        }
})

router.post("/folders/files/rename", keyAuth, async function (req, res) {
    const username = sanitize(req.query.username)
    const folder = req.query.folder
    const file = req.query.file
    const newname = sanitize(req.query.newname)
    const user = await users.findOne({username: username})
    if (user) {
    const checkFolder = await fs.readdirSync(__dirname + "/.." + config.uploadsfolder + `${username}/`)
    if (checkFolder.includes(folder)) {
        const checkFile = await fs.readdirSync(__dirname + `/../${config.uploadsfolder}/${sanitize(username)}/${sanitize(folder)}`)
        if (checkFile.includes(file)) {
            const renameFile = await fs.renameSync(__dirname + `/../${config.uploadsfolder}/${sanitize(username)}/${sanitize(folder)}/${file}`, __dirname + `/../${config.uploadsfolder}/${sanitize(username)}/${sanitize(folder)}/${newname}`)
            res.status(201).json({msg: `Response 201 - File renamed`})
            logger.logInfo(`${username}'s file ${file} in folder ${folder} was renamed to ${newname} via API`)
        } else {
            res.status(404).json({error: "Error 404 - File not found"})
        }
    } else {
        res.status(404).json({error: "Error 404 - Folder not found"})
    }
    } else {
        res.status(404).json({error: "Error 404 - User not found"})
    }
})

router.post("/folders/files/delete", keyAuth, async function (req, res) {
    const username = sanitize(req.query.username)
    const folder = req.query.folder
    const file = req.query.file
    const user = await users.findOne({username: username})
    if (user) {
    const checkFolder = await fs.readdirSync(__dirname + "/.." + config.uploadsfolder + `${username}/`)
    if (checkFolder.includes(folder)) {
        const checkFile = await fs.readdirSync(__dirname + `/../${config.uploadsfolder}/${sanitize(username)}/${sanitize(folder)}`)
        if (checkFile.includes(file)) { 
            const deleteFile = await fs.rmSync(__dirname + `/../${config.uploadsfolder}/${sanitize(username)}/${sanitize(folder)}/${file}`)
            res.status(200).json({msg: `Response 200 - File deleted`})
            logger.logInfo(`${username}'s file ${file} in folder ${folder} was deleted via API`)
        } else {
            res.status(404).json({error: "Error 404 - File not found"})
        }
    } else {
        res.status(404).json({error: "Error 404 - Folder not found"})
    }
    } else {
        res.status(404).json({error: "Error 404 - User not found"})
    }
})

module.exports.api = router
module.exports.addkey = router2
module.exports.delkey = router3