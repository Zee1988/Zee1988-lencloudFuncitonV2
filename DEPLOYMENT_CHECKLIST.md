# 支付宝支付功能部署检查清单

## 实施日期
2026-03-12

## 部署前检查

### 1. 代码变更验证 ✅
- [x] cloud.js 已更新为支付宝 API 端点
- [x] server.js 已注册支付回调路由
- [x] package.json 已添加 axios 依赖
- [x] axios 已成功安装 (v1.13.6)
- [x] 所有文件语法检查通过

### 2. 文档完整性 ✅
- [x] PAYMENT_DEPLOYMENT.md - 部署文档
- [x] ALIPAY_IMPLEMENTATION_SUMMARY.md - 实施总结
- [x] verify-alipay-setup.sh - 验证脚本
- [x] DEPLOYMENT_CHECKLIST.md - 本检查清单

### 3. 本地验证 ✅
运行验证脚本：
```bash
./verify-alipay-setup.sh
```
结果：✅ All verifications passed!

## 部署步骤

### Step 1: 配置环境变量
在 LeanCloud 控制台配置以下环境变量：

```
YUNGOU_MCH_ID=<你的云勾商户号>
YUNGOU_API_KEY=<你的云勾API密钥>
PAYMENT_NOTIFY_URL=https://<你的应用域名>.leanapp.cn/api/payment/callback
```

**配置路径**：
1. 登录 LeanCloud 控制台
2. 选择应用
3. 进入 云引擎 → 设置 → 环境变量
4. 添加上述三个变量
5. 保存并重启云引擎

- [ ] YUNGOU_MCH_ID 已配置
- [ ] YUNGOU_API_KEY 已配置
- [ ] PAYMENT_NOTIFY_URL 已配置
- [ ] 云引擎已重启

### Step 2: 部署到 LeanCloud

```bash
cd /Users/defi/workspace/Zee1988-lencloudFuncitonV2
lean deploy
```

- [ ] 部署命令执行成功
- [ ] 查看部署日志，确认无错误
- [ ] 云引擎状态显示为"运行中"

### Step 3: 验证部署

#### 3.1 检查环境变量
查看云引擎日志，确认启动时输出：
```
- YUNGOU_MCH_ID: 已配置
- YUNGOU_API_KEY: 已配置
- PAYMENT_NOTIFY_URL: 已配置
```

- [ ] 环境变量检查通过

#### 3.2 测试云函数

**测试 createOrder（年度会员）**：
```bash
curl -X POST https://<你的应用域名>.leanapp.cn/1.1/functions/createOrder \
  -H "X-LC-Id: <APP_ID>" \
  -H "X-LC-Key: <APP_KEY>" \
  -H "X-LC-Session: <USER_SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"productType":"yearly"}'
```

预期返回：
```json
{
  "result": {
    "orderId": "订单ID",
    "outTradeNo": "VIP_用户ID_时间戳",
    "orderInfo": "支付宝APP支付订单信息字符串"
  }
}
```

- [ ] createOrder 云函数测试通过
- [ ] 返回包含 orderInfo 字段

**测试 queryOrderStatus**：
```bash
curl -X POST https://<你的应用域名>.leanapp.cn/1.1/functions/queryOrderStatus \
  -H "X-LC-Id: <APP_ID>" \
  -H "X-LC-Key: <APP_KEY>" \
  -H "X-LC-Session: <USER_SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"<订单ID>"}'
```

预期返回：
```json
{
  "result": {
    "orderId": "订单ID",
    "status": "pending",
    "productType": "yearly",
    "amount": 9900,
    "createdAt": 时间戳,
    "paidAt": null
  }
}
```

- [ ] queryOrderStatus 云函数测试通过

#### 3.3 测试支付回调路由

```bash
curl -X POST https://<你的应用域名>.leanapp.cn/api/payment/callback \
  -H "Content-Type: application/json" \
  -d '{
    "out_trade_no": "测试订单号",
    "transaction_id": "测试交易号",
    "total_fee": "9900",
    "attach": "{\"userId\":\"测试用户ID\",\"productType\":\"yearly\"}",
    "sign": "测试签名"
  }'
```

预期返回：`FAIL`（因为签名不正确，这是正常的）

- [ ] 支付回调路由可访问
- [ ] 返回 FAIL（签名验证失败）

### Step 4: 端到端测试

使用 Android 应用进行完整支付流程测试：

1. **创建订单**：
   - [ ] 在应用中选择会员类型（月度/季度/年度）
   - [ ] 点击购买按钮
   - [ ] 应用成功调用 createOrder 云函数
   - [ ] 获取到 orderInfo

2. **调起支付宝**：
   - [ ] 使用 orderInfo 调起支付宝 APP
   - [ ] 支付宝 APP 正常打开
   - [ ] 显示正确的订单金额和商品名称

3. **完成支付**：
   - [ ] 在支付宝中完成支付（测试环境）
   - [ ] 支付成功后返回应用

4. **验证结果**：
   - [ ] 应用轮询订单状态
   - [ ] 订单状态变为 "paid"
   - [ ] 用户 VIP 状态正确更新
   - [ ] VIP 过期时间正确设置

### Step 5: 监控和日志

- [ ] 配置支付日志监控
- [ ] 设置支付失败告警
- [ ] 定期检查支付回调日志

## 回滚计划

如果部署后发现问题，执行以下回滚步骤：

1. **代码回滚**：
   ```bash
   git revert <commit_hash>
   lean deploy
   ```

2. **恢复微信支付**（如果需要）：
   - 恢复 cloud.js 中的微信支付 API 端点
   - 恢复 payMethod 为 'wxpay'
   - 恢复返回参数为微信支付参数
   - 重新部署

3. **通知用户**：
   - 如果支付功能暂时不可用，在应用中显示维护通知

## 生产环境注意事项

1. **安全性**：
   - ✅ YUNGOU_API_KEY 存储在环境变量中，不在代码中
   - ✅ 支付回调有签名验证
   - ✅ 订单状态更新有幂等性保护

2. **性能**：
   - 监控云函数响应时间
   - 如果订单量大，考虑添加缓存

3. **可靠性**：
   - 支付回调失败会自动重试（云勾平台）
   - 订单状态查询支持轮询

4. **合规性**：
   - 确保支付金额、商品描述符合支付宝规范
   - 保留支付日志用于对账

## 联系人

- 开发者：Claude Code
- 实施日期：2026-03-12
- 项目路径：/Users/defi/workspace/Zee1988-lencloudFuncitonV2

## 签名确认

- [ ] 开发者已完成本地验证
- [ ] 测试环境部署成功
- [ ] 端到端测试通过
- [ ] 生产环境部署成功
- [ ] 生产环境验证通过

---

**部署完成日期**：__________

**部署人员签名**：__________
