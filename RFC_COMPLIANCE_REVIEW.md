# RFC and eIDAS Compliance Review: Signature Endpoint

**Date**: November 13, 2025  
**Endpoint**: `POST /api/sign/hash`  
**Reviewer**: Cascade AI.
**Standards Reviewed**: RFC 3161, RFC 3339, RFC 5816, eIDAS Regulation (EU) No 910/2014

---

## Executive Summary

The `/api/sign/hash` endpoint implements a **simplified digital signature service** using Ed25519 signatures with blockchain-based timestamping. While the implementation provides useful cryptographic guarantees, it **does not fully conform** to RFC 3161 (Time-Stamp Protocol), RFC 5816 (ESSCertIDv2), or eIDAS qualified timestamp requirements.

### Compliance Status

| Standard | Compliance Level | Notes |
|----------|-----------------|-------|
| **RFC 3339** | ✅ **COMPLIANT** | ISO 8601 timestamps properly formatted |
| **RFC 3161** | ❌ **NON-COMPLIANT** | Missing ASN.1/DER encoding, TST structure, TSA certificates |
| **RFC 5816** | ❌ **NON-COMPLIANT** | No ESSCertIDv2 structure, no certificate chain |
| **eIDAS** | ❌ **NON-COMPLIANT** | Not a qualified timestamp, no accredited TSA |

---

## 1. RFC 3339 Compliance (Date and Time on the Internet)

### Standard Requirements
RFC 3339 defines a profile of ISO 8601 for representing date and time on the Internet.

### Implementation Analysis

```javascript
// From timezone.routes.js line 212
const timestamp_iso = status.iso;
```

The timestamp is generated in `timezone.service.js`:

```javascript
// Line 128-129
const ms = Math.floor(timestampNs / 1_000_000);
const iso = new Date(ms).toISOString();
```

**Format Example**: `"2025-10-08T10:57:01.000Z"`

### ✅ COMPLIANT

The implementation correctly uses:
- ISO 8601 format via JavaScript's `toISOString()`
- UTC timezone indicator (`Z`)
- Full date-time format: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Millisecond precision

**Recommendation**: No changes needed for RFC 3339 compliance.

---

## 2. RFC 3161 Compliance (Time-Stamp Protocol)

### Standard Requirements

RFC 3161 defines the Time-Stamp Protocol (TSP) for creating trusted timestamps. Key requirements:

1. **ASN.1/DER Encoding**: All structures must use ASN.1 DER encoding
2. **TimeStampReq**: Client sends a timestamp request with message imprint
3. **TimeStampResp**: TSA responds with signed TimeStampToken (TST)
4. **TSTInfo Structure**: Contains:
   - Version
   - Policy OID
   - MessageImprint (hash algorithm + hash value)
   - Serial number
   - GenTime (timestamp)
   - Accuracy (optional)
   - TSA name (optional)
5. **Signature**: TST must be signed using CMS (RFC 5652)
6. **Certificates**: TSA certificate chain must be included

### Implementation Analysis

```javascript
// From timezone.routes.js lines 186-244
router.post('/sign/hash', authenticate, authorize, async (req, res) => {
  const { hash_b64url } = req.body;
  
  // Get NEAR blockchain timestamp
  const status = timezoneService.getNearStatus();
  const timestamp_iso = status.iso;
  const likely_time_difference_ms = status.likely_time_difference_ms;
  
  // Get private key
  const seedBytes = configObject.own_rodit_bytes_private_key;
  const keyPair = nacl.sign.keyPair.fromSecretKey(seedBytes);
  const public_key_base64url = base64url(Buffer.from(keyPair.publicKey));
  
  // Create concatenated string and sign
  const concatenated = `${hash_b64url}.${timestamp_iso}.${likely_time_difference_ms}.${public_key_base64url}`;
  const messageBytes = Buffer.from(concatenated, 'utf8');
  const signature = nacl.sign.detached(messageBytes, seedBytes);
  const signature_base64url = base64url(Buffer.from(signature));
  
  res.json({
    data: { hash_b64url, timestamp_iso, likely_time_difference_ms, public_key_base64url },
    concatenated,
    signature_base64url
  });
});
```

### ❌ NON-COMPLIANT

**Critical Gaps**:

1. **No ASN.1/DER Encoding**: Response is JSON, not ASN.1 DER
2. **No TimeStampToken Structure**: Missing TSTInfo, SignedData, ContentInfo
3. **No MessageImprint**: Hash is included as-is, not in MessageImprint structure
4. **No Policy OID**: No timestamp policy identifier
5. **No Serial Number**: No unique serial number per timestamp
6. **No Accuracy Field**: No indication of timestamp accuracy bounds
7. **Wrong Signature Format**: Uses Ed25519 detached signature, not CMS SignedData
8. **No Certificate Chain**: Public key provided but no X.509 certificates
9. **No TSA Identity**: No distinguished name or certificate for TSA
10. **Custom Protocol**: Uses custom JSON format instead of RFC 3161 request/response

**What It Does Instead**:
- Simple Ed25519 signature over concatenated string
- Blockchain timestamp from NEAR Protocol
- Base64url-encoded response
- Transparency about time uncertainty (`likely_time_difference_ms`)

---

## 3. RFC 5816 Compliance (ESSCertIDv2)

### Standard Requirements

RFC 5816 defines the ESSCertIDv2 attribute for identifying signing certificates in CMS signatures. Requirements:

1. **ESSCertIDv2 Structure**: Contains hash of certificate and issuer serial
2. **Hash Algorithm**: Uses SHA-256 or stronger (not SHA-1)
3. **IssuerSerial**: Identifies certificate issuer and serial number
4. **SigningCertificateV2**: Attribute in CMS SignedAttributes

### Implementation Analysis

The endpoint does not use CMS signatures or X.509 certificates at all. It uses:
- Ed25519 raw public keys (32 bytes)
- No certificate structure
- No issuer information
- No ESSCertIDv2 attributes

### ❌ NON-COMPLIANT

**Gaps**:
1. No CMS signature structure
2. No X.509 certificates
3. No ESSCertIDv2 attributes
4. Uses raw public keys instead of certificates

**Note**: Ed25519 is a modern, secure signature algorithm, but it doesn't use the X.509/CMS infrastructure that RFC 5816 requires.

---

## 4. eIDAS Regulation Compliance (EU Regulation No. 910/2014)

### Standard Requirements

The eIDAS Regulation establishes requirements for qualified electronic timestamps in the EU:

1. **Qualified Trust Service Provider (QTSP)**: TSA must be accredited
2. **Qualified Certificate**: TSA must use a qualified certificate
3. **Secure Cryptographic Device (QSCD)**: Keys must be in hardware security module
4. **Timestamp Format**: Must link data to specific time
5. **Accuracy**: Must provide accuracy indication
6. **Reliability**: Must use reliable time source
7. **Audit Trail**: Must maintain audit logs
8. **Supervision**: Must be supervised by national authority
9. **Standards Compliance**: Must follow ETSI standards (EN 319 422)

### Implementation Analysis

**Current Implementation**:
- Uses NEAR blockchain as time source (decentralized, consensus-based)
- Ed25519 signatures with private key from RODiT token
- Provides accuracy estimate (`likely_time_difference_ms`)
- No qualified certificate or QTSP accreditation
- No QSCD (keys stored in application memory)
- No supervision by EU national authority

### ❌ NON-COMPLIANT

**Critical Gaps for eIDAS Qualified Timestamps**:

1. **No QTSP Status**: Service is not an accredited Qualified Trust Service Provider
2. **No Qualified Certificate**: Uses raw Ed25519 keys, not qualified X.509 certificates
3. **No QSCD**: Private keys not in hardware security module
4. **No Supervisory Body**: Not supervised by EU national authority
5. **Non-Standard Format**: Uses custom JSON format, not ETSI EN 319 422
6. **No Audit Trail**: No evidence of comprehensive audit logging for eIDAS
7. **Blockchain Time Source**: While innovative, not recognized as qualified time source

**What It Provides Instead**:
- Decentralized blockchain-based timestamp (NEAR Protocol)
- Cryptographic proof via Ed25519 signatures
- Transparency about time uncertainty
- Verifiable on-chain time source

---

## 5. Technical Architecture Analysis

### Strengths

1. **Blockchain Timestamping**: Uses NEAR blockchain as immutable time source
2. **Time Uncertainty Transparency**: Explicitly provides `likely_time_difference_ms`
3. **Modern Cryptography**: Ed25519 is secure and efficient
4. **Verifiable**: Public key provided for signature verification
5. **Polling Architecture**: 5 Hz polling reduces latency (200ms intervals)
6. **Conservative Bounds**: Time difference calculation is 99% confidence level

### Weaknesses for Standards Compliance

1. **No ASN.1/DER Support**: Cannot interoperate with RFC 3161 clients
2. **No X.509 Infrastructure**: Cannot integrate with PKI systems
3. **Custom Format**: Requires custom client implementation
4. **No Certificate Chain**: Cannot establish trust via certificate authorities
5. **No Policy Framework**: No timestamp policy OID or documentation

---

## 6. Recommendations

### Option A: Maintain Current Implementation (Recommended for Current Use Case)

**If the goal is blockchain-based timestamping without RFC 3161 compliance:**

1. **Document Non-Compliance**: Clearly state this is not RFC 3161 compliant
2. **Add Verification Endpoint**: Provide endpoint to verify signatures
3. **Publish Verification Library**: Create client libraries for signature verification
4. **Document Trust Model**: Explain blockchain-based trust vs. PKI trust
5. **Add Nonce Support**: Allow clients to include nonce for replay protection
6. **Enhance Metadata**: Include NEAR block height, block hash for auditability

**Example Enhancement**:

```javascript
// Enhanced response structure
{
  "version": "1.0",
  "timestamp": {
    "iso": "2025-10-08T10:57:01.000Z",
    "unix": 1728384421,
    "source": "NEAR Protocol",
    "block_height": 123456789,
    "block_hash": "abc123...",
    "likely_time_difference_ms": 850
  },
  "data": {
    "hash_b64url": "...",
    "hash_algorithm": "client-provided",
    "nonce": "optional-client-nonce"
  },
  "signature": {
    "algorithm": "Ed25519",
    "public_key_b64url": "...",
    "signature_b64url": "...",
    "signed_data": "hash.timestamp.uncertainty.pubkey.nonce"
  },
  "verification": {
    "instructions": "Verify Ed25519 signature using public_key_b64url",
    "blockchain_verification": "Query NEAR block at block_height"
  }
}
```

### Option B: Add RFC 3161 Compatibility Layer

**If RFC 3161 compliance is required:**

1. **Add ASN.1 Library**: Use `asn1js` or `node-forge` for ASN.1 encoding
2. **Implement TimeStampReq Parser**: Parse RFC 3161 requests
3. **Generate TimeStampResp**: Create proper TST structure
4. **Add X.509 Certificates**: Generate or obtain TSA certificate
5. **Implement CMS Signing**: Use RFC 5652 SignedData structure
6. **Add Policy OID**: Define and document timestamp policy
7. **Serial Number Generation**: Implement unique serial numbers
8. **Dual Endpoint**: Keep current endpoint, add `/api/tsa` for RFC 3161

**Estimated Effort**: 2-4 weeks for full RFC 3161 implementation

**Dependencies**:
```json
{
  "asn1js": "^3.0.5",
  "pkijs": "^3.0.15",
  "node-forge": "^1.3.1"
}
```

### Option C: eIDAS Qualified Timestamp Service

**If eIDAS compliance is required:**

1. **Partner with QTSP**: Work with accredited provider (e.g., DigiCert, GlobalSign)
2. **Obtain Qualified Certificate**: Get TSA certificate from QTSP
3. **Deploy QSCD**: Use hardware security module for key storage
4. **Implement ETSI Standards**: Follow EN 319 422 for timestamp tokens
5. **Establish Audit Trail**: Implement comprehensive logging
6. **Seek Accreditation**: Apply for QTSP status with national authority
7. **Legal Compliance**: Ensure compliance with all eIDAS requirements

**Estimated Effort**: 6-12 months, significant legal/regulatory work

**Cost**: €50,000 - €200,000+ for accreditation and infrastructure

---

## 7. Use Case Suitability

### Current Implementation is Suitable For:

✅ **Blockchain-based applications**  
✅ **Decentralized timestamp verification**  
✅ **Applications requiring time uncertainty transparency**  
✅ **Non-regulated timestamp services**  
✅ **Internal/private timestamp services**  
✅ **Proof-of-existence applications**  

### Current Implementation is NOT Suitable For:

❌ **Legal evidence requiring RFC 3161 timestamps**  
❌ **EU qualified electronic signatures (eIDAS)**  
❌ **PKI-based systems requiring X.509 certificates**  
❌ **Regulated industries (finance, healthcare) requiring certified TSA**  
❌ **Long-term archival with LTV (Long-Term Validation)**  
❌ **Adobe PDF signatures requiring RFC 3161 TSA**  

---

## 8. Security Considerations

### Current Security Properties

**Strong Points**:
1. Ed25519 provides 128-bit security level
2. NEAR blockchain provides tamper-evident time source
3. Decentralized consensus prevents single point of failure
4. Time uncertainty is explicitly communicated

**Concerns**:
1. Private key security depends on RODiT token storage
2. No key rotation mechanism documented
3. No certificate revocation mechanism
4. Blockchain time has ~600ms granularity
5. Network delays affect time accuracy

### Recommended Security Enhancements

1. **Key Management**: Document secure key storage practices
2. **Rate Limiting**: Already implemented, ensure adequate limits
3. **Audit Logging**: Log all signature operations
4. **Monitoring**: Alert on unusual signing patterns
5. **Key Rotation**: Implement periodic key rotation
6. **Backup Time Source**: Consider fallback if NEAR unavailable

---

## 9. Interoperability Analysis

### Current Interoperability

**Can Interoperate With**:
- Custom clients using Ed25519 verification
- Blockchain applications reading NEAR timestamps
- JSON-based APIs

**Cannot Interoperate With**:
- RFC 3161 TSA clients (Adobe, OpenSSL, etc.)
- PDF signing tools expecting RFC 3161
- CMS/PKCS#7 signature validators
- X.509 certificate-based systems
- eIDAS-compliant signature platforms

---

## 10. Conclusion

The `/api/sign/hash` endpoint provides a **novel blockchain-based timestamping service** with strong cryptographic properties and transparent time uncertainty. However, it is **fundamentally incompatible** with RFC 3161, RFC 5816, and eIDAS requirements.

### Key Findings

1. **RFC 3339**: ✅ Fully compliant
2. **RFC 3161**: ❌ Architecturally incompatible (custom format vs. ASN.1/CMS)
3. **RFC 5816**: ❌ Not applicable (no CMS signatures)
4. **eIDAS**: ❌ Not a qualified timestamp service

### Strategic Recommendation

**For most use cases**: Continue with current implementation, enhance documentation and verification tools.

**If RFC 3161 required**: Implement parallel RFC 3161 endpoint while keeping current endpoint.

**If eIDAS required**: Partner with existing QTSP rather than seeking accreditation.

---

## Appendix A: RFC 3161 Example Structure

For reference, a compliant RFC 3161 TimeStampResp would look like:

```asn1
TimeStampResp ::= SEQUENCE {
  status         PKIStatusInfo,
  timeStampToken TimeStampToken OPTIONAL
}

TimeStampToken ::= ContentInfo
  -- contentType is id-signedData
  -- content is SignedData
  
TSTInfo ::= SEQUENCE {
  version        INTEGER,
  policy         TSAPolicyId,
  messageImprint MessageImprint,
  serialNumber   INTEGER,
  genTime        GeneralizedTime,
  accuracy       Accuracy OPTIONAL,
  ordering       BOOLEAN DEFAULT FALSE,
  nonce          INTEGER OPTIONAL,
  tsa            [0] GeneralName OPTIONAL
}
```

The current implementation provides none of these structures.

---

## Appendix B: Verification Example

To verify a signature from the current endpoint:

```javascript
const nacl = require('tweetnacl');
const base64url = require('base64url');

function verifyTimestamp(response) {
  const { data, concatenated, signature_base64url } = response;
  
  // Reconstruct signed message
  const expectedConcatenated = 
    `${data.hash_b64url}.${data.timestamp_iso}.${data.likely_time_difference_ms}.${data.public_key_base64url}`;
  
  if (concatenated !== expectedConcatenated) {
    throw new Error('Concatenated string mismatch');
  }
  
  // Verify signature
  const message = Buffer.from(concatenated, 'utf8');
  const signature = base64url.toBuffer(signature_base64url);
  const publicKey = base64url.toBuffer(data.public_key_base64url);
  
  const valid = nacl.sign.detached.verify(message, signature, publicKey);
  
  return {
    valid,
    timestamp: data.timestamp_iso,
    uncertainty_ms: data.likely_time_difference_ms
  };
}
```

---

**Document Version**: 1.0  
**Last Updated**: November 13, 2025  
**Next Review**: When RFC compliance is required for specific use case
