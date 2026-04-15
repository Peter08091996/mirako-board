# mirako 任务看板（Supabase 公网版）

为 4 人小团队设计的极简任务同步工具。**只有任务 + 人 + 状态**，没有工时、没有审批、没有复杂权限。

## 团队

Peter、TamikiP、落川、小坑酱

## 技术栈

- **前端**：单文件 HTML + 原生 JS + 手绘风格 CSS
- **后端/数据库**：Supabase（PostgreSQL + Auth + Realtime）
- **部署**：任何静态托管（Vercel / Netlify / Cloudflare Pages / 你自己的服务器）

## 快速开始

### 1. 创建 Supabase 项目

1. 去 [supabase.com](https://supabase.com) 新建一个免费项目
2. 记下 **Project URL** 和 **Anon Key**

### 2. 初始化数据库

打开 Supabase Dashboard → SQL Editor，新建查询，把 `supabase.sql` 的全部内容粘贴进去并执行。

### 3. 添加 4 位成员

1. Dashboard → **Authentication → Users**
2. 为 4 个人分别创建用户（邮箱密码或 Magic Link 方式）
3. 点击每个用户，复制他们的 **UUID**
4. 回到 SQL Editor，执行类似下面的插入语句（把 UUID 换成真实的）：

```sql
insert into public.profiles (id, name, abbr) values
  ('a1b2c3d4-...', 'Peter',    'P'),
  ('e5f6g7h8-...', 'TamikiP',  'T'),
  ('i9j0k1l2-...', '落川',      '落'),
  ('m3n4o5p6-...', '小坑酱',    '坑');
```

> 建议把 4 个人的邮箱和密码记在一个共享文档里，方便互相登录。

### 4. 配置前端

打开 `index.html`，找到顶部配置区，填入你的 Supabase 信息：

```javascript
const CONFIG_URL = 'https://你的项目.supabase.co';
const CONFIG_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

保存。

### 5. 部署

把 `index.html` 部署到任意静态托管即可。推荐方式：

#### Vercel（最简单）

```bash
npm i -g vercel
vercel --prod
```

#### 或者直接用本机当临时服务器

```bash
npm install
npm start
# 然后访问 http://localhost:3456
```

## 使用说明

| 操作 | 方式 |
|------|------|
| 登录 | 输入 Supabase URL + Key + 自己的邮箱，发送 Magic Link，去邮箱点击链接 |
| 新建任务 | 点击列底部的 **+ 新建任务**，输入回车 |
| 编辑任务 | **点击任务文字** 直接修改，回车或点外部保存 |
| 指派/取消指派 | 点击卡片底部的 **成员头像** 切换 |
| 切换状态 | **拖拽** 任务卡片到另一列 |
| 删除任务 | 鼠标 hover 卡片右上角出现 **×**，点击删除 |
| 筛选成员 | 点击顶部 **成员头像**，只看他的任务 |
| 退出登录 | 点击右上角 **退出** |

## 安全说明

- `Anon Key` 是 Supabase 专门用于前端的公开密钥，可以安全地写在前端代码里
- 真正的权限由 Supabase **RLS（行级安全策略）** 控制：只有已登录用户才能读写 `tasks` 表
- 如果需要更隐蔽，可以在部署平台设置环境变量，让构建时注入 URL 和 Key

## 文件结构

```
.
├── index.html      # 完整的单页应用（含手绘 UI + Supabase 逻辑）
├── supabase.sql    # 数据库初始化脚本
├── server.js       # 可选的本地静态文件服务器
└── README.md       # 本文件
```

## 故障排查

- **看板空白/无数据**：检查 Supabase URL 和 Anon Key 是否填对；检查 SQL 是否执行成功；检查 profiles 表里 4 条记录是否存在。
- **实时同步不生效**：在 Supabase Dashboard → Database → Replication 中确认 `tasks` 表已加入 `supabase_realtime` publication。
- **Magic Link 没收到**：检查垃圾邮件箱；或改用 Supabase Auth 的 "Invite" 或 "Create user" 直接生成账号密码。
