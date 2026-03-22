const app = getApp();
const config = require('../../config/api.js');

Page({
  data: {
    orders: [],
    currentTab: 'completed',  // 当前标签: completed, unpaid, cancelled
    filteredOrders: []  // 过滤后的订单列表
  },

  onLoad: function (options) {
    // 检查 app 是否已初始化，添加重试限制
    if (!app || !app.globalData) {
      const retryCount = this.data.initRetryCount || 0
      if (retryCount >= 5) {
        console.error('订单页: App初始化重试次数超限，跳过初始化')
        // 继续执行，不调用 app 相关功能
        this.loadOrders()
        return
      }

      console.error(`订单页: App未初始化，第 ${retryCount + 1} 次重试...`)
      this.setData({ initRetryCount: retryCount + 1 })

      setTimeout(() => {
        console.log('订单页: 重试初始化')
        this.onLoad(options)
      }, 500)
      return
    }

    this.loadOrders()
    this.connectWebSocket()
  },

  onUnload: function() {
    // 订单页卸载时不关闭全局 WebSocket，由 app.js 统一管理
  },

  onShow: function () {
    this.loadOrders()
  },

  // 接收全局 WebSocket 消息
  onSocketMessage: function(message) {
    console.log('订单页收到全局消息:', message)

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
  },

  // 连接WebSocket - 使用全局连接，避免重复
  connectWebSocket: function() {
    // 只触发全局连接，不创建新连接
    console.log('订单页: 触发全局WebSocket连接')
    app.connectWebSocket()
  },

  // 关闭WebSocket - 订单页不关闭，由全局管理
  closeWebSocket: function() {
    console.log('订单页: 不关闭全局WebSocket，由app.js统一管理')
  },

  handleOrderPaid: function(message) {
    console.log('订单页: 处理订单支付消息', message)
    this.setData({
      currentTab: 'completed'
    })
    this.loadOrders()
  },

  handleOrderRefunded: function(message) {
    console.log('订单页: 处理订单退款消息', message)
    this.setData({
      currentTab: 'completed'
    })
    this.loadOrders()
  },

  handleOrderCancelled: function(message) {
    console.log('订单页: 处理订单取消消息', message)
    if (this.data.currentTab !== 'cancelled') {
      this.setData({
        currentTab: 'cancelled'
      })
    }
    this.loadOrders()
  },

  handleDataUpdate: function(message) {
    console.log('订单页: 处理数据更新消息', message)
    this.loadOrders()
  },

  loadOrders: function() {
    wx.showLoading({
      title: '加载中...'
    })

    wx.request({
      url: config.getApiUrl(config.apiPaths.myOrderList),
      method: 'GET',
      header: { 'x-user-token': app.globalData.userToken },
      data: {},
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
            url: config.getApiUrl(config.apiPaths.myRefundOrder),
            method: 'POST',
            header: { 'x-user-token': app.globalData.userToken },
            data: { orderId: orderId },
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

    wx.request({
      url: config.getApiUrl('/api/order/pay'),
      method: 'POST',
      header: { 'x-user-token': app.globalData.userToken },
      data: { orderId: orderId },
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
            url: config.getApiUrl(config.apiPaths.myCancelOrder),
            method: 'POST',
            header: { 'x-user-token': app.globalData.userToken },
            data: { orderId: orderId },
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
