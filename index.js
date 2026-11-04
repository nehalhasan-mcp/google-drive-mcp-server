import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { readFileSync, appendFileSync } from "fs";
import { z } from "zod";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// Professional Logging System
function logMessage(level, message) {
  const allowedLevels = ["INFO", "WARNING", "ERROR"];

  if (!allowedLevels.includes(level)) {
    level = "INFO";
  }

  const timestamp = new Date().toISOString();

  const logEntry =
    `[${timestamp}] ${level} - ${message}\n`;

  try {
    appendFileSync(
      new URL("./mcp-errors.log", import.meta.url),
      logEntry,
      "utf8"
    );
  } catch (loggingError) {
    process.stderr.write(
      `Logging failed: ${loggingError.message}\n`
    );
  }
}

// Centralized Error Handler
function createErrorResponse(error, operation = "Operation failed") {
  const errorMessage =
    error instanceof Error
      ? error.message
      : String(error);

  logMessage("ERROR", `${operation}: ${errorMessage}`);

  return {
    content: [
      {
        type: "text",
        text: `${operation}: ${errorMessage}`
      }
    ],
    isError: true
  };
}

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

// Tool 1: Search Google Drive files with pagination and file type filtering
server.registerTool(
  "search_drive_files",
  {
    description: "Search Google Drive files by name and optional file type, with pagination support",
    inputSchema: {
      query: z.string(),
      file_type: z.enum([
        "pdf",
        "excel",
        "google_docs",
        "word"
      ]).optional(),
      page_size: z.number().min(1).max(100).default(20),
      page_token: z.string().optional()
    }
  },
  async ({ query, file_type, page_size, page_token }) => {
    try {
      const safeQuery = query.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

      const typeFilters = {
        pdf: "mimeType = 'application/pdf'",
        excel: "(mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'application/vnd.ms-excel')",
        google_docs: "mimeType = 'application/vnd.google-apps.document'",
        word: "(mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType = 'application/msword')"
      };

      const filters = [
        `name contains '${safeQuery}'`,
        "trashed = false"
      ];

      if (file_type) {
        filters.push(typeFilters[file_type]);
      }

      const result = await drive.files.list({
        q: filters.join(" and "),
        fields: "files(id,name,mimeType,modifiedTime),nextPageToken",
        pageSize: page_size,
        pageToken: page_token
      });

      // WARNING: Log when no files are found
      if (!result.data.files || result.data.files.length === 0) {
        logMessage("WARNING", `No Google Drive files found for query: ${query}`);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            files: result.data.files,
            nextPageToken: result.data.nextPageToken || null
          }, null, 2)
        }]
      };

    } catch (error) {
      return createErrorResponse(error, "Google Drive search failed");
    }
  }
);
// Tool 2: List Google Drive files
server.registerTool(
  "list_drive_files",
  {
    description: "List files from Google Drive with pagination support",
    inputSchema: {
      page_size: z.number().min(1).max(100).default(20),
      page_token: z.string().optional()
    }
  },
  async ({ page_size, page_token }) => {
    try {
      const result = await drive.files.list({
        q: "trashed = false",
        fields: "files(id,name,mimeType,modifiedTime),nextPageToken",
        pageSize: page_size,
        pageToken: page_token,
        orderBy: "modifiedTime desc"
      });

      // WARNING: Log when no files are found
      if (!result.data.files || result.data.files.length === 0) {
        logMessage("WARNING", "Google Drive file list returned no files");
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            files: result.data.files,
            nextPageToken: result.data.nextPageToken || null
          }, null, 2)
        }]
      };

    } catch (error) {
      return createErrorResponse(error, "Google Drive file listing failed");
    }
  }
);
// Tool 3: Read Google Drive files
server.registerTool(
  "read_drive_file",
  {
    description: "Read Google Docs, PDF, text, JSON, Word and Excel files from Google Drive",
    inputSchema: {
      file_id: z.string()
    }
  },
  async ({ file_id }) => {
    try {
      const metadata = await drive.files.get({
        fileId: file_id,
        fields: "id,name,mimeType"
      });

      const mimeType = metadata.data.mimeType;
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
          { fileId: file_id, alt: "media" },
          { responseType: "arraybuffer" }
        );

        const buffer = Buffer.from(result.data);

        const pdfDocument = await pdfjsLib.getDocument({
          data: new Uint8Array(buffer)
        }).promise;

        let extractedText = "";

        for (
          let pageNumber = 1;
          pageNumber <= pdfDocument.numPages;
          pageNumber++
        ) {
          const page = await pdfDocument.getPage(pageNumber);
          const textContent = await page.getTextContent();

          const pageText = textContent.items
            .map(item => "str" in item ? item.str : "")
            .join(" ");

          extractedText += `\n\nPage ${pageNumber}\n${pageText}`;
        }

        content = extractedText;

      // Word DOCX files
      } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const result = await drive.files.get(
          { fileId: file_id, alt: "media" },
          { responseType: "arraybuffer" }
        );

        const buffer = Buffer.from(result.data);

        const extracted = await mammoth.extractRawText({
          buffer: buffer
        });

        content = extracted.value;

      // Excel XLSX files
      } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ) {
        const result = await drive.files.get(
          { fileId: file_id, alt: "media" },
          { responseType: "arraybuffer" }
        );

        const buffer = Buffer.from(result.data);

        const workbook = XLSX.read(buffer, {
          type: "buffer"
        });

        let extractedText = "";

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const sheetData = XLSX.utils.sheet_to_csv(worksheet);

          extractedText += `\n\nSheet: ${sheetName}\n${sheetData}`;
        }

        content = extractedText;

      // Text and JSON files
      } else if (
        mimeType.startsWith("text/") ||
        mimeType === "application/json"
      ) {
        const result = await drive.files.get(
          { fileId: file_id, alt: "media" },
          { responseType: "arraybuffer" }
        );

        content = Buffer.from(result.data).toString("utf8");

      } else {
        throw new Error("This file type is not supported for text reading.");
      }

      // WARNING: Log when extracted content is empty
      if (content == null || String(content).trim() === "") {
        logMessage(
          "WARNING",
          `File contains no readable text: ${metadata.data.name}`
        );
      }

      return {
        content: [{
          type: "text",
          text: `File: ${metadata.data.name}\n\n${content}`
        }]
      };

    } catch (error) {
      return createErrorResponse(error, "File reading failed");
    }
  }
);

// Tool 4: Search Google Drive by file type and name
server.registerTool(
  "search_drive_by_type",
  {
    description: "Search Google Drive files by type and optionally by name",
    inputSchema: {
      file_type: z.enum(["pdf", "google_docs", "text", "word", "excel"]),
      file_name: z.string().optional()
    }
  },
  async ({ file_type, file_name }) => {
    try {
      const mimeTypes = {
        pdf: "application/pdf",
        google_docs: "application/vnd.google-apps.document",
        text: "text/plain",
        word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      };

      let query = `mimeType = '${mimeTypes[file_type]}' and trashed = false`;

      if (file_name && file_name.trim()) {
        const safeName = file_name.trim()
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'");

        query += ` and name contains '${safeName}'`;
      }

      const result = await drive.files.list({
        q: query,
        fields: "files(id,name,mimeType,modifiedTime)",
        pageSize: 20
      });

      const files = result.data.files || [];

      // WARNING: Log when no matching files are found
      if (files.length === 0) {
        logMessage(
          "WARNING",
          `No ${file_type} files found. Search name: ${file_name || "Not specified"}`
        );
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(files, null, 2)
        }]
      };

    } catch (error) {
      return createErrorResponse(error, "Google Drive file type search failed");
    }
  }
);
// Tool 5: Search Google Drive file contents
server.registerTool(
  "search_drive_content",
  {
    description: "Search Google Drive file contents for a keyword or name",
    inputSchema: {
      search_query: z.string()
    }
  },
  async ({ search_query }) => {
    try {
      const safeQuery = search_query.trim()
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");

      if (!safeQuery) {
        logMessage("WARNING", "Empty keyword provided for content search");

        return {
          content: [{
            type: "text",
            text: "Please enter a search keyword."
          }]
        };
      }

      const result = await drive.files.list({
        q: `fullText contains '${safeQuery}' and trashed = false`,
        fields: "files(id,name,mimeType,modifiedTime)",
        pageSize: 20
      });

      const files = result.data.files || [];

      // WARNING: Log when no matching content is found
      if (files.length === 0) {
        logMessage(
          "WARNING",
          `No Google Drive content found for keyword: ${search_query}`
        );
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(files, null, 2)
        }]
      };

    } catch (error) {
      return createErrorResponse(
        error,
        "Google Drive content search failed"
      );
    }
  }
);
// Tool 6: Search inside Excel files and Google Sheets
server.registerTool(
  "search_excel_content",
  {
    description: "Search for a name or keyword inside Excel files and Google Sheets, returning matching rows",
    inputSchema: {
      search_query: z.string()
    }
  },
  async ({ search_query }) => {
    try {
      const keyword = search_query.trim().toLowerCase();

      if (!keyword) {
        logMessage("WARNING", "Empty keyword provided for Excel content search");

        return {
          content: [{
            type: "text",
            text: "Please enter a search keyword."
          }]
        };
      }

      const result = await drive.files.list({
        q: "(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed = false",
        fields: "files(id,name,mimeType)",
        pageSize: 50
      });

      const files = result.data.files || [];
      const matches = [];
      let matchingRowsFound = false;

      for (const file of files) {
        try {
          let response;

          if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
            response = await drive.files.export(
              {
                fileId: file.id,
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              },
              {
                responseType: "arraybuffer"
              }
            );
          } else {
            response = await drive.files.get(
              {
                fileId: file.id,
                alt: "media"
              },
              {
                responseType: "arraybuffer"
              }
            );
          }

          const workbook = XLSX.read(
            Buffer.from(response.data),
            { type: "buffer" }
          );

          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];

            const rows = XLSX.utils.sheet_to_json(
              worksheet,
              {
                header: 1,
                defval: ""
              }
            );

            rows.forEach((row, index) => {
              const rowText = row.join(" ").toLowerCase();

              if (rowText.includes(keyword)) {
                matchingRowsFound = true;

                matches.push({
                  file_name: file.name,
                  file_id: file.id,
                  sheet: sheetName,
                  row_number: index + 1,
                  row_data: row
                });
              }
            });
          }

        } catch (error) {
          logMessage(
            "WARNING",
            `Could not search file ${file.name}: ${error.message}`
          );

          matches.push({
            file_name: file.name,
            error: error.message
          });
        }
      }

      // WARNING: Log when no matching rows are found
      if (!matchingRowsFound) {
        logMessage(
          "WARNING",
          `No matching spreadsheet rows found for keyword: ${search_query}`
        );
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(matches, null, 2)
        }]
      };

    } catch (error) {
      return createErrorResponse(
        error,
        "Excel content search failed"
      );
    }
  }
);
// Tool 7: Search inside a specific Google Sheet or Excel file
server.registerTool(
  "search_specific_file",
  {
    description: "Search for a keyword inside a specific Google Sheets or Excel file",
    inputSchema: {
      file_name: z.string(),
      search_query: z.string()
    }
  },
  async ({ file_name, search_query }) => {
    try {
      const safeName = file_name.trim()
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");

      const keyword = search_query.trim().toLowerCase();

      if (!safeName || !keyword) {
        logMessage(
          "WARNING",
          "Missing file name or search keyword in specific file search"
        );

        return {
          content: [{
            type: "text",
            text: "Please enter both a file name and a search keyword."
          }],
          isError: true
        };
      }

      logMessage(
        "INFO",
        `Searching for "${keyword}" inside file: ${safeName}`
      );

      const result = await drive.files.list({
        q: `name contains '${safeName}' and (mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed = false`,
        fields: "files(id,name,mimeType)",
        pageSize: 50
      });

      const files = result.data.files || [];
      const matches = [];

      if (files.length === 0) {
        logMessage(
          "WARNING",
          `No spreadsheet found with file name: ${safeName}`
        );
      }

      for (const file of files) {
        try {
          let response;

          if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
            response = await drive.files.export(
              {
                fileId: file.id,
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              },
              {
                responseType: "arraybuffer"
              }
            );
          } else {
            response = await drive.files.get(
              {
                fileId: file.id,
                alt: "media"
              },
              {
                responseType: "arraybuffer"
              }
            );
          }

          const workbook = XLSX.read(
            Buffer.from(response.data),
            { type: "buffer" }
          );

          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];

            const rows = XLSX.utils.sheet_to_json(
              worksheet,
              {
                header: 1,
                defval: ""
              }
            );

            rows.forEach((row, index) => {
              if (row.join(" ").toLowerCase().includes(keyword)) {
                matches.push({
                  file_name: file.name,
                  file_id: file.id,
                  sheet: sheetName,
                  row_number: index + 1,
                  row_data: row
                });
              }
            });
          }

        } catch (error) {
          logMessage(
            "WARNING",
            `Could not read spreadsheet ${file.name}: ${error.message}`
          );

          matches.push({
            file_name: file.name,
            error: error.message
          });
        }
      }

      if (matches.length === 0) {
        logMessage(
          "WARNING",
          `No matching content found for "${keyword}" in file: ${safeName}`
        );
      } else {
        logMessage(
          "INFO",
          `Specific file search completed. ${matches.length} result(s) found for "${keyword}"`
        );
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(matches, null, 2)
        }]
      };

    } catch (error) {
      return createErrorResponse(
        error,
        "Specific spreadsheet search failed"
      );
    }
  }
);
// Tool 8: Add a new row to Google Sheets
server.registerTool(
  "add_google_sheet_row",
  {
    description: "Add a new row to an existing Google Sheet",
    inputSchema: {
      spreadsheet_id: z.string(),
      sheet_name: z.string(),
      row_data: z.array(z.string())
    }
  },
  async ({ spreadsheet_id, sheet_name, row_data }) => {
    try {
      const spreadsheetId = spreadsheet_id.trim();
      const sheetName = sheet_name.trim();

      if (!spreadsheetId || !sheetName || row_data.length === 0) {
        logMessage(
          "WARNING",
          "Missing spreadsheet ID, sheet name, or row data"
        );

        return {
          content: [{
            type: "text",
            text: "Please provide a spreadsheet ID, sheet name, and row data."
          }],
          isError: true
        };
      }

      logMessage(
        "INFO",
        `Adding a new row to sheet: ${sheetName}`
      );

      const sheets = google.sheets({
        version: "v4",
        auth
      });

      const escapedSheetName = sheetName.replace(/'/g, "''");

      const result = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${escapedSheetName}'!A:Z`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [row_data]
        }
      });

      const updatedRange = result.data.updates?.updatedRange || "Unknown";

      logMessage(
        "INFO",
        `New row added successfully to ${sheetName}. Updated range: ${updatedRange}`
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: "New row added successfully!",
            updatedRange
          }, null, 2)
        }]
      };

    } catch (error) {
      return createErrorResponse(
        error,
        "Google Sheets row insertion failed"
      );
    }
  }
);
// Tool 9: Update an existing Google Sheets row
server.registerTool(
  "update_google_sheet_row",
  {
    description: "Update an existing row in a Google Sheet",
    inputSchema: {
      spreadsheet_id: z.string(),
      sheet_name: z.string(),
      row_number: z.number(),
      row_data: z.array(z.string())
    }
  },
  async ({ spreadsheet_id, sheet_name, row_number, row_data }) => {
    try {
      const spreadsheetId = spreadsheet_id.trim();
      const sheetName = sheet_name.trim();

      if (!spreadsheetId || !sheetName || row_data.length === 0) {
        logMessage(
          "WARNING",
          "Missing spreadsheet ID, sheet name, or row data for row update"
        );

        return {
          content: [{
            type: "text",
            text: "Please provide a spreadsheet ID, sheet name, and row data."
          }],
          isError: true
        };
      }

      if (!Number.isInteger(row_number) || row_number < 1) {
        throw new Error("Row number must be a positive integer.");
      }

      logMessage(
        "INFO",
        `Updating row ${row_number} in sheet: ${sheetName}`
      );

      const sheets = google.sheets({
        version: "v4",
        auth
      });

      const escapedSheetName = sheetName.replace(/'/g, "''");

      const result = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${escapedSheetName}'!A${row_number}:Z${row_number}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [row_data]
        }
      });

      const updatedRange = result.data.updatedRange || "Unknown";
      const updatedCells = result.data.updatedCells || 0;

      logMessage(
        "INFO",
        `Row ${row_number} updated successfully in ${sheetName}. Range: ${updatedRange}`
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: "Row updated successfully!",
            updatedRange,
            updatedCells
          }, null, 2)
        }]
      };

    } catch (error) {
      return createErrorResponse(
        error,
        "Google Sheets row update failed"
      );
    }
  }
);
// Tool 10: Delete a Google Sheets row
server.registerTool(
  "delete_google_sheet_row",
  {
    description: "Delete a specific row from a Google Sheet",
    inputSchema: {
      spreadsheet_id: z.string(),
      sheet_name: z.string(),
      row_number: z.number()
    }
  },
  async ({ spreadsheet_id, sheet_name, row_number }) => {
    try {
      const spreadsheetId = spreadsheet_id.trim();
      const sheetName = sheet_name.trim();

      if (!spreadsheetId || !sheetName) {
        logMessage(
          "WARNING",
          "Missing spreadsheet ID or sheet name for row deletion"
        );

        return {
          content: [{
            type: "text",
            text: "Please provide a spreadsheet ID and sheet name."
          }],
          isError: true
        };
      }

      if (!Number.isInteger(row_number) || row_number < 1) {
        throw new Error("Please provide a valid positive row number.");
      }

      logMessage(
        "INFO",
        `Preparing to delete row ${row_number} from sheet: ${sheetName}`
      );

      const sheets = google.sheets({
        version: "v4",
        auth
      });

      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId
      });

      const sheet = (spreadsheet.data.sheets || []).find(
        item => item.properties.title === sheetName
      );

      if (!sheet) {
        throw new Error(`Sheet not found: ${sheetName}`);
      }

      const rowCount = sheet.properties.gridProperties.rowCount;

      if (row_number > rowCount) {
        throw new Error("Row number is outside the sheet.");
      }

      const result = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: row_number - 1,
                endIndex: row_number
              }
            }
          }]
        }
      });

      logMessage(
        "INFO",
        `Row ${row_number} successfully deleted from sheet: ${sheetName}`
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Row ${row_number} deleted successfully!`,
            sheet_name: sheetName,
            row_number,
            spreadsheet_id: spreadsheetId
          }, null, 2)
        }]
      };

    } catch (error) {
      return createErrorResponse(
        error,
        "Google Sheets row deletion failed"
      );
    }
  }
);

// Start MCP server
const transport = new StdioServerTransport();
await server.connect(transport);
