"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorktreeIpcHandlers = exports.WorktreeManagerFactory = exports.WorktreeManager = void 0;
var WorktreeManager_1 = require("./WorktreeManager");
Object.defineProperty(exports, "WorktreeManager", { enumerable: true, get: function () { return WorktreeManager_1.WorktreeManager; } });
var WorktreeManagerFactory_1 = require("./WorktreeManagerFactory");
Object.defineProperty(exports, "WorktreeManagerFactory", { enumerable: true, get: function () { return WorktreeManagerFactory_1.WorktreeManagerFactory; } });
var ipc_1 = require("./ipc");
Object.defineProperty(exports, "registerWorktreeIpcHandlers", { enumerable: true, get: function () { return ipc_1.registerWorktreeIpcHandlers; } });
