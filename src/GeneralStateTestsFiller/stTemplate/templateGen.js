#! /usr/bin/node


const fs = require('fs')


// This is the Yul code we are attempting to test in multiple circumstances.
// it should store the result in mload(0)
code = fs.readFileSync(process.argv[2], 'utf8')

// This is the expected result
const result = process.argv[3]
// result = "1000000000000000000"


// The code is executed, and the result checked, in these contexts:
//  0. 0x0000  Normal execution
//  1. 0x00F1  CALL a contract with the code
//  2. 0x00F2  CALLCODE a contract ...
//  3. 0x00F4  DELEGATECALL a contract ...
//  4. 0x00FA  STATICCALL a contract ...
//  5. 0xF1F1  CALL a contract that CALLs a contract ...
//  6. 0xF2F1  CALLCODE a contract that CALLs ...
//  7. 0xF4F1  DELEGATECALL ... CALL
//  8. 0xFAF1  STATICCALL ... CALL
//  9. 0xF1F2  CALL a contract that CALLCODEs a contract ...
// 10. 0xF2F2  CALLCODE a contract that CALLCODEs ...
// 11. 0xF4F2  DELEGATECALL ... CALLCODE
// 12. 0xFAF2  STATICCALL ... CALLCODE
// 13. 0xF1F4  CALL a contract that DELEGATECALLs a contract ...
// 14. 0xF2F4  CALLCODE a contract that DELEGATECALLs ...
// 15. 0xF4F4  DELEGATECALL ... DELEGATECALL
// 16. 0xFAF4  STATICCALL ... DELEGATECALL
// 17. 0xF1FA  CALL a contract that STATICCALLs a contract ...
// 18. 0xF2FA  CALLCODE a contract that STATICCALLs ...
// 19. 0xF4FA  DELEGATECALL ... STATICCALL
// 20. 0xFAFA  STATICCALL ... STATICCALL
// 21. 0x00FD  Run the code, call a contract that reverts, then run again
// 22. 0x00FE  Run the code, call a contract that goes out of gas, then run again
// 23. 0x00FF  Run the code, call a contract that self-destructs, then run again
// 24. 0x00F0  CREATE a contract, run the code in the constructor
// 25. 0x00F5  CREATE2 a contract, run the code in the constructor
// 26. 0xF0F1  CREATE a contract with the code and then CALL it
// 27. 0xF5F1  CREATE2 a contract with the code and then CALL it

indentedCode = code.replace(/\n/g, "\n            ")

console.log(`
# Created by stTemplate/templateGen.js
#
# With the template code
# ${indentedCode.replace(/\n/g, '\n#')}
#
# And expected result ${result}
#
template:
  _info:
    comment: Ori Pomerantz   qbzzt1@gmail.com

  env:
    currentCoinbase: 2adc25665018aa1fe0e6bc666dac8fc2697ff9ba
    currentDifficulty: 0x20000
    currentNumber: 1
    currentTimestamp: 1000
    currentGasLimit: 0x1000000
    previousHash: 5e20a0453cecd065ea59c37ac63e079ee08998b6045136a8ce6635c7912ec0b6
    currentBaseFee: 1000

  pre:

    # It is not trivial to use the Yul compiler to get the
    # binary code for the action, so we'll use EXTCODECOPY
    # from this contract
    000000000000000000000000000000000000C0DE:
      balance: 1000000000000000000
      code: |
        :yul {
           ${indentedCode}

           // Here the result is is mload(0). Return it.
           // If we use this as a contructor the result will be
           // the code of the created contract, but we can live
           // with that. We won't call it.
           return(0, 0x20)
        }
      nonce: 1
      storage: {}


    # Code for a construct to create a contract with the template code
    00000000000000000000000000000000C0DEC0DE:
      balance: 1000000000000000000
      code: |
        :yul {
           let addr := 0xC0DE
           let length := extcodesize(addr)

           // Read the code from 0xC0DE
           extcodecopy(addr, 0, 0, length)

           // Return this memory as the code for the contract
           return(0, length)
        }
      nonce: 1
      storage: {}


    # Perform the action (directly or indirectly). Either way,
    # store the result in sload(0).
    cccccccccccccccccccccccccccccccccccccccc:
      balance: 1000000000000000000
      code: |
          :yul {
             let action := calldataload(4)
             let res := 1   // If the result of a call is revert, revert here too
             let addr := 1  // If the result of CREATE[2] is zero, it reverted

             // For when we need code in our memory
             let codeBuffer := 0x20
             // When running the template in the constructor
             let codeLength := extcodesize(0xC0DE)
             // When running the template in the created code
             let codeLength2 := extcodesize(0xC0DEC0DE)


             switch action
             case 0 {  // run the code snippet as normal code
                ${indentedCode}
             }

             // One level of call stack
             case 0xF1 {  // call a contract to run this code
                res := call(gas(), 0xca11, 0, 0, 0, 0, 0x20) // call template code
             }
             case 0xF2 {  // callcode a contract to run this code
                res := callcode(gas(), 0xca11, 0, 0, 0, 0, 0x20)
             }
             case 0xF4 {  // delegate call a contract to run this code
                res := delegatecall(gas(), 0xca11, 0, 0, 0, 0x20)
             }
             case 0xFA {  // static call a contract to run this code
                res := staticcall(gas(), 0xca11, 0, 0, 0, 0x20)
             }

             // Two levels of call stack
             case 0xF1F1 {  // call, call
                res := call(gas(), 0xca1100f1, 0, 0, 0, 0, 0x20)
             }
             case 0xF2F1 {  // callcode, call
                res := callcode(gas(), 0xca1100f1, 0, 0, 0, 0, 0x20)
             }
             case 0xF4F1 {  // delegatecall, call
                res := delegatecall(gas(), 0xca1100f1, 0, 0, 0, 0x20)
             }
             case 0xFAF1 {  // staticcall, call
                res := staticcall(gas(), 0xca1100f1, 0, 0, 0, 0x20)
             }
             case 0xF1F2 {  // call, callcode
                res := call(gas(), 0xca1100f2, 0, 0, 0, 0, 0x20)
             }
             case 0xF2F2 {  // callcode, callcode
                res := callcode(gas(), 0xca1100f2, 0, 0, 0, 0, 0x20)
             }
             case 0xF4F2 {  // delegatecall, callcode
                res := delegatecall(gas(), 0xca1100f2, 0, 0, 0, 0x20)
             }
             case 0xFAF2 {  // staticcall, callcode
                res := staticcall(gas(), 0xca1100f2, 0, 0, 0, 0x20)
             }
             case 0xF1F4 {  // call, delegatecall
                res := call(gas(), 0xca1100f4, 0, 0, 0, 0, 0x20)
             }
             case 0xF2F4 {  // callcode, delegatecall
                res := callcode(gas(), 0xca1100f4, 0, 0, 0, 0, 0x20)
             }
             case 0xF4F4 {  // delegatecall, delegatecall
                res := delegatecall(gas(), 0xca1100f4, 0, 0, 0, 0x20)
             }
             case 0xFAF4 {  // staticcall, delegatecall
                res := staticcall(gas(), 0xca1100f4, 0, 0, 0, 0x20)
             }
             case 0xF1FA {  // call, staticcall
                res := call(gas(), 0xca1100fa, 0, 0, 0, 0, 0x20)
             }
             case 0xF2FA {  // callcode, staticcall
                res := callcode(gas(), 0xca1100fa, 0, 0, 0, 0, 0x20)
             }
             case 0xF4FA {  // delegatecall, staticcall
                res := delegatecall(gas(), 0xca1100fa, 0, 0, 0, 0x20)
             }
             case 0xFAFA {  // staticcall, staticcall
                res := staticcall(gas(), 0xca1100fa, 0, 0, 0, 0x20)
             }
             case 0xFD {   // Rerun the code after a REVERT
                ${indentedCode}
                sstore(0, mload(0))

                pop(call(gas(), 0x60BACC, 0, 0, 0, 0, 0))
                ${indentedCode}

                // The two results should be equal
                if iszero(eq(sload(0), mload(0))) {mstore(0, 0xBADBADBAD)}
             }
             case 0xFE {   // Rerun the code after an out of gas
                ${indentedCode}
                sstore(0, mload(0))

                pop(call(25000, 0x60006, 0, 0, 0, 0, 0))
                ${indentedCode}

                // The two results should be equal
                if iszero(eq(sload(0), mload(0))) {mstore(0, 0xBADBADBAD)}
             }
             case 0xFF {   // Rerun the code after a SELFDESTRUCT
                ${indentedCode}
                sstore(0, mload(0))

                pop(call(gas(), 0xDEADDEAD, 0, 0, 0, 0, 0))
                ${indentedCode}

                // The two results should be equal
                if iszero(eq(sload(0), mload(0))) {mstore(0, 0xBADBADBAD)}
             }



             case 0xF0 {  // CREATE, run the code in the constructor
                // Read the code from 0xC0DE and create a contract based on it
                extcodecopy(0xC0DE, codeBuffer, 0, codeLength)
                addr := create(1000000000000000000, codeBuffer, codeLength)

                // Read the created contract, that is the result
                extcodecopy(addr, 0, 0, 0x20)
             }


             case 0xF5 {  // CREATE2, run the code in the constructor
                // Read the code from 0xC0DE and create a contract based on it
                extcodecopy(0xC0DE, codeBuffer, 0, codeLength)
                addr := create2(1000000000000000000, codeBuffer, codeLength, 0x5a17)

                // Read the created contract, that is the result
                extcodecopy(addr, 0, 0, 0x20)
             }

             case 0xF0F1 { // CREATE, then CALL the created code for the result
                // Read the code from 0xC0DEC0DE and create a
                // contract based on it
                extcodecopy(0xC0DEC0DE, codeBuffer, 0, codeLength2)
                addr := create(1000000000000000000, codeBuffer, codeLength2)

                // Call the contract
                res := call(gas(), addr, 0, 0, 0, 0, 0x20)

             }


             case 0xF5F1 { // CREATE2, then CALL the created code for the result
                // Read the code from 0xC0DEC0DE and create a
                // contract based on it
                extcodecopy(0xC0DEC0DE, codeBuffer, 0, codeLength2)
                addr := create2(1000000000000000000, codeBuffer, codeLength2, 0x5a17)

                // Call the contract
                res := call(gas(), addr, 0, 0, 0, 0, 0x20)

             }


             default {    // Fail, we should never get here
               mstore(0, 0xBAD0BAD0BAD0)
             }

             // If res is zero, that means a call failed, so fail too
             if iszero(res) { revert(0,0x20) }

             // If addr is zero, that means a create failed, so fail too
             if iszero(addr) { revert(0,0x20) }

             // Here the result is is mload(0), store it so
             // the test can check it
             sstore(0, mload(0))
          }
      nonce: 1
      storage:
        0: 0x60A7   # To be overwritten by the code snippet



    # Called to perform the code snippet and return the result
    000000000000000000000000000000000000ca11:
      balance: '1000000000000000000'
      code: |
          :yul {
            ${indentedCode}
            return(0, 0x20)     // return the result as our return value
          }
      nonce: 1
      storage: {}


    # Called to CALL the code (two level call stack)
    00000000000000000000000000000000ca1100f1:
      balance: '1000000000000000000'
      code: |
          :yul {
            if iszero(call(gas(), 0xca11, 0, 0, 0, 0, 0x20))
               { revert(0,0x20) }

            return(0, 0x20)     // return the result as our return value
          }
      nonce: 1
      storage: {}


    # Called to CALLCODE the code (two level call stack)
    00000000000000000000000000000000ca1100f2:
      balance: '1000000000000000000'
      code: |
          :yul {
            if iszero(callcode(gas(), 0xca11, 0, 0, 0, 0, 0x20))
               { revert(0,0x20) }

            return(0, 0x20)     // return the result as our return value
          }
      nonce: 1
      storage: {}


    # Called to DELEGATECALL the code (two level call stack)
    00000000000000000000000000000000ca1100f4:
      balance: '1000000000000000000'
      code: |
          :yul {
            if iszero(delegatecall(gas(), 0xca11, 0, 0, 0, 0x20))
               { revert(0,0x20) }

            return(0, 0x20)     // return the result as our return value
          }
      nonce: 1
      storage: {}


    # Called to STATICCALL the code (two level call stack)
    00000000000000000000000000000000ca1100fa:
      balance: '1000000000000000000'
      code: |
          :yul {
            if iszero(staticcall(gas(), 0xca11, 0, 0, 0, 0x20))
               { revert(0,0x20) }

            return(0, 0x20)     // return the result as our return value
          }
      nonce: 1
      storage: {}


    # Failures (to run the code after a failure, see it works)

    # Out of gas
    0000000000000000000000000000000000060006:
      balance: '1000000000000000000'
      code: :raw 0xFE
      nonce: 1
      storage: {}


    # REVERT
    000000000000000000000000000000000060BACC:
      balance: '1000000000000000000'
      code: |
        :yul {
           revert(0,0x20)
        }
      nonce: 1
      storage: {}


    # SELFDESTRUCT
    00000000000000000000000000000000DEADDEAD:
      balance: '1000000000000000000'
      code: |
        :yul {
           selfdestruct(0)
        }
      nonce: 1
      storage: {}


    # Either save or return a value (to get values out of a constructor)
    1111111111111111111111111111111111111111:
      balance: '1000000000000000000'
      code: |
          :yul {
            if eq(calldatasize(), 0) {
              mstore(0, sload(0))
              return(0, 0x20)
            }

            // If we are here, we are writing a value
            sstore(0, calldataload(0))
          }
      nonce: 1
      storage: {}








    a94f5374fce5edbc8e2a8697c15331677e6ebf0b:
      balance: '1000000000000000000'
      code: '0x'
      nonce: 1
      storage: {}


  transaction:
    data:
    # Run the code snippet normally
    - data: :label normal :abi f(uint) 0x00
      accessList: []

    # Single level call stack
    # CALL
    - data: :label normal :abi f(uint) 0xf1
      accessList: []
    # CALLCODE
    - data: :label normal :abi f(uint) 0xf2
      accessList: []
    # DELEGATECALL
    - data: :abi f(uint) 0xf4
      accessList: []
    # STATICCALL
    - data: :abi f(uint) 0xfa
      accessList: []

    # Two level call stack
    # CALL CALL
    - data: :abi f(uint) 0xf1f1
      accessList: []
    # CALLCODE CALL
    - data: :abi f(uint) 0xf2f1
      accessList: []
    # DELEGATECALL CALL
    - data: :abi f(uint) 0xf4f1
      accessList: []
    # STATICCALL CALL
    - data: :abi f(uint) 0xfaf1
      accessList: []
    # CALL CALLCODE
    - data: :abi f(uint) 0xf1f2
      accessList: []
    # CALLCODE CALLCODE
    - data: :abi f(uint) 0xf2f2
      accessList: []
    # DELEGATECALL CALLCODE
    - data: :abi f(uint) 0xf4f2
      accessList: []
    # STATICCALL CALLCODE
    - data: :abi f(uint) 0xfaf2
      accessList: []
    # CALL DELEGATECALL
    - data: :abi f(uint) 0xf1f4
      accessList: []
    # CALLCODE DELEGATECALL
    - data: :abi f(uint) 0xf2f4
      accessList: []
    # DELEGATECALL DELEGATECALL
    - data: :abi f(uint) 0xf4f4
      accessList: []
    # STATICCALL DELEGATECALL
    - data: :abi f(uint) 0xfaf4
      accessList: []
    # CALL STATICCALL
    - data: :abi f(uint) 0xf1fa
      accessList: []
    # CALLCODE STATICCALL
    - data: :abi f(uint) 0xf2fa
      accessList: []
    # DELEGATECALL STATICCALL
    - data: :abi f(uint) 0xf4fa
      accessList: []
    # STATICCALL STATICCALL
    - data: :abi f(uint) 0xfafa
      accessList: []

    # Call after something fails
    # REVERT
    - data: :abi f(uint) 0xfd
      accessList: []
    # Out of gas
    - data: :abi f(uint) 0xfe
      accessList: []
    # SELFDESTRUCT
    - data: :abi f(uint) 0xff
      accessList: []


    # Combined with creation of contracts
    # CREATE (run code in the constructor)
    - data: :abi f(uint) 0xf0
      accessList: []
    # CREATE2 (run code in the constructor)
    - data: :abi f(uint) 0xf5
      accessList: []
    # CREATE and then CALL
    - data: :abi f(uint) 0xf0f1
      accessList: []
    # CREATE2 and then CALL
    - data: :abi f(uint) 0xf5f1
      accessList: []


    gasLimit:
    - 4000000
    nonce: 1
    to: cccccccccccccccccccccccccccccccccccccccc
    value:
    - 0
    secretKey: "45a915e4d060149eb4365960e6a7a45f334393093061116b197e3240065ff2d8"
    maxPriorityFeePerGas: 10
    maxFeePerGas: 2000


  expect:
    - indexes:
        data: !!int -1
        gas:  !!int -1
        value: !!int -1

      network:
        - '>=London'
      result:
        cccccccccccccccccccccccccccccccccccccccc:
          storage:
            # The result we expect
            0x00: ${result}
`)
