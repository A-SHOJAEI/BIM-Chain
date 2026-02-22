package mocks

import (
	"crypto/x509"
)

// MockClientIdentity provides a mock of cid.ClientIdentity for testing.
type MockClientIdentity struct {
	IDValue    string
	MspIDValue string
}

// NewMockClientIdentity creates a new mock client identity.
func NewMockClientIdentity(id, mspID string) *MockClientIdentity {
	return &MockClientIdentity{
		IDValue:    id,
		MspIDValue: mspID,
	}
}

// GetID returns the identity ID.
func (m *MockClientIdentity) GetID() (string, error) {
	return m.IDValue, nil
}

// GetMSPID returns the MSP ID.
func (m *MockClientIdentity) GetMSPID() (string, error) {
	return m.MspIDValue, nil
}

// GetAttributeValue returns a named attribute value.
func (m *MockClientIdentity) GetAttributeValue(attrName string) (string, bool, error) {
	return "", false, nil
}

// AssertAttributeValue checks that an attribute value matches.
func (m *MockClientIdentity) AssertAttributeValue(attrName, attrValue string) error {
	return nil
}

// GetX509Certificate returns the X.509 certificate (nil for mock).
func (m *MockClientIdentity) GetX509Certificate() (*x509.Certificate, error) {
	return nil, nil
}
