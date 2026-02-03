import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import os from 'os'

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          return alias.address;
        }
      }
    }
  }
  return '127.0.0.1';
}

const localIP = getLocalIP();
console.log('Auto-detected Server IP:', localIP);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
  ],
  define: {
    'process.env.VITE_SERVER_IP': JSON.stringify(localIP)
  }
})