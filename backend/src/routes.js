const express = require('express');
const { envelope } = require('./envelope');
const { rateLimit, authenticate, attachGroup, errorHandler } = require('./middleware/core');
const { logWrite } = require('./services/logs');

const services = require('./services');


// write true marks the routes that change data, so the log rule covers them.
const routes = [
  ['post', '/auth/register', 'auth.register', false, false],
  ['post', '/auth/code', 'auth.sendCode', false, false],
  ['post', '/auth/verify', 'auth.verifyCode', true, false],
  ['post', '/auth/login', 'auth.login', false, false],
  ['post', '/auth/refresh', 'auth.refresh', true, false],
  ['post', '/auth/logout', 'auth.logout', true, true],
  ['get', '/user/profile', 'user.getProfile', false, true],
  ['put', '/user/profile', 'user.updateProfile', true, true],
  ['put', '/user/password', 'user.changePassword', true, true],
  ['delete', '/user', 'user.deleteAccount', true, true],
  ['get', '/user/export', 'user.exportData', false, true],
  ['post', '/user/devices', 'user.registerDevice', true, true],
  ['get', '/user/devices', 'user.listDevices', false, true],
  ['post', '/groups', 'group.createGroup', true, true],
  ['post', '/groups/members', 'group.addMember', true, true],
  ['delete', '/groups/members', 'group.removeMember', true, true],
  ['get', '/groups/members', 'group.members', false, true],
  ['post', '/groups/leave', 'group.leaveGroup', true, true],
  ['post', '/categories', 'catalog.createCategory', true, true],
  ['get', '/categories', 'catalog.listCategories', false, true],
  ['post', '/units', 'catalog.createUnit', true, true],
  ['get', '/units', 'catalog.listUnits', false, true],
  ['post', '/foods', 'food.createFood', true, true],
  ['get', '/foods', 'food.listFoods', false, true],
  ['get', '/foods/search', 'food.searchFood', false, true],
  ['put', '/foods', 'food.updateFood', true, true],
  ['delete', '/foods', 'food.deleteFood', true, true],
  ['post', '/fridge', 'fridge.createLot', true, true],
  ['get', '/fridge', 'fridge.listLots', false, true],
  ['get', '/fridge/byFood', 'fridge.lotsByFood', false, true],
  ['put', '/fridge', 'fridge.updateLot', true, true],
  ['delete', '/fridge', 'fridge.deleteLot', true, true],
  ['post', '/shopping/tasks', 'shopping.addTasks', true, true],
  ['post', '/shopping/claim', 'shopping.claimTask', true, true],
  ['post', '/shopping/bought', 'shopping.markBought', true, true],
  ['post', '/consumption', 'consumption.recordConsumption', true, true],
  ['get', '/reports/purchases', 'report.purchasesByCategory', false, true],
  ['get', '/reports/consumption', 'report.consumptionByReason', false, true],
  ['post', '/meal-plans', 'mealPlan.addPlan', true, true],
  ['get', '/meal-plans', 'mealPlan.listPlans', false, true],
  ['put', '/meal-plans', 'mealPlan.updatePlan', true, true],
  ['delete', '/meal-plans', 'mealPlan.deletePlan', true, true],
  ['get', '/meal-plans/suggested', 'mealPlan.suggestMeals', false, true],
  ['post', '/meal-plans/generate-list', 'mealPlan.generateList', true, true],
  ['post', '/recipes', 'recipe.createRecipe', true, true],
  ['get', '/recipes', 'recipe.listRecipes', false, true],
  ['put', '/recipes', 'recipe.updateRecipe', true, true],
  ['post', '/recipes/ingredients', 'recipe.addIngredients', true, true],
  ['post', '/sync', 'sync.applyOps', true, true],
  ['get', '/admin/users', 'admin.listUsers', false, true],
  ['post', '/admin/users/role', 'admin.setRole', true, true],
  ['post', '/admin/sessions/logout', 'admin.forceLogout', true, true],
  ['get', '/admin/logs', 'admin.readLogs', false, true],
];

function handle(deps, method, path, serviceName, write, needsAuth) {
  const call = serviceName.split('.');
  const service = services[call[0]][call[1]];
  return async function handler(req, res) {
    req.ctx = req.ctx || {};
    req.ctx.input = { ...req.body, ...(req.query || {}) };
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
    router[method](path, chain[0], chain[1] || ((req, res, next) => next()), handle(deps, method, path, service, write, needsAuth));
  }
  router.use(errorHandler(deps));
  return router;
}

module.exports = { buildRouter, handle, routes };
