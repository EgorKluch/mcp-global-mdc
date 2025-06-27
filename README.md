# MCP Global Rules Server

A Model Context Protocol (MCP) server implementation for managing global cursor rules files ("g-*.mdc") across different projects.

## Features

- **Load Global Rules**: Copy global rules from configured source to target project
- **Save Global Rules**: Copy global rules from target project to global storage  
- **Error Handling**: Detailed error messages for configuration and operation issues
- **JSON Configuration**: Simple JSON-based configuration system

## Prerequisites

- Node.js 18+ 
- npm or yarn package manager

## Installation

1. Clone or download this project
2. Install dependencies:

```bash
npm install
```

3. Configure the server by creating `config.json` file:

```bash
cp config.example.json config.json
```

Edit `config.json` and set the path to your global rules directory:

```json
{
  "globalRulesSourceDir": "/path/to/your/project/.cursor/rules"
}
```

## Adding MCP to Cursor

To add this MCP server to Cursor:

1. **Build the project first**:
   ```bash
   npm run build
   ```

2. **Open Cursor Settings**:
   - Go to Cursor → Settings (or press `Cmd+,` on Mac / `Ctrl+,` on Windows/Linux)
   - Navigate to "Extensions" or search for "MCP"

3. **Configure MCP**:
   - Find the MCP settings section
   - Add a new MCP server configuration:
     ```json
     {
       "name": "global-mdc",
       "command": "node",
       "args": ["path/to/global-mdc/dist/index.js"]
     }
     ```
   - Replace `path/to/global-mdc` with the absolute path to this project directory

4. **Restart Cursor** to apply the changes

## Important Notes

⚠️ **After making changes to `config.json`**:
1. **Rebuild the project**: Run `npm run build`
2. **Toggle MCP in Cursor settings**: Disable and then re-enable the MCP server in Cursor settings
3. **Restart Cursor** if the changes don't take effect

This is required because the configuration is read when the server starts, and Cursor needs to restart the MCP server to pick up the new configuration.

## MCP Tool Usage

The server provides two tools:

### `loadGlobalRules`

Load global rules ("g-*.mdc") to target project.

**Input Schema**:
- `path` (string): Absolute path to target project directory that contains .cursor/rules

**Output**: JSON object containing:
- `success` (boolean): Whether operation succeeded
- `errors` (array, optional): Array of error objects if operation failed

### `saveGlobalRules`

Save global rules ("g-*.mdc") from target project to global storage.

**Input Schema**:
- `path` (string): Absolute path to source project directory that contains .cursor/rules

**Output**: Same format as `loadGlobalRules`

## License

MIT 