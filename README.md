# mirako 任务看板（Next.js + Supabase 公网版）

为 4 人小团队设计的极简任务同步工具。**只有任务 + 人 + 状态**，没有工时、没有审批、没有复杂权限。

## 团队

Peter、TamikiP、落川、小坑酱

## 技术栈

- **前端**：Next.js 14（App Router）+ 手绘风格 CSS
- **后端/数据库**：Supabase（PostgreSQL + Auth + Realtime）
- **部署**：GitHub Pages / Vercel / Netlify 等静态托管

## 项目结构

```
app/
  layout.tsx        # 根布局
  page.tsx          # 入口页面（客户端渲染）
  globals.css       # 手绘风格样式
components/
  HomeClient.tsx    # 登录 + 看板 核心逻辑
lib/
  supabase.ts       # Supabase 客户端配置
.env.local          # Supabase URL / Anon Key（已隐藏，不提交到 Git）
```

## 快速开始

### 1. 环境变量

项目根目录已包含 `.env.local`，格式如下：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

**注意**：`NEXT_PUBLIC_` 前缀的变量会在构建时被打包进前端，因此 Anon Key 仍然是公开的（这是 Supabase 的设计），真正的安全由 RLS 策略保证。

### 2. 安装依赖

```bash
npm install
```

### 3. 本地预览

```bash
npm run dev
# 打开 http://localhost:3000
```

### 4. 构建（本地预览）

```bash
npm run build
```

## 部署到 Vercel（推荐）

由于仓库已设为 private，最方便的方式是用 Vercel CLI 直接部署本地代码：

```bash
npx vercel login    # 第一次需要登录你的 Vercel 账号
npx vercel --prod   # 部署到生产环境
```

或者，你也可以在 [vercel.com](https://vercel.com) 新建项目，导入 GitHub 仓库（需要授权 Vercel 访问你的 private repo），每次 push 自动部署。

> Vercel 原生支持 Next.js，不需要静态导出，所有路由和客户端渲染都能完美运行。

## 使用说明

| 操作 | 方式 |
|------|------|
| 登录/注册 | 输入邮箱 + 密码，点击**登录**或**注册** |
| 新建任务 | 点击列底部的 **+ 新建任务**，输入内容确认 |
| 编辑任务 | **点击任务文字** 直接修改，回车或点外部保存 |
| 指派/取消指派 | 点击卡片底部的 **成员头像** 切换 |
| 切换状态 | **拖拽** 任务卡片到另一列 |
| 删除任务 | 鼠标 hover 卡片右上角出现 **×**，点击删除 |
| 筛选成员 | 点击顶部 **成员头像**，只看他的任务 |
| 退出登录 | 点击右上角 **退出** |

## 成员资料初始化

同事自己注册后，Supabase 默认生成的 profile 名字会是 `User`、缩写 `U`。

等大家都注册完，你可以在 Supabase SQL Editor 里执行：

```sql
update public.profiles set name = 'TamikiP', abbr = 'T' where id = '他的UUID';
update public.profiles set name = '落川',    abbr = '落' where id = '他的UUID';
update public.profiles set name = '小坑酱',  abbr = '坑' where id = '他的UUID';
```

## 故障排查

- **注册后无法登录**：检查 Supabase Dashboard → Authentication → Providers → Email，确认是否开启了 "Confirm email"。如果开启了，注册后需要点邮箱里的确认链接。对于小团队，建议**关闭**该选项。
- **实时同步不生效**：检查 Supabase Dashboard → Database → Replication，确认 `tasks` 表在 `supabase_realtime` publication 中。
