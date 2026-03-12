# 支付宝支付功能实施总结

## 实施日期
2026-03-12

## 变更概述
将 LeanCloud 云函数的支付功能从微信支付（WeChat Pay）迁移到支付宝支付（Alipay APP Pay），以支持前端应用的合规整改需求。

## 关键变更

### 1. cloud.js 文件变更

#### 1.1 API 端点更新
```javascript
// 旧代码（微信支付）
const YUNGOU_APP_PAY_URL = 'https://api.pay.yungouos.com/api/pay/wxpay/appPay';

// 新代码（支付宝支付）
const YUNGOU_ALIPAY_APP_PAY_URL = 'https://api.pay.yungouos.com/api/pay/alipay/appPay';
```

#### 1.2 支付方式标识更新
```javascript
// 旧代码
order.set('payMethod', 'wxpay');

// 新代码
order.set('payMethod', 'alipay');  // 支付宝支付
```

#### 1.3 返回参数更新
```javascript
// 旧代码（微信支付参数）
return {
  orderId: order.id,
  outTradeNo: outTradeNo,
  appId: payData.appid,
  partnerId: payData.partnerid,
  prepayId: payData.prepay_id,
  package: payData.package,
  nonceStr: payData.noncestr,
  timeStamp: payData.timestamp,
  sign: payData.sign
};

// 新代码（支付宝支付参数）
return {
  orderId: order.id,
  outTradeNo: outTradeNo,
  orderInfo: payData.order_info  // 支付宝APP支付订单信息字符串
};
```

#### 1.4 日志信息更新
```javascript
// 新增支付宝特定日志
console.log('[createOrder] 调用云勾支付宝API:', { ... });
console.log('[createOrder] 云勾支付宝API返回:', response.data);
```

### 2. server.js 文件变更

#### 2.1 注册支付回调路由
```javascript
// 新增代码
const { handlePaymentCallback } = require('./cloud');
app.post('/api/payment/callback', handlePaymentCallback);
```

#### 2.2 环境变量检查增强
```javascript
// 新增支付相关环境变量检查
console.log('- YUNGOU_MCH_ID:', process.env.YUNGOU_MCH_ID ? '已配置' : '未配置');
console.log('- YUNGOU_API_KEY:', process.env.YUNGOU_API_KEY ? '已配置' : '未配置');
console.log('- PAYMENT_NOTIFY_URL:', process.env.PAYMENT_NOTIFY_URL ? '已配置' : '未配置');
```

### 3. package.json 文件变更

#### 3.1 添加 axios 依赖
```json
"dependencies": {
  "axios": "^1.7.9",
  "leanengine": "^3.4.0",
  "leancloud-storage": "^4.13.2",
  "express": "^4.18.2"
}
```

## 未变更的功能

以下功能保持不变，无需修改：

1. **queryOrderStatus 云函数**：订单状态查询逻辑不变
2. **handlePaymentCallback 函数**：支付回调处理逻辑不变（签名验证、订单更新、VIP开通）
3. **价格配置**：月度/季度/年度会员价格不变
4. **数据库表结构**：Order 表和 _User 表结构不变

## 环境变量配置要求

需要在 LeanCloud 控制台配置以下环境变量：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| YUNGOU_MCH_ID | 云勾支付商户号 | 是 |
| YUNGOU_API_KEY | 云勾支付 API 密钥 | 是 |
| PAYMENT_NOTIFY_URL | 支付回调地址 | 是 |

示例值：
```
YUNGOU_MCH_ID=1234567890
YUNGOU_API_KEY=your_api_key_here
PAYMENT_NOTIFY_URL=https://your-app.leanapp.cn/api/payment/callback
```

## 部署步骤

1. **安装依赖**：
   ```bash
   cd /Users/defi/workspace/Zee1988-lencloudFuncitonV2
   npm install
   ```

2. **配置环境变量**（在 LeanCloud 控制台）：
   - 进入应用 → 云引擎 → 设置 → 环境变量
   - 添加 YUNGOU_MCH_ID、YUNGOU_API_KEY、PAYMENT_NOTIFY_URL
   - 保存并重启云引擎

3. **部署到 LeanCloud**：
   ```bash
   lean deploy
   ```

4. **验证部署**：
   - 检查云引擎日志，确认环境变量已配置
   - 测试 createOrder 云函数
   - 测试支付回调路由

## 测试建议

### 单元测试
1. 测试 createOrder 云函数（月度/季度/年度会员）
2. 测试 queryOrderStatus 云函数
3. 测试支付回调处理（模拟支付宝回调）

### 集成测试
1. 端到端测试：创建订单 → 支付 → 回调 → VIP开通
2. 异常场景测试：签名验证失败、订单不存在、重复回调

### 生产验证
1. 小额测试订单（月度会员 ¥12）
2. 验证支付回调日志
3. 验证 VIP 开通逻辑
4. 验证订单状态查询

## 风险评估

### 低风险
- ✅ 代码变更范围小，仅涉及支付方式切换
- ✅ 核心业务逻辑（订单管理、VIP开通）不变
- ✅ 支付回调处理逻辑不变

### 中风险
- ⚠️ 需要配置新的环境变量（YUNGOU_MCH_ID、YUNGOU_API_KEY）
- ⚠️ 需要验证支付宝 APP 支付流程

### 缓解措施
- 在测试环境充分测试后再部署到生产环境
- 保留原有微信支付代码作为备份（可回滚）
- 监控支付日志，及时发现问题

## 回滚方案

如果支付宝支付出现问题，可以快速回滚到微信支付：

1. 恢复 cloud.js 中的 API 端点：
   ```javascript
   const YUNGOU_APP_PAY_URL = 'https://api.pay.yungouos.com/api/pay/wxpay/appPay';
   ```

2. 恢复支付方式标识：
   ```javascript
   order.set('payMethod', 'wxpay');
   ```

3. 恢复返回参数（微信支付参数）

4. 重新部署到 LeanCloud

## 文档

- [PAYMENT_DEPLOYMENT.md](./PAYMENT_DEPLOYMENT.md) - 详细部署文档
- [ALIPAY_IMPLEMENTATION_SUMMARY.md](./ALIPAY_IMPLEMENTATION_SUMMARY.md) - 本文档

## 后续工作

1. **前端集成**：
   - 更新前端代码，使用 `orderInfo` 调起支付宝 APP
   - 实现订单状态轮询逻辑

2. **监控和日志**：
   - 配置支付日志监控
   - 设置支付失败告警

3. **性能优化**：
   - 考虑添加订单缓存
   - 优化订单状态查询性能

4. **安全加固**：
   - 定期轮换 YUNGOU_API_KEY
   - 添加支付回调 IP 白名单

## 联系人

- 开发者：Claude Code
- 实施日期：2026-03-12
- 项目路径：/Users/defi/workspace/Zee1988-lencloudFuncitonV2
