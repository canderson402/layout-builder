interface DiscoveredTV {
  id: string;
  name: string;
  ip: string;
  port: number;
  service: string;
}

class TVDiscoveryService {
  private discoveredTVs: DiscoveredTV[] = [];
  private isScanning: boolean = false;
  private listeners: ((tvs: DiscoveredTV[]) => void)[] = [];
  private autoSelectCallbacks: ((tv: DiscoveredTV) => void)[] = [];

  async discoverTVs(): Promise<DiscoveredTV[]> {
    if (this.isScanning) {
      return this.discoveredTVs;
    }

    this.isScanning = true;
    this.discoveredTVs = [];
    
    console.log('🔍 Starting mDNS TV discovery for _svtv._tcp services...');
    
    try {
      // Use mDNS discovery - this requires the browser to support it
      // or a service worker/extension
      await this.performMDNSDiscovery();
      
    } catch (error) {
      console.error('mDNS TV discovery error:', error);
      console.warn('💡 Web browsers have limited mDNS support. Use addTV("IP", "Name") in console to manually add your TV.');
    } finally {
      this.isScanning = false;
      console.log(`✅ mDNS discovery complete. Found ${this.discoveredTVs.length} devices.`);
    }

    this.notifyListeners();
    return this.discoveredTVs;
  }

  private async performMDNSDiscovery(): Promise<void> {
    console.log('🔍 Starting WebRTC-based mDNS discovery for _svtv._tcp services...');
    
    try {
      // Use WebRTC to discover local network devices
      await this.discoverViaWebRTC();
      
      // Also try multicast DNS queries if supported
      await this.tryMulticastDNS();
      
    } catch (error) {
      console.warn('WebRTC discovery failed:', error);
    }
  }

  private async discoverViaWebRTC(): Promise<void> {
    return new Promise((resolve) => {
      // Create RTCPeerConnection to discover local network interfaces
      const pc = new RTCPeerConnection({
        iceServers: [] // No STUN servers - we want local discovery only
      });

      const discoveredIPs = new Set<string>();

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          console.log('ICE candidate:', candidate);
          
          // Extract IP addresses from candidates
          const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
          if (ipMatch) {
            const ip = ipMatch[1];
            if (!ip.startsWith('127.') && !discoveredIPs.has(ip)) {
              discoveredIPs.add(ip);
              this.checkNetworkForTVs(ip);
            }
          }
        } else {
          // ICE gathering complete
          console.log(`🔍 Found ${discoveredIPs.size} local network interfaces`);
          resolve();
        }
      };

      // Create a data channel to trigger ICE gathering
      pc.createDataChannel('discovery');
      
      // Create offer to start ICE gathering
      pc.createOffer().then(offer => {
        return pc.setLocalDescription(offer);
      }).catch(error => {
        console.warn('WebRTC offer creation failed:', error);
        resolve();
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        pc.close();
        resolve();
      }, 5000);
    });
  }

  private async checkNetworkForTVs(localIP: string): Promise<void> {
    // Extract subnet from local IP and scan it + neighboring subnets
    const ipParts = localIP.split('.');
    if (ipParts.length === 4) {
      const baseSubnet = `${ipParts[0]}.${ipParts[1]}`;
      const currentSubnetNum = parseInt(ipParts[2]);
      
      // Scan current subnet and neighboring ones
      const subnetsToScan = [
        currentSubnetNum,           // Current subnet (e.g., 31)
        currentSubnetNum - 1,       // Previous subnet (e.g., 30)
        currentSubnetNum + 1,       // Next subnet (e.g., 32)
      ].filter(num => num >= 0 && num <= 255);
      
      // Check common device IPs on these subnets
      const commonOffsets = [1, 2, 100, 101, 200, 201, 234, 235, 254];
      
      for (const subnetNum of subnetsToScan) {
        const subnet = `${baseSubnet}.${subnetNum}`;
        console.log(`🔍 Scanning subnet ${subnet}.x for TVs...`);
        
        for (const offset of commonOffsets) {
          const testIP = `${subnet}.${offset}`;
          if (testIP !== localIP) { // Don't test our own IP
            this.testTVAtIP(testIP);
          }
        }
      }
    }
  }

  private async testTVAtIP(ip: string): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      // Try to connect to the TV's layout endpoint
      const response = await fetch(`http://${ip}:3080/layout`, {
        method: 'OPTIONS',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status < 500) { // Any response means TV is there
        // Try to get the actual device name
        let deviceName = await this.getDeviceName(ip);
        if (!deviceName) {
          // Use hostname heuristics as fallback
          const fallbackName = await this.getHostname(ip);
          deviceName = fallbackName || `TV Display (${ip})`;
        }
        
        const tv: DiscoveredTV = {
          id: `tv_${ip.replace(/\./g, '_')}_${Date.now()}`,
          name: deviceName,
          ip: ip,
          port: 3080,
          service: '_svtv._tcp'
        };

        // Check if already discovered
        if (!this.discoveredTVs.find(existing => existing.ip === ip)) {
          this.discoveredTVs.push(tv);
          console.log(`📺 Discovered ScoreVision TV at ${ip}`);
          this.notifyListeners();
          
          // If this is the first TV found, auto-select it
          if (this.discoveredTVs.length === 1) {
            this.selectFirstTV();
          }
        }
      }
    } catch (error) {
      // Silently ignore - device not found or not a TV
    }
  }

  private async getDeviceName(ip: string): Promise<string | null> {
    try {
      // Try to get device info from the TV's info endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      // First try the info endpoint which might return device details
      const infoResponse = await fetch(`http://${ip}:3080/info`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (infoResponse.ok) {
        const infoText = await infoResponse.text();
        try {
          const infoData = JSON.parse(infoText);
          if (infoData.deviceName) {
            return infoData.deviceName;
          }
          if (infoData.name) {
            return infoData.name;
          }
        } catch (parseError) {
          // If not JSON, look for device name patterns in HTML/text
          const deviceNameMatch = infoText.match(/<title>([^<]+)<\/title>/i) || 
                                  infoText.match(/device[_\s]*name[:\s]*["']?([^"'\n]+)/i) ||
                                  infoText.match(/Apple TV|ScoreVision|Display/i);
          if (deviceNameMatch && deviceNameMatch[1]) {
            return deviceNameMatch[1].trim();
          } else if (deviceNameMatch && deviceNameMatch[0]) {
            return deviceNameMatch[0].trim();
          }
        }
      }
    } catch (error) {
      // Try fallback method
    }

    try {
      // Fallback: Try root endpoint for device information
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(`http://${ip}:3080/`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        
        // Look for common device name patterns in the response
        const patterns = [
          /<title>([^<]+)<\/title>/i,
          /device[_\s]*name[:\s]*["']?([^"'\n]+)/i,
          /hostname[:\s]*["']?([^"'\n]+)/i,
          /(Apple TV|ScoreVision|Display[^<\n]*)/i
        ];
        
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            let deviceName = match[1].trim();
            // Clean up common artifacts
            deviceName = deviceName.replace(/\s*-\s*\d+\.\d+\.\d+\.\d+/, ''); // Remove IP suffix
            deviceName = deviceName.replace(/\s*\([^)]+\)$/, ''); // Remove parenthetical info
            if (deviceName.length > 0 && deviceName.length < 50) {
              return deviceName;
            }
          } else if (match && match[0] && !match[1]) {
            return match[0].trim();
          }
        }
      }
    } catch (error) {
      // Continue to hostname lookup
    }

    // Try to infer device type from network behavior or use mDNS if available
    try {
      const hostname = await this.getHostname(ip);
      if (hostname && hostname !== 'Apple TV') {
        return hostname;
      }
    } catch (error) {
      // Hostname lookup failed
    }

    return null;
  }

  private async getHostname(ip: string): Promise<string | null> {
    // Browser limitation: we can't do reverse DNS lookup directly
    // But we can try some heuristics based on the network and device behavior
    
    try {
      // Try to determine device type based on HTTP headers or response patterns
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const headResponse = await fetch(`http://${ip}:3080/layout`, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (headResponse.ok) {
        // Check for server headers that might indicate device type
        const server = headResponse.headers.get('server') || '';
        const userAgent = headResponse.headers.get('user-agent') || '';
        const xPoweredBy = headResponse.headers.get('x-powered-by') || '';
        
        if (server.toLowerCase().includes('apple') || userAgent.toLowerCase().includes('apple')) {
          return 'Apple TV';
        }
        if (server.toLowerCase().includes('scorevision') || xPoweredBy.toLowerCase().includes('scorevision')) {
          return 'ScoreVision Display';
        }
        if (server.toLowerCase().includes('tv') || server.toLowerCase().includes('display')) {
          return 'TV Display';
        }
      }
    } catch (error) {
      // Headers check failed
    }

    // Fallback based on common device types that run ScoreVision
    // Since the service is _svtv._tcp, this is likely either Apple TV or a dedicated display
    const ipParts = ip.split('.');
    if (ipParts.length === 4) {
      const lastOctet = parseInt(ipParts[3]);
      // Apple TVs often get assigned certain IP ranges by routers
      if (lastOctet >= 200 && lastOctet <= 254) {
        return 'Apple TV';
      }
    }

    // Default fallback
    return 'TV Display';
  }

  private async tryMulticastDNS(): Promise<void> {
    // This is limited in browsers, but we can try using fetch with multicast addresses
    console.log('🔍 Attempting multicast DNS queries...');
    
    try {
      // Try to query multicast DNS (limited success in browsers)
      const mdnsQuery = new URL('http://224.0.0.251:5353');
      // Note: This will likely fail due to browser restrictions, but worth trying
      
    } catch (error) {
      console.log('Multicast DNS not available in browser environment');
    }
  }

  // Alternative method: Try to get device info from a successful connection
  async getTVInfo(ip: string): Promise<DiscoveredTV | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Try a simple GET request to see if we can identify the device
      const response = await fetch(`http://${ip}:3080/`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Try to get the actual device name
        let deviceName = await this.getDeviceName(ip);
        if (!deviceName) {
          const fallbackName = await this.getHostname(ip);
          deviceName = fallbackName || `TV Display (${ip})`;
        }
        
        return {
          id: `tv_${ip.replace(/\./g, '_')}_${Date.now()}`,
          name: deviceName,
          ip: ip,
          port: 3080,
          service: '_svtv._tcp'
        };
      }
    } catch (error) {
      // Device not found
    }
    
    return null;
  }

  subscribe(callback: (tvs: DiscoveredTV[]) => void): void {
    this.listeners.push(callback);
  }

  unsubscribe(callback: (tvs: DiscoveredTV[]) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  onAutoSelect(callback: (tv: DiscoveredTV) => void): void {
    this.autoSelectCallbacks.push(callback);
  }

  offAutoSelect(callback: (tv: DiscoveredTV) => void): void {
    const index = this.autoSelectCallbacks.indexOf(callback);
    if (index > -1) {
      this.autoSelectCallbacks.splice(index, 1);
    }
  }

  private selectFirstTV(): void {
    if (this.discoveredTVs.length > 0) {
      const firstTV = this.discoveredTVs[0];
      console.log(`🎯 Auto-selecting first discovered TV: ${firstTV.name}`);
      this.autoSelectCallbacks.forEach(callback => callback(firstTV));
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback([...this.discoveredTVs]));
  }

  getDiscoveredTVs(): DiscoveredTV[] {
    return [...this.discoveredTVs];
  }

  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  // Manual add for testing or when auto-discovery fails
  addManualTV(name: string, ip: string): void {
    const existing = this.discoveredTVs.find(tv => tv.ip === ip);
    if (!existing) {
      this.discoveredTVs.push({
        id: `tv_manual_${ip.replace(/\./g, '_')}_${Date.now()}`,
        name: name || `TV Display (${ip})`,
        ip,
        port: 3080,
        service: '_svtv._tcp'
      });
      this.notifyListeners();
      console.log(`📺 Manually added TV: ${name || ip}`);
    }
  }

  // Verify TV is still reachable
  async verifyTV(ip: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`http://${ip}:3080/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.status < 500; // Any response means TV is there
    } catch (error) {
      return false;
    }
  }
}

export const tvDiscoveryService = new TVDiscoveryService();
export type { DiscoveredTV };