import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

enum ErrorType {
  CONFIG_PARSING_ERROR = 'CONFIG_PARSING_ERROR',
  OPERATION_ERROR = 'OPERATION_ERROR'
}

type SuccessResponse = {
  success: true;
};

type FailedResponse = {
  success: false;
  errors: Array<{
    type: ErrorType;
    message: string;
  }>;
};

type GlobalRulesResponse = SuccessResponse | FailedResponse;

type LoadGlobalRulesRequest = {
  path: string;
};

type SaveGlobalRulesRequest = {
  path: string;
};

type Config = {
  globalRulesSourceDir?: string;
};

export class GlobalRulesServer {
  private server: Server;
  private config: Config = {};

  constructor() {
    this.server = new Server({
      name: 'global-rules-server',
      version: '1.0.0',
    });

    this.setupToolHandlers();
  }

  private async loadConfig(): Promise<{ success: true; config: Config } | { success: false; error: { type: ErrorType; message: string } }> {
    try {
      const configPath = path.resolve(__dirname, '../config.json');
      
      // Check if config file exists
      try {
        await fs.access(configPath);
      } catch {
        return {
          success: false,
          error: { type: ErrorType.CONFIG_PARSING_ERROR, message: `Configuration file ${configPath} not found` }
        };
      }

      // Read and parse config
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config: Config = JSON.parse(configContent);

      // Check if globalRulesSourceDir is set
      if (!config.globalRulesSourceDir || config.globalRulesSourceDir.trim() === '') {
        return {
          success: false,
          error: { type: ErrorType.CONFIG_PARSING_ERROR, message: 'globalRulesSourceDir is not set or empty in config.json' }
        };
      }

      // Check if the directory exists
      try {
        await fs.access(config.globalRulesSourceDir);
      } catch {
        return {
          success: false,
          error: { type: ErrorType.CONFIG_PARSING_ERROR, message: `Global rules directory does not exist: ${config.globalRulesSourceDir}` }
        };
      }

      return { success: true, config };
    } catch (error) {
      return {
        success: false,
        error: { type: ErrorType.CONFIG_PARSING_ERROR, message: `Failed to parse config.json: ${error instanceof Error ? error.message : 'Unknown error'}` }
      };
    }
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'loadGlobalRules',
            description: 'Load global rules (\"g-*.mdc\") to target project',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Absolute path to target project directory that contains .cursor/rules',
                },
              },
              required: ['path'],
              additionalProperties: false,
            },
          },
          {
            name: 'saveGlobalRules',
            description: 'Save global rules (\"g-*.mdc\") from target project to global storage',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Absolute path to source project directory that contains .cursor/rules',
                },
              },
              required: ['path'],
              additionalProperties: false,
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (name === 'loadGlobalRules') {
        return await this.handleLoadGlobalRules(args as LoadGlobalRulesRequest);
      } else if (name === 'saveGlobalRules') {
        return await this.handleSaveGlobalRules(args as SaveGlobalRulesRequest);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async copyGlobalRulesFiles(sourceDir: string, targetDir: string): Promise<GlobalRulesResponse> {
    const errors: Array<{ type: ErrorType; message: string }> = [];

    try {
      // Check if source directory exists
      try {
        await fs.access(sourceDir);
      } catch (error) {
        return {
          success: false,
          errors: [{ type: ErrorType.OPERATION_ERROR, message: `Source directory does not exist: ${sourceDir}` }],
        };
      }

      // Create target directory if it doesn't exist
      await fs.mkdir(targetDir, { recursive: true });

      // Read all files from source directory
      const files = await fs.readdir(sourceDir);
      const globalFiles = files.filter(file => file.startsWith('g-'));

      if (globalFiles.length === 0) {
        return {
          success: true,
        };
      }

      // Copy each global file
      for (const file of globalFiles) {
        try {
          const sourcePath = path.join(sourceDir, file);
          const targetPath = path.join(targetDir, file);
          
          // Check if source is a file (not directory)
          const stat = await fs.stat(sourcePath);
          if (stat.isFile()) {
            await fs.copyFile(sourcePath, targetPath);
          }
        } catch (error) {
          errors.push({
            type: ErrorType.OPERATION_ERROR,
            message: `Failed to copy ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          errors,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          type: ErrorType.OPERATION_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        }],
      };
    }
  }

  async handleLoadGlobalRules(request: LoadGlobalRulesRequest): Promise<{ content: Array<{ type: string; text: string }> }> {
    // Load configuration
    const configResult = await this.loadConfig();
    if (!configResult.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, errors: [configResult.error] }, null, 2),
          },
        ],
      };
    }

    const sourceRulesDir = configResult.config.globalRulesSourceDir!;
    const targetRulesDir = path.join(request.path, '.cursor', 'rules');
    
    const result = await this.copyGlobalRulesFiles(sourceRulesDir, targetRulesDir);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleSaveGlobalRules(request: SaveGlobalRulesRequest): Promise<{ content: Array<{ type: string; text: string }> }> {
    // Load configuration
    const configResult = await this.loadConfig();
    if (!configResult.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, errors: [configResult.error] }, null, 2),
          },
        ],
      };
    }

    const sourceRulesDir = path.join(request.path, '.cursor', 'rules');
    const targetRulesDir = configResult.config.globalRulesSourceDir!;
    
    const result = await this.copyGlobalRulesFiles(sourceRulesDir, targetRulesDir);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Global Rules MCP server running on stdio');
  }
}

async function main() {
  const server = new GlobalRulesServer();
  await server.run();
}

// Аналог require.main === module для ESM
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}