# Security Policy

AniTracker handles authentication credentials and private user data. Please report suspected
vulnerabilities privately so maintainers can investigate before details become public.

## Supported versions

Security fixes are provided for the latest released version. Older releases may not receive fixes;
upgrade before reporting a problem that has already been corrected on the latest release.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Older releases | No |
| Unreleased `main` | Best effort |

## Reporting a vulnerability

Use GitHub's private vulnerability reporting from the repository's **Security** tab. If that
option is unavailable, contact the repository owner through the contact method listed on their
GitHub profile. Do not open a public issue containing exploit details, credentials, private data,
or unredacted logs.

Include, where possible:

- The affected version or commit
- Deployment details relevant to the issue
- Reproduction steps or a minimal proof of concept
- The expected and observed behavior
- The potential impact
- Suggested mitigations, if known

You should receive an acknowledgement within seven days. Maintainers will validate the report,
coordinate a fix and release, and agree on disclosure timing with the reporter. Please allow a
reasonable remediation period before publishing details.

## Scope

Reports about AniTracker's own code and default deployment configuration are in scope. Provider
outages, vulnerabilities in third-party services without an AniTracker-specific impact, and
attacks requiring an already-compromised host are generally out of scope.

Never test against an instance you do not own or have explicit permission to assess. Avoid privacy
violations, service disruption, data destruction, and social engineering.

## Operational concerns

Questions about secure deployment that do not reveal a vulnerability can be opened publicly. Read
[INSTALL.md](INSTALL.md) first, especially its guidance on HTTPS, secrets, registration, backups,
and trusted proxies.
