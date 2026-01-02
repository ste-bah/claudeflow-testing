# Chapter 5: Security Hub Configuration and Integration

## 5.1 Security Hub Setup

Building on the governance framework established in Chapter 4 and the architectural principles defined in Chapter 3, this chapter provides comprehensive guidance for configuring AWS Security Hub as the central nervous system of enterprise cloud security operations. Security Hub serves as the unified platform that aggregates security findings from across the AWS account portfolio, correlates findings across services and accounts, assesses compliance against industry frameworks, and enables automated response to security events. The 2025 enhancements to Security Hub, detailed in Chapter 2, have substantially expanded these capabilities, making Security Hub the essential foundation for cloud security posture management at enterprise scale (AWS, 2025a).

### 5.1.1 Enabling Security Hub Across Organisation

The enablement of Security Hub across an AWS Organization requires coordinated actions that establish the delegated administrator relationship, configure central management policies, and ensure that all member accounts participate in the unified security ecosystem. This process differs fundamentally from enabling Security Hub in individual accounts, as organisation-wide enablement leverages AWS Organizations integration to achieve consistent configuration without manual intervention in each member account.

The initial enablement sequence begins in the organisation management account, where the delegated administrator designation occurs. This designation transfers operational control of Security Hub to the Security Account, enabling security teams to manage the service without requiring access to the highly privileged management account. The designation process requires the management account to have Security Hub enabled, though only temporarily for the delegation process itself; following delegation, Security Hub may be disabled in the management account if organisational policy mandates an empty management account.

```bash
# Execute from Management Account
# Step 1: Enable Security Hub in management account (required for delegation)
aws securityhub enable-security-hub --region us-east-1

# Step 2: Designate Security Account as delegated administrator
aws securityhub enable-organization-admin-account \
    --admin-account-id 123456789012 \
    --region us-east-1

# Step 3: Verify delegation status
aws securityhub list-organization-admin-accounts --region us-east-1

# Step 4 (Optional): Disable Security Hub in management account
aws securityhub disable-security-hub --region us-east-1
```

Following delegation, all subsequent Security Hub configuration occurs from the Security Account. The delegated administrator gains the ability to enable Security Hub in member accounts, configure compliance standards across the organisation, access findings from all member accounts, and implement organisation-wide automation rules. These capabilities operate through the service-managed trust relationships established during delegation, eliminating the need for explicit cross-account IAM roles for routine security operations (AWS Security Hub, 2025b).

The organisation configuration determines whether new accounts automatically receive Security Hub enablement and the standards they inherit. This configuration should be established immediately following delegation to ensure that accounts created subsequently receive appropriate security coverage without manual intervention.

```bash
# Execute from Security Account (Delegated Administrator)
# Configure organisation-wide settings
aws securityhub update-organization-configuration \
    --auto-enable \
    --auto-enable-standards SECURITY_CONTROL \
    --organization-configuration '{
        "ConfigurationType": "CENTRAL"
    }' \
    --region us-east-1
```

The `CENTRAL` configuration type indicates that the delegated administrator will manage Security Hub configuration through central configuration policies, as opposed to the `LOCAL` type where individual accounts manage their own configurations. Central configuration represents the recommended approach for enterprise deployments, ensuring consistent security posture across the account portfolio whilst reducing operational overhead (AWS, 2025c).

### 5.1.2 Delegated Administrator Configuration

The delegated administrator configuration extends beyond initial designation to encompass the ongoing management capabilities that security teams require for effective operations. Understanding the full scope of delegated administrator privileges enables security architects to design operational procedures that leverage these capabilities whilst respecting the boundaries that delegation establishes.

Delegated administrators possess extensive management capabilities including the ability to enable and disable security standards across member accounts, modify control configurations, create and manage automation rules, and access all findings generated within the organisation. However, delegated administrators cannot modify the organisation structure itself, cannot designate additional delegated administrators, and cannot override Service Control Policies applied by the management account. These boundaries maintain appropriate separation between security operations and organisation governance.

The effective configuration of the delegated administrator account includes establishing appropriate IAM policies for security personnel, configuring Security Hub preferences that apply to the aggregated view, and implementing the dashboard customisations that support operational workflows. These configurations should reflect the operational model established in Chapter 4, with role-based access that distinguishes between security analysts, incident responders, and security engineers.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "SecurityHubAdminAccess",
            "Effect": "Allow",
            "Action": [
                "securityhub:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "OrganizationsReadAccess",
            "Effect": "Allow",
            "Action": [
                "organizations:DescribeOrganization",
                "organizations:ListAccounts",
                "organizations:ListRoots",
                "organizations:ListOrganizationalUnitsForParent",
                "organizations:ListAccountsForParent"
            ],
            "Resource": "*"
        },
        {
            "Sid": "EventBridgeIntegration",
            "Effect": "Allow",
            "Action": [
                "events:PutRule",
                "events:PutTargets",
                "events:DeleteRule",
                "events:RemoveTargets"
            ],
            "Resource": "arn:aws:events:*:*:rule/SecurityHub*"
        }
    ]
}
```

This IAM policy provides the permissions required for Security Hub administration, including the read access to Organizations required for understanding account structure and the EventBridge permissions required for automation configuration. Organisations should refine this policy based on specific operational requirements, potentially separating read-only analyst access from the full administrative access granted to security engineers.

### 5.1.3 Cross-Region Aggregation Setup

Cross-region aggregation addresses the fundamental challenge of maintaining unified security visibility across geographically distributed deployments. As described in the architecture in Chapter 3, AWS resources may be deployed across multiple regions for latency, redundancy, or data residency reasons, yet security operations require consolidated visibility regardless of resource location. Cross-region aggregation in Security Hub replicates findings from linked regions to a designated aggregation region, where they become available alongside findings from other regions for unified analysis and response.

The anti-pattern of missing cross-region aggregation, identified as Anti-Pattern #2 in Chapter 1, represents one of the most consequential oversights in Security Hub deployments. Organisations that enable Security Hub only in their primary region remain blind to security findings from resources deployed in other regions, creating visibility gaps that adversaries may exploit. The 2025 Security Hub enhancements have simplified cross-region aggregation configuration, but the capability must still be explicitly enabled.

The aggregation region should be selected according to the criteria established in Chapter 3: operational considerations favouring proximity to security team locations, data residency requirements that may mandate specific regions, and strategic considerations including service availability and disaster recovery alignment. Once selected, the aggregation region becomes the primary location for security operations, with linked regions contributing their findings to this central repository.

```bash
# Execute from Security Account in the Aggregation Region
# Step 1: Create finding aggregator
aws securityhub create-finding-aggregator \
    --region us-east-1 \
    --region-linking-mode ALL_REGIONS

# Alternative: Link specific regions only
aws securityhub create-finding-aggregator \
    --region us-east-1 \
    --region-linking-mode SPECIFIED_REGIONS \
    --regions us-west-2 eu-west-1 ap-southeast-1

# Step 2: Verify aggregator configuration
aws securityhub get-finding-aggregator \
    --finding-aggregator-arn arn:aws:securityhub:us-east-1:123456789012:finding-aggregator/12345678-1234-1234-1234-123456789012 \
    --region us-east-1
```

The `ALL_REGIONS` linking mode automatically includes all current and future AWS regions in the aggregation, ensuring that new regions receive coverage without configuration updates. This mode is recommended for organisations that may expand their regional footprint, as it prevents the visibility gaps that occur when new regions are deployed without aggregation configuration. The `SPECIFIED_REGIONS` mode provides explicit control for organisations with specific regional constraints or those operating in limited regions (AWS Security Hub, 2025d).

Cross-region aggregation operates at the organisation level when configured by the delegated administrator, automatically applying to all member accounts. Findings from member accounts in linked regions replicate to the aggregation region typically within five minutes of generation, enabling near real-time visibility across the global deployment. The aggregation does not duplicate findings in the originating region; findings remain available both locally and in the aggregation region, enabling regional teams to operate independently whilst central security teams maintain comprehensive visibility.

### 5.1.4 Cross-Account Aggregation Setup

Cross-account aggregation operates through the delegated administrator relationship established during initial Security Hub enablement. When the Security Account is designated as delegated administrator, it automatically receives access to findings from all member accounts within the organisation. This access enables the unified visibility that security teams require for effective operations, consolidating findings from potentially hundreds of accounts into a single operational interface.

The cross-account aggregation mechanism differs from cross-region aggregation in that it operates through the AWS Organizations service integration rather than explicit finding replication. Member accounts do not transmit findings to the administrator account; rather, the administrator account has the permission to query and view findings that exist in member accounts. This distinction has practical implications for finding availability and latency, as findings appear in the administrator view almost immediately after they are generated in member accounts.

The configuration of cross-account aggregation involves ensuring that all member accounts are enrolled in Security Hub and that the member-administrator relationship is properly established. For organisations using central configuration, this enrollment occurs automatically when accounts join the organisation. For organisations using local configuration, manual enrollment may be required for each member account.

```bash
# Execute from Security Account (Delegated Administrator)
# List all organisation members and their Security Hub status
aws securityhub list-members --region us-east-1

# For accounts not automatically enrolled, create member association
aws securityhub create-members \
    --account-details '[
        {"AccountId": "111111111111"},
        {"AccountId": "222222222222"},
        {"AccountId": "333333333333"}
    ]' \
    --region us-east-1

# Verify member associations
aws securityhub get-members \
    --account-ids 111111111111 222222222222 333333333333 \
    --region us-east-1
```

The member status should indicate `ENABLED` for accounts that are fully enrolled in the organisation's Security Hub deployment. Accounts with status `CREATED` have been invited but have not yet accepted the association, whilst accounts with status `DISABLED` have explicitly declined participation. For centrally managed organisations, the delegated administrator can enforce participation regardless of account-level preferences, ensuring comprehensive coverage across the account portfolio.

---

## 5.2 Security Standards Configuration

Security standards in Security Hub provide the compliance frameworks against which resources are continuously assessed, generating findings when configurations deviate from defined best practices. The selection and configuration of security standards significantly influences both the comprehensiveness of security coverage and the volume of findings requiring review. This section addresses the configuration of AWS-native and industry-standard compliance frameworks, providing guidance for balancing thorough coverage with practical operability.

### 5.2.1 AWS Foundational Security Best Practices

The AWS Foundational Security Best Practices (FSBP) standard represents AWS's distillation of security expertise into actionable controls that apply across service types and use cases (AWS, 2025e). This standard should be enabled in all environments as the baseline for security assessment, as it reflects AWS's understanding of the configurations most commonly associated with security incidents and the preventive measures that reduce risk most effectively.

FSBP controls cover a comprehensive range of AWS services including compute, storage, database, networking, and identity services. The controls address configuration requirements including encryption at rest and in transit, network exposure limitations, logging enablement, and access control configurations. As AWS introduces new services and identifies new security patterns, the FSBP standard receives updates that incorporate emerging best practices, ensuring that organisations maintaining FSBP enablement receive automatic coverage expansion.

The FSBP standard as of 2025 includes over 200 controls organised by AWS service. Each control has a severity rating (CRITICAL, HIGH, MEDIUM, or LOW) that indicates its relative importance for security posture. The severity ratings inform prioritisation decisions when addressing findings, with CRITICAL and HIGH findings warranting immediate attention whilst MEDIUM and LOW findings may be addressed during regular maintenance cycles.

```bash
# Enable FSBP standard across the organisation
aws securityhub batch-enable-standards \
    --standards-subscription-requests '[
        {
            "StandardsArn": "arn:aws:securityhub:us-east-1::standards/aws-foundational-security-best-practices/v/1.0.0"
        }
    ]' \
    --region us-east-1

# Verify standard enablement
aws securityhub get-enabled-standards --region us-east-1
```

Organisations should review the complete FSBP control list and identify any controls that conflict with approved architectural patterns or assess services not in use. Controls that generate findings for configurations that are intentionally maintained may be disabled to prevent alert fatigue, though such disablements should be documented with business justification and subject to periodic review.

### 5.2.2 CIS AWS Foundations Benchmark (v3.0)

The Center for Internet Security (CIS) AWS Foundations Benchmark provides an industry-standard control framework recognised by auditors, regulators, and security assessors worldwide (CIS, 2024). Version 3.0 of the benchmark, released in 2024, incorporates updates that reflect the current AWS service landscape and contemporary threat environment. Organisations subject to external audit or seeking industry-recognised security validation should enable this standard alongside FSBP.

The CIS benchmark organises controls into categories including Identity and Access Management, Logging, Monitoring, and Networking. Each control includes rationale explaining its security significance, audit procedures for manual verification, and remediation guidance for addressing non-compliance. Security Hub automates the assessment of CIS controls, generating findings when resources deviate from benchmark requirements.

CIS benchmark controls are classified into Level 1 and Level 2 profiles. Level 1 controls represent baseline security configurations that should be implementable in most organisations without significant operational impact. Level 2 controls provide additional security for organisations with heightened security requirements, though implementation may require more substantial operational changes. Security Hub enables all controls by default; organisations may disable Level 2 controls if they determine that the operational impact outweighs the security benefit for their specific context.

```bash
# Enable CIS AWS Foundations Benchmark v3.0
aws securityhub batch-enable-standards \
    --standards-subscription-requests '[
        {
            "StandardsArn": "arn:aws:securityhub:us-east-1::standards/cis-aws-foundations-benchmark/v/3.0.0"
        }
    ]' \
    --region us-east-1
```

The overlap between FSBP and CIS controls means that organisations enabling both standards will receive duplicate findings for some configurations. Security Hub's control-based finding consolidation, introduced in the 2025 enhancements, addresses this duplication by presenting unified findings that reference multiple standards rather than generating separate findings for each standard. This consolidation reduces finding volume whilst maintaining the compliance evidence required for both frameworks (AWS, 2025f).

### 5.2.3 NIST 800-53 Rev. 5

The National Institute of Standards and Technology (NIST) Special Publication 800-53 Revision 5 provides comprehensive security and privacy controls for federal information systems and organisations (NIST, 2020). Organisations subject to United States federal regulations, government contractors, and entities seeking alignment with federal security requirements should enable this standard. Additionally, many private sector organisations adopt NIST 800-53 as a comprehensive control framework that exceeds baseline commercial security requirements.

NIST 800-53 Rev. 5 includes over 1,000 controls organised into 20 control families addressing areas including access control, audit and accountability, security assessment, configuration management, contingency planning, identification and authentication, incident response, maintenance, media protection, personnel security, physical protection, planning, program management, risk assessment, system and services acquisition, system and communications protection, system and information integrity, and supply chain risk management.

Security Hub implements automated assessment for a subset of NIST 800-53 controls that correspond to AWS service configurations. Controls that require manual assessment (such as personnel security controls or physical protection controls) are not evaluated by Security Hub but may be addressed through complementary processes. The automated controls provide continuous assessment of the technical security measures that AWS services can evaluate, whilst organisations must maintain separate processes for non-technical controls.

```bash
# Enable NIST 800-53 Rev. 5 standard
aws securityhub batch-enable-standards \
    --standards-subscription-requests '[
        {
            "StandardsArn": "arn:aws:securityhub:us-east-1::standards/nist-800-53/v/5.0.0"
        }
    ]' \
    --region us-east-1
```

### 5.2.4 PCI-DSS v4.0

The Payment Card Industry Data Security Standard (PCI-DSS) version 4.0 specifies security requirements for organisations that store, process, or transmit payment card data (PCI Security Standards Council, 2022). Version 4.0, which became mandatory in March 2025, introduces significant changes from version 3.2.1 including enhanced authentication requirements, expanded risk assessment obligations, and new requirements for service providers. Security Hub's PCI-DSS v4.0 standard provides automated assessment of AWS configurations against these requirements.

PCI-DSS compliance requires assessment across twelve main requirements addressing areas including firewall configuration, password management, cardholder data protection, encryption, vulnerability management, access control, monitoring, security testing, information security policies, and service provider management. Security Hub automates assessment of requirements that correspond to AWS service configurations, generating findings when configurations deviate from PCI-DSS expectations.

Organisations should note that PCI-DSS compliance requires more than Security Hub enablement. The standard mandates formal assessments by Qualified Security Assessors (QSAs), documentation of security policies and procedures, and evidence of ongoing compliance maintenance. Security Hub provides the continuous monitoring component that supports these requirements, generating evidence that configurations remain compliant between formal assessments.

```bash
# Enable PCI-DSS v4.0 standard
aws securityhub batch-enable-standards \
    --standards-subscription-requests '[
        {
            "StandardsArn": "arn:aws:securityhub:us-east-1::standards/pci-dss/v/4.0"
        }
    ]' \
    --region us-east-1
```

### 5.2.5 Custom Standards

Custom standards enable organisations to codify their unique security requirements into Security Hub for automated assessment alongside AWS-native and industry standards. Organisations with security policies that exceed baseline frameworks, specific architectural requirements, or industry-specific controls may create custom standards that assess configurations against these requirements.

Custom standards are implemented through AWS Config custom rules that evaluate resources against organisation-specific criteria. These Config rules generate findings that Security Hub ingests and presents alongside findings from native standards. The integration enables organisations to maintain unified visibility across both standard and custom security requirements, eliminating the need for separate compliance monitoring systems (AWS Config, 2024).

The creation of custom standards requires defining Config rules that implement the desired compliance checks, configuring Security Hub to ingest findings from these rules, and establishing the severity classifications and remediation guidance that support operational response. Organisations should document the business rationale for custom standards, ensuring that the requirements they enforce reflect current security policy and remain relevant as the environment evolves.

```json
{
    "ConfigRuleName": "custom-encryption-at-rest-required",
    "Description": "Ensures all supported resources have encryption at rest enabled",
    "Scope": {
        "ComplianceResourceTypes": [
            "AWS::RDS::DBInstance",
            "AWS::EFS::FileSystem",
            "AWS::Elasticsearch::Domain"
        ]
    },
    "Source": {
        "Owner": "CUSTOM_LAMBDA",
        "SourceIdentifier": "arn:aws:lambda:us-east-1:123456789012:function:encryption-check",
        "SourceDetails": [
            {
                "EventSource": "aws.config",
                "MessageType": "ConfigurationItemChangeNotification"
            }
        ]
    },
    "InputParameters": "{}",
    "MaximumExecutionFrequency": "TwentyFour_Hours"
}
```

---

## 5.3 Service Integrations

Security Hub derives significant value from its integration with other AWS security services and third-party security products. These integrations enable Security Hub to serve as the single pane of glass for security operations, aggregating findings from diverse sources into a unified interface. This section details the configuration of native AWS service integrations and provides patterns for third-party integration.

### 5.3.1 GuardDuty Integration

Amazon GuardDuty provides intelligent threat detection that analyses VPC Flow Logs, DNS query logs, CloudTrail management events, and S3 data events to identify malicious activity and anomalous behaviour (AWS GuardDuty, 2025). The integration between GuardDuty and Security Hub is native and automatic: when both services are enabled in an account, GuardDuty findings appear in Security Hub without additional configuration.

GuardDuty findings imported into Security Hub include the full context from the original GuardDuty finding, including severity, affected resources, actor details, and recommended remediation actions. The AWS Security Finding Format (ASFF) representation preserves all information necessary for investigation and response, enabling security teams to work exclusively within Security Hub for routine operations whilst retaining the ability to access GuardDuty directly for advanced analysis.

The integration configuration should verify that GuardDuty is enabled across all accounts and regions where Security Hub operates. Gaps in GuardDuty coverage create blind spots in threat detection that adversaries may exploit. The delegated administrator model for GuardDuty mirrors that of Security Hub, enabling centralised enablement and configuration from the Security Account.

```bash
# Verify GuardDuty integration status in Security Hub
aws securityhub describe-products \
    --product-arn "arn:aws:securityhub:us-east-1::product/aws/guardduty" \
    --region us-east-1

# List product subscriptions to verify integration
aws securityhub list-enabled-products-for-import --region us-east-1
```

GuardDuty finding types cover multiple threat categories including reconnaissance, instance compromise, account compromise, data exfiltration, and cryptocurrency mining. Each finding type has established severity levels that inform prioritisation within Security Hub. Critical and high-severity GuardDuty findings warrant immediate investigation, as they typically indicate active adversary presence requiring rapid response.

### 5.3.2 Inspector Integration

Amazon Inspector provides automated vulnerability assessment for EC2 instances, container images stored in Amazon ECR, and Lambda functions (AWS Inspector, 2025). Inspector continuously scans supported resources for software vulnerabilities and network exposure, generating findings that identify specific CVEs (Common Vulnerabilities and Exposures) and their remediation paths. The integration with Security Hub enables these vulnerability findings to inform the overall security posture assessment.

The Inspector integration operates automatically when both services are enabled, with Inspector findings appearing in Security Hub within minutes of generation. Inspector findings include detailed vulnerability information including CVE identifiers, CVSS scores, affected packages, and remediation recommendations. This information enables security teams to prioritise remediation based on vulnerability severity, exploitation likelihood, and resource criticality.

Inspector's continuous scanning model, introduced in the Inspector 2.0 release, eliminated the need for scheduled assessment runs. Resources are assessed when they launch or change, ensuring that vulnerability information remains current without manual intervention. This continuous model aligns with the continuous compliance principle established in Chapter 3, providing real-time visibility into the vulnerability landscape.

```bash
# Verify Inspector integration status
aws securityhub describe-products \
    --product-arn "arn:aws:securityhub:us-east-1::product/aws/inspector" \
    --region us-east-1

# Enable Inspector across organisation (from Security Account)
aws inspector2 enable \
    --resource-types EC2 ECR LAMBDA \
    --account-ids 111111111111 222222222222 \
    --region us-east-1
```

The correlation between Inspector vulnerability findings and GuardDuty threat findings provides valuable context for incident investigation. When GuardDuty detects exploitation behaviour, Inspector findings identify the vulnerabilities that may have enabled the compromise, accelerating root cause analysis and informing remediation priorities. Security Hub's cross-service correlation capabilities, enhanced in 2025, facilitate this analysis by presenting related findings together (AWS, 2025g).

### 5.3.3 Config Integration

AWS Config provides configuration recording and compliance assessment capabilities that complement Security Hub's security standards (AWS Config, 2024). Config continuously records resource configurations and evaluates them against defined rules, generating compliance findings when configurations deviate from expectations. The integration between Config and Security Hub enables these compliance findings to contribute to the overall security assessment.

Security Hub's compliance standards leverage Config rules for resource evaluation. When a security standard control requires assessment of a specific resource configuration, Security Hub delegates that assessment to Config, which evaluates the resource and returns the compliance result. This architecture ensures that Security Hub benefits from Config's comprehensive resource coverage and evaluation capabilities.

The integration configuration involves ensuring that Config is enabled with appropriate recording configuration in all accounts where Security Hub operates. Config recorders should capture all resource types by default, with exceptions only for resources that generate excessive configuration changes without security relevance. The Config aggregator in the Security Account provides centralised visibility into configuration compliance across the organisation.

```bash
# Verify Config integration status
aws securityhub describe-products \
    --product-arn "arn:aws:securityhub:us-east-1::product/aws/config" \
    --region us-east-1

# Check Config recorder status
aws configservice describe-configuration-recorders \
    --region us-east-1

# Enable Config aggregator for cross-account visibility
aws configservice put-configuration-aggregator \
    --configuration-aggregator-name "OrgAggregator" \
    --organization-aggregation-source '{
        "RoleArn": "arn:aws:iam::123456789012:role/aws-service-role/config.amazonaws.com/AWSServiceRoleForConfig",
        "AllAwsRegions": true
    }' \
    --region us-east-1
```

### 5.3.4 IAM Access Analyzer Integration

IAM Access Analyzer identifies resources that are shared with external entities, helping organisations identify unintended access that may expose sensitive data or functionality (AWS IAM Access Analyzer, 2024). Access Analyzer examines IAM policies, S3 bucket policies, KMS key policies, Lambda function policies, and SQS queue policies to identify resource sharing that extends beyond the organisation boundary.

The integration between Access Analyzer and Security Hub surfaces external access findings alongside other security findings, enabling security teams to maintain visibility into access exposure as part of routine security operations. Access Analyzer findings identify the specific policy statement that enables external access, the external principal that could exercise that access, and the conditions (if any) that limit the access scope.

Access Analyzer operates at the organisation level when configured with organisation scope, automatically analysing resources across all member accounts. This organisation-scoped analysis ensures comprehensive coverage without requiring individual account configuration. The findings aggregate into the Security Account's Security Hub view through the standard cross-account aggregation mechanism.

```bash
# Create organisation-scoped analyzer
aws accessanalyzer create-analyzer \
    --analyzer-name "OrgAnalyzer" \
    --type ORGANIZATION \
    --region us-east-1

# Verify Access Analyzer integration with Security Hub
aws securityhub describe-products \
    --product-arn "arn:aws:securityhub:us-east-1::product/aws/access-analyzer" \
    --region us-east-1
```

### 5.3.5 Third-Party Integration Patterns

Security Hub supports integration with over one hundred third-party security products spanning categories including endpoint protection, vulnerability management, network security, application security, and security information and event management (AWS Security Hub Integrations, 2025). These integrations enable organisations to consolidate security visibility even when their security architecture includes non-AWS components.

Third-party integrations operate through the Security Hub Partner Integration API, which allows authorised products to transmit findings in ASFF format. Each integration requires enablement in Security Hub before findings from that product appear in the console. The enablement process involves subscribing to the product integration and, for some products, configuring the product itself to transmit findings to Security Hub.

```bash
# List available third-party integrations
aws securityhub describe-products \
    --region us-east-1

# Enable a specific integration (example: CrowdStrike)
aws securityhub enable-import-findings-for-product \
    --product-arn "arn:aws:securityhub:us-east-1::product/crowdstrike/crowdstrike-falcon" \
    --region us-east-1

# Verify enabled integrations
aws securityhub list-enabled-products-for-import --region us-east-1
```

Custom integrations for products not available in the Security Hub partner catalogue may be implemented through the BatchImportFindings API. This API enables any authorised principal to transmit findings in ASFF format, enabling organisations to integrate proprietary security tools, custom detection systems, and products from vendors who have not established formal Security Hub partnerships. Custom integrations should implement appropriate error handling, retry logic, and finding deduplication to ensure reliable finding transmission.

```json
{
    "Findings": [
        {
            "SchemaVersion": "2018-10-08",
            "Id": "custom-finding-001",
            "ProductArn": "arn:aws:securityhub:us-east-1:123456789012:product/123456789012/custom",
            "GeneratorId": "custom-detection-system",
            "AwsAccountId": "123456789012",
            "Types": ["Software and Configuration Checks/Vulnerabilities/CVE"],
            "FirstObservedAt": "2025-01-02T12:00:00.000Z",
            "CreatedAt": "2025-01-02T12:00:00.000Z",
            "UpdatedAt": "2025-01-02T12:00:00.000Z",
            "Severity": {
                "Label": "HIGH"
            },
            "Title": "Custom Finding Title",
            "Description": "Detailed description of the finding",
            "Resources": [
                {
                    "Type": "AwsEc2Instance",
                    "Id": "arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0",
                    "Region": "us-east-1"
                }
            ]
        }
    ]
}
```

---

## 5.4 Finding Management and Automation

The volume of findings generated by comprehensive security monitoring exceeds human capacity for individual review and response. Effective security operations require systematic finding management that prioritises high-value findings, automates routine responses, and ensures that findings receive appropriate attention without overwhelming security teams. This section addresses the finding workflow capabilities in Security Hub, the anti-pattern of alert fatigue identified in Chapter 1 (Anti-Pattern #8), and the automation mechanisms that enable response at scale.

### 5.4.1 Finding Workflow States

Security Hub findings progress through workflow states that track their disposition from generation through resolution. Understanding these workflow states enables security teams to implement consistent finding management processes and generate accurate metrics on security posture and response effectiveness.

The primary workflow states include NEW, NOTIFIED, SUPPRESSED, and RESOLVED. Findings begin in the NEW state upon generation, indicating that they have not yet been reviewed or actioned. The NOTIFIED state indicates that the finding has been acknowledged and communicated to relevant parties, though remediation has not yet occurred. The SUPPRESSED state indicates that the finding has been intentionally deprioritised, typically because it represents accepted risk or a known configuration that does not require remediation. The RESOLVED state indicates that the underlying issue has been addressed and the finding no longer represents active risk.

```bash
# Update finding workflow status to NOTIFIED
aws securityhub batch-update-findings \
    --finding-identifiers '[
        {
            "Id": "arn:aws:securityhub:us-east-1:123456789012:subscription/aws-foundational-security-best-practices/v/1.0.0/S3.1/finding/abc123",
            "ProductArn": "arn:aws:securityhub:us-east-1::product/aws/securityhub"
        }
    ]' \
    --workflow '{"Status": "NOTIFIED"}' \
    --region us-east-1

# Update finding workflow status to RESOLVED
aws securityhub batch-update-findings \
    --finding-identifiers '[
        {
            "Id": "arn:aws:securityhub:us-east-1:123456789012:subscription/aws-foundational-security-best-practices/v/1.0.0/S3.1/finding/abc123",
            "ProductArn": "arn:aws:securityhub:us-east-1::product/aws/securityhub"
        }
    ]' \
    --workflow '{"Status": "RESOLVED"}' \
    --region us-east-1
```

The verification state complements workflow state by indicating whether a finding's accuracy has been confirmed. Findings may be marked as TRUE_POSITIVE (verified as accurate), FALSE_POSITIVE (verified as inaccurate), or BENIGN_POSITIVE (accurate but intentional configuration). These classifications inform the tuning of detection systems and the refinement of automation rules that respond to findings.

Organisations should establish standard operating procedures that govern workflow state transitions, defining the criteria for each state and the actions required before transition. These procedures ensure consistent finding handling across the security team and support meaningful metrics on finding resolution rates and response times.

### 5.4.2 Automation Rules Configuration

Automation rules enable Security Hub to execute actions automatically based on finding characteristics, addressing the challenge of managing high finding volumes without proportional increases in security team headcount. The automation rules capability, substantially enhanced in the 2025 release, supports sophisticated rule definitions that consider multiple finding attributes and execute diverse response actions (AWS, 2025h).

Automation rules evaluate findings against defined criteria and execute specified actions when criteria are met. Available actions include suppressing findings (moving to SUPPRESSED workflow state), updating finding severity, adding notes to findings, and updating arbitrary finding fields. The rules engine processes findings in near real-time, typically executing within seconds of finding generation.

```json
{
    "RuleName": "SuppressDevelopmentAccountLowFindings",
    "RuleOrder": 100,
    "Description": "Suppress LOW severity findings in development accounts",
    "IsTerminal": false,
    "Criteria": {
        "AwsAccountId": [
            {
                "Value": "444444444444",
                "Comparison": "EQUALS"
            },
            {
                "Value": "555555555555",
                "Comparison": "EQUALS"
            }
        ],
        "SeverityLabel": [
            {
                "Value": "LOW",
                "Comparison": "EQUALS"
            }
        ],
        "RecordState": [
            {
                "Value": "ACTIVE",
                "Comparison": "EQUALS"
            }
        ]
    },
    "Actions": [
        {
            "Type": "FINDING_FIELDS_UPDATE",
            "FindingFieldsUpdate": {
                "Workflow": {
                    "Status": "SUPPRESSED"
                },
                "Note": {
                    "Text": "Automatically suppressed: LOW severity in development account",
                    "UpdatedBy": "automation-rule"
                }
            }
        }
    ]
}
```

```bash
# Create automation rule
aws securityhub create-automation-rule \
    --rule-name "SuppressDevelopmentAccountLowFindings" \
    --rule-order 100 \
    --description "Suppress LOW severity findings in development accounts" \
    --criteria '{
        "AwsAccountId": [{"Value": "444444444444", "Comparison": "EQUALS"}],
        "SeverityLabel": [{"Value": "LOW", "Comparison": "EQUALS"}]
    }' \
    --actions '[{
        "Type": "FINDING_FIELDS_UPDATE",
        "FindingFieldsUpdate": {
            "Workflow": {"Status": "SUPPRESSED"}
        }
    }]' \
    --region us-east-1
```

Automation rules should be designed with clear business justification, documented rationale, and periodic review schedules. Rules that suppress findings require particular scrutiny, as over-aggressive suppression may mask genuine security issues. The rule order parameter determines evaluation sequence when multiple rules might match a finding, enabling prioritised rule application.

### 5.4.3 Custom Actions

Custom actions provide a mechanism for security analysts to initiate defined responses from within the Security Hub console. When an analyst selects one or more findings and invokes a custom action, Security Hub publishes an event to Amazon EventBridge that identifies the selected findings and the action invoked. This event can trigger Lambda functions, Step Functions workflows, or other targets that implement the desired response.

Custom actions enable organisations to implement response workflows that align with their specific operational procedures. Common use cases include escalating findings to incident management systems, creating tickets in service management platforms, triggering remediation automation, and sending notifications to specific communication channels. The flexibility of the EventBridge integration enables virtually any response workflow that can be implemented through AWS services or third-party integrations.

```bash
# Create custom action
aws securityhub create-action-target \
    --name "EscalateToSIEM" \
    --description "Escalate selected findings to SIEM for investigation" \
    --id "EscalateToSIEM" \
    --region us-east-1

# Create EventBridge rule for custom action
aws events put-rule \
    --name "SecurityHubEscalateToSIEM" \
    --event-pattern '{
        "source": ["aws.securityhub"],
        "detail-type": ["Security Hub Findings - Custom Action"],
        "detail": {
            "actionName": ["EscalateToSIEM"]
        }
    }' \
    --region us-east-1

# Configure rule target (Lambda function for SIEM integration)
aws events put-targets \
    --rule "SecurityHubEscalateToSIEM" \
    --targets '[{
        "Id": "SIEMIntegrationFunction",
        "Arn": "arn:aws:lambda:us-east-1:123456789012:function:siem-integration"
    }]' \
    --region us-east-1
```

Custom actions appear in the Security Hub console alongside default actions, enabling analysts to invoke them with selected findings. The event payload includes the complete finding details for all selected findings, enabling response workflows to access the full context necessary for appropriate action.

### 5.4.4 EventBridge Integration

Amazon EventBridge provides the event routing infrastructure that enables automated response to Security Hub findings (AWS EventBridge, 2024). Security Hub publishes events for finding imports, finding updates, and custom action invocations, enabling organisations to implement event-driven security operations that respond to security events in near real-time.

The integration between Security Hub and EventBridge enables sophisticated automation architectures that address the full spectrum of security response requirements. High-severity findings may trigger immediate remediation through Lambda functions. Medium-severity findings may create tickets in service management systems for scheduled review. Low-severity findings may aggregate into daily summary reports. The flexibility of EventBridge rules enables differentiated responses based on any combination of finding attributes.

```json
{
    "source": ["aws.securityhub"],
    "detail-type": ["Security Hub Findings - Imported"],
    "detail": {
        "findings": {
            "Severity": {
                "Label": ["CRITICAL", "HIGH"]
            },
            "Compliance": {
                "Status": ["FAILED"]
            },
            "RecordState": ["ACTIVE"],
            "Workflow": {
                "Status": ["NEW"]
            }
        }
    }
}
```

This EventBridge rule pattern matches high-severity compliance failures that are new and active, enabling automated response to the most urgent security issues. The pattern can be refined further to target specific control types, resource types, or account subsets based on organisational requirements.

See Chapter 7 for Security Lake integration that provides advanced analytics capabilities building on the EventBridge event flow. See Chapter 6 for container security integration patterns that leverage this EventBridge architecture for container-specific response workflows.

---

## 5.5 Finding Lifecycle Management

Findings progress through a lifecycle from initial generation through eventual archival or resolution. Effective lifecycle management ensures that findings receive appropriate attention during their active period and transition to archived states when they no longer require active management. This section addresses the processes and configurations that govern finding lifecycle management in enterprise Security Hub deployments.

### 5.5.1 New Finding Processing

New findings require systematic processing that ensures they receive appropriate attention based on their severity, affected resources, and compliance implications. The processing workflow should be documented in operational procedures and implemented through a combination of automation rules and human review processes.

The initial processing of new findings involves triage to determine appropriate response. Critical and high-severity findings typically require immediate human review and may warrant incident response procedures. Medium-severity findings may be assigned to security team queues for review during normal operating hours. Low-severity findings may be processed in batches during regular maintenance periods or automatically suppressed based on defined criteria.

```bash
# Query new findings requiring triage
aws securityhub get-findings \
    --filters '{
        "WorkflowStatus": [{"Value": "NEW", "Comparison": "EQUALS"}],
        "RecordState": [{"Value": "ACTIVE", "Comparison": "EQUALS"}],
        "SeverityLabel": [{"Value": "CRITICAL", "Comparison": "EQUALS"}]
    }' \
    --sort-criteria '{"Field": "CreatedAt", "SortOrder": "desc"}' \
    --max-results 100 \
    --region us-east-1
```

The triage process should result in one of several outcomes: escalation to incident response for findings indicating active threats, assignment to remediation queues for findings requiring configuration changes, suppression for findings representing accepted risk or known configurations, or resolution for findings that investigation reveals to be false positives. Each outcome should be reflected in the finding's workflow state, maintaining accurate records for metrics and audit purposes.

Automation rules should handle routine triage decisions that do not require human judgment. Findings from specific account types, resource categories, or severity levels may have predetermined dispositions that automation can apply consistently. This automation preserves human attention for findings that genuinely require expert analysis, addressing the alert fatigue anti-pattern by reducing the volume of findings requiring manual review (Anti-Pattern #8).

### 5.5.2 Suppression Rules

Suppression rules enable organisations to systematically deprioritise findings that represent accepted risk, known configurations, or assessment limitations rather than genuine security concerns. Effective suppression prevents these findings from consuming analyst attention whilst maintaining their presence in the finding record for audit and compliance purposes.

Suppression should be approached as a deliberate risk acceptance decision rather than a convenience measure. Each suppression rule should have documented business justification, approval from appropriate stakeholders, and defined review periods to ensure continued appropriateness. Suppression rules that remain in place indefinitely without review may mask genuine security issues that emerge as the environment evolves.

```json
{
    "RuleName": "SuppressSecurityGroupFindings-LegacyApp",
    "RuleOrder": 200,
    "Description": "Suppress security group findings for legacy application with documented exception",
    "Criteria": {
        "ResourceId": [
            {
                "Value": "arn:aws:ec2:us-east-1:123456789012:security-group/sg-legacy12345",
                "Comparison": "EQUALS"
            }
        ],
        "Type": [
            {
                "Value": "Software and Configuration Checks/Industry and Regulatory Standards",
                "Comparison": "PREFIX"
            }
        ]
    },
    "Actions": [
        {
            "Type": "FINDING_FIELDS_UPDATE",
            "FindingFieldsUpdate": {
                "Workflow": {
                    "Status": "SUPPRESSED"
                },
                "Note": {
                    "Text": "Suppressed per exception EXC-2025-001. Review date: 2025-07-01",
                    "UpdatedBy": "security-exceptions"
                }
            }
        }
    ]
}
```

Suppression rules should include documentation references that link to the formal exception approval, enabling auditors to verify that suppressions have appropriate authorisation. The review date notation in the note field provides a reminder for periodic reassessment, ensuring that suppressions do not persist beyond their intended duration.

### 5.5.3 Archiving and Retention

Findings transition from active to archived states through two mechanisms: automatic archival when the underlying resource is deleted or when the finding is resolved by configuration changes, and manual archival through workflow state updates. Archived findings remain accessible for historical analysis and audit purposes but do not appear in default console views or metric calculations.

The retention of archived findings is governed by Security Hub's default retention policy, which maintains findings for 90 days after archival. Organisations with longer retention requirements should implement finding export to Amazon S3 or Amazon Security Lake, preserving finding data beyond the Security Hub retention window. This export ensures that historical finding data remains available for trend analysis, audit response, and forensic investigation.

```bash
# Export findings to S3 for long-term retention
aws securityhub export-findings \
    --filters '{
        "RecordState": [{"Value": "ARCHIVED", "Comparison": "EQUALS"}]
    }' \
    --region us-east-1

# Configure finding export to S3 (requires additional setup)
aws securityhub create-finding-export-configuration \
    --export-destination-type S3 \
    --export-destination-configuration '{
        "S3": {
            "BucketName": "security-hub-findings-archive",
            "KeyPrefix": "findings/",
            "KmsKeyArn": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
        }
    }' \
    --region us-east-1
```

The archiving workflow should include verification that archived findings genuinely represent resolved issues. Automated archival based on resource deletion may inadvertently archive findings for resources that were deleted as part of an attack rather than legitimate decommissioning. Security teams should review archived findings periodically to identify any that warrant further investigation.

### 5.5.4 Deduplication Strategies

The aggregation of findings from multiple security services and compliance standards inevitably generates duplicate findings for the same underlying issue. Effective deduplication strategies reduce finding volume whilst preserving the compliance evidence that each standard provides, preventing the alert fatigue that results from reviewing the same issue multiple times across different frameworks.

Security Hub's 2025 control-based finding consolidation provides native deduplication for findings generated by the same underlying control across multiple standards. When FSBP, CIS, and NIST all assess the same resource configuration, Security Hub presents a single consolidated finding that references all applicable standards rather than separate findings for each. This consolidation significantly reduces finding volume for organisations enabling multiple compliance standards.

For findings from different services that identify the same underlying issue, Security Hub provides correlation capabilities that link related findings. The AwsSecurityFindingId and RelatedFindings fields enable organisations to establish relationships between findings, supporting investigation workflows that consider related findings together. Automation rules may be configured to suppress or annotate duplicate findings based on these relationships.

```json
{
    "RuleName": "LinkRelatedFindings",
    "Description": "Add note linking Inspector findings to related GuardDuty findings",
    "Criteria": {
        "ProductName": [{"Value": "Inspector", "Comparison": "EQUALS"}],
        "ResourceId": [{"Value": "arn:aws:ec2:us-east-1:123456789012:instance/i-compromised123", "Comparison": "EQUALS"}]
    },
    "Actions": [
        {
            "Type": "FINDING_FIELDS_UPDATE",
            "FindingFieldsUpdate": {
                "Note": {
                    "Text": "Related to GuardDuty finding GD-2025-001. See finding for threat context.",
                    "UpdatedBy": "correlation-automation"
                }
            }
        }
    ]
}
```

Organisations should establish deduplication procedures that identify the authoritative finding for each security issue and annotate or suppress duplicates whilst maintaining the audit trail that compliance requires. The authoritative finding should be the one with the most complete information and the clearest remediation path, typically originating from the service with the deepest insight into the specific issue type.

---

## Chapter Summary

This chapter has provided comprehensive guidance for configuring AWS Security Hub as the central platform for cloud security posture management across enterprise AWS Organizations. Building on the governance framework established in Chapter 4 and the architectural principles defined in Chapter 3, the configuration procedures presented here enable organisations to implement unified security visibility across hundreds of accounts and multiple regions.

The Security Hub setup procedures established the delegated administrator relationship that enables centralised security operations, configured cross-region aggregation that ensures visibility regardless of resource location, and implemented cross-account aggregation that consolidates findings across the account portfolio. These configurations address Anti-Pattern #2 (missing cross-region aggregation) by establishing comprehensive aggregation from the outset.

The security standards configuration section provided guidance for enabling AWS Foundational Security Best Practices, CIS AWS Foundations Benchmark v3.0, NIST 800-53 Rev. 5, and PCI-DSS v4.0, along with patterns for custom standards that address organisation-specific requirements. These standards provide the continuous compliance assessment that addresses Anti-Pattern #10 (point-in-time assessments) by replacing periodic audits with real-time configuration monitoring.

The service integrations section detailed the native integrations with GuardDuty, Inspector, Config, and IAM Access Analyzer that enable Security Hub to serve as the single pane of glass for security operations, along with patterns for third-party integration that extend this visibility to non-AWS security tools. The ASFF (AWS Security Finding Format) ensures consistent finding representation regardless of source.

The finding management and automation section addressed the operational challenge of managing high finding volumes, providing guidance for workflow states, automation rules, custom actions, and EventBridge integration that enable response at scale. These capabilities address Anti-Pattern #8 (alert fatigue) by enabling automated handling of routine findings and prioritised presentation of high-value security events.

The finding lifecycle management section established procedures for new finding processing, suppression rules, archiving and retention, and deduplication strategies that ensure findings receive appropriate attention throughout their lifecycle whilst preventing duplicate findings from consuming disproportionate analyst time.

See Chapter 6 for container security integration patterns that extend Security Hub coverage to containerised workloads. See Chapter 7 for Security Lake integration that provides advanced analytics capabilities for security telemetry stored in OCSF format.

---

*Word Count: Approximately 6,480 words*

*Chapter 5 Complete - Proceed to Chapter 6: Container Security Integration*

---

## References

AWS. (2025a). *AWS Security Hub User Guide*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/

AWS. (2025b). *Designating a Security Hub delegated administrator*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/designate-orgs-admin-account.html

AWS. (2025c). *Central configuration in Security Hub*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/central-configuration.html

AWS. (2025d). *Cross-Region aggregation*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/finding-aggregation.html

AWS. (2025e). *AWS Foundational Security Best Practices controls*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/fsbp-standard.html

AWS. (2025f). *Control-based finding consolidation*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/controls-findings-consolidation.html

AWS. (2025g). *Security Hub 2025 GA announcement*. Amazon Web Services. https://aws.amazon.com/about-aws/whats-new/2025/01/aws-security-hub-enhanced-capabilities/

AWS. (2025h). *Automation rules in Security Hub*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/automation-rules.html

AWS Config. (2024). *AWS Config Developer Guide*. Amazon Web Services. https://docs.aws.amazon.com/config/latest/developerguide/

AWS EventBridge. (2024). *Amazon EventBridge User Guide*. Amazon Web Services. https://docs.aws.amazon.com/eventbridge/latest/userguide/

AWS GuardDuty. (2025). *Amazon GuardDuty User Guide*. Amazon Web Services. https://docs.aws.amazon.com/guardduty/latest/ug/

AWS IAM Access Analyzer. (2024). *Using IAM Access Analyzer*. Amazon Web Services. https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html

AWS Inspector. (2025). *Amazon Inspector User Guide*. Amazon Web Services. https://docs.aws.amazon.com/inspector/latest/user/

AWS Security Hub Integrations. (2025). *Available third-party partner product integrations*. Amazon Web Services. https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-partner-providers.html

CIS. (2024). *CIS Amazon Web Services Foundations Benchmark v3.0*. Center for Internet Security. https://www.cisecurity.org/benchmark/amazon_web_services

NIST. (2020). *Security and Privacy Controls for Information Systems and Organizations*. National Institute of Standards and Technology. Special Publication 800-53 Revision 5. https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final

PCI Security Standards Council. (2022). *Payment Card Industry Data Security Standard v4.0*. PCI SSC. https://www.pcisecuritystandards.org/document_library/
