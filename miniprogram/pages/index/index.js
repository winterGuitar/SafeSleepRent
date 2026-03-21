const app = getApp();
const config = require('../../config/api.js');

Page({
  data: {
    bedList: [],
    totalQuantity: 0,
    totalDeposit: 0
  },

  onLoad: function (options) {
    console.log('Page onLoad')

    // 添加网络测试
    // this.testNetworkConnection()

    this.checkLogin()
    this.loadBedTypes()

    // 确保 WebSocket 已连接
    if (!app.globalData.socketTask || app.globalData.socketTask.readyState !== 1) {
      console.log('WebSocket未连接，请求App连接')
      app.connectWebSocket()
    }
  },

  onShow: function() {
    console.log('Page onShow')
    // 每次显示页面时重新加载床位数据，确保库存是最新的
    this.loadBedTypes()
  },

  // WebSocket连接成功回调
  onSocketConnected: function() {
    console.log('Page: WebSocket连接成功')
  },

  // WebSocket消息处理
  onSocketMessage: function(message) {
    console.log('Page: 收到WebSocket消息:', message.type, message)

    // 根据消息类型处理
    switch(message.type) {
      case 'bed_types_update':
        console.log('Page: 处理床位类型更新消息')
        this.handleBedTypesUpdate(message)
        break
      case 'settings_update':
        this.handleSettingsUpdate(message)
        break
      case 'data_update':
        this.handleDataUpdate(message)
        break
      case 'order_paid':
        // 订单支付成功后，更新库存显示
        this.loadBedTypes()
        break
      case 'order_refunded':
        // 订单退款后，更新库存显示
        this.loadBedTypes()
        break
      default:
        console.log('Page: 未处理的消息类型:', message.type)
    }
  },

  // 处理床位类型更新
  handleBedTypesUpdate: function(message) {
    console.log('Page: 处理床位类型更新消息', message)
    console.log('Page: 当前床位列表:', this.data.bedList)

    wx.showToast({
      title: '床位数据已更新',
      icon: 'success',
      duration: 1500
    })

    // 重新加载床位数据
    this.loadBedTypes()
  },

  // 处理设置更新
  handleSettingsUpdate: function(message) {
    console.log('Page: 处理设置更新消息', message)
    wx.showToast({
      title: '系统设置已更新',
      icon: 'success',
      duration: 1500
    })

    // 重新加载床位数据
    this.loadBedTypes()
  },

  // 处理数据更新
  handleDataUpdate: function(message) {
    console.log('Page: 处理数据更新消息', message)
    wx.showToast({
      title: '数据已更新',
      icon: 'success',
      duration: 1500
    })

    // 重新加载床位数据
    this.loadBedTypes()
  },

  // 加载床位类型
  loadBedTypes: function() {
    console.log('开始加载床位类型')
    console.log('Page: setData前的bedList:', this.data.bedList.map(b => ({ id: b.id, name: b.name, stock: b.stock, quantity: b.quantity })))
    wx.request({
      url: config.getApiUrl(config.apiPaths.bedTypes),
      method: 'GET',
      success: (res) => {
        console.log('加载床位类型响应:', res.data)
        if (res.data.code === 200) {
          // 初始化数量为0，保留当前选择的数量
          const currentQuantities = {}
          this.data.bedList.forEach(bed => {
            if (bed.quantity > 0) {
              currentQuantities[bed.id] = bed.quantity
            }
          })

          const bedList = res.data.data
            .filter(bed => bed.available !== false) // 过滤掉不可用的床位
            .map(bed => {
            // 如果库存小于已选数量，则调整为库存值
            const quantity = currentQuantities[bed.id] || 0
            const adjustedQuantity = Math.min(quantity, bed.stock)

            return {
              ...bed,
              quantity: adjustedQuantity
            }
          }).sort((a, b) => {
            // 先按价格从低到高排序
            if (a.price !== b.price) {
              return a.price - b.price;
            }
            // 价格相同时，按库存从低到高排序
            return a.stock - b.stock;
          })

          console.log('准备更新的床位列表:', bedList.map(b => ({ id: b.id, name: b.name, stock: b.stock, quantity: b.quantity })))

          this.setData({
            bedList: bedList
          }, () => {
            // setData 回调：确认数据已更新
            console.log('setData完成，更新后的bedList:', this.data.bedList.map(b => ({ id: b.id, name: b.name, stock: b.stock, quantity: b.quantity })))
          })

          this.updateTotals(bedList)
        }
      },
      fail: (err) => {
        console.error('加载床位类型失败:', err)
      }
    })
  },

  checkLogin: function() {
    wx.checkSession({
      success: () => {
        console.log('登录状态有效')
      },
      fail: () => {
        wx.login({
          success: (res) => {
            if (res.code) {
              // 调用后端接口获取openid
              this.getOpenId(res.code)
            }
          }
        })
      }
    })
  },

  getOpenId: function(code) {
    wx.request({
      url: config.getApiUrl(config.apiPaths.login),
      method: 'POST',
      data: {
        code: code
      },
      success: (res) => {
        if (res.data.code === 200) {
          const openid = res.data.data.openid
          app.globalData.openid = openid
          console.log('获取到openid:', openid)

          // 获取到openid后，重新连接WebSocket，使用真实身份
          if (app.globalData.socketTask && app.globalData.socketTask.readyState === 1) {
            console.log('使用设备ID连接，准备切换到openid')
          }

          // 等待一下再重新连接，避免频繁切换
          setTimeout(() => {
            app.connectWebSocket()
          }, 1000)
        }
      }
    })
  },

  increaseQuantity: function(e) {
    const index = e.currentTarget.dataset.index
    let bedList = this.data.bedList

    // 检查是否超过库存
    if (bedList[index].quantity >= bedList[index].stock) {
      wx.showToast({
        title: '库存不足',
        icon: 'none',
        duration: 1500
      })
      return
    }

    bedList[index].quantity++
    this.updateTotals(bedList)
  },

  decreaseQuantity: function(e) {
    const index = e.currentTarget.dataset.index
    let bedList = this.data.bedList
    if (bedList[index].quantity > 0) {
      bedList[index].quantity--
    }
    this.updateTotals(bedList)
  },

  updateTotals: function(bedList) {
    let totalQuantity = 0
    let totalDeposit = 0

    bedList.forEach(bed => {
      if (bed.quantity > 0) {
        totalQuantity += bed.quantity
        totalDeposit += bed.deposit * bed.quantity
      }
    })

    this.setData({
      bedList: bedList,
      totalQuantity: totalQuantity,
      totalDeposit: totalDeposit
    })
  },

  handleWeChatPay: function() {
    const selectedBeds = this.data.bedList.filter(bed => bed.quantity > 0)

    if (selectedBeds.length === 0) {
      wx.showToast({
        title: '请选择租床数量',
        icon: 'none'
      })
      return
    }

    this.createOrder(selectedBeds)
  },

  createOrder: function(beds) {
    wx.showLoading({
      title: '创建订单中...'
    })

    // 调用后端接口创建订单
    wx.request({
      url: config.getApiUrl(config.apiPaths.createOrder),
      method: 'POST',
      data: {
        beds: beds,
        totalDeposit: this.data.totalDeposit,
        openid: app.globalData.openid || 'test_openid'
      },
      success: (res) => {
        wx.hideLoading()

        if (res.data.code === 200) {
          const orderId = res.data.data.orderId
          this.requestPayment(orderId)
        } else {
          wx.showToast({
            title: res.data.message || '创建订单失败',
            icon: 'none'
          })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        })
      }
    })
  },

  requestPayment: function(orderId) {
    // 开发环境：直接模拟支付，不调用微信支付接口
    wx.showLoading({
      title: '支付处理中...'
    })

    // 调用后端API标记支付成功
    wx.request({
      url: config.getApiUrl(config.apiPaths.payOrder),
      method: 'POST',
      data: {
        orderId: orderId
      },
      success: (res) => {
        wx.hideLoading()

        if (res.data.code === 200) {
          // 支付成功
          wx.showToast({
            title: '支付成功',
            icon: 'success',
            duration: 1500
          })

          setTimeout(() => {
            wx.navigateTo({
              url: '/pages/order/order'
            })
          }, 1500)
        } else {
          // 支付失败 - 删除待支付订单
          this.cancelUnpaidOrder(orderId, res.data.message || '支付失败')
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('支付请求失败:', err)
        // 网络错误也删除订单
        this.cancelUnpaidOrder(orderId, '网络错误，支付失败')
      }
    })
  },

  // 取消未支付的订单
  cancelUnpaidOrder: function(orderId, message) {
    wx.request({
      url: config.getApiUrl('/api/order/cancel'),
      method: 'POST',
      data: {
        orderId: orderId
      },
      success: () => {
        // 重新加载床位数据
        this.loadBedTypes()

        // 显示提示
        wx.showModal({
          title: '支付失败',
          content: message + '，库存可能已被占用，请重新选择床位。',
          showCancel: false,
          confirmText: '确定',
          success: () => {
            // 重置选择
            this.setData({
              bedList: this.data.bedList.map(bed => ({ ...bed, quantity: 0 })),
              totalDeposit: 0
            })
          }
        })
      },
      fail: () => {
        wx.showToast({
          title: message,
          icon: 'none',
          duration: 3000
        })
      }
    })
  },

  // 跳转到订单页面
  goToOrderPage: function() {
    wx.navigateTo({
      url: '/pages/order/order'
    })
  },

  // 单个项目支付
  payItem: function(e) {
    const index = e.currentTarget.dataset.index
    const bed = this.data.bedList[index]

    // 检查数量是否大于0
    if (bed.quantity === 0) {
      wx.showToast({
        title: '请先选择数量',
        icon: 'none',
        duration: 1500
      })
      return
    }

    // 创建只包含当前床位的订单
    this.createOrder([bed])
  },

  // 图片加载失败处理
  onImageError: function(e) {
    const index = e.currentTarget.dataset.index
    const bedList = this.data.bedList
    if (bedList[index]) {
      bedList[index].image = '/images/bed-placeholder.png'
      this.setData({
        bedList: bedList
      })
    }
  },

  // 网络连接测试函数
  testNetworkConnection: function() {
    console.log('========== 网络连接测试开始 ==========')
    console.log('当前环境:', config.currentEnv)
    console.log('API配置:', config.getConfig())

    const testUrls = [
      { name: '本地开发服务器', url: 'http://localhost:3000/api/health' },
      { name: '你的生产服务器', url: 'https://www.axxzc.cn/api/health' },
      { name: '微信测试接口', url: 'https://api.weixin.qq.com/cgi-bin/token' }
    ]

    testUrls.forEach((test, index) => {
      console.log(`测试 ${index + 1}: ${test.name}`)
      console.log(`URL: ${test.url}`)

      wx.request({
        url: test.url,
        method: 'GET',
        timeout: 5000,
        success: (res) => {
          console.log(`✅ ${test.name} 测试成功`)
          console.log(`   状态码: ${res.statusCode}`)
          console.log(`   响应数据:`, res.data)
        },
        fail: (err) => {
          console.log(`❌ ${test.name} 测试失败`)
          console.log(`   错误信息:`, err)
        }
      })
    })

    console.log('========== 网络连接测试结束 ==========')

    // 测试WebSocket连接
    this.testWebSocketConnection()
  },

  // WebSocket连接测试
  testWebSocketConnection: function() {
    console.log('========== WebSocket连接测试 ==========')

    const wsUrls = [
      { name: '本地开发WebSocket', url: 'ws://localhost:3000/ws' },
      { name: '你的生产WebSocket', url: 'wss://www.axxzc.cn/ws' }
    ]

    wsUrls.forEach((test, index) => {
      console.log(`测试WebSocket ${index + 1}: ${test.name}`)
      console.log(`URL: ${test.url}`)

      const socketTask = wx.connectSocket({
        url: test.url,
        success: () => {
          console.log(`✅ ${test.name} 连接请求已发送`)
        },
        fail: (err) => {
          console.log(`❌ ${test.name} 连接请求失败`, err)
        }
      })

      socketTask.onOpen(() => {
        console.log(`✅ ${test.name} 连接已建立`)
        socketTask.close()
      })

      socketTask.onError((error) => {
        console.log(`❌ ${test.name} 连接错误`, error)
      })

      socketTask.onClose(() => {
        console.log(`ℹ️ ${test.name} 连接已关闭`)
      })
    })

    console.log('========== WebSocket连接测试结束 ==========')
  }
})
