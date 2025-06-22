import { startLanguageServer } from "langium/lsp";
import { NodeFileSystem } from "langium/node";
import {
  CodeActionParams,
  createConnection,
  DiagnosticSeverity,
  ProposedFeatures,
  PublishDiagnosticsParams,
  TextDocumentPositionParams,
  TextEdit,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { createHelloWorldServices } from "./hello-world-module.js";
import { getErrorCode } from "./quickfix-provider.js";
import { ErrorCategory } from "./error-message-provider.js";

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all);

// Inject the shared services and language-specific services
const { shared, HelloWorld } = createHelloWorldServices({
  connection,
  ...NodeFileSystem,
});

// 错误代码前缀，用于更好地组织错误
const ERROR_CODE_PREFIX = "SYSY";

// 诊断严重性映射
const CATEGORY_TO_SEVERITY: Record<ErrorCategory, DiagnosticSeverity> = {
  [ErrorCategory.VARIABLE]: DiagnosticSeverity.Error,
  [ErrorCategory.FUNCTION]: DiagnosticSeverity.Error,
  [ErrorCategory.ARRAY]: DiagnosticSeverity.Error,
  [ErrorCategory.TYPE]: DiagnosticSeverity.Error,
  [ErrorCategory.CONTROL]: DiagnosticSeverity.Error,
  [ErrorCategory.OTHER]: DiagnosticSeverity.Warning,
};

// 注册自定义服务 (如悬浮提示提供者)
connection.onHover(async (params, token) => {
  try {
    const document =
      await shared.workspace.LangiumDocuments.getOrCreateDocument(
        URI.parse(params.textDocument.uri)
      );
    return HelloWorld.lsp.HoverProvider.getHoverContent(
      document,
      params,
      token
    );
  } catch (error) {
    console.error("处理悬浮信息时出错:", error);
    return null;
  }
});

// 注册QuickFix服务
connection.onCodeAction(async (params: CodeActionParams) => {
  try {
    // 获取文档对象
    const document =
      await shared.workspace.LangiumDocuments.getOrCreateDocument(
        URI.parse(params.textDocument.uri)
      );

    // 获取可用的代码操作
    return HelloWorld.lsp.QuickFixProvider.getCodeActions(params);
  } catch (error) {
    console.error("处理代码操作请求时出错:", error);
    return [];
  }
});

// 增强诊断信息
const originalSendDiagnostics = connection.sendDiagnostics;
connection.sendDiagnostics = (
  params: PublishDiagnosticsParams
): Promise<void> => {
  // 增强诊断消息的精确位置
  if (params.diagnostics && params.diagnostics.length > 0) {
    // 使用我们的错误消息提供者来增强诊断消息
    params.diagnostics.forEach((diagnostic) => {
      // 获取错误代码
      const errorCode = getErrorCode(diagnostic.message);

      // 确保诊断有一个代码，这样在UI中会更突出
      if (!diagnostic.code) {
        const category =
          HelloWorld.validation.ErrorMessageProvider.getErrorCategory(
            diagnostic.message
          );
        const prefix = category
          ? `${ERROR_CODE_PREFIX}-${category}`
          : ERROR_CODE_PREFIX;
        diagnostic.code = errorCode
          ? `${prefix}-${errorCode}`
          : `${prefix}-ERROR`;
      }

      // 确保诊断有源标识
      if (!diagnostic.source) {
        diagnostic.source = "SysY+";
      }

      // 确保严重性级别正确设置
      if (!diagnostic.severity) {
        const category =
          HelloWorld.validation.ErrorMessageProvider.getErrorCategory(
            diagnostic.message
          );
        diagnostic.severity = category
          ? CATEGORY_TO_SEVERITY[category]
          : DiagnosticSeverity.Error;
      }
    });
  }

  // 调用原始的发送诊断方法
  return originalSendDiagnostics(params);
};

// 注册命令处理
connection.onExecuteCommand(async (params) => {
  const { command, arguments: args = [] } = params;

  console.log(`执行命令: ${command}, 参数:`, args);

  try {
    switch (command) {
      case "sysy.fixArraySize":
        // 处理数组大小修复命令
        if (args && args.length >= 3) {
          const uri = args[0] as string;
          const document =
            await shared.workspace.LangiumDocuments.getOrCreateDocument(
              URI.parse(uri)
            );
          // 这里可以实现具体的数组大小修复逻辑
          console.log("处理数组大小修复命令", args);
        }
        break;

      case "sysy.adjustParameters":
        // 处理参数调整命令
        if (args && args.length >= 4) {
          const uri = args[0] as string;
          const document =
            await shared.workspace.LangiumDocuments.getOrCreateDocument(
              URI.parse(uri)
            );
          // 这里可以实现具体的参数调整逻辑
          console.log("处理参数调整命令", args);
        }
        break;

      case "sysy.addReturnStatement":
        // 处理添加返回语句命令
        if (args && args.length >= 3) {
          const uri = args[0] as string;
          const document =
            await shared.workspace.LangiumDocuments.getOrCreateDocument(
              URI.parse(uri)
            );
          // 这里可以实现具体的添加返回语句逻辑
          console.log("处理添加返回语句命令", args);
        }
        break;

      case "sysy.extractFunction":
        // 处理提取函数命令
        if (args && args.length >= 3) {
          const uri = args[0] as string;
          const document =
            await shared.workspace.LangiumDocuments.getOrCreateDocument(
              URI.parse(uri)
            );
          // 这里可以实现具体的提取函数逻辑
          console.log("处理提取函数命令", args);
        }
        break;

      case "sysy.genericFix":
        // 处理通用修复命令
        if (args && args.length >= 2) {
          const uri = args[0] as string;
          const document =
            await shared.workspace.LangiumDocuments.getOrCreateDocument(
              URI.parse(uri)
            );
          // 这里可以实现通用修复逻辑
          console.log("处理通用修复命令", args);
        }
        break;
    }
  } catch (error) {
    console.error(`执行命令 ${command} 时出错:`, error);
    return null;
  }

  return null;
});

// 设置错误处理
process.on("uncaughtException", (error: Error) => {
  console.error("未捕获的异常:", error);
});

// 启动语言服务器
startLanguageServer(shared);

// 连接连接到节点的进程通信
connection.listen();
