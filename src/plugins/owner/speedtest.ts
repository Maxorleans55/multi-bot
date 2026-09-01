import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import http from 'http';
import type { CommandModule } from '../../types/index.js';
import { WAMessage } from '@whiskeysockets/baileys';

const execAsync = promisify(exec);

/**
 * Parse Windows ping output to extract latency statistics.
 */
function parseWindowsPing(stdout: string): { min: number; max: number; avg: number; loss: number } | null {
    // Match: "Minimum = Xms, Maximum = Xms, Average = Xms"
    const rttMatch = stdout.match(/Minimum\s*=\s*(\d+)ms.*Maximum\s*=\s*(\d+)ms.*Average\s*=\s*(\d+)ms/i);
    // Match: "Lost = X (Y% loss)"
    const lossMatch = stdout.match(/Lost\s*=\s*(\d+)\s*\((\d+)%?\s*loss\)/i);

    if (rttMatch) {
        return {
            min: parseInt(rttMatch[1], 10),
            max: parseInt(rttMatch[2], 10),
            avg: parseInt(rttMatch[3], 10),
            loss: lossMatch ? parseInt(lossMatch[2], 10) : 0,
        };
    }

    // Try alternate format: "time=Xms" lines
    const timeMatches = [...stdout.matchAll(/time[=<](\d+)ms/gi)];
    if (timeMatches.length > 0) {
        const times = timeMatches.map(m => parseInt(m[1], 10));
        const min = Math.min(...times);
        const max = Math.max(...times);
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        return {
            min,
            max,
            avg,
            loss: lossMatch ? parseInt(lossMatch[2], 10) : 0,
        };
    }

    return null;
}

/**
 * Run ping test to a host and return latency statistics.
 */
async function testLatency(host: string = '8.8.8.8'): Promise<{
    host: string;
    status: 'success' | 'error';
    min?: number;
    max?: number;
    avg?: number;
    loss?: number;
    error?: string;
}> {
    try {
        // Windows: ping -n 4, Linux/Mac: ping -c 4
        const isWindows = process.platform === 'win32';
        const flag = isWindows ? '-n' : '-c';
        const { stdout, stderr } = await execAsync(`ping ${flag} 4 ${host}`, { timeout: 20000 });

        if (stderr) {
            return { host, status: 'error', error: stderr.trim() };
        }

        const parsed = parseWindowsPing(stdout);
        if (parsed) {
            return {
                host,
                status: 'success',
                min: parsed.min,
                max: parsed.max,
                avg: parsed.avg,
                loss: parsed.loss,
            };
        }

        return { host, status: 'error', error: 'Could not parse ping output' };
    } catch (error: any) {
        return { host, status: 'error', error: error.message || 'Ping failed' };
    }
}

/**
 * Download a file from a URL and measure speed.
 * Returns bytes downloaded and time in ms.
 */
function downloadFile(url: string, timeout = 25000): Promise<{ bytes: number; durationMs: number; error?: string }> {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.get(
            url,
            {
                timeout,
                headers: {
                    'Accept-Encoding': 'identity', // Disable compression to measure raw throughput
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            },
            (res) => {
                let totalBytes = 0;

                res.on('data', (chunk: Buffer) => {
                    totalBytes += chunk.length;
                });

                res.on('end', () => {
                    const durationMs = Date.now() - startTime;
                    if (totalBytes === 0) {
                        resolve({ bytes: 0, durationMs, error: 'No data received' });
                    } else {
                        resolve({ bytes: totalBytes, durationMs });
                    }
                });

                res.on('error', (err) => {
                    resolve({ bytes: totalBytes, durationMs: Date.now() - startTime, error: err.message });
                });
            }
        );

        req.on('timeout', () => {
            req.destroy();
            resolve({ bytes: 0, durationMs: Date.now() - startTime, error: 'Connection timeout' });
        });

        req.on('error', (err) => {
            resolve({ bytes: 0, durationMs: Date.now() - startTime, error: err.message });
        });
    });
}

/**
 * Get public IP address and ISP info.
 */
async function getPublicIpInfo(): Promise<{ ip: string; country?: string; org?: string }> {
    try {
        const data = await new Promise<string>((resolve, reject) => {
            const req = https.get(
                'https://ipapi.co/json/',
                { timeout: 10000 },
                (res) => {
                    let body = '';
                    res.on('data', (chunk) => (body += chunk));
                    res.on('end', () => resolve(body));
                    res.on('error', reject);
                }
            );
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            req.on('error', reject);
        });

        const info = JSON.parse(data);
        return {
            ip: info.ip || 'Unknown',
            country: info.country_name || undefined,
            org: info.org || info.isp || undefined,
        };
    } catch {
        // Fallback to simpler API
        try {
            const data = await new Promise<string>((resolve, reject) => {
                const req = https.get(
                    'https://api.ipify.org?format=json',
                    { timeout: 10000 },
                    (res) => {
                        let body = '';
                        res.on('data', (chunk) => (body += chunk));
                        res.on('end', () => resolve(body));
                        res.on('error', reject);
                    }
                );
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                req.on('error', reject);
            });
            const info = JSON.parse(data);
            return { ip: info.ip || 'Unknown' };
        } catch {
            return { ip: 'Could not determine' };
        }
    }
}

/**
 * Format speed in human-readable form.
 */
function formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond >= 1_000_000_000) {
        return `${(bytesPerSecond / 1_000_000_000).toFixed(2)} GB/s`;
    } else if (bytesPerSecond >= 1_000_000) {
        return `${(bytesPerSecond / 1_000_000).toFixed(2)} MB/s`;
    } else if (bytesPerSecond >= 1_000) {
        return `${(bytesPerSecond / 1_000).toFixed(2)} KB/s`;
    } else {
        return `${bytesPerSecond.toFixed(2)} B/s`;
    }
}

function formatMbps(bytesPerSecond: number): string {
    const bitsPerSecond = bytesPerSecond * 8;
    if (bitsPerSecond >= 1_000_000_000) {
        return `${(bitsPerSecond / 1_000_000_000).toFixed(2)} Gbps`;
    } else if (bitsPerSecond >= 1_000_000) {
        return `${(bitsPerSecond / 1_000_000).toFixed(2)} Mbps`;
    } else if (bitsPerSecond >= 1_000) {
        return `${(bitsPerSecond / 1_000).toFixed(2)} Kbps`;
    } else {
        return `${bitsPerSecond.toFixed(2)} bps`;
    }
}

const speedtestCommand: CommandModule = {
    config: {
        name: 'speedtest',
        aliases: ['speed', 'net', 'networktest', 'nettest'],
        description: 'Test network speed, latency, and connection info (owner only)',
        usage: '!speedtest\n!speedtest --simple (quick test without download)',
        category: 'owner',
        ownerOnly: true,
    },
    handler: async function (context, args: string[]): Promise<void> {
        const fromJid = context.fromJid;
        const socket = context.socket;
        const isSimple = args.includes('--simple') || args.includes('-s');
        const isPingOnly = args.includes('--ping') || args.includes('-p');

        // Initial status message
        await socket.sendMessage(fromJid, {
            text: '🔄 *Speed Test Started...*\n\nRunning network diagnostics, please wait...',
        });

        // Collect all results
        const results: string[] = [];
        results.push('━━━━━━━━━━━━━━━━━━━━━');
        results.push('🌐 *NETWORK SPEED TEST*');
        results.push('━━━━━━━━━━━━━━━━━━━━━');

        // 1. Latency test (always)
        await socket.sendMessage(fromJid, {
            text: '📡 Testing latency...',
        });
        const latencyResult = await testLatency('8.8.8.8');
        results.push('');
        results.push('📡 *LATENCY*');
        if (latencyResult.status === 'success') {
            results.push(`   Ping to ${latencyResult.host}`);
            results.push(`   ┌─ Min: ${latencyResult.min}ms`);
            results.push(`   ├─ Max: ${latencyResult.max}ms`);
            results.push(`   ├─ Avg: ${latencyResult.avg}ms`);
            results.push(`   └─ Packet Loss: ${latencyResult.loss}%`);

            // Second ping to a closer/more relevant host
            const latencyResult2 = await testLatency('google.com');
            if (latencyResult2.status === 'success') {
                results.push(`   Ping to google.com`);
                results.push(`   ┌─ Min: ${latencyResult2.min}ms`);
                results.push(`   ├─ Max: ${latencyResult2.max}ms`);
                results.push(`   └─ Avg: ${latencyResult2.avg}ms`);
            }
        } else {
            results.push(`   ❌ ${latencyResult.error || 'Failed'}`);
        }

        // 2. DNS resolution test
        results.push('');
        results.push('🔍 *DNS RESOLUTION*');
        try {
            const { stdout: dnsStdout } = await execAsync('nslookup google.com 8.8.8.8', { timeout: 10000 });
            const addrMatch = dnsStdout.match(/Address:\s+([\d.]+)/);
            if (addrMatch) {
                results.push(`   google.com → ${addrMatch[1]}`);
                results.push('   DNS Server: 8.8.8.8 ✅');
            } else {
                results.push('   DNS resolution completed');
            }
        } catch {
            results.push('   ⚠️ DNS test skipped');
        }

        // 3. Download speed test (skip if --ping only)
        if (!isPingOnly) {
            results.push('');
            results.push('⬇️ *DOWNLOAD SPEED*');

            // Try multiple test file sources
            const testFiles = [
                { url: 'https://speed.cloudflare.com/__down?bytes=5000000', label: 'Cloudflare (5MB)' },
                { url: 'https://speed.cloudflare.com/__down?bytes=10000000', label: 'Cloudflare (10MB)' }
            ];

            // Add HTTP options as fallbacks
            if (isSimple) {
                // Simple mode: use smaller file
                testFiles.push({ url: 'http://speedtest.tele2.net/1MB.zip', label: 'Tele2 (1MB)' });
            } else {
                testFiles.push({ url: 'http://speedtest.tele2.net/5MB.zip', label: 'Tele2 (5MB)' });
            }

            let downloadSuccess = false;
            for (const testFile of testFiles) {
                if (downloadSuccess) break;
                const index = testFiles.indexOf(testFile) + 1;

                let totalTest: WAMessage | undefined;
                if (index === 1) {
                    totalTest = await socket.sendMessage(fromJid, {
                        text: `🔄 Testing download from ${testFile.label}...`,
                    });
                } else {
                    await socket.sendMessage(fromJid, {
                        text: `🔄 Testing download from ${testFile.label}...`,
                        edit: totalTest
                    });
                }

                const dlResult = await downloadFile(testFile.url, 30000);

                if (dlResult.error || dlResult.bytes === 0) {
                    results.push(`   ⚠️ ${testFile.label}: ${dlResult.error || 'Failed'}`);
                    continue;
                }

                const durationSec = dlResult.durationMs / 1000;
                const bytesPerSecond = dlResult.bytes / durationSec;

                results.push(`   Source: ${testFile.label}`);
                results.push(`   ┌─ File Size: ${(dlResult.bytes / 1_000_000).toFixed(2)} MB`);
                results.push(`   ├─ Time: ${durationSec.toFixed(1)}s`);
                results.push(`   ├─ Speed: ${formatSpeed(bytesPerSecond)}`);
                results.push(`   └─ Bandwidth: ${formatMbps(bytesPerSecond)}`);
                if (testFiles.length === index) {
                    downloadSuccess = true;
                }
            }

            if (!downloadSuccess) {
                results.push('   ❌ All download tests failed');
            }
        }

        // 4. Public IP info
        results.push('');
        results.push('🌍 *PUBLIC IP INFO*');
        await socket.sendMessage(fromJid, {
            text: '🌍 Fetching public IP info...',
        });
        const ipInfo = await getPublicIpInfo();
        results.push(`   IP: ${ipInfo.ip}`);
        if (ipInfo.country) results.push(`   Country: ${ipInfo.country}`);
        if (ipInfo.org) results.push(`   ISP: ${ipInfo.org}`);

        // 5. Local network info (basic)
        results.push('');
        results.push('💻 *LOCAL NETWORK*');
        try {
            const { stdout: ipconfigStdout } = await execAsync('ipconfig', { timeout: 10000 });
            const ipMatch = ipconfigStdout.match(/IPv4 Address[^:]*:\s*([\d.]+)/);
            if (ipMatch) {
                results.push(`   Local IP: ${ipMatch[1]}`);
            }
        } catch {
            // Non-Windows or failed
        }

        // Summary rating based on latency
        results.push('');
        results.push('━━━━━━━━━━━━━━━━━━━━━');
        if (latencyResult.status === 'success' && latencyResult.avg !== undefined) {
            let rating: string;
            if (latencyResult.avg <= 10) rating = '🌟 Excellent';
            else if (latencyResult.avg <= 30) rating = '✅ Good';
            else if (latencyResult.avg <= 60) rating = '⚠️ Fair';
            else if (latencyResult.avg <= 120) rating = '⚠️ Poor';
            else rating = '❌ Very Poor';

            results.push(`📊 *Rating: ${rating}*`);
        }
        results.push('━━━━━━━━━━━━━━━━━━━━━');

        // Send the final report
        await socket.sendMessage(fromJid, {
            text: results.join('\n'),
        });
    },
};

export default speedtestCommand;
