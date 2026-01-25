import { BrowserWindow } from 'electron';
import { z } from 'zod';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  format: z.enum(['png', 'jpeg']).optional().default('png').describe('Image format'),
  quality: z.number().min(0).max(100).optional().default(80).describe('JPEG quality (0-100)'),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  image?: {
    data: string;
    mimeType: string;
    width: number;
    height: number;
  };
  error?: string;
}

export const uiScreenshotTool: Tool<Input, Output> = {
  name: 'ui_screenshot',
  description: 'Capture a screenshot of the current app window',
  inputSchema,
  handler: async (params) => {
    // Prefer focused window, fall back to first window if none focused
    const mainWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

    if (!mainWindow) {
      return { success: false, error: 'No active window found' };
    }

    try {
      const image = await mainWindow.webContents.capturePage();
      const size = image.getSize();

      let data: string;
      let mimeType: string;

      if (params.format === 'jpeg') {
        data = image.toJPEG(params.quality ?? 80).toString('base64');
        mimeType = 'image/jpeg';
      } else {
        data = image.toPNG().toString('base64');
        mimeType = 'image/png';
      }

      return {
        success: true,
        image: {
          data,
          mimeType,
          width: size.width,
          height: size.height,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot capture failed',
      };
    }
  },
};
