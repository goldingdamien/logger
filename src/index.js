const merge = require('deepmerge')
const { ajax } = require('jquery')

/*
Functionality:
1. console to localStorage
2. console to server
3. Failed action to server

Usage:
1. Automatically wrap console so everything sent to server: Just need to set logger.settings.server.url.
2. On arbitrary event, send data to server.
*/

class Logger {
  constructor (settings = {}) {
    this.state = {
      sendTimer: null,
      oldHandles: {},//Changed old handles
      logs: []
    }
    this.console = []//All old handles
    // Defaults
    this.settings = {
      error: {
        catchErrors: true,
        catchUncaughtPromiseRejections: true
      },
      console: {
        handleNames: {
          'log': true,
          'info': true,
          'error': true,
          'warn': true,
          'debug': true
        },
        output: true
      },
      server: {
        url: '',
        send: true,
        retryRate: 2000 // ms
      },
      localStorage: {
        max: 1000,
        saveOnFailure: true
      },
      element: {
        parent: null,
        max: 10000,
        outputForMobile: false,
        outputForAll: true
      },
      memory: {
        max: 10000,
        store: true
      }
    }
    this.events = {
      localStorageMax: null
    }

    this._setup(settings)
  }

  /**
   * Does initial setup
   */
  _setup (settings = {}) {
    this._setSettings(settings)
    this._setupConsole()
    this._setupErrors()
  }

  /**
   * Applies settings to currently set settings.
   */
  _setSettings (settings = {}) {
    this.settings = merge(this.settings, settings)
    // Non-merge-able properties
    this.settings.element.parent = settings.element.parent
  }

  /**
   * Sets up console handles.
   * NO USING console BEFORE THIS.
   */
  _setupConsole () {
    // Create console object if not exists
    if(!window.console){
      this.createMockConsole()
    }

    // Cache console
    for(let key in console){
      this.console[key] = console[key]
    }

    // Wrap
    const h = this.settings.console.handleNames
    for (let key in h) {
      this.state.oldHandles[key] = console[key]
      this._wrapConsoleHandle(key)
    }
  }

  /**
   * Setups errors
   */
  _setupErrors () {
    if (this.settings.error.catchErrors) {
      window.addEventListener('error', (...args) => {
        const errorData = getErrorFunctionData(...args)
        errorData.title = 'global error handling'
        console.error(errorData)
      })
    }

    if (this.settings.error.catchUncaughtPromiseRejections) {
      window.addEventListener('unhandledrejection', (event) => {
        const errorData = getUnhandleRejectionData(event)
        errorData.title = 'Unhandled rejection for promise'
        console.error(errorData)
      })
    }
  }

  /**
   * Wraps single console function
   * @param {String} handleName console function name
   * @return {Boolean} Whether successful or not
   */
  _wrapConsoleHandle (handleName) {
    if (!window.console || !window.console[handleName]) {
      return false
    }
    if (!this.settings.console.handleNames[handleName]) {
      return false
    }
    const handle = window.console[handleName]

    window.console[handleName] = (...args) => {
      const string = stringify(...args)

      if(this.settings.memory.store){
        this.storeLogInMemory(handleName, args)
      }

      if (this.settings.server.send && this.settings.server.url) {
        this.sendToServer(...args)
      }

      if (this.settings.element.outputForAll || (this.settings.element.outputForMobile && isMobile())) {
        this.output(string)
      }

      // Returns so should be last
      if (this.settings.console.output) {
        return handle(...args)
      }
    }

    return true
  }

  /**
   * Stores log in memory
   * @param {String} type
   * @param {Array} args
   */
  storeLogInMemory (type, args = []) {
    if(this.state.logs.length >= this.settings.memory.max){
      return
    }

    this.state.logs.push(
      {
        type: type,
        args: args
      }
    )
  }

  /**
   * Sends data to server.
   * Includes backup local storage for failure.
   * @param {*} args Arbitrary data
   * @return {Promise}
   */
  sendToServer (...args) {
    let data = this._formatConsoleData(args)
    const url = this.settings.server.url

    // Make same format
    data = toString(data)

    const onError = () => {
      this.storeLocally(data)
    }

    return ajax({
      url: url,
      method: 'POST',
      data: data,
      error: onError
    })
  }

  /**
   * Stores data locally.
   * If max reached, localStorageMax event triggered.
   * @param {String} data
   */
  storeLocally (data) {
    // Make same format
    data = toString(data)

    // Get next key
    let i = 0
    const max = this.settings.localStorage.max
    while (window.localStorage.getItem(i) !== undefined && i <= max) {
      i++
    }

    // Handle max
    if (i > max) {
      return this._handleLocalStorageMax(data)
    }

    // Set
    window.localStorage.setItem(i, data)

    // Make sure send timer set
    this.startSendTimer()
  }

  /**
   * Log using non-wrapped console functions
   */
  log(handleName, ...args){
    const handle = this.console[handleName]
    handle(...args)
  }

  /**
   * Handles local storage max event
   * @param {String} data
   */
  _handleLocalStorageMax (data) {
    if (typeof this.events.localStorageMax === 'function') {
      this.events.localStorageMax(data)
    }
  }

  /**
   * Sends localStorage data to server.
   * Currently sends ONLY 1 at a time. This could be slow so should send in batches in the future.
   */
  sendLocalStorageToServer () {
    const item = window.localStorage.getItem(0)
    if (item === undefined) {
      this.removeSendTimer()
      return false
    }

    this.sendToServer(item)
    shiftLocalStorage(1)
  }

  /**
   * Starts timer for sending localStorage data to server
   * @return {Number} interval
   */
  startSendTimer () {
    if (!this.state.sendTimer) {
      this.state.sendTimer = window.setInterval(this.sendLocalStorageToServer, this.settings.server.retryRate)
    }

    return this.state.sendTimer
  }

  /**
   * Removes timer(interval)
   * @return {Boolean} Whether an interval was removed or not
   */
  removeSendTimer () {
    if (!this.state.sendTimer) {
      return false
    }
    window.clearInterval(this.state.sendTimer)
    this.state.sendTimer = null

    return true
  }

  /**
   * Outputs to DOM.
   * This is useful for when it is not possible to view developer tools.
   * MUST BE FORMATTED BEFORE HERE.
   * @param {String} string
   */
  output (string) {
    const parent = this.settings.element.parent
    if (!parent) {
      return
    }

    if (parent.children.length >= this.settings.element.max) {
      return
    }

    const element = document.createElement('div')
    element.textContent = string

    parent.appendChild(element)
  }

  /**
   * Creates mock console object.
   * Can be used for environments(old IE, etc.) where console may not be initiated.
   */
  createMockConsole(){
    window.console = {
      info: ()=>{},
      log: ()=>{},
      debug: ()=>{},
      error: ()=>{},
      trace: ()=>{},
      warn: ()=>{}
    }
  }

  /**
   * Formats data for final storage.
   * Removes unnecessary data for storage and transfer.
   * @param {*} data
   * @return {*}
   */
  _formatConsoleData (data) {
    if (!Array.isArray(data)) {
      return data
    } else if (data.length === 1) {
      return data[0]
    } else {
      return data
    }
  }
}

if (typeof window === 'object') {
  window.Logger = Logger
}
if (typeof module === 'object') {
  module.exports = Logger
}

function toString (data) {
  return JSON.stringify(data) || String(data)
}

function isMobile () {
  return window.matchMedia('only screen and (max-width: 760px)').matches
}

/**
   * Shifts local storage by shiftCount using indexes starting from 0
   * @param {Number} shiftCount
   */
  function shiftLocalStorage (shiftCount) {
    let i

    // Move to array
    const data = []
    const keys = Object.keys(window.localStorage)
    while (keys.indexOf(String(i)) >= 0) {
      data[i] = window.localStorage.getItem(String(i))
      window.localStorage.removeItem(String(i))
      i++
    }

    // Remove items
    for (i = 0; i < shiftCount; i++) {
      data.shift()
    }

    // Add back to localStorage
    for (i = 0; i < data.length; i++) {
      window.localStorage.setItem(i, data[i])
    }
  }

  /**
   * Gets only data(no native objects) as one object.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onerror
   * @return {Object}
   */
  function getErrorFunctionData(...args){

    //onerror handling
    if(args.length >= 5 && args[4] instanceof Error){
      return {
        message: args[0],
        source: args[1],
        lineno: args[2],
        colno: args[3],
        error: getErrorData(args[4])
      }
    }else if(args[0] instanceof window.ErrorEvent){
      return getErrorEventData(args[0])
    }else{
      this.console.error('unknown error arguments received', ...args)
      return {}
    }
  }

  /**
   * Gets only data(no native object) as one object.
   * @param {ErrorEvent}
   * @return {Object}
   */
  function getErrorEventData(errorEvent){
    return {
      colno: errorEvent.colno,
      error: getErrorData(errorEvent.error),
      filename: errorEvent.filename,
      lineno: errorEvent.lineno,
      message: errorEvent.message
    }
  }

  /**
   * Gets only error data(no native objects) as one object
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
   * @param {Error} error
   * @return {Object}
   */
  function getErrorData(error){
    const data = {}
    const keys = [
      'message',
      'name',
      'description',
      'number',
      'fileName',
      'lineNumber',
      'columnNumber',
      'stack'
    ]
    keys.forEach(key => {
      if(error[key] !== undefined){
        data[key] = error[key]
      }
    })

    return data
  }

  /**
   * Gets only data form promise rejection event
   * @see https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
   * @param {PromiseRejectionEvent} event
   * @return {Object}
   */
  function getUnhandleRejectionData(event){
    const data = {}
    if(event.reason instanceof Error){
      data.reason = getErrorData(event.reason)
    }else{
      data.reason = event.reason
    }
    return data
  }
  
  function stringify(...args){
    if(args.length === 1){
      return JSON.stringify(args[0])
    }else{
      return JSON.stringify(args)
    }
  }