import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { readFileSync } from "fs";
import { z } from "zod";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Load Google credentials
const credentials = JSON.parse(
  readFileSync(new URL("./credentials.json", import.meta.url), "utf8")
);

const token = JSON.parse(
  readFileSync(new URL("./token.json", import.meta.url), "utf8")
);

const config = credentials.installed || credentials.web;

const auth = new OAuth2Client(
  config.client_id,
  config.client_secret,
  config.redirect_uris[0]
);

auth.setCredentials(token);

// Connect to Google Drive
const drive = google.drive({
  version: "v3",
  auth
});

// Create MCP server
const server = new McpServer({
  name: "google-drive-mcp",
  version: "1.0.0"
});

// Tool 1: Search Google Drive files
server.registerTool(
  "search_drive_files",
  {
    description: "Search for files in Google Drive",
    inputSchema: {
      query: z.string()
    }
  },
  async ({ query }) => {
    const safeQuery = query.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    const result = await drive.files.list({
      q: `name contains '${safeQuery}' and trashed = false`,
      fields: "files(id,name,mimeType,modifiedTime)",
      pageSize: 20
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result.data.files, null, 2)
      }]
    };
  }
);
// Tool 2: List Google Drive files
server.registerTool(
  "list_drive_files",
  {
    description: "List files from Google Drive",
    inputSchema: {
      page_size: z.number().min(1).max(100).default(20)
    }
  },
  async ({ page_size }) => {
    const result = await drive.files.list({
      q: "trashed = false",
      fields: "files(id,name,mimeType,modifiedTime)",
      pageSize: page_size,
      orderBy: "modifiedTime desc"
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result.data.files, null, 2)
      }]
    };
  }
);
// Tool 3: Read Google Drive files
server.registerTool(
  "read_drive_file",
  {
    description: "Read Google Docs, PDF, text and JSON files from Google Drive",
    inputSchema: {
      file_id: z.string()
    }
  },
  async ({ file_id }) => {
    const metadata = await drive.files.get({
      fileId: file_id,
      fields: "id,name,mimeType"
    });

    const mimeType = metadata.data.mimeType;
console.error("DEBUG MIME TYPE:", mimeType);
    let content;

    // Google Docs
    if (mimeType === "application/vnd.google-apps.document") {
      const result = await drive.files.export({
        fileId: file_id,
        mimeType: "text/plain"
      });

      content = result.data;

    // PDF files
    } else if (mimeType === "application/pdf") {
      const result = await drive.files.get(
        {
          fileId: file_id,
          alt: "media"
        },
        {
          responseType: "arraybuffer"
        }
      );

      const buffer = Buffer.from(result.data);

      const pdfDocument = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer)
      }).promise;

      let extractedText = "";

      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        const page = await pdfDocument.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map(item => "str" in item ? item.str : "")
          .join(" ");

        extractedText += `\n\nPage ${pageNumber}\n${pageText}`;
      }

      content = extractedText;

    // Text and JSON files
    } else if (
      mimeType.startsWith("text/") ||
      mimeType === "application/json"
    ) {
      const result = await drive.files.get(
        {
          fileId: file_id,
          alt: "media"
        },
        {
          responseType: "arraybuffer"
        }
      );

      content = Buffer.from(result.data).toString("utf8");

    } else {
      throw new Error("This file type is not supported for text reading.");
    }

    return {
      content: [{
        type: "text",
        text: `File: ${metadata.data.name}\n\n${content}`
      }]
    };
  }
);

// Start MCP server
const transport = new StdioServerTransport();
await server.connect(transport);