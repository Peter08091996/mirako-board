import './globals.css'

export const metadata = {
  title: 'mirako - 任务看板',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
