var r = require('rethinkdb')
var util = require('util')
var Promise = require('bluebird')
var db = require('./')
var wireutil = require('../wire/util')

var dbapi = Object.create(null)

dbapi.DuplicateSecondaryIndexError = function DuplicateSecondaryIndexError() {
  Error.call(this)
  this.name = 'DuplicateSecondaryIndexError'
  Error.captureStackTrace(this, DuplicateSecondaryIndexError)
}

util.inherits(dbapi.DuplicateSecondaryIndexError, Error)

dbapi.close = function(options) {
  return db.close(options)
}

dbapi.saveUserAfterLogin = function(user) {
  return db.run(r.table('users').get(user.email).update({
      name: user.name
    , ip: user.ip
    , lastLoggedInAt: r.now()
    }))
    .then(function(stats) {
      if (stats.skipped) {
        return db.run(r.table('users').insert({
          email: user.email
        , name: user.name
        , ip: user.ip
        , group: wireutil.makePrivateChannel()
        , lastLoggedInAt: r.now()
        , createdAt: r.now()
        , forwards: []
        , settings: {}
        }))
      }
      return stats
    })
}

dbapi.loadUser = function(email) {
  return db.run(r.table('users').get(email))
}

dbapi.updateUserSettings = function(email, changes) {
  return db.run(r.table('users').get(email).update({
    settings: changes
  }))
}

dbapi.resetUserSettings = function(email) {
  return db.run(r.table('users').get(email).update({
    settings: r.literal({})
  }))
}

dbapi.insertUserAdbKey = function(email, key) {
  return db.run(r.table('users').get(email).update({
    adbKeys: r.row('adbKeys').default([]).append({
      title: key.title
    , fingerprint: key.fingerprint
    })
  }))
}

dbapi.deleteUserAdbKey = function(email, fingerprint) {
  return db.run(r.table('users').get(email).update({
    adbKeys: r.row('adbKeys').default([]).filter(function(key) {
      return key('fingerprint').ne(fingerprint)
    })
  }))
}

dbapi.lookupUsersByAdbKey = function(fingerprint) {
  return db.run(r.table('users').getAll(fingerprint, {
    index: 'adbKeys'
  }))
}

dbapi.lookupUserByAdbFingerprint = function(fingerprint) {
  return db.run(r.table('users').getAll(fingerprint, {
      index: 'adbKeys'
    })
    .pluck('email', 'name', 'group'))
    .then(function(cursor) {
      return cursor.toArray()
    })
    .then(function(groups) {
      switch (groups.length) {
        case 1:
          return groups[0]
        case 0:
          return null
        default:
          throw new Error('Found multiple users for same ADB fingerprint')
      }
    })
}

dbapi.lookupUserByVncAuthResponse = function(response, serial) {
  return db.run(r.table('vncauth').getAll([response, serial], {
      index: 'responsePerDevice'
    })
    .eqJoin('userId', r.table('users'))('right')
    .pluck('email', 'name', 'group'))
    .then(function(cursor) {
      return cursor.toArray()
    })
    .then(function(groups) {
      switch (groups.length) {
        case 1:
          return groups[0]
        case 0:
          return null
        default:
          throw new Error('Found multiple users with the same VNC response')
      }
    })
}

dbapi.loadUserDevices = function(email) {
  return db.run(r.table('devices').getAll(email, {
    index: 'owner'
  }))
}

dbapi.saveDeviceLog = function(serial, entry) {
  return db.run(r.table('logs').insert({
      serial: serial
    , timestamp: r.epochTime(entry.timestamp)
    , priority: entry.priority
    , tag: entry.tag
    , pid: entry.pid
    , message: entry.message
    }
  , {
      durability: 'soft'
    }))
}

dbapi.saveDeviceIosInitialState = function(serial, device) {
  var data = {
    present: false,
    presenceChangedAt: r.now(),
    provider: device.provider,
    owner: null,
    status: device.status,
    statusChangedAt: r.now(),
    ready: false,
    reverseForwards: [],
    remoteConnect: false,
    remoteConnectUrl: null,
    usage: null,
    ios: true,
    iosClientChannel: device.provider.socket,
    display: {
      density: 2,
      fps: 60,
      id: 0,
      rotation: 0,
      secure: true,
      size: 4.971253395080566,
      xdpi: 294.9670104980469,
      ydpi: 295.56298828125,
      width: device.provider.width,
      height: device.provider.height,
    }
  }
  return db.run(r.table('devices').get(serial).update(data))
    .then(function(stats) {
      if (stats.skipped) {
        data.serial = serial
        data.createdAt = r.now()
        return db.run(r.table('devices').insert(data))
      }
      return stats
    })
}

dbapi.saveDeviceInitialState = function(serial, device) {
  var data = {
    present: false
    , presenceChangedAt: r.now()
    , provider: device.provider
    , owner: null
    , status: device.status
    , statusChangedAt: r.now()
    , ready: false
    , reverseForwards: []
    , remoteConnect: false
    , remoteConnectUrl: null
    , usage: null
  }
  return db.run(r.table('devices').get(serial).update(data))
    .then(function(stats) {
      if (stats.skipped) {
        data.serial = serial
        data.createdAt = r.now()
        return db.run(r.table('devices').insert(data))
      }
      return stats
    })
}

dbapi.setDeviceConnectUrl = function(serial, url) {
  return db.run(r.table('devices').get(serial).update({
    remoteConnectUrl: url
  , remoteConnect: true
  }))
}

dbapi.unsetDeviceConnectUrl = function(serial) {
  return db.run(r.table('devices').get(serial).update({
    remoteConnectUrl: null
  , remoteConnect: false
  }))
}

dbapi.saveDeviceStatus = function(serial, status) {
  return db.run(r.table('devices').get(serial).update({
    status: status
  , statusChangedAt: r.now()
  }))
}

dbapi.setDeviceOwner = function(serial, owner) {
  return db.run(r.table('devices').get(serial).update({
    owner: owner
  }))
}

dbapi.unsetDeviceOwner = function(serial) {
  return db.run(r.table('devices').get(serial).update({
    owner: null
  }))
}

dbapi.setDevicePresent = function(serial) {
  return db.run(r.table('devices').get(serial).update({
    present: true
  , presenceChangedAt: r.now()
  }))
}

dbapi.setDeviceAbsent = function(serial) {
  return db.run(r.table('devices').get(serial).update({
    present: false
  , presenceChangedAt: r.now()
  }))
}

dbapi.setDeviceUsage = function(serial, usage) {
  return db.run(r.table('devices').get(serial).update({
    usage: usage
  , usageChangedAt: r.now()
  }))
}

dbapi.unsetDeviceUsage = function(serial) {
  return db.run(r.table('devices').get(serial).update({
    usage: null
  , usageChangedAt: r.now()
  }))
}

dbapi.setDeviceAirplaneMode = function(serial, enabled) {
  return db.run(r.table('devices').get(serial).update({
    airplaneMode: enabled
  }))
}

dbapi.setDeviceBattery = function(serial, battery) {
  return db.run(r.table('devices').get(serial).update({
      battery: {
        status: battery.status
      , health: battery.health
      , source: battery.source
      , level: battery.level
      , scale: battery.scale
      , temp: battery.temp
      , voltage: battery.voltage
      }
    }
  , {
      durability: 'soft'
    }))
}

dbapi.setDeviceBrowser = function(serial, browser) {
  return db.run(r.table('devices').get(serial).update({
    browser: {
      selected: browser.selected
    , apps: browser.apps
    }
  }))
}

dbapi.setDeviceConnectivity = function(serial, connectivity) {
  return db.run(r.table('devices').get(serial).update({
    network: {
      connected: connectivity.connected
    , type: connectivity.type
    , subtype: connectivity.subtype
    , failover: !!connectivity.failover
    , roaming: !!connectivity.roaming
    }
  }))
}

dbapi.setDevicePhoneState = function(serial, state) {
  return db.run(r.table('devices').get(serial).update({
    network: {
      state: state.state
    , manual: state.manual
    , operator: state.operator
    }
  }))
}

dbapi.setDeviceRotation = function(serial, rotation) {
  return db.run(r.table('devices').get(serial).update({
    display: {
      rotation: rotation
    }
  }))
}

dbapi.setIosDeviceRotation = function(message) {
  return db.run(r.table('devices').get(message.serial).update({
    display: {
      rotation: message.rotation,
      height: message.height,
      width: message.width
    }
  }))
}

dbapi.setDeviceNote = function(serial, note) {
  return db.run(r.table('devices').get(serial).update({
    notes: note
  }))
}

dbapi.setDeviceReverseForwards = function(serial, forwards) {
  return db.run(r.table('devices').get(serial).update({
    reverseForwards: forwards
  }))
}

dbapi.setDeviceReady = function(serial, channel) {
  return db.run(r.table('devices').get(serial).update({
    channel: channel
  , ready: true
  , owner: null
  , present: true
  , reverseForwards: []
  }))
}

dbapi.saveDeviceIdentity = function(serial, identity) {
  return db.run(r.table('devices').get(serial).update({
    platform: identity.platform
  , manufacturer: identity.manufacturer
  , operator: identity.operator
  , model: identity.model
  , version: identity.version
  , abi: identity.abi
  , sdk: identity.sdk
  , display: identity.display
  , phone: identity.phone
  , product: identity.product
  , cpuPlatform: identity.cpuPlatform
  , openGLESVersion: identity.openGLESVersion
  }))
}

dbapi.loadDevices = function() {
  return db.run(r.table('devices'))
}

dbapi.loadPresentDevices = function() {
  return db.run(r.table('devices').getAll(true, {
    index: 'present'
  }))
}

dbapi.loadDevice = function(serial) {
  return db.run(r.table('devices').get(serial))
}

dbapi.saveUserAccessToken = function(email, token) {
  return db.run(r.table('accessTokens').insert({
    email: email
  , id: token.id
  , title: token.title
  , jwt: token.jwt
  }))
}

dbapi.removeUserAccessToken = function(email, title) {
  return db.run(r.table('accessTokens').getAll(email, {
    index: 'email'
  }).filter({title: title}).delete())
}

dbapi.loadAccessTokens = function(email) {
  return db.run(r.table('accessTokens').getAll(email, {
    index: 'email'
  }))
}

dbapi.loadAccessToken = function(id) {
  return db.run(r.table('accessTokens').get(id))
}
dbapi.setDeviceSocketDisplay = function(data) {
  return db.run(r.table('devices').get(data.serial).update({
      iosClientChannel: data.channel,
      display: {
        density: 2,
        fps: 60,
        id: 0,
        rotation: 0,
        secure: true,
        size: 4.971253395080566,
        xdpi: 294.9670104980469,
        ydpi: 295.56298828125,
        width: data.width,
        height: data.height,
      }
  }))
}

dbapi.setDeviceSocketPorts = function(data, publicIp) {
  return db.run(r.table('devices').get(data.serial).update({
      display: {
        url: `ws://${publicIp}:${data.screenPort}/`
      },
      screenPort: data.screenPort,
      connectPort: data.connectPort
    })).then(function() {
    return db.run(r.table('devices').get(data.serial))
  })
}
dbapi.updateIosDevice = function(message) {
    return db.run(r.table('devices').get(message.id).update({
      id: message.id,
      model: message.name,
      platform: message.platform,
      sdk: message.architect
    }))
}
dbapi.setDeviceIosBattery = function(message) {
    return db.run(r.table('devices').get(message.id).update({
      battery: {
        status: message.state
      , level: message.level
      }
    }
  ))
}
dbapi.sdkIosVersion = function(message) {
    return db.run(r.table('devices').get(message.id).update({
      version: message.sdkVersion
    }
  ))
}
dbapi.sizeIsoDevice = function(message) {
    return db.run(r.table('devices').get(message.id).update({
      display: {
        height: message.height,
        width: message.width
      }
    }
  ))
}
dbapi.checkIosDeviceConnected = function(data) {
  return db.run(r.table('devices').get(data.id))
}
dbapi.deleteIosDevice = function(data) {
  return db.run(r.table('devices').get(data.serial).delete())
}
dbapi.setAbsentDisconnectedDevices = function() {
  return db.run(r.table('devices').filter({
    ios: true,
  }).update({
    present: false,
    ready: false
  }))
}
// @TODO refactor setDeviceApp
/**
 *
 * @param message obj with application options
 * @method check if exists app with equal option
 * if exists replace it or append to installedApps list
 *
 */
dbapi.setDeviceApp = function(message) {
  return db.run(r.table('devices').get(message.serial))
    .then(result => {
      let removePathApp = ''
      let {installedApps} = result
      let index = installedApps.findIndex(item => {
        return (
          item.bundleName === message.bundleName &&
          item.bundleId === message.bundleId
        )
      })
      if(index >= 0) {
        removePathApp = installedApps[index].pathToApp

        installedApps[index] = {
          bundleId: message.bundleId,
          bundleName: message.bundleName,
          pathToApp: message.pathToApp
        }
        db.run(r.table('devices').get(message.serial).update({
          installedApps
        }))
        return Promise.resolve({removePathApp})
      } else {
        db.run(r.table('devices').get(message.serial).update({
          installedApps: r.row('installedApps').default([]).append({
            bundleId: message.bundleId,
            bundleName: message.bundleName,
            pathToApp: message.pathToApp
          })
        }))
        return Promise.resolve({removePathApp: ''})
      }
    })
    .catch(err => {
      db.run(r.table('devices').get(message.serial).update({
        installedApps: r.row('installedApps').default([]).append({
          bundleId: message.bundleId,
          bundleName: message.bundleName,
          pathToApp: message.pathToApp
        })
      }))
      return Promise.reject(err)
    })
}
dbapi.getInstalledApplications = function(message) {
  return db.run(r.table('devices').get(message.serial))
}


module.exports = dbapi
