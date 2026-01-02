# Chapter 4: Multi-Account Governance Framework

## 4.1 AWS Organizations Structure

### 4.1.1 Organisational Unit (OU) Design

The foundation of effective multi-account governance lies in the thoughtful design of Organisational Units (OUs) within AWS Organizations. As established in Chapter 3, the reference architecture employs a multi-account structure that separates concerns across purpose-specific accounts whilst maintaining centralised governance. The OU hierarchy serves as the primary mechanism through which security policies propagate across the account portfolio, making OU design one of the most consequential architectural decisions in enterprise AWS deployments (AWS, 2024a).

Organisational Units provide logical groupings of AWS accounts that share common governance requirements. Service Control Policies (SCPs) attached to OUs apply to all accounts within that OU and its descendants, enabling hierarchical policy inheritance that scales efficiently across large account portfolios. This inheritance model means that policies attached higher in the hierarchy apply broadly, whilst policies attached lower in the hierarchy enable granular control over specific account groupings. Security architects must carefully consider the implications of OU placement, as moving accounts between OUs changes the effective policy set governing those accounts.

The AWS recommended OU structure for security-focused deployments reflects operational patterns validated across thousands of enterprise implementations. The Security OU contains accounts dedicated to security operations, including the Security Account that hosts delegated administrator configurations for Security Hub, GuardDuty, Inspector, and other security services. The Infrastructure OU contains shared services accounts including networking, identity, and operations accounts that support workloads across the organisation. The Workloads OU contains production and development accounts organised by business unit, application, or environment type. The Sandbox OU contains experimental accounts with relaxed policies that enable innovation whilst maintaining essential guardrails (AWS Security Reference Architecture, 2024).

**Table 4.1: Recommended OU Structure for Security Governance**

| OU Level | OU Name | Purpose | SCP Strategy | Example Accounts |
|----------|---------|---------|--------------|------------------|
| Root | Organisation Root | Governance root | Foundational security policies | Management Account only |
| L1 | Security | Security operations | Enhanced security controls | Security, Log Archive, Audit |
| L1 | Infrastructure | Shared services | Infrastructure protection | Network, Identity, Operations |
| L1 | Workloads | Business applications | Workload-specific policies | Various application accounts |
| L2 | Production | Production workloads | Strict change controls | Prod-App1, Prod-App2 |
| L2 | Development | Development workloads | Relaxed controls | Dev-App1, Dev-App2 |
| L1 | Sandbox | Experimentation | Minimal viable controls | Developer sandboxes |
| L1 | Suspended | Quarantine | Deny all policies | Compromised/retired accounts |

The Suspended OU warrants particular attention in security governance designs. This OU serves as a quarantine location for accounts that require isolation, whether due to suspected compromise, pending decommissioning, or policy violations. SCPs attached to the Suspended OU deny all actions except those required for investigation and remediation, effectively removing the account from normal operations whilst maintaining audit trail continuity. The ability to rapidly move compromised accounts to the Suspended OU provides a critical incident response capability that reduces blast radius during active security incidents.

The depth of OU hierarchy influences both governance flexibility and operational complexity. Deep hierarchies enable granular policy targeting but increase the cognitive overhead required to understand effective permissions for any given account. Shallow hierarchies simplify administration but may require more accounts to share common policies despite divergent requirements. The AWS recommendation of limiting OU depth to three or four levels balances these considerations, providing sufficient granularity for most governance scenarios whilst maintaining manageable complexity (AWS Organizations, 2024a).

### 4.1.2 Account Provisioning Strategy

Account provisioning strategy determines how new AWS accounts enter the organisation and receive appropriate security configurations. A well-designed provisioning strategy ensures that every account adheres to security baselines from the moment of creation, eliminating the gap between account creation and security enablement that characterises manual provisioning approaches.

The provisioning workflow for security-governed organisations typically follows a defined sequence. Account creation through AWS Organizations or AWS Control Tower establishes the account within the appropriate OU, immediately subjecting it to inherited SCPs. Automated account configuration, triggered by account creation events, enables security services including Security Hub, GuardDuty, and Inspector through delegated administrator mechanisms. Baseline configuration, delivered through infrastructure as code, establishes logging, networking, and identity configurations that align with organisational standards. Validation workflows verify that all security controls are operational before the account is released for workload deployment.

AWS Control Tower provides a managed account provisioning capability that integrates governance guardrails with the provisioning workflow (AWS Control Tower, 2024). Account Factory, a component of Control Tower, enables self-service account provisioning through Service Catalog, allowing authorised users to create accounts that automatically receive baseline configurations. The integration between Account Factory and security services ensures that accounts provisioned through Control Tower receive security service enablement without manual intervention. Organisations not using Control Tower may implement equivalent automation through custom solutions that leverage AWS Organizations APIs and EventBridge rules.

Event-driven provisioning automation responds to account creation events emitted by AWS Organizations. When a new account joins the organisation, EventBridge routes the event to automation workflows that execute configuration tasks including security service enablement, IAM role creation, and network configuration. This event-driven model ensures that provisioning automation executes reliably without requiring scheduled polling or manual triggers. The automation may execute through AWS Step Functions, AWS Lambda, or external orchestration platforms depending on organisational preferences and existing tooling investments.

```json
{
  "source": ["aws.organizations"],
  "detail-type": ["AWS API Call via CloudTrail"],
  "detail": {
    "eventSource": ["organizations.amazonaws.com"],
    "eventName": ["CreateAccount", "CreateGovCloudAccount", "InviteAccountToOrganization"]
  }
}
```

The EventBridge rule pattern above captures account creation events that should trigger provisioning automation. Organisations may extend this pattern to capture account movement events, enabling re-evaluation of security configurations when accounts move between OUs with different policy requirements.

### 4.1.3 Account Factory Considerations

Account Factory implementations, whether through AWS Control Tower or custom solutions, require careful consideration of the configuration elements that should be standardised across all accounts. Over-specification constrains flexibility and may conflict with legitimate workload requirements. Under-specification leaves security gaps that require manual remediation or exception management.

Baseline configurations typically standardised through Account Factory include security service enablement, CloudTrail configuration, VPC architecture, and IAM roles for cross-account access. Security Hub membership in the delegated administrator relationship ensures that findings aggregate centrally from the moment of account creation. GuardDuty enablement provides immediate threat detection coverage. Inspector scanning activation ensures that vulnerability assessment begins without delay. These configurations address the most critical security requirements whilst leaving application-specific decisions to workload teams.

Customisation mechanisms enable Account Factory to accommodate legitimate variation across account types. Control Tower customisations allow organisations to define configuration packages that apply based on OU placement or account parameters. Custom Account Factory implementations may incorporate decision logic that selects configuration profiles based on account metadata. The key principle is that customisation should operate within defined boundaries rather than bypassing governance entirely.

Validation and compliance verification ensure that Account Factory output meets organisational requirements. Automated compliance checks, executed as part of the provisioning workflow, verify that all expected configurations are present and correctly applied. Findings from these checks may block account release until remediation occurs, preventing the accumulation of technical debt that characterises unverified provisioning. Ongoing compliance monitoring through Security Hub and AWS Config ensures that accounts remain compliant after initial provisioning, detecting configuration drift that may occur through operational changes.

### 4.1.4 Scaling to 100+ Accounts

The governance mechanisms described in this chapter specifically address the challenges that emerge when account portfolios exceed one hundred accounts. At this scale, manual governance approaches become impractical, and automation becomes essential for maintaining consistent security posture. The architectural decisions made during initial deployment significantly influence the organisation's ability to scale governance effectively.

API throttling and service quotas present operational challenges at scale that require architectural accommodation. AWS Organizations API calls are subject to rate limits that may constrain automation throughput when operating across hundreds of accounts. Delegated administrator APIs for security services have their own quota limitations that affect bulk enablement operations. Effective scaling strategies incorporate rate limiting, backoff algorithms, and parallel execution patterns that maximise throughput whilst respecting service constraints.

Security Hub central configuration, introduced to address governance at scale, enables delegated administrators to define configuration policies that apply automatically across all member accounts (AWS, 2025a). This capability eliminates the need to configure security standards and controls individually in each member account, dramatically reducing the operational overhead of multi-account governance. Configuration policies propagate to new accounts automatically, ensuring that scale growth does not create governance gaps.

Monitoring and observability requirements intensify at scale, as the volume of findings, events, and metrics exceeds human capacity for comprehensive review. Aggregation dashboards that present organisational security posture at summary levels enable security teams to identify patterns and exceptions without reviewing individual account data. Anomaly detection that identifies accounts deviating from normal finding patterns focuses attention on accounts requiring investigation. Alert routing that directs findings to appropriate responders based on account ownership and finding characteristics ensures that security issues receive attention from teams with relevant context.

Operational runbooks for common governance tasks become essential at scale, ensuring consistent execution regardless of which team member performs the task. Runbooks for account provisioning, OU reorganisation, policy updates, and incident response encode organisational knowledge in executable form. Automation of runbook steps where feasible reduces human error and accelerates execution. Documentation of manual steps ensures that complex procedures execute correctly when automation is not available or appropriate.

---

## 4.2 Delegated Administrator Model

### 4.2.1 Designating Security Account as Delegated Admin

The delegated administrator model enables centralised security operations without requiring access to the organisation's management account. As emphasised in Chapter 3, the management account should contain no workloads and minimal resources, serving exclusively as the governance root for the organisation. The delegated administrator model supports this principle by enabling security teams to manage security services from a dedicated Security Account that operates under the same SCP governance as other member accounts.

Designation of delegated administrator status occurs through AWS Organizations APIs, executed from the management account with appropriate permissions. The management account retains the ability to designate and remove delegated administrators, maintaining ultimate governance authority whilst delegating operational responsibility. Once designated, the delegated administrator account gains the ability to enable services in member accounts, configure service settings across the organisation, and access service data from all member accounts.

The Security Account serves as the delegated administrator for multiple security services, consolidating security operations into a single operational context. This consolidation enables security teams to conduct their work without switching between accounts, reducing operational complexity and improving response times. The concentration of security capabilities in a dedicated account also simplifies access control, as security team permissions can be scoped to the Security Account rather than distributed across the account portfolio.

The designation process for Security Hub delegated administrator illustrates the pattern common across AWS security services:

```bash
# Execute from Management Account
# Designate Security Account as delegated administrator for Security Hub
aws securityhub enable-organization-admin-account \
    --admin-account-id 123456789012

# Verify delegated administrator designation
aws organizations list-delegated-administrators \
    --service-principal securityhub.amazonaws.com
```

The delegated administrator for Security Hub gains the ability to enable Security Hub in member accounts, configure security standards and controls, access findings from all member accounts, and implement organisation-wide configuration policies. These capabilities enable comprehensive security operations without requiring the security team to access individual member accounts or the management account.

### 4.2.2 Services Supporting Delegated Administration

AWS security services that support delegated administration enable the centralised security operations model that this white paper advocates. Understanding which services support delegation, and any service-specific considerations, informs architectural decisions about Security Account capabilities.

**Table 4.2: Security Services Delegated Administrator Support**

| Service | Delegated Admin Support | Max Delegated Admins | Member Management | Cross-Region Support |
|---------|------------------------|---------------------|-------------------|---------------------|
| AWS Security Hub | Yes | 1 | Auto-enable option | Yes, via aggregation |
| Amazon GuardDuty | Yes | 1 | Auto-enable option | Per-region required |
| Amazon Inspector | Yes | 1 | Auto-enable option | Per-region required |
| Amazon Detective | Yes | 1 | Invitation model | Per-region required |
| AWS Config | Yes (Aggregator) | N/A | Configuration recorder | Per-region required |
| Amazon Macie | Yes | 1 | Auto-enable option | Per-region required |
| AWS Firewall Manager | Yes | 1 | Policy management | Cross-region policies |
| IAM Access Analyzer | Yes | 1 | Automatic for organisation | Per-region required |
| AWS Audit Manager | Yes | 1 | Assessment management | Per-region required |

The delegated administrator designation process varies slightly between services, with some services requiring enablement in the management account before delegation, whilst others support direct delegation without prior enablement. Security architects should consult current AWS documentation for each service, as the delegation mechanisms continue to evolve with service updates.

AWS Config operates differently from other services in the delegated administrator context. Rather than designating a delegated administrator with management authority, Config supports an aggregator model where a designated account collects configuration data from source accounts across the organisation (AWS Config, 2024). This aggregator receives configuration items and compliance data but does not manage Config recorder settings in member accounts. The distinction affects operational procedures, as Config recorder configuration occurs independently in each account whilst aggregation centralises visibility.

Regional considerations affect delegated administrator operations, as most security services operate independently in each AWS region. Delegated administrator status for Security Hub, GuardDuty, and Inspector must be established in each region where member accounts operate workloads. Cross-region aggregation in Security Hub, discussed in Chapter 3, consolidates findings from multiple regions into a single view but does not eliminate the need for per-region service enablement.

### 4.2.3 Cross-Account Permissions and IAM

Cross-account permissions enable the interactions between delegated administrator and member accounts that underpin centralised security operations. Understanding these permission flows informs both security architecture and troubleshooting procedures when cross-account operations fail.

Security services that support delegated administration establish cross-account trust relationships automatically during the delegation process. These service-managed relationships use AWS service principals rather than explicit IAM role trust policies, simplifying configuration whilst limiting customisation options. The trust relationships enable the delegated administrator to perform management actions on member account resources without requiring IAM roles or credentials in those member accounts.

When security operations require actions beyond those supported through service-managed delegation, explicit cross-account IAM roles provide the necessary access. Investigation workflows may require security analysts to examine resources in member accounts, necessitating roles that analysts can assume from the Security Account. Remediation automation may need to modify resources in member accounts, requiring roles with appropriate permissions for remediation actions. These roles should follow least privilege principles, granting only the permissions necessary for specific operational functions.

The trust policy for a cross-account security investigation role illustrates the pattern for explicit cross-account access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "aws:PrincipalOrgID": "o-exampleorgid"
        },
        "Bool": {
          "aws:MultiFactorAuthPresent": "true"
        }
      }
    }
  ]
}
```

This trust policy allows principals from the Security Account (123456789012) to assume the role, with conditions requiring that the assuming principal belongs to the organisation and has authenticated with multi-factor authentication. These conditions prevent credential theft from enabling unauthorised access whilst allowing legitimate security operations to proceed.

### 4.2.4 Centrally Managed vs Self-Managed Accounts

Security Hub 2025 introduces the distinction between centrally managed and self-managed accounts, providing flexibility in how security governance applies across the organisation. This distinction enables organisations to accommodate accounts with special requirements whilst maintaining governance over the majority of accounts.

Centrally managed accounts receive their Security Hub configuration from the delegated administrator through configuration policies. The delegated administrator determines which security standards are enabled, which controls are configured, and what automation rules apply. Account administrators in centrally managed accounts cannot modify these settings, ensuring consistent governance across the account portfolio. This model suits production workloads, regulated environments, and accounts where consistent security posture is essential.

Self-managed accounts retain local control over Security Hub configuration, with account administrators able to enable standards, configure controls, and implement automation independently. The delegated administrator maintains visibility into findings from self-managed accounts but cannot enforce configuration requirements. This model suits sandbox accounts, acquired entities during integration periods, and accounts with legitimate requirements for non-standard configurations.

The transition between centrally managed and self-managed status enables organisations to adapt governance as account requirements evolve. Newly acquired accounts may begin as self-managed during integration planning, transitioning to centrally managed as their configurations align with organisational standards. Sandbox accounts may operate as self-managed during experimentation phases, transitioning to centrally managed when hosting production-adjacent workloads.

Configuration policies specify the standards, controls, and settings that apply to centrally managed accounts. Policies may differ across OUs, enabling differentiated governance that reflects varying security requirements. Production OUs may receive strict policies with all controls enabled, whilst development OUs may receive modified policies that disable controls incompatible with development workflows. The delegated administrator creates and manages these policies, with policy associations determining which accounts receive which configurations.

---

## 4.3 Service Control Policies (SCPs)

### 4.3.1 SCP Design Principles

Service Control Policies provide the preventive control foundation for AWS Organizations governance, establishing permission boundaries that member accounts cannot exceed regardless of IAM permissions granted within those accounts (AWS Organizations, 2024b). SCPs operate as policy guardrails rather than permission grants, meaning that actions not explicitly denied by SCPs remain available if IAM permissions allow them. This deny-unless-allowed model requires careful consideration of policy scope to avoid unintended permission restrictions.

The principle of minimal restriction guides effective SCP design. SCPs should deny only those actions that genuinely require organisational restriction, avoiding broad denials that may conflict with legitimate operational requirements. Each SCP statement should address a specific governance objective with clear business justification. Over-restrictive SCPs create operational friction that motivates exception requests and workarounds, undermining the governance objectives that SCPs are intended to serve.

SCP inheritance through the OU hierarchy enables both broad and targeted policy application. Policies attached to the organisation root apply to all accounts, appropriate for foundational security requirements that apply universally. Policies attached to specific OUs apply only to accounts within those OUs, appropriate for context-specific restrictions. The inheritance model means that accounts accumulate policy restrictions from all levels of the hierarchy above them, making OU placement a significant factor in effective permissions.

The evaluation logic for SCPs differs from IAM policy evaluation in ways that affect policy design. An explicit deny in any applicable SCP prevents the action, regardless of permissions granted elsewhere. The absence of an Allow statement for an action in any applicable SCP also prevents the action, creating implicit deny effects. This evaluation logic means that SCPs must be designed holistically, considering interactions between policies at different hierarchy levels.

Testing and validation procedures ensure that SCPs achieve intended effects without unintended consequences. AWS provides the IAM Policy Simulator for testing IAM policies, but SCP testing requires different approaches since SCPs apply to principals within accounts rather than to specific roles. Sandbox accounts designated for policy testing enable validation before production deployment. Gradual rollout through OU-scoped deployment limits blast radius if policies have unexpected effects.

### 4.3.2 Security Service Protection SCPs

Protecting security services from disablement or tampering represents one of the most critical SCP use cases. Adversaries who compromise AWS credentials frequently attempt to disable security monitoring to avoid detection, making protection of security services an essential defensive measure. SCPs that prevent security service modification ensure that detection capabilities remain operational even when adversary activity occurs within member accounts.

The following SCP prevents disablement of Amazon GuardDuty, ensuring continuous threat detection across the organisation:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PreventGuardDutyDisablement",
      "Effect": "Deny",
      "Action": [
        "guardduty:DeleteDetector",
        "guardduty:DeleteMembers",
        "guardduty:DisassociateFromMasterAccount",
        "guardduty:DisassociateMembers",
        "guardduty:StopMonitoringMembers",
        "guardduty:UpdateDetector"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotLike": {
          "aws:PrincipalArn": [
            "arn:aws:iam::*:role/aws-service-role/guardduty.amazonaws.com/*",
            "arn:aws:iam::*:role/OrganizationAccountAccessRole"
          ]
        }
      }
    }
  ]
}
```

This SCP denies actions that would disable or modify GuardDuty detection, with exceptions for the GuardDuty service-linked role and the organisation access role used for legitimate administrative operations. The condition structure ensures that normal GuardDuty operations continue whilst preventing adversarial disablement.

Security Hub protection follows a similar pattern, preventing disablement of the central aggregation and compliance assessment platform:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PreventSecurityHubDisablement",
      "Effect": "Deny",
      "Action": [
        "securityhub:DisableSecurityHub",
        "securityhub:DeleteMembers",
        "securityhub:DisassociateFromAdministratorAccount",
        "securityhub:DisassociateMembers",
        "securityhub:BatchDisableStandards",
        "securityhub:DeleteInsight"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotLike": {
          "aws:PrincipalArn": [
            "arn:aws:iam::*:role/aws-service-role/securityhub.amazonaws.com/*",
            "arn:aws:iam::*:role/OrganizationAccountAccessRole"
          ]
        }
      }
    }
  ]
}
```

CloudTrail protection ensures that audit logging remains operational, preserving the forensic evidence necessary for incident investigation:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PreventCloudTrailModification",
      "Effect": "Deny",
      "Action": [
        "cloudtrail:DeleteTrail",
        "cloudtrail:StopLogging",
        "cloudtrail:UpdateTrail",
        "cloudtrail:PutEventSelectors",
        "cloudtrail:RemoveTags"
      ],
      "Resource": "arn:aws:cloudtrail:*:*:trail/OrganizationTrail",
      "Condition": {
        "StringNotLike": {
          "aws:PrincipalArn": [
            "arn:aws:iam::*:role/OrganizationAccountAccessRole"
          ]
        }
      }
    }
  ]
}
```

This SCP specifically protects the organisation trail whilst allowing account-level trails to be managed by account administrators. The resource specification targets only the organisation trail, avoiding interference with legitimate CloudTrail configurations for specific use cases.

### 4.3.3 Privilege Escalation Prevention

Privilege escalation occurs when principals obtain permissions beyond those intended by security administrators, typically through IAM policy manipulation or service exploitation. SCPs that prevent common privilege escalation pathways reduce the risk that compromised credentials enable adversaries to expand their access beyond initial footholds.

The following SCP prevents creation of IAM users with administrative privileges, enforcing the use of federated identity for administrative access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PreventAdminUserCreation",
      "Effect": "Deny",
      "Action": [
        "iam:CreateUser",
        "iam:CreateAccessKey",
        "iam:AttachUserPolicy",
        "iam:PutUserPolicy"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotLike": {
          "aws:PrincipalArn": [
            "arn:aws:iam::*:role/OrganizationAccountAccessRole",
            "arn:aws:iam::*:role/BreakGlassRole"
          ]
        }
      }
    }
  ]
}
```

This SCP prevents IAM user creation and policy attachment, with exceptions for organisation administration and break-glass emergency access. The policy enforces a federated identity model where human principals authenticate through identity providers rather than IAM users with long-lived credentials.

Prevention of IAM role policy escalation addresses scenarios where adversaries modify existing roles to grant additional permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PreventPolicyEscalation",
      "Effect": "Deny",
      "Action": [
        "iam:CreatePolicyVersion",
        "iam:SetDefaultPolicyVersion",
        "iam:AttachRolePolicy",
        "iam:PutRolePolicy",
        "iam:UpdateAssumeRolePolicy"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotLike": {
          "aws:PrincipalArn": [
            "arn:aws:iam::*:role/OrganizationAccountAccessRole",
            "arn:aws:iam::*:role/IAMAdministratorRole"
          ]
        },
        "ForAnyValue:StringLike": {
          "iam:PolicyArn": [
            "arn:aws:iam::aws:policy/AdministratorAccess",
            "arn:aws:iam::aws:policy/IAMFullAccess",
            "arn:aws:iam::aws:policy/PowerUserAccess"
          ]
        }
      }
    }
  ]
}
```

This SCP prevents attachment of powerful managed policies to roles, requiring that privileged access be granted through specifically authorised roles rather than ad hoc policy attachment.

### 4.3.4 Full IAM Language Support (2025)

The 2025 expansion of SCP capabilities to support the complete IAM policy language represents a significant enhancement to organisational governance capabilities (AWS, 2025b). Prior to this enhancement, SCPs supported a limited subset of IAM policy elements, constraining the sophistication of preventive controls that organisations could implement. The full IAM language support enables SCPs to incorporate condition keys, resource patterns, and logical operators that were previously unavailable.

The expanded condition key support enables SCPs to evaluate request context elements including source IP addresses, VPC endpoints, resource tags, and temporal conditions. These capabilities enable context-aware policies that apply restrictions based on how and when actions are requested, not merely what actions are requested.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RequireSecureTransport",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        },
        "StringNotEquals": {
          "aws:PrincipalServiceName": [
            "config.amazonaws.com",
            "cloudtrail.amazonaws.com"
          ]
        }
      }
    }
  ]
}
```

This SCP requires HTTPS for all API calls, with exceptions for AWS services that may use internal communication channels. The condition-based approach enables nuanced policy expression that addresses security requirements without disrupting legitimate operations.

Resource-based conditions enable SCPs to apply restrictions based on resource characteristics:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RequireEncryptedEBS",
      "Effect": "Deny",
      "Action": [
        "ec2:CreateVolume",
        "ec2:RunInstances"
      ],
      "Resource": "*",
      "Condition": {
        "Bool": {
          "ec2:Encrypted": "false"
        }
      }
    }
  ]
}
```

This SCP prevents creation of unencrypted EBS volumes, enforcing encryption requirements through preventive controls rather than detective controls that identify violations after creation.

### 4.3.5 SCP Library Reference

Organisations implementing comprehensive security governance require a library of SCPs addressing diverse governance objectives. The following reference provides additional SCP examples beyond the security service protection and privilege escalation prevention policies detailed above. See Appendix C for the complete SCP library with deployment guidance.

**Region Restriction SCP**: Limits AWS service usage to approved regions, preventing resource creation in regions outside governance scope.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RestrictToApprovedRegions",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:RequestedRegion": [
            "us-east-1",
            "us-west-2",
            "eu-west-1",
            "eu-central-1"
          ]
        },
        "ForAllValues:StringNotEquals": {
          "aws:PrincipalServiceName": [
            "cloudfront.amazonaws.com",
            "iam.amazonaws.com",
            "organizations.amazonaws.com",
            "sts.amazonaws.com"
          ]
        }
      }
    }
  ]
}
```

**Data Exfiltration Prevention SCP**: Restricts actions that could facilitate data exfiltration through external sharing mechanisms.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PreventPublicS3Access",
      "Effect": "Deny",
      "Action": [
        "s3:PutBucketPublicAccessBlock",
        "s3:PutAccountPublicAccessBlock"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "s3:PublicAccessBlockConfiguration": "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
        }
      }
    }
  ]
}
```

**Instance Type Restriction SCP**: Limits EC2 instance types to approved families, preventing cost overruns and ensuring consistent infrastructure patterns.

**Network Egress Restriction SCP**: Requires VPC endpoints for AWS service access, preventing direct internet communication from private subnets.

The SCP library should be maintained as infrastructure as code, enabling version control, peer review, and automated deployment. Changes to SCPs should follow change management procedures that include testing in sandbox environments before production deployment.

---

## 4.4 Central Configuration

### 4.4.1 Configuration Policies for Security Hub

Security Hub central configuration, introduced as a core capability of the 2025 release, enables delegated administrators to define configuration policies that automatically apply across member accounts (AWS, 2025c). This capability addresses the operational burden of configuring security standards and controls individually in each member account, a burden that became prohibitive as account portfolios grew beyond tens of accounts.

Configuration policies specify three categories of settings: service enablement, security standards configuration, and control customisation. Service enablement determines whether Security Hub is enabled in target accounts, with options to enable, disable, or maintain current state. Security standards configuration specifies which compliance frameworks are enabled and their configuration parameters. Control customisation enables disablement of specific controls where business justification exists, and parameter adjustment for controls that support configurable thresholds.

The policy structure enables both broad and targeted configuration. A default policy may specify baseline configuration applying to all centrally managed accounts. Additional policies may specify configurations for specific OUs or accounts, overriding default settings where requirements differ. This layered approach mirrors the SCP inheritance model, enabling consistent baseline governance with targeted exceptions.

```json
{
  "Name": "ProductionSecurityPolicy",
  "Description": "Security Hub configuration for production workloads",
  "ConfigurationPolicyDocument": {
    "ServiceEnabled": true,
    "EnabledStandardIdentifiers": [
      "arn:aws:securityhub:::standards/aws-foundational-security-best-practices/v/1.0.0",
      "arn:aws:securityhub:::standards/cis-aws-foundations-benchmark/v/3.0.0",
      "arn:aws:securityhub:::standards/nist-800-53/v/5.0.0"
    ],
    "SecurityControlsConfiguration": {
      "DisabledSecurityControlIdentifiers": [],
      "SecurityControlCustomParameters": [
        {
          "SecurityControlId": "EC2.19",
          "Parameters": {
            "RecommendedMaxSecurityGroupRules": {
              "ValueType": "CUSTOM",
              "Value": {
                "Integer": 100
              }
            }
          }
        }
      ]
    }
  }
}
```

This configuration policy enables Security Hub with three compliance standards and customises the EC2.19 control parameter for maximum security group rules. The policy would be associated with the Production OU, applying automatically to all accounts within that OU.

Policy associations link configuration policies to organisational targets including the organisation root, specific OUs, or individual accounts. The association model enables precise targeting of configurations based on account classification. Conflict resolution rules determine behaviour when multiple policies could apply to an account, with more specific associations (account-level) taking precedence over broader associations (OU-level or root-level).

### 4.4.2 Auto-Enable for New Accounts

The auto-enable capability ensures that new accounts joining the organisation receive security service enablement automatically, eliminating the gap between account creation and security coverage that characterises manual enablement approaches. This capability proves essential for maintaining consistent security posture as organisations grow their account portfolios.

Auto-enable operates through the delegated administrator relationship, with the delegated administrator account specifying auto-enable preferences for each security service. When new accounts join the organisation, the delegated administrator's auto-enable settings determine whether services are enabled in those accounts. This automation executes within minutes of account creation, ensuring that security coverage begins almost immediately.

Configuration of auto-enable occurs through service-specific settings in the delegated administrator account. For Security Hub, auto-enable settings are specified through central configuration policies that apply to the organisation root. For GuardDuty, auto-enable is configured through the GuardDuty console or API in the delegated administrator account. Similar patterns apply to Inspector, Macie, and other security services that support delegated administration.

```bash
# Enable auto-enable for Security Hub new accounts
aws securityhub update-organization-configuration \
    --auto-enable \
    --auto-enable-standards SECURITY_CONTROL

# Enable auto-enable for GuardDuty new accounts
aws guardduty update-organization-configuration \
    --detector-id abc123def456 \
    --auto-enable \
    --features '[
      {"Name": "S3_DATA_EVENTS", "AutoEnable": "NEW"},
      {"Name": "EKS_AUDIT_LOGS", "AutoEnable": "NEW"},
      {"Name": "MALWARE_PROTECTION", "AutoEnable": "NEW"}
    ]'
```

These commands configure auto-enable for Security Hub and GuardDuty, ensuring that new accounts receive comprehensive security coverage automatically. The GuardDuty configuration demonstrates the granular feature-level auto-enable options available for services with multiple protection features.

### 4.4.3 Standard and Control Configuration

Security Hub compliance standards provide the control frameworks against which resources are assessed. The configuration of which standards are enabled, which controls are active within those standards, and what parameters apply to configurable controls significantly influences both security coverage and finding volume.

The AWS Foundational Security Best Practices (FSBP) standard provides controls derived from AWS security expertise and should be enabled in all environments (AWS, 2025d). CIS AWS Foundations Benchmark standards (currently version 3.0) provide industry-standard controls recognised by auditors and regulators. NIST 800-53 Revision 5 controls satisfy federal government requirements and provide comprehensive coverage for high-security environments. PCI DSS version 4.0 controls address payment card industry requirements for organisations processing cardholder data.

Control disablement should be approached conservatively, with each disabled control requiring documented business justification. Legitimate reasons for control disablement include controls that conflict with approved architectural patterns, controls that assess services not in use, and controls that duplicate assessment provided by other mechanisms. Disabled controls should be documented in a control exception register that undergoes periodic review.

```json
{
  "DisabledSecurityControlIdentifiers": [
    "EC2.10",
    "CloudTrail.5",
    "SNS.1"
  ],
  "DisabledReason": {
    "EC2.10": "VPN connections managed centrally in Network account",
    "CloudTrail.5": "Log file validation disabled due to processing latency requirements",
    "SNS.1": "SNS not used in this account type"
  }
}
```

Control parameter customisation enables adjustment of thresholds and values for controls that support configuration. For example, controls that assess password policy strength may have configurable minimum length requirements. Controls that evaluate resource counts may have configurable thresholds for when findings are generated. Parameter customisation enables organisations to align control assessment with their specific security requirements rather than accepting default values that may be inappropriate for their context.

### 4.4.4 Organisation-Wide Defaults

Organisation-wide defaults establish baseline configurations that apply unless overridden by more specific policies. These defaults encode security principles that apply universally, reducing the configuration burden for new OUs and accounts whilst ensuring consistent foundational protection.

The default configuration should reflect the organisation's security baseline requirements. For most organisations, this includes enablement of Security Hub with the FSBP standard, enablement of GuardDuty with all detection features, enablement of Inspector for EC2 and container scanning, and enablement of IAM Access Analyzer with organisation scope. These defaults ensure that accounts receive comprehensive security coverage without requiring explicit configuration for each account.

Inheritance of defaults through the OU hierarchy means that OUs inherit configurations from their parent unless explicitly overridden. An OU-specific policy that enables additional standards inherits the default standard enablement whilst adding to it. An OU-specific policy that disables certain controls inherits all other control settings from the default. This inheritance model reduces duplication whilst enabling targeted customisation.

Override mechanisms provide flexibility for legitimate exceptions whilst maintaining governance visibility. Self-managed account designation removes accounts from central configuration entirely, appropriate for sandbox environments with relaxed requirements. OU-specific policies override default settings for accounts within that OU, appropriate for account types with consistently different requirements. Account-specific policies override both defaults and OU policies for individual accounts, appropriate for unique situations requiring special handling.

The governance model should include procedures for exception approval, documentation of exception justifications, and periodic review of exceptions to determine continued appropriateness. Exceptions that persist indefinitely without review accumulate into technical debt that undermines governance objectives. Regular review ensures that exceptions remain aligned with current business requirements and that accounts transition to standard configurations when exception conditions no longer apply.

---

## Chapter Summary

This chapter has established the multi-account governance framework that enables security operations at enterprise scale. The AWS Organizations structure, with thoughtfully designed OUs and automated account provisioning, provides the foundation upon which security policies propagate efficiently across large account portfolios. The delegated administrator model enables centralised security operations from a dedicated Security Account, implementing separation between governance authority and operational responsibility whilst maintaining comprehensive visibility across all member accounts.

Service Control Policies provide the preventive control layer that protects security services from tampering, prevents privilege escalation attacks, and enforces organisational policies that member accounts cannot circumvent. The 2025 expansion to full IAM language support enables sophisticated policy expressions that address complex governance scenarios. The SCP examples provided in this chapter, with the complete library in Appendix C, offer implementable guidance for common governance requirements.

Central configuration through Security Hub enables consistent security posture across the account portfolio without the operational burden of individual account configuration. Auto-enable capabilities ensure that new accounts receive security coverage immediately upon creation. Standard and control configuration enables organisations to balance comprehensive assessment with practical operational requirements through judicious control customisation.

The governance framework presented in this chapter addresses anti-patterns identified in Chapter 1: siloed security tools are replaced by centralised delegated administration, manual member account enrollment is replaced by auto-enable automation, and workloads in the management account are prevented through OU design that enforces separation. See Chapter 5 for Security Hub configuration procedures that implement the centralised visibility capabilities enabled by this governance framework. See Chapter 9 for implementation procedures that deploy this governance framework through infrastructure as code.

---

*Word Count: Approximately 5,520 words*

*Chapter 4 Complete - Proceed to Chapter 5: Security Hub Configuration and Integration*

---

## References

AWS. (2024a). *Best practices for organizing units (OUs)*. Amazon Web Services. https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_ous.html

AWS. (2025a). *Security Hub central configuration*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/central-configuration.html

AWS. (2025b). AWS Organizations announces full IAM policy language support for SCPs. *AWS What's New*. https://aws.amazon.com/about-aws/whats-new/2025/01/aws-organizations-full-iam-policy-language-scps/

AWS. (2025c). *Creating and managing Security Hub configuration policies*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/configuration-policies.html

AWS. (2025d). *AWS Foundational Security Best Practices controls*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/fsbp-standard.html

AWS Config. (2024). *Multi-account multi-region data aggregation*. Amazon Web Services. https://docs.aws.amazon.com/config/latest/developerguide/aggregate-data.html

AWS Control Tower. (2024). *AWS Control Tower User Guide*. Amazon Web Services. https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html

AWS Organizations. (2024a). *Quotas for AWS Organizations*. Amazon Web Services. https://docs.aws.amazon.com/organizations/latest/userguide/orgs_reference_limits.html

AWS Organizations. (2024b). *Service control policies (SCPs)*. Amazon Web Services. https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html

AWS Security Reference Architecture. (2024). *Security OU and accounts*. Amazon Web Services. https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/security-ou-accounts.html

CIS. (2024). *CIS Amazon Web Services Foundations Benchmark v3.0*. Center for Internet Security. https://www.cisecurity.org/benchmark/amazon_web_services

NIST. (2020). *Security and Privacy Controls for Information Systems and Organizations*. National Institute of Standards and Technology. Special Publication 800-53 Revision 5. https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
