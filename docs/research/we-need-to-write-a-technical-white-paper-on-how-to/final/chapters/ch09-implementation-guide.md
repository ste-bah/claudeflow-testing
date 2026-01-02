# Chapter 9: Implementation Guide

## 9.1 Prerequisites and Planning

The successful implementation of a unified AWS security posture management solution requires methodical preparation that establishes the foundational elements upon which subsequent deployment phases depend. Implementing the architecture described in Chapter 3 without adequate prerequisite configuration results in deployment failures, misconfigured services, and security gaps that undermine the intended protective capabilities. This section delineates the essential prerequisites and planning activities that organisations must complete before commencing implementation, encompassing AWS account requirements, IAM permissions, network considerations, and timeline planning.

### 9.1.1 AWS Account Requirements

The reference architecture necessitates an AWS Organizations structure with specific accounts serving defined roles within the security ecosystem. Organisations that have not yet established AWS Organizations must create the organisation from what will become the Management Account, a process that cannot be reversed without significant disruption. For existing organisations, the prerequisite assessment focuses on verifying that the account structure aligns with the architectural requirements established in Chapter 3.

AWS Organizations must be enabled with all features activated, not merely consolidated billing. The all features mode enables Service Control Policies, delegated administrator assignments, and organisation-wide service enablement that the security architecture requires. Organisations operating in consolidated billing mode must upgrade to all features, a process requiring acceptance from all member accounts and potentially disrupting existing configurations.

The Security Account, which serves as the delegated administrator for security services, must exist as a dedicated account within the organisation. This account should contain no workloads and should not be repurposed from existing accounts containing operational resources. Creating a new account specifically for security administration ensures clean separation of concerns and prevents the accumulation of legacy permissions or configurations that might conflict with security service requirements.

The Log Archive Account provides immutable storage for security telemetry and must similarly exist as a dedicated account. This account hosts Amazon Security Lake and receives CloudTrail logs from the organisation trail. The Log Archive Account requires S3 bucket configurations that prevent deletion and modification, necessitating careful initial setup that cannot be easily modified after data ingestion commences.

Verification of existing account structure should confirm that no security services are currently enabled in the Management Account, as service enablement in this account conflicts with the governance-only principle established in Chapter 3. Organisations with existing Security Hub, GuardDuty, or Inspector deployments in the Management Account must disable and remove these services before implementing the reference architecture.

### 9.1.2 IAM Permissions Checklist

The deployment of organisation-wide security services requires IAM permissions that span multiple accounts and enable cross-account operations. The permissions model follows the principle of least privilege whilst providing sufficient access for deployment automation and ongoing administration. Based on the governance mechanisms described in Chapter 4, the following permissions categories require configuration.

The deployment role, typically assumed by infrastructure automation or deployment engineers, requires permissions to create and configure AWS resources across the Security Account, Log Archive Account, and member accounts. This role must possess the ability to enable AWS services, create IAM roles, configure S3 buckets, and establish cross-account trust relationships. The deployment role should be scoped to specific actions rather than employing administrative access, though the breadth of required permissions necessitates careful definition.

```hcl
# Terraform: Deployment role policy document
data "aws_iam_policy_document" "deployment_role" {
  statement {
    sid    = "OrganizationsManagement"
    effect = "Allow"
    actions = [
      "organizations:DescribeOrganization",
      "organizations:ListAccounts",
      "organizations:ListRoots",
      "organizations:ListOrganizationalUnitsForParent",
      "organizations:DescribeOrganizationalUnit",
      "organizations:EnableAWSServiceAccess",
      "organizations:RegisterDelegatedAdministrator",
      "organizations:ListDelegatedAdministrators"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "SecurityHubManagement"
    effect = "Allow"
    actions = [
      "securityhub:EnableSecurityHub",
      "securityhub:EnableOrganizationAdminAccount",
      "securityhub:UpdateOrganizationConfiguration",
      "securityhub:CreateFindingAggregator",
      "securityhub:BatchEnableStandards",
      "securityhub:UpdateSecurityHubConfiguration"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "GuardDutyManagement"
    effect = "Allow"
    actions = [
      "guardduty:EnableOrganizationAdminAccount",
      "guardduty:CreateDetector",
      "guardduty:UpdateOrganizationConfiguration",
      "guardduty:CreateMembers",
      "guardduty:UpdateDetector"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "InspectorManagement"
    effect = "Allow"
    actions = [
      "inspector2:Enable",
      "inspector2:EnableDelegatedAdminAccount",
      "inspector2:UpdateOrganizationConfiguration",
      "inspector2:BatchGetAccountStatus"
    ]
    resources = ["*"]
  }
}
```

Cross-account access configuration establishes the trust relationships enabling the Security Account to administer member accounts. Each member account requires an IAM role that trusts the Security Account and permits security service configuration. These roles should be created through AWS Organizations stack sets or Terraform modules that ensure consistent configuration across all accounts.

The least privilege principle demands that operational roles following deployment possess more restrictive permissions than deployment roles. Security analysts require read access to findings and investigation tools but should not possess the ability to modify security service configurations. Incident responders require additional permissions for remediation actions but should not access configuration management functions. This separation prevents operational activities from inadvertently modifying the security architecture.

### 9.1.3 Network Prerequisites

Certain security service functions require network connectivity that may not exist in default VPC configurations. Lambda functions executing automated remediation require outbound internet access to invoke AWS APIs, necessitating either NAT Gateway configuration or VPC endpoints. The network prerequisites assessment must verify connectivity requirements before deployment to prevent automation failures.

NAT Gateway provisioning provides the most straightforward path to Lambda internet connectivity. Lambda functions deployed within a VPC cannot access AWS APIs or the internet without explicit routing through NAT Gateways or VPC endpoints. Organisations should provision NAT Gateways in each Availability Zone where Lambda functions will execute, ensuring high availability for automated remediation workflows.

VPC endpoints offer an alternative connectivity model that eliminates internet traversal for AWS API calls. PrivateLink endpoints for Security Hub, GuardDuty, Systems Manager, and other services enable Lambda functions to invoke APIs without NAT Gateway routing. This approach provides security benefits through reduced internet exposure but requires endpoint provisioning in each VPC where Lambda functions operate.

```hcl
# Terraform: VPC endpoints for security services
resource "aws_vpc_endpoint" "securityhub" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.region}.securityhub"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name        = "securityhub-endpoint"
    Environment = var.environment
  }
}

resource "aws_vpc_endpoint" "guardduty" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.region}.guardduty-data"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name        = "guardduty-endpoint"
    Environment = var.environment
  }
}

resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "vpc-endpoints-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name = "vpc-endpoints-sg"
  }
}
```

The network architecture must accommodate cross-region finding aggregation, which generates data transfer between regions. Whilst this traffic utilises AWS backbone infrastructure rather than public internet paths, organisations should verify that network security policies permit cross-region communication for security services.

### 9.1.4 Implementation Timeline

A phased implementation approach reduces risk by validating each deployment stage before proceeding to dependent configurations. The timeline presented here reflects experience from enterprise deployments and accounts for the validation checkpoints necessary to ensure successful completion. Based on the cost considerations established in Chapter 8, the phased approach also enables cost monitoring at each stage.

**Phase 1: Foundation (Weeks 1-2)** encompasses AWS Organizations configuration, Security Account provisioning, and delegated administrator assignment. This phase establishes the account structure and administrative relationships upon which subsequent phases depend. Validation at phase completion confirms that delegated administrator accounts can enumerate member accounts and that trust relationships function correctly.

**Phase 2: Security Services (Weeks 3-4)** deploys Security Hub, GuardDuty, Inspector, and Detective across the organisation. Each service requires configuration in the delegated administrator account followed by organisation-wide enablement. Validation confirms finding generation in member accounts and successful aggregation to the Security Account.

**Phase 3: Integration (Weeks 5-6)** establishes cross-region aggregation, Security Lake configuration, and CI/CD pipeline integration for container scanning. This phase connects the security services into a cohesive system and integrates with development workflows. Validation confirms cross-region finding visibility and pipeline functionality.

**Phase 4: Operationalisation (Weeks 7-8)** deploys automation rules, dashboards, alerting, and runbooks that transform the technical deployment into an operational security capability. This phase requires coordination with security operations teams who will assume responsibility for ongoing management.

Risk mitigation throughout the implementation timeline requires rollback procedures for each phase. The infrastructure-as-code approach using Terraform or CDK, detailed in Appendix A and Appendix B respectively, enables rapid rollback through state management and resource destruction. Organisations should test rollback procedures in non-production environments before production deployment.

---

## 9.2 Phase 1: Foundation

The foundation phase establishes the organisational structure and administrative relationships that subsequent phases require. Without correct foundation configuration, security services cannot be enabled organisation-wide, delegated administration fails, and the centralised visibility promised by the architecture remains unachievable. This phase demands particular attention to detail, as errors in foundation configuration propagate to all subsequent phases and may require complete redeployment to correct.

### 9.2.1 Organisations and OU Setup

AWS Organizations Organisational Units (OUs) provide the logical grouping structure through which Service Control Policies apply and security services enable. The reference architecture requires specific OUs for security, infrastructure, and workload accounts, enabling differentiated policy application and targeted service enablement.

Creating the OU structure follows a hierarchical approach that reflects both organisational structure and security requirements. The Security OU contains the Security Account and Log Archive Account, isolating these critical accounts from workload policies that might inadvertently restrict security operations. The Infrastructure OU hosts shared services accounts that support but do not directly participate in security operations. Workload OUs, potentially subdivided by environment type or business unit, contain the member accounts where security findings originate.

```hcl
# Terraform: Organizations OU creation
resource "aws_organizations_organizational_unit" "security" {
  name      = "Security"
  parent_id = data.aws_organizations_organization.current.roots[0].id

  tags = {
    Purpose     = "Security and audit accounts"
    ManagedBy   = "Terraform"
    Environment = "production"
  }
}

resource "aws_organizations_organizational_unit" "infrastructure" {
  name      = "Infrastructure"
  parent_id = data.aws_organizations_organization.current.roots[0].id

  tags = {
    Purpose     = "Shared infrastructure accounts"
    ManagedBy   = "Terraform"
    Environment = "production"
  }
}

resource "aws_organizations_organizational_unit" "workloads" {
  name      = "Workloads"
  parent_id = data.aws_organizations_organization.current.roots[0].id

  tags = {
    Purpose     = "Business workload accounts"
    ManagedBy   = "Terraform"
    Environment = "production"
  }
}

resource "aws_organizations_organizational_unit" "workloads_production" {
  name      = "Production"
  parent_id = aws_organizations_organizational_unit.workloads.id

  tags = {
    Purpose     = "Production workload accounts"
    ManagedBy   = "Terraform"
    Environment = "production"
  }
}

resource "aws_organizations_organizational_unit" "workloads_development" {
  name      = "Development"
  parent_id = aws_organizations_organizational_unit.workloads.id

  tags = {
    Purpose     = "Development workload accounts"
    ManagedBy   = "Terraform"
    Environment = "development"
  }
}
```

Account placement within OUs determines which Service Control Policies apply and influences security service behaviour. The Security Account and Log Archive Account should be moved to the Security OU immediately upon OU creation. Existing workload accounts require assessment to determine appropriate OU placement based on their environment classification and risk profile.

### 9.2.2 Security Account Creation

The Security Account serves as the operational centre for security activities, hosting delegated administrator configurations and providing the unified console through which security teams conduct their work. Creating this account with correct initial configuration prevents the need for disruptive reconfiguration after security services are operational.

Account creation through AWS Organizations establishes the account as an organisation member with appropriate trust relationships. The account should be created with a dedicated email address that routes to the security team rather than individual administrators, ensuring continuity of access regardless of personnel changes.

```hcl
# Terraform: Security Account creation
resource "aws_organizations_account" "security" {
  name      = "Security"
  email     = "aws-security@example.com"
  parent_id = aws_organizations_organizational_unit.security.id

  role_name = "OrganizationAccountAccessRole"

  iam_user_access_to_billing = "DENY"

  tags = {
    Purpose     = "Security delegated administrator"
    ManagedBy   = "Terraform"
    Environment = "production"
    CostCenter  = "security-operations"
  }

  lifecycle {
    ignore_changes = [role_name]
  }
}
```

Baseline configuration of the Security Account encompasses IAM role creation, CloudTrail enablement, and initial security hardening. The OrganizationAccountAccessRole created automatically during account provisioning provides initial administrative access, but organisations should create purpose-specific roles for ongoing administration rather than relying on this broad-access role.

IAM role setup within the Security Account establishes the roles that security services and automation will assume. The SecurityHubAdmin role requires permissions to manage Security Hub configuration across the organisation. The AutomationExecution role provides permissions for remediation workflows whilst constraining actions to approved remediation patterns.

### 9.2.3 Delegated Administrator Assignment

Delegated administrator assignment transfers administrative authority for specific AWS services from the Management Account to the Security Account, enabling security operations without requiring Management Account access. Each security service requires individual delegation, and the delegation sequence matters due to service interdependencies.

The delegation process commences with enabling AWS service access within AWS Organizations, which permits the specified service to operate across organisation accounts. Following service access enablement, the delegated administrator registration designates the Security Account as the administrator for that service.

```hcl
# Terraform: Delegated administrator assignment
resource "aws_organizations_delegated_administrator" "securityhub" {
  account_id        = aws_organizations_account.security.id
  service_principal = "securityhub.amazonaws.com"

  depends_on = [aws_organizations_account.security]
}

resource "aws_organizations_delegated_administrator" "guardduty" {
  account_id        = aws_organizations_account.security.id
  service_principal = "guardduty.amazonaws.com"

  depends_on = [aws_organizations_account.security]
}

resource "aws_organizations_delegated_administrator" "inspector2" {
  account_id        = aws_organizations_account.security.id
  service_principal = "inspector2.amazonaws.com"

  depends_on = [aws_organizations_account.security]
}

resource "aws_organizations_delegated_administrator" "securitylake" {
  account_id        = aws_organizations_account.security.id
  service_principal = "securitylake.amazonaws.com"

  depends_on = [aws_organizations_account.security]
}

# Enable AWS service access for security services
resource "aws_organizations_organization" "main" {
  aws_service_access_principals = [
    "securityhub.amazonaws.com",
    "guardduty.amazonaws.com",
    "inspector2.amazonaws.com",
    "securitylake.amazonaws.com",
    "config.amazonaws.com",
    "cloudtrail.amazonaws.com"
  ]

  feature_set = "ALL"

  enabled_policy_types = [
    "SERVICE_CONTROL_POLICY",
    "TAG_POLICY"
  ]
}
```

Verification of delegated administrator assignment confirms that the Security Account can access organisation-wide service configuration. From the Security Account, administrators should verify that they can view member accounts, access organisation configuration settings, and initiate organisation-wide operations. Verification failures indicate incomplete delegation or missing trust relationships that require correction before proceeding.

### 9.2.4 Terraform Module: Foundation

The foundation Terraform module consolidates the resources described in preceding subsections into a reusable, version-controlled infrastructure definition. This module serves as the entry point for implementation, with subsequent modules depending on the outputs it produces.

The module structure follows Terraform best practices with clear input variables, resource definitions, and output values that downstream modules consume. See Appendix A for the complete module implementation including all variable definitions and resource configurations.

```hcl
# Terraform: Foundation module structure
# File: modules/foundation/main.tf

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }
}

# Data sources for existing organization
data "aws_organizations_organization" "current" {}

data "aws_caller_identity" "current" {}

# Create organizational units
resource "aws_organizations_organizational_unit" "security" {
  name      = var.security_ou_name
  parent_id = data.aws_organizations_organization.current.roots[0].id
  tags      = var.tags
}

resource "aws_organizations_organizational_unit" "workloads" {
  name      = var.workloads_ou_name
  parent_id = data.aws_organizations_organization.current.roots[0].id
  tags      = var.tags
}

# Create Security Account
resource "aws_organizations_account" "security" {
  name      = var.security_account_name
  email     = var.security_account_email
  parent_id = aws_organizations_organizational_unit.security.id
  role_name = var.organization_access_role_name

  iam_user_access_to_billing = "DENY"
  tags                       = var.tags

  lifecycle {
    ignore_changes = [role_name]
  }
}

# Create Log Archive Account
resource "aws_organizations_account" "log_archive" {
  name      = var.log_archive_account_name
  email     = var.log_archive_account_email
  parent_id = aws_organizations_organizational_unit.security.id
  role_name = var.organization_access_role_name

  iam_user_access_to_billing = "DENY"
  tags                       = var.tags

  lifecycle {
    ignore_changes = [role_name]
  }
}

# File: modules/foundation/outputs.tf
output "security_account_id" {
  description = "The ID of the Security Account"
  value       = aws_organizations_account.security.id
}

output "log_archive_account_id" {
  description = "The ID of the Log Archive Account"
  value       = aws_organizations_account.log_archive.id
}

output "security_ou_id" {
  description = "The ID of the Security OU"
  value       = aws_organizations_organizational_unit.security.id
}

output "workloads_ou_id" {
  description = "The ID of the Workloads OU"
  value       = aws_organizations_organizational_unit.workloads.id
}
```

Variable configuration requires organisation-specific values including account email addresses, OU naming conventions, and tagging standards. The variables file should be populated with values that align with organisational naming conventions and comply with any existing governance requirements for AWS resource naming.

---

## 9.3 Phase 2: Security Services

With the foundation established, the security services phase enables the detection and assessment capabilities that generate security findings. This phase requires execution from the Security Account, leveraging the delegated administrator permissions established in Phase 1. Each service follows a similar enablement pattern: configure the service in the delegated administrator account, enable organisation-wide deployment, and verify finding generation across member accounts.

### 9.3.1 Security Hub Enablement

Security Hub serves as the aggregation and correlation layer for the security architecture, receiving findings from other services and providing the unified dashboard through which security teams operate. Enabling Security Hub organisation-wide establishes the finding pipeline that subsequent services will populate.

Organisation-wide enablement through the delegated administrator account automatically enables Security Hub in all existing member accounts and configures automatic enablement for accounts created subsequently. The organisation configuration specifies whether member accounts may independently manage their Security Hub settings or must inherit central configuration.

```hcl
# Terraform: Security Hub organisation enablement
resource "aws_securityhub_organization_admin_account" "main" {
  admin_account_id = var.security_account_id

  depends_on = [aws_organizations_delegated_administrator.securityhub]
}

resource "aws_securityhub_organization_configuration" "main" {
  provider = aws.security_account

  auto_enable           = true
  auto_enable_standards = "DEFAULT"

  organization_configuration {
    configuration_type = "CENTRAL"
  }

  depends_on = [aws_securityhub_organization_admin_account.main]
}

# Enable Security Hub in the admin account first
resource "aws_securityhub_account" "main" {
  provider = aws.security_account

  enable_default_standards = true
  control_finding_generator = "SECURITY_CONTROL"
  auto_enable_controls     = true
}

# Enable specific security standards
resource "aws_securityhub_standards_subscription" "aws_foundational" {
  provider      = aws.security_account
  standards_arn = "arn:aws:securityhub:${var.region}::standards/aws-foundational-security-best-practices/v/1.0.0"

  depends_on = [aws_securityhub_account.main]
}

resource "aws_securityhub_standards_subscription" "cis" {
  provider      = aws.security_account
  standards_arn = "arn:aws:securityhub:${var.region}::standards/cis-aws-foundations-benchmark/v/1.4.0"

  depends_on = [aws_securityhub_account.main]
}
```

Standard selection determines which compliance frameworks Security Hub evaluates resources against. The AWS Foundational Security Best Practices standard provides essential coverage for all organisations. Additional standards including CIS AWS Foundations Benchmark, PCI DSS, and SOC 2 should be enabled based on regulatory requirements and organisational risk tolerance. Each enabled standard increases Security Hub costs proportionally to resource counts, as documented in Chapter 8.

Cross-region aggregation requires separate configuration following initial enablement. The aggregation configuration designates one region as the aggregation region and links additional regions to forward their findings. This configuration enables the single-pane-of-glass visibility that the architecture promises, regardless of which region resources reside in.

### 9.3.2 GuardDuty Enablement

Amazon GuardDuty provides threat detection capabilities through analysis of CloudTrail logs, VPC Flow Logs, and DNS query logs. The delegated administrator configuration enables organisation-wide GuardDuty deployment with centralised finding management and consistent feature configuration.

```hcl
# Terraform: GuardDuty organisation enablement
resource "aws_guardduty_organization_admin_account" "main" {
  admin_account_id = var.security_account_id

  depends_on = [aws_organizations_delegated_administrator.guardduty]
}

resource "aws_guardduty_detector" "main" {
  provider = aws.security_account

  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }

  tags = var.tags
}

resource "aws_guardduty_organization_configuration" "main" {
  provider = aws.security_account

  auto_enable_organization_members = "ALL"
  detector_id                      = aws_guardduty_detector.main.id

  datasources {
    s3_logs {
      auto_enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          auto_enable = true
        }
      }
    }
  }

  depends_on = [aws_guardduty_organization_admin_account.main]
}
```

Feature selection determines which GuardDuty capabilities are enabled across the organisation. S3 Protection analyses S3 data events to detect suspicious access patterns. Kubernetes Audit Log Monitoring analyses EKS audit logs for container-related threats. Malware Protection scans EBS volumes attached to potentially compromised instances. Each feature increases GuardDuty costs, and organisations should enable features based on workload characteristics and threat model.

Suppression rules prevent known-acceptable activities from generating findings that consume analyst attention and increase costs. Suppression rules should be configured centrally through the delegated administrator account, ensuring consistent application across all member accounts. The suppression rule configuration follows finding generation, as rules cannot be created until finding types are observed.

### 9.3.3 Inspector Enablement

Amazon Inspector provides vulnerability assessment for EC2 instances, container images, and Lambda functions. The delegated administrator model enables centralised configuration whilst assessment occurs locally within member accounts.

```hcl
# Terraform: Inspector organisation enablement
resource "aws_inspector2_delegated_admin_account" "main" {
  account_id = var.security_account_id

  depends_on = [aws_organizations_delegated_administrator.inspector2]
}

resource "aws_inspector2_enabler" "main" {
  provider = aws.security_account

  account_ids    = ["ALL"]
  resource_types = ["EC2", "ECR", "LAMBDA", "LAMBDA_CODE"]

  depends_on = [aws_inspector2_delegated_admin_account.main]
}

resource "aws_inspector2_organization_configuration" "main" {
  provider = aws.security_account

  auto_enable {
    ec2         = true
    ecr         = true
    lambda      = true
    lambda_code = true
  }

  depends_on = [aws_inspector2_enabler.main]
}
```

Resource type selection specifies which resource categories Inspector assesses. EC2 scanning examines operating system packages and application dependencies on instances. ECR scanning analyses container images stored in Amazon Elastic Container Registry. Lambda scanning assesses function code and dependencies for vulnerabilities. Lambda code scanning provides deeper analysis of custom code within functions. Organisations should enable scanning for resource types present in their environment whilst considering the cost implications documented in Chapter 8.

Coverage verification confirms that Inspector is actively scanning the intended resources. The Inspector console provides coverage statistics indicating the percentage of eligible resources undergoing assessment. Coverage gaps may indicate agent installation failures for EC2 instances or repository configuration issues for container images.

### 9.3.4 Detective Enablement

Amazon Detective provides investigation capabilities through behavioural analysis and visualisation of security data. Unlike other security services, Detective operates only in the Security Account, analysing data from member accounts without requiring per-account enablement.

Detective membership configuration establishes the relationship between the Security Account and member accounts whose data Detective will analyse. Member accounts must be invited and must accept membership before their data becomes available for investigation.

```hcl
# Terraform: Detective enablement
resource "aws_detective_graph" "main" {
  provider = aws.security_account

  tags = var.tags
}

resource "aws_detective_member" "members" {
  provider   = aws.security_account
  for_each   = toset(var.member_account_ids)

  account_id                 = each.value
  email_address              = var.account_emails[each.value]
  graph_arn                  = aws_detective_graph.main.id
  disable_email_notification = true

  lifecycle {
    ignore_changes = [email_address]
  }
}

resource "aws_detective_organization_admin_account" "main" {
  account_id = var.security_account_id

  depends_on = [aws_organizations_delegated_administrator.detective]
}

resource "aws_detective_organization_configuration" "main" {
  provider = aws.security_account

  auto_enable = true
  graph_arn   = aws_detective_graph.main.id

  depends_on = [aws_detective_organization_admin_account.main]
}
```

Data source enablement configures which data feeds Detective ingests for analysis. GuardDuty findings provide the primary investigation targets. CloudTrail logs enable API activity analysis. VPC Flow Logs support network behaviour investigation. Each enabled data source increases Detective costs proportionally to data volume, making selective enablement important for cost management as described in Chapter 8.

Investigation setup prepares the Detective environment for analyst use, including dashboard configuration and saved query creation that accelerate common investigation workflows.

### 9.3.5 Terraform Module: Security Services

The security services Terraform module consolidates the service enablement resources into a cohesive deployment unit that depends on the foundation module outputs. This module assumes execution from the Security Account with appropriate permissions.

```hcl
# Terraform: Security services module structure
# File: modules/security-services/main.tf

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }
}

variable "security_account_id" {
  description = "The ID of the Security Account"
  type        = string
}

variable "region" {
  description = "AWS region for deployment"
  type        = string
}

variable "enable_malware_protection" {
  description = "Enable GuardDuty Malware Protection"
  type        = bool
  default     = true
}

variable "enable_eks_protection" {
  description = "Enable GuardDuty EKS Protection"
  type        = bool
  default     = true
}

variable "inspector_resource_types" {
  description = "Resource types for Inspector scanning"
  type        = list(string)
  default     = ["EC2", "ECR", "LAMBDA"]
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Security Hub resources
module "security_hub" {
  source = "./security-hub"

  security_account_id = var.security_account_id
  region              = var.region
  tags                = var.tags
}

# GuardDuty resources
module "guardduty" {
  source = "./guardduty"

  security_account_id       = var.security_account_id
  enable_malware_protection = var.enable_malware_protection
  enable_eks_protection     = var.enable_eks_protection
  tags                      = var.tags

  depends_on = [module.security_hub]
}

# Inspector resources
module "inspector" {
  source = "./inspector"

  security_account_id = var.security_account_id
  resource_types      = var.inspector_resource_types
  tags                = var.tags

  depends_on = [module.security_hub]
}

# Detective resources
module "detective" {
  source = "./detective"

  security_account_id = var.security_account_id
  tags                = var.tags

  depends_on = [module.guardduty]
}

output "security_hub_arn" {
  value = module.security_hub.hub_arn
}

output "guardduty_detector_id" {
  value = module.guardduty.detector_id
}

output "detective_graph_arn" {
  value = module.detective.graph_arn
}
```

See Appendix A for the complete security services module implementation including all submodules and detailed configuration options.

---

## 9.4 Phase 3: Integration

The integration phase connects the security services deployed in Phase 2 into a cohesive system and integrates with external workflows including CI/CD pipelines. This phase transforms isolated services into an integrated security platform that provides the cross-service correlation and development workflow integration that distinguishes enterprise security operations from basic service enablement.

### 9.4.1 Cross-Region Aggregation

Multi-region deployments require cross-region aggregation to achieve the centralised visibility promised by the architecture. Security Hub's finding aggregator consolidates findings from all regions into a designated aggregation region, enabling security analysts to maintain awareness without navigating between regional consoles.

Aggregation region setup designates one region as the primary aggregation target. This region should align with the Security Account's primary operating region and consider factors including analyst location, latency requirements, and data residency constraints.

```hcl
# Terraform: Cross-region aggregation setup
resource "aws_securityhub_finding_aggregator" "main" {
  provider = aws.security_account

  linking_mode = "ALL_REGIONS"

  depends_on = [aws_securityhub_organization_configuration.main]
}

# Alternative: Specific region linking
resource "aws_securityhub_finding_aggregator" "specific_regions" {
  provider = aws.security_account

  linking_mode      = "SPECIFIED_REGIONS"
  specified_regions = var.linked_regions

  depends_on = [aws_securityhub_organization_configuration.main]
}
```

Region linking establishes the replication relationships that forward findings to the aggregation region. The ALL_REGIONS linking mode automatically includes current and future regions, simplifying management but potentially including regions with no resources. The SPECIFIED_REGIONS mode provides explicit control over which regions participate in aggregation.

Verification procedures confirm that findings from linked regions appear in the aggregation region console. Testing should generate findings in multiple regions and verify their appearance in the aggregated view within the expected latency window, typically five to fifteen minutes depending on finding volume.

### 9.4.2 Security Lake Setup

Amazon Security Lake centralises security data in the Open Cybersecurity Schema Framework (OCSF) format, enabling advanced analytics and long-term retention that exceeds the capabilities of individual security service consoles. Configuration establishes data sources, subscriber access, and retention policies that govern the security data lake lifecycle.

Source configuration specifies which data feeds Security Lake ingests. AWS-native sources including CloudTrail, VPC Flow Logs, Security Hub findings, and Route 53 DNS query logs provide comprehensive coverage of AWS activity. Third-party sources extend coverage to non-AWS security tools that support OCSF export.

```hcl
# Terraform: Security Lake configuration
resource "aws_securitylake_data_lake" "main" {
  provider = aws.log_archive_account

  meta_store_manager_role_arn = aws_iam_role.securitylake_metastore.arn

  configuration {
    region = var.region

    encryption_configuration {
      kms_key_id = aws_kms_key.securitylake.arn
    }

    lifecycle_configuration {
      expiration {
        days = var.retention_days
      }

      transition {
        days          = 90
        storage_class = "GLACIER"
      }
    }
  }

  tags = var.tags
}

resource "aws_securitylake_aws_log_source" "cloudtrail" {
  provider = aws.log_archive_account

  source_name    = "CLOUD_TRAIL_MGMT"
  source_version = "2.0"

  depends_on = [aws_securitylake_data_lake.main]
}

resource "aws_securitylake_aws_log_source" "vpc_flow" {
  provider = aws.log_archive_account

  source_name    = "VPC_FLOW"
  source_version = "1.0"

  depends_on = [aws_securitylake_data_lake.main]
}

resource "aws_securitylake_aws_log_source" "security_hub" {
  provider = aws.log_archive_account

  source_name    = "SH_FINDINGS"
  source_version = "2.0"

  depends_on = [aws_securitylake_data_lake.main]
}

resource "aws_securitylake_aws_log_source" "route53" {
  provider = aws.log_archive_account

  source_name    = "ROUTE53"
  source_version = "1.0"

  depends_on = [aws_securitylake_data_lake.main]
}
```

Subscriber setup grants access to Security Lake data for analytics platforms and security tools. Subscribers receive access through IAM roles or through S3 notifications that trigger automated processing. The subscriber configuration specifies which data sources each subscriber may access, enabling granular access control.

Retention policies govern the lifecycle of data within Security Lake, balancing storage costs against retention requirements for compliance and investigation. The lifecycle configuration transitions data through storage tiers and eventually expires data that exceeds retention requirements.

### 9.4.3 Trivy Pipeline Integration

Container image scanning through Trivy integrates vulnerability assessment into CI/CD pipelines, identifying vulnerabilities before images reach production registries. This integration complements the Inspector ECR scanning with shift-left assessment that catches vulnerabilities during development. Using the governance frameworks from Chapter 4, organisations can enforce pipeline gates that prevent vulnerable images from deployment.

GitHub Actions workflow deployment establishes the pipeline integration for repositories hosted on GitHub. The workflow executes Trivy scans on container images built during CI and uploads findings to Security Hub for correlation with other security data.

```hcl
# Terraform: GitHub OIDC provider for AWS authentication
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [var.github_thumbprint]

  tags = var.tags
}

resource "aws_iam_role" "github_actions_trivy" {
  name = "github-actions-trivy-scanner"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/*:*"
          }
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "github_actions_trivy" {
  name = "trivy-security-hub-policy"
  role = aws_iam_role.github_actions_trivy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "securityhub:BatchImportFindings",
          "securityhub:GetFindings"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}
```

AWS IAM OIDC setup establishes the trust relationship enabling GitHub Actions to assume AWS roles without storing long-lived credentials. This approach follows AWS security best practices for CI/CD integration whilst enabling automated pipeline execution.

Workflow testing verifies that the integration functions correctly by executing the workflow against test images with known vulnerabilities. The test should confirm that Trivy identifies vulnerabilities, that findings upload to Security Hub successfully, and that pipeline gates function as expected.

### 9.4.4 Terraform Module: Integration

The integration module consolidates cross-region aggregation, Security Lake, and CI/CD integration into a deployment unit that depends on the security services module outputs.

```hcl
# Terraform: Integration module structure
# File: modules/integration/main.tf

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }
}

variable "security_account_id" {
  description = "Security Account ID"
  type        = string
}

variable "log_archive_account_id" {
  description = "Log Archive Account ID"
  type        = string
}

variable "aggregation_region" {
  description = "Region for finding aggregation"
  type        = string
}

variable "linked_regions" {
  description = "Regions to link for aggregation"
  type        = list(string)
  default     = []
}

variable "retention_days" {
  description = "Security Lake data retention in days"
  type        = number
  default     = 365
}

variable "github_org" {
  description = "GitHub organisation for OIDC trust"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

module "cross_region_aggregation" {
  source = "./cross-region"

  security_account_id = var.security_account_id
  aggregation_region  = var.aggregation_region
  linked_regions      = var.linked_regions
  tags                = var.tags
}

module "security_lake" {
  source = "./security-lake"

  log_archive_account_id = var.log_archive_account_id
  retention_days         = var.retention_days
  tags                   = var.tags
}

module "cicd_integration" {
  source = "./cicd"

  github_org = var.github_org
  tags       = var.tags
}

output "finding_aggregator_arn" {
  value = module.cross_region_aggregation.aggregator_arn
}

output "security_lake_arn" {
  value = module.security_lake.data_lake_arn
}

output "github_actions_role_arn" {
  value = module.cicd_integration.role_arn
}
```

See Appendix A for complete integration module implementation.

---

## 9.5 Phase 4: Operationalisation

The operationalisation phase transforms the technical deployment into a functional security operations capability. Whilst the preceding phases established detection and aggregation infrastructure, this phase creates the automation, dashboards, alerting, and procedures that enable security teams to derive value from the deployed services. Without operationalisation, the security architecture remains a sophisticated data collection system rather than an operational security function.

### 9.5.1 Automation Rules Deployment

Security Hub automation rules execute actions in response to finding patterns, reducing analyst burden for routine tasks whilst ensuring consistent handling of common scenarios. Rule configuration requires careful design to balance automation benefits against the risks of automated actions.

Rule configuration defines the finding criteria that trigger automation and the actions executed when criteria match. Suppression rules prevent findings from generating alerts whilst preserving the findings for audit purposes. Notification rules route findings to appropriate channels based on severity and finding type. Remediation rules trigger corrective actions for well-understood issues.

```hcl
# Terraform: EventBridge rules for Security Hub automation
resource "aws_cloudwatch_event_rule" "high_severity_findings" {
  provider = aws.security_account

  name        = "security-hub-high-severity"
  description = "Route high severity Security Hub findings to SNS"

  event_pattern = jsonencode({
    source      = ["aws.securityhub"]
    detail-type = ["Security Hub Findings - Imported"]
    detail = {
      findings = {
        Severity = {
          Label = ["CRITICAL", "HIGH"]
        }
        Workflow = {
          Status = ["NEW"]
        }
      }
    }
  })

  tags = var.tags
}

resource "aws_cloudwatch_event_target" "high_severity_sns" {
  provider = aws.security_account

  rule      = aws_cloudwatch_event_rule.high_severity_findings.name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.security_alerts.arn

  input_transformer {
    input_paths = {
      severity    = "$.detail.findings[0].Severity.Label"
      title       = "$.detail.findings[0].Title"
      description = "$.detail.findings[0].Description"
      account     = "$.detail.findings[0].AwsAccountId"
      region      = "$.detail.findings[0].Region"
    }
    input_template = <<EOF
{
  "severity": "<severity>",
  "title": "<title>",
  "description": "<description>",
  "account": "<account>",
  "region": "<region>"
}
EOF
  }
}

resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  provider = aws.security_account

  name        = "guardduty-critical-findings"
  description = "Route critical GuardDuty findings for immediate response"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [{ numeric = [">=", 7] }]
    }
  })

  tags = var.tags
}
```

Priority ordering ensures that more specific rules take precedence over general rules when multiple rules match a finding. Rules should be ordered from most specific to most general, with suppression rules evaluated before notification rules to prevent alert fatigue from known-acceptable findings.

Testing procedures validate that rules behave as expected before production deployment. Testing should generate findings that match rule criteria and verify that the expected actions occur. Testing should also verify that rules do not match findings they should ignore, preventing unintended automation.

### 9.5.2 Dashboard Creation

Dashboards provide visual representations of security posture that enable rapid comprehension of organisational security status. Amazon QuickSight, integrated with Security Lake, enables sophisticated dashboard creation that exceeds the capabilities of native service consoles.

QuickSight setup establishes the analytics environment including data source connections, user provisioning, and permission configuration. QuickSight requires a subscription and user licensing, introducing costs beyond the security services themselves.

```hcl
# Terraform: QuickSight data source for Security Lake
resource "aws_quicksight_data_source" "security_lake" {
  provider = aws.security_account

  data_source_id = "security-lake-source"
  name           = "Security Lake"
  type           = "ATHENA"

  parameters {
    athena {
      work_group = aws_athena_workgroup.security_analytics.name
    }
  }

  permission {
    principal = "arn:aws:quicksight:${var.region}:${var.security_account_id}:group/default/SecurityAnalysts"
    actions = [
      "quicksight:DescribeDataSource",
      "quicksight:DescribeDataSourcePermissions",
      "quicksight:PassDataSource"
    ]
  }

  ssl_properties {
    disable_ssl = false
  }

  tags = var.tags
}

resource "aws_athena_workgroup" "security_analytics" {
  provider = aws.security_account

  name = "security-analytics"

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${aws_s3_bucket.athena_results.bucket}/results/"

      encryption_configuration {
        encryption_option = "SSE_KMS"
        kms_key_arn       = aws_kms_key.analytics.arn
      }
    }
  }

  tags = var.tags
}
```

Dashboard deployment creates the visual interfaces that security teams utilise for daily operations. Dashboards should include finding trends, compliance scores, top affected resources, and investigation queues that surface actionable information.

Access configuration restricts dashboard visibility to authorised personnel whilst enabling appropriate sharing for executive reporting and audit purposes.

### 9.5.3 Alerting Configuration

Alerting ensures that security personnel receive timely notification of findings requiring attention. The alerting architecture routes findings through Amazon SNS to diverse endpoints including email, SMS, and integration with incident management platforms.

SNS topic setup creates the notification channels through which alerts flow. Separate topics for different severity levels or finding categories enable subscribers to receive relevant alerts without being overwhelmed by noise.

```hcl
# Terraform: SNS topics for security alerting
resource "aws_sns_topic" "security_critical" {
  provider = aws.security_account

  name              = "security-alerts-critical"
  kms_master_key_id = aws_kms_key.sns.id

  tags = var.tags
}

resource "aws_sns_topic" "security_high" {
  provider = aws.security_account

  name              = "security-alerts-high"
  kms_master_key_id = aws_kms_key.sns.id

  tags = var.tags
}

resource "aws_sns_topic_policy" "security_critical" {
  provider = aws.security_account

  arn = aws_sns_topic.security_critical.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.security_critical.arn
      }
    ]
  })
}

resource "aws_sns_topic_subscription" "security_team_email" {
  provider = aws.security_account

  topic_arn = aws_sns_topic.security_critical.arn
  protocol  = "email"
  endpoint  = var.security_team_email
}

resource "aws_sns_topic_subscription" "pagerduty_integration" {
  provider = aws.security_account

  topic_arn = aws_sns_topic.security_critical.arn
  protocol  = "https"
  endpoint  = var.pagerduty_endpoint
}
```

EventBridge rules, configured in the automation section, route findings to appropriate SNS topics based on severity and type. The rule configuration should align with the organisation's incident response procedures, ensuring that critical findings reach on-call personnel whilst lower severity findings route to queues for business-hours review.

Escalation procedures define the response when initial alerts do not receive timely acknowledgement. Integration with incident management platforms such as PagerDuty or ServiceNow enables automated escalation that ensures findings receive attention regardless of initial responder availability.

### 9.5.4 Runbook Development

Runbooks document the procedures that security analysts follow when investigating and remediating findings. Well-designed runbooks reduce response time, ensure consistent handling, and enable personnel with varying experience levels to respond effectively to security events.

Investigation runbooks guide analysts through the process of assessing finding severity, gathering context, and determining appropriate response. Each finding category should have an associated investigation runbook that addresses the specific evidence sources, correlation opportunities, and escalation criteria relevant to that finding type.

Remediation runbooks document the corrective actions for findings with well-defined resolution procedures. Remediation runbooks should include verification steps that confirm successful remediation and rollback procedures for cases where remediation causes unintended consequences.

Escalation procedures define the criteria and mechanisms for escalating findings that exceed the authority or capability of initial responders. Escalation may involve senior security personnel, external incident response support, or executive notification depending on finding severity and potential business impact.

The runbook library should be maintained as living documentation, updated as new finding types emerge and as operational experience reveals improvements to existing procedures. Integration with ticketing systems enables runbook linking from investigation tickets, ensuring that analysts can access relevant procedures directly from their workflow tools.

---

## Summary

This chapter has presented the implementation methodology for deploying unified AWS security posture management across enterprise organisations. The phased approach—Foundation, Security Services, Integration, and Operationalisation—provides a structured path from initial prerequisites through full operational capability. Each phase builds upon its predecessors, with validation checkpoints that prevent configuration errors from propagating to subsequent phases.

The Terraform modules referenced throughout this chapter and detailed in Appendix A provide infrastructure-as-code implementations that ensure reproducibility and enable version-controlled management of security configurations. Organisations may alternatively employ AWS Cloud Development Kit (CDK) constructs as detailed in Appendix B, selecting the infrastructure-as-code approach that aligns with existing development practices.

The operationalisation phase transforms technical deployment into security capability, establishing the automation, dashboards, alerting, and procedures that enable security teams to derive value from the deployed infrastructure. Without operationalisation, even perfectly configured security services remain underutilised, generating findings that accumulate without investigation or remediation.

Chapter 10 synthesises the concepts presented throughout this document, providing conclusions and recommendations for organisations embarking on unified AWS security posture management implementations.
