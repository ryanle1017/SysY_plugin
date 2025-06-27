import * as path from "node:path";
import * as vscode from "vscode";
import type {
    LanguageClientOptions,
    ServerOptions,
} from "vscode-languageclient/node.js";
import { LanguageClient, TransportKind } from "vscode-languageclient/node.js";

let client: LanguageClient;

// This function is called when the extension is activated.
export function activate(context: vscode.ExtensionContext): void {
  client = startLanguageClient(context);

  // 注册命令处理程序，用于处理数组大小溢出问题
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sysy.fixArraySize",
      async (uri: string, arrayName: string, range: vscode.Range) => {
        try {
          // 获取文档
          const document = await vscode.workspace.openTextDocument(
            vscode.Uri.parse(uri)
          );
          const editor = await vscode.window.showTextDocument(document);

          // 获取当前行内容
          const line = document.lineAt(range.start.line).text;

          // 尝试找出数组的当前大小和需要的大小
          const sizeMatch = line.match(
            new RegExp(`${arrayName}\\s*\\[(\\d+)\\]`)
          );
          if (!sizeMatch || !sizeMatch[1]) return;

          const currentSize = parseInt(sizeMatch[1], 10);

          // 查找初始化列表中的元素数量
          const initListMatch = line.match(/=\s*{([^}]*)}/);
          if (!initListMatch || !initListMatch[1]) return;

          const initElements = initListMatch[1].split(",").length;
          const newSize = Math.max(currentSize, initElements);

          // 创建文本编辑，修改数组大小
          const newText = line.replace(
            new RegExp(`${arrayName}\\s*\\[${currentSize}\\]`),
            `${arrayName}[${newSize}]`
          );

          // 应用编辑
          await editor.edit((editBuilder) => {
            editBuilder.replace(
              new vscode.Range(
                range.start.line,
                0,
                range.start.line,
                line.length
              ),
              newText
            );
          });

          vscode.window.showInformationMessage(
            `已将数组 '${arrayName}' 的大小从 ${currentSize} 增大到 ${newSize}`
          );
        } catch (error) {
          console.error("修复数组大小错误:", error);
          vscode.window.showErrorMessage("修复数组大小时出错");
        }
      }
    )
  );

  // 添加用于直接修复当前行的命令
  context.subscriptions.push(
    vscode.commands.registerCommand("sysy.quickFixCurrentLine", async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const position = editor.selection.active;
        const line = document.lineAt(position.line).text;

        // 检查是否是数组大小溢出的问题
        if (
          line.includes("[") &&
          line.includes("]") &&
          line.includes("=") &&
          line.includes("{") &&
          line.includes("}")
        ) {
          // 尝试找出数组名和大小
          const arrayMatch = line.match(/(\w+)\s*\[(\d+)\]\s*=/);
          if (!arrayMatch || !arrayMatch[1] || !arrayMatch[2]) return;

          const arrayName = arrayMatch[1];
          const currentSize = parseInt(arrayMatch[2], 10);

          // 查找初始化列表中的元素数量
          const initListMatch = line.match(/=\s*{([^}]*)}/);
          if (!initListMatch || !initListMatch[1]) return;

          const initElements = initListMatch[1].split(",").length;

          if (initElements > currentSize) {
            const newSize = initElements;

            // 创建文本编辑，修改数组大小
            const newText = line.replace(
              new RegExp(`${arrayName}\\s*\\[${currentSize}\\]`),
              `${arrayName}[${newSize}]`
            );

            // 应用编辑
            await editor.edit((editBuilder) => {
              editBuilder.replace(
                new vscode.Range(position.line, 0, position.line, line.length),
                newText
              );
            });

            vscode.window.showInformationMessage(
              `已将数组 '${arrayName}' 的大小从 ${currentSize} 增大到 ${newSize}`
            );
          }
        }
      } catch (error) {
        console.error("快速修复当前行错误:", error);
        vscode.window.showErrorMessage("快速修复当前行时出错");
      }
    })
  );
}

// This function is called when the extension is deactivated.
export function deactivate(): Thenable<void> | undefined {
  if (client) {
    return client.stop();
  }
  return undefined;
}

function startLanguageClient(context: vscode.ExtensionContext): LanguageClient {
  const serverModule = context.asAbsolutePath(
    path.join("out", "language", "main.js")
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging.
  // By setting `process.env.DEBUG_BREAK` to a truthy value, the language server will wait until a debugger is attached.
  const debugOptions = {
    execArgv: [
      "--nolazy",
      `--inspect${process.env.DEBUG_BREAK ? "-brk" : ""}=${
        process.env.DEBUG_SOCKET || "6009"
      }`,
    ],
  };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "sysy" }],
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    "sysy-language-server",
    "SysY Language Server",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();
  return client;
}
