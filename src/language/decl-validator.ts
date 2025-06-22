import { ValidationAcceptor } from "langium";
import {
    ErrorCategory,
    ErrorMessageProvider,
} from "./error-message-provider.js";
import {
    Decl,
    VarDef,
    VariableLVal,
    isConstDef,
    isFuncFParam,
    isVarDef,
} from "./generated/ast.js";
import { HelloWorldServices } from "./hello-world-module.js";
import { ERROR_CODES } from "./quickfix-provider.js";

/**
 * 声明检查器，实现变量声明和使用的验证
 */
export class DeclValidator {
  private errorMessageProvider: ErrorMessageProvider;

  /**
   * 构造函数
   * @param services HelloWorld服务注入
   */
  constructor(private readonly _services: HelloWorldServices) {
    this.errorMessageProvider = new ErrorMessageProvider();
  }

  /**
   * 检查变量是否在块内重定义
   * @param constDecl 常量声明节点
   * @param accept 验证接收器
   */
  checkUniqueDef(constDecl: Decl, accept: ValidationAcceptor): void {
    const reported = new Set<string>();
    constDecl.defs.forEach((d) => {
      if (reported.has(d.name)) {
        const message = `无法重新声明块范围变量 '${d.name}'。`;
        accept(
          "error",
          this.errorMessageProvider.getSafeEnhancedMessage(message),
          {
            node: d,
            property: "name",
            code: ERROR_CODES.DUPLICATE_DECLARATION,
            data: {
              explanation: "同一作用域内不能重复声明同名变量",
              suggestion: "使用不同的变量名或移除重复的声明",
              category: ErrorCategory.VARIABLE,
              variableName: d.name,
            },
          }
        );
      }
      reported.add(d.name);
    });
  }

  /**
   * 数组越界悬浮提示
   * @param arr 数组定义节点
   * @param accept 验证接收器
   */
  hoverTipsArray(arr: VarDef, accept: ValidationAcceptor): void {
    if (arr.index[0]) {
      //是一个数组才能取值
      const length = (arr.index[0] as { value: string }).value; // 获取数组长度
      const lengthInt = parseInt(length, 10); // 将字符串解析为整数，第二个参数 10 表示使用十进制解析
      if (arr.Init[0].manyInit.length > lengthInt) {
        const message = `数组 ${arr.name} 的初始化元素数量超过了数组大小。`;
        accept(
          "error",
          this.errorMessageProvider.getSafeEnhancedMessage(message),
          {
            node: arr,
            property: "Init",
            code: ERROR_CODES.ARRAY_SIZE_OVERFLOW,
            data: {
              explanation: "数组元素数量超过了声明的大小",
              suggestion: "增大数组大小或减少初始化元素的数量",
              category: ErrorCategory.ARRAY,
              arrayName: arr.name,
              declaredSize: lengthInt,
              actualSize: arr.Init[0].manyInit.length,
            },
          }
        );
      }
    }
  }

  /**
   * 左值悬停提示
   * @param lval 左值节点
   * @param accept 验证接收器
   */
  hoverTipsLval(lval: VariableLVal, accept: ValidationAcceptor): void {
    let ref = lval.value.ref;
    if (isFuncFParam(ref)) {
      // 函数形参悬停提示
      accept("hint", `(参数) ${lval.value.$refText}: ${ref?.btype}。`, {
        node: lval,
        property: undefined,
      });
    } else if (isConstDef(ref)) {
      // 常量
      accept("hint", `${ref.$cstNode?.container?.text}`, {
        node: lval,
        property: undefined,
      });
    } else if (isVarDef(ref)) {
      // 普通变量
      accept("hint", `${ref.$cstNode?.container?.text}`, {
        node: lval,
        property: undefined,
      });
    }
  }

  /**
   * 检查未定义的变量
   * @param lval 左值节点
   * @param accept 验证接收器
   */
  checkVariableDeclared(lval: VariableLVal, accept: ValidationAcceptor): void {
    if (!lval.value.ref) {
      const varName = lval.value.$refText;
      const message = `使用了未定义的变量 '${varName}'。`;
      accept(
        "error",
        this.errorMessageProvider.getSafeEnhancedMessage(message),
        {
          node: lval,
          property: "value",
          code: ERROR_CODES.UNDEFINED_VARIABLE,
          data: {
            explanation: "变量在使用前需要先定义",
            suggestion: `请先声明该变量，例如：'int ${varName} = 0;'`,
            category: ErrorCategory.VARIABLE,
            variableName: varName,
          },
        }
      );
    }
  }
}
