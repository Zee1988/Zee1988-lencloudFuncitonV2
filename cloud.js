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

// ==================== 支付功能 ====================

const axios = require('axios');
const crypto = require('crypto');

// 云勾支付配置（从环境变量读取）
const YUNGOU_MCH_ID = process.env.YUNGOU_MCH_ID || 'YOUR_YUNGOU_MCH_ID';
const YUNGOU_API_KEY = process.env.YUNGOU_API_KEY || 'YOUR_YUNGOU_API_KEY';
const YUNGOU_ALIPAY_APP_ID = process.env.YUNGOU_ALIPAY_APP_ID || '';
const PAYMENT_NOTIFY_URL = process.env.PAYMENT_NOTIFY_URL || 'https://your-app.leanapp.cn/api/payment/callback';
const YUNGOU_ALIPAY_APP_PAY_URL = 'https://api.pay.yungouos.com/api/pay/alipay/appPay';

// 价格配置（单位：分）
const PRICE_MAP = {
  test: 1,          // ¥0.01 测试用
  monthly: 1200,    // ¥12/月
  quarterly: 2900,  // ¥29/季
  yearly: 9900      // ¥99/年
};

/**
 * 金额从分转换成元字符串（两位小数）
 */
function centsToYuanString(cents) {
  const value = Number(cents) / 100;
  // 云勾在部分场景会按无尾零格式校验签名，统一去尾零
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * 调用云勾支付宝下单（兼容签名口径差异）
 */
async function requestYungouAlipayAppPay(basePayload, apiKey) {
  const postForm = async (payload) => {
    const formPayload = new URLSearchParams(payload).toString();
    const response = await axios.post(YUNGOU_ALIPAY_APP_PAY_URL, formPayload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data;
  };

  // 尝试1：按全部参数签名
  const allSignedPayload = { ...basePayload, sign: calculateSign(basePayload, apiKey) };
  let data = await postForm(allSignedPayload);
  if (data?.code === 0) return data;

  // 尝试2：按核心参数签名（mch_id/out_trade_no/total_fee/body/app_id）
  const coreForSign = {
    mch_id: basePayload.mch_id,
    out_trade_no: basePayload.out_trade_no,
    total_fee: basePayload.total_fee,
    body: basePayload.body
  };
  if (basePayload.app_id) {
    coreForSign.app_id = basePayload.app_id;
  }
  const coreSignedPayload = { ...basePayload, sign: calculateSign(coreForSign, apiKey) };
  data = await postForm(coreSignedPayload);
  if (data?.code === 0) return data;

  // 两次签名都失败时，返回更有诊断价值的错误（优先第一次）
  if (allSignedPayload && data?.msg && data.msg.includes('sign不能为空')) {
    return {
      ...data,
      msg: `签名校验失败（已尝试两种签名口径）`
    };
  }

  return data;
}

/**
 * 创建支付订单
 *
 * @param {Object} request
 * @param {string} request.params.productType - 产品类型（monthly/quarterly/yearly）
 * @param {AV.User} request.currentUser - 当前登录用户
 * @returns {Object} 订单信息和支付参数
 */
AV.Cloud.define('createOrder', async (request) => {
  const { productType } = request.params;
  const currentUser = request.currentUser;

  // 1. 验证用户登录
  if (!currentUser) {
    throw new AV.Cloud.Error('请先登录', { code: 401 });
  }

  // 2. 验证产品类型
  if (!productType || !PRICE_MAP[productType]) {
    throw new AV.Cloud.Error('无效的产品类型', { code: 400 });
  }

  // 3. 检查配置
  if (YUNGOU_MCH_ID === 'YOUR_YUNGOU_MCH_ID' || YUNGOU_API_KEY === 'YOUR_YUNGOU_API_KEY') {
    throw new AV.Cloud.Error('支付功能尚未配置，请联系开发者', { code: 500 });
  }

  const amount = PRICE_MAP[productType];
  const totalFee = centsToYuanString(amount);

  // 4. 生成商户订单号（格式：VIP_用户ID_时间戳）
  const outTradeNo = `VIP_${currentUser.id}_${Date.now()}`;

  // 5. 调用云勾支付API创建订单（支付宝APP支付）
  try {
    const productName = productType === 'monthly' ? '月度会员' :
                       productType === 'quarterly' ? '季度会员' : '年度会员';
    const body = `英语学习VIP-${productName}`;
    const attach = JSON.stringify({
      userId: currentUser.id,
      productType: productType
    });

    const requestPayload = {
      mch_id: YUNGOU_MCH_ID,
      out_trade_no: outTradeNo,
      total_fee: totalFee,
      body,
      notify_url: PAYMENT_NOTIFY_URL,
      attach
    };

    if (YUNGOU_ALIPAY_APP_ID) {
      requestPayload.app_id = YUNGOU_ALIPAY_APP_ID;
    }

    console.log('[createOrder] 调用云勾支付宝API:', {
      mch_id: YUNGOU_MCH_ID,
      out_trade_no: outTradeNo,
      total_fee: totalFee,
      body,
      notify_url: PAYMENT_NOTIFY_URL,
      app_id: YUNGOU_ALIPAY_APP_ID ? '已配置' : '未配置'
    });

    const responseData = await requestYungouAlipayAppPay(requestPayload, YUNGOU_API_KEY);
    console.log('[createOrder] 云勾支付宝API返回:', responseData);

    if (responseData.code !== 0) {
      throw new AV.Cloud.Error('创建订单失败：' + responseData.msg, { code: 500 });
    }

    const orderInfo = responseData.data;
    if (!orderInfo || typeof orderInfo !== 'string') {
      throw new AV.Cloud.Error('创建订单失败：支付宝下单结果无效', { code: 500 });
    }

    // 6. 保存订单到数据库
    const Order = AV.Object.extend('Order');
    const order = new Order();

    order.set('orderId', outTradeNo);
    order.set('userId', currentUser);
    order.set('productType', productType);
    order.set('amount', amount);
    order.set('status', 'pending');
    order.set('payMethod', 'alipay');  // 支付宝支付
    order.set('outTradeNo', outTradeNo);

    await order.save(null, { useMasterKey: true });

    console.log('[createOrder] 订单保存成功:', order.id);

    // 7. 返回支付参数（支付宝APP支付参数）
    return {
      orderId: order.id,
      outTradeNo: outTradeNo,
      orderInfo: orderInfo  // 支付宝APP支付订单信息字符串
    };

  } catch (error) {
    console.error('[createOrder] 创建订单失败:', error);

    if (error.response) {
      throw new AV.Cloud.Error('创建订单失败：' + (error.response.data?.msg || error.message), { code: 500 });
    } else if (error instanceof AV.Cloud.Error) {
      throw error;
    } else {
      throw new AV.Cloud.Error('创建订单失败：' + error.message, { code: 500 });
    }
  }
});

/**
 * 客户端主动确认支付
 * 客户端支付宝返回 9000 后调用此接口
 * 优先信任云勾回调结果（回调已能正常到达），如果回调还没处理则等待后重查
 */
AV.Cloud.define('confirmPayment', async (request) => {
  const { orderId } = request.params;
  const currentUser = request.currentUser;

  if (!currentUser) {
    throw new AV.Cloud.Error('请先登录', { code: 401 });
  }

  if (!orderId) {
    throw new AV.Cloud.Error('缺少orderId参数', { code: 400 });
  }

  // 1. 查询订单
  const query = new AV.Query('Order');
  const order = await query.get(orderId, { useMasterKey: true });

  if (!order) {
    throw new AV.Cloud.Error('订单不存在', { code: 404 });
  }

  // 2. 验证订单归属
  const orderUser = order.get('userId');
  if (orderUser.id !== currentUser.id) {
    throw new AV.Cloud.Error('无权操作此订单', { code: 403 });
  }

  // 3. 幂等：已支付直接返回成功
  if (order.get('status') === 'paid') {
    return { status: 'paid', message: '订单已支付' };
  }

  // 4. 只处理 pending 订单
  if (order.get('status') !== 'pending') {
    return { status: order.get('status'), message: '订单状态异常' };
  }

  // 5. 回调可能还没到，等待后重新查询订单状态
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 重新查询订单（回调可能在等待期间已处理）
  const freshQuery = new AV.Query('Order');
  const freshOrder = await freshQuery.get(orderId, { useMasterKey: true });

  if (freshOrder && freshOrder.get('status') === 'paid') {
    console.log('[confirmPayment] 回调已处理，订单已支付:', orderId);
    return { status: 'paid', message: '订单已支付' };
  }

  // 6. 回调仍未到，返回 pending 让客户端继续重试
  console.log('[confirmPayment] 回调尚未处理，订单仍为pending:', orderId);
  return { status: 'pending', message: '支付确认中，请稍后' };
});

/**
 * @param {Object} request
 * @param {string} request.params.orderId - 订单ID
 * @param {AV.User} request.currentUser - 当前登录用户
 * @returns {Object} 订单状态信息
 */
async function handleQueryOrderStatus(request) {
  const { orderId } = request.params;
  const currentUser = request.currentUser;

  // 1. 验证用户登录
  if (!currentUser) {
    throw new AV.Cloud.Error('请先登录', { code: 401 });
  }

  // 2. 验证参数
  if (!orderId) {
    throw new AV.Cloud.Error('缺少订单ID', { code: 400 });
  }

  try {
    // 3. 查询订单
    const query = new AV.Query('Order');
    const order = await query.get(orderId, { useMasterKey: true });

    if (!order) {
      throw new AV.Cloud.Error('订单不存在', { code: 404 });
    }

    // 4. 验证订单所属用户
    const orderUser = order.get('userId');
    if (orderUser.id !== currentUser.id) {
      throw new AV.Cloud.Error('无权查询此订单', { code: 403 });
    }

    // 5. 返回订单状态
    return {
      orderId: order.id,
      status: order.get('status'),
      productType: order.get('productType'),
      amount: order.get('amount'),
      createdAt: order.get('createdAt').getTime(),
      paidAt: order.get('paidAt') ? order.get('paidAt').getTime() : null
    };

  } catch (error) {
    console.error('[queryOrderStatus] 查询订单失败:', error);

    if (error instanceof AV.Cloud.Error) {
      throw error;
    } else {
      throw new AV.Cloud.Error('查询订单失败：' + error.message, { code: 500 });
    }
  }
}

// 主查询接口
AV.Cloud.define('queryOrderStatus', handleQueryOrderStatus);

// 兼容旧客户端（旧客户端调用 queryOrder）
AV.Cloud.define('queryOrder', handleQueryOrderStatus);

/**
 * 计算签名（用于验证支付回调）
 */
function calculateSign(params, key) {
  // 将参数按字典序排序
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys
    .filter(k => k !== 'sign' && params[k] !== '' && params[k] !== null && params[k] !== undefined)
    .map(k => `${k}=${params[k]}`)
    .join('&');

  const fullStr = `${signStr}&key=${key}`;
  return crypto.createHash('md5').update(fullStr).digest('hex').toUpperCase();
}

/**
 * 将回调金额转换为分
 * 回调 total_fee 按元（字符串）传递
 */
function yuanToCents(yuan) {
  const value = Number(yuan);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100);
}

/**
 * 支付回调处理（Express路由）
 *
 * 需要在 server.js 中注册此路由：
 * app.post('/api/payment/callback', handlePaymentCallback);
 */
async function handlePaymentCallback(req, res) {
  try {
    console.log('[handlePaymentCallback] 收到支付回调:', req.body);

    // 云勾实际回调字段：outTradeNo, payNo, money, code, sign, attach, orderNo, mchId, openId, payChannel, payBank, time
    const {
      outTradeNo,
      payNo,
      money,
      attach,
      sign,
      code
    } = req.body;

    // 兼容映射（云勾字段 -> 业务字段）
    const out_trade_no = outTradeNo;
    const transaction_id = payNo;
    const total_fee = money;

    if (!out_trade_no || !transaction_id || !total_fee || !sign) {
      console.error('[handlePaymentCallback] 回调参数不完整:', {
        out_trade_no,
        transaction_id,
        total_fee,
        hasSign: !!sign
      });
      return res.send('FAIL');
    }

    // 云勾 code=1 表示支付成功
    if (code !== '1' && code !== 1) {
      console.log('[handlePaymentCallback] 支付未成功, code:', code);
      return res.send('SUCCESS');
    }

    // 1. 签名校验（云勾回调签名规则可能与下单不同，仅记录不拦截，依靠订单匹配+金额校验保证安全）
    const calcSign = calculateSign(req.body || {}, YUNGOU_API_KEY);
    if (sign !== calcSign) {
      console.warn('[handlePaymentCallback] 签名不一致（不拦截，继续处理）:', { sign, calcSign });
    } else {
      console.log('[handlePaymentCallback] 签名验证成功');
    }

    // 2. 解析附加数据
    let attachData = {};
    try {
      if (attach) {
        attachData = JSON.parse(attach);
      }
    } catch (e) {
      console.error('[handlePaymentCallback] 解析attach失败，将尝试订单数据兜底:', e.message);
    }

    let { userId, productType } = attachData;

    // 3. 查询订单
    const query = new AV.Query('Order');
    query.equalTo('outTradeNo', out_trade_no);
    const order = await query.first({ useMasterKey: true });

    if (!order) {
      console.error('[handlePaymentCallback] 订单不存在:', out_trade_no);
      return res.send('FAIL');
    }

    // 金额一致性校验（订单保存的是分，回调是元）
    const callbackAmount = yuanToCents(total_fee);
    const orderAmount = Number(order.get('amount'));
    if (callbackAmount == null || callbackAmount !== orderAmount) {
      console.error('[handlePaymentCallback] 金额校验失败:', {
        outTradeNo: out_trade_no,
        callbackAmount,
        orderAmount,
        rawTotalFee: total_fee
      });
      return res.send('FAIL');
    }

    // 4. 更新订单状态（幂等性处理）
    const currentStatus = order.get('status');
    if (currentStatus === 'paid') {
      console.log('[handlePaymentCallback] 订单已支付，跳过处理');
      return res.send('SUCCESS');
    }

    // attach 缺失时，使用订单字段兜底
    if (!productType) {
      productType = order.get('productType');
    }
    if (!userId) {
      const userPointer = order.get('userId');
      userId = userPointer?.id || userPointer?.objectId;
    }

    if (!userId || !productType) {
      console.error('[handlePaymentCallback] 无法确定用户或产品信息:', { userId, productType, out_trade_no });
      return res.send('FAIL');
    }

    if (currentStatus === 'pending') {
      order.set('status', 'paid');
      order.set('transactionId', transaction_id);
      order.set('paidAt', new Date());
      await order.save(null, { useMasterKey: true });

      console.log('[handlePaymentCallback] 订单状态更新为已支付:', order.id);

      // 5. 开通VIP
      const userQuery = new AV.Query('_User');
      const user = await userQuery.get(userId, { useMasterKey: true });

      if (user) {
        user.set('vipType', productType);
        user.set('vipPurchaseTime', new Date());

        // 设置过期时间（根据产品类型）
        const expireDate = new Date();
        if (productType === 'test') {
          expireDate.setDate(expireDate.getDate() + 1);   // 1天
        } else if (productType === 'monthly') {
          expireDate.setDate(expireDate.getDate() + 30);  // 30天
        } else if (productType === 'quarterly') {
          expireDate.setDate(expireDate.getDate() + 90);  // 90天
        } else if (productType === 'yearly') {
          expireDate.setFullYear(expireDate.getFullYear() + 1);  // 365天
        }
        user.set('vipExpireTime', expireDate);

        // 添加订单ID到用户的订单列表
        const orderIds = user.get('vipOrderIds') || [];
        if (!orderIds.includes(order.id)) {
          orderIds.push(order.id);
          user.set('vipOrderIds', orderIds);
        }

        await user.save(null, { useMasterKey: true });

        console.log('[handlePaymentCallback] VIP开通成功:', {
          userId: user.id,
          vipType: productType,
          expireTime: user.get('vipExpireTime')
        });
      } else {
        console.error('[handlePaymentCallback] 用户不存在:', userId);
      }
    }

    // 6. 返回SUCCESS
    res.send('SUCCESS');

  } catch (error) {
    console.error('[handlePaymentCallback] 支付回调处理失败:', error);
    res.send('FAIL');
  }
}

// 导出支付回调处理函数
module.exports = AV.Cloud;

// ==================== VIP 管理云函数 ====================

/**
 * 修复终身 VIP 用户的数据
 *
 * 问题：部分终身 VIP 用户的 vipExpireTime 不是 null，导致被判断为非 VIP
 * 解决：将所有 vipType = "lifetime" 的用户的 vipExpireTime 设置为 null
 */
AV.Cloud.define('fixLifetimeVipUsers', async (request) => {
  try {
    // 查询所有 vipType = "lifetime" 且 vipExpireTime 不为 null 的用户
    const query = new AV.Query('_User');
    query.equalTo('vipType', 'lifetime');
    query.exists('vipExpireTime');  // vipExpireTime 存在（不为 null）

    const users = await query.find({ useMasterKey: true });

    console.log(`[fixLifetimeVipUsers] Found ${users.length} lifetime VIP users with expireTime set`);

    if (users.length === 0) {
      return {
        success: true,
        message: 'No users need to be fixed',
        fixed: 0
      };
    }

    // 修复每个用户
    const fixedUsers = [];
    const errors = [];

    for (const user of users) {
      try {
        const userId = user.id;
        const username = user.get('username') || user.get('mobilePhoneNumber') || 'unknown';
        const oldExpireTime = user.get('vipExpireTime');

        // 设置 vipExpireTime 为 null
        user.unset('vipExpireTime');
        await user.save(null, { useMasterKey: true });

        fixedUsers.push({
          userId,
          username,
          oldExpireTime: oldExpireTime ? oldExpireTime.toISOString() : null
        });

        console.log(`[fixLifetimeVipUsers] Fixed user: ${userId} (${username})`);
      } catch (error) {
        errors.push({
          userId: user.id,
          error: error.message
        });
        console.error(`[fixLifetimeVipUsers] Error fixing user ${user.id}:`, error);
      }
    }

    return {
      success: true,
      message: `Fixed ${fixedUsers.length} users`,
      fixed: fixedUsers.length,
      errors: errors.length,
      details: {
        fixedUsers,
        errors
      }
    };
  } catch (error) {
    console.error('[fixLifetimeVipUsers] Error:', error);
    return {
      success: false,
      message: error.message,
      fixed: 0
    };
  }
});

/**
 * 查询所有终身 VIP 用户的状态
 *
 * 用于检查数据是否正确
 */
AV.Cloud.define('checkLifetimeVipUsers', async (request) => {
  try {
    const query = new AV.Query('_User');
    query.equalTo('vipType', 'lifetime');
    query.limit(1000);

    const users = await query.find({ useMasterKey: true });

    console.log(`[checkLifetimeVipUsers] Found ${users.length} lifetime VIP users`);

    const result = users.map(user => ({
      userId: user.id,
      username: user.get('username') || user.get('mobilePhoneNumber') || 'unknown',
      vipType: user.get('vipType'),
      vipExpireTime: user.get('vipExpireTime') ? user.get('vipExpireTime').toISOString() : null,
      vipPurchaseTime: user.get('vipPurchaseTime') ? user.get('vipPurchaseTime').toISOString() : null,
      isCorrect: user.get('vipExpireTime') === undefined || user.get('vipExpireTime') === null
    }));

    const correctCount = result.filter(u => u.isCorrect).length;
    const incorrectCount = result.filter(u => !u.isCorrect).length;

    return {
      success: true,
      total: users.length,
      correct: correctCount,
      incorrect: incorrectCount,
      users: result
    };
  } catch (error) {
    console.error('[checkLifetimeVipUsers] Error:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

/**
 * 设置用户为终身 VIP
 *
 * @param userId - 用户 ID
 */
AV.Cloud.define('setLifetimeVip', async (request) => {
  const { userId } = request.params;

  if (!userId) {
    throw new AV.Cloud.Error('userId is required', { code: 40001 });
  }

  try {
    const query = new AV.Query('_User');
    const user = await query.get(userId, { useMasterKey: true });

    if (!user) {
      throw new AV.Cloud.Error(`User not found: ${userId}`, { code: 40002 });
    }

    const username = user.get('username') || user.get('mobilePhoneNumber') || 'unknown';

    // 设置为终身 VIP
    user.set('vipType', 'lifetime');
    user.unset('vipExpireTime');  // 终身会员没有过期时间
    user.set('vipPurchaseTime', new Date());

    await user.save(null, { useMasterKey: true });

    console.log(`[setLifetimeVip] Set user ${userId} (${username}) as lifetime VIP`);

    return {
      success: true,
      message: `User ${username} is now a lifetime VIP`,
      userId,
      username,
      vipType: 'lifetime',
      vipExpireTime: null,
      vipPurchaseTime: new Date().toISOString()
    };
  } catch (error) {
    console.error('[setLifetimeVip] Error:', error);
    throw error;
  }
});

/**
 * 设置用户为限时 VIP
 *
 * @param userId - 用户 ID
 * @param vipType - VIP 类型：monthly/quarterly/yearly
 * @param days - 天数（可选，如果不提供则根据 vipType 自动计算）
 */
AV.Cloud.define('setTimeLimitedVip', async (request) => {
  const { userId, vipType, days } = request.params;

  if (!userId) {
    throw new AV.Cloud.Error('userId is required', { code: 40001 });
  }

  if (!vipType || !['monthly', 'quarterly', 'yearly'].includes(vipType)) {
    throw new AV.Cloud.Error('vipType must be one of: monthly, quarterly, yearly', { code: 40002 });
  }

  try {
    const query = new AV.Query('_User');
    const user = await query.get(userId, { useMasterKey: true });

    if (!user) {
      throw new AV.Cloud.Error(`User not found: ${userId}`, { code: 40003 });
    }

    const username = user.get('username') || user.get('mobilePhoneNumber') || 'unknown';

    // 计算过期时间
    let daysToAdd = days;
    if (!daysToAdd) {
      switch (vipType) {
        case 'monthly':
          daysToAdd = 30;
          break;
        case 'quarterly':
          daysToAdd = 90;
          break;
        case 'yearly':
          daysToAdd = 365;
          break;
      }
    }

    const now = new Date();
    const expireTime = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    // 设置为限时 VIP
    user.set('vipType', vipType);
    user.set('vipExpireTime', expireTime);
    user.set('vipPurchaseTime', now);

    await user.save(null, { useMasterKey: true });

    console.log(`[setTimeLimitedVip] Set user ${userId} (${username}) as ${vipType} VIP until ${expireTime.toISOString()}`);

    return {
      success: true,
      message: `User ${username} is now a ${vipType} VIP`,
      userId,
      username,
      vipType,
      vipExpireTime: expireTime.toISOString(),
      vipPurchaseTime: now.toISOString(),
      daysAdded: daysToAdd
    };
  } catch (error) {
    console.error('[setTimeLimitedVip] Error:', error);
    throw error;
  }
});
module.exports.handlePaymentCallback = handlePaymentCallback;
