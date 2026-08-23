import { describe, expect, it } from "vitest";
import {
  assertPublicHost,
  classifyUrl,
  extractRepoTarget,
  parseIpv4,
  sanitizeRepoSegment,
} from "./url-guard";

const ok = (raw: string) => {
  const result = classifyUrl(raw);
  expect(result.ok, `${raw} should be allowed (${result.ok ? "" : result.reason})`).toBe(true);
};
const blocked = (raw: string) => {
  const result = classifyUrl(raw);
  expect(!result.ok, `${raw} should be blocked`).toBe(true);
};

describe("parseIpv4", () => {
  it("parses dotted decimal", () => {
    expect(parseIpv4("93.184.216.34")).toBe(0x5db8d822);
  });

  it("applies WHATWG short-form weights (last part spans low bits)", () => {
    expect(parseIpv4("127.1")).toBe(2130706433); // 127.0.0.1
    expect(parseIpv4("1.2.3")).toBe(16908291); // 1.2.0.3
  });

  it("parses bare decimal, hex and octal encodings", () => {
    expect(parseIpv4("2130706433")).toBe(2130706433); // 127.0.0.1
    expect(parseIpv4("0x7f000001")).toBe(2130706433);
    expect(parseIpv4("0177.0.0.1")).toBe(2130706433);
  });

  it("rejects invalid shapes", () => {
    for (const bad of ["999.999.999.999", "", "abc", "1.2.3.4.5", "1..2", "256.1.1.1"]) {
      expect(parseIpv4(bad), bad).toBeNull();
    }
  });
});

describe("classifyUrl — allows legitimate public URLs", () => {
  it("allows normal sites", () => {
    ok("https://github.com/torvalds/linux");
    ok("http://example.com/page?q=1");
  });

  it("allows public IP literals (v4 + v6)", () => {
    ok("https://93.184.216.34/");
    ok("https://[2606:2800:220:1:248:1893:25c8:1946]/");
  });

  it("does not over-block 172.x or 100.x publics (audit regression)", () => {
    ok("https://172.32.0.1/"); // outside 172.16/12
    ok("https://172.15.255.255/"); // below 172.16/12
    ok("https://100.40.1.1/"); // outside CGNAT 100.64/10
  });

  it("allows ordinary web ports only", () => {
    ok("http://example.com/");
    ok("http://example.com:80/");
    ok("https://example.com:443/");
    ok("http://example.com:8080/");
    ok("https://example.com:8443/");
  });
});

describe("classifyUrl — blocks SSRF targets", () => {
  it("blocks non-http(s) schemes", () => {
    blocked("ftp://example.com/file");
    blocked("javascript:alert(1)");
    blocked("file:///etc/passwd");
  });

  it("blocks localhost-style hostnames", () => {
    for (const raw of [
      "http://localhost/",
      "http://LOCALHOST:80/",
      "http://sub.localhost/",
      "http://box.local/",
      "http://app.internal/",
      "http://metadata.google.internal/",
      "http://foo.home.arpa/",
    ]) {
      blocked(raw);
    }
  });

  it("blocks private/reserved IPv4 ranges", () => {
    for (const raw of [
      "http://127.0.0.1/",
      "http://127.10.20.30/",
      "http://0.0.0.0/",
      "http://0.1.2.3/",
      "http://10.1.2.3/",
      "http://192.168.1.1/",
      "http://172.16.0.1/",
      "http://172.31.255.254/",
      "http://169.254.169.254/latest/meta-data/", // cloud metadata
      "http://100.64.1.1/", // CGNAT
      "http://100.100.100.100/",
      "http://192.0.2.1/", // TEST-NET-1
      "http://198.51.100.5/", // TEST-NET-2
      "http://203.0.113.9/", // TEST-NET-3
      "http://198.18.0.1/", // benchmarking
      "http://224.0.0.1/", // multicast
      "http://255.255.255.255/", // broadcast
    ]) {
      blocked(raw);
    }
  });

  it("blocks unusual IPv4 encodings that encode loopback", () => {
    blocked("http://2130706433/"); // decimal int
    blocked("http://0x7f000001/"); // hex
    blocked("http://0177.0.0.1/"); // octal
    blocked("http://127.1/"); // short form
  });

  it("blocks invalid IP-shaped hostnames rather than guessing", () => {
    blocked("http://999.999.999.999/");
  });

  it("blocks private/tunnelled IPv6 targets", () => {
    for (const raw of [
      "http://[::1]/",
      "http://[::]/",
      "http://[fc00::1]/",
      "http://[fd12::1]/",
      "http://[fe80::1]/",
      "http://[ff02::1]/",
      "http://[::ffff:127.0.0.1]/", // v4-mapped loopback
      "http://[::ffff:a00:1]/", // v4-mapped 10.0.0.1
      "http://[64:ff9b::127.0.0.1]/", // NAT64 to loopback
      "http://[2002:7f00:1::]/", // 6to4 embedding loopback
      "http://[2001:0000:4136:e378:8000:63bf:3fff:fdd2]/", // Teredo
    ]) {
      blocked(raw);
    }
  });

  it("blocks embedded credentials, odd ports and zone IDs", () => {
    blocked("http://user:pass@example.com/");
    blocked("http://example.com:22/");
    blocked("http://example.com:31337/");
    blocked("http://[fe80::1%25eth0]/"); // zone id smuggled via %25
  });

  it("blocks unparseable input", () => {
    blocked("not-a-url");
  });
});

describe("assertPublicHost", () => {
  const makeResolver = (addresses: string[] | Error) => {
    let calls = 0;
    const resolve = async (_hostname: string): Promise<string[]> => {
      calls += 1;
      if (addresses instanceof Error) throw addresses;
      return addresses;
    };
    return { resolve, getCalls: () => calls };
  };

  it("requires every resolved address to be public", async () => {
    const { resolve } = makeResolver(["93.184.216.34"]);
    const result = await assertPublicHost("https://example.com/", resolve);
    expect(result.ok).toBe(true);
  });

  it("blocks when any address is private (IPv4)", async () => {
    const { resolve } = makeResolver(["93.184.216.34", "10.0.0.5"]);
    const result = await assertPublicHost("https://example.com/", resolve);
    expect(!result.ok && result.reason.startsWith("private-resolution")).toBe(true);
  });

  it("blocks when the AAAA record is link-local (IPv6)", async () => {
    const { resolve } = makeResolver(["fe80::1"]);
    const result = await assertPublicHost("https://example.com/", resolve);
    expect(!result.ok && result.reason.startsWith("private-resolution")).toBe(true);
  });

  it("fails closed on resolver errors and empty answers", async () => {
    const throwing = makeResolver(new Error("dns down"));
    await expect(assertPublicHost("https://example.com/", throwing.resolve)).resolves.toEqual({
      ok: false,
      reason: "dns-resolution-failed",
    });

    const empty = makeResolver([]);
    await expect(assertPublicHost("https://example.com/", empty.resolve)).resolves.toEqual({
      ok: false,
      reason: "no-dns-addresses",
    });
  });

  it("never resolves literal IPs (already classified statically)", async () => {
    const { resolve, getCalls } = makeResolver(["127.0.0.1"]);
    await expect(assertPublicHost("https://93.184.216.34/", resolve)).resolves.toMatchObject({
      ok: true,
    });
    expect(getCalls()).toBe(0);

    const privateResult = await assertPublicHost("https://127.0.0.1/", resolve);
    expect(privateResult.ok).toBe(false);
  });

  it("skips the DNS phase when no resolver is available", async () => {
    await expect(assertPublicHost("https://example.com/", null)).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      assertPublicHost("http://169.254.169.254/", null), // static checks still apply
    ).resolves.toMatchObject({ ok: false });
  });
});

describe("sanitizeRepoSegment", () => {
  it("accepts ordinary names and strips .git case-insensitively", () => {
    expect(sanitizeRepoSegment("torvalds")).toBe("torvalds");
    expect(sanitizeRepoSegment("linux.git")).toBe("linux");
    expect(sanitizeRepoSegment("LINUX.GIT")).toBe("LINUX");
  });

  it("allows dotfiles like .github but rejects traversal segments", () => {
    expect(sanitizeRepoSegment(".github")).toBe(".github");
    expect(sanitizeRepoSegment(".")).toBeNull();
    expect(sanitizeRepoSegment("..")).toBeNull();
    expect(sanitizeRepoSegment("%2e%2e")).toBeNull(); // decodes to ".."
    expect(sanitizeRepoSegment("a%2Fb")).toBeNull(); // decodes to "a/b"
  });

  it("enforces the allowlist and length cap", () => {
    expect(sanitizeRepoSegment("")).toBeNull();
    expect(sanitizeRepoSegment("has space")).toBeNull();
    expect(sanitizeRepoSegment("%zz")).toBeNull(); // malformed encoding
    expect(sanitizeRepoSegment("a".repeat(101))).toBeNull();
    expect(sanitizeRepoSegment("a".repeat(100))).toBe("a".repeat(100));
  });
});

describe("extractRepoTarget", () => {
  it("matches supported forges on exact hostname", () => {
    expect(extractRepoTarget(new URL("https://github.com/torvalds/linux"))).toEqual({
      platform: "github",
      api: "https://api.github.com/repos/torvalds/linux",
    });
    expect(extractRepoTarget(new URL("https://www.github.com/torvalds/linux.git"))).toMatchObject({
      platform: "github",
    });
    expect(extractRepoTarget(new URL("https://gitlab.com/gitlab-org/gitlab"))).toMatchObject({
      platform: "gitlab",
    });
    expect(extractRepoTarget(new URL("https://codeberg.org/forgejo/forgejo"))).toMatchObject({
      platform: "codeberg",
    });
  });

  it("encodes nested GitLab groups as a single path", () => {
    expect(extractRepoTarget(new URL("https://gitlab.com/g/sub/p"))?.api).toBe(
      "https://gitlab.com/api/v4/projects/g%2Fsub%2Fp",
    );
  });

  it("ignores extra path segments beyond owner/repo", () => {
    expect(extractRepoTarget(new URL("https://github.com/torvalds/linux/tree/master"))).toEqual({
      platform: "github",
      api: "https://api.github.com/repos/torvalds/linux",
    });
  });

  it("never matches by substring (spoof resistance)", () => {
    expect(extractRepoTarget(new URL("https://evil.com/?x=github.com/a/b"))).toBeNull();
    expect(extractRepoTarget(new URL("https://evil.com/github.com/a/b"))).toBeNull();
    expect(extractRepoTarget(new URL("https://api.github.com/a/b"))).toBeNull();
    expect(extractRepoTarget(new URL("https://notgithub.com/a/b"))).toBeNull();
  });

  it("rejects malformed repo paths", () => {
    expect(extractRepoTarget(new URL("https://github.com/torvalds"))).toBeNull();
    expect(extractRepoTarget(new URL("https://github.com/a%2F..%2Fb/c"))).toBeNull();
    expect(extractRepoTarget(new URL("https://github.com/a%20b/c"))).toBeNull();
  });
});
