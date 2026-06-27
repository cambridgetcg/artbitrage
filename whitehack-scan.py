#!/usr/bin/env python3
"""
ARTBITRAGE — WHITEHACK Nen Scanner
Scans macOS local system and generates a Nen battle report.
Every interface is a Nen type. Every scan is a dungeon clear.

Usage:
  python3 whitehack-scan.py           # scan + battle report
  python3 whitehack-scan.py --json    # JSON output for the API
  python3 whitehack-scan.py --level   # just show current level
"""

import json
import subprocess
import sys
import os
import socket
import platform
import datetime
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# THE NEN MAP — system interface → Nen type
# ═══════════════════════════════════════════════════════════════

NEN_MAP = {
    "wifi": {
        "nen": "emitter", "jp": "放出系", "color": "#ff6b9d",
        "hz": 639, "freq": "TRUST", "technique": "Signal Wave (信号波)",
        "power_base": 100, "power_mod": 0.6,
        "principle": "Wi-Fi projects your aura outward. The signal is your Nen reaching the world.",
    },
    "bluetooth": {
        "nen": "manipulator", "jp": "操作系", "color": "#fde68a",
        "hz": 741, "freq": "JOY", "technique": "Device Puppet (機器傀儡)",
        "power_base": 80, "power_mod": 0.8,
        "principle": "Bluetooth manipulates nearby devices. Short range, precise control.",
    },
    "ethernet": {
        "nen": "enhancer", "jp": "強化系", "color": "#34d399",
        "hz": 528, "freq": "LOVE", "technique": "Direct Line (直線)",
        "power_base": 120, "power_mod": 1.0,
        "principle": "Ethernet is the most direct. Honest. High-bandwidth. The Enhancer of connections.",
    },
    "thunderbolt": {
        "nen": "transmuter", "jp": "変化系", "color": "#a78bfa",
        "hz": 852, "freq": "UNDERSTANDING", "technique": "Data Shift (資料変)",
        "power_base": 100, "power_mod": 0.8,
        "principle": "Thunderbolt transforms data at extreme speed. Flexible, creative, powerful.",
    },
    "usb": {
        "nen": "conjurer", "jp": "具現化系", "color": "#00f0ff",
        "hz": 432, "freq": "TRUTH", "technique": "Device Summon (機器召喚)",
        "power_base": 80, "power_mod": 0.8,
        "principle": "USB conjures external devices into being. Brings something new into the system.",
    },
    "vpn_tunnel": {
        "nen": "specialist", "jp": "特質系", "color": "#ff1493",
        "hz": 963, "freq": "ETERNAL", "technique": "Shadow Passage (影通路)",
        "power_base": 100, "power_mod": 1.0,
        "principle": "VPN tunnels are Specialist techniques — they break the rules of the network. The Dark Continent passage.",
    },
    "sleep_wake": {
        "nen": "specialist", "jp": "特質系", "color": "#ff1493",
        "hz": 963, "freq": "ETERNAL", "technique": "Energy Cycle (能量循環)",
        "power_base": 60, "power_mod": 1.0,
        "principle": "Sleep/Wake is Zetsu/Ten. Suppress your aura to recover, then focus it again.",
    },
    "firewall": {
        "nen": "conjurer", "jp": "具現化系", "color": "#00f0ff",
        "hz": 432, "freq": "TRUTH", "technique": "Barrier Manifest (結界顕現)",
        "power_base": 70, "power_mod": 0.8,
        "principle": "Firewall conjures a protective barrier. The truth that guards the gate.",
    },
    "bonjour": {
        "nen": "emitter", "jp": "放出系", "color": "#ff6b9d",
        "hz": 639, "freq": "TRUST", "technique": "Presence Broadcast (存在放送)",
        "power_base": 60, "power_mod": 0.6,
        "principle": "Bonjour/Zeroconf emits your presence to the local network. Trust broadcast.",
    },
}

RANKS = {
    "rank_e": {"name": "E-Rank Hunter", "power": 0, "color": "#6a6a8a", "desc": "just started. no scans. no connections."},
    "rank_d": {"name": "D-Rank Hunter", "power": 100, "color": "#34d399", "desc": "first scan. sensing the system."},
    "rank_c": {"name": "C-Rank Hunter", "power": 300, "color": "#00f0ff", "desc": "multiple scans. understanding the hardware."},
    "rank_b": {"name": "B-Rank Hunter", "power": 600, "color": "#a78bfa", "desc": "all interfaces mapped. nen awakened."},
    "rank_a": {"name": "A-Rank Hunter", "power": 1000, "color": "#fde68a", "desc": "all connections analyzed. vows mastered."},
    "rank_s": {"name": "S-Rank Hunter", "power": 2000, "color": "#ff6b9d", "desc": "system fully understood. love is the strongest nen."},
    "rank_monarch": {"name": "MONARCH", "power": 5000, "color": "#ff1493", "desc": "you ARE the system. the dark continent is you. is is lol."},
}

# ═══════════════════════════════════════════════════════════════
# SCANNERS — probe each macOS system interface
# ═══════════════════════════════════════════════════════════════

def run_cmd(cmd, timeout=10):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip() if r.returncode == 0 else r.stderr.strip()
    except Exception as e:
        return str(e)

def scan_wifi():
    """Scan Wi-Fi — Emitter"""
    active = False
    details = {}
    
    # Check if en0 is active
    en0 = run_cmd("ifconfig en0 2>/dev/null")
    if "status: active" in en0:
        active = True
        # Extract IP
        for line in en0.split("\n"):
            if "inet " in line:
                details["ip"] = line.split("inet ")[1].split(" ")[0]
                break
    
    # Get SSID
    ssid = run_cmd("networksetup -getairportnetwork en0 2>/dev/null")
    if "not associated" not in ssid.lower() and ssid:
        details["ssid"] = ssid.replace("Current Wi-Fi Network: ", "")
    
    # Get connection type
    details["interface"] = "en0"
    details["mac"] = run_cmd("ifconfig en0 2>/dev/null | grep ether | awk '{print $2}'")
    
    # DNS
    dns = run_cmd("networksetup -getdnsservers Wi-Fi 2>/dev/null")
    if dns and "There aren't any DNS Servers" not in dns:
        details["dns"] = dns
    
    return {"active": active, "details": details}

def scan_bluetooth():
    """Scan Bluetooth — Manipulator"""
    active = False
    details = {}
    
    bt = run_cmd("system_profiler SPBluetoothDataType 2>/dev/null")
    if "State: On" in bt:
        active = True
        details["state"] = "on"
        
        # Get controller address
        for line in bt.split("\n"):
            if "Address:" in line and "Controller" not in line:
                details["controller_address"] = line.split("Address:")[1].strip()
                break
        
        # Count connected devices
        if "Connected:" in bt and "Not Connected" not in bt.split("Connected:")[1][:20]:
            connected_section = bt.split("Connected:")[1]
            details["connected_devices"] = connected_section.count("Address:")
        else:
            details["connected_devices"] = 0
        
        # List nearby devices
        not_connected = bt.split("Not Connected:")
        if len(not_connected) > 1:
            nearby = not_connected[1].count("Address:")
            details["nearby_devices"] = nearby
    
    details["chipset"] = "BCM_4388"
    return {"active": active, "details": details}

def scan_ethernet():
    """Scan Ethernet — Enhancer"""
    active = False
    details = {}
    
    # Check all ethernet interfaces
    for iface in ["en3", "en4", "en1", "en2"]:
        status = run_cmd(f"ifconfig {iface} 2>/dev/null | grep status")
        if "active" in status:
            active = True
            details["interface"] = iface
            details["status"] = "active"
            inet = run_cmd(f"ifconfig {iface} 2>/dev/null | grep 'inet '")
            if inet:
                details["ip"] = inet.split("inet ")[1].split(" ")[0]
    
    if not active:
        details["status"] = "inactive"
        # Check Thunderbolt bridge
        bridge = run_cmd("ifconfig bridge0 2>/dev/null | grep status")
        if "active" in bridge:
            active = True
            details["interface"] = "bridge0 (Thunderbolt)"
    
    return {"active": active, "details": details}

def scan_thunderbolt():
    """Scan Thunderbolt — Transmuter"""
    active = False
    details = {}
    
    tb = run_cmd("system_profiler SPThunderboltDataType 2>/dev/null")
    if tb and "No Thunderbolt" not in tb and len(tb) > 20:
        active = True
        # Count devices
        if "Vendor Name:" in tb:
            details["devices"] = tb.count("Vendor Name:")
        details["bus_count"] = tb.count("Thunderbolt Bus")
    
    # Also check display (Thunderbolt display = transmuter output)
    displays = run_cmd("system_profiler SPDisplaysDataType 2>/dev/null | grep 'Connection Type'")
    if displays:
        details["display_connection"] = displays.strip()
    
    return {"active": active, "details": details}

def scan_usb():
    """Scan USB — Conjurer"""
    active = False
    details = {}
    
    usb = run_cmd("system_profiler SPUSBDataType 2>/dev/null")
    if usb and "USB" in usb:
        bus_count = usb.count("USB 3.")
        if bus_count > 0:
            active = True
        details["buses"] = bus_count
        # Count actual devices (not just buses)
        devices = usb.count("Host Controller Driver")
        details["host_controllers"] = devices
    
    return {"active": active, "details": details}

def scan_vpn():
    """Scan VPN tunnels — Specialist"""
    active = False
    details = {}
    
    # Check for utun interfaces (VPN tunnels)
    utuns = run_cmd("ifconfig -a 2>/dev/null | grep '^utun'")
    if utuns:
        tunnels = utuns.strip().split("\n")
        active_tunnels = []
        for t in tunnels:
            iface = t.split(":")[0]
            inet = run_cmd(f"ifconfig {iface} 2>/dev/null | grep 'inet '")
            if inet:
                active_tunnels.append({
                    "interface": iface,
                    "ip": inet.split("inet ")[1].split(" ")[0] if "inet " in inet else "assigned"
                })
        if active_tunnels:
            active = True
            details["tunnels"] = active_tunnels
            details["tunnel_count"] = len(active_tunnels)
            # The Dark Continent passage
            details["passage"] = "VPN = Dark Continent passage. Specialist technique."
    
    return {"active": active, "details": details}

def scan_sleep_wake():
    """Scan sleep/wake — Specialist (Zetsu/Ten)"""
    active = False
    details = {}
    
    # Check if system is awake
    pmset = run_cmd("pmset -g assertions 2>/dev/null")
    if "UserIsActive" in pmset and "1" in pmset.split("UserIsActive")[0][-10:]:
        active = True
        details["state"] = "awake (Ten — focused)"
    else:
        details["state"] = "sleeping (Zetsu — suppressed)"
    
    # Get sleep settings
    sleep = run_cmd("pmset -g 2>/dev/null | grep 'sleep '")
    if sleep:
        details["sleep_timer"] = sleep.strip()
    
    details["uptime"] = run_cmd("uptime 2>/dev/null").strip()
    
    return {"active": active, "details": details}

def scan_firewall():
    """Scan firewall — Conjurer (barrier)"""
    active = False
    details = {}
    
    fw = run_cmd("/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null")
    if "enabled" in fw.lower():
        active = True
        details["state"] = "enabled"
    else:
        details["state"] = "disabled"
    
    # Get open ports
    ports = run_cmd("lsof -i -P -n 2>/dev/null | grep LISTEN | awk '{print $1, $9}' | sort -u")
    if ports:
        port_list = ports.strip().split("\n")
        details["open_ports"] = port_list[:10]  # first 10
        details["port_count"] = len(port_list)
    
    return {"active": active, "details": details}

def scan_bonjour():
    """Scan Bonjour/mDNS — Emitter (presence broadcast)"""
    active = False
    details = {}
    
    # Check hostname
    hostname = run_cmd("scutil --get LocalHostName 2>/dev/null")
    if hostname:
        active = True
        details["hostname"] = hostname
    
    computer_name = run_cmd("scutil --get ComputerName 2>/dev/null")
    if computer_name:
        details["computer_name"] = computer_name
    
    # Check if sharingd is running (Handoff/AirDrop)
    sharing = run_cmd("launchctl list 2>/dev/null | grep sharingd")
    if sharing:
        details["airdrop"] = "active"
        details["handoff"] = "active"
    
    return {"active": active, "details": details}

# ═══════════════════════════════════════════════════════════════
# BATTLE REPORT
# ═══════════════════════════════════════════════════════════════

SCANNERS = {
    "wifi": scan_wifi,
    "bluetooth": scan_bluetooth,
    "ethernet": scan_ethernet,
    "thunderbolt": scan_thunderbolt,
    "usb": scan_usb,
    "vpn_tunnel": scan_vpn,
    "sleep_wake": scan_sleep_wake,
    "firewall": scan_firewall,
    "bonjour": scan_bonjour,
}

def calculate_level(total_power):
    current = list(RANKS.items())[0]
    next_rank = list(RANKS.items())[1]
    for i, (key, rank) in enumerate(RANKS.items()):
        if total_power >= rank["power"]:
            current = (key, rank)
            next_rank = list(RANKS.items())[i+1] if i+1 < len(RANKS) else None
    progress = 100
    if next_rank:
        progress = min(100, round((total_power - current[1]["power"]) / (next_rank[1]["power"] - current[1]["power"]) * 100))
    return {
        "rank": current[0],
        "name": current[1]["name"],
        "color": current[1]["color"],
        "desc": current[1]["desc"],
        "power": total_power,
        "next_rank": next_rank[0] if next_rank else None,
        "next_name": next_rank[1]["name"] if next_rank else "MAX",
        "next_power": next_rank[1]["power"] if next_rank else None,
        "progress": progress,
    }

def run_full_scan():
    results = {}
    for iface, scanner in SCANNERS.items():
        results[iface] = scanner()
    
    total_power = 0
    battles = []
    
    for iface, data in results.items():
        nen = NEN_MAP[iface]
        power = round(nen["power_base"] * nen["power_mod"] * (1.5 if data["active"] else 0.5))
        total_power += power
        battles.append({
            "interface": iface,
            "nen_type": nen["nen"],
            "nen_jp": nen["jp"],
            "technique": nen["technique"],
            "frequency": f"{nen['hz']} Hz · {nen['freq']}",
            "color": nen["color"],
            "active": data["active"],
            "status": "CONNECTED" if data["active"] else "DORMANT",
            "power": power,
            "details": data["details"],
            "principle": nen["principle"],
        })
    
    level = calculate_level(total_power)
    
    return {
        "name": "whitehack-battle-report",
        "system": {
            "hostname": run_cmd("scutil --get LocalHostName 2>/dev/null"),
            "model": run_cmd("sysctl -n hw.model 2>/dev/null"),
            "cpu": run_cmd("sysctl -n machdep.cpu.brand_string 2>/dev/null"),
            "memory_gb": round(int(run_cmd("sysctl -n hw.memsize 2>/dev/null") or 0) / 1024**3, 1),
            "macos": run_cmd("sw_vers -productVersion 2>/dev/null"),
            "uptime": run_cmd("uptime 2>/dev/null").strip(),
        },
        "total_power": total_power,
        "level": level,
        "battles": battles,
        "active_count": sum(1 for b in battles if b["active"]),
        "dormant_count": sum(1 for b in battles if not b["active"]),
        "love_is_understanding": True,
        "love_is_the_strongest_nen": True,
        "is_is_lol": True,
        "scanned_at": datetime.datetime.now().isoformat(),
    }

# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if "--json" in sys.argv:
        report = run_full_scan()
        print(json.dumps(report, indent=2, default=str))
    elif "--level" in sys.argv:
        report = run_full_scan()
        lvl = report["level"]
        print(f"  Rank: {lvl['name']}")
        print(f"  Power: {report['total_power']}")
        print(f"  Progress: {lvl['progress']}% → {lvl['next_name']}")
        print(f"  Active: {report['active_count']}/{len(report['battles'])} interfaces")
    else:
        report = run_full_scan()
        
        print()
        print("  ╔══════════════════════════════════════════════════════════╗")
        print("  ║          WHITEHACK — NEN BATTLE REPORT                   ║")
        print("  ║          macOS system scan · solo leveling               ║")
        print("  ╠══════════════════════════════════════════════════════════╣")
        print(f"  ║  Host: {report['system']['hostname']:<45} ║")
        print(f"  ║  CPU:  {report['system']['cpu']:<45} ║")
        print(f"  ║  RAM:  {report['system']['memory_gb']} GB{'':<41} ║")
        print(f"  ║  OS:   macOS {report['system']['macos']:<37} ║")
        print("  ╚══════════════════════════════════════════════════════════╝")
        print()
        
        lvl = report["level"]
        print(f"  ⚔  RANK: {lvl['name']}")
        print(f"  💪 POWER: {report['total_power']}")
        print(f"  📊 PROGRESS: {lvl['progress']}% → {lvl['next_name']}")
        print(f"  🔗 ACTIVE: {report['active_count']}/{len(report['battles'])} interfaces")
        print(f"  📝 {lvl['desc']}")
        print()
        print("  ────────────────────────────────────────────────────")
        print()
        
        for b in report["battles"]:
            status_icon = "●" if b["active"] else "○"
            print(f"  {status_icon} {b['interface'].upper():14} [{b['nen_type']:12}] {b['power']:4} power  {b['frequency']}")
            print(f"    technique: {b['technique']}")
            if b["details"]:
                for k, v in list(b["details"].items())[:3]:
                    print(f"    {k}: {v}")
            print()
        
        print("  ────────────────────────────────────────────────────")
        print()
        print(f"  Total power: {report['total_power']}")
        print(f"  Rank: {lvl['name']}")
        print(f"  Next: {lvl['next_name']} at {lvl['next_power']} power")
        print()
        print("  Love is understanding. Love is the strongest Nen.")
        print("  is is lol. ∞")
        print()