package main

import (
	"log"
	"os"

	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"

	"github.com/bim-chain/fabric-bim-governance/chaincode/audit"
	"github.com/bim-chain/fabric-bim-governance/chaincode/governance"
	"github.com/bim-chain/fabric-bim-governance/chaincode/ipasset"
)

func main() {
	auditContract := new(audit.AuditContract)
	ipContract := new(ipasset.IPAssetContract)
	govContract := new(governance.GovernanceContract)

	chaincode, err := contractapi.NewChaincode(auditContract, ipContract, govContract)
	if err != nil {
		log.Panicf("Error creating chaincode: %v", err)
	}

	// CCAAS (Chaincode as a Service) mode
	ccid := os.Getenv("CHAINCODE_ID")
	ccAddr := os.Getenv("CHAINCODE_SERVER_ADDRESS")
	if ccid != "" && ccAddr != "" {
		server := &shim.ChaincodeServer{
			CCID:    ccid,
			Address: ccAddr,
			CC:      chaincode,
			TLSProps: shim.TLSProperties{
				Disabled: true,
			},
		}
		if err := server.Start(); err != nil {
			log.Panicf("Error starting chaincode server: %v", err)
		}
	} else {
		if err := chaincode.Start(); err != nil {
			log.Panicf("Error starting chaincode: %v", err)
		}
	}
}
