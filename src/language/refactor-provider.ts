import { LangiumDocument } from 'langium';
import { Position, Range, WorkspaceEdit } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { HelloWorldServices } from './hello-world-module.js';

/**
 * SysY 语言的重构服务
 * 提供函数抽取、代码内联等功能
 */
export class SysyRefactorProvider {
    constructor(private readonly services: HelloWorldServices) {}

    /**
     * 执行函数抽取重构
     * @param documentUri 文档URI
     * @param range 选中范围
     * @param newFunctionName 新函数名
     * @returns 工作区编辑
     */
    async extractFunction(documentUri: string, range: Range, newFunctionName: string): Promise<WorkspaceEdit | undefined> {
        const document = await this.services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.parse(documentUri));
        
        // 检查选中范围
        if (!this.isValidExtractionRange(range)) {
            return undefined;
        }
        
        // 获取选中的代码文本
        const selectedCode = this.getTextInRange(document, range);
        if (!selectedCode) {
            return undefined;
        }
        
        // 分析选中代码，找出需要的参数和返回值
        const analysis = await this.analyzeSelectedCode(document, range, selectedCode);
        
        // 生成新函数
        const newFunction = this.generateNewFunction(newFunctionName, analysis);
        
        // 生成函数调用
        const functionCall = this.generateFunctionCall(newFunctionName, analysis);
        
        // 找到合适的函数插入位置
        const insertPosition = this.findFunctionInsertPosition(document);
        
        // 构建工作区编辑
        const edit: WorkspaceEdit = {
            changes: {
                [documentUri]: [
                    // 替换选中代码为函数调用
                    {
                        range,
                        newText: functionCall
                    },
                    // 插入新函数
                    {
                        range: {
                            start: insertPosition,
                            end: insertPosition
                        },
                        newText: newFunction
                    }
                ]
            }
        };
        
        return edit;
    }
    
    /**
     * 检查选中范围是否有效
     */
    private isValidExtractionRange(range: Range): boolean {
        // 确保选中了足够的代码
        return range.start.line !== range.end.line || 
            (range.end.character - range.start.character > 5);
    }
    
    /**
     * 获取范围内的文本
     */
    private getTextInRange(document: LangiumDocument, range: Range): string | undefined {
        try {
            return document.textDocument.getText(range);
        } catch (error) {
            console.error('获取选中文本失败:', error);
            return undefined;
        }
    }
    
    /**
     * 分析选中代码，找出参数和返回值
     */
    private async analyzeSelectedCode(document: LangiumDocument, range: Range, code: string): Promise<CodeAnalysisResult> {
        // 查找代码块中使用的变量
        const usedVariables = await this.findUsedVariables(document, range);
        
        // 检查是否有返回语句
        const hasReturnStatement = code.includes('return ');
        
        // 确定返回类型
        const returnType = hasReturnStatement ? this.inferReturnType(code) : 'void';
        
        return {
            parameters: usedVariables,
            hasReturn: hasReturnStatement,
            returnType
        };
    }
    
    /**
     * 查找代码中使用的变量
     */
    private async findUsedVariables(document: LangiumDocument, range: Range): Promise<VariableInfo[]> {
        // 这里需要通过AST分析选中代码中使用的外部变量
        // 简化版：我们返回一些示例变量
        // 实际实现需要遍历AST找出选中范围内使用的但未在范围内声明的变量
        
        return [
            { name: 'a', type: 'int' },
            { name: 'b', type: 'int' }
        ];
    }
    
    /**
     * 推断返回类型
     */
    private inferReturnType(code: string): string {
        // 简化版：我们根据关键字推断类型
        // 实际实现需要分析return语句中的表达式类型
        
        if (code.includes('return 0') || code.includes('return a+b') || /return \d+;/.test(code)) {
            return 'int';
        }
        
        if (code.includes('return true') || code.includes('return false')) {
            return 'bool';
        }
        
        return 'int'; // 默认返回int
    }
    
    /**
     * 生成新函数
     */
    private generateNewFunction(functionName: string, analysis: CodeAnalysisResult): string {
        const { parameters, hasReturn, returnType } = analysis;
        
        const paramList = parameters.map(p => `${p.type} ${p.name}`).join(', ');
        const functionHeader = `\n\n${returnType} ${functionName}(${paramList}) {\n`;
        const functionBody = `    // 这里是抽取的代码\n    // TODO: 根据实际选中代码调整\n`;
        const returnStatement = hasReturn ? '' : `    return 0;\n`;
        const functionFooter = `}\n`;
        
        return functionHeader + functionBody + returnStatement + functionFooter;
    }
    
    /**
     * 生成函数调用
     */
    private generateFunctionCall(functionName: string, analysis: CodeAnalysisResult): string {
        const { parameters, hasReturn } = analysis;
        
        const argList = parameters.map(p => p.name).join(', ');
        
        if (hasReturn) {
            return `${functionName}(${argList})`;
        } else {
            return `${functionName}(${argList});`;
        }
    }
    
    /**
     * 找到函数插入位置
     */
    private findFunctionInsertPosition(document: LangiumDocument): Position {
        // 简化版：我们直接在文档末尾插入
        // 实际实现需要找到当前函数结束位置
        
        const lineCount = document.textDocument.lineCount;
        return {
            line: lineCount,
            character: 0
        };
    }
}

/**
 * 变量信息
 */
interface VariableInfo {
    name: string;
    type: string;
}

/**
 * 代码分析结果
 */
interface CodeAnalysisResult {
    parameters: VariableInfo[];
    hasReturn: boolean;
    returnType: string;
} 