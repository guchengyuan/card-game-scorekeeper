const isDevToolsEnv = () => {
  try {
    // #ifdef MP-WEIXIN
    // @ts-ignore
    if (wx.getDeviceInfo) {
      // @ts-ignore
      const info = wx.getDeviceInfo()
      return info.platform === 'devtools'
    }
    // @ts-ignore
    const sys = wx.getSystemInfoSync()
    return sys.platform === 'devtools'
    // #endif

    // #ifndef MP-WEIXIN
    const info = uni.getSystemInfoSync()
    return info?.platform === 'devtools' || info?.model === 'devtools'
    // #endif
  } catch {
    return false
  }
}

const getServerProtocol = () => {
  if (isDevToolsEnv()) {
    const devOverride = uni.getStorageSync('server_protocol_devtools')
    if (devOverride) return String(devOverride)
    return 'http'
  }
  const override = uni.getStorageSync('server_protocol')
  if (override) return String(override)
  return 'http'
}

const getServerPort = () => {
  const parsePort = (val: any) => {
    const n = Number(String(val || '').trim())
    if (!Number.isFinite(n)) return null
    if (n <= 0 || n > 65535) return null
    return Math.floor(n)
  }

  if (isDevToolsEnv()) {
    const devOverride = parsePort(uni.getStorageSync('server_port_devtools'))
    if (devOverride) return devOverride
    return 3000
  }

  const override = parsePort(uni.getStorageSync('server_port'))
  if (override) return override
  return 3000
}

const getServerHost = () => {
  if (isDevToolsEnv()) {
    const devOverride = uni.getStorageSync('server_host_devtools')
    if (devOverride) return String(devOverride)
    return '127.0.0.1'
  }

  const override = uni.getStorageSync('server_host')
  if (override) return String(override)

  // @ts-ignore
  return process.env.VITE_SERVER_IP || '127.0.0.1'
}

const getBaseUrl = () => `${getServerProtocol()}://${getServerHost()}:${getServerPort()}/api`

let promptingServerHost = false
const maybePromptServerHost = (err: any) => {
  if (promptingServerHost) return

  const override = uni.getStorageSync('server_host')
  if (override) return

  const isDevtools = isDevToolsEnv()
  if (isDevtools) return

  // @ts-ignore
  const envHost = process.env.VITE_SERVER_IP
  if (envHost && !/^(127\.0\.0\.1|localhost)$/i.test(String(envHost).trim())) return

  const message = String((err as any)?.errMsg || (err as any)?.message || '')
  if (!message) return
  if (!/request:fail|timeout|ERR_CONNECTION_REFUSED|connect ECONNREFUSED|ECONNREFUSED/i.test(message)) return
  const host = getServerHost()

  promptingServerHost = true
  const safetyTimer = setTimeout(() => {
    promptingServerHost = false
  }, 8000)
  try {
    uni.showModal({
      title: '设置服务器IP',
      content: `当前连接失败（${host}:3000）。真机通常不能访问 127.0.0.1/localhost，请输入电脑局域网IP（例如 192.168.2.2）`,
      editable: true,
      placeholderText: '例如 192.168.2.2',
      success: (res) => {
        if (res.confirm) {
          const value = String((res as any).content || '').trim()
          if (value) {
            uni.setStorageSync('server_host', value)
            uni.showToast({ title: '已保存，请重试', icon: 'none' })
          }
        }
        clearTimeout(safetyTimer)
        promptingServerHost = false
      },
      fail: () => {
        clearTimeout(safetyTimer)
        promptingServerHost = false
      }
    })
  } catch {
    clearTimeout(safetyTimer)
    promptingServerHost = false
  }
}

export const request = (options: UniApp.RequestOptions) => {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      timeout: 10000,
      url: getBaseUrl() + options.url,
      header: {
        'Content-Type': 'application/json',
        ...options.header,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res);
          uni.showToast({
            title: (res.data as any).message || '请求失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        reject(err);
        maybePromptServerHost(err)
        uni.showToast({
          title: '网络错误',
          icon: 'none'
        });
      }
    });
  });
};

export default request;
