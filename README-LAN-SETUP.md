# Local LAN Setup Instructions

This guide will help you configure your kanban app to be accessible on your local network (LAN) only, not exposed to the internet.

## Prerequisites

- macOS (M3 Air)
- Node.js backend
- Vite frontend
- Devices on the same Wi-Fi network

---

## Step 1: Find Your Local LAN IP Address

Open Terminal and run:

```bash
ipconfig getifaddr en0
```

You'll get something like:

```
192.168.1.42
```

**Write this down** - you'll need it to access the app from other devices.

---

## Step 2: Verify Server Configuration

The backend server is already configured to bind to `0.0.0.0` (all local interfaces), which allows LAN access. The configuration is in `server/index.ts`:

```typescript
httpServer.listen(port, "0.0.0.0", () => {
  log(`serving on port ${port}`);
});
```

The Vite dev server is also configured to bind to all interfaces in `vite.config.ts`:

```typescript
server: {
  host: true, // Binds to 0.0.0.0
  port: 5173,
}
```

**No changes needed** - this is already set up correctly.

---

## Step 3: Start the Development Server

Run the app as usual:

```bash
npm run dev
```

The server will start and be accessible on:
- **This machine**: `http://localhost:5000` (or whatever PORT is set)
- **Other devices on LAN**: `http://YOUR_LAN_IP:5000` (replace with your IP from Step 1)

---

## Step 4: Access from Other Devices

From any device on the same Wi-Fi network:

1. Open a web browser
2. Navigate to: `http://YOUR_LAN_IP:5000`
   - Replace `YOUR_LAN_IP` with the IP you found in Step 1
   - Example: `http://192.168.1.42:5000`

---

## Step 5: Enable macOS Firewall (Critical for Security)

1. Open **System Settings** (or System Preferences on older macOS)
2. Go to **Network** → **Firewall**
3. Turn the Firewall **ON**
4. Click **Options** (or **Firewall Options**)
5. Configure:
   - Allow incoming connections **only** for Node.js/your terminal
   - Block everything else by default

**Why this matters**: macOS firewall blocks incoming connections from the internet by default, but allows local network traffic. This ensures your app is only accessible on your LAN.

---

## Step 6: Verify Router Settings (Do NOT Skip)

**Critical**: Ensure your router is NOT forwarding ports to your machine.

1. Access your router's admin page (usually `192.168.1.1` or `192.168.0.1`)
2. Look for:
   - **Port Forwarding** section
   - **NAT** settings
   - **DMZ** settings
3. Verify:
   - ❌ **No port forwarding rules** for ports 5000, 5173, or any other ports
   - ❌ **DMZ is disabled** (or not pointing to your Mac)
   - ✅ **UPnP is disabled** (optional, but recommended)

**If there are no forwarding rules, your app cannot be accessed from the internet** - this is what you want.

---

## Step 7: Optional - Hard Bind to Specific IP (Extra Safety)

If you want to be extra cautious, you can bind directly to your LAN IP instead of `0.0.0.0`. This ensures the server only listens on your Wi-Fi interface.

**Note**: This is optional and not necessary if you've completed Steps 5 and 6.

To do this, edit `server/index.ts`:

```typescript
// Replace this line:
httpServer.listen(port, "0.0.0.0", () => {

// With (replace with your actual IP):
const LAN_IP = "192.168.1.42"; // Your IP from Step 1
httpServer.listen(port, LAN_IP, () => {
```

**However**, this is not recommended because:
- Your IP might change if you reconnect to Wi-Fi
- You'd need to update it each time
- `0.0.0.0` with firewall protection is sufficient

---

## Security Summary

Your app is safe from internet exposure **if and only if**:

✅ **No router port forwarding** (Step 6)  
✅ **Firewall enabled** (Step 5)  
✅ **Binding to LAN interface** (already configured)

This is the same approach used by:
- Home NAS devices
- Local development servers
- Smart home hubs

---

## Troubleshooting

### Can't access from other devices?

1. **Check IP address**: Make sure you're using the correct IP from `ipconfig getifaddr en0`
2. **Check firewall**: Temporarily disable firewall to test, then re-enable
3. **Check Wi-Fi**: Ensure all devices are on the same network
4. **Check port**: Verify the server is running on the expected port (default: 5000)

### Port already in use?

If port 5000 is in use, set a different port:

```bash
PORT=3000 npm run dev
```

Then access at `http://YOUR_LAN_IP:3000`

### IP address changed?

If your Mac gets a new IP address (after reconnecting to Wi-Fi), run `ipconfig getifaddr en0` again to get the new IP.

---

## Quick Checklist

- [ ] Found LAN IP with `ipconfig getifaddr en0`
- [ ] Server binds to `0.0.0.0` (already configured)
- [ ] Vite binds to all interfaces (already configured)
- [ ] macOS Firewall is ON
- [ ] No router port forwarding rules exist
- [ ] Can access from other devices on same Wi-Fi

---

## Production Build (Optional)

If you build for production, the frontend will be served as static files from the Express server, so you only need to expose one port (the backend port, default 5000).

```bash
npm run build
npm start
```

Access at `http://YOUR_LAN_IP:5000` from any device on your LAN.


