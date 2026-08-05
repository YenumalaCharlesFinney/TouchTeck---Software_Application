# ARES 21 Starter Test Data Analysis Report

This document provides a comprehensive technical analysis of the **Starter Gun testing data captures** (`Starter test` and `USB-SERIAL CH340 (COM1)$20260804-162225.dmslog8`) recorded from the official Omega / Swiss Timing ARES 21 software suite.

---

## 1. File Inventory & Overview

| File Name | Size | Type / Format | Purpose |
|---|---|---|---|
| **`Starter test`** | **11.17 MB** (78,429 lines) | Device Monitoring Studio UTF-16 Log Text Dump | Full kernel-level serial trace of starter gun firing runs & timing data. |
| **`USB-SERIAL CH340 (COM1)...dmslog8`** | **820 KB** | DMS Binary Session Index (`.dmslog8`) | Binary session header linking the CH340 USB-to-Serial monitoring session. |

---

## 2. Serial Port Hardware Setup

- **Baud Rate**: `9600 baud` (8 data bits, 1 stop bit, no parity).
- **Control Line Handshake**:  
  - **DTR (Data Terminal Ready)**: `SERIAL_DTR_CONTROL (1)`  
  - **RTS (Request to Send)**: `SERIAL_RTS_CONTROL (64)`
- **Hardware Line Toggles**:
  - The software initializes communication using `IOCTL_SERIAL_CLR_RTS` / `IOCTL_SERIAL_SET_RTS` and `IOCTL_SERIAL_CLR_DTR` / `IOCTL_SERIAL_SET_DTR` to arm the acoustic start pulse circuit.

---

## 3. Starter Gun Triggering & Packet Flow

When the starter gun / transducer acoustic trigger fires, ARES 21 transmits an **ASCII Event Wrapper (`CMD 0x81`)** packet containing the `START` string:

### Primary Starter Gun Frame (`CMD 0x81` - `START`)
```hex
01 81 0C 71 01 11 39 38 02 53 54 41 52 54 04 E8
```
* **`01 81`**: CMD `0x81` (ASCII Event Wrapper Header)
* **`01 11 39 38 02`**: ASCII Sub-header
* **`53 54 41 52 54`**: ASCII text **`START`**
* **`04 E8`**: End of Frame delimiter & Checksum

### Secondary Confirmation Frame (`START_1`)
```hex
01 81 0E 6F 01 11 39 38 02 53 54 41 52 54 5F 31 04 E8
```
* **`53 54 41 52 54 5F 31`**: ASCII text **`START_1`**

---

## 4. Post-Start Event Flow (`TLH` / `SLH`)

Immediately following the starter gun pulse, ARES 21 outputs lap and split headers over the serial line:

1. **Total Lap History (`TLH`) Header**:
   ```text
   TLH| 0| 0| 0| 0| 0| 0| 0
   ```
2. **Split Lap History (`SLH`) Lanes 1–8**:
   ```text
   SLH| 0| 2| 2| ...
   SLH| 0| 3| 3| ...
   SLH| 0| 5| 5| ...
   SLH| 0| 8| 8| ...
   ```
3. **Heat Completion Signal**:
   ```text
   SLH| 0|-1|-1| ...  --> (Indicates Heat Completion / Arm Reset)
   ```

---

## 5. Chronological Starter Gun Test Runs in Log

The log capture records **6 distinct starter test runs**:

| Test Run # | Log Line | Timestamp | Event Triggered |
|---|---|---|---|
| **Run 1** | Line 2,813 | `16:22:38` | Starter Gun Fired (`START` & `START_1`) $\rightarrow$ Lanes 3, 5, 8 active |
| **Run 2** | Line 16,637 | `16:22:45` | Starter Gun Fired (`START` & `START_1`) $\rightarrow$ Lanes 2, 4, 6, 8 active |
| **Run 3** | Line 29,142 | `16:22:52` | Starter Gun Fired (`START` & `START_1`) $\rightarrow$ Lanes 3, 5, 8 active |
| **Run 4** | Line 44,765 | `16:22:59` | Starter Gun Fired (`START` & `START_1`) $\rightarrow$ Lanes 3, 5, 8 active |
| **Run 5** | Line 57,354 | `16:23:06` | Starter Gun Fired (`START` & `START_1`) $\rightarrow$ Lanes 3, 5, 8 active |
| **Run 6** | Line 69,933 | `16:23:13` | Starter Gun Fired (`START` & `START_1`) $\rightarrow$ Heat Finished (`SLH|-1|-1`) |

---

## 6. Summary Table of Key Command Codes

| Command Hex | Byte Sequence Example | Description / Function |
|---|---|---|
| **`CMD 0x81`** | `01 81 0C 71 01 11 ... 53 54 41 52 54` | **Starter Gun Fired** (`START` / `START_1`) |
| **`CMD 0x81`** | `01 81 ... 53 4C 48 7C` | **Split Lap History** (`SLH|...`) |
| **`CMD 0x81`** | `01 81 ... 54 4C 48 7C` | **Total Lap History** (`TLH|...`) |
| **`CMD 0x32`** | `01 32 05 C7 00 00 03 E8 14` | **Continuous Hardware Running Clock Ticks** |
| **`CMD 0x40`** | `01 40 11 AD 00 00 40 3B ...` | **Touchpad (T1) / Hand Button (T2) Touch Event** |
| **`CMD 0x16`** | `01 16 03 E5 00 00 FF` | **Arm Lanes / Pre-Start Mode** (Red LED ON) |
| **`CMD 0x26`** | `01 26 02 D6 00 FF` | **Disarm Lanes / Standby Mode** (Red LED OFF) |
