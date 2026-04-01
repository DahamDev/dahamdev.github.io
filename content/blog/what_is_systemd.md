---
title: "What is Systemd and How to Run a Systemd Service Securely"
date: 2025-04-17
draft: false
author: "Daham Navinda"
description: "Systemd is a system and service manager for Linux. Learn the basic concepts and how to create and run a secure systemd service step by step."
excerpt: "Systemd is a system and service manager for Linux operating systems. In this article I explain basic concepts of systemd and how to run a service securely with systemd."
tags: ["Systemd", "Linux", "Systemd Service"]
---

Systemd is a system and service manager for Linux operating systems. In this article I explain basic concepts of systemd and how to run a service securely with systemd.

## Why Do We Need Systemd?

- It starts programs in the right order
- It automatically restarts programs if they crash
- It can start programs when they're needed
- It keeps track of what's running and what's not
- It stores logs so you can check what happened

## Basic Systemd Concepts

### Units

Units are like recipe cards that tell systemd how to handle different programs. The most common type is a "service" unit, which ends with `.service`.

### States

Services can be:

- Running (active)
- Stopped (inactive)
- Failed (something went wrong)
- Enabled (starts at boot)
- Disabled (doesn't start at boot)

## Practical Example: Creating a Simple Service

Let's create a real example by making a simple bash script that writes the current time to a file every minute, and then run it as a service.

### Step 1: Create the Bash Script

```bash
# Create a directory for our script
mkdir -p /opt/myservice
cd /opt/myservice

# Create the script
vi time_writer.sh
```

Put this code in the script:

```bash
#!/bin/bash

while true; do
    # Get current time and write to file
    date "+Current time is: %Y-%m-%d %H:%M:%S" > /tmp/current_time.txt

    # Wait for 60 seconds
    sleep 60
done
```

### Step 2: Make the Script Executable

```bash
chmod +x time_writer.sh
```

### Step 3: Create a Secure User to Run Our Service

```bash
sudo useradd --no-create-home --shell /bin/false testuser
```

- `--no-create-home` — prevent from creating a home directory for the user
- `--shell /bin/false` — disable shell login for the user

Assign file ownership to the user:

```bash
sudo chown testuser:testuser /opt/myservice/time_writer.sh
```

### Step 4: Create the Service File

```bash
sudo vi /etc/systemd/system/timewriter.service
```

Add this content:

```ini
[Unit]
Description=Time Writer Service
After=network.target

[Service]
# The user that will run the script
User=testuser
# Where the script is located
WorkingDirectory=/opt/myservice
# The command to start the script
ExecStart=sh time_writer.sh
# Restart if it crashes
Restart=always
# Wait 3 seconds before restart
RestartSec=3

[Install]
# Start at boot
WantedBy=multi-user.target
```

### Step 5: Start and Enable the Service

```bash
# Reload systemd to see the new service
sudo systemctl daemon-reload

# Start the service
sudo systemctl start timewriter

# Enable it to start at boot
sudo systemctl enable timewriter
```

### Step 6: Check if Everything Works

```bash
# Check the service status
sudo systemctl status timewriter

# Look at the output file
cat /tmp/current_time.txt

# Check the logs
sudo journalctl -u timewriter
```

## Common Commands to Manage Services

```bash
# Start a service
sudo systemctl start service_name

# Stop a service
sudo systemctl stop service_name

# Restart a service
sudo systemctl restart service_name

# Enable service to start at boot
sudo systemctl enable service_name

# Disable service from starting at boot
sudo systemctl disable service_name

# Check service status
sudo systemctl status service_name
```

## Troubleshooting Tips

1. **If the service won't start:**
   - Check the logs: `sudo journalctl -u service_name`
   - Make sure paths are correct in the service file
   - Check if the user has proper permissions

2. **If the service keeps crashing:**
   - Look for errors in the logs
   - Make sure all dependencies are installed
   - Check if the working directory exists

3. **If the service won't enable:**
   - Make sure the `[Install]` section is present in the service file
   - Reload systemd: `sudo systemctl daemon-reload`

---

This example shows how to take a simple script and run it as a proper system service. Once you understand these basics, you can apply the same principles to more complex applications.

Remember: The beauty of systemd is that once you set it up correctly, it takes care of running and maintaining your services without you having to worry about them.
