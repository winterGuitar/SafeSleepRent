const app = getApp();
const config = require('../../config/api.js');

Page({
  data: {
    orders: [],
    currentTab: 'completed',  // 当前标签: completed, unpaid, cancelled
    filteredOrders: [],  // 过滤后的订单列表
    socketTask: null
  },

  onLoad: function (options) {
    this.loadOrders()
    this.connectWebSocket()
  },

  onUnload: function() {
    this.closeWebSocket()
  },

  onShow: function () {
    this.loadOrders()
  },

  // 连接WebSocket
  connectWebSocket: function() {
    const openid = app.globalData.openid || 'anonymous'
    const socketUrl = `${config.getWsUrl()}?openid=${openid}`

    const socketTask = wx.connectSocket({
      url: socketUrl,
      success: () => {
        console.log('订单页WebSocket连接成功')
      }
    })

    socketTask.onOpen(() => {
      console.log('订单页WebSocket连接已打开')
    })

    socketTask.onMessage((res) => {
      try {
        const message = JSON.parse(res.data)
        console.log('订单页收到服务器消息:', message)

        // 根据消息类型处理
        switch(message.type) {
          case 'order_paid':
            this.handleOrderPaid(message)
            break
          case 'order_refunded':
            this.handleOrderRefunded(message)
            break
          case 'order_cancelled':
            this.handleOrderCancelled(message)
            break
          case 'data_update':
            this.handleDataUpdate(message)
            break
        }
      } catch (error) {
        console.error('解析消息失败:', error)
      }
    })

    socketTask.onError((error) => {
      console.error('订单页WebSocket错误:', error)
    })

    socketTask.onClose(() => {
      console.log('订单页WebSocket连接已关闭')
    })

    this.setData({ socketTask })

    // 心跳保活
    this.heartbeatInterval = setInterval(() => {
      if (socketTask.readyState === 1) {
        socketTask.send({
          data: JSON.stringify({ type: 'ping' })
        })
      }
    }, 30000)
  },

  // 关闭WebSocket
  closeWebSocket: function() {
    if (this.data.socketTask) {
      this.data.socketTask.close()
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
  },

  // 处理订单支付成功
  handleOrderPaid: function(message) {
    console.log('收到订单支付成功消息:', message)
    wx.showToast({
      title: '订单支付成功',
      icon: 'success'
    })

    // 重新加载订单列表
    this.loadOrders()
  },

  // 处理订单退款成功
  handleOrderRefunded: function(message) {
    console.log('收到订单退款成功消息:', message)
    wx.showToast({
      title: '订单已退款',
      icon: 'success'
    })

    // 重新加载订单列表
    this.loadOrders()
  },

  // 处理订单取消成功
  handleOrderCancelled: function(message) {
    console.log('收到订单取消消息:', message)
    wx.showToast({
      title: '订单已取消',
      icon: 'success'
    })

    // 重新加载订单列表
    this.loadOrders()
  },

  // 处理数据更新
  handleDataUpdate: function(message) {
    console.log('收到数据更新消息:', message)
    // 重新加载订单列表
    this.loadOrders()
  },

  loadOrders: function() {
    wx.showLoading({
      title: '加载中...'
    })

    // 调用后端接口获取订单列表
    wx.request({
      url: config.getApiUrl(config.apiPaths.orderList),
      method: 'GET',
      data: {
        openid: app.globalData.openid || 'test_openid'
      },
      success: (res) => {
        wx.hideLoading()

        if (res.data.code === 200) {
          const orders = res.data.data || []
          // 计算过滤后的订单
          const filteredOrders = this.filterOrders(orders, this.data.currentTab)

          this.setData({
            orders: orders,
            filteredOrders: filteredOrders
          })
        } else {
          wx.showToast({
            title: res.data.message || '加载失败',
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

  // 过滤订单列表
  filterOrders: function(orders, currentTab) {
    let filtered = []
    if (currentTab === 'unpaid') {
      // 显示待支付的订单
      filtered = orders.filter(order => order.status === 'unpaid')
    } else if (currentTab === 'completed') {
      // 显示已完成的订单（已支付和已退款）
      filtered = orders.filter(order => order.status === 'paid' || order.status === 'refunded')
    } else if (currentTab === 'cancelled') {
      // 显示已取消的订单
      filtered = orders.filter(order => order.status === 'cancelled')
    }
    return filtered
  },

  // 切换标签
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab
    const filteredOrders = this.filterOrders(this.data.orders, tab)

    this.setData({
      currentTab: tab,
      filteredOrders: filteredOrders
    })
  },

  returnDeposit: function(e) {
    const orderId = e.currentTarget.dataset.orderno

    wx.showModal({
      title: '确认退还押金',
      content: '确认退还该订单押金吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '处理中...'
          })

          // 调用后端接口退还押金
          wx.request({
            url: config.getApiUrl(config.apiPaths.refundOrder),
            method: 'POST',
            data: {
              orderId: orderId
            },
            success: (res) => {
              wx.hideLoading()

              if (res.data.code === 200) {
                wx.showToast({
                  title: '押金已退还',
                  icon: 'success'
                })
                this.loadOrders()
              } else {
                wx.showToast({
                  title: res.data.message || '退还失败',
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
        }
      }
    })
  },

  viewOrder: function(e) {
    const orderId = e.currentTarget.dataset.orderno
    wx.showToast({
      title: '订单详情功能开发中',
      icon: 'none'
    })
  },

  // 去支付
  goToPay: function(e) {
    const orderId = e.currentTarget.dataset.orderno

    wx.showLoading({
      title: '处理中...'
    })

    // 调用支付接口
    wx.request({
      url: config.getApiUrl('/api/order/pay'),
      method: 'POST',
      data: {
        orderId: orderId
      },
      success: (res) => {
        wx.hideLoading()

        if (res.data.code === 200) {
          wx.showToast({
            title: '支付成功',
            icon: 'success'
          })
          // 切换到已完成标签
          this.setData({
            currentTab: 'completed'
          })
          // 重新加载订单列表
          this.loadOrders()
        } else {
          wx.showToast({
            title: res.data.message || '支付失败',
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

  // 取消订单
  cancelOrder: function(e) {
    const orderId = e.currentTarget.dataset.orderno

    wx.showModal({
      title: '确认取消订单',
      content: '确认取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '处理中...'
          })

          // 调用后端取消订单接口
          wx.request({
            url: config.getApiUrl('/api/order/cancel'),
            method: 'POST',
            data: {
              orderId: orderId
            },
            success: (res) => {
              wx.hideLoading()

              if (res.data.code === 200) {
                wx.showToast({
                  title: '订单已取消',
                  icon: 'success'
                })

                // 重新加载订单列表
                this.loadOrders()
              } else {
                wx.showToast({
                  title: res.data.message || '取消订单失败',
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
        }
      }
    })
  }
})
