const AV = require('leanengine');
const express = require('express');

// 初始化 LeanEngine
AV.init({
  appId: process.env.LEANCLOUD_APP_ID,
  appKey: process.env.LEANCLOUD_APP_KEY,
  masterKey: process.env.LEANCLOUD_APP_MASTER_KEY
});

// 如果不希望使用 masterKey 权限，可以将下面一行删除
AV.Cloud.useMasterKey();

const app = express();

// 加载云引擎中间件（重要！）
app.use(AV.express());

// 加载云函数定义
require('./cloud');

// 可以将一类的路由单独保存在一个文件中
app.use('/todos', require('./routes/todos'));

// 健康检查
app.get('/', function (req, res) {
  res.send('LeanCloud Cloud Engine is running!');
});

// 启动服务器
const PORT = parseInt(process.env.LEANCLOUD_APP_PORT || process.env.PORT || 3000);
app.listen(PORT, function () {
  console.log('Node app is running on port:', PORT);
  console.log('环境变量检查:');
  console.log('- WECHAT_APP_ID:', process.env.WECHAT_APP_ID ? '已配置' : '未配置');
  console.log('- WECHAT_APP_SECRET:', process.env.WECHAT_APP_SECRET ? '已配置' : '未配置');
});

module.exports = app;
