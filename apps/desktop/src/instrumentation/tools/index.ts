import type { Tool } from '../tool-registry';
// Canvas tools
import { canvasAddNodeTool } from './canvas-add-node';
import { canvasConnectTool } from './canvas-connect';
import { canvasQueryTool } from './canvas-query';
import { canvasRemoveNodeTool } from './canvas-remove-node';
// Expose tools (automation)
import { exposeCallTool, exposeGetTool, exposeListTool, exposeSetTool } from './expose';
import { logClearTool } from './log-clear';
// Logging tools
import { logInjectTool } from './log-inject';
import { logReadTool } from './log-read';

// State tools
import { stateGetTool } from './state-get';
import { stateSetTool } from './state-set';
import { uiClickTool } from './ui-click';
import { uiQueryTool } from './ui-query';
// UI tools
import { uiScreenshotTool } from './ui-screenshot';
import { uiTypeTool } from './ui-type';

/**
 * All available instrumentation tools.
 * Add new tools to this array to register them with the MCP server.
 */
export const allTools: Tool[] = [
  // Logging
  logInjectTool,
  logReadTool,
  logClearTool,

  // UI
  uiScreenshotTool,
  uiClickTool,
  uiTypeTool,
  uiQueryTool,

  // State
  stateGetTool,
  stateSetTool,

  // Canvas
  canvasAddNodeTool,
  canvasRemoveNodeTool,
  canvasConnectTool,
  canvasQueryTool,

  // Expose (automation)
  exposeListTool,
  exposeGetTool,
  exposeSetTool,
  exposeCallTool,
];

export {
  // Logging
  logInjectTool,
  logReadTool,
  logClearTool,
  // UI
  uiScreenshotTool,
  uiClickTool,
  uiTypeTool,
  uiQueryTool,
  // State
  stateGetTool,
  stateSetTool,
  // Canvas
  canvasAddNodeTool,
  canvasRemoveNodeTool,
  canvasConnectTool,
  canvasQueryTool,
  // Expose (automation)
  exposeListTool,
  exposeGetTool,
  exposeSetTool,
  exposeCallTool,
};
