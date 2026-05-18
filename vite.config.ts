import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '패밀리 퀘스트',
        short_name: 'FamilyQuest',
        description: '우리 가족 미션 보상 앱',
        theme_color: '#7B5EA7',
        background_color: '#5C8A1E',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',    // 모든 네트워크 인터페이스에서 수신
    port: 5173,
    strictPort: false,  // 5173 사용 중이면 자동으로 다음 포트 사용
    https: false,
    // 로컬망(192.168.x.x) + ngrok 모두 허용
    allowedHosts: 'true',
  }
})