export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiry: process.env.JWT_EXPIRY || '1h',
  fabricConnectionProfile: process.env.FABRIC_CONNECTION_PROFILE || '',
  fabricChannelName: process.env.FABRIC_CHANNEL || 'bim-project',
  fabricChaincodeName: process.env.FABRIC_CHAINCODE || 'bim-governance',
};
