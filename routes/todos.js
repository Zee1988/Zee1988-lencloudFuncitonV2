const router = require('express').Router();
const AV = require('leanengine');

// 示例路由
router.get('/', async function (req, res, next) {
  try {
    const query = new AV.Query('Todo');
    const results = await query.find();
    res.json(results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
