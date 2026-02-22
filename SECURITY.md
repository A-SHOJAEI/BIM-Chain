# Security Policy

## Supported Versions

The following table lists the versions of BIM-Chain that are currently receiving security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | Yes                |
| < 0.1   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, **please do NOT open a public GitHub issue.** Instead, report it privately by emailing:

**a.shojaei.k.k@gmail.com**

### What to Include in Your Report

- **Description**: A clear and concise description of the vulnerability, including which component is affected (chaincode, middleware, Fabric network configuration, etc.).
- **Steps to Reproduce**: Detailed, step-by-step instructions that allow us to reproduce the issue. Include any relevant configuration, payloads, or scripts.
- **Impact Assessment**: Your assessment of the potential impact, including what an attacker could achieve by exploiting this vulnerability (e.g., unauthorized data access, privilege escalation, denial of service).

### Response Timeline

- **Acknowledgment**: We will acknowledge receipt of your report within **48 hours**.
- **Assessment**: We will provide an initial assessment of the vulnerability, including severity and planned remediation steps, within **7 days**.
- **Resolution**: We aim to develop and release a fix as quickly as possible. The exact timeline depends on the complexity and severity of the issue, but we will keep you informed of progress throughout the process.

## What Constitutes a Security Issue

The following are examples of issues we consider to be security vulnerabilities:

- **Chaincode access control bypass** -- Any flaw that allows unauthorized invocation of chaincode functions or circumvention of access control logic defined in smart contracts.
- **Authentication or authorization flaws in middleware** -- Vulnerabilities in the API gateway, backend services, or any middleware layer that could allow unauthenticated or unauthorized access to protected resources.
- **Private data leakage from Fabric channels** -- Any issue that allows data intended to be confined to a specific Hyperledger Fabric channel or private data collection to be read by unauthorized peers or external parties.
- **TLS and certificate misconfigurations** -- Weaknesses in TLS setup, certificate validation, or PKI configuration that could enable man-in-the-middle attacks, impersonation, or eavesdropping on network traffic.
- **Secret exposure in repository** -- Accidental or systematic inclusion of private keys, passwords, API tokens, connection profiles with embedded credentials, or other sensitive material in the source repository.

## What is NOT a Security Issue

The following do **not** qualify as security vulnerabilities and should be reported through normal issue tracking:

- **Bugs in test code** -- Failures or defects that exist only within the test suite and do not affect production code or deployment security.
- **Documentation errors** -- Typos, inaccuracies, or missing information in documentation, README files, or inline comments.
- **Feature requests** -- Suggestions for new functionality, improvements to existing features, or changes to project scope.

If you are unsure whether something constitutes a security issue, err on the side of caution and email us privately. We would rather triage a non-issue than miss a real vulnerability.

## Disclosure Policy

This project follows a **coordinated disclosure** process:

1. **Report**: The vulnerability is reported privately to the maintainers via the email address above.
2. **Confirm**: The maintainers verify and assess the vulnerability.
3. **Fix**: A patch is developed and tested internally. During this phase, details of the vulnerability are kept confidential.
4. **Release**: The fix is released to all supported versions.
5. **Announce**: After the fix is available, a public advisory is published describing the vulnerability, its impact, and the remediation steps taken.

We ask that reporters refrain from publicly disclosing the vulnerability until a fix has been released and an advisory has been published. We are committed to crediting reporters (unless they prefer to remain anonymous) in the public advisory.
