package mocks

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/golang/protobuf/ptypes/timestamp"
	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-protos-go/ledger/queryresult"
	"github.com/hyperledger/fabric-protos-go/peer"
)

// MockStub implements shim.ChaincodeStubInterface (v1) for testing.
type MockStub struct {
	State        map[string][]byte
	Events       map[string][]byte
	TxIDValue    string
	TxTS         *timestamp.Timestamp
	History      map[string][][]byte
	CreatorBytes []byte
	mu           sync.RWMutex
}

// NewMockStub creates a new mock stub with initialized state.
func NewMockStub() *MockStub {
	return &MockStub{
		State:        make(map[string][]byte),
		Events:       make(map[string][]byte),
		TxIDValue:    "test-tx-001",
		TxTS:         &timestamp.Timestamp{Seconds: time.Now().Unix()},
		History:      make(map[string][][]byte),
		CreatorBytes: []byte("test-creator"),
	}
}

func (m *MockStub) GetState(key string) ([]byte, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	val, ok := m.State[key]
	if !ok {
		return nil, nil
	}
	return val, nil
}

func (m *MockStub) PutState(key string, value []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.State[key] = value
	return nil
}

func (m *MockStub) DelState(key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.State, key)
	return nil
}

func (m *MockStub) CreateCompositeKey(objectType string, attributes []string) (string, error) {
	if objectType == "" {
		return "", fmt.Errorf("objectType cannot be empty")
	}
	key := objectType
	for _, attr := range attributes {
		key += "~" + attr
	}
	return key, nil
}

func (m *MockStub) SplitCompositeKey(compositeKey string) (string, []string, error) {
	parts := strings.Split(compositeKey, "~")
	if len(parts) < 1 {
		return "", nil, fmt.Errorf("invalid composite key")
	}
	return parts[0], parts[1:], nil
}

func (m *MockStub) GetStateByPartialCompositeKey(objectType string, attributes []string) (shim.StateQueryIteratorInterface, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	prefix := objectType
	for _, attr := range attributes {
		prefix += "~" + attr
	}

	var results []*queryresult.KV
	for key, val := range m.State {
		if strings.HasPrefix(key, prefix) {
			results = append(results, &queryresult.KV{Key: key, Value: val})
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Key < results[j].Key
	})

	return &MockStateIterator{Results: results, CurrentIndex: 0}, nil
}

func (m *MockStub) GetTxID() string {
	return m.TxIDValue
}

func (m *MockStub) SetEvent(name string, payload []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Events[name] = payload
	return nil
}

func (m *MockStub) GetTxTimestamp() (*timestamp.Timestamp, error) {
	return m.TxTS, nil
}

func (m *MockStub) GetHistoryForKey(key string) (shim.HistoryQueryIteratorInterface, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	history := m.History[key]
	var results []*queryresult.KeyModification
	for _, val := range history {
		results = append(results, &queryresult.KeyModification{
			TxId:  m.TxIDValue,
			Value: val,
		})
	}
	return &MockHistoryIterator{Results: results, CurrentIndex: 0}, nil
}

func (m *MockStub) GetStateByRange(startKey, endKey string) (shim.StateQueryIteratorInterface, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var results []*queryresult.KV
	for key, val := range m.State {
		if key >= startKey && (endKey == "" || key < endKey) {
			results = append(results, &queryresult.KV{Key: key, Value: val})
		}
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].Key < results[j].Key
	})
	return &MockStateIterator{Results: results, CurrentIndex: 0}, nil
}

func (m *MockStub) GetQueryResult(query string) (shim.StateQueryIteratorInterface, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var results []*queryresult.KV
	for key, val := range m.State {
		results = append(results, &queryresult.KV{Key: key, Value: val})
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].Key < results[j].Key
	})
	return &MockStateIterator{Results: results, CurrentIndex: 0}, nil
}

// Remaining interface methods - stub implementations

func (m *MockStub) GetArgs() [][]byte                            { return nil }
func (m *MockStub) GetStringArgs() []string                      { return nil }
func (m *MockStub) GetFunctionAndParameters() (string, []string) { return "", nil }
func (m *MockStub) GetArgsSlice() ([]byte, error)                { return nil, nil }
func (m *MockStub) GetChannelID() string                         { return "test-channel" }
func (m *MockStub) InvokeChaincode(name string, args [][]byte, channel string) peer.Response {
	return peer.Response{Status: 200}
}
func (m *MockStub) GetCreator() ([]byte, error)                            { return m.CreatorBytes, nil }
func (m *MockStub) GetTransient() (map[string][]byte, error)               { return nil, nil }
func (m *MockStub) GetBinding() ([]byte, error)                            { return nil, nil }
func (m *MockStub) GetDecorations() map[string][]byte                      { return nil }
func (m *MockStub) GetSignedProposal() (*peer.SignedProposal, error)       { return nil, nil }
func (m *MockStub) SetStateValidationParameter(key string, ep []byte) error { return nil }
func (m *MockStub) GetStateValidationParameter(key string) ([]byte, error)  { return nil, nil }
func (m *MockStub) GetPrivateData(collection, key string) ([]byte, error)   { return nil, nil }
func (m *MockStub) GetPrivateDataHash(collection, key string) ([]byte, error) { return nil, nil }
func (m *MockStub) PutPrivateData(collection, key string, value []byte) error { return nil }
func (m *MockStub) DelPrivateData(collection, key string) error               { return nil }
func (m *MockStub) PurgePrivateData(collection, key string) error             { return nil }
func (m *MockStub) SetPrivateDataValidationParameter(collection, key string, ep []byte) error {
	return nil
}
func (m *MockStub) GetPrivateDataValidationParameter(collection, key string) ([]byte, error) {
	return nil, nil
}
func (m *MockStub) GetPrivateDataByRange(collection, startKey, endKey string) (shim.StateQueryIteratorInterface, error) {
	return &MockStateIterator{}, nil
}
func (m *MockStub) GetPrivateDataByPartialCompositeKey(collection, objectType string, keys []string) (shim.StateQueryIteratorInterface, error) {
	return &MockStateIterator{}, nil
}
func (m *MockStub) GetPrivateDataQueryResult(collection, query string) (shim.StateQueryIteratorInterface, error) {
	return &MockStateIterator{}, nil
}
func (m *MockStub) GetStateByPartialCompositeKeyWithPagination(objectType string, keys []string, pageSize int32, bookmark string) (shim.StateQueryIteratorInterface, *peer.QueryResponseMetadata, error) {
	return &MockStateIterator{}, nil, nil
}
func (m *MockStub) GetStateByRangeWithPagination(startKey, endKey string, pageSize int32, bookmark string) (shim.StateQueryIteratorInterface, *peer.QueryResponseMetadata, error) {
	return &MockStateIterator{}, nil, nil
}
func (m *MockStub) GetQueryResultWithPagination(query string, pageSize int32, bookmark string) (shim.StateQueryIteratorInterface, *peer.QueryResponseMetadata, error) {
	return &MockStateIterator{}, nil, nil
}

// MockStateIterator implements shim.StateQueryIteratorInterface.
type MockStateIterator struct {
	Results      []*queryresult.KV
	CurrentIndex int
}

func (i *MockStateIterator) HasNext() bool {
	return i.CurrentIndex < len(i.Results)
}

func (i *MockStateIterator) Next() (*queryresult.KV, error) {
	if !i.HasNext() {
		return nil, fmt.Errorf("no more results")
	}
	result := i.Results[i.CurrentIndex]
	i.CurrentIndex++
	return result, nil
}

func (i *MockStateIterator) Close() error {
	return nil
}

// MockHistoryIterator implements shim.HistoryQueryIteratorInterface.
type MockHistoryIterator struct {
	Results      []*queryresult.KeyModification
	CurrentIndex int
}

func (i *MockHistoryIterator) HasNext() bool {
	return i.CurrentIndex < len(i.Results)
}

func (i *MockHistoryIterator) Next() (*queryresult.KeyModification, error) {
	if !i.HasNext() {
		return nil, fmt.Errorf("no more results")
	}
	result := i.Results[i.CurrentIndex]
	i.CurrentIndex++
	return result, nil
}

func (i *MockHistoryIterator) Close() error {
	return nil
}
