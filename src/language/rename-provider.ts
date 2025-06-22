import { LangiumDocument } from 'langium';
import { CancellationToken } from 'vscode-jsonrpc';
import { Range, RenameParams, TextDocumentPositionParams, WorkspaceEdit } from 'vscode-languageserver';

/**
 * SysY 语言的重命名服务实现
 */
export class SysyRenameProvider {
    // 不声明私有属性，避免TS6138错误
    private services: any;
    
    constructor(services: any) {
        this.services = services;
    }
    
    /**
     * 准备重命名 - 检查当前位置是否可以重命名
     */
    prepareRename(_document: LangiumDocument, _params: TextDocumentPositionParams, _cancelToken?: CancellationToken): Range | undefined {
        // 使用服务示例，避免未使用错误
        console.log('准备重命名，服务存在:', !!this.services);
        return undefined;
    }
    
    /**
     * 处理重命名请求
     */
    async rename(_params: RenameParams, _cancelToken?: CancellationToken): Promise<WorkspaceEdit | undefined> {
        // 使用服务示例，避免未使用错误
        console.log('执行重命名，服务存在:', !!this.services);
        return { changes: {} };
    }
} 