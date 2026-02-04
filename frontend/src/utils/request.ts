const getServerHost = () => {
  const override = uni.getStorageSync('server_host')
  if (override) return String(override)

  try {
    const info = uni.getSystemInfoSync()
    if (info?.platform === 'devtools' || info?.model === 'devtools') return '127.0.0.1'
  } catch {}

  // @ts-ignore
  return process.env.VITE_SERVER_IP || '127.0.0.1'
}

const getBaseUrl = () => `http://${getServerHost()}:3000/api`

let promptingServerHost = false
const maybePromptServerHost = (err: any) => {
  if (promptingServerHost) return

  const override = uni.getStorageSync('server_host')
  if (override) return

  let isDevtools = false
  try {
    const info = uni.getSystemInfoSync()
    isDevtools = info?.platform === 'devtools' || info?.model === 'devtools'
  } catch {}
  if (isDevtools) return

  // @ts-ignore
  const envHost = process.env.VITE_SERVER_IP
  if (envHost) return

  const message = String((err as any)?.errMsg || '')
  if (!message) return
  if (!/request:fail|ERR_CONNECTION_REFUSED|connect ECONNREFUSED/i.test(message)) return
  if (getServerHost() !== '127.0.0.1') return

  promptingServerHost = true
  uni.showModal({
    title: '设置服务器IP',
    content: '真机不能访问 127.0.0.1，请输入电脑局域网IP（例如 192.168.2.2）',
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
      promptingServerHost = false
    },
    fail: () => {
      promptingServerHost = false
    }
  })
}

export const request = (options: UniApp.RequestOptions) => {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
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
