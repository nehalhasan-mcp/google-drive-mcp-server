# Google Drive MCP Server

A Model Context Protocol (MCP) server that connects AI assistants like Claude Desktop to Google Drive and Google Sheets.

Search files, read documents, explore Excel spreadsheets, and manage Google Sheets using natural language.

## Features

- Search files in Google Drive.
- List recent Drive files.
- Read Google Docs, PDFs, TXT, JSON, DOCX and XLSX files.
- Search files by type and content.
- Search Excel and Google Sheets data.
- Find specific rows inside spreadsheets.
- Add new rows to Google Sheets.
- Update existing spreadsheet rows.
- Delete spreadsheet rows.

## Available MCP Tools

| Tool | Description |
|---|---|
| `list_drive_files` | List recent Drive files |
| `search_drive_files` | Search Drive files |
| `read_drive_file` | Read supported files |
| `search_drive_by_type` | Search files by type |
| `search_drive_content` | Search file contents |
| `search_excel_content` | Search spreadsheet data |
| `search_specific_file` | Search a specific spreadsheet |
| `add_google_sheet_row` | Add a spreadsheet row |
| `update_google_sheet_row` | Update a spreadsheet row |
| `delete_google_sheet_row` | Delete a spreadsheet row |

## Technology Stack

- Node.js
- Model Context Protocol SDK
- Google Drive API
- Google Sheets API
- Google OAuth 2.0
- SheetJS
- Mammoth
- PDF.js

## Example Use Cases

Ask Claude Desktop:

- Find a file named MCP Excel Test.
- Search an Excel file for a student named Ali.
- Read spreadsheet data.
- Calculate average marks.
- Add a new row to Google Sheets.
- Update or delete a spreadsheet row.

## Tested Example

The server was tested with Claude Desktop using an Excel spreadsheet.

| Name | Course | Marks |
|---|---|---:|
| Ali | AI | 85 |
| Ahmed | Python | 90 |
| Sara | Web Development | 95 |

The server successfully searched the Excel file and returned matching rows.

## Installation

Clone the repository:

```bash
git clone https://github.com/nehalhasan-mcp/google-drive-mcp-server.git
```

Install dependencies:

```bash
npm install
```

Configure Google OAuth credentials and authorize access to Google Drive and Google Sheets.

## Claude Desktop Configuration

Add the server to Claude Desktop's MCP configuration:

```json
{
  "mcpServers": {
    "google-drive-mcp": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\Admin\\Desktop\\google-drive-mcp\\index.js"
      ]
    }
  }
}
```

Update the paths according to your computer.

## Security

- Never upload `credentials.json` or `token.json` to GitHub.
- Keep OAuth credentials private.
- Keep `.env` and other secret files out of the repository.

## Author

**Nehal Hasan**

GitHub: https://github.com/nehalhasan-mcp

Repository: https://github.com/nehalhasan-mcp/google-drive-mcp-server

## Project Demo

![Google Drive MCP Server Demo](./Screenshot%202026-11-03%20174446.png)
