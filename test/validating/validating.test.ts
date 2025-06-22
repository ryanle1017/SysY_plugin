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

describe('Validating', () => {

    test('check no errors in valid code', async () => {
        document = await parse(`
            int add(int a, int b) {
                return a + b;
            }
            
            int main() {
                int result = add(1, 2);
                return result;
            }
        `);

        // note that 'toHaveLength()' works for arrays and strings alike ;-)
        expect(
            checkDocumentValid(document) || document?.diagnostics?.map(diagnosticToString)?.join('\n') || ''
        ).toHaveLength(0);
    });

    test('check array overflow validation', async () => {
        document = await parse(`
            int main() {
                int arr[3] = {1, 2, 3, 4, 5};
                return arr[0];
            }
        `);
        expect(
            checkDocumentValid(document) || document?.diagnostics?.map(diagnosticToString)?.join('\n') || ''
        ).toEqual(
            expect.stringContaining('数组')
        );
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

function diagnosticToString(d: any): string {
    return `line ${d.range.start.line + 1}: ${d.message} [${d.source || 'unknown'}]`;
}
