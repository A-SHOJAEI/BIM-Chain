/**
 * Cross-Component Contract Tests
 *
 * These tests verify that shared types and function signatures are consistent
 * across the three main components of the BIM-Chain system:
 *   - Go chaincode (packages/chaincode-go)
 *   - TypeScript middleware (packages/middleware)
 *   - C# Revit plugin (packages/revit-plugin)
 *
 * The tests do NOT execute any real chaincode or network calls. Instead they
 * parse source files and compare the field names, JSON tags, function
 * signatures, and validation schemas so that drift between components is
 * caught early.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Helpers – extract structured metadata from source files
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');

/** Read a file relative to the repository root. */
function readSource(relativePath: string): string {
  const full = path.join(ROOT, relativePath);
  return fs.readFileSync(full, 'utf-8');
}

/**
 * Extract the body of a brace-delimited block starting at the first `{`
 * found at or after `startIdx`. Returns the content between (exclusive of)
 * the opening and closing braces.
 */
function extractBraceBlock(source: string, startIdx: number): string {
  const openBrace = source.indexOf('{', startIdx);
  if (openBrace === -1) return '';
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        return source.substring(openBrace + 1, i);
      }
    }
  }
  return '';
}

/**
 * Extract JSON field names from Go struct json tags.
 * Matches patterns like: `json:"fieldName"` or `json:"fieldName,omitempty"`
 * Returns the field names (without omitempty or other options).
 */
function extractGoJsonFields(source: string, structName: string): string[] {
  const structIdx = source.search(new RegExp(`type\\s+${structName}\\s+struct\\s*\\{`));
  if (structIdx === -1) return [];

  const body = extractBraceBlock(source, structIdx);
  const fields: string[] = [];
  const tagRegex = /json:"([^",]+)(?:,[^"]*)?"/g;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(body)) !== null) {
    fields.push(tagMatch[1]);
  }
  return fields;
}

/**
 * Extract field names from a TypeScript interface definition.
 * Handles both required (`field: type`) and optional (`field?: type`) fields.
 * Uses brace matching to handle nested types (e.g. inline object types).
 */
function extractTsInterfaceFields(source: string, interfaceName: string): string[] {
  const ifaceIdx = source.search(
    new RegExp(`interface\\s+${interfaceName}\\s*\\{`),
  );
  if (ifaceIdx === -1) return [];

  const body = extractBraceBlock(source, ifaceIdx);

  // Extract top-level fields only (lines that start with a word followed by optional ? and :)
  // We need to skip nested brace blocks to avoid matching fields inside inline types.
  const fields: string[] = [];
  let i = 0;
  while (i < body.length) {
    // Skip whitespace/newlines
    if (/\s/.test(body[i])) { i++; continue; }

    // Try to match a field name at the current position
    const fieldMatch = body.substring(i).match(/^(\w+)\??:/);
    if (fieldMatch) {
      fields.push(fieldMatch[1]);
      // Advance past the field name and colon
      i += fieldMatch[0].length;
      // Now skip the type annotation until we reach a ; or end of line
      // respecting nested braces, brackets, etc.
      let depth = 0;
      while (i < body.length) {
        if (body[i] === '{' || body[i] === '[' || body[i] === '(') depth++;
        else if (body[i] === '}' || body[i] === ']' || body[i] === ')') depth--;
        else if (body[i] === ';' && depth === 0) { i++; break; }
        else if (body[i] === '\n' && depth === 0) { i++; break; }
        i++;
      }
    } else {
      // Skip characters that don't start a field
      i++;
    }
  }
  return fields;
}

/**
 * Extract JSON property names from C# [JsonPropertyName("...")] attributes.
 * Captures all such attributes in order of appearance within a given record.
 */
function extractCSharpJsonFields(source: string, recordName: string): string[] {
  // Find the record block – from "public record <name>" to the matching closing brace.
  const recordIdx = source.indexOf(`public record ${recordName}`);
  if (recordIdx === -1) return [];

  // Walk forward to find the opening brace, then match braces.
  const openBrace = source.indexOf('{', recordIdx);
  if (openBrace === -1) return [];

  let depth = 0;
  let closeBrace = -1;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        closeBrace = i;
        break;
      }
    }
  }
  if (closeBrace === -1) return [];

  const body = source.substring(openBrace, closeBrace + 1);
  const fields: string[] = [];
  const attrRegex = /\[JsonPropertyName\("([^"]+)"\)\]/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(body)) !== null) {
    fields.push(attrMatch[1]);
  }
  return fields;
}

/**
 * Extract the required fields array from the middleware validation schema.
 * Looks for `required: [...]` in the changeRecordSchema definition.
 */
function extractValidationRequiredFields(source: string): string[] {
  const reqRegex = /required:\s*\[([^\]]+)\]/;
  const match = source.match(reqRegex);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);
}

/**
 * Extract top-level property names from the validation schema's properties block.
 * Only returns the direct children of the `properties: { ... }` object, not
 * nested properties inside array items or sub-objects.
 */
function extractValidationPropertyNames(source: string): string[] {
  const propsIdx = source.indexOf('properties:');
  if (propsIdx === -1) return [];

  const body = extractBraceBlock(source, propsIdx);
  if (!body) return [];

  // Walk the body at depth 0, extracting field names.
  // A field name is a word followed by `:` at brace depth 0.
  const fields: string[] = [];
  let depth = 0;
  let i = 0;
  while (i < body.length) {
    if (body[i] === '{') { depth++; i++; continue; }
    if (body[i] === '}') { depth--; i++; continue; }
    if (depth === 0) {
      const sub = body.substring(i);
      const fm = sub.match(/^(\w+)\s*:/);
      if (fm) {
        fields.push(fm[1]);
        i += fm[0].length;
        continue;
      }
    }
    i++;
  }
  return fields;
}

/**
 * Extract chaincode function signatures from a Go file.
 * Returns a map of function name -> list of parameter names (excluding ctx).
 */
function extractGoFunctionSignatures(
  source: string,
  contractType: string,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  // Match: func (c *ContractType) FuncName(ctx ..., param1 type1, param2 type2, ...) ...
  const fnRegex = new RegExp(
    `func\\s+\\(\\w+\\s+\\*${contractType}\\)\\s+(\\w+)\\(([^)]+)\\)`,
    'g',
  );
  let fnMatch: RegExpExecArray | null;
  while ((fnMatch = fnRegex.exec(source)) !== null) {
    const funcName = fnMatch[1];
    const paramsRaw = fnMatch[2];
    // Split on comma, skip the first param (ctx)
    const params = paramsRaw
      .split(',')
      .map((p) => p.trim())
      .slice(1) // skip ctx
      .map((p) => {
        // "paramName paramType" -> paramName
        const parts = p.split(/\s+/);
        return parts[0];
      })
      .filter(Boolean);
    result.set(funcName, params);
  }
  return result;
}

/**
 * Extract the chaincode function name used by the middleware's FabricServiceImpl.
 * Looks for patterns like: this.submitTx('Contract:Function', ...) or
 *                          this.evaluateTx('Contract:Function', ...)
 */
function extractMiddlewareFabricCalls(
  source: string,
): Map<string, { txType: string; functionName: string; argExpressions: string[] }> {
  const result = new Map<
    string,
    { txType: string; functionName: string; argExpressions: string[] }
  >();

  // Match method definitions and their bodies in FabricServiceImpl
  // Pattern: async methodName(...): Promise<...> {  ...submitTx/evaluateTx('Name', args...) }
  const methodRegex =
    /async\s+(\w+)\([^)]*\)[^{]*\{([\s\S]*?)(?=\n\s+async\s|\n\s+disconnect|\n\})/g;
  let methodMatch: RegExpExecArray | null;

  while ((methodMatch = methodRegex.exec(source)) !== null) {
    const methodName = methodMatch[1];
    const body = methodMatch[2];

    const txCallRegex =
      /this\.(submitTx|evaluateTx)\(\s*'([^']+)'(?:,\s*([\s\S]*?))?\s*\)/;
    const callMatch = body.match(txCallRegex);
    if (callMatch) {
      const txType = callMatch[1]; // submitTx or evaluateTx
      const functionName = callMatch[2]; // e.g. 'AuditContract:RecordChange'
      const argsStr = callMatch[3] || '';
      // Split on commas that are not inside parentheses or braces
      const argExpressions = argsStr
        ? splitArgExpressions(argsStr)
        : [];
      result.set(methodName, { txType, functionName, argExpressions });
    }
  }

  return result;
}

/**
 * Splits a comma-separated expression string, respecting nesting.
 */
function splitArgExpressions(str: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

// ---------------------------------------------------------------------------
// Load all source files once
// ---------------------------------------------------------------------------

const goTypesSource = readSource('packages/chaincode-go/shared/types.go');
const tsFabricSource = readSource('packages/middleware/src/services/fabric-service.ts');
const csChangeRecordSource = readSource(
  'packages/revit-plugin/BIMChain.Plugin/Models/ChangeRecord.cs',
);
const validationSource = readSource('packages/middleware/src/middleware/validation.ts');
const changesRouteSource = readSource('packages/middleware/src/routes/changes.ts');
const goAuditSource = readSource('packages/chaincode-go/audit/audit.go');
const goIPSource = readSource('packages/chaincode-go/ipasset/ipasset.go');
const goGovernanceSource = readSource('packages/chaincode-go/governance/governance.go');

// ===========================================================================
// 1. C# ChangeRecord vs Middleware JSON Schema Validation
// ===========================================================================

describe('C# ChangeRecord vs Middleware JSON Schema', () => {
  const csFields = extractCSharpJsonFields(csChangeRecordSource, 'ChangeRecord');
  const validationProps = extractValidationPropertyNames(validationSource);
  const validationRequired = extractValidationRequiredFields(validationSource);

  test('C# ChangeRecord JSON property names are recognized', () => {
    expect(csFields.length).toBeGreaterThan(0);
  });

  test('validation schema has properties defined', () => {
    expect(validationProps.length).toBeGreaterThan(0);
  });

  test('every C# ChangeRecord field should exist in the validation schema properties', () => {
    const missing = csFields.filter((f) => !validationProps.includes(f));
    expect(missing).toEqual([]);
  });

  test('every validation schema property should exist in the C# ChangeRecord (excluding orgMspId alias)', () => {
    // orgMspId is accepted by the validation schema as an alternative to orgId.
    // The C# plugin always sends orgId; the middleware maps it to orgMspId.
    const extra = validationProps.filter((f) => !csFields.includes(f) && f !== 'orgMspId');
    expect(extra).toEqual([]);
  });

  test('all validation-required fields should be present in C# ChangeRecord', () => {
    const missingRequired = validationRequired.filter(
      (f) => !csFields.includes(f),
    );
    expect(missingRequired).toEqual([]);
  });

  test('C# ChangeRecord should include all validation-required fields as non-nullable', () => {
    // Parse C# source to find nullable properties (string? type)
    const nullableRegex = /\[JsonPropertyName\("(\w+)"\)\]\s*\n\s*public\s+\w+\?\s+/g;
    const nullableFields: string[] = [];
    let nm: RegExpExecArray | null;
    while ((nm = nullableRegex.exec(csChangeRecordSource)) !== null) {
      nullableFields.push(nm[1]);
    }
    const requiredButNullable = validationRequired.filter((f) =>
      nullableFields.includes(f),
    );
    expect(requiredButNullable).toEqual([]);
  });

  test('C# ChangeType values should match validation schema enum', () => {
    // The validation schema has enum: ['ADD', 'MODIFY', 'DELETE']
    const enumRegex = /enum:\s*\[([^\]]+)\]/;
    const enumMatch = validationSource.match(enumRegex);
    expect(enumMatch).not.toBeNull();
    const schemaEnums = enumMatch![1]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''));

    // Go ChangeType consts
    const goEnumRegex = /ChangeType\w+\s+ChangeType\s*=\s*"(\w+)"/g;
    const goEnums: string[] = [];
    let ge: RegExpExecArray | null;
    while ((ge = goEnumRegex.exec(goTypesSource)) !== null) {
      goEnums.push(ge[1]);
    }

    expect(schemaEnums.sort()).toEqual(goEnums.sort());
  });

  test('a sample C# ChangeRecord JSON payload should satisfy all required fields', () => {
    // Simulate what the C# plugin would produce
    const samplePayload: Record<string, unknown> = {
      modelId: 'model-001',
      elementUniqueId: 'elem-abc-123',
      changeType: 'MODIFY',
      elementHash: 'sha256:abcdef1234567890',
      previousHash: 'sha256:0000000000000000',
      userId: 'user@org1',
      orgId: 'Org1MSP',
      timestamp: new Date().toISOString(),
      parameterChanges: [
        { name: 'Height', oldValue: '3000', newValue: '3500' },
      ],
    };

    // Every required field must be present and non-empty
    for (const field of validationRequired) {
      expect(samplePayload).toHaveProperty(field);
      expect(samplePayload[field]).toBeTruthy();
    }

    // changeType must be one of the allowed values
    expect(['ADD', 'MODIFY', 'DELETE']).toContain(samplePayload.changeType);
  });
});

// ===========================================================================
// 2. Middleware Fabric Service calls vs Chaincode function signatures
// ===========================================================================

describe('Middleware FabricService calls vs Chaincode function signatures', () => {
  const middlewareCalls = extractMiddlewareFabricCalls(tsFabricSource);

  const auditFunctions = extractGoFunctionSignatures(goAuditSource, 'AuditContract');
  const ipFunctions = extractGoFunctionSignatures(goIPSource, 'IPAssetContract');
  const govFunctions = extractGoFunctionSignatures(
    goGovernanceSource,
    'GovernanceContract',
  );

  // Merge all chaincode functions keyed by "Contract:Function"
  const allChaincodeFunctions = new Map<string, string[]>();
  for (const [name, params] of auditFunctions) {
    allChaincodeFunctions.set(`AuditContract:${name}`, params);
  }
  for (const [name, params] of ipFunctions) {
    allChaincodeFunctions.set(`IPAssetContract:${name}`, params);
  }
  for (const [name, params] of govFunctions) {
    allChaincodeFunctions.set(`GovernanceContract:${name}`, params);
  }

  test('middleware calls reference valid chaincode functions', () => {
    const invalidRefs: string[] = [];
    for (const [method, info] of middlewareCalls) {
      if (!allChaincodeFunctions.has(info.functionName)) {
        invalidRefs.push(
          `${method} -> ${info.functionName} (not found in chaincode)`,
        );
      }
    }
    expect(invalidRefs).toEqual([]);
  });

  test('middleware argument count matches chaincode parameter count', () => {
    const mismatches: string[] = [];
    for (const [method, info] of middlewareCalls) {
      const chaincodeParams = allChaincodeFunctions.get(info.functionName);
      if (!chaincodeParams) continue; // already tested above

      const middlewareArgCount = info.argExpressions.length;
      const chaincodeParamCount = chaincodeParams.length;

      if (middlewareArgCount !== chaincodeParamCount) {
        mismatches.push(
          `${method} -> ${info.functionName}: middleware sends ${middlewareArgCount} arg(s) ` +
            `but chaincode expects ${chaincodeParamCount} param(s) ` +
            `[middleware args: ${info.argExpressions.join(', ')}] ` +
            `[chaincode params: ${chaincodeParams.join(', ')}]`,
        );
      }
    }

    // All three previously known mismatches have been RESOLVED:
    //
    // [RESOLVED] approveProposal now sends (proposalId, approval.comment || '')
    //   matching GovernanceContract.ApproveChange(proposalID string, comment string)
    //
    // [RESOLVED] rejectProposal now sends (proposalId, rejection.comment || '')
    //   matching GovernanceContract.RejectChange(proposalID string, reason string)
    //
    // [RESOLVED] addIPContribution now sends (elementId, JSON.stringify(contribution))
    //   matching IPAssetContract.RecordContribution(elementUniqueID, contributionJSON)

    expect(mismatches).toEqual([]);
  });

  test('AuditContract:RecordChange receives a single JSON string argument', () => {
    const call = middlewareCalls.get('submitAuditRecord');
    expect(call).toBeDefined();
    expect(call!.functionName).toBe('AuditContract:RecordChange');
    expect(call!.txType).toBe('submitTx');
    expect(call!.argExpressions.length).toBe(1);
    expect(call!.argExpressions[0]).toContain('JSON.stringify');
  });

  test('AuditContract:QueryByModel receives a single modelId string argument', () => {
    const call = middlewareCalls.get('queryAuditTrail');
    expect(call).toBeDefined();
    expect(call!.functionName).toBe('AuditContract:QueryByModel');
    expect(call!.txType).toBe('evaluateTx');
    expect(call!.argExpressions.length).toBe(1);
  });

  test('AuditContract:QueryByElement receives a single elementId string argument', () => {
    const call = middlewareCalls.get('queryAuditByElement');
    expect(call).toBeDefined();
    expect(call!.functionName).toBe('AuditContract:QueryByElement');
    expect(call!.argExpressions.length).toBe(1);
  });

  test('AuditContract:QueryByTimeRange receives modelId, start, end arguments', () => {
    const call = middlewareCalls.get('queryAuditByTimeRange');
    expect(call).toBeDefined();
    expect(call!.functionName).toBe('AuditContract:QueryByTimeRange');

    const chaincodeParams = allChaincodeFunctions.get('AuditContract:QueryByTimeRange');
    expect(chaincodeParams).toBeDefined();
    expect(chaincodeParams!.length).toBe(3); // modelID, startTime, endTime
    expect(call!.argExpressions.length).toBe(3);
  });

  test('IPAssetContract:RegisterElement receives a single JSON string argument', () => {
    const call = middlewareCalls.get('registerIPElement');
    expect(call).toBeDefined();
    expect(call!.functionName).toBe('IPAssetContract:RegisterElement');
    expect(call!.txType).toBe('submitTx');
    expect(call!.argExpressions.length).toBe(1);
    expect(call!.argExpressions[0]).toContain('JSON.stringify');
  });

  test('GovernanceContract:ProposeChange receives a single JSON string argument', () => {
    const call = middlewareCalls.get('createProposal');
    expect(call).toBeDefined();
    expect(call!.functionName).toBe('GovernanceContract:ProposeChange');
    expect(call!.txType).toBe('submitTx');
    expect(call!.argExpressions.length).toBe(1);
    expect(call!.argExpressions[0]).toContain('JSON.stringify');
  });

  test('[RESOLVED] GovernanceContract:ApproveChange - middleware sends plain comment string', () => {
    const call = middlewareCalls.get('approveProposal');
    expect(call).toBeDefined();
    expect(call!.functionName).toBe('GovernanceContract:ApproveChange');

    const chaincodeParams = allChaincodeFunctions.get('GovernanceContract:ApproveChange');
    expect(chaincodeParams).toBeDefined();
    // Chaincode expects: (proposalID string, comment string) -- 2 params
    expect(chaincodeParams!.length).toBe(2);
    expect(chaincodeParams).toEqual(['proposalID', 'comment']);

    // Middleware now sends: (proposalId, approval.comment || '') -- 2 args, plain string
    expect(call!.argExpressions.length).toBe(2);
    expect(call!.argExpressions[1]).not.toContain('JSON.stringify');
  });

  test('[RESOLVED] GovernanceContract:RejectChange - middleware sends plain reason string', () => {
    const call = middlewareCalls.get('rejectProposal');
    expect(call).toBeDefined();
    expect(call!.functionName).toBe('GovernanceContract:RejectChange');

    const chaincodeParams = allChaincodeFunctions.get('GovernanceContract:RejectChange');
    expect(chaincodeParams).toBeDefined();
    // Chaincode expects: (proposalID string, reason string) -- 2 params
    expect(chaincodeParams!.length).toBe(2);
    expect(chaincodeParams).toEqual(['proposalID', 'reason']);

    // Middleware now sends: (proposalId, rejection.comment || '') -- 2 args, plain string
    expect(call!.argExpressions.length).toBe(2);
    expect(call!.argExpressions[1]).not.toContain('JSON.stringify');
  });

  test('[RESOLVED] IPAssetContract:RecordContribution - middleware sends 2 args matching chaincode', () => {
    const call = middlewareCalls.get('addIPContribution');
    expect(call).toBeDefined();
    expect(call!.functionName).toBe('IPAssetContract:RecordContribution');

    const chaincodeParams = allChaincodeFunctions.get(
      'IPAssetContract:RecordContribution',
    );
    expect(chaincodeParams).toBeDefined();
    // Chaincode expects: (elementUniqueID string, contributionJSON string) -- 2 params
    expect(chaincodeParams!.length).toBe(2);

    // Middleware now sends (elementId, JSON.stringify(contribution)) -- 2 args
    expect(call!.argExpressions.length).toBe(2);
  });
});

// ===========================================================================
// 3. Shared types – consistent field names across Go, TypeScript, and C#
// ===========================================================================

describe('Shared type field consistency across Go, TypeScript, and C#', () => {
  // -------------------------------------------------------------------------
  // AuditRecord
  // -------------------------------------------------------------------------
  describe('AuditRecord fields', () => {
    const goFields = extractGoJsonFields(goTypesSource, 'AuditRecord');
    const tsFields = extractTsInterfaceFields(tsFabricSource, 'AuditRecord');

    test('Go AuditRecord has fields defined', () => {
      expect(goFields.length).toBeGreaterThan(0);
    });

    test('TypeScript AuditRecord has fields defined', () => {
      expect(tsFields.length).toBeGreaterThan(0);
    });

    test('Go and TypeScript AuditRecord should have identical field names', () => {
      const goSet = new Set(goFields);
      const tsSet = new Set(tsFields);

      const inGoNotTs = goFields.filter((f) => !tsSet.has(f));
      const inTsNotGo = tsFields.filter((f) => !goSet.has(f));

      expect(inGoNotTs).toEqual([]);
      expect(inTsNotGo).toEqual([]);
    });

    test('C# ChangeRecord JSON fields should be a subset of AuditRecord (excluding orgMspId/orgId mapping)', () => {
      const csFields = extractCSharpJsonFields(csChangeRecordSource, 'ChangeRecord');
      const goSet = new Set(goFields);

      // The C# plugin uses "orgId" while Go/TS use "orgMspId".
      // The middleware maps between these in the route handler.
      // We treat this as a known, intentional divergence.
      const mapped = csFields.map((f) => (f === 'orgId' ? 'orgMspId' : f));

      const missingFromGo = mapped.filter(
        (f) => !goSet.has(f) && f !== 'docType', // C# doesn't send docType, middleware adds it
      );
      expect(missingFromGo).toEqual([]);
    });

    test('C# ChangeRecord uses "orgId" while Go/TS use "orgMspId" (middleware maps both)', () => {
      const csFields = extractCSharpJsonFields(csChangeRecordSource, 'ChangeRecord');
      // Verify the C# model has orgId, not orgMspId
      expect(csFields).toContain('orgId');
      expect(csFields).not.toContain('orgMspId');

      // Verify Go/TS have orgMspId, not orgId
      expect(goFields).toContain('orgMspId');
      expect(goFields).not.toContain('orgId');
      expect(tsFields).toContain('orgMspId');
      expect(tsFields).not.toContain('orgId');

      // Verify the route handler maps either orgMspId or orgId
      expect(changesRouteSource).toContain('orgMspId: record.orgMspId || record.orgId');
    });

    test('AuditRecord field "worksharingAction" exists in Go and TS but not C#', () => {
      const csFields = extractCSharpJsonFields(csChangeRecordSource, 'ChangeRecord');
      // This documents that the C# plugin does not include worksharingAction,
      // which is acceptable since it is optional in Go/TS.
      expect(goFields).toContain('worksharingAction');
      expect(tsFields).toContain('worksharingAction');
      expect(csFields).not.toContain('worksharingAction');
    });
  });

  // -------------------------------------------------------------------------
  // ParamChange / ParameterChange
  // -------------------------------------------------------------------------
  describe('ParamChange fields', () => {
    const goFields = extractGoJsonFields(goTypesSource, 'ParamChange');
    const csFields = extractCSharpJsonFields(csChangeRecordSource, 'ParameterChange');

    test('Go ParamChange has fields defined', () => {
      expect(goFields.length).toBeGreaterThan(0);
    });

    test('C# ParameterChange has fields defined', () => {
      expect(csFields.length).toBeGreaterThan(0);
    });

    test('Go ParamChange and C# ParameterChange should have identical JSON field names', () => {
      expect(goFields.sort()).toEqual(csFields.sort());
    });

    test('TypeScript inline parameterChanges fields match Go ParamChange', () => {
      // TS defines parameterChanges inline: { name: string; oldValue: string; newValue: string }
      // We verify by checking the interface source contains these field names
      const inlineMatch = tsFabricSource.match(
        /parameterChanges\??\s*:\s*\{([^}]+)\}\[\]/,
      );
      expect(inlineMatch).not.toBeNull();

      const inlineBody = inlineMatch![1];
      const tsInlineFields: string[] = [];
      const fieldRegex = /(\w+)\s*:/g;
      let fm: RegExpExecArray | null;
      while ((fm = fieldRegex.exec(inlineBody)) !== null) {
        tsInlineFields.push(fm[1]);
      }

      expect(tsInlineFields.sort()).toEqual(goFields.sort());
    });
  });

  // -------------------------------------------------------------------------
  // IPRecord
  // -------------------------------------------------------------------------
  describe('IPRecord fields', () => {
    const goFields = extractGoJsonFields(goTypesSource, 'IPRecord');
    const tsFields = extractTsInterfaceFields(tsFabricSource, 'IPRecord');

    test('Go IPRecord has fields defined', () => {
      expect(goFields.length).toBeGreaterThan(0);
    });

    test('TypeScript IPRecord has fields defined', () => {
      expect(tsFields.length).toBeGreaterThan(0);
    });

    test('Go and TypeScript IPRecord should have identical field names', () => {
      const goSet = new Set(goFields);
      const tsSet = new Set(tsFields);

      const inGoNotTs = goFields.filter((f) => !tsSet.has(f));
      const inTsNotGo = tsFields.filter((f) => !goSet.has(f));

      expect(inGoNotTs).toEqual([]);
      expect(inTsNotGo).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Contribution
  // -------------------------------------------------------------------------
  describe('Contribution fields', () => {
    const goFields = extractGoJsonFields(goTypesSource, 'Contribution');
    const tsFields = extractTsInterfaceFields(tsFabricSource, 'Contribution');

    test('Go and TypeScript Contribution should have identical field names', () => {
      expect(goFields.sort()).toEqual(tsFields.sort());
    });
  });

  // -------------------------------------------------------------------------
  // GovernanceProposal
  // -------------------------------------------------------------------------
  describe('GovernanceProposal fields', () => {
    const goFields = extractGoJsonFields(goTypesSource, 'GovernanceProposal');
    const tsFields = extractTsInterfaceFields(tsFabricSource, 'GovernanceProposal');

    test('Go GovernanceProposal has fields defined', () => {
      expect(goFields.length).toBeGreaterThan(0);
    });

    test('TypeScript GovernanceProposal has fields defined', () => {
      expect(tsFields.length).toBeGreaterThan(0);
    });

    test('Go and TypeScript GovernanceProposal should have identical field names', () => {
      const goSet = new Set(goFields);
      const tsSet = new Set(tsFields);

      const inGoNotTs = goFields.filter((f) => !tsSet.has(f));
      const inTsNotGo = tsFields.filter((f) => !goSet.has(f));

      expect(inGoNotTs).toEqual([]);
      expect(inTsNotGo).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Approval
  // -------------------------------------------------------------------------
  describe('Approval fields', () => {
    const goFields = extractGoJsonFields(goTypesSource, 'Approval');
    const tsFields = extractTsInterfaceFields(tsFabricSource, 'Approval');

    test('Go and TypeScript Approval should have identical field names', () => {
      expect(goFields.sort()).toEqual(tsFields.sort());
    });
  });
});

// ===========================================================================
// 4. Additional cross-cutting contract validations
// ===========================================================================

describe('Cross-cutting contract validations', () => {
  test('the middleware route maps C# "orgId" to Go/TS "orgMspId" when calling fabricService', () => {
    // The changes route accepts both orgMspId and orgId, preferring orgMspId
    expect(changesRouteSource).toContain('orgMspId: record.orgMspId || record.orgId');
  });

  test('the middleware route sets docType to "audit" before submitting', () => {
    // The route handler should set docType: 'audit'
    expect(changesRouteSource).toContain("docType: 'audit'");
  });

  test('the validation schema "changeType" enum matches Go ChangeType constants', () => {
    const goEnumRegex = /ChangeType\w+\s+ChangeType\s*=\s*"(\w+)"/g;
    const goEnums: string[] = [];
    let ge: RegExpExecArray | null;
    while ((ge = goEnumRegex.exec(goTypesSource)) !== null) {
      goEnums.push(ge[1]);
    }

    const tsEnumRegex = /changeType:\s*'([^']+)'\s*\|\s*'([^']+)'\s*\|\s*'([^']+)'/;
    const tsMatch = tsFabricSource.match(tsEnumRegex);
    expect(tsMatch).not.toBeNull();
    const tsEnums = [tsMatch![1], tsMatch![2], tsMatch![3]];

    expect(goEnums.sort()).toEqual(tsEnums.sort());
  });

  test('GovernanceProposal "status" values are consistent across Go and TypeScript', () => {
    // Go uses string constants in comments: PROPOSED, APPROVED, REJECTED
    const goStatusComment = goTypesSource.match(
      /Status\s+string\s+`json:"status"`\s*\/\/\s*(.+)/,
    );
    expect(goStatusComment).not.toBeNull();
    const goStatuses = goStatusComment![1]
      .split(',')
      .map((s) => s.trim());

    // TypeScript uses union type: 'PROPOSED' | 'APPROVED' | 'REJECTED'
    const tsStatusRegex = /status:\s*'([^']+)'\s*\|\s*'([^']+)'\s*\|\s*'([^']+)'/;
    const tsMatch = tsFabricSource.match(tsStatusRegex);
    expect(tsMatch).not.toBeNull();
    const tsStatuses = [tsMatch![1], tsMatch![2], tsMatch![3]];

    expect(goStatuses.sort()).toEqual(tsStatuses.sort());
  });
});
