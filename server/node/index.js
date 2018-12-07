const fs = require('fs')
const path = require('path')
const moment = require('moment')

const express = require('express')
const app = express()
const port = 3000
const MAX_BYTES = 1024 * 1024// 1MB
/*
Example time formats:
Milliseconds: 'YYYY-MM-DD_HH-mm-ss_SSS'
Seconds: 'YYYY-MM-DD_HH-mm-ss'
Day: 'YYYY-MM-DD'
Year: 'YYYY'
*/
const TIME_FORMAT = 'YYYY-MM-DD'
const CORS_SETTINGS = {origin: 'localhost:8080'}

var cors = require('cors')

function setupExpress () {
  // app.options('*', cors())
  // app.use(cors())
  app.get('/', cors(CORS_SETTINGS), (req, res) => {
    const data = req.params.data
    console.log('data', data)
    const response = handleData(data)
    res.send(response)
  })
  app.listen(port, () => console.log(`App listening on port ${port}!`))
}

function handleData (data) {
  if (data.length === 0) {
    console.warn('no data')
    return false
  }
  if (getBytes(data) > MAX_BYTES) {
    console.warn('too large')
    return false
  }
  save(data)
  return true
}

function getBytes (string) {
  return Buffer.byteLength(string, 'utf8')
}

function save (str) {
  const fileName = getReadableTimestampFileName()
  const EXTENSION = '.txt'
  const url = path.join(__dirname, 'log', `${fileName}${EXTENSION}`)

  fs.writeFile(url, str, {flag: 'a'}, console.log)
}

function getReadableTimestampFileName () {
  const date = moment().format(TIME_FORMAT)
  return date.toString()
}

setupExpress()
