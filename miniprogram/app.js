// app.js
const config = require('./config/api.js');

App({
  globalData: {
    userInfo: null,
    openid: null,
    deviceId: null,  // 设备唯一标识
    cart: [],
    totalDeposit: 0,
    socketTask: null,
    socketConnected: false,
    isConnecting: false,  // 是否正在连接
    reconnectTimer: null  // 重连定时器
  },

  onLaunch() {
    console.log('App onLaunch')

    // 生成设备唯一标识
    this.generateDeviceId()

    // 延迟连接，确保应用完全启动
    setTimeout(() => {
      this.connectWebSocket()
    }, 500)
  },

  // 生成设备唯一标识
  generateDeviceId() {
    try {
      let deviceId = wx.getStorageSync('device_id')
      if (!deviceId) {
        // 生成随机设备ID
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        wx.setStorageSync('device_id', deviceId)
        console.log('App: 生成新设备ID:', deviceId)
      } else {
        console.log('App: 使用已存在的设备ID:', deviceId)
      }
      this.globalData.deviceId = deviceId
    } catch (error) {
      console.error('App: 生成设备ID失败:', error)
      // 如果存储失败，生成临时ID
      this.globalData.deviceId = 'device_temp_' + Date.now()
    }
  },

  onShow() {
    console.log('App onShow')
    // 应用显示时检查并重连 WebSocket
    if (!this.globalData.socketTask || this.globalData.socketTask.readyState !== 1) {
      console.log('App: WebSocket未连接，尝试重连')
      // 延迟一下再连接，避免与 onLaunch 冲突
      setTimeout(() => {
        this.connectWebSocket()
      }, 300)
    }
  },

  onHide() {
    console.log('App onHide')
    // 应用隐藏时不要关闭 WebSocket，保持连接
  },

  // 连接 WebSocket
  connectWebSocket() {
    // 如果正在连接，不重复连接
    if (this.globalData.isConnecting) {
      console.log('App: WebSocket正在连接中，跳过')
      return
    }

    // 如果已有连接且状态正常，不需要重连
    if (this.globalData.socketTask && this.globalData.socketTask.readyState === 1) {
      console.log('App: WebSocket已连接，无需重连')
      return
    }

    this.globalData.isConnecting = true

    // 如果没有真实的openid，使用设备唯一标识作为临时ID
    const openid = this.globalData.openid || this.globalData.deviceId || 'anonymous'
    // 使用 miniprogram_ 前缀确保小程序的连接ID不会与其他客户端冲突
    const clientId = `miniprogram_${openid}`
    const socketUrl = `${config.getWsUrl()}?openid=${clientId}`

    console.log('App: 尝试连接WebSocket:', socketUrl)
    console.log('App: 当前openid:', this.globalData.openid, '设备ID:', this.globalData.deviceId)

    // 清除可能存在的重连定时器
    if (this.globalData.reconnectTimer) {
      clearTimeout(this.globalData.reconnectTimer)
      this.globalData.reconnectTimer = null
    }

    // 如果有旧连接，先不关闭，让新连接自然替换
    // 避免频繁关闭导致"未完成的操作"错误
    const oldSocketTask = this.globalData.socketTask
    this.globalData.socketTask = null

    const socketTask = wx.connectSocket({
      url: socketUrl,
      success: () => {
        console.log('App: WebSocket连接请求已发送')
      },
      fail: (err) => {
        console.error('App: WebSocket连接失败:', err)
        this.globalData.isConnecting = false
        // 关闭旧连接（仅在连接状态为OPEN时关闭）
        if (oldSocketTask && oldSocketTask.readyState === 1) {
          try {
            console.log('连接失败，关闭旧WebSocket连接')
            oldSocketTask.close()
          } catch (e) {
            console.error('关闭旧连接失败:', e)
          }
        } else if (oldSocketTask) {
          console.log('连接失败，旧连接已关闭，跳过关闭操作，readyState:', oldSocketTask.readyState)
        }
      }
    })

    socketTask.onOpen(() => {
      console.log('App: WebSocket连接已打开')
      this.globalData.socketConnected = true
      this.globalData.isConnecting = false

      // 验证连接状态
      console.log('App: WebSocket当前readyState:', socketTask.readyState)

      // 关闭旧连接（仅在连接状态为OPEN时关闭）
      if (oldSocketTask && oldSocketTask.readyState === 1) {
        try {
          console.log('关闭旧WebSocket连接')
          oldSocketTask.close()
        } catch (e) {
          console.error('关闭旧连接失败:', e)
        }
      } else if (oldSocketTask) {
        console.log('旧连接已关闭，跳过关闭操作，readyState:', oldSocketTask.readyState)
      }

      // 通知所有页面连接成功
      const pages = getCurrentPages()
      pages.forEach(page => {
        if (page.onSocketConnected) {
          page.onSocketConnected()
        }
      })
    })

    socketTask.onMessage((res) => {
      try {
        const message = JSON.parse(res.data)
        console.log('App: 收到服务器消息:', message.type, message)

        // 处理连接确认消息
        if (message.type === 'connection_established') {
          console.log(`✓ WebSocket连接已确认`)
          console.log(`  clientId: ${message.clientId}`)
          console.log(`  openid: ${message.openid}`)
          console.log(`  client: ${message.client}`)
        }

        // 通知所有页面处理消息
        const pages = getCurrentPages()
        pages.forEach(page => {
          if (page.onSocketMessage) {
            page.onSocketMessage(message)
          }
        })
      } catch (error) {
        console.error('App: 解析消息失败:', error)
      }
    })

    socketTask.onError((error) => {
      console.error('App: WebSocket错误:', error)
      this.globalData.socketConnected = false
      this.globalData.isConnecting = false
    })

    socketTask.onClose(() => {
      console.log('App: WebSocket连接已关闭, readyState:', socketTask.readyState)
      this.globalData.socketConnected = false
      this.globalData.isConnecting = false

    // 如果不是正在重连，10秒后尝试重连，避免过于频繁
    if (!this.globalData.reconnectTimer) {
      this.globalData.reconnectTimer = setTimeout(() => {
        console.log('App: 尝试重新连接WebSocket...')
        this.globalData.reconnectTimer = null
        this.connectWebSocket()
      }, 10000)
    }
    })

    this.globalData.socketTask = socketTask

    // 心跳保活（延迟启动，避免连接不稳定时立即发送心跳）
    if (this.globalData.heartbeatInterval) {
      clearInterval(this.globalData.heartbeatInterval)
    }
    // 延迟10秒后开始发送心跳，确保连接稳定
    setTimeout(() => {
      this.globalData.heartbeatInterval = setInterval(() => {
        if (this.globalData.socketTask && this.globalData.socketTask.readyState === 1) {
          console.log('App: 发送心跳')
          try {
            this.globalData.socketTask.send({
              data: JSON.stringify({ type: 'ping' })
            })
          } catch (error) {
            console.error('App: 发送心跳失败:', error)
            // 如果发送心跳失败，可能是连接已断开，清除定时器
            if (this.globalData.heartbeatInterval) {
              clearInterval(this.globalData.heartbeatInterval)
              this.globalData.heartbeatInterval = null
            }
          }
        }
      }, 30000)
    }, 10000)
  },

  // 关闭 WebSocket
  closeWebSocket() {
    console.log('App: 关闭WebSocket')
    if (this.globalData.reconnectTimer) {
      clearTimeout(this.globalData.reconnectTimer)
      this.globalData.reconnectTimer = null
    }
    if (this.globalData.heartbeatInterval) {
      clearInterval(this.globalData.heartbeatInterval)
      this.globalData.heartbeatInterval = null
    }
    // 仅在连接状态为OPEN时关闭连接
    if (this.globalData.socketTask && this.globalData.socketTask.readyState === 1) {
      try {
        console.log('App: WebSocket状态为OPEN，执行关闭')
        this.globalData.socketTask.close()
      } catch (e) {
        console.error('关闭WebSocket失败:', e)
      }
      this.globalData.socketTask = null
    } else if (this.globalData.socketTask) {
      console.log('App: WebSocket已关闭或未连接，readyState:', this.globalData.socketTask.readyState)
      this.globalData.socketTask = null
    }
    this.globalData.socketConnected = false
    this.globalData.isConnecting = false
  }
})
