const AV = require('leanengine');
const https = require('https');

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function (request) {
  return 'Hello world!';
});

/**
 * 获取微信 Access Token
 *
 * 功能：使用微信授权 code 换取 access_token 和 openid
 *
 * 环境变量配置：
 * - WECHAT_APP_ID: 微信开放平台 AppID
 * - WECHAT_APP_SECRET: 微信开放平台 AppSecret
 *
 * 安全说明：
 * - AppSecret 仅存储在云函数环境变量中，不会暴露给客户端
 * - 此云函数通过 LeanCloud 调用，自动进行身份验证
 */
AV.Cloud.define('getWeChatAccessToken', async (request) => {
  const { code } = request.params;

  console.log('[getWeChatAccessToken] 收到请求, code:', code ? code.substring(0, 10) + '...' : 'null');

  // 参数验证
  if (!code) {
    console.error('[getWeChatAccessToken] 缺少 code 参数');
    throw new AV.Cloud.Error('缺少 code 参数', { code: 40001 });
  }

  // 获取环境变量
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    console.error('[getWeChatAccessToken] 微信配置未完成');
    console.error('- WECHAT_APP_ID:', appId ? '已配置' : '未配置');
    console.error('- WECHAT_APP_SECRET:', appSecret ? '已配置' : '未配置');
    throw new AV.Cloud.Error('微信登录服务未配置', { code: 40002 });
  }

  try {
    // 调用微信 API 获取 access_token
    const result = await getAccessTokenFromWeChat(appId, appSecret, code);

    console.log('[getWeChatAccessToken] 获取 access_token 成功, openid:', result.openid);

    // 获取微信用户信息（昵称、头像等）
    let userInfo = null;
    try {
      userInfo = await getWeChatUserInfo(result.access_token, result.openid);
      console.log('[getWeChatAccessToken] 获取用户信息成功, nickname:', userInfo.nickname);
    } catch (userInfoError) {
      console.warn('[getWeChatAccessToken] 获取用户信息失败，继续登录:', userInfoError.message);
      // 获取用户信息失败不影响登录，继续返回基本信息
    }

    return {
      openid: result.openid,
      access_token: result.access_token,
      expires_in: result.expires_in,
      // 用户信息（如果获取成功）
      nickname: userInfo?.nickname || null,
      headimgurl: userInfo?.headimgurl || null,
      sex: userInfo?.sex || null,
      unionid: result.unionid || userInfo?.unionid || null
    };
  } catch (error) {
    console.error('[getWeChatAccessToken] 获取失败:', error.message);
    throw new AV.Cloud.Error(error.message || '获取微信授权信息失败', { code: 40003 });
  }
});

/**
 * 调用微信 API 获取 access_token
 */
function getAccessTokenFromWeChat(appId, appSecret, code) {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

    console.log('[getAccessTokenFromWeChat] 请求微信 API...');

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('[getAccessTokenFromWeChat] 微信 API 返回:', JSON.stringify(result, null, 2));

          // 检查是否有错误
          if (result.errcode) {
            const errorMsg = getWeChatErrorMessage(result.errcode);
            console.error('[getAccessTokenFromWeChat] 微信 API 错误:', result.errcode, result.errmsg);
            reject(new Error(errorMsg));
            return;
          }

          // 验证必要字段
          if (!result.openid || !result.access_token) {
            console.error('[getAccessTokenFromWeChat] 返回数据不完整');
            reject(new Error('微信返回数据不完整'));
            return;
          }

          resolve({
            openid: result.openid,
            access_token: result.access_token,
            expires_in: result.expires_in || 7200,
            refresh_token: result.refresh_token,
            scope: result.scope,
            unionid: result.unionid
          });
        } catch (e) {
          console.error('[getAccessTokenFromWeChat] 解析响应失败:', e.message);
          reject(new Error('解析微信响应失败'));
        }
      });
    }).on('error', (e) => {
      console.error('[getAccessTokenFromWeChat] 请求失败:', e.message);
      reject(new Error('请求微信服务器失败'));
    });
  });
}

/**
 * 获取微信用户信息
 */
function getWeChatUserInfo(accessToken, openid) {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}&lang=zh_CN`;

    console.log('[getWeChatUserInfo] 请求微信用户信息 API...');

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('[getWeChatUserInfo] 微信 API 返回:', JSON.stringify(result, null, 2));

          // 检查是否有错误
          if (result.errcode) {
            console.error('[getWeChatUserInfo] 微信 API 错误:', result.errcode, result.errmsg);
            reject(new Error(result.errmsg || '获取用户信息失败'));
            return;
          }

          resolve({
            nickname: result.nickname,
            sex: result.sex,
            province: result.province,
            city: result.city,
            country: result.country,
            headimgurl: result.headimgurl,
            privilege: result.privilege,
            unionid: result.unionid
          });
        } catch (e) {
          console.error('[getWeChatUserInfo] 解析响应失败:', e.message);
          reject(new Error('解析微信用户信息失败'));
        }
      });
    }).on('error', (e) => {
      console.error('[getWeChatUserInfo] 请求失败:', e.message);
      reject(new Error('请求微信用户信息失败'));
    });
  });
}

/**
 * 获取微信错误码对应的错误信息
 */
function getWeChatErrorMessage(errcode) {
  const errorMessages = {
    '-1': '系统繁忙，请稍后重试',
    '40001': '获取 access_token 时 AppSecret 错误',
    '40002': '不合法的凭证类型',
    '40003': '不合法的 OpenID',
    '40029': '不合法的 code，或 code 已被使用',
    '40030': '不合法的 refresh_token',
    '40163': 'code 已被使用',
    '41001': '缺少 access_token 参数',
    '41002': '缺少 appid 参数',
    '41003': '缺少 refresh_token 参数',
    '41004': '缺少 secret 参数',
    '41005': '缺少多媒体文件数据',
    '41006': '缺少 media_id 参数',
    '42001': 'access_token 超时',
    '42002': 'refresh_token 超时',
    '42003': 'code 超时',
    '45009': '接口调用超过限制',
    '50001': '用户未授权该 api'
  };

  return errorMessages[errcode.toString()] || `微信错误 (${errcode})`;
}

// ==================== 账号注销功能 ====================

const ACCOUNT_DELETION_DAYS = 21;

function formatDeletionResponse(task, message) {
  const scheduledTimeDate = task.get('scheduledTime');
  const scheduledTimeMs = scheduledTimeDate instanceof Date
    ? scheduledTimeDate.getTime()
    : null;

  return {
    success: true,
    message,
    taskId: task.id,
    deletionTime: scheduledTimeDate || null,
    scheduledTime: scheduledTimeMs,
    // 用于提醒运维：真正执行删除依赖全局定时任务 executeDeletionTasks
    requiresScheduler: true
  };
}

function isClassNotExistsError(error) {
  if (!error) return false;
  if (error.code === 101) return true;
  const rawMessage = String(error.rawMessage || error.message || '').toLowerCase();
  return rawMessage.includes("class or object doesn't exists");
}

async function findUserRelatedRecords(className, userPointer) {
  try {
    return await new AV.Query(className)
      .equalTo('userId', userPointer)
      .find({ useMasterKey: true });
  } catch (error) {
    if (isClassNotExistsError(error)) {
      console.warn(`[executeDeletionTasks] 类 ${className} 不存在，跳过该类清理`);
      return [];
    }
    throw error;
  }
}

/**
 * 申请注销账号
 *
 * @param {Object} request
 * @param {AV.User} request.currentUser - 当前登录用户
 * @returns {Object} { success, message, taskId, deletionTime, scheduledTime, requiresScheduler }
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
    console.log(`[deleteAccount] 用户 ${currentUser.id} 已有待处理任务: ${existingTask.id}`);
    return formatDeletionResponse(
      existingTask,
      '您已提交过注销申请，无需重复提交'
    );
  }

  // 创建新的删除任务
  const DeletionTask = AV.Object.extend('DeletionTask');
  const task = new DeletionTask();

  const now = new Date();
  // 15个工作日后（按21天计算，包含周末）
  const scheduledTime = new Date(now.getTime() + ACCOUNT_DELETION_DAYS * 24 * 60 * 60 * 1000);

  task.set('userId', currentUser);
  task.set('requestTime', now);
  task.set('scheduledTime', scheduledTime);
  task.set('status', 'pending');

  await task.save(null, { useMasterKey: true });
  console.log(
    `[deleteAccount] 创建 DeletionTask 成功, taskId=${task.id}, userId=${currentUser.id}, scheduledTime=${scheduledTime.toISOString()}`
  );

  return formatDeletionResponse(
    task,
    '账号注销申请已提交，等待定时任务执行删除'
  );
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
  task.set('cancelledTime', new Date());
  await task.save(null, { useMasterKey: true });
  console.log(`[cancelAccountDeletion] 已取消任务 taskId=${task.id}, userId=${currentUser.id}`);

  return {
    success: true,
    message: '注销申请已取消',
    taskId: task.id
  };
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
      scheduledTime: null,
      taskId: null
    };
  }

  return {
    isPending: true,
    requestTime: task.get('requestTime').getTime(),
    scheduledTime: task.get('scheduledTime').getTime(),
    taskId: task.id
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
      if (!userId || !userId.id) {
        throw new Error('DeletionTask 缺少有效 userId 指针');
      }

      // 1. 删除用户的学习数据（UserWord表）
      const userWords = await findUserRelatedRecords('UserWord', userId);

      if (userWords.length > 0) {
        await AV.Object.destroyAll(userWords, { useMasterKey: true });
        console.log(`删除了 ${userWords.length} 条学习数据`);
      }

      // 2. 删除用户的订单数据（Order表）
      const orders = await findUserRelatedRecords('Order', userId);

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
      task.set('completedTime', new Date());
      await task.save(null, { useMasterKey: true });

      results.push({
        userId: userId.id,
        success: true
      });

    } catch (error) {
      const taskUser = task.get('userId');
      const failedUserId = taskUser && taskUser.id ? taskUser.id : 'unknown';
      task.set('status', 'failed');
      task.set('failedTime', new Date());
      task.set('error', error.message || String(error));
      await task.save(null, { useMasterKey: true });

      console.error(`删除用户 ${failedUserId} 失败:`, error);
      results.push({
        userId: failedUserId,
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
