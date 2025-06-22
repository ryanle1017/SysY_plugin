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
});

describe('Parsing tests', () => {

    test('parse simple SysY model', async () => {
        document = await parse(`
            int add(int a, int b) {
                return a + b;
            }
            
            int main() {
                int result = add(1, 2);
                return result;
            }
        `);

        expect(
            checkDocumentValid(document) || s`
                Functions:
                  ${document.parseResult.value?.functions?.map(f => f.name)?.join('\n  ')}
                Declarations:
                  ${document.parseResult.value?.declarations?.length || 0}
            `
        ).toBe(s`
            Functions:
              add
              main
            Declarations:
              0
        `);
    });

    test('parse simple variable declarations', async () => {
        document = await parse(`
            int globalVar = 10;
            float pi = 3.14;
        `);

        expect(
            checkDocumentValid(document) || s`
                Declarations:
                  ${document.parseResult.value?.declarations?.length || 0}
                Functions:
                  ${document.parseResult.value?.functions?.length || 0}
            `
        ).toBe(s`
            Declarations:
              2
            Functions:
              0
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
