package mocks

import (
	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// MockTransactionContext implements contractapi.TransactionContextInterface for testing.
type MockTransactionContext struct {
	contractapi.TransactionContext
	StubMock          *MockStub
	ClientIdentityVal *MockClientIdentity
}

// NewMockTransactionContext creates a new mock transaction context.
func NewMockTransactionContext() *MockTransactionContext {
	stub := NewMockStub()
	return &MockTransactionContext{
		StubMock:          stub,
		ClientIdentityVal: NewMockClientIdentity("user1", "Org1MSP"),
	}
}

// GetStub returns the mock stub.
func (m *MockTransactionContext) GetStub() shim.ChaincodeStubInterface {
	return m.StubMock
}

// GetClientIdentity returns the mock client identity.
func (m *MockTransactionContext) GetClientIdentity() *MockClientIdentity {
	return m.ClientIdentityVal
}
