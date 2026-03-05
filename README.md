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

## 关键说明（避免误判）

- `deleteAccount` 不会在「云引擎 -> 定时任务」里按用户新增一条任务。
- `deleteAccount` 的作用是写入一条 `DeletionTask` 数据记录（状态 `pending`）。
- 真正执行删除依赖一个全局 Cron 任务：`executeDeletionTasks`。
- 因此排查时要看两个地方：
  - 「数据存储 -> 结构化数据 -> DeletionTask」是否有新记录；
  - 「云引擎 -> 定时任务」是否已创建并启用 `executeDeletionTasks`。

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
6. 状态：启用

## 最小验证步骤

1. 在「云引擎 -> 云函数」以某个测试用户身份运行 `deleteAccount`，应返回 `success: true` 和 `taskId/scheduledTime`。
2. 打开「数据存储 -> 结构化数据 -> DeletionTask」，确认出现对应 `taskId` 且 `status = pending`。
3. 在「云引擎 -> 定时任务」确认 `executeDeletionTasks` 的 Cron 任务存在且启用。
4. 将某条 `DeletionTask.scheduledTime` 临时改成过去时间，手动运行 `executeDeletionTasks`，确认任务状态变为 `completed`（或失败时为 `failed` 并有 `error` 字段）。

## 测试

在 LeanCloud 控制台 → 云引擎 → 云函数，可以测试每个函数。
