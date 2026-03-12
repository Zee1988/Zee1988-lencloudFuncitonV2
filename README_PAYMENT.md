# 支付宝支付功能说明

## 概述

本项目已完成从微信支付到支付宝 APP 支付的迁移，支持三种会员订阅模式：
- 月度会员：¥12/月
- 季度会员：¥29/季
- 年度会员：¥99/年

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
在 LeanCloud 控制台配置：
- `YUNGOU_MCH_ID` - 云勾支付商户号
- `YUNGOU_API_KEY` - 云勾支付 API 密钥
- `PAYMENT_NOTIFY_URL` - 支付回调地址

### 3. 部署
```bash
lean deploy
```

### 4. 验证
```bash
./verify-alipay-setup.sh
```

## 文档索引

| 文档 | 说明 |
|------|------|
| [PAYMENT_DEPLOYMENT.md](./PAYMENT_DEPLOYMENT.md) | 详细部署指南 |
| [ALIPAY_IMPLEMENTATION_SUMMARY.md](./ALIPAY_IMPLEMENTATION_SUMMARY.md) | 实施总结 |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | 部署检查清单 |
| [verify-alipay-setup.sh](./verify-alipay-setup.sh) | 验证脚本 |

## 云函数 API

### createOrder
创建支付订单

**请求参数**：
```json
{
  "productType": "monthly|quarterly|yearly"
}
```

**返回结果**：
```json
{
  "orderId": "订单ID",
  "outTradeNo": "商户订单号",
  "orderInfo": "支付宝APP支付订单信息字符串"
}
```

### queryOrderStatus
查询订单状态

**请求参数**：
```json
{
  "orderId": "订单ID"
}
```

**返回结果**：
```json
{
  "orderId": "订单ID",
  "status": "pending|paid|cancelled|expired|refunded",
  "productType": "monthly|quarterly|yearly",
  "amount": 金额（分）,
  "createdAt": 创建时间戳,
  "paidAt": 支付时间戳
}
```

## 支付回调

**路由**：`POST /api/payment/callback`

**处理逻辑**：
1. 验证签名
2. 解析附加数据
3. 查询订单
4. 更新订单状态（幂等性）
5. 开通 VIP
6. 返回 SUCCESS/FAIL

## 数据库表

### Order 表
- `orderId` - 云勾支付订单ID
- `userId` - 用户指针
- `productType` - 产品类型
- `amount` - 金额（分）
- `status` - 订单状态
- `payMethod` - 支付方式（alipay）
- `outTradeNo` - 商户订单号
- `transactionId` - 支付宝交易号
- `paidAt` - 支付时间

### _User 表新增字段
- `vipType` - VIP类型
- `vipExpireTime` - VIP过期时间
- `vipPurchaseTime` - VIP购买时间
- `vipOrderIds` - 订单ID列表

## 前端集成示例

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
}
```

## 技术栈

- **后端框架**：LeanCloud Cloud Engine (Node.js + Express)
- **支付平台**：云勾支付（支付宝 APP 支付）
- **HTTP 客户端**：axios
- **加密算法**：MD5（签名验证）

## 安全特性

- ✅ API 密钥存储在环境变量中
- ✅ 支付回调签名验证
- ✅ 订单状态更新幂等性
- ✅ 用户权限验证

## 监控和日志

所有关键操作都有详细日志：
- `[createOrder]` - 订单创建日志
- `[queryOrderStatus]` - 订单查询日志
- `[handlePaymentCallback]` - 支付回调日志

## 故障排查

### 问题：创建订单失败
- 检查环境变量是否配置正确
- 检查云勾支付 API 是否可访问
- 查看云引擎日志

### 问题：支付回调未触发
- 检查 PAYMENT_NOTIFY_URL 是否正确
- 检查云引擎是否正常运行
- 联系云勾支付技术支持

### 问题：VIP 未开通
- 检查支付回调日志
- 检查订单状态是否为 paid
- 检查用户表 vipType 字段

## 版本历史

### v1.0.0 (2026-03-12)
- ✅ 支持支付宝 APP 支付
- ✅ 支持三种会员订阅模式
- ✅ 完整的订单管理系统
- ✅ 自动 VIP 开通

## 许可证

MIT License

## 联系方式

如有问题，请联系开发团队。
