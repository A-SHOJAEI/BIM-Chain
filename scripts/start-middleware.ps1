Set-Location 'H:\BIM - Blockchain\packages\middleware'
$env:FABRIC_MOCK = 'true'
$env:JWT_SECRET = 'dev-testing-secret-change-in-production'
$env:PORT = '3001'
$env:CORS_ORIGIN = 'http://localhost:3000'
npm start
