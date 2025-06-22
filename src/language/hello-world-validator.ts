import type { ValidationChecks } from "langium";
import { HelloWorldAstType } from "./generated/ast.js";
import type { HelloWorldServices } from "./hello-world-module.js";

/**
 * 注册自定义验证检查。
 */
export function registerValidationChecks(services: HelloWorldServices) {
  const registry = services.validation.ValidationRegistry;
  const validator = services.validation.HelloWorldValidator;
  // Decl文法相关的检查器
  const declValidator = services.validation.DeclValidator;
  // Func文法相关的检查器
  const funcValidator = services.validation.FuncValidator;

  // 绑定检查方法到验证器实例
  const checks: ValidationChecks<HelloWorldAstType> = {
    // 变量定义唯一性检查
    Decl: declValidator.checkUniqueDef.bind(declValidator),
    // 数组越界悬浮提示
    VarDef: declValidator.hoverTipsArray.bind(declValidator),
    // 左值悬停提示以及声明检查
    VariableLVal: [
      declValidator.hoverTipsLval.bind(declValidator),
      declValidator.checkVariableDeclared.bind(declValidator),
    ],

    // 函数参数悬浮提示、声明检查
    // 函数参数数量匹配检查
    // 函数返回值为空的赋值检查
    FuncRParams: [
      funcValidator.hoverTipsFunc.bind(funcValidator),
      funcValidator.checkFunctionParameterMismatch.bind(funcValidator),
      funcValidator.checkDefTypeMatchFuncReturnType.bind(funcValidator),
    ],
    FunctionCall: funcValidator.checkFunctionDeclared.bind(funcValidator),
    // 函数定义唯一性检查
    CompUnit: [funcValidator.checkUniqueFuncName.bind(funcValidator)],
    // break、continue合法性检测以及函数是否存在返回值的检查
    FuncDef: [
      funcValidator.checkBreakContinueInNonLoopBlocks.bind(funcValidator),
      funcValidator.checkFunctionReturnType.bind(funcValidator),
    ],
  };

  registry.register(checks, validator);
}

/**
 * 自定义验证实现。
 */
export class HelloWorldValidator {}
