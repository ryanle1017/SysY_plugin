grammar HelloWorld

/*
 * ===============================================================================
 * SysY2022 扩展语言文法定义
 * ===============================================================================
 * 
 * 文法结构说明：
 * 1. 编译单元和基本声明部分
 * 2. 函数定义和语句块部分  
 * 3. 表达式和算术运算部分
 * 4. 条件表达式和逻辑运算部分
 * 5. 终结符和字面量定义部分
 * 
 * 缩进规则：
 * - 顶层规则左对齐
 * - 子规则适当缩进表示层级关系
 * - 被唯一引用的规则放在引用者的缩进下方
 * ===============================================================================
 */

// ===============================================================================
// 第一部分：程序结构 - 编译单元和函数定义
// ===============================================================================

entry Model:
    CompUnit;

CompUnit: // 编译单元：由声明和函数定义组成
    // [ CompUnit ] ( Decl | FuncDef )
    (declarations += Decl | functions += FuncDef)+;

FuncDef: // 函数定义
    // FuncType Ident '(' [FuncFParams] ')' Block
    FuncType name=ID '(' (funcFparam += FuncFParam (',' funcFparam += FuncFParam)*)? ')' block=Block;

    FuncFParam: // 函数形参
        // BType Ident ['[' ']' { '[' Exp ']' }]
        BType name=ID ('[' ']' ('(' extraExp += Exp ')')*)?;

Block: // 语句块
    // '{' { BlockItem } '}'
    '{' (blockItems += BlockItem)* '}';

    BlockItem: // 语句块项：声明或语句
        // Decl | Stmt
        blockDecl=Decl | blockStmt=Stmt;

// ===============================================================================
// 第二部分：语句定义
// ===============================================================================

Stmt: // 语句
    // LVal '=' Exp ';' | [Exp] ';' | Block
    // | 'if' '(' Cond ')' Stmt [ 'else' Stmt ]
    // | 'while' '(' Cond ')' Stmt
    // | 'break' ';' | 'continue' ';'
    // | 'return' [Exp] ';'
    
    {infer StmtLval} lval=LVal '=' expr1=Exp ';'
    | {infer StmtExp} (expr2=Exp)? ';'
    | Block
    | {infer Stmtelif} 'if' '(' condition=Cond ')' ifstmt=Stmt ('else' elsestmt=Stmt)?
    | {infer Stmtwhile} 'while' '(' condition=Cond ')' whilestmt=Stmt
    | {infer Stmtbreak} 'break' ';'
    | {infer Stmtcontinue} 'continue' ';'
    | {infer Stmtreturn} 'return' (tobereturn=Exp)? ';';

// ===============================================================================
// 第三部分：声明定义
// ===============================================================================

Decl: // 声明：常量声明或变量声明
    ConstDecl | VarDecl;

ConstDecl infers Decl: // 常量声明
    // 'const' BType ConstDef { ',' ConstDef } ';'
    'const' BType defs += ConstDef (',' defs += ConstDef)* ';';

    ConstDef: // 常数定义
        // Ident { '[' ConstExp ']' } '=' ConstInitVal
        name=ID ('[' index += ConstExp ']')* '=' ConstInitVal;

        ConstInitVal: // 常量初值
            // ConstExp | '{' [ ConstInitVal { ',' ConstInitVal } ] '}'
            singleCInit += ConstExp 
            | '{' (manyCInit += ConstInitVal (',' manyCInit += ConstInitVal)*)? '}';

VarDecl infers Decl: // 变量声明
    // BType VarDef { ',' VarDef } ';'
    BType defs += VarDef (',' defs += VarDef)* ';';

    VarDef: // 变量定义
        // Ident { '[' ConstExp ']' } | Ident { '[' ConstExp ']' } '=' InitVal
        name=ID ('[' index += ConstExp ']')* ('=' Init += InitVal)?;

        InitVal: // 变量初值
            // Exp | '{' [ InitVal { ',' InitVal } ] '}'
            singleInit += Exp 
            | '{' (manyInit += InitVal (',' manyInit += InitVal)*)? '}';

// ===============================================================================
// 第四部分：条件表达式和逻辑运算
// ===============================================================================

Cond: // 条件表达式
    // LOrExp（因为定义不明而且缺乏bool类型，它被移除）
    LOrExp;

LOrExp infers Cond: // 逻辑或表达式
    // LAndExp | LOrExp '||' LAndExp
    LAndExp ({infer BinExpr.left=current} operator='||' right=LAndExp)*;

LAndExp infers Cond: // 逻辑与表达式
    // EqExp | LAndExp '&&' EqExp
    EqExp ({infer BinExpr.left=current} operator='&&' right=EqExp)*;

EqExp infers Cond: // 相等性表达式
    // RelExp | EqExp ('==' | '!=') RelExp
    RelExp ({infer BinExpr.left=current} operator=('==' | '!=') right=RelExp)*;

RelExp infers Cond: // 关系表达式
    // AddExp | RelExp ('<' | '>' | '<=' | '>=') AddExp
    AddExp ({infer BinExpr.left=current} operator=('<' | '>' | '<=' | '>=') right=AddExp)*;

// ===============================================================================
// 第五部分：算术表达式
// ===============================================================================

ConstExp: // 常量表达式
    // AddExp
    // constExp取决于子树在UnaryExp和Lval的判断层级：
    // - 不能包含函数，即UnaryExp使用第二种分解
    // - 使用的Ident必须是常量，要从ConstDef获得，在UnaryExp->PrimaryExp->Lval里
    AddExp;

Exp: // 表达式
    // AddExp
    AddExp;

AddExp infers Exp: // 加减表达式
    // MulExp | AddExp ('+' | '-') MulExp
    MulExp ({infer BinExpr.left=current} operator=('+' | '-') right=MulExp)*;

MulExp infers Exp: // 乘除模表达式
    // UnaryExp | MulExp ('*' | '/' | '%') UnaryExp
    UnaryExp ({infer BinExpr.left=current} operator=('*' | '/' | '%') right=UnaryExp)*;

UnaryExp infers Exp: // 一元表达式
    // PrimaryExp | Ident '(' [FuncRParams] ')' | UnaryOp UnaryExp
    PrimaryExp
    | {infer FunctionCall} funcname=[FuncDef:ID] '(' (FuncRParams)? ')'
    | {infer BinExpr.left=current} operator=('+' | '-' | '!') right=UnaryExp;

PrimaryExp infers Exp: // 基本表达式
    // '(' Exp ')' | LVal | Number
    '(' Exp ')'
    | LVal
    | {infer NumberLiteral} _Number
    | {infer ConstantLVal} value=[ConstDef:ID] ('[' index += Exp ']')*;

// ===============================================================================
// 第六部分：左值和函数调用
// ===============================================================================

type AbstractVariable = ConstDef | VarDef | FuncFParam;

LVal: // 左值表达式：数组或者单个变量
    // Ident {'[' Exp ']'}
    {infer VariableLVal} value=[AbstractVariable:ID] ('[' index += Exp ']')*;

FuncRParams: // 函数实参表
    // Exp { ',' Exp }
    (funcRparams += Exp ',')* funcRparams += Exp;

// ===============================================================================
// 第七部分：类型定义
// ===============================================================================

fragment FuncType: // 函数类型
    // 'void' | 'int' | 'float'
    functype=('int' | 'float' | 'void');

fragment BType: // 基本类型
    // 'int' | 'float'
    btype=('int' | 'float');

fragment _Number: // 数值
    value=(FLOAT_CONST | OCT_CONST | HEX_CONST | DEC_CONST);

// ===============================================================================
// 第八部分：终结符定义
// ===============================================================================

// 标识符
terminal ID: 
    /[_a-zA-Z][\w_]*/;

// 浮点数
terminal FLOAT_CONST: 
    /[0-9]+\.\d+([eE][-+]?\d+)?/;

// 八进制（以0o|0O开头）
terminal OCT_CONST: 
    /0[oO][0-7]+/;

// 十六进制（以0x|0X开头）
terminal HEX_CONST: 
    /0[xX][0-9a-fA-F]+/;

// 十进制（可以以0d|0D开头）
terminal DEC_CONST: 
    /0[dD][0-9]+|[1-9]\d*|0/;

// ===============================================================================
// 第九部分：词法忽略规则
// ===============================================================================

// 解析任何空格并丢弃结果
hidden terminal WS: 
    /\s+/;

// 多行注释：'/*' 到 '*/'
hidden terminal ML_COMMENT: 
    /\/\*[\s\S]*?\*\//;

// 单行注释：'//' 到换行符
hidden terminal SL_COMMENT: 
    /\/\/[^\n\r]*/;

/*
 * ===============================================================================
 * Langium 语法说明
 * ===============================================================================
 * 
 * 数量修饰符：
 * - (...)? 表示0或1个，对应SysY符号[...]
 * - (...)* 表示可重复0或多次，对应SysY符号{...}
 * - (...)+ 表示可重复1或多次，无对应
 * 
 * 特殊类型：
 * - fragment类型：和C语言的define差不多，直接替换
 * - type类型：对于不需要实际解析，但必须存在以防[]引用出错的地方
 *   如果有type A=A1|A2，则可以使用{infer xxx} func=[A] 注意这里没有:号
 * 
 * 交叉引用和赋值：
 * - a:prop=[Def:ID] 识别ID对象，用它寻找一个同样具有name=ID属性且匹配的
 *   Def对象，把它赋给a的prop属性，产生prop:Reference<Def>
 * - +=赋值：numbers+=int 属性是列表，在语义模型产生numbers: Array<int>
 * - ?=赋值：(remote?='AAA')? 如果关键字AAA出现，属性remote的值将设为true
 * 
 * infers关键字（类型推断）：
 * 1. X infers MyType 强制命名X为MyType，将多个对象统一强制命名的结果是
 *    在语义模型接口里将多个解析器规则"合并"
 * 2. X:{infer A}【...】|{infer B}【...】相当于用两段【...】分别定义A和B，然后写X=A|B
 * 3. Exp ({Add.left=current} '+' 【...】)* 如果发现+号，则创建一个类型的新对象Add，
 *    当前对象被赋值给新对象的left属性。然后Add成为新的当前对象
 * 
 * return关键字：
 * 1. terminal ID returns string 使得对于grammar中原本prop=ID存在处，在转化出的语义模型里，
 *    接口函数内对应部分变成prop:string，即内置类型
 * 2. dn returns string：在语义模型创建别名type dn = string，且在赋值prop=dn时有上一条的作用
 * 
 * return配合interface和extends（声明类型）：
 * - 比起infers用法1的自动合并（且generate前不可见）更好
 * 1. interface MyType { name: string count?: number }
 *    和 X returns MyType: name=ID; 相当于手动定义
 * 2. interface MyOtherType extends MyType { age: number } 为1中的加入新属性
 * 3. Function returns Element: {infer Function} "function" name=ID ...;
 *    此时Function是Element的拓展，如果发现其特征关键字"function"就转换成该类型
 *    然后就可以使用Call: element=[NamedElement:ID];来处理联合类型（用Type更方便）
 * ===============================================================================
 */