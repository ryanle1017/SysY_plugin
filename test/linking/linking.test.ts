import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { parseHelper } from "langium/test";
import { beforeAll, describe, expect, test } from "vitest";
import { CompUnit, isCompUnit } from "../../src/language/generated/ast.js";
import { createHelloWorldServices } from "../../src/language/hello-world-module.js";

let services: ReturnType<typeof createHelloWorldServices>;
let parse:    ReturnType<typeof parseHelper<CompUnit>>;
let document: LangiumDocument<CompUnit> | undefined;

beforeAll(async () => {
    services = createHelloWorldServices(EmptyFileSystem);
    parse = parseHelper<CompUnit>(services.HelloWorld);
    await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

describe('Linking tests', () => {

    test('linking of function calls', async () => {
        document = await parse(`
            int testFunc() {
                return 42;
            }
            
            int main() {
                return testFunc();
            }
        `);

        expect(
            checkDocumentValid(document) || s`
                Functions:
                  ${document.parseResult.value?.functions?.map(f => f.name)?.join('\n  ')}
            `
        ).toBe(s`
            Functions:
              testFunc
              main
        `);
    });

});

function checkDocumentValid(document: LangiumDocument): string | undefined {
    return document.parseResult.parserErrors.length && s`
        Parser errors:
          ${document.parseResult.parserErrors.map(e => e.message).join('\n  ')}
    `
        || document.parseResult.value === undefined && `ParseResult is 'undefined'.`
        || !isCompUnit(document.parseResult.value) && `Root AST object is a ${document.parseResult.value.$type}, expected a 'CompUnit'.`
        || undefined;
}
