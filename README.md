\# Google Drive MCP Server



A Model Context Protocol (MCP) server that connects Google Drive with AI assistants such as Claude Desktop.



\## Features



\- \*\*Search Drive Files\*\* — Search files by name.

\- \*\*List Drive Files\*\* — List files with pagination and modification dates.

\- \*\*Read Drive Files\*\* — Read supported Google Docs, PDF, text and JSON files.

\- \*\*Google OAuth 2.0\*\* — Authenticate securely with Google Drive.

\- \*\*PDF Text Extraction\*\* — Extract readable text from PDF documents.



\## Tech Stack



\- Node.js

\- Model Context Protocol (MCP) SDK

\- Google Drive API

\- Google OAuth 2.0

\- JavaScript (ES Modules)

\- Zod

\- PDF.js



\## Available MCP Tools



| Tool | Description |

|---|---|

| `search\_drive\_files` | Search Google Drive files by name |

| `list\_drive\_files` | List recently modified Drive files |

| `read\_drive\_file` | Read supported Drive documents |



\## Project Structure



```text

google-drive-mcp/

├── index.js

├── package.json

├── package-lock.json

├── .gitignore

├── credentials.json  (private)

└── token.json        (private)

```



\## Installation



1\. Install Node.js.

2\. Clone this repository.

3\. Install dependencies:



```bash

npm install

```



4\. Configure Google Cloud OAuth credentials.

5\. Place your local `credentials.json` and `token.json` files in the project folder.

6\. Start the server:



```bash

npm start

```



\## Claude Desktop Configuration



Add the server to your Claude Desktop MCP configuration:



```json

{

&#x20; "mcpServers": {

&#x20;   "google-drive-mcp": {

&#x20;     "command": "C:\\\\Program Files\\\\nodejs\\\\node.exe",

&#x20;     "args": \[

&#x20;       "C:\\\\Users\\\\YOUR\_USERNAME\\\\Desktop\\\\google-drive-mcp\\\\index.js"

&#x20;     ]

&#x20;   }

&#x20; }

}

```



Replace `YOUR\_USERNAME` and the project path with your own local details.



\## Security



\- Never upload `credentials.json` or `token.json`.

\- Keep OAuth secrets private.

\- Use `.gitignore` to exclude sensitive files.

\- Do not share personal Drive documents publicly.



\## Project Status



Working prototype tested with Claude Desktop and Google Drive.



\## Author



Developed as an MCP integration portfolio project.

