const AV = require('leanengine');

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function (request) {
  return 'Hello world!';
});

/**
 * 获取微信 Access Token
 *
 * 这是你现有的云函数
 */
AV.Cloud.define('getWeChatAccessToken', async (request) => {
  // 你的现有实现
  // ...
});

// ==================== 账号注销功能 ====================

/**
 * 申请注销账号
 *
 * @param {Object} request
 * @param {AV.User} request.currentUser - 当前登录用户
 * @returns {Object} { scheduledTime: 预计删除时间（毫秒时间戳） }
 */
AV.Cloud.define('deleteAccount', async (request) => {
  const currentUser = request.currentUser;

  if (!currentUser) {
    throw new AV.Cloud.Error('未登录', { code: 401 });
  }

  // 检查是否已有待处理的注销申请
  const existingTask = await new AV.Query('DeletionTask')
    .equalTo('userId', currentUser)
    .equalTo('status', 'pending')
    .first({ useMasterKey: true });

  if (existingTask) {
    // 如果已有申请，返回现有的预计删除时间
    return {
      scheduledTime: existingTask.get('scheduledTime').getTime()
    };
  }

  // 创建新的删除任务
  const DeletionTask = AV.Object.extend('DeletionTask');
  const task = new DeletionTask();

  const now = new Date();
  // 15个工作日后（按21天计算，包含周末）
  const scheduledTime = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

  task.set('userId', currentUser);
  task.set('requestTime', now);
  task.set('scheduledTime', scheduledTime);
  task.set('status', 'pending');

  await task.save(null, { useMasterKey: true });

  return {
    scheduledTime: scheduledTime.getTime()
  };
});

/**
 * 取消注销申请
 *
 * @param {Object} request
 * @param {AV.User} request.currentUser - 当前登录用户
 * @returns {Object} { success: true }
 */
AV.Cloud.define('cancelAccountDeletion', async (request) => {
  const currentUser = request.currentUser;

  if (!currentUser) {
    throw new AV.Cloud.Error('未登录', { code: 401 });
  }

  // 查找待处理的注销申请
  const task = await new AV.Query('DeletionTask')
    .equalTo('userId', currentUser)
    .equalTo('status', 'pending')
    .first({ useMasterKey: true });

  if (!task) {
    throw new AV.Cloud.Error('没有待处理的注销申请', { code: 404 });
  }

  // 更新状态为已取消
  task.set('status', 'cancelled');
  await task.save(null, { useMasterKey: true });

  return { success: true };
});

/**
 * 查询注销状态
 *
 * @param {Object} request
 * @param {AV.User} request.currentUser - 当前登录用户
 * @returns {Object} { isPending, requestTime, scheduledTime }
 */
AV.Cloud.define('getAccountDeletionStatus', async (request) => {
  const currentUser = request.currentUser;

  if (!currentUser) {
    throw new AV.Cloud.Error('未登录', { code: 401 });
  }

  // 查找待处理的注销申请
  const task = await new AV.Query('DeletionTask')
    .equalTo('userId', currentUser)
    .equalTo('status', 'pending')
    .first({ useMasterKey: true });

  if (!task) {
    return {
      isPending: false,
      requestTime: null,
      scheduledTime: null
    };
  }

  return {
    isPending: true,
    requestTime: task.get('requestTime').getTime(),
    scheduledTime: task.get('scheduledTime').getTime()
  };
});

/**
 * 执行账号删除任务（定时任务）
 *
 * 每天凌晨2点执行，删除到期的账号
 */
AV.Cloud.define('executeDeletionTasks', async (request) => {
  const now = new Date();

  // 查找所有到期的待处理任务
  const tasks = await new AV.Query('DeletionTask')
    .equalTo('status', 'pending')
    .lessThanOrEqualTo('scheduledTime', now)
    .find({ useMasterKey: true });

  console.log(`找到 ${tasks.length} 个到期的删除任务`);

  const results = [];

  for (const task of tasks) {
    try {
      const userId = task.get('userId');

      // 1. 删除用户的学习数据（UserWord表）
      const userWords = await new AV.Query('UserWord')
        .equalTo('userId', userId)
        .find({ useMasterKey: true });

      if (userWords.length > 0) {
        await AV.Object.destroyAll(userWords, { useMasterKey: true });
        console.log(`删除了 ${userWords.length} 条学习数据`);
      }

      // 2. 删除用户的订单数据（Order表）
      const orders = await new AV.Query('Order')
        .equalTo('userId', userId)
        .find({ useMasterKey: true });

      if (orders.length > 0) {
        await AV.Object.destroyAll(orders, { useMasterKey: true });
        console.log(`删除了 ${orders.length} 条订单数据`);
      }

      // 3. 删除用户头像文件（如果有）
      const user = await new AV.Query('_User')
        .get(userId.id, { useMasterKey: true });

      const avatarUrl = user.get('avatar');
      if (avatarUrl) {
        try {
          // 从URL中提取文件ID
          const fileId = avatarUrl.split('/').pop().split('?')[0];
          const file = AV.File.createWithoutData(fileId);
          await file.destroy({ useMasterKey: true });
          console.log(`删除了头像文件: ${fileId}`);
        } catch (error) {
          console.error('删除头像文件失败:', error);
        }
      }

      // 4. 删除用户账号
      await user.destroy({ useMasterKey: true });
      console.log(`删除了用户账号: ${userId.id}`);

      // 5. 更新任务状态为已完成
      task.set('status', 'completed');
      await task.save(null, { useMasterKey: true });

      results.push({
        userId: userId.id,
        success: true
      });

    } catch (error) {
      console.error(`删除用户 ${task.get('userId').id} 失败:`, error);
      results.push({
        userId: task.get('userId').id,
        success: false,
        error: error.message
      });
    }
  }

  return {
    total: tasks.length,
    results: results
  };
});

module.exports = AV.Cloud;
