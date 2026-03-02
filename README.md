# LeanCloud 云引擎 - 账号注销功能

## 项目结构

```
leancloud/
├── package.json          # 项目依赖
├── server.js            # 服务器入口
├── cloud.js             # 云函数定义
├── routes/              # 路由目录
│   └── todos.js         # 示例路由
└── .gitignore          # Git 忽略文件
```

## 云函数列表

### 1. deleteAccount
申请注销账号

### 2. cancelAccountDeletion
取消注销申请

### 3. getAccountDeletionStatus
查询注销状态

### 4. executeDeletionTasks
执行账号删除（定时任务）

## 部署步骤

### 方式一：通过 GitHub 部署（推荐）

1. **提交代码到 GitHub**
   ```bash
   cd leancloud
   git init
   git add .
   git commit -m "Add account deletion cloud functions"
   git remote add origin <你的GitHub仓库地址>
   git push -u origin master
   ```

2. **在 LeanCloud 控制台配置**
   - 进入云引擎 → 部署 → Git 部署
   - 选择 GitHub 仓库
   - 选择分支（master）
   - 点击部署

### 方式二：通过命令行部署

1. **安装 LeanCloud CLI**
   ```bash
   npm install -g leancloud-cli
   ```

2. **登录**
   ```bash
   lean login
   ```

3. **部署**
   ```bash
   cd leancloud
   lean deploy
   ```

## 配置定时任务

在 LeanCloud 控制台：
1. 云引擎 → 定时任务
2. 创建定时任务
3. 函数名：executeDeletionTasks
4. Cron 表达式：0 2 * * *
5. 时区：Asia/Shanghai

## 测试

在 LeanCloud 控制台 → 云引擎 → 云函数，可以测试每个函数。
