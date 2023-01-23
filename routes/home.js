const express = require('express')
const router = express.Router()
const {checkAuth, checkVerify} = require("../handlers/authVerify")
const users = require("../models/users");
const config = require("../config.json")

router.get("/", checkAuth , checkVerify, async function (req, res) {
    const user = await users.findOne({username: req.user.username})
    let isAdmin;
    if (user.isAdmin == true) {
      isAdmin = true
    } else {
      isAdmin = false
    }
    res.render(__dirname + "/../views/index.ejs", {isAdmin: isAdmin, username: req.user.username, cloudname: config.cloudname} )
  })

module.exports = router