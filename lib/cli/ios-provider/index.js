module.exports.command = 'ios-provider'

module.exports.describe = 'Start a ios-provider unit.'

module.exports.builder = function(yargs) {
  var os = require('os')
  var ip = require('my-local-ip')
  return yargs
    .strict()
    .env('STF_PROVIDER')
    .option('adb-host', {
      describe: 'The ADB server host.'
      , type: 'string'
      , default: '127.0.0.1'
    })
    .option('adb-port', {
      describe: 'The ADB server port.'
      , type: 'number'
      , default: 5037
    })
    .option('allow-remote', {
      alias: 'R'
      , describe: 'Whether to allow remote devices in STF. Highly ' +
      'unrecommended due to almost unbelievable slowness on the ADB side ' +
      'and duplicate device issues when used locally while having a ' +
      'cable connected at the same time.'
      , type: 'boolean'
    })
    .option('boot-complete-timeout', {
      describe: 'How long to wait for boot to complete during device setup.'
      , type: 'number'
      , default: 60000
    })
    .option('cleanup', {
      describe: 'Attempt to reset the device between uses by uninstalling' +
      'apps, resetting accounts and clearing caches. Does not do a perfect ' +
      'job currently. Negate with --no-cleanup.'
      , type: 'boolean'
      , default: true
    })
    .option('connect-push', {
      alias: 'p'
      , describe: 'Device-side ZeroMQ PULL endpoint to connect to.'
      , array: true
      , demand: true
    })
    .option('connect-sub', {
      alias: 's'
      , describe: 'Device-side ZeroMQ PUB endpoint to connect to.'
      , array: true
      , demand: true
    })
    .option('connect-url-pattern', {
      describe: 'The URL pattern to use for `adb connect`.'
      , type: 'string'
      , default: '${publicIp}:${publicPort}'
    })
    .option('group-timeout', {
      alias: 't'
      , describe: 'Timeout in seconds for automatic release of inactive devices.'
      , type: 'number'
      , default: 900
    })
    .option('heartbeat-interval', {
      describe: 'Send interval in milliseconds for heartbeat messages.'
      , type: 'number'
      , default: 10000
    })
    .option('lock-rotation', {
      describe: 'Whether to lock rotation when devices are being used. ' +
      'Otherwise changing device orientation may not always work due to ' +
      'sensitive sensors quickly or immediately reverting it back to the ' +
      'physical orientation.'
      , type: 'boolean'
    })
    .option('max-port', {
      describe: 'Highest port number for device workers to use.'
      , type: 'number'
      , default: 7900
    })
    .option('min-port', {
      describe: 'Lowest port number for device workers to use.'
      , type: 'number'
      , default: 7700
    })
    .option('mute-master', {
      describe: 'Whether to mute master volume.'
      , choices: ['always', 'inuse', 'never']
      , default: 'never'
      , coerce: val => {
        if (val === true) {
          return 'inuse' // For backwards compatibility.
        }

        if (val === false) {
          return 'never' // For backwards compatibility.
        }

        return val
      }
    })
    .option('serial', {
      describe: 'Serial number of device.'
      , type: 'string'
      , default: 'emulator-555'
    })
    .option('name', {
      alias: 'n'
      , describe: 'An easily identifiable name for the UI and/or log output.'
      , type: 'string'
      , default: os.hostname()
    })
    .option('public-ip', {
      describe: 'The IP or hostname to use in URLs.'
      , type: 'string'
      , default: ip()
    })
    .option('screen-jpeg-quality', {
      describe: 'The JPG quality to use for the screen.'
      , type: 'number'
      , default: process.env.SCREEN_JPEG_QUALITY || 80
    })
    .option('screen-ping-interval', {
      describe: 'The interval at which to send ping messages to keep the ' +
      'screen WebSocket alive.'
      , type: 'number'
      , default: 30000
    })
    .option('screen-reset', {
      describe: 'Go back to home screen and reset screen rotation ' +
      'when user releases device. Negate with --no-screen-reset.'
      , type: 'boolean'
      , default: true
    })
    .option('screen-ws-url-pattern', {
      describe: 'The URL pattern to use for the screen WebSocket.'
      , type: 'string'
      , default: 'ws://${publicIp}:${publicPort}'
    })
    .option('storage-url', {
      alias: 'r'
      , describe: 'The URL to the storage unit.'
      , type: 'string'
      , demand: true
    })
    .option('vnc-initial-size', {
      describe: 'The initial size to use for the experimental VNC server.'
      , type: 'string'
      , default: '600x800'
      , coerce: function(val) {
        return val.split('x').map(Number)
      }
    })
    .option('connect-app-dealer', {
      describe: 'App-side ZeroMQ DEALER endpoint to connect to.'
      , array: true
      , demand: true
    })
    .option('connect-dev-dealer', {
      describe: 'Device-side ZeroMQ DEALER endpoint to connect to.'
      , array: true
    })
    .option('wda-host', {
        describe: 'iOS device host ip address where WDA is started.'
      , type: 'string'
      , default: '192.168.88.78'
    })
    .option('wda-port', {
        describe: 'The port the WDA should run et.'
      , type: 'number'
      , default: 20001
    })
    .option('mjpeg-port', {
        describe: 'The port the WDA mjpeg is started.'
      , type: 'number'
      , default: 20002
    })
    .option('udid-storage', {
      describe: 'The path for ip information of devoces'
    , type: 'string'
    , default: false
  })
  .option('iproxy', {
    describe: 'If the option with iproxy is passed, use proxy connection with devices'
  , type: 'boolean'
  , default: false
})
    .epilog('Each option can be be overwritten with an environment variable ' +
      'by converting the option to uppercase, replacing dashes with ' +
      'underscores and prefixing it with `STF_PROVIDER_` (e.g. ' +
      '`STF_PROVIDER_NAME`).')
}


module.exports.handler = function(argv) {
  var path = require('path')
  var cli = path.resolve(__dirname, '..')

  function range(from, to) {
    var items = []
    for (var i = from; i <= to; ++i) {
      items.push(i)
    }
    return items
  }

  return require('../../units/ios-provider')({
    name: argv.name
    , killTimeout: 10000
    , ports: range(argv.minPort, argv.maxPort)
    , wdaHost: argv.wdaHost
    , wdaPort: argv.wdaPort
    , mjpegPort: argv.mjpegPort
    , udidStorage: argv.udidStorage
    , filter: function(device) {
      return argv.serial.length === 0 || argv.serial.indexOf(device.id) !== -1
    }
    , allowRemote: argv.allowRemote
    , fork: function(device, ports) {
      var {fork} = require('child_process')
      var args = [
        'ios-device'
        , '--serial', device.id
        , '--provider', argv.name
        , '--screen-port', ports.shift()
        , '--connect-port', argv.mjpegPort
        , '--vnc-port', ports.shift()
        , '--public-ip', argv.publicIp
        , '--group-timeout', argv.groupTimeout
        , '--storage-url', argv.storageUrl
        , '--adb-host', argv.adbHost
        , '--adb-port', argv.adbPort
        , '--screen-jpeg-quality', argv.screenJpegQuality
        , '--screen-ping-interval', argv.screenPingInterval
        , '--screen-ws-url-pattern', argv.screenWsUrlPattern
        , '--connect-url-pattern', argv.connectUrlPattern
        , '--heartbeat-interval', argv.heartbeatInterval
        , '--boot-complete-timeout', argv.bootCompleteTimeout
        , '--vnc-initial-size', argv.vncInitialSize.join('x')
        , '--mute-master', argv.muteMaster
        , '--connect-app-dealer', argv.connectAppDealer
        , '--connect-dev-dealer', argv.connectDevDealer
	, '--wda-host', argv.wdaHost
        , '--wda-port', argv.wdaPort
        , '--udid-storage', argv.udidStorage
        , '--iproxy', argv.iproxy
      ]
        .concat(argv.connectSub.reduce(function(all, val) {
          return all.concat(['--connect-sub', val])
        }, []))
        .concat(argv.connectPush.reduce(function(all, val) {
          return all.concat(['--connect-push', val])
        }, []))
        .concat(argv.lockRotation ? ['--lock-rotation'] : [])
        .concat(!argv.cleanup ? ['--no-cleanup'] : [])
        .concat(!argv.screenReset ? ['--no-screen-reset'] : [])
ports.shift()
ports.shift()
ports.shift()
ports.shift()
ports.shift()
ports.shift()
ports.shift()
      return fork(cli, args)
    }
    , endpoints: {
      sub: argv.connectSub
      , push: argv.connectPush
    }
    , adbHost: argv.adbHost
    , adbPort: argv.adbPort
  })
}
