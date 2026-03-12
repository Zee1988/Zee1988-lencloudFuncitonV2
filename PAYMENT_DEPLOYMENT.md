# 支付功能部署说明（支付宝支付）

## 环境变量配置

在 LeanCloud 控制台配置以下环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| YUNGOU_MCH_ID | 云勾支付商户号 | 1234567890 |
| YUNGOU_API_KEY | 云勾支付 API 密钥 | your_api_key_here |
| PAYMENT_NOTIFY_URL | 支付回调地址 | https://your-app.leanapp.cn/api/payment/callback |

## 部署步骤

1. 安装依赖：
```bash
cd /Users/defi/workspace/Zee1988-lencloudFuncitonV2
npm install axios
```

2. 部署到 LeanCloud：
```bash
lean deploy
```

3. 验证部署：
```bash
# 检查云函数是否可用
curl -X POST https://your-app.leanapp.cn/1.1/functions/createOrder \
  -H "X-LC-Id: YOUR_APP_ID" \
  -H "X-LC-Key: YOUR_APP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"productType":"yearly"}'
```

## 测试

### 测试创建订单（月度会员）
```bash
curl -X POST https://your-app.leanapp.cn/1.1/functions/createOrder \
  -H "X-LC-Id: YOUR_APP_ID" \
  -H "X-LC-Key: YOUR_APP_KEY" \
  -H "X-LC-Session: USER_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productType":"monthly"}'
```

### 测试创建订单（季度会员）
```bash
curl -X POST https://your-app.leanapp.cn/1.1/functions/createOrder \
  -H "X-LC-Id: YOUR_APP_ID" \
  -H "X-LC-Key: YOUR_APP_KEY" \
  -H "X-LC-Session: USER_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productType":"quarterly"}'
```

### 测试创建订单（年度会员）
```bash
curl -X POST https://your-app.leanapp.cn/1.1/functions/createOrder \
  -H "X-LC-Id: YOUR_APP_ID" \
  -H "X-LC-Key: YOUR_APP_KEY" \
  -H "X-LC-Session: USER_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productType":"yearly"}'
```

### 测试查询订单状态
```bash
curl -X POST https://your-app.leanapp.cn/1.1/functions/queryOrderStatus \
  -H "X-LC-Id: YOUR_APP_ID" \
  -H "X-LC-Key: YOUR_APP_KEY" \
  -H "X-LC-Session: USER_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ORDER_ID_HERE"}'
```

## 数据库表结构

### Order 表

| 字段名 | 类型 | 说明 |
|--------|------|------|
| orderId | String | 云勾支付订单ID |
| userId | Pointer(_User) | 用户指针 |
| productType | String | 产品类型（monthly/quarterly/yearly） |
| amount | Number | 金额（分） |
| status | String | 订单状态（pending/paid/cancelled/expired/refunded） |
| payMethod | String | 支付方式（alipay） |
| outTradeNo | String | 商户订单号 |
| transactionId | String | 支付宝交易号 |
| paidAt | Date | 支付时间 |

### _User 表新增字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| vipType | String | VIP类型（none/monthly/quarterly/yearly） |
| vipExpireTime | Date | VIP过期时间 |
| vipPurchaseTime | Date | VIP购买时间 |
| vipOrderIds | Array | 订单ID列表 |

## 价格配置

| 会员类型 | 价格 | 有效期 |
|---------|------|--------|
| 月度会员 | ¥12 (1200分) | 30天 |
| 季度会员 | ¥29 (2900分) | 90天 |
| 年度会员 | ¥99 (9900分) | 365天 |

## 支付宝 APP 支付流程

1. **前端调用 createOrder 云函数**：
   - 传入 `productType`（monthly/quarterly/yearly）
   - 返回 `orderInfo`（支付宝 APP 支付订单信息字符串）

2. **前端调起支付宝 APP**：
   - 使用 `orderInfo` 调起支付宝 APP
   - 用户在支付宝 APP 中完成支付

3. **支付宝回调云函数**：
   - 支付宝支付成功后，回调 `/api/payment/callback`
   - 云函数验证签名，更新订单状态，开通 VIP

4. **前端轮询订单状态**：
   - 调用 `queryOrderStatus` 云函数查询订单状态
   - 订单状态变为 `paid` 后，提示用户支付成功

## 关键代码变更

### cloud.js 变更

1. **API 地址更新**：
   - 从 `https://api.pay.yungouos.com/api/pay/wxpay/appPay`（微信支付）
   - 改为 `https://api.pay.yungouos.com/api/pay/alipay/appPay`（支付宝支付）

2. **支付方式标识**：
   - `payMethod` 从 `'wxpay'` 改为 `'alipay'`

3. **返回参数**：
   - 从微信支付参数（appId, partnerId, prepayId, package, nonceStr, timeStamp, sign）
   - 改为支付宝支付参数（orderInfo）

### server.js 变更

1. **注册支付回调路由**：
   ```javascript
   const { handlePaymentCallback } = require('./cloud');
   app.post('/api/payment/callback', handlePaymentCallback);
   ```

2. **环境变量检查**：
   - 添加 YUNGOU_MCH_ID、YUNGOU_API_KEY、PAYMENT_NOTIFY_URL 检查

## 注意事项

1. **环境变量安全**：
   - 确保 YUNGOU_API_KEY 不要泄露到代码仓库
   - 使用 LeanCloud 环境变量管理敏感信息

2. **支付回调幂等性**：
   - 已实现订单状态检查，避免重复处理
   - 支付回调可能会被多次调用，需要确保幂等性

3. **错误处理**：
   - 所有云函数都有完善的错误处理
   - 支付回调失败会返回 FAIL，云勾会重试

4. **日志记录**：
   - 所有关键操作都有日志记录
   - 便于排查问题和监控

5. **数据一致性**：
   - 订单状态和用户 VIP 状态需要保持一致
   - 使用事务或幂等性保证数据一致性

## 前端集成示例

### Kotlin Multiplatform (Android)

```kotlin
// 1. 创建订单
val response = authRepository.createOrder(productType = "yearly")
val orderInfo = response.orderInfo

// 2. 调起支付宝 APP
val payTask = PayTask(activity)
val result = payTask.payV2(orderInfo, true)

// 3. 处理支付结果
val payResult = PayResult(result)
if (payResult.resultStatus == "9000") {
    // 支付成功，轮询订单状态
    pollOrderStatus(response.orderId)
} else {
    // 支付失败或取消
    showError(payResult.memo)
}

// 4. 轮询订单状态
suspend fun pollOrderStatus(orderId: String) {
    repeat(30) { // 最多轮询30次
        delay(2000) // 每2秒查询一次
        val status = authRepository.queryOrderStatus(orderId)
        if (status.status == "paid") {
            // 支付成功，刷新用户信息
            refreshUserInfo()
            return
        }
    }
}
```

## 测试环境配置

在测试环境中，可以使用云勾支付的测试商户号和测试 API 密钥进行测试。

测试支付宝账号：
- 账号：alipay_test@example.com
- 密码：test123456

## 生产环境部署清单

- [ ] 配置生产环境的 YUNGOU_MCH_ID
- [ ] 配置生产环境的 YUNGOU_API_KEY
- [ ] 配置生产环境的 PAYMENT_NOTIFY_URL
- [ ] 测试创建订单功能
- [ ] 测试支付回调功能
- [ ] 测试订单状态查询功能
- [ ] 验证 VIP 开通逻辑
- [ ] 监控支付日志
