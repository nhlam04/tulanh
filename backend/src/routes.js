const express = require('express');
const { envelope } = require('./envelope');
const { rateLimit, authenticate, attachGroup, errorHandler } = require('./middleware/core');
const { logWrite } = require('./services/logs');
const { uploadImage } = require('./middleware/upload');

const services = require('./services');

// Route table. The path names follow the spec table, so the report and the server name the
// same path. The sixth field marks the paths the build adds beyond the spec, such as search,
// sync, admin reads, devices, export and reports. `false` means the path is not in the spec.
// write true marks the routes that change data, so the log rule covers them.
const routes = [
  ['post', '/user/', 'auth.register', false, false, true],
  ['post', '/user/login/', 'auth.login', false, false, true],
  ['post', '/user/logout/', 'auth.logout', true, true, true],
  ['post', '/user/refresh-token/', 'auth.refresh', true, false, true],
  ['post', '/user/send-verification-code/', 'auth.sendCode', false, false, true],
  ['post', '/user/verify-email/', 'auth.verifyCode', true, false, true],
  ['get', '/user/', 'user.getProfile', false, true, true],
  ['put', '/user/', 'user.updateProfile', true, true, true],
  ['post', '/user/change-password/', 'user.changePassword', true, true, true],
  ['delete', '/user/', 'user.deleteAccount', true, true, true],
  ['post', '/user/group/', 'group.createGroup', true, true, true],
  ['post', '/user/group/add/', 'group.addMember', true, true, true],
  ['delete', '/user/group/', 'group.removeMember', true, true, true],
  ['get', '/user/group/', 'group.members', false, true, true],
  ['post', '/admin/category/', 'catalog.createCategory', true, true, true],
  ['get', '/admin/category/', 'catalog.listCategories', false, true, true],
  ['put', '/admin/category/', 'catalog.editCategory', true, true, true],
  ['delete', '/admin/category/', 'catalog.deleteCategory', true, true, true],
  ['post', '/admin/unit/', 'catalog.createUnit', true, true, true],
  ['get', '/admin/unit/', 'catalog.listUnits', false, true, true],
  ['put', '/admin/unit/', 'catalog.editUnit', true, true, true],
  ['delete', '/admin/unit/', 'catalog.deleteUnit', true, true, true],
  ['get', '/admin/logs/', 'admin.readLogs', false, true, true],
  ['post', '/food/', 'food.createFood', true, true, true],
  ['put', '/food/', 'food.updateFood', true, true, true],
  ['delete', '/food/', 'food.deleteFood', true, true, true],
  ['get', '/food/', 'food.listFoods', false, true, true],
  ['get', '/food/unit/', 'catalog.listUnits', false, true, true],
  ['get', '/food/category/', 'catalog.listCategories', false, true, true],
  ['post', '/fridge/', 'fridge.createLot', true, true, true],
  ['put', '/fridge/', 'fridge.updateLot', true, true, true],
  ['delete', '/fridge/', 'fridge.deleteLot', true, true, true],
  ['get', '/fridge/', 'fridge.listLots', false, true, true],
  ['get', '/fridge/:foodName/', 'fridge.lotsByFood', false, true, true],
  ['post', '/shopping/', 'shopping.createList', true, true, true],
  ['put', '/shopping/', 'shopping.updateList', true, true, true],
  ['delete', '/shopping/', 'shopping.deleteList', true, true, true],
  ['post', '/shopping/task/', 'shopping.addTasks', true, true, true],
  ['get', '/shopping/task/', 'shopping.listTasks', false, true, true],
  ['put', '/shopping/task/', 'shopping.updateTask', true, true, true],
  ['delete', '/shopping/task/', 'shopping.deleteTask', true, true, true],
  ['post', '/meal/', 'mealPlan.addPlan', true, true, true],
  ['put', '/meal/', 'mealPlan.updatePlan', true, true, true],
  ['delete', '/meal/', 'mealPlan.deletePlan', true, true, true],
  ['get', '/meal/', 'mealPlan.listPlans', false, true, true],
  ['post', '/recipe/', 'recipe.createRecipe', true, true, true],
  ['put', '/recipe/', 'recipe.updateRecipe', true, true, true],
  ['delete', '/recipe/', 'recipe.deleteRecipe', true, true, true],
  ['get', '/recipe/', 'recipe.listRecipes', false, true, true],
  ['get', '/recipe/:foodId/', 'recipe.recipesByFood', false, true, true],
  ['get', '/food/search/', 'food.searchFood', false, true, false],
  ['post', '/sync/', 'sync.applyOps', true, true, false],
  ['get', '/shopping/', 'shopping.listLists', false, true, false],
  ['post', '/shopping/claim/', 'shopping.claimTask', true, true, false],
  ['post', '/shopping/bought/', 'shopping.markBought', true, true, false],
  ['post', '/consumption/', 'consumption.recordConsumption', true, true, false],
  ['get', '/reports/purchases/', 'report.purchasesByCategory', false, true, false],
  ['get', '/reports/consumption/', 'report.consumptionByReason', false, true, false],
  ['get', '/meal/suggested/', 'mealPlan.suggestMeals', false, true, false],
  ['post', '/meal/generate-list/', 'mealPlan.generateList', true, true, false],
  ['post', '/recipe/ingredients/', 'recipe.addIngredients', true, true, false],
  ['get', '/admin/users/', 'admin.listUsers', false, true, false],
  ['post', '/admin/users/role/', 'admin.setRole', true, true, false],
  ['post', '/admin/sessions/logout/', 'admin.forceLogout', true, true, false],
  ['post', '/user/devices/', 'user.registerDevice', true, true, false],
  ['get', '/user/devices/', 'user.listDevices', false, true, false],
  ['get', '/user/export/', 'user.exportData', false, true, false],
  ['post', '/uploads/', 'images.storeImage', true, true, false],
  ['post', '/user/group/leave/', 'group.leaveGroup', true, true, false],
];

function handle(deps, method, path, serviceName, write, needsAuth) {
  const call = serviceName.split('.');
  const service = services[call[0]][call[1]];
  return async function handler(req, res) {
    req.ctx = req.ctx || {};
    // Path params join the input, so a path such as /fridge/:foodName/ reaches the service.
    req.ctx.input = { ...req.body, ...(req.query || {}), ...(req.params || {}), ...(req.fileMeta || {}) };
    let result = null;
    try {
      result = await service(deps, req.ctx);
    } catch (error) {
      req.resSent = true;
      return deps.nextError(error, req, res);
    }
    req.resSent = true;
    res.status(result.code === '00008' ? 500 : 200).json(envelope(result.code, result.data || null));
    if (write && req.ctx.groupId) deps.emit(req.ctx.groupId, path, result.data || null);
    if (write || String(result.code).includes('quyền') || String(result.code).includes('admin')) {
      await logWrite(deps, { userId: req.ctx.userId, groupId: req.ctx.groupId, route: path, code: result.code, ip: req.ip });
    }
  };
}

function buildRouter(deps) {
  const router = express.Router();
  router.use(rateLimit);
  for (const [method, path, service, write, needsAuth] of routes) {
    const chain = [needsAuth ? authenticate : (req, res, next) => next()];
    if (needsAuth) chain.push(attachGroup(deps));
    // Multipart needs a parser before the service runs, so the upload route carries the file
    // handler in its own chain.
    if (method === 'post' && path === '/uploads/') chain.push(uploadImage);
    router[method](path, ...chain, handle(deps, method, path, service, write, needsAuth));
  }
  router.use(errorHandler(deps));
  return router;
}

module.exports = { buildRouter, handle, routes };
