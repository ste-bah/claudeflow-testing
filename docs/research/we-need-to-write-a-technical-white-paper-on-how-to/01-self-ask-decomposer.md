# Self-Ask Decomposition: AWS Cloud Governance, CSPM & Security Hub White Paper

**Status**: Complete
**Total Questions**: 20
**Coverage**: Structural (5), Functional (5), Contextual (5), Meta (5)
**Agent**: 01-self-ask-decomposer (Agent #2 of 46)
**Previous Agent**: 00-step-back-analyzer

---

## Executive Summary

This document presents the essential 20 questions that MUST be answered before writing a comprehensive technical white paper on AWS cloud governance and CSPM solutions. Each question includes current confidence levels, research gaps, and prioritization for subsequent research agents.

The research domain spans AWS Security Hub (with 2025 updates), Amazon Inspector, GuardDuty, Detective, Security Lake, and Trivy container scanning integration across multi-account, multi-region AWS Organizations deployments.

---

## STRUCTURAL QUESTIONS (Understanding the "What" and "How")

### Q1: What is the current Security Hub architecture and how has it changed in 2025?

- **Current Answer**: AWS Security Hub reached General Availability in December 2025 with major enhancements:
  - Near real-time risk analytics that correlates signals from GuardDuty, Inspector, and CSPM
  - Automatic threat correlation when GuardDuty detects threats, Inspector identifies vulnerabilities, or CSPM discovers misconfigurations
  - Attack path visualization showing how adversaries could chain threats, vulnerabilities, and misconfigurations
  - Up to 1 year of historical trend data via customizable Summary dashboard
  - Security coverage widget tracking service deployment across accounts/regions
  - OCSF schema support (starting June 17, 2025)
  - Streamlined pricing model consolidating Inspector, GuardDuty, and CSPM

- **Confidence**: 75%
- **Why Not Higher**: Need detailed feature comparison between pre-2025 and post-2025 Security Hub; need exact API changes and migration considerations
- **To Increase Confidence**:
  - Review complete AWS re:Invent 2025 and re:Inforce 2025 announcements
  - Document specific feature deprecations
  - Test new features in sandbox environment
- **Priority**: CRITICAL - Foundation for entire white paper
- **Research Needed**:
  - Complete changelog from Security Hub console
  - Migration guide from legacy to new Security Hub
  - Breaking changes documentation
- **Sources Required**: AWS official documentation, AWS blogs, release notes

**Key Sources**:
- [AWS Security Hub GA with Near Real-Time Analytics](https://aws.amazon.com/blogs/aws/aws-security-hub-now-generally-available-with-near-real-time-analytics-and-risk-prioritization/)
- [AWS re:Invent 2025 Security Announcements](https://www.hanabyte.com/aws-reinvent-2025-security-announcements/)

---

### Q2: How do Security Hub, Inspector, GuardDuty, and Detective integrate together?

- **Current Answer**: The integration model works as follows:
  - **Security Hub** acts as the central aggregation point, receiving findings from all services
  - **GuardDuty** detects runtime threats (network, IAM, malware) and sends to Security Hub
  - **Inspector** identifies vulnerabilities in EC2, ECR, Lambda and integrates natively with Security Hub
  - **Detective** receives findings from Security Hub/GuardDuty for deep investigation
  - **Security Lake** normalizes all data to OCSF format for long-term retention and analytics
  - New 2025 feature: Security Hub automatically correlates signals across services and calculates exposures in near real-time

- **Confidence**: 70%
- **Why Not Higher**: Need detailed data flow diagrams; need understanding of latency between services; unclear on deduplication logic
- **To Increase Confidence**:
  - Map complete data flow with latencies
  - Document finding enrichment at each stage
  - Test deduplication behavior
- **Priority**: CRITICAL - Core architecture decision
- **Research Needed**:
  - Service integration architecture documentation
  - Finding format transformations (ASFF, OCSF)
  - Correlation algorithm documentation

**Key Sources**:
- [GuardDuty Security Hub Integration](https://docs.aws.amazon.com/guardduty/latest/ug/securityhub-integration.html)
- [AWS Service Integrations with Security Hub](https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-internal-providers.html)

---

### Q3: What is the optimal cross-account, cross-region aggregation architecture?

- **Current Answer**:
  - Use a dedicated Security account as delegated administrator (not management account)
  - Enable AWS Organizations integration for automatic member enrollment
  - Designate an aggregation region (home region) to receive findings from all linked regions
  - Central configuration allows delegated admin to configure Security Hub across accounts, OUs, and regions via configuration policies
  - Security Hub CSPM supports up to 10,000 member accounts per delegated administrator per region
  - Use same delegated administrator across all regions for consistency
  - Options: centrally managed (delegated admin controls) or self-managed (members control own settings)

- **Confidence**: 80%
- **Why Moderate**: Well-documented feature but need implementation specifics for 100+ accounts; need performance characteristics at scale
- **To Increase Confidence**:
  - Document step-by-step enablement for each service
  - Validate region availability for each service
  - Test aggregation latency at scale
- **Priority**: CRITICAL - Multi-account design pattern
- **Research Needed**:
  - Complete region availability matrix
  - Performance benchmarks at 100+ accounts
  - Terraform/CDK code examples for deployment

**Key Sources**:
- [Understanding Cross-Region Aggregation](https://docs.aws.amazon.com/securityhub/latest/userguide/finding-aggregation.html)
- [Central Configuration in Security Hub CSPM](https://docs.aws.amazon.com/securityhub/latest/userguide/central-configuration-intro.html)
- [Managing Security Hub for Multiple Accounts](https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-accounts-orgs.html)

---

### Q4: How does Trivy container scanning integrate with Security Hub via GitHub Actions?

- **Current Answer**:
  - Trivy can generate ASFF-formatted reports using the `asff.tpl` template
  - Command: `AWS_REGION=us-west-1 AWS_ACCOUNT_ID=123456789012 trivy image --format template --template "@contrib/asff.tpl" -o report.asff [image]`
  - Upload to Security Hub via: `aws securityhub batch-import-findings --findings file://report.asff`
  - GitHub Actions workflow uses `aquasecurity/trivy-action@0.33.1` with scan-type 'fs' or 'image'
  - Requires `security-events: write` permission for SARIF uploads
  - Latest Trivy action runs on ubuntu-24.04

- **Confidence**: 65%
- **Why Not Higher**: Need complete workflow example with error handling; need ASFF schema validation details; unclear on finding deduplication with Inspector
- **To Increase Confidence**:
  - Build and test complete GitHub Actions workflow
  - Validate ASFF output schema compliance
  - Test finding correlation with Inspector findings
- **Priority**: HIGH - Core requirement for Trivy integration
- **Research Needed**:
  - Complete GitHub Actions workflow YAML
  - ASFF template customization for organization context
  - Deduplication strategy with Inspector

**Key Sources**:
- [Trivy GitHub Action](https://github.com/aquasecurity/trivy-action)
- [Trivy AWS Security Hub Integration](https://aquasecurity.github.io/trivy/v0.17.2/integrations/aws-security-hub/)
- [Building CI/CD Pipeline with Trivy and Security Hub](https://aws.amazon.com/blogs/security/how-to-build-ci-cd-pipeline-container-vulnerability-scanning-trivy-and-aws-security-hub/)

---

### Q5: What is the Security Lake schema and OCSF compliance structure?

- **Current Answer**:
  - Amazon Security Lake normalizes all security data to OCSF (Open Cybersecurity Schema Framework)
  - OCSF is an open-source collaborative effort with 660+ contributors from 197 enterprises
  - Security Lake stores data in Apache Parquet format in S3 buckets (one per region)
  - Native AWS services (Route 53, CloudTrail, VPC Flow Logs) have pre-built integrations
  - Third-party data must be converted to OCSF format before ingestion
  - Security Hub findings can flow to Security Lake if integration is enabled
  - OpenSearch Service integrates with Security Lake for analytics

- **Confidence**: 60%
- **Why Not Higher**: Need specific OCSF event classes for container vulnerabilities; need schema mapping from ASFF to OCSF; unclear on custom finding ingestion
- **To Increase Confidence**:
  - Document OCSF schema for vulnerability findings
  - Map ASFF fields to OCSF fields
  - Test custom data ingestion workflow
- **Priority**: HIGH - Required for data lake architecture
- **Research Needed**:
  - OCSF v1.x schema documentation
  - ASFF to OCSF mapping table
  - Security Lake query examples with Athena

**Key Sources**:
- [Amazon Security Lake Features](https://aws.amazon.com/security-lake/features/)
- [OCSF in Security Lake](https://docs.aws.amazon.com/security-lake/latest/userguide/open-cybersecurity-schema-framework.html)
- [Security Lake Third-Party Integrations](https://docs.aws.amazon.com/security-lake/latest/userguide/integrations-third-party.html)

---

## FUNCTIONAL QUESTIONS (Understanding the "Why")

### Q6: Why use Security Hub as the central aggregation point vs alternatives?

- **Current Answer**:
  - **Native integration**: Direct integration with GuardDuty, Inspector, Macie, Config without additional configuration
  - **Cost efficiency**: Tiered pricing with organizational discounts; consolidated billing
  - **Near real-time correlation**: Automatic signal correlation across services (2025 feature)
  - **Compliance automation**: Built-in support for CIS, NIST, PCI-DSS, AWS Foundational Best Practices
  - **Organizations integration**: Automatic member enrollment, central configuration
  - **Attack path visualization**: Shows how threats could chain together
  - **Alternatives** (Splunk, DataDog, third-party CSPM): Higher cost, delayed findings, additional credentials

- **Confidence**: 85%
- **Why High**: Clear value proposition documented; competitive analysis available
- **To Increase Confidence**:
  - Document specific cost comparison with alternatives
  - Validate feature parity claims
- **Priority**: MEDIUM - Strategic decision already justified
- **Research Needed**:
  - Third-party CSPM cost comparison
  - Feature matrix comparison

---

### Q7: What are the cost drivers for each security service in multi-account deployments?

- **Current Answer**:
  - **Security Hub 2025 Pricing**:
    - Essentials plan based on 4 resource types: EC2, ECR images, Lambda, IAM users/roles
    - Tiered pricing for organizations
    - Cost estimator available in console
  - **Rough estimates** (varies by resources/data):
    - Startup (1 account, 1 region): ~$269/month total
    - Mid-size (5 accounts, 2 regions): ~$4,742/month total
    - Enterprise (20 accounts, 3 regions): ~$265,263/month total
  - **Automated Security Response**:
    - Small (10 accounts, 1 region, 300 remediations): ~$20.73/month
    - Large (1,000 accounts, 10 regions, 30,000 remediations): ~$10,460.80/month
  - 30-day free trial available for new accounts

- **Confidence**: 55%
- **Why Low**: Cost estimates vary significantly based on resources; need organization-specific calculator inputs; pricing model recently changed
- **To Increase Confidence**:
  - Use AWS Cost Estimator with realistic inputs
  - Document all pricing tiers and breakpoints
  - Compare to third-party alternatives
- **Priority**: CRITICAL - Cost is primary concern per research query
- **Research Needed**:
  - Detailed pricing tier breakpoints
  - Cost optimization strategies
  - ROI calculation methodology

**Key Sources**:
- [AWS Security Hub Pricing](https://aws.amazon.com/security-hub/pricing/)
- [Security Hub CSPM Pricing](https://aws.amazon.com/security-hub/cspm/pricing/)
- [Security Hub Cost Estimator](https://docs.aws.amazon.com/securityhub/latest/userguide/security-hub-cost-estimator.html)

---

### Q8: When should Trivy EC2 fallback be triggered instead of Inspector?

- **Current Answer**:
  - **Use Trivy when Inspector is unavailable**:
    - Container registries not supported by Inspector (non-ECR registries)
    - EC2-based container hosts without Inspector agent
    - Older AMIs with limited Inspector support
    - Self-hosted Kubernetes clusters without ECR
    - CI/CD "shift-left" scanning before deployment
  - **Use Inspector for**:
    - Post-deployment runtime monitoring
    - Continuous vulnerability monitoring of running images
    - AWS-native workloads (ECS, EKS, ECR)
  - **Complementary approach**: Trivy in CI (prevention), Inspector at runtime (detection)

- **Confidence**: 70%
- **Why Moderate**: General guidance exists but need specific decision matrix; unclear on CVE coverage differences
- **To Increase Confidence**:
  - Document specific scenarios with decision criteria
  - Compare CVE coverage between tools
  - Test fallback automation patterns
- **Priority**: HIGH - Core requirement per research query
- **Research Needed**:
  - Inspector limitation documentation
  - Trivy capability matrix
  - Fallback automation architecture

**Key Sources**:
- [Trivy vs Inspector Comparison](https://repost.aws/questions/QUsOLjjT0wSMi79nzbWgiAQA/why-trivy-finds-more-cves-than-inspector)
- [Inspector 2025 Updates](https://dev.to/aws-builders/my-perspective-on-amazon-inspectors-2025-updates-for-devsecops-3pf4)

---

### Q9: How do you implement consistent governance across 100+ accounts?

- **Current Answer**:
  - **AWS Organizations structure**: OUs for workloads, security, log archive, sandbox
  - **Service Control Policies (SCPs)**: Maximum permission boundaries across OUs
    - Full IAM language support now available
    - Protect security services from being disabled
    - Prevent privilege escalation
  - **Central configuration**: Security Hub configuration policies across accounts/regions
  - **Automation rules**: Automated response to findings
  - **Config rules**: Compliance checks for resource configurations
  - **Delegated administrator model**: Security account manages all security services

- **Confidence**: 75%
- **Why Moderate**: Best practices documented but need specific SCP examples; need automation rule patterns
- **To Increase Confidence**:
  - Document complete SCP library for security
  - Create automation rule examples
  - Validate at 100+ account scale
- **Priority**: HIGH - Governance is primary goal
- **Research Needed**:
  - SCP examples for security service protection
  - Automation rule patterns
  - Governance dashboard design

**Key Sources**:
- [Service Control Policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
- [SCP Examples](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_examples.html)
- [AWS Organizations for Security](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/organizations-security.html)

---

### Q10: What reporting and visualization capabilities exist in the security data lake?

- **Current Answer**:
  - **Security Lake outputs**:
    - OCSF-normalized Parquet files in S3
    - Queryable via Amazon Athena
    - Visualizable via Amazon QuickSight
  - **Security Hub reporting** (2025):
    - Trends feature with up to 1 year historical data
    - Period-over-period trend analysis
    - Severity-based filtering
    - Cross-region aggregation in Summary dashboard
    - Security coverage widget for gaps
  - **Integration options**:
    - OpenSearch Service for interactive log analytics
    - Third-party SIEM integration
    - Custom dashboards

- **Confidence**: 60%
- **Why Moderate**: General capabilities known but need specific dashboard examples; need Athena query examples
- **To Increase Confidence**:
  - Create sample dashboards
  - Document Athena query patterns
  - Test QuickSight integration
- **Priority**: MEDIUM - Reporting is secondary to core architecture
- **Research Needed**:
  - Dashboard templates
  - Athena query library for OCSF
  - Executive reporting patterns

---

## CONTEXTUAL QUESTIONS (Understanding the "When/Where/Who")

### Q11: Who manages security findings in a delegated administrator model?

- **Current Answer**:
  - **Delegated Administrator** (Security Account):
    - Views/manages findings across all member accounts
    - Configures Security Hub settings organization-wide
    - Enables/disables security standards
    - Creates automation rules
    - Should be different from management account
  - **Member Accounts**:
    - Can be centrally managed (delegated admin controls) or self-managed
    - Self-managed accounts configure their own settings per region
  - **Management Account**:
    - Designates delegated administrator
    - Should NOT run workloads
    - SCPs do not apply to it
    - Manages billing only

- **Confidence**: 85%
- **Why High**: Well-documented AWS best practice
- **To Increase Confidence**:
  - Document IAM roles and permissions
  - Map responsibilities to personas
- **Priority**: MEDIUM - Standard pattern
- **Research Needed**:
  - IAM policy examples for delegated admin
  - RACI matrix for security operations

**Key Sources**:
- [Managing Administrator and Member Accounts](https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-accounts.html)
- [Recommendations for Multiple Accounts](https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-account-restrictions-recommendations.html)

---

### Q12: What are the regional availability constraints for each service?

- **Current Answer**:
  - **Security Hub**: Available in all commercial AWS regions
  - **GuardDuty**: Available in all commercial regions
  - **Inspector**: Available in most commercial regions but some limitations
  - **Detective**: Available in most commercial regions
  - **Security Lake**: Rolled out to major regions
  - **Cross-region aggregation**: Can link all enabled regions to aggregation region
  - Some services may have delayed feature rollouts in non-US regions

- **Confidence**: 50%
- **Why Low**: Need current region availability matrix; availability changes frequently
- **To Increase Confidence**:
  - Create complete region availability matrix
  - Document feature parity across regions
  - Note GovCloud and China region considerations
- **Priority**: HIGH - Multi-region is core requirement
- **Research Needed**:
  - AWS region availability documentation for each service
  - Feature parity matrix
  - GovCloud considerations

---

### Q13: How do compliance frameworks (CIS, NIST, PCI-DSS) map to Security Hub controls?

- **Current Answer**:
  - **Security Hub Standards** (built-in):
    - AWS Foundational Security Best Practices (FSBP)
    - CIS AWS Foundations Benchmark (v1.2.0, v1.4.0, v3.0.0)
    - NIST SP 800-53 Rev. 5
    - PCI DSS v3.2.1
  - Controls mapped to specific AWS Config rules
  - Automatic compliance scoring per standard
  - Finding aggregation by control and account

- **Confidence**: 75%
- **Why Moderate**: Standards documented but need control mapping details; need custom control creation guidance
- **To Increase Confidence**:
  - Document control-to-rule mappings
  - Create custom control examples
  - Validate coverage for each framework
- **Priority**: MEDIUM - Compliance is secondary objective
- **Research Needed**:
  - Complete control mapping documentation
  - Gap analysis for each framework
  - Custom standard creation

---

### Q14: What are the IAM and SCP requirements for organization-wide deployment?

- **Current Answer**:
  - **SCPs for security services**:
    - Prevent disabling CloudTrail, GuardDuty, Security Hub, Config
    - Prevent deleting member accounts or disassociating from Security Hub
    - Prevent deleting VPC flow logs, CloudWatch log groups
    - Full IAM language support (conditions, ARNs, NotAction)
  - **IAM for delegated admin**:
    - `securityhub:*` permissions in Security account
    - Cross-account assume role for member access
    - Service-linked roles (not restricted by SCPs)
  - **Best practice**: Broad Allow + targeted Deny statements

- **Confidence**: 70%
- **Why Moderate**: General patterns documented but need complete SCP library; need least-privilege IAM examples
- **To Increase Confidence**:
  - Create complete SCP library
  - Document IAM roles for each persona
  - Test SCP interactions
- **Priority**: HIGH - Security governance requirement
- **Research Needed**:
  - Complete SCP templates
  - IAM role definitions
  - Permission boundary examples

**Key Sources**:
- [SCPs for Security Service Protection](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_examples.html)
- [Full IAM Language Support for SCPs](https://aws.amazon.com/blogs/security/unlock-new-possibilities-aws-organizations-service-control-policy-now-supports-full-iam-language/)

---

### Q15: How do you handle security events in landing zones vs workload accounts?

- **Current Answer**:
  - **Landing Zone accounts** (Security, Log Archive):
    - Receive aggregated findings via delegated administrator
    - Security Lake stores normalized data in Log Archive
    - Security account runs Security Hub, GuardDuty, Detective admin
  - **Workload accounts**:
    - Run GuardDuty, Inspector, Config locally
    - Findings replicate to Security account
    - Can be centrally managed or self-managed
    - Local remediation via automation rules
  - **Pattern**: Detection distributed, aggregation centralized

- **Confidence**: 75%
- **Why Moderate**: Pattern well-established but need specific event routing; need Lambda remediation examples
- **To Increase Confidence**:
  - Document event routing architecture
  - Create remediation automation examples
  - Test cross-account workflows
- **Priority**: MEDIUM - Standard landing zone pattern
- **Research Needed**:
  - Event routing documentation
  - Remediation Lambda examples
  - Cross-account workflow patterns

---

## META QUESTIONS (Understanding Unknowns and Assumptions)

### Q16: What don't we know about Security Hub's 2025 changes?

- **Current Answer**: Key unknowns include:
  - **Migration path**: How to migrate existing Security Hub setups to new model
  - **Pricing transition**: How existing customers are affected by new pricing
  - **Feature deprecations**: Which legacy features are being removed
  - **AWS Security Agent** (preview): Full capabilities and integration points
  - **AI recommendations**: How AI-enhanced remediation works in practice
  - **Performance at scale**: Latency characteristics with 1000+ accounts
  - **Custom findings**: How custom findings interact with new correlation

- **Confidence**: 30%
- **Why Low**: Major update with limited production experience; documentation still evolving
- **To Increase Confidence**:
  - Monitor AWS forums and re:Post for customer experiences
  - Test in sandbox environment
  - Review all 2025 announcements
- **Priority**: CRITICAL - Gaps could invalidate architecture
- **Research Needed**:
  - Complete 2025 changelog
  - Customer experience reports
  - Sandbox testing

---

### Q17: What assumptions are we making about Trivy vs Inspector capabilities?

- **Current Answer**: Key assumptions:
  - **Assumption 1**: Trivy and Inspector CVE databases are comparable in coverage
  - **Assumption 2**: ASFF format from Trivy is fully compatible with Security Hub
  - **Assumption 3**: Trivy can run reliably on EC2 for runtime scanning
  - **Assumption 4**: Deduplication of findings between Trivy and Inspector is handled
  - **Assumption 5**: GitHub Actions workflow is production-ready
  - **Known difference**: Inspector provides runtime context, Trivy does not

- **Confidence**: 45%
- **Why Low**: Assumptions not validated; CVE coverage differences documented but not quantified
- **To Increase Confidence**:
  - Test CVE coverage on same images
  - Validate ASFF schema compatibility
  - Test deduplication behavior
  - Benchmark Trivy performance on EC2
- **Priority**: HIGH - Core fallback architecture depends on these
- **Research Needed**:
  - Side-by-side CVE comparison
  - ASFF validation testing
  - Deduplication strategy documentation

---

### Q18: Where might cost estimates be inaccurate for large organizations?

- **Current Answer**: Potential inaccuracy areas:
  - **Resource count fluctuation**: Auto-scaling affects resource-based pricing
  - **Finding volume**: High-severity environments generate more findings
  - **Data ingestion**: Security Lake costs scale with data volume
  - **Region proliferation**: Costs multiply per region
  - **Third-party integrations**: Additional findings increase processing costs
  - **Automation execution**: Lambda execution costs for remediation
  - **Hidden costs**: Data transfer, S3 storage, Athena queries

- **Confidence**: 40%
- **Why Low**: Cost models are complex; organizational variance is high
- **To Increase Confidence**:
  - Create detailed cost model with all variables
  - Use AWS Cost Explorer on existing deployments
  - Document cost optimization strategies
- **Priority**: CRITICAL - Cost-effectiveness is explicit requirement
- **Research Needed**:
  - Comprehensive cost model
  - Real-world cost case studies
  - Optimization playbook

---

### Q19: What could invalidate our multi-region architecture?

- **Current Answer**: Potential invalidation risks:
  - **Service availability changes**: AWS could change region availability
  - **Aggregation limits**: 10,000 account limit could be reached
  - **Latency requirements**: Real-time use cases may need different architecture
  - **Data sovereignty**: GDPR or other regulations may prevent cross-region aggregation
  - **GovCloud requirements**: Architecture may not translate to GovCloud
  - **China region**: Separate partition with different requirements
  - **Pricing changes**: Cost model could change significantly

- **Confidence**: 50%
- **Why Low**: External factors difficult to predict; regulatory landscape evolving
- **To Increase Confidence**:
  - Document architecture decision records with assumptions
  - Create contingency plans for each risk
  - Monitor AWS service changes
- **Priority**: MEDIUM - Risk documentation
- **Research Needed**:
  - Data sovereignty requirements by region
  - GovCloud architecture differences
  - Contingency planning

---

### Q20: What would an AWS Solutions Architect focus on for this design?

- **Current Answer**: SA focus areas would likely include:
  - **Well-Architected alignment**: Security pillar review
  - **Scalability**: Architecture patterns for 100+ accounts
  - **Operational excellence**: Runbooks, monitoring, incident response
  - **Cost optimization**: Right-sizing, tiered pricing, reserved capacity
  - **Reliability**: Multi-region redundancy, failover patterns
  - **Performance**: Aggregation latency, query performance
  - **Security**: Least privilege, defense in depth, encryption
  - **Sustainability**: Resource efficiency

- **Confidence**: 60%
- **Why Moderate**: General SA concerns known but specific recommendations need validation
- **To Increase Confidence**:
  - Review AWS Security Reference Architecture
  - Consult AWS Well-Architected documentation
  - Engage AWS ProServe or partner expertise
- **Priority**: MEDIUM - Quality validation
- **Research Needed**:
  - AWS Security Reference Architecture
  - Well-Architected Security Pillar
  - Reference customer architectures

---

## QUESTION PRIORITIZATION

### CRITICAL (Must Answer First - Confidence < 70%)

| # | Question | Confidence | Research Plan | Timeline |
|---|----------|------------|---------------|----------|
| Q1 | Security Hub 2025 architecture | 75% | Review all 2025 announcements, test features | Week 1 |
| Q2 | Service integration architecture | 70% | Map data flows, test latencies | Week 1-2 |
| Q7 | Cost drivers for multi-account | 55% | Use AWS cost estimator, document tiers | Week 2 |
| Q16 | Unknown Security Hub 2025 changes | 30% | Monitor forums, sandbox testing | Week 1-3 |
| Q17 | Trivy vs Inspector assumptions | 45% | Side-by-side testing | Week 2 |
| Q18 | Cost estimate accuracy | 40% | Build detailed cost model | Week 2-3 |

### HIGH PRIORITY (Confidence 70-85%)

| # | Question | Confidence | Research Plan | Timeline |
|---|----------|------------|---------------|----------|
| Q3 | Cross-account aggregation | 80% | Document step-by-step, test at scale | Week 2 |
| Q4 | Trivy GitHub Actions integration | 65% | Build complete workflow | Week 2 |
| Q5 | Security Lake OCSF schema | 60% | Document schema, test ingestion | Week 3 |
| Q8 | Trivy fallback criteria | 70% | Create decision matrix | Week 2 |
| Q9 | Governance at 100+ accounts | 75% | Document SCP library, automation rules | Week 3 |
| Q12 | Regional availability | 50% | Create availability matrix | Week 1 |
| Q14 | IAM/SCP requirements | 70% | Document complete templates | Week 3 |

### MEDIUM PRIORITY (Confidence > 85% or Secondary)

| # | Question | Confidence | Research Plan | Timeline |
|---|----------|------------|---------------|----------|
| Q6 | Why Security Hub vs alternatives | 85% | Document cost comparison | Week 4 |
| Q10 | Reporting capabilities | 60% | Create dashboard examples | Week 4 |
| Q11 | Delegated admin responsibilities | 85% | Document RACI matrix | Week 3 |
| Q13 | Compliance framework mapping | 75% | Document control mappings | Week 4 |
| Q15 | Landing zone event handling | 75% | Document event routing | Week 3 |
| Q19 | Architecture invalidation risks | 50% | Document contingencies | Week 4 |
| Q20 | SA focus areas | 60% | Review reference architecture | Week 4 |

---

## KNOWLEDGE GAP SUMMARY

| Category | Total Questions | Critical (<70%) | High (70-85%) | Satisfactory (>85%) |
|----------|-----------------|-----------------|---------------|---------------------|
| Structural | 5 | 2 (Q4, Q5) | 3 (Q1, Q2, Q3) | 0 |
| Functional | 5 | 2 (Q7, Q8) | 2 (Q9, Q10) | 1 (Q6) |
| Contextual | 5 | 1 (Q12) | 3 (Q13, Q14, Q15) | 1 (Q11) |
| Meta | 5 | 4 (Q16, Q17, Q18, Q19) | 1 (Q20) | 0 |
| **Total** | **20** | **9 (45%)** | **9 (45%)** | **2 (10%)** |

**Average Confidence**: 62.5%
**Overall Readiness**: NOT READY - Need minimum 85% average before synthesis

---

## RESEARCH ROADMAP

### Phase 1: Address Critical Gaps (Weeks 1-2)

- [ ] Q1: Document Security Hub 2025 complete feature set
- [ ] Q2: Map service integration architecture with data flows
- [ ] Q7: Build comprehensive cost model with all variables
- [ ] Q12: Create complete region availability matrix
- [ ] Q16: Document all known unknowns about 2025 changes
- [ ] Q17: Validate Trivy vs Inspector assumptions with testing

### Phase 2: Address High Priority (Weeks 2-3)

- [ ] Q3: Document step-by-step cross-account setup
- [ ] Q4: Create production-ready GitHub Actions workflow
- [ ] Q5: Document OCSF schema with examples
- [ ] Q8: Create Trivy fallback decision matrix
- [ ] Q9: Build SCP and automation rule library
- [ ] Q14: Complete IAM/SCP template library
- [ ] Q18: Develop accurate cost estimation methodology

### Phase 3: Validate Medium Priority (Weeks 3-4)

- [ ] Q6: Complete competitive analysis
- [ ] Q10: Create dashboard templates
- [ ] Q11: Document RACI matrix
- [ ] Q13: Map compliance controls
- [ ] Q15: Document event routing patterns
- [ ] Q19: Document risks and contingencies
- [ ] Q20: Validate against Well-Architected

### Target State

| Metric | Current | Target |
|--------|---------|--------|
| Average Confidence | 62.5% | 85%+ |
| Critical Questions at 90%+ | 0% | 100% |
| All Questions at 70%+ | 55% | 100% |
| Knowledge Gaps Documented | 100% | 100% (addressed) |

---

## ADAPTIVE LEARNING TRIGGERS

**For Each Question**:
- IF confidence < 70%: Flag for IMMEDIATE research
- IF confidence 70-85%: Flag for TARGETED research
- IF confidence > 85%: Monitor during synthesis

**Validation Gate**: Do NOT proceed to hypothesis generation until:
- [ ] 80%+ of questions at 85%+ confidence
- [ ] All CRITICAL questions at 90%+ confidence
- [ ] All knowledge gaps documented and addressed

---

## DEPENDENCIES FOR NEXT AGENTS

The following questions have dependencies that affect downstream agents:

| Question | Dependent Agents | Blocking Data |
|----------|------------------|---------------|
| Q1 | All architecture agents | Security Hub 2025 feature set |
| Q2 | Integration architects | Data flow documentation |
| Q3 | Infrastructure agents | Cross-account setup procedure |
| Q4 | CI/CD agents | GitHub Actions workflow |
| Q7 | Cost analysis agents | Pricing model details |
| Q12 | Deployment agents | Region availability matrix |

---

## SOURCES REFERENCED

### AWS Official Documentation
- [AWS Security Hub GA with Near Real-Time Analytics](https://aws.amazon.com/blogs/aws/aws-security-hub-now-generally-available-with-near-real-time-analytics-and-risk-prioritization/)
- [Understanding Cross-Region Aggregation](https://docs.aws.amazon.com/securityhub/latest/userguide/finding-aggregation.html)
- [Central Configuration in Security Hub CSPM](https://docs.aws.amazon.com/securityhub/latest/userguide/central-configuration-intro.html)
- [Managing Security Hub for Multiple Accounts](https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-accounts-orgs.html)
- [Security Hub Cost Estimator](https://docs.aws.amazon.com/securityhub/latest/userguide/security-hub-cost-estimator.html)
- [Amazon Security Lake Features](https://aws.amazon.com/security-lake/features/)
- [OCSF in Security Lake](https://docs.aws.amazon.com/security-lake/latest/userguide/open-cybersecurity-schema-framework.html)
- [Service Control Policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
- [AWS Organizations for Security](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/organizations-security.html)
- [GuardDuty Detective Integration](https://docs.aws.amazon.com/guardduty/latest/ug/detective-integration.html)

### AWS Pricing
- [AWS Security Hub Pricing](https://aws.amazon.com/security-hub/pricing/)
- [Security Hub CSPM Pricing](https://aws.amazon.com/security-hub/cspm/pricing/)

### Third-Party Documentation
- [Trivy GitHub Action](https://github.com/aquasecurity/trivy-action)
- [Trivy AWS Security Hub Integration](https://aquasecurity.github.io/trivy/v0.17.2/integrations/aws-security-hub/)
- [Building CI/CD Pipeline with Trivy and Security Hub](https://aws.amazon.com/blogs/security/how-to-build-ci-cd-pipeline-container-vulnerability-scanning-trivy-and-aws-security-hub/)
- [Amazon Inspector 2025 Updates](https://dev.to/aws-builders/my-perspective-on-amazon-inspectors-2025-updates-for-devsecops-3pf4)

### Conference Announcements
- [AWS re:Invent 2025 Top Announcements](https://aws.amazon.com/blogs/aws/top-announcements-of-aws-reinvent-2025/)
- [AWS re:Invent 2025 Security Announcements](https://www.hanabyte.com/aws-reinvent-2025-security-announcements/)

---

## METADATA

**Analysis Completed**: 2026-01-01
**Agent ID**: 01-self-ask-decomposer
**Workflow Position**: Agent #2 of 46
**Previous Agent**: 00-step-back-analyzer
**Next Agents**: 02-ambiguity-clarifier, literature-mapper, systematic-reviewer
**Questions Generated**: 20
**Average Confidence**: 62.5%
**Research Readiness**: NOT READY (need 85%+ average)

**Memory Keys to Create**:
- `research/questions/structural`: Structural questions Q1-Q5
- `research/questions/functional`: Functional questions Q6-Q10
- `research/questions/contextual`: Contextual questions Q11-Q15
- `research/questions/meta`: Meta questions Q16-Q20
- `research/gaps/critical`: Questions with <70% confidence
- `research/roadmap/phases`: Research timeline by phase

---

**XP Earned**:
- Structural questions (5 questions): +50 XP
- Functional questions (5 questions): +50 XP
- Contextual questions (5 questions): +50 XP
- Meta questions (5 questions): +50 XP
- Confidence assessment accuracy: +25 XP
- Research roadmap creation: +30 XP
- Source documentation: +20 XP
- Priority matrix: +25 XP
- Complete framework bonus: +50 XP

**Total XP**: 350 XP
