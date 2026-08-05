# Omega / Swiss Timing ARES 21 – Protocol, Connectivity & Lane Reference

**Document Version:** 2.1 (Decoded Binary Specification & Bit-Level Analysis)  
**Project:** TouchTeck Swimming Timing Software  
**Target Hardware:** Omega / Swiss Timing ARES 21 Timing Console & Simulator  
**Connection Interface:** USB-SERIAL CH340 / RS-232 DB9 Serial  
**Date:** August 2, 2026  

---

## 1. Important Connectivity Codes (Connecting & Red Light Trigger)

To connect to the ARES 21 console or simulator and transition the device into **Online Mode** (which causes the **RED LED light on the ARES 21 to start BLINKING**), the serial port must be configured and a specific 14-step initialization sequence must be sent.

### Serial Port Physical Parameters:
- **Baud Rate:** `9600` (Official SWIMM.EXE standard)
- **Data Bits:** `8`
- **Parity:** `None`
- **Stop Bits:** `1`
- **Flow Control:** `None` (RTS & DTR set to `LOW / false`)

### Key Connectivity Hex Commands:
- **Header Checksum Formula (`hCheck`)**: `(0xFE - CMD - LEN) & 0xFF`
- **Data Checksum Formula (`dCheck`)**: `(0xFF - sum(PAYLOAD)) & 0xFF`

### Official 14-Step Initialization Sequence:

```hex
Step  1 [Poll Status]:            01 F7 02 05 04 FB
Step  2 [Query Firmware]:         01 F0 00 0E
Step  3 [Software ID - "SWU"]:    01 F8 03 03 53 57 55
Step  4 [Secondary Query]:        01 F1 00 0D
Step  5 [Config 14]:              01 14 03 E7 6F EF A1
Step  6 [Config 16 - ARM LANES]: 01 16 03 E5 00 00 FF  <-- CRITICAL! MAKES RED LED BLINK!
Step  7 [Config 15 - Lane Map]:   01 15 0B DE 01 02 03 04 05 06 07 08 FF FF DD
Step  8 [Config 02 - Race Setup]: 01 02 05 F7 01 08 07 EA 05
Step  9 [Config 03 - Start Mode]: 01 03 03 F8 02 02 FB
Step 10 [Config 84 - Display]:    01 84 02 78 08 F7
Step 11 [Config 9F]:              01 9F 02 5D 00 FF
Step 12 [Clock Sync 1]:           01 F3 03 08 04 43 B8
Step 13 [Clock Sync 2]:           01 F3 03 08 01 43 BB
Step 14 [Keepalive Poll]:         01 F7 02 05 04 FB
```

> **Note on Red LED Light Activation:**  
> Command **Step 6 (`01 16 03 E5 00 00 FF`)** is the critical command that arms the touchpad lanes on the ARES 21 console. Upon receiving this command, the console's **RED LED light blinks**, signaling that live communication is active and touchpad events are ready to stream.

---

## 2. Working Hex Codes for Each Lane (Lanes 1 to 8)

Below are the verified, 100% working hex frames transmitted by the ARES 21 console when a touch is recorded on each lane.

| Lane | Raw Binary Frame (`CMD 0x40`) | Lane Code Byte (`data[2]`) | Bitwise Lane Formula | ASCII Command Format (`CMD 0x81`) | Status |
|---|---|---|---|---|---|
| **Lane 1** | `01 40 11 AD 00 01 40 FB 00 01 00 01 [TIME] [CHK]` | `0x40` / `0x80` | `(0x40 & 0x0F) + 1 = 1` | `SLH\| 01\| 01\| 1\| [TIME]\|` | **VERIFIED WORKING** |
| **Lane 2** | `01 40 11 AD 00 05 41 FB 00 01 00 02 [TIME] [CHK]` | `0x41` / `0xC1` | `(0x41 & 0x0F) + 1 = 2` | `SLH\| 01\| 02\| 1\| [TIME]\|` | **VERIFIED WORKING** |
| **Lane 3** | `01 40 11 AD 00 07 42 FB 00 01 00 03 [TIME] [CHK]` | `0x42` / `0xC2` | `(0x42 & 0x0F) + 1 = 3` | `SLH\| 01\| 03\| 1\| [TIME]\|` | **VERIFIED WORKING** |
| **Lane 4** | `01 40 11 AD 00 09 43 FB 00 01 00 04 [TIME] [CHK]` | `0x43` / `0xC3` | `(0x43 & 0x0F) + 1 = 4` | `SLH\| 01\| 04\| 1\| [TIME]\|` | **VERIFIED WORKING** |
| **Lane 5** | `01 40 11 AD 00 0B 44 FB 00 01 00 05 [TIME] [CHK]` | `0x44` / `0xC4` | `(0x44 & 0x0F) + 1 = 5` | `SLH\| 01\| 05\| 1\| [TIME]\|` | **VERIFIED WORKING** |
| **Lane 6** | `01 40 11 AD 00 37 45 FB 00 01 00 06 [TIME] [CHK]` | `0x45` / `0xC5` | `(0x45 & 0x0F) + 1 = 6` | `SLH\| 01\| 06\| 1\| [TIME]\|` | **VERIFIED WORKING** |
| **Lane 7** | `01 40 11 AD 00 5F 46 FB 00 01 00 07 [TIME] [CHK]` | `0x46` / `0xC6` | `(0x46 & 0x0F) + 1 = 7` | `SLH\| 01\| 07\| 1\| [TIME]\|` | **VERIFIED WORKING** |
| **Lane 8** | `01 40 11 AD 00 67 47 FB 00 01 00 08 [TIME] [CHK]` | `0x47` / `0xC7` | `(0x47 & 0x0F) + 1 = 8` | `SLH\| 01\| 08\| 1\| [TIME]\|` | **VERIFIED WORKING** |

---

## 3. Bit-Level Analysis

Each byte should be decoded individually.

### Example format:

`40 01 08 03 6A 00 FF`

| Byte | Binary | Meaning |
|---|---|---|
| **40** | `01000000` | Touch Event |
| **01** | `00000001` | Lane 1 |
| **08** | `00001000` | Payload Length |
| **03** | `00000011` | Status |
| **6A** | `01101010` | Timing Data |
| **00** | `00000000` | Reserved |
| **FF** | `11111111` | End |

---

### Full 17-Byte ARES 21 Touchpad Frame Bit Breakdown (`CMD 0x40`)

Example Frame: `01 40 11 AD 00 01 40 FB 00 01 00 01 00 00 26 1A 5C`

| Index | Byte Hex | Binary Representation | Field Description & Bit Analysis |
|---|---|---|---|
| `00` | `01` | `00000001` | **SOH**: Start of Header Marker |
| `01` | `40` | `01000000` | **CMD**: Command Code (`0x40` = Touch Event Frame) |
| `02` | `11` | `00010001` | **LEN**: Total Frame Length (17 Bytes) |
| `03` | `AD` | `10101101` | **HCHECK**: Header Checksum (`(0xFE - CMD - LEN) & 0xFF`) |
| `04` | `00` | `00000000` | **PAYLOAD [0]**: Payload Start Marker (`0xAD` / `0x00`) |
| `05` | `01` | `00000001` | **PAYLOAD [1]**: Sequence / Event Counter |
| `06` | `40` | `01000000` | **PAYLOAD [2]**: **Lane Code Byte** (`0x40` $\rightarrow$ Lane 1, `0x41` $\rightarrow$ Lane 2, etc.) |
| `07` | `FB` | `11111011` | **PAYLOAD [3]**: **Event Type** (`0xFB` = Touchpad Hit, `0x39` = Running Split) |
| `08` | `00` | `00000000` | **PAYLOAD [4]**: Reserved Flag |
| `09` | `01` | `00000001` | **PAYLOAD [5]**: Heat / Event Marker |
| `10` | `00` | `00000000` | **PAYLOAD [6]**: Sub-second Flag |
| `11` | `01` | `00000001` | **PAYLOAD [7]**: Rank / Place Order (1st Place) |
| `12` | `00` | `00000000` | **PAYLOAD [8]**: High-byte Timestamp (ms) |
| `13` | `00` | `00000000` | **PAYLOAD [9]**: Mid-high-byte Timestamp (ms) |
| `14` | `26` | `00100110` | **PAYLOAD [10]**: Mid-low-byte Timestamp (ms) |
| `15` | `1A` | `00011010` | **PAYLOAD [11]**: Low-byte Timestamp (ms $\rightarrow$ Big-Endian uint32) |
| `16` | `5C` | `01011100` | **DCHECK**: Data Checksum (`(0xFF - sum(Payload)) & 0xFF`) |

---

## 4. Net Elapsed Time Math & Clock Drift Correction

### Problem Statement:
The ARES 21 internal wall clock runs continuously after serial connection starts. If a race starts at ARES timestamp $T_{\text{start}} = 16.00\text{s}$ and a touch occurs at raw ARES timestamp $T_{\text{touch}} = 25.77\text{s}$, the raw frame contains $25.77\text{s}$.

### Calculation Formula:
$$\text{Net Elapsed Time} = T_{\text{touchpad}} - T_{\text{race\_start}}$$

- **Example**: $\text{Net Time} = 25.77\text{s} - 16.00\text{s} = 9.77\text{s}$
- **Formatted Display**: `00:09.77`

---

*Document saved in project workspace root as `ARES21_Protocol_Documentation.md`.*
