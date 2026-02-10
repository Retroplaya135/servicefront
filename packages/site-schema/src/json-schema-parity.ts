export interface JsonSchemaNode {
  type?: unknown;
  const?: unknown;
  enum?: unknown[];
  pattern?: string;
  format?: string;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  additionalProperties?: boolean | JsonSchemaNode;
  required?: string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
}

const comparableScalarKeywords = [
  'type',
  'const',
  'pattern',
  'format',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
] as const satisfies ReadonlyArray<keyof JsonSchemaNode>;

export function assertJsonSchemaValidationParity(expectedSchema: unknown, actualSchema: unknown): void {
  compareNode(expectedSchema as JsonSchemaNode, actualSchema as JsonSchemaNode, '$');
}

function compareNode(expected: JsonSchemaNode, actual: JsonSchemaNode, path: string): void {
  for (const keyword of comparableScalarKeywords) {
    if (expected[keyword] !== undefined) {
      assertEqual(normalizeScalar(keyword, actual[keyword]), normalizeScalar(keyword, expected[keyword]), `${path}.${keyword}`);
    } else if (actual[keyword] !== undefined && !isAllowedExtraKeyword(keyword, expected, actual)) {
      throw new Error(`${path}.${keyword} drifted: unexpected ${String(actual[keyword])}`);
    }
  }

  if (expected.enum !== undefined) {
    assertStringSetEqual(actual.enum, expected.enum, `${path}.enum`);
  } else if (actual.enum !== undefined) {
    throw new Error(`${path}.enum drifted: unexpected enum`);
  }

  if (expected.required !== undefined) {
    assertStringSetEqual(actual.required, expected.required, `${path}.required`);
  } else if (actual.required !== undefined) {
    throw new Error(`${path}.required drifted: unexpected required`);
  }

  if (expected.additionalProperties !== undefined) {
    compareAdditionalProperties(expected.additionalProperties, actual.additionalProperties, path);
  } else if (actual.additionalProperties !== undefined) {
    throw new Error(`${path}.additionalProperties drifted: unexpected additionalProperties`);
  }

  if (expected.properties !== undefined) {
    if (!actual.properties) {
      throw new Error(`${path}.properties drifted: missing actual properties`);
    }

    const expectedKeys = Object.keys(expected.properties);
    assertStringSetEqual(Object.keys(actual.properties), expectedKeys, `${path}.properties`);

    for (const key of expectedKeys) {
      const expectedProperty = expected.properties[key];
      const actualProperty = actual.properties[key];
      if (!expectedProperty || !actualProperty) {
        throw new Error(`${path}.properties.${key} drifted: missing property`);
      }
      compareNode(expectedProperty, actualProperty, `${path}.properties.${key}`);
    }
  } else if (actual.properties !== undefined) {
    throw new Error(`${path}.properties drifted: unexpected properties`);
  }

  if (expected.items !== undefined) {
    if (!actual.items) {
      throw new Error(`${path}.items drifted: missing actual items`);
    }
    compareNode(expected.items, actual.items, `${path}.items`);
  } else if (actual.items !== undefined) {
    throw new Error(`${path}.items drifted: unexpected items`);
  }
}

function normalizeScalar(keyword: keyof JsonSchemaNode, value: unknown): unknown {
  if (keyword === 'pattern' && typeof value === 'string') {
    return value.replaceAll('\\/', '/');
  }
  return value;
}

function isAllowedExtraKeyword(keyword: keyof JsonSchemaNode, expected: JsonSchemaNode, actual: JsonSchemaNode): boolean {
  if (keyword === 'pattern' && expected.pattern === undefined && typeof actual.format === 'string') {
    return true;
  }

  return keyword === 'type' && (expected.const !== undefined || expected.enum !== undefined);
}

function compareAdditionalProperties(
  expected: boolean | JsonSchemaNode,
  actual: boolean | JsonSchemaNode | undefined,
  path: string,
): void {
  if (typeof expected === 'boolean') {
    assertEqual(actual, expected, `${path}.additionalProperties`);
    return;
  }

  if (!actual || typeof actual === 'boolean') {
    throw new Error(`${path}.additionalProperties drifted: missing schema`);
  }

  compareNode(expected, actual, `${path}.additionalProperties`);
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} drifted: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertStringSetEqual(actual: unknown[] | undefined, expected: readonly unknown[], label: string): void {
  if (!actual) {
    throw new Error(`${label} drifted: missing actual array`);
  }

  const actualValues = actual.map(String).sort();
  const expectedValues = expected.map(String).sort();
  if (
    actualValues.length !== expectedValues.length ||
    actualValues.some((item, index) => item !== expectedValues[index])
  ) {
    throw new Error(`${label} drifted`);
  }
}
