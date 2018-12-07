window.addEventListener('load', onLoad)

function onLoad () {
  window.logger = new window.Logger({
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
      url: 'localhost:3000/server/node/index.js',
      send: true,
      retryRate: 2000 // ms
    },
    localStorage: {
      max: 1000,
      saveOnFailure: true
    },
    element: {
      parent: document.querySelector('.logger-logs'),
      max: 10000,
      outputForMobile: true
    }
  })
  window.logger.console.info('logger', window.logger)

  function log (type) {
    const text = document.getElementById('text').value
    window.console[type](text)
  }

  function l (type) {
    return () => {
      log(type)
    }
  }

  function generateError () {
    window.doesNotExist()
  }

  function generateUncaughtPromiseRejection () {
    return Promise.reject(new Error('demo promise rejection'))
  }

  document.getElementById('info').addEventListener('click', l('info'))
  document.getElementById('warn').addEventListener('click', l('warn'))
  document.getElementById('error').addEventListener('click', l('error'))

  document.getElementById('generate-error').addEventListener('click', generateError)
  document.getElementById('generate-uncaught-promise-rejection').addEventListener('click', generateUncaughtPromiseRejection)
}
