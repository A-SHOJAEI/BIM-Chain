export const changeRecordSchema = {
  type: 'object' as const,
  required: ['modelId', 'elementUniqueId', 'changeType', 'elementHash', 'userId'],
  anyOf: [
    { required: ['orgId'] },
    { required: ['orgMspId'] },
  ],
  properties: {
    modelId: { type: 'string' as const, minLength: 1 },
    elementUniqueId: { type: 'string' as const, minLength: 1 },
    changeType: { type: 'string' as const, enum: ['ADD', 'MODIFY', 'DELETE'] },
    elementHash: { type: 'string' as const, minLength: 1 },
    previousHash: { type: 'string' as const },
    userId: { type: 'string' as const, minLength: 1 },
    orgId: { type: 'string' as const, minLength: 1 },
    orgMspId: { type: 'string' as const, minLength: 1 },
    timestamp: { type: 'string' as const },
    parameterChanges: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          oldValue: { type: 'string' as const },
          newValue: { type: 'string' as const },
        },
      },
    },
  },
};

export const batchChangeSchema = {
  oneOf: [
    changeRecordSchema,
    { type: 'array' as const, items: changeRecordSchema },
  ],
};
