import { GlobalRulesServer } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the config.json loading by creating a custom test config
const createTestConfig = (globalRulesSourceDir: string) => ({
  globalRulesSourceDir
});

describe('GlobalRulesServer', () => {
  let server: GlobalRulesServer;
  let tempDir: string;
  let testConfigPath: string;
  let originalConfigPath: string;

  beforeAll(async () => {
    // Create temp directory for all tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'global-rules-test-'));
    
    // Store original config path for restoration
    const moduleDir = path.dirname(path.dirname(__dirname));
    originalConfigPath = path.join(moduleDir, 'config.json');
    testConfigPath = path.join(moduleDir, 'config.test.json');
  });

  beforeEach(async () => {
    server = new GlobalRulesServer();
  });

  afterEach(async () => {
    // Clean up test config file
    try {
      await fs.unlink(testConfigPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  afterAll(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const mockConfig = async (config: any) => {
    // Create a temporary config file for testing
    await fs.writeFile(testConfigPath, JSON.stringify(config, null, 2));
    
    // Mock the loadConfig method to use our test config
    const originalLoadConfig = (server as any).loadConfig;
    (server as any).loadConfig = async () => {
      try {
        const configContent = await fs.readFile(testConfigPath, 'utf-8');
        const parsedConfig = JSON.parse(configContent);
        
        if (!parsedConfig.globalRulesSourceDir || parsedConfig.globalRulesSourceDir.trim() === '') {
          return {
            success: false,
            error: { type: 'CONFIG_PARSING_ERROR', message: 'globalRulesSourceDir is not set or empty in config.json' }
          };
        }

        // Check if the directory exists
        try {
          await fs.access(parsedConfig.globalRulesSourceDir);
        } catch {
          return {
            success: false,
            error: { type: 'CONFIG_PARSING_ERROR', message: `Global rules directory does not exist: ${parsedConfig.globalRulesSourceDir}` }
          };
        }

        return { success: true, config: parsedConfig };
      } catch (error) {
        return {
          success: false,
          error: { type: 'CONFIG_PARSING_ERROR', message: `Failed to parse config.json: ${error instanceof Error ? error.message : 'Unknown error'}` }
        };
      }
    };
  };

  describe('loadGlobalRules', () => {
    it('should return success when no global files exist', async () => {
      // Set up test directories
      const sourceDir = path.join(tempDir, 'source-rules');
      const targetDir = path.join(tempDir, 'target-project');
      
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.mkdir(targetDir, { recursive: true });
      
      // Mock config to point to our test source directory
      await mockConfig(createTestConfig(sourceDir));
      
      const result = await server.handleLoadGlobalRules({ path: targetDir });
      
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData).toHaveProperty('success', true);
    });

    it('should return error when global rules source directory does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'non-existent-source');
      const targetDir = path.join(tempDir, 'target-project');
      
      await fs.mkdir(targetDir, { recursive: true });
      
      // Mock config to point to non-existent directory
      await mockConfig(createTestConfig(nonExistentDir));
      
      const result = await server.handleLoadGlobalRules({ path: targetDir });
      const responseData = JSON.parse(result.content[0].text);
      
      expect(responseData).toHaveProperty('success', false);
      expect(responseData).toHaveProperty('errors');
      expect(responseData.errors[0]).toHaveProperty('type', 'CONFIG_PARSING_ERROR');
      expect(responseData.errors[0].message).toContain('Global rules directory does not exist');
    });

    it('should copy global files when they exist', async () => {
      // Set up test directories
      const sourceDir = path.join(tempDir, 'source-rules');
      const targetDir = path.join(tempDir, 'target-project');
      
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.mkdir(targetDir, { recursive: true });
      
      // Create some global rule files in source
      await fs.writeFile(path.join(sourceDir, 'g-test1.mdc'), '# Test Rule 1');
      await fs.writeFile(path.join(sourceDir, 'g-test2.mdc'), '# Test Rule 2');
      await fs.writeFile(path.join(sourceDir, 'normal-rule.mdc'), '# Normal Rule');
      
      // Mock config to point to our test source directory
      await mockConfig(createTestConfig(sourceDir));
      
      const result = await server.handleLoadGlobalRules({ path: targetDir });
      const responseData = JSON.parse(result.content[0].text);
      
      expect(responseData).toHaveProperty('success', true);
      
      // Check that global files were copied to target
      const targetRulesDir = path.join(targetDir, '.cursor', 'rules');
      const files = await fs.readdir(targetRulesDir);
      expect(files).toContain('g-test1.mdc');
      expect(files).toContain('g-test2.mdc');
      expect(files).not.toContain('normal-rule.mdc'); // Should not copy non-global files
      
      // Verify file contents
      const copiedContent1 = await fs.readFile(path.join(targetRulesDir, 'g-test1.mdc'), 'utf-8');
      const copiedContent2 = await fs.readFile(path.join(targetRulesDir, 'g-test2.mdc'), 'utf-8');
      expect(copiedContent1).toBe('# Test Rule 1');
      expect(copiedContent2).toBe('# Test Rule 2');
    });

    it('should handle empty globalRulesSourceDir in config', async () => {
      const targetDir = path.join(tempDir, 'target-project');
      await fs.mkdir(targetDir, { recursive: true });
      
      // Mock config with empty globalRulesSourceDir
      await mockConfig({ globalRulesSourceDir: '' });
      
      const result = await server.handleLoadGlobalRules({ path: targetDir });
      const responseData = JSON.parse(result.content[0].text);
      
      expect(responseData).toHaveProperty('success', false);
      expect(responseData).toHaveProperty('errors');
      expect(responseData.errors[0]).toHaveProperty('type', 'CONFIG_PARSING_ERROR');
      expect(responseData.errors[0].message).toContain('globalRulesSourceDir is not set or empty');
    });
  });

  describe('saveGlobalRules', () => {
    it('should return success when no global files exist', async () => {
      // Set up test directories
      const sourceDir = path.join(tempDir, 'target-source');
      const globalDir = path.join(tempDir, 'global-storage');
      
      await fs.mkdir(path.join(sourceDir, '.cursor', 'rules'), { recursive: true });
      await fs.mkdir(globalDir, { recursive: true });
      
      // Mock config to point to our test global directory
      await mockConfig(createTestConfig(globalDir));
      
      const result = await server.handleSaveGlobalRules({ path: sourceDir });
      
      expect(result).toHaveProperty('content');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData).toHaveProperty('success', true);
    });

    it('should save global files from project to global storage', async () => {
      // Set up test directories
      const projectDir = path.join(tempDir, 'project-with-rules');
      const projectRulesDir = path.join(projectDir, '.cursor', 'rules');
      const globalStorageDir = path.join(tempDir, 'global-storage');
      
      await fs.mkdir(projectRulesDir, { recursive: true });
      await fs.mkdir(globalStorageDir, { recursive: true });
      
      // Create some global rule files in project
      await fs.writeFile(path.join(projectRulesDir, 'g-project-rule1.mdc'), '# Project Global Rule 1');
      await fs.writeFile(path.join(projectRulesDir, 'g-project-rule2.mdc'), '# Project Global Rule 2');
      await fs.writeFile(path.join(projectRulesDir, 'local-rule.mdc'), '# Local Rule');
      
      // Mock config to point to our test global storage directory
      await mockConfig(createTestConfig(globalStorageDir));
      
      const result = await server.handleSaveGlobalRules({ path: projectDir });
      const responseData = JSON.parse(result.content[0].text);
      
      expect(responseData).toHaveProperty('success', true);
      
      // Check that global files were saved to global storage
      const files = await fs.readdir(globalStorageDir);
      expect(files).toContain('g-project-rule1.mdc');
      expect(files).toContain('g-project-rule2.mdc');
      expect(files).not.toContain('local-rule.mdc'); // Should not save non-global files
      
      // Verify file contents
      const savedContent1 = await fs.readFile(path.join(globalStorageDir, 'g-project-rule1.mdc'), 'utf-8');
      const savedContent2 = await fs.readFile(path.join(globalStorageDir, 'g-project-rule2.mdc'), 'utf-8');
      expect(savedContent1).toBe('# Project Global Rule 1');
      expect(savedContent2).toBe('# Project Global Rule 2');
    });

    it('should return error when project rules directory does not exist', async () => {
      const nonExistentProject = path.join(tempDir, 'non-existent-project');
      const globalStorageDir = path.join(tempDir, 'global-storage');
      
      await fs.mkdir(globalStorageDir, { recursive: true });
      
      // Mock config to point to our test global storage directory
      await mockConfig(createTestConfig(globalStorageDir));
      
      const result = await server.handleSaveGlobalRules({ path: nonExistentProject });
      const responseData = JSON.parse(result.content[0].text);
      
      expect(responseData).toHaveProperty('success', false);
      expect(responseData).toHaveProperty('errors');
      expect(responseData.errors[0]).toHaveProperty('type', 'OPERATION_ERROR');
      expect(responseData.errors[0].message).toContain('Source directory does not exist');
    });
  });

  describe('server initialization', () => {
    it('should create server instance without throwing', () => {
      expect(() => new GlobalRulesServer()).not.toThrow();
    });
  });
});

describe('Basic Tests', () => {
  it('should run basic test', () => {
    expect(true).toBe(true);
  });
}); 