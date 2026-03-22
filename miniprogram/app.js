const config = require('./config/api.js')

App({
  globalData: {
    userInfo: null,
    openid: null,
    userToken: null,
    deviceId: null,
    cart: [],
    totalDeposit: 0,
    socketTask: null,
    socketConnected: false,
    isConnecting: false,
    reconnectTimer: null,
    heartbeatInterval: null
  },

  onLaunch() {
    this.generateDeviceId()

    setTimeout(() => {
      this.connectWebSocket()
    }, 500)
  },

  generateDeviceId() {
    try {
      let deviceId = wx.getStorageSync('device_id')
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        wx.setStorageSync('device_id', deviceId)
      }
      this.globalData.deviceId = deviceId
    } catch (error) {
      console.error('App: generate device id failed:', error)
      this.globalData.deviceId = `device_temp_${Date.now()}`
    }
  },

  onShow() {
    if (!this.globalData.socketTask || this.globalData.socketTask.readyState !== 1) {
      setTimeout(() => {
        this.connectWebSocket()
      }, 300)
    }
  },

  onHide() {},

  connectWebSocket() {
    if (this.globalData.isConnecting) {
      return
    }

    if (this.globalData.socketTask && this.globalData.socketTask.readyState === 1) {
      return
    }

    this.globalData.isConnecting = true

    const openid = this.globalData.openid || this.globalData.deviceId || 'anonymous'
    const clientId = `miniprogram_${openid}`
    const wsBaseUrl = config.getWsUrl().replace(/\/+$/, '')
    const socketPath = '/ws/miniprogram'
    const normalizedBaseUrl = wsBaseUrl.endsWith('/ws')
      ? wsBaseUrl.slice(0, -3)
      : wsBaseUrl
    const socketUrl = `${normalizedBaseUrl}${socketPath}?openid=${clientId}`

    if (this.globalData.reconnectTimer) {
      clearTimeout(this.globalData.reconnectTimer)
      this.globalData.reconnectTimer = null
    }

    const oldSocketTask = this.globalData.socketTask
    this.globalData.socketTask = null

    const socketTask = wx.connectSocket({
      url: socketUrl,
      success: () => {
        console.log('App: socket connect requested')
      },
      fail: (err) => {
        console.error('App: socket connect failed:', err)
        this.globalData.isConnecting = false

        if (oldSocketTask && oldSocketTask.readyState === 1) {
          try {
            oldSocketTask.close()
          } catch (error) {
            console.error('App: close old socket after connect failure failed:', error)
          }
        }
      }
    })

    this.globalData.socketTask = socketTask

    socketTask.onOpen(() => {
      if (this.globalData.socketTask !== socketTask) {
        return
      }

      this.globalData.socketConnected = true
      this.globalData.isConnecting = false

      if (oldSocketTask && oldSocketTask.readyState === 1) {
        try {
          oldSocketTask.close()
        } catch (error) {
          console.error('App: close old socket after reconnect failed:', error)
        }
      }

      const pages = getCurrentPages()
      pages.forEach(page => {
        if (page.onSocketConnected) {
          page.onSocketConnected()
        }
      })

      this.startHeartbeat()
    })

    socketTask.onMessage((res) => {
      try {
        const message = JSON.parse(res.data)

        if (message.type === 'connection_established') {
          console.log('App: socket connected:', message.clientId, message.clientType)
        }

        const pages = getCurrentPages()
        pages.forEach(page => {
          if (page.onSocketMessage) {
            page.onSocketMessage(message)
          }
        })
      } catch (error) {
        console.error('App: parse socket message failed:', error)
      }
    })

    socketTask.onError((error) => {
      if (this.globalData.socketTask !== socketTask) {
        return
      }

      console.error('App: socket error:', error)
      this.globalData.socketConnected = false
      this.globalData.isConnecting = false
      this.stopHeartbeat()
    })

    socketTask.onClose(() => {
      if (this.globalData.socketTask !== socketTask) {
        return
      }

      this.globalData.socketConnected = false
      this.globalData.isConnecting = false
      this.stopHeartbeat()

      if (!this.globalData.reconnectTimer) {
        this.globalData.reconnectTimer = setTimeout(() => {
          this.globalData.reconnectTimer = null
          this.connectWebSocket()
        }, 10000)
      }
    })
  },

  startHeartbeat() {
    this.stopHeartbeat()
    this.globalData.heartbeatInterval = setInterval(() => {
      if (!this.globalData.socketTask || this.globalData.socketTask.readyState !== 1) {
        return
      }

      try {
        this.globalData.socketTask.send({
          data: JSON.stringify({ type: 'ping' })
        })
      } catch (error) {
        console.error('App: heartbeat failed:', error)
      }
    }, 30000)
  },

  stopHeartbeat() {
    if (this.globalData.heartbeatInterval) {
      clearInterval(this.globalData.heartbeatInterval)
      this.globalData.heartbeatInterval = null
    }
  },

  closeWebSocket() {
    if (this.globalData.reconnectTimer) {
      clearTimeout(this.globalData.reconnectTimer)
      this.globalData.reconnectTimer = null
    }

    this.stopHeartbeat()

    if (this.globalData.socketTask) {
      try {
        this.globalData.socketTask.close()
      } catch (error) {
        console.error('App: close socket failed:', error)
      }
      this.globalData.socketTask = null
    }

    this.globalData.socketConnected = false
    this.globalData.isConnecting = false
  }
})
