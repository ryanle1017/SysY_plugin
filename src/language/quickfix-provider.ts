import { AstNode, LangiumDocument } from "langium";
import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
  Diagnostic,
  Position,
  Range,
  TextEdit,
} from "vscode-languageserver";
import { URI } from "vscode-uri";
import { HelloWorldServices } from "./hello-world-module.js";
import {
  ErrorCategory,
  ErrorMessageProvider,
} from "./error-message-provider.js";

// 错误代码类型常量定义
export const ERROR_CODES = {
  UNDEFINED_VARIABLE: "undefined-variable",
  DUPLICATE_DECLARATION: "duplicate-declaration",
  ARRAY_SIZE_OVERFLOW: "array-size-overflow",
  UNDEFINED_FUNCTION: "undefined-function",
  DUPLICATE_FUNCTION: "duplicate-function",
  PARAMETER_MISMATCH: "parameter-mismatch",
  INVALID_BREAK_CONTINUE: "invalid-break-continue",
  MISSING_RETURN: "missing-return",
  EMPTY_RETURN: "empty-return",
  VOID_RETURN_VALUE: "void-return-value",
  VOID_ASSIGNMENT: "void-assignment",
  TYPE_MISMATCH: "type-mismatch",
  MISSING_SEMICOLON: "missing-semicolon",
  UNMATCHED_BRACKETS: "unmatched-brackets",
  UNUSED_VARIABLE: "unused-variable",
};

// QuickFix 类型，用于根据修复类型提供不同的操作选项
export enum QuickFixType {
  DECLARATION = "declaration", // 声明相关修复
  DEFINITION = "definition", // 定义相关修复
  RENAME = "rename", // 重命名相关修复
  REMOVE = "remove", // 移除相关修复
  CHANGE = "change", // 修改相关修复
  ADD = "add", // 添加相关修复
  REFACTOR = "refactor", // 重构相关修复
  FIX_SYNTAX = "fix-syntax", // 新增：语法修复
}

/**
 * 上下文敏感的 QuickFix 参数
 */
export interface ContextualQuickFixParams {
  errorCode: string; // 错误代码
  errorType: QuickFixType; // 修复类型
  errorCategory: ErrorCategory; // 错误类别
  variableName?: string; // 变量名（如果适用）
  functionName?: string; // 函数名（如果适用）
  arrayName?: string; // 数组名（如果适用）
  expectedType?: string; // 期望类型（如果适用）
  actualType?: string; // 实际类型（如果适用）
  expectedCount?: number; // 期望数量（如果适用）
  actualCount?: number; // 实际数量（如果适用）
  isFunctionContext?: boolean; // 是否在函数上下文中（如果适用）
  isLoopContext?: boolean; // 是否在循环上下文中（如果适用）
}

/**
 * 从诊断信息中提取上下文参数
 */
function extractContextParams(
  diagnostic: Diagnostic,
  document: LangiumDocument
): ContextualQuickFixParams | undefined {
  // 获取错误代码
  const errorCode = getErrorCode(diagnostic.message);
  if (!errorCode) {
    return undefined;
  }

  // 为各种错误类型提取不同的上下文参数
  const result: ContextualQuickFixParams = {
    errorCode,
    errorType: getQuickFixType(errorCode),
    errorCategory:
      new ErrorMessageProvider().getErrorCategory(diagnostic.message) ||
      ErrorCategory.OTHER,
  };

  // 根据错误类型提取特定参数
  if (
    diagnostic.message.includes("使用了未定义的变量") ||
    diagnostic.message.includes("未声明的变量")
  ) {
    // 提取变量名
    const matches = diagnostic.message.match(/'([^']+)'/);
    if (matches && matches[1]) {
      result.variableName = matches[1];
    }
  } else if (diagnostic.message.includes("无法重新声明块范围变量")) {
    // 提取变量名
    const matches = diagnostic.message.match(/'([^']+)'/);
    if (matches && matches[1]) {
      result.variableName = matches[1];
    }
  } else if (diagnostic.message.includes("调用了未定义的函数")) {
    // 提取函数名
    const matches = diagnostic.message.match(/'([^']+)'/);
    if (matches && matches[1]) {
      result.functionName = matches[1];
    }
  } else if (diagnostic.message.includes("参数个数不匹配")) {
    // 尝试提取期望参数数量和实际参数数量
    const matches = diagnostic.message.match(
      /期望 (\d+) 个参数，但得到了 (\d+) 个/
    );
    if (matches && matches[1] && matches[2]) {
      result.expectedCount = parseInt(matches[1], 10);
      result.actualCount = parseInt(matches[2], 10);
    }
  } else if (
    diagnostic.message.includes("数组") &&
    diagnostic.message.includes("初始化元素数量超过了数组大小")
  ) {
    // 提取数组名
    const matches = diagnostic.message.match(/数组 ([^ ]+) 的初始化元素数量/);
    if (matches && matches[1]) {
      result.arrayName = matches[1];
    }
  } else if (diagnostic.message.includes("未使用的变量")) {
    // 提取变量名
    const matches = diagnostic.message.match(/'([^']+)'/);
    if (matches && matches[1]) {
      result.variableName = matches[1];
    }
  } else if (
    diagnostic.message.includes("缺少分号") ||
    diagnostic.message.includes("应该有分号")
  ) {
    // 不需要额外的上下文参数，使用默认的参数即可
  } else if (
    diagnostic.message.includes("括号不匹配") ||
    diagnostic.message.includes("缺少左括号") ||
    diagnostic.message.includes("缺少右括号") ||
    diagnostic.message.includes("括号未闭合")
  ) {
    // 不需要额外的上下文参数，使用默认的参数即可
  }

  return result;
}

/**
 * 根据错误代码获取修复类型
 */
function getQuickFixType(errorCode: string): QuickFixType {
  switch (errorCode) {
    case ERROR_CODES.UNDEFINED_VARIABLE:
    case ERROR_CODES.UNDEFINED_FUNCTION:
      return QuickFixType.DECLARATION;

    case ERROR_CODES.DUPLICATE_DECLARATION:
    case ERROR_CODES.DUPLICATE_FUNCTION:
      return QuickFixType.RENAME;

    case ERROR_CODES.ARRAY_SIZE_OVERFLOW:
      return QuickFixType.CHANGE;

    case ERROR_CODES.PARAMETER_MISMATCH:
      return QuickFixType.CHANGE;

    case ERROR_CODES.INVALID_BREAK_CONTINUE:
      return QuickFixType.REMOVE;

    case ERROR_CODES.MISSING_RETURN:
    case ERROR_CODES.EMPTY_RETURN:
      return QuickFixType.ADD;

    case ERROR_CODES.VOID_RETURN_VALUE:
      return QuickFixType.REMOVE;

    case ERROR_CODES.VOID_ASSIGNMENT:
      return QuickFixType.CHANGE;

    case ERROR_CODES.TYPE_MISMATCH:
      return QuickFixType.CHANGE;

    // 新增错误类型修复类型
    case ERROR_CODES.MISSING_SEMICOLON:
      return QuickFixType.FIX_SYNTAX;

    case ERROR_CODES.UNMATCHED_BRACKETS:
      return QuickFixType.FIX_SYNTAX;

    case ERROR_CODES.UNUSED_VARIABLE:
      return QuickFixType.REMOVE;

    default:
      return QuickFixType.CHANGE;
  }
}

// 将错误消息映射到错误代码
export function getErrorCode(message: string): string | undefined {
  if (!message) return undefined;

  if (
    message.includes("使用了未定义的变量") ||
    message.includes("未声明的变量")
  ) {
    return ERROR_CODES.UNDEFINED_VARIABLE;
  }
  if (message.includes("无法重新声明块范围变量")) {
    return ERROR_CODES.DUPLICATE_DECLARATION;
  }
  if (
    message.includes("数组") &&
    message.includes("初始化元素数量超过了数组大小")
  ) {
    return ERROR_CODES.ARRAY_SIZE_OVERFLOW;
  }
  if (message.includes("调用了未定义的函数")) {
    return ERROR_CODES.UNDEFINED_FUNCTION;
  }
  if (message.includes("函数名") && message.includes("已经定义过")) {
    return ERROR_CODES.DUPLICATE_FUNCTION;
  }
  if (message.includes("参数个数不匹配")) {
    return ERROR_CODES.PARAMETER_MISMATCH;
  }
  if (message.includes("非循环块中使用了")) {
    return ERROR_CODES.INVALID_BREAK_CONTINUE;
  }
  if (message.includes("有返回值的函数缺少")) {
    return ERROR_CODES.MISSING_RETURN;
  }
  if (message.includes("有返回值的函数不应返回为空")) {
    return ERROR_CODES.EMPTY_RETURN;
  }
  if (message.includes("void 函数不应存在非空返回值")) {
    return ERROR_CODES.VOID_RETURN_VALUE;
  }
  if (message.includes("不能将void类型变量参与运算或用于赋值")) {
    return ERROR_CODES.VOID_ASSIGNMENT;
  }
  if (message.includes("类型不匹配") || message.includes("无法将类型")) {
    return ERROR_CODES.TYPE_MISMATCH;
  }
  // 新增错误类型识别逻辑
  if (message.includes("缺少分号") || message.includes("应该有分号")) {
    return ERROR_CODES.MISSING_SEMICOLON;
  }
  if (
    message.includes("括号不匹配") ||
    message.includes("缺少左括号") ||
    message.includes("缺少右括号") ||
    message.includes("括号未闭合")
  ) {
    return ERROR_CODES.UNMATCHED_BRACKETS;
  }
  if (
    message.includes("未使用的变量") ||
    message.includes("变量已声明但从未使用")
  ) {
    return ERROR_CODES.UNUSED_VARIABLE;
  }

  return undefined;
}

/**
 * SysY 语言的 QuickFix 提供者，用于实现各种代码修复和重构功能
 */
export class SysyQuickFixProvider {
  private readonly diagnosticMessageToFix: Map<string, QuickFixResolver> =
    new Map();
  private readonly codeToFix: Map<string, QuickFixResolver> = new Map();
  private readonly errorMessageProvider: ErrorMessageProvider;

  constructor(private readonly services: HelloWorldServices) {
    this.errorMessageProvider = new ErrorMessageProvider();
    // 注册各种 QuickFix 解析器
    this.registerQuickFixes();
  }

  /**
   * 获取代码操作（如修复建议、重构等）
   */
  async getCodeActions(params: CodeActionParams): Promise<CodeAction[]> {
    const codeActions: CodeAction[] = [];
    try {
      const document =
        await this.services.shared.workspace.LangiumDocuments.getOrCreateDocument(
          URI.parse(params.textDocument.uri)
        );

      // 遍历诊断，为每个诊断提供对应的修复
      for (const diagnostic of params.context.diagnostics) {
        await this.createCodeActionsForDiagnostic(
          diagnostic,
          document,
          codeActions
        );
      }

      // 检查是否有选中区域，添加可用的重构操作
      if (
        params.range.start.line === params.range.end.line &&
        params.range.start.character !== params.range.end.character
      ) {
        this.addRefactoringActions(params, document, codeActions);
      }

      // 如果没有找到任何代码操作，添加一个通用的行为
      if (codeActions.length === 0 && params.context.diagnostics.length > 0) {
        codeActions.push(
          this.createGenericFix(params.context.diagnostics[0], document)
        );
      }
    } catch (error) {
      console.error("获取代码操作失败:", error);
    }

    return codeActions;
  }

  /**
   * 注册各种 QuickFix 解析器
   */
  private registerQuickFixes(): void {
    // 基于错误代码的注册
    this.registerCodeFix(
      ERROR_CODES.UNDEFINED_VARIABLE,
      this.createUndeclaredVarFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.DUPLICATE_DECLARATION,
      this.createRenameDuplicateVarFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.ARRAY_SIZE_OVERFLOW,
      this.createArraySizeOverflowFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.UNDEFINED_FUNCTION,
      this.createUndeclaredFuncFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.DUPLICATE_FUNCTION,
      this.createRenameDuplicateFuncFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.PARAMETER_MISMATCH,
      this.createParameterMismatchFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.INVALID_BREAK_CONTINUE,
      this.createInvalidBreakContinueFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.MISSING_RETURN,
      this.createMissingReturnFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.EMPTY_RETURN,
      this.createEmptyReturnFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.VOID_RETURN_VALUE,
      this.createVoidReturnValueFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.VOID_ASSIGNMENT,
      this.createVoidAssignmentFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.TYPE_MISMATCH,
      this.createTypeMismatchFix.bind(this)
    );

    // 注册新的错误代码修复函数
    this.registerCodeFix(
      ERROR_CODES.MISSING_SEMICOLON,
      this.createMissingSemicolonFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.UNMATCHED_BRACKETS,
      this.createUnmatchedBracketsFix.bind(this)
    );
    this.registerCodeFix(
      ERROR_CODES.UNUSED_VARIABLE,
      this.createUnusedVariableFix.bind(this)
    );

    // 基于消息内容的注册（作为备选）
    this.registerMessageFix(
      "未定义的变量",
      this.createUndeclaredVarFix.bind(this)
    );
    this.registerMessageFix(
      "未声明的变量",
      this.createUndeclaredVarFix.bind(this)
    );
    this.registerMessageFix(
      "使用了未定义的变量",
      this.createUndeclaredVarFix.bind(this)
    );
    this.registerMessageFix(
      "无法重新声明块范围变量",
      this.createRenameDuplicateVarFix.bind(this)
    );
    this.registerMessageFix(
      "数组的初始化元素数量超过了数组大小",
      this.createArraySizeOverflowFix.bind(this)
    );
    this.registerMessageFix(
      "调用了未定义的函数",
      this.createUndeclaredFuncFix.bind(this)
    );
    this.registerMessageFix(
      "函数名已经定义过",
      this.createRenameDuplicateFuncFix.bind(this)
    );
    this.registerMessageFix(
      "参数个数不匹配",
      this.createParameterMismatchFix.bind(this)
    );
    this.registerMessageFix(
      "非循环块中使用了",
      this.createInvalidBreakContinueFix.bind(this)
    );
    this.registerMessageFix(
      "有返回值的函数缺少 return",
      this.createMissingReturnFix.bind(this)
    );
    this.registerMessageFix(
      "有返回值的函数不应返回为空",
      this.createEmptyReturnFix.bind(this)
    );
    this.registerMessageFix(
      "void 函数不应存在非空返回值",
      this.createVoidReturnValueFix.bind(this)
    );
    this.registerMessageFix(
      "不能将void类型变量参与运算或用于赋值",
      this.createVoidAssignmentFix.bind(this)
    );

    // 注册新的消息内容修复函数
    this.registerMessageFix(
      "缺少分号",
      this.createMissingSemicolonFix.bind(this)
    );
    this.registerMessageFix(
      "应该有分号",
      this.createMissingSemicolonFix.bind(this)
    );
    this.registerMessageFix(
      "括号不匹配",
      this.createUnmatchedBracketsFix.bind(this)
    );
    this.registerMessageFix(
      "缺少左括号",
      this.createUnmatchedBracketsFix.bind(this)
    );
    this.registerMessageFix(
      "缺少右括号",
      this.createUnmatchedBracketsFix.bind(this)
    );
    this.registerMessageFix(
      "括号未闭合",
      this.createUnmatchedBracketsFix.bind(this)
    );
    this.registerMessageFix(
      "未使用的变量",
      this.createUnusedVariableFix.bind(this)
    );
    this.registerMessageFix(
      "变量已声明但从未使用",
      this.createUnusedVariableFix.bind(this)
    );
  }

  /**
   * 注册一个基于错误代码的 QuickFix 解析器
   */
  registerCodeFix(errorCode: string, resolver: QuickFixResolver): void {
    this.codeToFix.set(errorCode, resolver);
  }

  /**
   * 注册一个基于消息内容的 QuickFix 解析器
   */
  registerMessageFix(
    diagnosticPattern: string,
    resolver: QuickFixResolver
  ): void {
    this.diagnosticMessageToFix.set(diagnosticPattern, resolver);
  }

  /**
   * 为诊断创建代码操作
   */
  private async createCodeActionsForDiagnostic(
    diagnostic: Diagnostic,
    document: LangiumDocument,
    codeActions: CodeAction[]
  ): Promise<void> {
    // 首先尝试通过错误代码查找解析器
    const code = this.getDiagnosticCode(diagnostic);
    if (code && this.codeToFix.has(code)) {
      const resolver = this.codeToFix.get(code)!;
      const action = await resolver(diagnostic, document);
      if (action) {
        codeActions.push(action);
        const additionalActions = await this.createAdditionalFixes(
          code,
          diagnostic,
          document
        );
        codeActions.push(
          ...(additionalActions.filter(
            (action) => action !== undefined
          ) as CodeAction[])
        );
        return;
      }
    }

    // 如果没有找到基于代码的解析器或解析失败，尝试通过消息内容匹配
    for (const [pattern, resolver] of this.diagnosticMessageToFix.entries()) {
      if (diagnostic.message.includes(pattern)) {
        const action = await resolver(diagnostic, document);
        if (action) {
          codeActions.push(action);

          // 对于某些错误类型，可能需要提供多种修复选项
          const additionalActions = await this.createAdditionalFixes(
            pattern,
            diagnostic,
            document
          );
          codeActions.push(
            ...(additionalActions.filter(
              (action) => action !== undefined
            ) as CodeAction[])
          );
        }
        break;
      }
    }
  }

  /**
   * 获取诊断代码
   */
  private getDiagnosticCode(diagnostic: Diagnostic): string | undefined {
    if (typeof diagnostic.code === "string") {
      return diagnostic.code;
    }
    if (typeof diagnostic.code === "object" && diagnostic.code !== null) {
      const code = diagnostic.code as { value?: string };
      return code.value;
    }
    return undefined;
  }

  /**
   * 创建通用修复选项
   */
  private createGenericFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction {
    return {
      title: "尝试修复此问题",
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      command: Command.create(
        "尝试修复",
        "sysy.genericFix",
        document.uri.toString(),
        diagnostic.range
      ),
    };
  }

  /**
   * 为特定类型的错误创建额外的修复选项
   */
  private async createAdditionalFixes(
    pattern: string,
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): Promise<(CodeAction | undefined)[]> {
    const additionalActions: (CodeAction | undefined)[] = [];

    // 先处理错误代码
    if (this.codeToFix.has(pattern)) {
      switch (pattern) {
        case ERROR_CODES.UNDEFINED_VARIABLE:
          additionalActions.push(
            this.createGlobalVarDeclarationFix(diagnostic, document)
          );
          break;
        case ERROR_CODES.PARAMETER_MISMATCH:
          if (diagnostic.message.includes("传递了")) {
            additionalActions.push(
              this.createAdjustParametersFix(diagnostic, document, true)
            );
          } else {
            additionalActions.push(
              this.createAdjustParametersFix(diagnostic, document, false)
            );
          }
          break;
        case ERROR_CODES.MISSING_RETURN:
          additionalActions.push(
            this.createAppendReturnFix(diagnostic, document)
          );
          break;
      }
      return additionalActions;
    }

    // 再处理消息模式
    switch (pattern) {
      case "使用了未定义的变量":
      case "未定义的变量":
      case "未声明的变量":
        additionalActions.push(
          this.createGlobalVarDeclarationFix(diagnostic, document)
        );
        break;

      case "参数个数不匹配":
        if (diagnostic.message.includes("传递了")) {
          additionalActions.push(
            this.createAdjustParametersFix(diagnostic, document, true)
          );
        } else {
          additionalActions.push(
            this.createAdjustParametersFix(diagnostic, document, false)
          );
        }
        break;

      case "有返回值的函数缺少 return":
        additionalActions.push(
          this.createAppendReturnFix(diagnostic, document)
        );
        break;
    }

    return additionalActions;
  }

  /**
   * 添加重构操作
   */
  private addRefactoringActions(
    params: CodeActionParams,
    document: LangiumDocument,
    codeActions: CodeAction[]
  ): void {
    // 添加"提取函数"重构操作
    codeActions.push({
      title: "提取为函数",
      kind: CodeActionKind.RefactorExtract,
      command: Command.create(
        "提取为函数",
        "sysy.extractFunction",
        document.uri.toString(),
        params.range
      ),
    });

    // 添加"提取变量"重构操作 - 新增
    codeActions.push({
      title: "提取为变量",
      kind: CodeActionKind.RefactorExtract,
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: params.range,
              newText: `temp_var = ${document.textDocument.getText(
                params.range
              )};`,
            },
          ],
        },
      },
    });
  }

  // 以下是针对不同错误类型的修复实现

  /**
   * 为未声明的变量创建自动修复
   */
  private createUndeclaredVarFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    // 从诊断消息中提取变量名
    const match = diagnostic.message.match(
      /未定义的变量\s*'([^']+)'|未声明的变量\s*'?([^'\s.]+)'?/
    );
    const varName = match?.[1] || match?.[2];
    if (!varName) return undefined;

    const indentation = " ".repeat(diagnostic.range.start.character);

    return {
      title: `声明变量 '${varName}'`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              // 在当前行之前添加变量声明
              range: {
                start: { line: diagnostic.range.start.line, character: 0 },
                end: { line: diagnostic.range.start.line, character: 0 },
              },
              newText: `int ${varName} = 0;\n${indentation}`,
            },
          ],
        },
      },
    };
  }

  /**
   * 为未声明的变量创建全局声明修复
   */
  private createGlobalVarDeclarationFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    const match = diagnostic.message.match(
      /未定义的变量\s*'([^']+)'|未声明的变量\s*'?([^'\s.]+)'?/
    );
    const varName = match?.[1] || match?.[2];
    if (!varName) return undefined;

    // 查找文件开头位置
    const fileStartPosition: Position = { line: 0, character: 0 };

    return {
      title: `在全局作用域声明变量 '${varName}'`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: {
                start: fileStartPosition,
                end: fileStartPosition,
              },
              newText: `int ${varName} = 0;\n\n`,
            },
          ],
        },
      },
    };
  }

  /**
   * 为重复声明的变量创建自动修复（重命名）
   */
  private createRenameDuplicateVarFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    const match = diagnostic.message.match(
      /无法重新声明块范围变量\s*'([^']+)'/
    );
    const varName = match?.[1];
    if (!varName) return undefined;

    const newVarName = `${varName}_new`;

    return {
      title: `重命名变量为 '${newVarName}'`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: diagnostic.range,
              newText: newVarName,
            },
          ],
        },
      },
    };
  }

  /**
   * 为数组元素数量超出大小的情况创建修复
   */
  private createArraySizeOverflowFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    const match = diagnostic.message.match(
      /数组\s*([^\s]+)\s*的初始化元素数量超过了数组大小/
    );
    const arrayName = match?.[1];
    if (!arrayName) return undefined;

    // 获取当前行内容
    const line = document.textDocument.getText({
      start: { line: diagnostic.range.start.line, character: 0 },
      end: { line: diagnostic.range.start.line + 1, character: 0 },
    });

    // 尝试找出数组的当前大小和需要的大小
    const sizeMatch = line.match(new RegExp(`${arrayName}\\s*\\[(\\d+)\\]`));
    if (!sizeMatch || !sizeMatch[1]) return undefined;

    const currentSize = parseInt(sizeMatch[1], 10);
    // 查找初始化列表中的元素数量
    const initListMatch = line.match(/=\s*{([^}]*)}/);
    if (!initListMatch || !initListMatch[1]) return undefined;

    const initElements = initListMatch[1].split(",").length;
    const newSize = Math.max(currentSize, initElements);

    // 创建文本编辑，修改数组大小
    const newText = line.replace(
      new RegExp(`${arrayName}\\s*\\[${currentSize}\\]`),
      `${arrayName}[${newSize}]`
    );

    return {
      title: `将数组 '${arrayName}' 的大小从 ${currentSize} 增大到 ${newSize}`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: {
                start: { line: diagnostic.range.start.line, character: 0 },
                end: { line: diagnostic.range.start.line + 1, character: 0 },
              },
              newText: newText,
            },
          ],
        },
      },
    };
  }

  /**
   * 为未声明的函数创建自动修复
   */
  private createUndeclaredFuncFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    const match = diagnostic.message.match(/调用了未定义的函数\s*'([^']+)'/);
    const funcName = match?.[1];
    if (!funcName) return undefined;

    // 尝试获取函数调用的上下文，确定参数数量
    const line = document.textDocument.getText({
      start: { line: diagnostic.range.start.line, character: 0 },
      end: { line: diagnostic.range.start.line + 1, character: 0 },
    });

    // 一个简单的尝试解析参数的正则表达式
    const callMatch = line.match(new RegExp(`${funcName}\\s*\\(([^)]*)\\)`));
    const params =
      callMatch?.[1]
        ?.split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0) || [];

    const paramDefs = params.map((_, i) => `int param${i + 1}`).join(", ");

    // 在文件末尾添加函数声明
    return {
      title: `声明函数 '${funcName}'`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: {
                start: { line: document.textDocument.lineCount, character: 0 },
                end: { line: document.textDocument.lineCount, character: 0 },
              },
              newText: `\n// 自动生成的函数声明\nint ${funcName}(${paramDefs}) {\n    // 实现函数体\n    return 0;\n}\n`,
            },
          ],
        },
      },
    };
  }

  /**
   * 为重复声明的函数创建自动修复（重命名）
   */
  private createRenameDuplicateFuncFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    const match = diagnostic.message.match(/函数名\s*'([^']+)'\s*已经定义过/);
    const funcName = match?.[1];
    if (!funcName) return undefined;

    const newFuncName = `${funcName}_new`;

    return {
      title: `重命名函数为 '${newFuncName}'`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: diagnostic.range,
              newText: newFuncName,
            },
          ],
        },
      },
    };
  }

  /**
   * 为参数个数不匹配创建自动修复
   */
  private createParameterMismatchFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    const match = diagnostic.message.match(
      /参数个数不匹配。预期\s*(\d+)\s*个参数，但实际调用时传递了\s*(\d+)\s*个参数/
    );
    if (!match) return undefined;

    const expectedCount = parseInt(match[1]);
    const actualCount = parseInt(match[2]);

    // 根据情况提供不同的修复方案
    if (actualCount > expectedCount) {
      // 参数过多，需要移除多余参数
      return {
        title: `移除多余的参数`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        command: Command.create(
          "修复参数数量",
          "sysy.adjustParameters",
          document.uri.toString(),
          diagnostic.range,
          expectedCount
        ),
      };
    } else {
      // 参数不足，需要添加缺少的参数
      const missingCount = expectedCount - actualCount;
      return {
        title: `添加${missingCount}个缺少的参数`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        command: Command.create(
          "修复参数数量",
          "sysy.adjustParameters",
          document.uri.toString(),
          diagnostic.range,
          expectedCount
        ),
      };
    }
  }

  /**
   * 为参数个数不匹配提供直接修改参数的修复方案
   */
  private createAdjustParametersFix(
    diagnostic: Diagnostic,
    document: LangiumDocument,
    removingParams: boolean
  ): CodeAction | undefined {
    const match = diagnostic.message.match(
      /参数个数不匹配。预期\s*(\d+)\s*个参数，但实际调用时传递了\s*(\d+)\s*个参数/
    );
    if (!match) return undefined;

    const expectedCount = parseInt(match[1]);
    const actualCount = parseInt(match[2]);

    // 获取当前行的内容
    const line = document.textDocument.getText({
      start: { line: diagnostic.range.start.line, character: 0 },
      end: { line: diagnostic.range.start.line + 1, character: 0 },
    });

    // 查找函数调用和参数
    const callMatch = line.match(/(\w+)\s*\((.*)\)/);
    if (!callMatch) return undefined;

    const funcName = callMatch[1];
    const params = callMatch[2].split(",").map((p) => p.trim());

    let newParams: string[];
    let title: string;

    if (removingParams && actualCount > expectedCount) {
      // 删除多余参数
      newParams = params.slice(0, expectedCount);
      title = `将函数 '${funcName}' 调用参数减少到 ${expectedCount} 个`;
    } else if (!removingParams && actualCount < expectedCount) {
      // 添加缺少参数
      newParams = [...params];
      for (let i = actualCount; i < expectedCount; i++) {
        newParams.push(`0 /* 参数${i + 1} */`);
      }
      title = `向函数 '${funcName}' 调用添加 ${
        expectedCount - actualCount
      } 个缺省参数`;
    } else {
      return undefined;
    }

    // 构建新的函数调用
    const newCall = `${funcName}(${newParams.join(", ")})`;

    // 找到函数调用的范围
    const startIndex = line.indexOf(callMatch[0]);
    if (startIndex === -1) return undefined;

    const callRange: Range = {
      start: { line: diagnostic.range.start.line, character: startIndex },
      end: {
        line: diagnostic.range.start.line,
        character: startIndex + callMatch[0].length,
      },
    };

    return {
      title,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: callRange,
              newText: newCall,
            },
          ],
        },
      },
    };
  }

  /**
   * 为非循环中的break/continue创建修复
   */
  private createInvalidBreakContinueFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    return {
      title: "删除无效的 break/continue 语句",
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: {
                start: { line: diagnostic.range.start.line, character: 0 },
                end: { line: diagnostic.range.start.line + 1, character: 0 },
              },
              newText: "// 已删除无效的 break/continue 语句\n",
            },
          ],
        },
      },
    };
  }

  /**
   * 为缺少return语句的函数添加修复
   */
  private createMissingReturnFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    const match = diagnostic.message.match(/有返回值:\s*(\w+)\s*的函数缺少/);
    const returnType = match?.[1] || "int";

    return {
      title: `添加 return 语句`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      command: Command.create(
        "添加 return 语句",
        "sysy.addReturnStatement",
        document.uri.toString(),
        diagnostic.range,
        returnType
      ),
    };
  }

  /**
   * 在函数结尾添加return语句
   */
  private createAppendReturnFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    const match = diagnostic.message.match(/有返回值:\s*(\w+)\s*的函数缺少/);
    const returnType = match?.[1] || "int";

    // 查找函数的末尾大括号位置
    const text = document.textDocument.getText();
    const lines = text.split("\n");

    // 从诊断位置开始向后查找函数结尾
    let braceCount = 1;
    let endLine = diagnostic.range.start.line;
    let found = false;

    while (endLine < lines.length && braceCount > 0) {
      const line = lines[endLine];

      // 计算大括号平衡
      for (const char of line) {
        if (char === "{") braceCount++;
        else if (char === "}") braceCount--;

        if (braceCount === 0) {
          found = true;
          break;
        }
      }

      if (found) break;
      endLine++;
    }

    if (!found) return undefined;

    // 根据返回类型生成默认值
    let defaultReturnValue = "0";
    if (returnType === "float" || returnType === "double") {
      defaultReturnValue = "0.0";
    }

    // 在函数结尾插入return语句
    const indentation = lines[endLine - 1].match(/^\s*/)?.[0] || "    ";

    return {
      title: `在函数结尾添加 return ${defaultReturnValue};`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: {
                start: { line: endLine, character: 0 },
                end: { line: endLine, character: 0 },
              },
              newText: `${indentation}return ${defaultReturnValue};\n`,
            },
          ],
        },
      },
    };
  }

  /**
   * 为void函数中的非空return创建修复
   */
  private createVoidReturnValueFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    // 找到return语句
    const line = document.textDocument.getText({
      start: { line: diagnostic.range.start.line, character: 0 },
      end: { line: diagnostic.range.start.line + 1, character: 0 },
    });

    const returnMatch = line.match(/(\s*)return\s+([^;]+);/);
    if (!returnMatch) return undefined;

    const indent = returnMatch[1] || "";

    return {
      title: "移除 void 函数的返回值",
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: {
                start: { line: diagnostic.range.start.line, character: 0 },
                end: { line: diagnostic.range.start.line + 1, character: 0 },
              },
              newText: `${indent}return;\n`,
            },
          ],
        },
      },
    };
  }

  /**
   * 为void类型参与运算或赋值创建修复
   */
  private createVoidAssignmentFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    // 查找包含赋值的行
    const line = document.textDocument.getText({
      start: { line: diagnostic.range.start.line, character: 0 },
      end: { line: diagnostic.range.start.line + 1, character: 0 },
    });

    // 尝试找到赋值语句
    const assignmentMatch = line.match(/(\s*)([^=]+)(=\s*)([^;]+);/);
    if (!assignmentMatch) return undefined;

    const [_, indent, leftSide, assignOp, rightSide] = assignmentMatch;

    // 提供两种选项，一种是删除赋值，一种是改为单独的函数调用
    return {
      title: "移除 void 函数返回值的使用",
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: {
                start: { line: diagnostic.range.start.line, character: 0 },
                end: { line: diagnostic.range.start.line + 1, character: 0 },
              },
              newText: `${indent}${rightSide.trim()};\n`,
            },
          ],
        },
      },
    };
  }

  /**
   * 添加新的类型不匹配修复函数
   */
  private createTypeMismatchFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    // 创建一个类型转换的代码操作
    const title = "添加类型转换";
    const fix = CodeAction.create(
      title,
      {
        changes: {
          // 类型转换的修复逻辑可以在这里实现
          // 需要更复杂的上下文分析来确定适当的转换
        },
      },
      CodeActionKind.QuickFix
    );
    fix.diagnostics = [diagnostic];
    return fix;
  }

  /**
   * 创建缺失分号修复操作
   */
  private createMissingSemicolonFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    try {
      const range = diagnostic.range;
      const uri = document.uri;

      // 创建文本编辑，在当前行末尾添加分号
      const textEdit: TextEdit = {
        range: {
          start: { line: range.end.line, character: range.end.character },
          end: { line: range.end.line, character: range.end.character },
        },
        newText: ";",
      };

      // 创建代码操作
      const codeAction: CodeAction = {
        title: "添加缺失的分号",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [uri.toString()]: [textEdit],
          },
        },
      };

      return codeAction;
    } catch (error) {
      console.error("创建缺失分号修复失败:", error);
      return undefined;
    }
  }

  /**
   * 创建括号不匹配修复操作
   */
  private createUnmatchedBracketsFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    try {
      const range = diagnostic.range;
      const uri = document.uri;

      // 获取诊断位置的文本内容
      const text = document.textDocument.getText({
        start: { line: range.start.line, character: 0 },
        end: { line: range.end.line, character: range.end.character + 10 },
      });

      // 判断是缺少左括号还是右括号
      let textEdit: TextEdit;
      let title: string;

      if (
        diagnostic.message.includes("缺少左括号") ||
        diagnostic.message.includes("未找到匹配的左括号")
      ) {
        // 缺少左括号，在表达式开始处添加左括号
        textEdit = {
          range: {
            start: { line: range.start.line, character: range.start.character },
            end: { line: range.start.line, character: range.start.character },
          },
          newText: "(",
        };
        title = "添加缺失的左括号";
      } else {
        // 缺少右括号，在表达式结束处添加右括号
        textEdit = {
          range: {
            start: { line: range.end.line, character: range.end.character },
            end: { line: range.end.line, character: range.end.character },
          },
          newText: ")",
        };
        title = "添加缺失的右括号";
      }

      // 创建代码操作
      const codeAction: CodeAction = {
        title,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [uri.toString()]: [textEdit],
          },
        },
      };

      return codeAction;
    } catch (error) {
      console.error("创建括号不匹配修复失败:", error);
      return undefined;
    }
  }

  /**
   * 创建未使用变量修复操作
   */
  private createUnusedVariableFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    try {
      const uri = document.uri;
      const params = extractContextParams(diagnostic, document);

      if (!params || !params.variableName) {
        return undefined;
      }

      // 获取包含变量声明的整行内容
      const lineContent = document.textDocument.getText({
        start: { line: diagnostic.range.start.line, character: 0 },
        end: { line: diagnostic.range.start.line, character: 1000 }, // 假设一行不会超过1000个字符
      });

      // 创建两种修复操作
      const removeDeclarationEdit: TextEdit = {
        range: {
          start: { line: diagnostic.range.start.line, character: 0 },
          end: { line: diagnostic.range.start.line + 1, character: 0 },
        },
        newText: "", // 删除整行
      };

      const commentOutEdit: TextEdit = {
        range: {
          start: { line: diagnostic.range.start.line, character: 0 },
          end: { line: diagnostic.range.start.line, character: 0 },
        },
        newText: "// ", // 添加注释符号
      };

      // 创建删除声明的代码操作
      const removeAction: CodeAction = {
        title: `删除未使用的变量 '${params.variableName}'`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [uri.toString()]: [removeDeclarationEdit],
          },
        },
      };

      // 创建注释掉声明的代码操作
      const commentAction: CodeAction = {
        title: `注释掉未使用的变量 '${params.variableName}'`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [uri.toString()]: [commentOutEdit],
          },
        },
      };

      // 返回删除操作（主要操作）
      return removeAction;
    } catch (error) {
      console.error("创建未使用变量修复失败:", error);
      return undefined;
    }
  }

  /**
   * 为空的return语句添加返回值
   */
  private createEmptyReturnFix(
    diagnostic: Diagnostic,
    document: LangiumDocument
  ): CodeAction | undefined {
    const match = diagnostic.message.match(
      /有返回值:\s*(\w+)\s*的函数不应返回为空/
    );
    const returnType = match?.[1] || "int";

    // 找到空return语句
    const line = document.textDocument.getText({
      start: { line: diagnostic.range.start.line, character: 0 },
      end: { line: diagnostic.range.start.line + 1, character: 0 },
    });

    const returnMatch = line.match(/(\s*)return\s*;/);
    if (!returnMatch) return undefined;

    const indent = returnMatch[1] || "";

    // 根据返回类型生成默认值
    let defaultReturnValue = "0";
    if (returnType === "float" || returnType === "double") {
      defaultReturnValue = "0.0";
    }

    return {
      title: `添加返回值 '${defaultReturnValue}'`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri.toString()]: [
            {
              range: {
                start: { line: diagnostic.range.start.line, character: 0 },
                end: { line: diagnostic.range.start.line + 1, character: 0 },
              },
              newText: `${indent}return ${defaultReturnValue};\n`,
            },
          ],
        },
      },
    };
  }
}

/**
 * QuickFix 解析器类型
 */
type QuickFixResolver = (
  diagnostic: Diagnostic,
  document: LangiumDocument
) => Promise<CodeAction | undefined> | CodeAction | undefined;
