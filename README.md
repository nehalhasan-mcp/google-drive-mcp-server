
# Google Drive MCP Server

A powerful Model Context Protocol (MCP) server that connects AI assistants such as Claude Desktop with Google Drive and Google Sheets.

Search files, read documents, explore spreadsheet data, and manage Google Sheets through natural language.

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
- Pagination support for file searches and listings.
- Input validation and error handling.
- Professional INFO, WARNING and ERROR logging.
- Centralized error response handling.
- Error logs saved to `mcp-errors.log`.

## Available MCP Tools

| Tool | Description |
|---|---|
| `search_drive_files` | Search Google Drive files |
| `list_drive_files` | List recent Drive files |
| `read_drive_file` | Read supported documents |
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

## Logging and Error Handling

The server includes a centralized error-handling system.

- INFO logs record important operations.
- WARNING logs record situations such as missing files or empty search results.
- ERROR logs record failed operations.
- Errors are written to `mcp-errors.log`.
- Input validation helps prevent invalid requests.
- Tool errors return structured error responses.

## Example Use Cases

Ask Claude Desktop:

- Find a file named MCP Excel Test.
- Search an Excel file for a student named Ali.
- Read spreadsheet data.
- Find specific information inside a document.
- Add a new row to Google Sheets.
- Update an existing spreadsheet row.
- Delete a spreadsheet row.

## Tested Example

The server was tested with Claude Desktop using spreadsheet data.

| Name | Course | Marks |
|---|---|---:|
| Ali | AI | 85 |
| Ahmed | Python | 90 |
| Sara | Web Development | 95 |

The server successfully searched spreadsheet files and returned matching rows.

Google Sheets row operations were also tested by adding, updating and deleting a test row.

## Installation

Clone the repository:

```bash
git clone https://github.com/nehalhasan-mcp/google-drive-mcp-server.git
```

Move into the project folder:

```bash
cd google-drive-mcp-server
```

Install dependencies:

```bash
npm install
```

Configure Google OAuth credentials and authorize access to Google Drive and Google Sheets.

Keep your credentials private.

## Claude Desktop Configuration

Add the server to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "google-drive-mcp": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Path\\To\\google-drive-mcp\\index.js"
      ]
    }
  }
}
```

Replace the example path with the actual location of your project.

Restart Claude Desktop after saving the configuration.

## Security

- Never upload `credentials.json` or `token.json` to GitHub.
- Keep OAuth credentials private.
- Never publish access tokens or API secrets.
- Keep private configuration files out of the repository.

## Author

**Nehal Hasan**

GitHub: https://github.com/nehalhasan-mcp

Repository: https://github.com/nehalhasan-mcp/google-drive-mcp-server

## Project Demo

![Google Drive MCP Server Demo](./Screenshot%202026-11-03%20174446.png)
