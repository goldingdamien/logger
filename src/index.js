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
      oldHandles: {}
    }
    this.console = {}
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
        outputForMobile: false
      }
    }
    this.events = {
      localStorageMax: null
    }

    this._setup(settings)
  }

  _setup (settings = {}) {
    this._setSettings(settings)
    this._setupConsole()
    this._setupErrors()
  }

  _setSettings (settings = {}) {
    this.settings = merge(this.settings, settings)
    // Non-merge-able properties
    this.settings.element.parent = settings.element.parent
  }

  /**
   * Sets up console handles
   */
  _setupConsole () {
    const h = this.settings.console.handleNames
    for (let key in h) {
      this.console[key] = console[key]
      this._wrapConsoleHandle(key)
    }
  }

  _setupErrors () {
    if (this.settings.error.catchErrors) {
      window.addEventListener('error', function () {
        console.error('global error handling', arguments)
      })
    }

    if (this.settings.error.catchUncaughtPromiseRejections) {
      window.addEventListener('unhandledrejection', function (event) {
        console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').')
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
      if (this.settings.server.send && this.settings.server.url) {
        this.sendToServer(...args)
      }

      if (this.settings.element.outputForMobile) {
        this.outputForMobile(...args)
      }

      // Returns so should be last
      if (this.settings.console.output) {
        return handle(...args)
      }
    }

    return true
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
    this.shiftLocalStorage(1)
  }

  /**
   * Shifts local storage by shiftCount
   * @param {Number} shiftCount
   */
  shiftLocalStorage (shiftCount) { // ??Utility
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
   * Outputs for mobile devices.
   * This is useful for when it is not possible to view developer tools.
   * @param {String} data
   */
  outputForMobile (data) {
    if (isMobile()) {
      const parent = this.settings.element.parent
      if (!parent) {
        return
      }

      if (parent.children.length >= this.settings.element.max) {
        return
      }

      const element = document.createElement('div')
      element.textContent = data

      parent.appendChild(element)
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
  return window.matchMedia('only screen and (max-width: 760px)')
}
