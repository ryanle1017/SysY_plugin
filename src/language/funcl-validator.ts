import { ValidationAcceptor } from "langium";
import {
    ErrorCategory,
    ErrorMessageProvider,
} from "./error-message-provider.js";
import {
    CompUnit,
    FuncDef,
    FuncRParams,
    FunctionCall,
    Stmtreturn
} from "./generated/ast.js";
import { HelloWorldServices } from "./hello-world-module.js";
import { ERROR_CODES } from "./quickfix-provider.js";

/**
 * 函数检查器，实现函数定义和使用的验证
 */
export class FuncValidator {
  private errorMessageProvider: ErrorMessageProvider;

  constructor(services: HelloWorldServices) {
    this.errorMessageProvider = new ErrorMessageProvider();
  }

  /**
   * 函数悬停提示
   */
  hoverTipsFunc(e: FuncRParams, accept: ValidationAcceptor): void {
    let params = e.funcname.ref?.funcFparam;
    let paramArray: String[] = [];
    params?.forEach((e) => {
      paramArray.push(e.$cstNode?.text!);
    });
    accept(
      "hint",
      `(方法) (${paramArray.join(", ")}): ${e.funcname.ref?.functype}。`,
      { node: e, property: undefined }
    );
  }

  /**
   * 检查未定义的函数
   */
  checkFunctionDeclared(
    funcCall: FunctionCall,
    accept: ValidationAcceptor
  ): void {
    if (!funcCall.funcname.ref) {
      const funcName = funcCall.funcname.$refText;
      const message = `调用了未定义的函数 '${funcName}'。`;
      accept(
        "error",
        this.errorMessageProvider.getSafeEnhancedMessage(message),
        {
          node: funcCall,
          property: "funcname",
          code: ERROR_CODES.UNDEFINED_FUNCTION,
          data: {
            explanation: "函数在调用前需要先定义",
            suggestion: `请先定义该函数，例如：'int ${funcName}() { return 0; }'`,
            category: ErrorCategory.FUNCTION,
            functionName: funcName,
          },
        }
      );
    }
  }

  /**
   * 检查函数名是否唯一
   */
  checkUniqueFuncName(compUnit: CompUnit, accept: ValidationAcceptor): void {
    const funcNames = new Set<string>();
    for (const func of compUnit.functions) {
      if (funcNames.has(func.name)) {
        const message = `函数名 '${func.name}' 已经定义过。`;
        accept(
          "error",
          this.errorMessageProvider.getSafeEnhancedMessage(message),
          {
            node: func,
            property: "name",
            code: ERROR_CODES.DUPLICATE_FUNCTION,
            data: {
              explanation: "同一作用域内不能重复定义同名函数",
              suggestion: "使用不同的函数名或移除重复的定义",
              category: ErrorCategory.FUNCTION,
              functionName: func.name,
            },
          }
        );
      } else {
        funcNames.add(func.name);
      }
    }
  }

  /**
   * 检查非循环块中的break/continue语句
   * TODO: 需要根据新的AST结构重新实现
   */
  checkBreakContinueInNonLoopBlocks(
    funcDef: FuncDef,
    accept: ValidationAcceptor
  ): void {
    // 暂时注释掉，需要根据新的AST结构重新实现
    // console.log('checkBreakContinueInNonLoopBlocks temporarily disabled');
  }

  /**
   * 检查函数参数不匹配
   */
  checkFunctionParameterMismatch(
    func: FuncRParams,
    accept: ValidationAcceptor
  ): void {
    let declaredParams = func.funcname.ref?.funcFparam;
    let declaredParamArray: String[] = [];
    let callParamArray = func.funcRparams;

    // 收集声明的参数
    declaredParams?.forEach((param) => {
      declaredParamArray.push(param.$cstNode?.text!);
    });

    // 检查参数个数是否匹配
    if (declaredParamArray.length !== callParamArray.length) {
      const message = `参数个数不匹配。预期 ${declaredParamArray.length} 个参数，但实际调用时传递了 ${callParamArray.length} 个参数。`;
      accept(
        "error",
        this.errorMessageProvider.getSafeEnhancedMessage(message),
        {
          node: func,
          property: "funcRparams",
          code: ERROR_CODES.PARAMETER_MISMATCH,
          data: {
            explanation: "函数调用时参数数量必须与函数定义匹配",
            suggestion:
              callParamArray.length > declaredParamArray.length
                ? "减少参数数量"
                : "增加缺少的参数",
            category: ErrorCategory.FUNCTION,
            functionName: func.funcname.$refText,
            expectedCount: declaredParamArray.length,
            actualCount: callParamArray.length,
          },
        }
      );
    }
  }

  /**
   * 检查函数返回类型
   */
  checkFunctionReturnType(func: FuncDef, accept: ValidationAcceptor): void {
    // 函数返回值
    const returnType = func.functype;
    const block = func.block;
    let hasReturn = false;
    let actuallReturnType = null;

    // 检查函数体中的所有语句
    block.blockItems?.forEach((blockItem) => {
      if (blockItem.blockStmt?.$type === "Stmtreturn") {
        const returnStmt = blockItem.blockStmt as Stmtreturn;
        actuallReturnType = returnStmt.tobereturn;
        hasReturn = true;
      }
    });

    // 检查有返回值的函数，若没有 return 语句则报错
    if (!hasReturn && returnType !== "void") {
      const message = `有返回值: ${returnType} 的函数缺少 return 语句。`;
      return accept(
        "error",
        this.errorMessageProvider.getSafeEnhancedMessage(message),
        {
          node: func,
          property: "functype",
          code: ERROR_CODES.MISSING_RETURN,
          data: {
            explanation: "有返回值的函数必须包含return语句",
            suggestion: `添加 'return <${returnType}类型的值>;' 语句`,
            category: ErrorCategory.FUNCTION,
            returnType: returnType,
            functionName: func.name,
          },
        }
      );
    }

    // 检查有返回值的函数，若 return为空 则报错
    if (hasReturn && returnType !== "void") {
      if (actuallReturnType === undefined) {
        const message = `有返回值: ${returnType} 的函数不应返回为空。`;
        return accept(
          "error",
          this.errorMessageProvider.getSafeEnhancedMessage(message),
          {
            node: block,
            property: undefined,
            code: ERROR_CODES.EMPTY_RETURN,
            data: {
              explanation: "有返回值的函数必须在return语句中提供一个值",
              suggestion: `将 'return;' 改为 'return <${returnType}类型的值>;'`,
              category: ErrorCategory.FUNCTION,
              returnType: returnType,
              functionName: func.name,
            },
          }
        );
      }
    }

    // 检查void函数不应返回值
    if (hasReturn && returnType === "void") {
      if (actuallReturnType !== undefined) {
        const message = `void 函数不应存在非空返回值。`;
        accept(
          "error",
          this.errorMessageProvider.getSafeEnhancedMessage(message),
          {
            node: block,
            property: undefined,
            code: ERROR_CODES.VOID_RETURN_VALUE,
            data: {
              explanation: "void类型的函数不应该有返回值",
              suggestion: "移除return语句中的表达式或使用'return;'",
              category: ErrorCategory.FUNCTION,
              functionName: func.name,
            },
          }
        );
      }
    }
  }

  /**
   * 检查变量定义类型是否符合返回类型
   */
  checkDefTypeMatchFuncReturnType(
    funcFparam: FuncRParams,
    accept: ValidationAcceptor
  ): void {
    // 所调用的函数的返回类型
    let tarReturnType = funcFparam.funcname.ref?.functype;
    if (tarReturnType === "void") {
      const message = `不能将void类型变量参与运算或用于赋值`;
      accept(
        "error",
        this.errorMessageProvider.getSafeEnhancedMessage(message),
        {
          node: funcFparam.$container?.$cstNode?.astNode!,
          code: ERROR_CODES.VOID_ASSIGNMENT,
          data: {
            explanation: "void类型的函数返回值不能用于赋值或参与运算",
            suggestion: "使用有返回值的函数或不将结果用于赋值",
            category: ErrorCategory.TYPE,
          },
        }
      );
    }
  }
}
