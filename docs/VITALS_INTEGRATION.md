# Device vitals integration (HL7 v2 / FHIR / MQTT)

Manual entry (`POST /api/vitals`) and device ingestion share one pipeline (`services/vitalsIngest.ts`): department thresholds → store → `new-vital` socket event → escalate the patient to CRITICAL → notify. A device reading can therefore never bypass alerting.

```
 monitor ──HL7 v2 (MLLP)──▶ gateway/Mirth/Rhapsody ─┐
 EHR/FHIR server ───────────────────────────────────┤  POST /api/vitals/ingest/{hl7|fhir|json}
 sensor ──MQTT──▶ broker rule / Node-RED ───────────┘  header x-device-key
```
The API speaks HTTP only. MLLP (TCP) and MQTT are terminated by a bridge you run next to the devices; this keeps raw sockets and broker credentials out of the public API.

## Credentials
ADMIN creates one key per device/gateway: `POST /api/devices {"name":"ICU-3 monitor"}` → `{ data: { id, key } }` (**the key is shown once**, only its SHA-256 is stored). `GET /api/devices` lists keys (with `lastUsedAt`), `DELETE /api/devices/:id` revokes. A key is bound to the hospital that created it; stored readings are tagged `recordedBy = device:<keyId>`.

## Endpoint
`POST /api/vitals/ingest/:protocol` (body ≤ 256 kB). Rate limits: **per device key**, 6 000 requests/minute by default (`INGEST_RATE_LIMIT_MAX`), so a gateway carrying 50+ devices is not throttled by its shared IP and one noisy key cannot starve another hospital; rejected requests (wrong key, bad payload) are limited per IP at 60/minute and a limited address is refused entirely for the rest of that minute (a misbehaving device behind the same NAT blocks the good ones briefly). Batch readings (`{readings:[...]}`, up to 100 per request) to stay far below the limit

| protocol | Content-Type | Payload |
|---|---|---|
| `hl7` | `text/plain` | HL7 v2 `ORU^R01`; patient = `PID-3`, one `OBX` per vital (LOINC in `OBX-3`, value `OBX-5`, unit `OBX-6`, time `OBX-14`) |
| `fhir` | `application/fhir+json` | `Observation` or `Bundle` of Observations; patient = `subject.identifier.value` or `subject.reference: "Patient/<code>"` |
| `json` | `application/json` | `{patientCode, heartRate, systolicBP, diastolicBP, spO2, temperature, respiratoryRate, observedAt?}` or `{readings:[…]}` (≤ 100) |

The patient identifier is `Patient.patientCode`, resolved inside the key's hospital. Supported LOINC: 8867-4 HR, 8480-6/8462-4 systolic/diastolic, 85354-9 BP panel (`120/80`, or components in FHIR), 2708-6 / 59408-5 SpO₂, 8310-5 temperature (°F is converted to °C), 9279-1 respiratory rate. Unknown codes are ignored.

Responses: `201` all stored, `207` partly (retry only the `rejected` entries), `422` none stored, `400` unparsable body, `401` bad/revoked key. Each outcome is `{patientCode, status: stored|rejected, reason?: PATIENT_NOT_FOUND|NO_METRICS|ERROR}`.

## Examples
```bash
curl -X POST "$API/api/vitals/ingest/json" -H "x-device-key: $KEY" -H 'content-type: application/json' \
  -d '{"patientCode":"P-0001","heartRate":88,"spO2":97}'

printf 'MSH|^~\\&|MON|ICU|HOSPILINK|HL|20260101120000||ORU^R01|1|P|2.5\rPID|1||P-0001\rOBX|1|NM|8867-4^HR^LN||88|/min\r' \
  | curl -X POST "$API/api/vitals/ingest/hl7" -H "x-device-key: $KEY" -H 'content-type: text/plain' --data-binary @-
```
MQTT bridge (Mosquitto + Node-RED, or an EMQX rule): subscribe to `hospilink/vitals/#` and POST each message body to `/api/vitals/ingest/json`.

## Extending
Add a protocol = one pure `(body) => IncomingReading[]` in `services/vitalsAdapters.ts`, register it in `ADAPTERS` and in `ingestParams`, add tests. Not yet covered: per-device patient binding (a key may report any patient of its hospital), out-of-order/duplicate suppression, and HL7 ACK responses (`MSA`) for strict MLLP senders; handle ACKs in the bridge.
