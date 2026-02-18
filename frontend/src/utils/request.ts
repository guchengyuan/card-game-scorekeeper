const getServerProtocol = () => {
  // 强制使用 HTTPS
  return 'https'
}

const getServerPort = () => {
  // 强制使用 443
  return 443
}

const getServerHost = () => {
  // 强制返回云托管域名
  return 'card-game-225112-8-1403978532.sh.run.tcloudbase.com'
}

const getBaseUrl = () => `${getServerProtocol()}://${getServerHost()}:${getServerPort()}/api`

export const request = (options: UniApp.RequestOptions) => {
  return new Promise((resolve, reject) => {
    const url = getBaseUrl() + options.url
    console.log('Requesting:', url)

    uni.request({
      ...options,
      timeout: 10000,
      url: url,
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
        console.error('Request fail:', err);
        uni.showToast({
          title: '网络错误',
          icon: 'none'
        });
      }
    });
  });
};

export default request;
