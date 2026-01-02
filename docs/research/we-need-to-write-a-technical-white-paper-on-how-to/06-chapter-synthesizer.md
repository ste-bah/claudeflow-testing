# Chapter Synthesis Plan: AWS Cloud Governance & CSPM Technical White Paper

**Status**: Complete
**Document Type**: Chapter Synthesis and Writing Prompts
**Total Chapters**: 10 + 7 Appendices
**Research Inputs Mapped**: 42 tasks, 25 constructs, 20 research questions, 7 core principles, 10 anti-patterns
**Agent**: 06-chapter-synthesizer (Agent #7 of 46)
**Previous Agent**: 05-dissertation-architect

---

## Executive Summary

This document transforms the comprehensive research outputs from Agents 00-05 into actionable synthesis guidance for the writing phase. For each of the 10 chapters, this plan provides:

1. **Research Question Mapping**: Which of the 20 questions each chapter answers
2. **Construct Integration**: Which of the 25 constructs to define and use
3. **Anti-Pattern Highlighting**: Which of the 10 anti-patterns to address
4. **Research Task Feeding**: Which of the 42 research tasks provide source material
5. **Synthesis Approach**: Narrative style and structure guidance
6. **Quality Metrics**: Citation requirements, diagrams, and code examples
7. **Detailed Writing Prompts**: Specific instructions for each writing agent

---

## Research-to-Chapter Master Mapping Matrix

### Research Questions to Chapters

| Question | Primary Chapter | Supporting Chapters | Confidence Target |
|----------|-----------------|---------------------|-------------------|
| Q1: Security Hub 2025 architecture | Chapter 2 | Chapters 1, 5 | 90% |
| Q2: Service integration | Chapter 5 | Chapters 2, 3 | 85% |
| Q3: Cross-account aggregation | Chapter 5 | Chapters 3, 4 | 90% |
| Q4: Trivy GitHub Actions | Chapter 6 | Appendix E | 85% |
| Q5: Security Lake OCSF | Chapter 7 | Chapter 2 | 85% |
| Q6: Why Security Hub | Chapter 1 | Chapter 8 | 85% |
| Q7: Cost drivers | Chapter 8 | Chapter 1 | 90% |
| Q8: Trivy fallback criteria | Chapter 6 | Chapter 5 | 85% |
| Q9: Governance at scale | Chapter 4 | Chapters 3, 9 | 85% |
| Q10: Reporting capabilities | Chapter 7 | Chapters 5, 8 | 80% |
| Q11: Delegated admin | Chapter 4 | Chapters 3, 5 | 85% |
| Q12: Regional availability | Chapter 3 | Chapter 9 | 85% |
| Q13: Compliance frameworks | Chapter 5 | Chapter 7 | 85% |
| Q14: IAM/SCP requirements | Chapter 4 | Appendix C | 85% |
| Q15: Landing zone events | Chapter 3 | Chapter 4 | 85% |
| Q16: Unknown 2025 changes | Chapter 2 | Chapter 1 | 80% |
| Q17: Trivy vs Inspector | Chapter 6 | Chapter 8 | 85% |
| Q18: Cost estimate accuracy | Chapter 8 | Chapters 1, 10 | 85% |
| Q19: Architecture risks | Chapter 10 | Chapter 3 | 80% |
| Q20: SA focus areas | Chapter 3 | Chapter 10 | 80% |

### Constructs to Chapters

| Construct | Definition Chapter | Usage Chapters |
|-----------|-------------------|----------------|
| AWS Security Hub | Chapter 2 | 1, 3, 5, 8, 9 |
| Amazon Inspector | Chapter 2 | 5, 6, 8, 9 |
| Amazon GuardDuty | Chapter 2 | 5, 8, 9 |
| Amazon Detective | Chapter 2 | 5, 9 |
| Amazon Security Lake | Chapter 2 | 7, 8, 9 |
| AWS Organizations | Chapter 4 | 3, 9 |
| Delegated Administrator | Chapter 4 | 3, 5, 9 |
| AWS Config | Chapter 5 | 4, 9 |
| IAM Access Analyzer | Chapter 5 | 4, 9 |
| CloudTrail | Chapter 7 | 4, 9 |
| CSPM | Chapter 2 | 1, 5, 8 |
| ASFF | Chapter 5 | 6, 7 |
| OCSF | Chapter 7 | 2, 5 |
| Cross-Region Aggregation | Chapter 5 | 3, 9 |
| Cross-Account Aggregation | Chapter 5 | 3, 4, 9 |
| Security Finding | Chapter 5 | 6, 7 |
| Compliance Framework | Chapter 5 | 7, 10 |
| Security Control | Chapter 4 | 5, 9 |
| Trivy | Chapter 6 | 8, 9, Appendix E |
| GitHub Actions | Chapter 6 | 9, Appendix E |
| Custom Actions | Chapter 5 | 9 |
| EventBridge | Chapter 5 | 6, 9 |
| Athena | Chapter 7 | 8, Appendix D |
| Finding Volume Pricing | Chapter 8 | 10 |
| Data Ingestion Costs | Chapter 8 | 7, 10 |

### Anti-Patterns to Chapters

| Anti-Pattern | Primary Chapter | How Addressed |
|--------------|-----------------|---------------|
| 1. Siloed Security Tools Per Account | Chapter 4 | Centralized delegated admin model |
| 2. Missing Cross-Region Aggregation | Chapter 5 | Cross-region aggregation setup |
| 3. No Fallback for Container Scanning | Chapter 6 | Trivy EC2 fallback architecture |
| 4. Ignoring Security Hub 2025 Changes | Chapter 2 | 2025 GA feature documentation |
| 5. Over-Reliance on Third-Party CSPM | Chapter 1, 8 | AWS-native cost comparison |
| 6. Unstructured Security Data Lake | Chapter 7 | Security Lake OCSF setup |
| 7. Manual Member Account Enrollment | Chapter 4 | Organizations integration |
| 8. Alert Fatigue from Unfiltered Findings | Chapter 5 | Automation rules, suppression |
| 9. Running Workloads in Management Account | Chapter 3, 4 | Account structure design |
| 10. Point-in-Time Security Assessments | Chapter 5 | Continuous compliance monitoring |

### Research Tasks to Chapters

| Task Range | Primary Chapters | Content Contribution |
|------------|------------------|---------------------|
| T1-T12: AWS Services | Chapter 2 | Service capabilities, 2025 updates |
| T13-T20: Architecture | Chapters 3, 4, 5 | Multi-account design, governance |
| T21-T26: Container Security | Chapter 6 | Trivy integration, fallback |
| T27-T31: Cost Analysis | Chapter 8 | Pricing models, optimization |
| T32-T37: Reporting & IaC | Chapters 7, 9, Appendices | Analytics, implementation |
| T38-T42: Synthesis | Chapters 1, 10 | Executive summary, conclusions |

---

## Chapter-by-Chapter Synthesis Plans

### Chapter 1: Executive Summary and Introduction

**Word Target**: 3,000-4,000 words
**Citation Target**: 15-20 sources
**Writing Agent**: introduction-writer

#### Research Questions Addressed
- **Q6** (Primary): Why use Security Hub as central aggregation vs alternatives
- **Q1** (Partial): Security Hub 2025 overview (detailed in Chapter 2)
- **Q18** (Partial): Cost-effectiveness thesis introduction

#### Constructs to Define/Use
| Construct | Usage | First Mention |
|-----------|-------|---------------|
| AWS Security Hub | Overview definition | Section 1.2.3 |
| CSPM | Concept introduction | Section 1.1.2 |

#### Anti-Patterns to Highlight
| Anti-Pattern | Treatment |
|--------------|-----------|
| #5: Over-Reliance on Third-Party CSPM | Introduce AWS-native value proposition |
| #4: Ignoring 2025 Changes | Emphasise paradigm shift in Security Hub |

#### Research Tasks Feeding This Chapter
| Task | Content Contribution |
|------|---------------------|
| T38: Gap analysis | Validates research completeness |
| T1: Security Hub 2025 | Provides high-level summary points |

#### Synthesis Approach
**Style**: Executive narrative with strategic framing
**Structure**: Funnel - broad context to specific solution
**Tone**: Confident, authoritative, outcome-focused

**Narrative Arc**:
1. Open with multi-account security challenge at scale
2. Introduce AWS-native security stack value proposition
3. Highlight Security Hub 2025 paradigm shift
4. Preview solution architecture and cost-effectiveness
5. Set reader expectations for white paper structure

#### Quality Criteria
- [ ] Business case clearly articulated
- [ ] 2025 Security Hub changes positioned as strategic advantage
- [ ] Cost-effectiveness thesis established
- [ ] Target audience and prerequisites defined
- [ ] Chapter roadmap provided
- [ ] No technical deep dives (save for later chapters)
- [ ] 15+ citations from AWS official sources

---

#### WRITING PROMPT: Chapter 1

```
CHAPTER: 1 - Executive Summary and Introduction
AGENT: introduction-writer
WORD TARGET: 3,500 words (+/- 10%)
CITATION TARGET: 18 minimum

PURPOSE:
Establish the business case for AWS-native cloud security governance,
introduce the solution architecture at a high level, and set reader
expectations for the technical white paper.

KEY MESSAGES TO CONVEY:
1. Multi-account AWS environments (100+ accounts) face unprecedented
   security governance challenges
2. AWS Security Hub 2025 GA represents a paradigm shift from finding
   aggregation to unified cloud security with risk prioritization
3. AWS-native security stack (Security Hub, Inspector, GuardDuty,
   Detective, Security Lake) provides cost-effective, integrated solution
4. Trivy container scanning complements AWS services for comprehensive
   coverage
5. This white paper provides actionable implementation guidance

SECTION STRUCTURE:

1.1 Executive Summary (800 words)
- Business challenge: Managing security across multi-account AWS Organizations
- Solution overview: Unified AWS security stack with centralized visibility
- Key outcomes: Cost efficiency, continuous compliance, automated response
- Target audience: Cloud architects, security engineers, DevSecOps teams

1.2 Introduction to AWS Cloud Governance (1,200 words)
- The multi-account reality: Why 100+ accounts is the norm for enterprises
- Why AWS-native security services: Integration, cost, unified management
- Security Hub 2025 paradigm shift: From aggregator to unified security
- Cost-effective security at scale: Tiered pricing, consolidated services

1.3 Document Scope and Structure (500 words)
- What this white paper covers: All mentioned services, multi-account/region
- What this white paper does NOT cover: Single-account, third-party SIEM deep dives
- How to use this document: By role (architect, engineer, analyst)
- Chapter overview: Brief description of each chapter

ANTI-PATTERNS TO PREVIEW (set up for later chapters):
- #5: Over-reliance on third-party CSPM (mention AWS-native value)
- #4: Ignoring 2025 changes (highlight paradigm shift)

CONSTRUCTS TO INTRODUCE (definitions refined in Chapter 2):
- AWS Security Hub (high-level)
- CSPM (Cloud Security Posture Management)

TONE AND STYLE:
- Executive-friendly but technically grounded
- Outcome-focused (what readers will achieve)
- Confident assertions backed by AWS positioning
- Use UK English (organise, behaviour, prioritise)

CITATION REQUIREMENTS:
- AWS Security Hub GA announcement (December 2025)
- AWS Security Hub CSPM features page
- AWS Organizations best practices
- AWS Well-Architected Security Pillar
- AWS re:Invent 2025 announcements

DO NOT INCLUDE:
- Detailed technical configurations (defer to later chapters)
- Step-by-step procedures
- Code examples
- Pricing details (defer to Chapter 8)

CROSS-REFERENCES:
- "See Chapter 2 for detailed Security Hub 2025 capabilities"
- "See Chapter 8 for comprehensive cost analysis"
- "See Chapter 9 for implementation procedures"
```

---

### Chapter 2: AWS Security Services Landscape (2025)

**Word Target**: 5,000-6,000 words
**Citation Target**: 40-60 sources
**Writing Agent**: literature-review-writer

#### Research Questions Addressed
- **Q1** (Primary): Security Hub 2025 architecture and changes
- **Q2** (Partial): Service integration capabilities
- **Q5** (Partial): Security Lake OCSF introduction
- **Q16** (Primary): Unknown Security Hub 2025 changes documented

#### Constructs to Define
| Construct | Full Definition | Section |
|-----------|-----------------|---------|
| AWS Security Hub | Complete 2025 GA definition | 2.1 |
| Amazon Inspector | 2025 capabilities | 2.2 |
| Amazon GuardDuty | Extended Threat Detection | 2.3 |
| Amazon Detective | AI summaries, investigation | 2.4 |
| Amazon Security Lake | OCSF, data normalisation | 2.5 |
| CSPM | Operational definition | 2.1.1 |

#### Anti-Patterns to Highlight
| Anti-Pattern | Treatment |
|--------------|-----------|
| #4: Ignoring 2025 Changes | Document all 2025 GA features exhaustively |

#### Research Tasks Feeding This Chapter
| Task | Content Contribution |
|------|---------------------|
| T1: Security Hub 2025 GA | December 2025 features, changes |
| T3: Near real-time analytics | Risk correlation, attack paths |
| T4: Inspector coverage | Resource type matrix |
| T5: Inspector 2025 | CIS benchmarks, code scanning |
| T6: GuardDuty integration | Threat detection, Extended Threat Detection |
| T7: Detective workflows | Finding groups, AI summaries |
| T8: Security Lake OCSF | Schema, normalisation |

#### Synthesis Approach
**Style**: Comprehensive technical documentation
**Structure**: Service-by-service with 2025 emphasis
**Tone**: Authoritative, detailed, evidence-based

**Narrative Arc**:
1. Position Security Hub 2025 as evolutionary leap
2. Document each service with current capabilities
3. Highlight 2025 updates for each service
4. Show integration relationships
5. Set foundation for architecture chapter

#### Quality Criteria
- [ ] All December 2025 GA features documented
- [ ] Service capabilities tables provided
- [ ] 2025 vs previous version comparison
- [ ] Regional availability noted
- [ ] Integration points identified
- [ ] 40+ citations from AWS documentation
- [ ] One service landscape diagram

---

#### WRITING PROMPT: Chapter 2

```
CHAPTER: 2 - AWS Security Services Landscape (2025)
AGENT: literature-review-writer
WORD TARGET: 5,500 words (+/- 10%)
CITATION TARGET: 50 minimum

PURPOSE:
Provide comprehensive documentation of all AWS security services included
in the solution, with emphasis on 2025 updates and current capabilities.
This chapter serves as the technical foundation for all subsequent chapters.

KEY MESSAGES TO CONVEY:
1. Security Hub 2025 GA is a fundamental evolution, not incremental update
2. Near real-time risk analytics and signal correlation are game-changers
3. Inspector, GuardDuty, Detective form integrated threat/vulnerability stack
4. Security Lake provides standardised data layer via OCSF
5. Services designed to work together in unified architecture

SECTION STRUCTURE:

2.1 AWS Security Hub (2025 GA) (1,500 words)
2.1.1 Evolution from CSPM to Unified Cloud Security
  - Historical context: Pre-2025 Security Hub as aggregator
  - 2025 transformation: Unified cloud security solution
  - Definition of CSPM construct with operational indicators

2.1.2 Near Real-Time Risk Analytics
  - Finding correlation across GuardDuty, Inspector, CSPM
  - Risk prioritisation algorithms
  - Security score calculation methodology

2.1.3 Automatic Signal Correlation
  - How correlation identifies critical issues
  - Attack sequence detection
  - Exposure calculation

2.1.4 Attack Path Visualisation
  - Graph-based vulnerability chaining
  - Misconfiguration exploitation paths
  - Prioritisation for remediation

2.1.5 AI-Enhanced Recommendations
  - Remediation suggestions
  - AWS Security Agent (preview)
  - Generative AI integration

2.1.6 Security Score and Compliance Standards
  - Scoring methodology
  - Available standards (FSBP, CIS, NIST, PCI-DSS)
  - Control framework structure

2.2 Amazon Inspector (1,000 words)
2.2.1 Vulnerability Management Capabilities
  - Continuous scanning model
  - CVE database integration

2.2.2 Supported Resource Types
  - EC2 (agent-based and agentless)
  - ECR container images
  - Lambda functions
  - Coverage matrix table

2.2.3 2025 Updates
  - CIS Benchmark assessments
  - Code scanning capabilities
  - Enhanced container base image detection
  - AI remediation features

2.2.4 Inspector Score and Risk Adjustment
  - CVSS-based scoring
  - Environmental adjustments
  - Exploitability factors

2.2.5 Coverage Limitations and Gaps
  - Unsupported registries (sets up Trivy fallback)
  - Regional availability
  - SSM Agent requirements

2.3 Amazon GuardDuty (800 words)
2.3.1 Threat Detection Fundamentals
  - Data sources (CloudTrail, VPC Flow Logs, DNS)
  - ML-based anomaly detection
  - Threat intelligence integration

2.3.2 Finding Types and Severity
  - Classification by resource type
  - Severity scoring (0-10)
  - Confidence levels

2.3.3 Extended Threat Detection (2025)
  - Multi-stage attack correlation
  - EC2 CompromisedInstanceGroup findings
  - ECS CompromisedCluster findings
  - Attack sequence identification

2.3.4 Malware Protection Features
  - S3 scanning
  - EBS scanning
  - Pricing changes (85% reduction)

2.4 Amazon Detective (600 words)
2.4.1 Investigation Workflows
  - Automatic data correlation
  - Entity-based investigation
  - Timeline visualisation

2.4.2 Finding Groups and AI Summaries
  - Automated finding grouping
  - Generative AI investigation summaries
  - MITRE ATT&CK mapping

2.4.3 Integration with GuardDuty and Security Hub
  - Pivot from findings to investigation
  - Enriched data in Security Hub
  - Investigation API usage

2.5 Amazon Security Lake (900 words)
2.5.1 OCSF Schema and Data Normalisation
  - OCSF background and consortium
  - Schema categories and classes
  - Normalisation process

2.5.2 Native and Third-Party Source Integration
  - AWS native sources (CloudTrail, VPC Flow Logs, Security Hub)
  - Third-party ingestion patterns
  - Custom source integration

2.5.3 Subscriber Access Patterns
  - Query subscribers (Athena)
  - Data access subscribers (SIEM)
  - Cross-account access

2.5.4 Retention and Storage Options
  - Customisable retention policies
  - S3 storage tiers
  - Cost implications

CONSTRUCTS TO FULLY DEFINE:
- AWS Security Hub (with 2025 GA definition as authoritative)
- Amazon Inspector (with 2025 updates)
- Amazon GuardDuty (with Extended Threat Detection)
- Amazon Detective (with AI summaries)
- Amazon Security Lake (with OCSF)
- CSPM (operational definition)

ANTI-PATTERN ADDRESSED:
- #4: Document all 2025 changes to prevent readers from using outdated patterns

TONE AND STYLE:
- Technical depth with clear explanations
- Evidence-based claims with citations
- Feature tables for quick reference
- UK English throughout

CITATION REQUIREMENTS:
- AWS Security Hub GA blog post (December 2025)
- AWS re:Invent 2025 session transcripts
- AWS re:Inforce 2025 announcements
- Service-specific documentation pages
- What's New announcements for each service

REQUIRED TABLES:
1. Security Hub 2025 vs Previous Version Comparison
2. Inspector Resource Type Coverage Matrix
3. GuardDuty Finding Type Categories
4. Security Lake Native Source Integration Status

DIAGRAMS:
1. Service Integration Overview (showing data flows between services)

CROSS-REFERENCES:
- Forward: "See Chapter 5 for detailed Security Hub configuration"
- Forward: "See Chapter 6 for container scanning with Trivy"
- Forward: "See Chapter 7 for Security Lake analytics"
- Back: "As introduced in Chapter 1..."
```

---

### Chapter 3: Reference Architecture Overview

**Word Target**: 4,000-5,000 words
**Citation Target**: 25-35 sources
**Writing Agent**: architecture-designer

#### Research Questions Addressed
- **Q3** (Partial): Cross-account aggregation architecture
- **Q12** (Primary): Regional availability constraints
- **Q15** (Primary): Landing zone event handling
- **Q19** (Partial): Architecture invalidation risks
- **Q20** (Primary): Solutions Architect focus areas

#### Constructs to Use
| Construct | Usage | Section |
|-----------|-------|---------|
| AWS Organizations | Account hierarchy | 3.3 |
| Delegated Administrator | Security account role | 3.3.2 |
| Cross-Region Aggregation | Regional design | 3.4 |
| Cross-Account Aggregation | Account design | 3.3 |

#### Anti-Patterns to Highlight
| Anti-Pattern | Treatment |
|--------------|-----------|
| #1: Siloed Security Tools | Show centralised architecture |
| #9: Workloads in Management Account | Specify empty management account |

#### Research Tasks Feeding This Chapter
| Task | Content Contribution |
|------|---------------------|
| T13: Multi-account setup | OU structure, delegated admin |
| T14: Cross-region aggregation | Region selection, latency |
| T19: Landing zone patterns | Account structure design |
| T39: Architecture diagrams | Visual representations |

#### Synthesis Approach
**Style**: Visual-first with explanatory narrative
**Structure**: Principle-driven design documentation
**Tone**: Prescriptive, architectural, pattern-oriented

**Narrative Arc**:
1. Present 7 core principles as design drivers
2. Show high-level architecture visually
3. Detail account structure with rationale
4. Explain regional architecture decisions
5. Prepare for governance deep dive

#### Quality Criteria
- [ ] 7 core principles from step-back analysis incorporated
- [ ] Three required diagrams created
- [ ] Account hierarchy fully specified
- [ ] Regional considerations documented
- [ ] Scalability to 100+ accounts addressed
- [ ] 25+ citations
- [ ] Clear visual progression

---

#### WRITING PROMPT: Chapter 3

```
CHAPTER: 3 - Reference Architecture Overview
AGENT: architecture-designer
WORD TARGET: 4,500 words (+/- 10%)
CITATION TARGET: 30 minimum

PURPOSE:
Present the complete reference architecture for multi-account, multi-region
AWS security governance with visual diagrams and component descriptions.
This chapter translates the 7 core principles into concrete architecture.

KEY MESSAGES TO CONVEY:
1. Architecture follows 7 core principles from AWS security best practices
2. Centralised visibility with distributed execution is foundational
3. Dedicated Security account as delegated administrator
4. Management account contains no workloads (SCPs do not apply)
5. Cross-region aggregation to single home region

SECTION STRUCTURE:

3.1 Architecture Principles (1,000 words)
3.1.1 Centralized Visibility with Distributed Execution
  - Findings aggregate centrally, controls execute locally
  - 5-minute target for finding visibility
  - Bidirectional sync for updates

3.1.2 Defence in Depth Through Service Layering
  - Multiple overlapping services (GuardDuty, Inspector, CSPM)
  - No single service catches everything
  - Fallback patterns (Trivy when Inspector unavailable)

3.1.3 Cost Efficiency Through Consolidation
  - Native services preferred over third-party
  - Tiered organisation pricing
  - <$10/account/month target for core CSPM

3.1.4 Automation-First Governance
  - IaC for all security controls
  - Automated remediation for high-severity
  - MTTR <24 hours for critical findings

3.1.5 Open Standards (OCSF/ASFF)
  - OCSF for Security Lake normalisation
  - ASFF for Security Hub findings
  - Portability and SIEM integration

3.1.6 Least Privilege and Secure-by-Default
  - Root access management (no root credentials)
  - Management account isolation
  - SCP-based guardrails

3.1.7 Continuous Compliance
  - Multiple framework support (CIS, NIST, PCI-DSS)
  - 85%+ control pass rate target
  - 7+ year retention for audit

3.2 High-Level Architecture Diagram (1,200 words)
3.2.1 Multi-Account Structure
  - AWS Organizations overview
  - OU hierarchy visualisation
  - Account type classification

3.2.2 Service Deployment Model
  - Which services in which accounts
  - Delegated administrator assignments
  - Service integration points

3.2.3 Data Flow: Findings to Aggregation
  - Finding generation in member accounts
  - Replication to Security account
  - Storage in Security Lake

3.2.4 Integration Points
  - Service-to-service connections
  - EventBridge for automation
  - External SIEM export paths

3.3 Account Structure (1,200 words)
3.3.1 Management Account (Governance Only)
  - Purpose: AWS Organizations management only
  - NO workloads (SCPs do not apply)
  - Billing and account creation only
  - Anti-pattern #9 prevention

3.3.2 Security Account (Delegated Administrator)
  - Hosts Security Hub, GuardDuty, Inspector admin
  - Receives all aggregated findings
  - Runs investigation and response automation
  - Construct: Delegated Administrator

3.3.3 Log Archive Account (Security Lake)
  - Hosts Security Lake data
  - Long-term retention (7+ years)
  - Athena query access
  - Compliance evidence storage

3.3.4 Workload Accounts (Member Accounts)
  - Run actual applications
  - Security services enabled locally
  - Findings replicate to Security account
  - Centrally managed vs self-managed options

3.3.5 Sandbox Accounts (Considerations)
  - Lower security standards acceptable
  - Separate OU with relaxed SCPs
  - Exclude from compliance reporting

3.4 Regional Architecture (1,000 words)
3.4.1 Aggregation Region Selection
  - Choose region with most workloads
  - Cannot use disabled-by-default regions
  - Single aggregation region per organisation

3.4.2 Cross-Region Finding Replication
  - Automatic replication to aggregation region
  - <5 minute latency target
  - Bidirectional update sync
  - Construct: Cross-Region Aggregation

3.4.3 Regional Service Availability Matrix
  - Table showing service availability by region
  - Inspector, GuardDuty, Detective, Security Lake
  - Identification of gaps

3.4.4 GovCloud and China Region Considerations
  - Separate architecture partitions
  - Compliance requirements (FedRAMP, China regulations)
  - Out of scope for main architecture (noted for extension)

CORE PRINCIPLES FROM STEP-BACK ANALYSIS (00):
All 7 principles must be explicitly addressed in Section 3.1

ANTI-PATTERNS ADDRESSED:
- #1: Siloed Security Tools (centralised architecture)
- #9: Workloads in Management Account (empty management account design)

CONSTRUCTS USED:
- AWS Organizations (Section 3.3)
- Delegated Administrator (Section 3.3.2)
- Cross-Region Aggregation (Section 3.4.2)
- Cross-Account Aggregation (throughout)

REQUIRED DIAGRAMS (3 minimum):
1. High-Level Architecture Diagram
   - Shows all account types (Management, Security, Log Archive, Workload)
   - Shows all services (Security Hub, GuardDuty, Inspector, Detective, Security Lake)
   - Shows data flows between accounts
   - Shows integration with external systems (Trivy via GitHub Actions)

2. Data Flow Diagram
   - Finding generation sources (GuardDuty, Inspector, Config, Trivy)
   - Replication to Security Hub
   - Aggregation to Security account
   - Storage in Security Lake
   - Query via Athena

3. Multi-Region Deployment Diagram
   - Aggregation region designation
   - Linked regions with finding replication
   - Service deployment per region
   - Cross-region data flow

TONE AND STYLE:
- Prescriptive and opinionated (this IS the recommended architecture)
- Visual-first (diagrams drive narrative)
- Pattern-oriented (reusable design patterns)
- UK English throughout

CITATION REQUIREMENTS:
- AWS Security Reference Architecture
- AWS Organizations best practices
- AWS Well-Architected Security Pillar
- Cross-region aggregation documentation
- AWS Landing Zone guidance

CROSS-REFERENCES:
- Back: "Based on services described in Chapter 2..."
- Forward: "See Chapter 4 for governance mechanisms..."
- Forward: "See Chapter 5 for Security Hub configuration..."
- Forward: "See Chapter 9 for implementation procedures..."
```

---

### Chapter 4: Multi-Account Governance Framework

**Word Target**: 5,000-6,000 words
**Citation Target**: 30-40 sources
**Writing Agent**: methodology-writer

#### Research Questions Addressed
- **Q9** (Primary): Governance at 100+ accounts
- **Q11** (Primary): Delegated admin responsibilities
- **Q13** (Partial): Compliance framework governance
- **Q14** (Primary): IAM/SCP requirements
- **Q15** (Partial): Landing zone event handling

#### Constructs to Define/Use
| Construct | Definition | Section |
|-----------|------------|---------|
| AWS Organizations | Full definition | 4.1 |
| Delegated Administrator | Detailed model | 4.2 |
| Security Control | Types and implementation | 4.3 |

#### Anti-Patterns to Highlight
| Anti-Pattern | Treatment |
|--------------|-----------|
| #1: Siloed Tools | Delegated admin model |
| #7: Manual Enrollment | Auto-enable patterns |
| #9: Management Account Workloads | OU design guidance |

#### Research Tasks Feeding This Chapter
| Task | Content Contribution |
|------|---------------------|
| T13: Multi-account setup | OU structure |
| T15: SCP library | SCP examples |
| T18: IAM roles | Permission model |
| T19: Landing zone patterns | Account design |

#### Synthesis Approach
**Style**: Prescriptive governance documentation
**Structure**: Hierarchical (Org > OU > Account > Policy)
**Tone**: Authoritative, compliance-focused

---

#### WRITING PROMPT: Chapter 4

```
CHAPTER: 4 - Multi-Account Governance Framework
AGENT: methodology-writer
WORD TARGET: 5,500 words (+/- 10%)
CITATION TARGET: 35 minimum

PURPOSE:
Detail the governance mechanisms for managing security across 100+ AWS
accounts using Organizations, SCPs, and delegated administration. This
chapter provides the policy framework that enables the architecture.

KEY MESSAGES TO CONVEY:
1. AWS Organizations is the foundation for multi-account governance
2. Delegated Administrator pattern isolates security from management account
3. SCPs provide preventive controls that work at scale
4. Central configuration enables consistent security across all accounts
5. Full IAM language support (2025) enables sophisticated SCP design

SECTION STRUCTURE:

4.1 AWS Organizations Structure (1,200 words)
4.1.1 Organisational Unit (OU) Design
  - Recommended OU hierarchy for security
  - Security OU, Workloads OU, Sandbox OU
  - OU-based SCP inheritance

4.1.2 Account Provisioning Strategy
  - Programmatic account creation
  - Account Factory patterns
  - Baseline security controls

4.1.3 Account Factory Considerations
  - AWS Control Tower integration
  - Customizations for account baseline
  - Security service auto-enablement

4.1.4 Scaling to 100+ Accounts
  - Performance considerations
  - Limit monitoring
  - Account hierarchy depth

4.2 Delegated Administrator Model (1,200 words)
4.2.1 Designating Security Account as Delegated Admin
  - Step-by-step delegation process
  - Service-specific delegation
  - Construct: Delegated Administrator (full definition)

4.2.2 Services Supporting Delegated Administration
  - Security Hub, GuardDuty, Inspector, Detective
  - AWS Config, Firewall Manager
  - Service-by-service configuration

4.2.3 Cross-Account Permissions and IAM
  - Delegated admin IAM roles
  - Member account trust relationships
  - Least privilege principles

4.2.4 Centrally Managed vs Self-Managed Accounts
  - When to use central management
  - When to allow self-management
  - Hybrid approaches

4.3 Service Control Policies (SCPs) (1,500 words)
4.3.1 SCP Design Principles
  - Broad Allow + targeted Deny pattern
  - Condition keys usage
  - Resource-based vs identity-based
  - Construct: Security Control (types and classification)

4.3.2 Security Service Protection SCPs
  - Prevent disabling GuardDuty
  - Prevent disabling Security Hub
  - Prevent disabling Config
  - Prevent disabling CloudTrail
  - Code examples for each

4.3.3 Privilege Escalation Prevention
  - Prevent IAM:* on sensitive roles
  - Prevent STS assume role abuse
  - Prevent cross-account privilege escalation

4.3.4 Full IAM Language Support (2025)
  - New capabilities in SCP policy language
  - Complex conditions now possible
  - Resource ARN patterns in SCPs

4.3.5 SCP Library Reference
  - 10+ SCP examples with explanations
  - Reference to Appendix C for complete library
  - Testing and validation guidance

4.4 Central Configuration (1,200 words)
4.4.1 Configuration Policies for Security Hub
  - Policy creation and attachment
  - Standard selection by OU
  - Control enablement/disablement

4.4.2 Auto-Enable for New Accounts
  - Automatic security service enablement
  - Configuration inheritance
  - Override capabilities

4.4.3 Standard and Control Configuration
  - Default standards by account type
  - Control customisation
  - Exception management

4.4.4 Organisation-Wide Defaults
  - Finding workflow settings
  - Severity thresholds
  - Retention policies

ANTI-PATTERNS ADDRESSED:
- #1: Siloed Security Tools (centralised delegated admin)
- #7: Manual Member Account Enrollment (auto-enable patterns)
- #9: Workloads in Management Account (OU design prevents this)

CONSTRUCTS DEFINED:
- AWS Organizations (operational definition with indicators)
- Delegated Administrator (complete model)
- Security Control (types: preventive, detective, corrective)

CODE EXAMPLES REQUIRED (5 minimum):
1. SCP: Prevent GuardDuty disablement
2. SCP: Prevent Security Hub disablement
3. SCP: Prevent CloudTrail deletion
4. SCP: Prevent privilege escalation
5. IAM: Delegated admin role trust policy

TONE AND STYLE:
- Prescriptive governance guidance
- Compliance-oriented
- Policy-as-code emphasis
- UK English throughout

CITATION REQUIREMENTS:
- AWS Organizations documentation
- SCP examples from AWS
- Security Reference Architecture
- Full IAM language support announcement
- Control Tower documentation

CROSS-REFERENCES:
- Back: "As shown in Chapter 3 architecture..."
- Forward: "See Chapter 5 for Security Hub configuration..."
- Forward: "See Appendix C for complete SCP library..."
```

---

### Chapter 5: Security Hub Configuration and Integration

**Word Target**: 6,000-7,000 words
**Citation Target**: 35-50 sources
**Writing Agent**: technical-writer-hub

#### Research Questions Addressed
- **Q1** (Detailed): Security Hub 2025 configuration
- **Q2** (Primary): Service integration architecture
- **Q3** (Detailed): Cross-account aggregation setup
- **Q10** (Partial): Reporting via Security Hub
- **Q13** (Detailed): Compliance framework configuration
- **Q16** (Addressed): 2025 changes in configuration

#### Constructs to Define/Use
| Construct | Usage | Section |
|-----------|-------|---------|
| Security Finding | Full lifecycle | 5.5 |
| Compliance Framework | Standard enablement | 5.2 |
| ASFF | Finding format | 5.3 |
| Cross-Region Aggregation | Setup procedure | 5.1.3 |
| Cross-Account Aggregation | Setup procedure | 5.1.4 |
| Custom Actions | Response workflows | 5.4.3 |
| EventBridge | Automation integration | 5.4.4 |
| AWS Config | Integration pattern | 5.3.3 |
| IAM Access Analyzer | Integration pattern | 5.3.4 |

#### Anti-Patterns to Highlight
| Anti-Pattern | Treatment |
|--------------|-----------|
| #2: Missing Cross-Region Aggregation | Complete setup guidance |
| #8: Alert Fatigue | Automation rules, suppression |
| #10: Point-in-Time Assessments | Continuous monitoring setup |

#### Research Tasks Feeding This Chapter
| Task | Content Contribution |
|------|---------------------|
| T1: Security Hub 2025 | Feature configuration |
| T2: Cross-account aggregation | Setup procedures |
| T3: Near real-time analytics | Feature enablement |
| T10: Automation rules | Rule patterns |
| T11: Compliance frameworks | Standard configuration |
| T16: Deduplication | Finding management |

#### Synthesis Approach
**Style**: Procedural technical documentation
**Structure**: Configuration-focused with step-by-step guidance
**Tone**: Instructional, precise, actionable

---

#### WRITING PROMPT: Chapter 5

```
CHAPTER: 5 - Security Hub Configuration and Integration
AGENT: technical-writer-hub
WORD TARGET: 6,500 words (+/- 10%)
CITATION TARGET: 42 minimum

PURPOSE:
Provide detailed configuration guidance for Security Hub as the central
aggregation point, including all service integrations and automation
capabilities. This is the primary technical deep-dive chapter.

KEY MESSAGES TO CONVEY:
1. Security Hub is the central nervous system of AWS security governance
2. Cross-region and cross-account aggregation are essential from day one
3. Compliance standards provide automated continuous assessment
4. Service integrations are native and seamless
5. Automation rules enable response at scale

SECTION STRUCTURE:

5.1 Security Hub Setup (1,200 words)
5.1.1 Enabling Security Hub Across Organisation
  - Organisation-wide enablement via delegated admin
  - Auto-enable for new accounts
  - Per-region enablement requirements

5.1.2 Delegated Administrator Configuration
  - Registration process
  - Cross-account visibility
  - Configuration policy creation

5.1.3 Cross-Region Aggregation Setup
  - Designating aggregation region
  - Linking additional regions
  - Verification and testing
  - Construct: Cross-Region Aggregation (detailed)

5.1.4 Cross-Account Aggregation Setup
  - Member account enrollment
  - Auto-enable configuration
  - Construct: Cross-Account Aggregation (detailed)

5.2 Security Standards Configuration (1,200 words)
5.2.1 AWS Foundational Security Best Practices
  - Control categories
  - Enablement procedure
  - Exception handling

5.2.2 CIS AWS Foundations Benchmark (v3.0)
  - Version selection (1.2, 1.4, 3.0)
  - Control mapping to Config rules
  - Construct: Compliance Framework

5.2.3 NIST 800-53 Rev. 5
  - Control families covered
  - Gap analysis
  - Supplementary controls

5.2.4 PCI-DSS v4.0
  - Scope considerations
  - In-scope account configuration
  - Audit evidence collection

5.2.5 Custom Standards
  - Creating custom standards
  - Custom control integration
  - Organisation-specific requirements

5.3 Service Integrations (1,500 words)
5.3.1 GuardDuty Integration
  - Automatic finding forwarding
  - Severity mapping
  - Suppression coordination

5.3.2 Inspector Integration
  - Vulnerability finding format
  - Inspector Score in Security Hub
  - Coverage gap visibility

5.3.3 Config Integration
  - Config rules as CSPM controls
  - Service-linked rules
  - Custom rule integration
  - Construct: AWS Config

5.3.4 IAM Access Analyzer Integration
  - External access findings
  - Unused access findings
  - Construct: IAM Access Analyzer

5.3.5 Third-Party Integrations
  - Trivy integration preview (detailed in Chapter 6)
  - Partner product integrations
  - Custom product setup
  - Construct: ASFF (finding format requirements)

5.4 Automation Rules and Custom Actions (1,400 words)
5.4.1 Automation Rule Design Patterns
  - Rule criteria and actions
  - Priority and ordering
  - Testing automation rules

5.4.2 Finding Suppression Rules
  - False positive management
  - Environment-specific suppression
  - Anti-pattern #8 mitigation

5.4.3 Auto-Remediation Patterns
  - Security Hub to Lambda remediation
  - Common remediation examples
  - Construct: Custom Actions

5.4.4 Custom Actions and EventBridge
  - Creating custom actions
  - EventBridge rule patterns
  - Target integration (Lambda, SNS, Step Functions)
  - Construct: EventBridge

5.4.5 Lambda Remediation Examples
  - S3 public access remediation
  - Security group remediation
  - IAM policy remediation

5.5 Finding Management (1,000 words)
5.5.1 Finding Lifecycle
  - NEW, NOTIFIED, RESOLVED, SUPPRESSED states
  - Workflow state transitions
  - Construct: Security Finding (full definition)

5.5.2 Severity Classification
  - Severity labels and normalised scores
  - Response time targets by severity
  - Escalation procedures

5.5.3 Finding Deduplication Strategies
  - GuardDuty global findings (IAM findings in all regions)
  - Inspector vs Trivy overlap
  - Suppression rules for duplicates

5.5.4 Workflow States and Resolution
  - Investigation process
  - Evidence collection
  - Resolution documentation

ANTI-PATTERNS ADDRESSED:
- #2: Missing Cross-Region Aggregation (complete setup in 5.1.3)
- #8: Alert Fatigue (automation rules in 5.4)
- #10: Point-in-Time Assessments (continuous standards in 5.2)

CONSTRUCTS FULLY DEFINED:
- Security Finding (5.5.1)
- Compliance Framework (5.2.2)
- ASFF (5.3.5)
- Cross-Region Aggregation (5.1.3)
- Cross-Account Aggregation (5.1.4)
- Custom Actions (5.4.3)
- EventBridge (5.4.4)
- AWS Config (5.3.3)
- IAM Access Analyzer (5.3.4)

CODE EXAMPLES REQUIRED (3 minimum):
1. EventBridge rule for high-severity findings
2. Lambda remediation function (Python)
3. Automation rule for finding suppression

DIAGRAMS REQUIRED (2):
1. Finding Flow Diagram (generation to resolution)
2. Service Integration Diagram (all services feeding Security Hub)

TONE AND STYLE:
- Step-by-step procedural
- Console and CLI examples
- Best practices highlighted
- UK English throughout

CITATION REQUIREMENTS:
- Security Hub user guide (all sections)
- Service integration documentation
- Automation rules documentation
- Best practices guides

CROSS-REFERENCES:
- Back: "Based on architecture in Chapter 3..."
- Back: "Using governance from Chapter 4..."
- Forward: "See Chapter 6 for Trivy integration..."
- Forward: "See Chapter 9 for Terraform modules..."
```

---

### Chapter 6: Container Security with Trivy and Inspector

**Word Target**: 5,000-6,000 words
**Citation Target**: 30-40 sources
**Writing Agent**: technical-writer-containers

#### Research Questions Addressed
- **Q4** (Primary): Trivy GitHub Actions workflow
- **Q8** (Primary): Trivy fallback criteria
- **Q17** (Primary): Trivy vs Inspector comparison

#### Constructs to Define/Use
| Construct | Definition | Section |
|-----------|------------|---------|
| Trivy | Full definition | 6.3 |
| GitHub Actions | Workflow context | 6.3 |
| ASFF | Template usage | 6.3.3 |

#### Anti-Patterns to Highlight
| Anti-Pattern | Treatment |
|--------------|-----------|
| #3: No Container Fallback | Complete Trivy fallback architecture |

#### Research Tasks Feeding This Chapter
| Task | Content Contribution |
|------|---------------------|
| T21: Trivy GitHub Actions | Workflow design |
| T22: Trivy ASFF | Template customisation |
| T23: Trivy EC2 fallback | Fallback patterns |
| T24: Inspector vs Trivy | Comparison matrix |
| T25: Registry support | Coverage matrix |
| T26: Container validation | Quality gate |

#### Synthesis Approach
**Style**: Integration-focused technical documentation
**Structure**: Decision matrix + implementation guide
**Tone**: Practical, workflow-oriented

---

#### WRITING PROMPT: Chapter 6

```
CHAPTER: 6 - Container Security with Trivy and Inspector
AGENT: technical-writer-containers
WORD TARGET: 5,500 words (+/- 10%)
CITATION TARGET: 35 minimum

PURPOSE:
Document the complete container security strategy including Trivy CI/CD
integration, Inspector runtime scanning, and the fallback architecture.
This chapter addresses the core requirement for Trivy integration.

KEY MESSAGES TO CONVEY:
1. Trivy and Inspector are complementary, not competing tools
2. Trivy for shift-left CI/CD scanning, Inspector for runtime monitoring
3. Trivy EC2 fallback covers Inspector gaps
4. Deduplication strategy prevents alert fatigue
5. ASFF format enables seamless Security Hub integration

SECTION STRUCTURE:

6.1 Container Security Strategy (800 words)
6.1.1 Shift-Left vs Runtime Scanning
  - CI/CD scanning (prevention)
  - Registry scanning (detection)
  - Runtime scanning (monitoring)

6.1.2 Inspector and Trivy Complementary Model
  - When to use each tool
  - Overlapping and unique coverage
  - Unified visibility in Security Hub

6.1.3 Decision Matrix: When to Use Which Tool
  - Table: Scenario vs Recommended Tool
  - CI/CD pipeline: Trivy
  - ECR images: Inspector
  - Non-ECR registries: Trivy
  - EC2 containers without SSM: Trivy

6.1.4 Coverage Gap Analysis
  - Inspector limitations documented
  - Trivy coverage for gaps
  - Unified coverage matrix

6.2 Amazon Inspector for Containers (1,000 words)
6.2.1 ECR Image Scanning
  - Automatic scanning on push
  - Rescan triggers
  - Coverage dashboard

6.2.2 ECS and EKS Integration
  - Task/pod to image mapping
  - Deployment footprint tracking
  - Vulnerability prioritisation by deployment

6.2.3 EC2-Based Container Scanning
  - SSM Agent requirement
  - Agentless scanning option
  - Coverage limitations

6.2.4 Agentless vs Agent-Based Scanning
  - Comparison table
  - When to use each
  - Configuration requirements

6.2.5 Inspector Limitations and Gaps
  - Non-ECR registry gap
  - Private registry gap
  - Regional availability gaps
  - Sets up Trivy fallback necessity

6.3 Trivy GitHub Actions Integration (1,500 words)
6.3.1 GitHub Actions Workflow Design
  - Trigger events (push, pull_request)
  - Job structure
  - OIDC authentication to AWS
  - Construct: GitHub Actions

6.3.2 Trivy Action Configuration
  - aquasecurity/trivy-action usage
  - Scan types (image, fs, repo)
  - Severity thresholds
  - Construct: Trivy (full definition)

6.3.3 ASFF Output Template
  - Template structure
  - Required fields mapping
  - AWS account and region context
  - Construct: ASFF (template usage)

6.3.4 Security Hub BatchImportFindings
  - API call structure
  - IAM permissions required
  - Error handling
  - Rate limiting considerations

6.3.5 Complete Workflow YAML Reference
  - Full workflow example
  - Environment variables
  - Secrets management
  - Reference to Appendix E

6.3.6 Self-Hosted vs GitHub-Hosted Runners
  - Use cases for each
  - Security considerations
  - Network connectivity requirements

6.4 Trivy EC2 Fallback Pattern (1,200 words)
6.4.1 When to Use EC2 Fallback
  - Inspector unavailable scenarios
  - On-host container scanning
  - Runtime vulnerability detection

6.4.2 Architecture: Scheduled vs Event-Driven
  - EventBridge scheduled rules
  - Container deployment triggers
  - On-demand API invocation

6.4.3 SSM Run Command Integration
  - Trivy installation via SSM
  - Scanning execution
  - Result collection

6.4.4 EventBridge Trigger Patterns
  - Container start events
  - Scheduled scanning
  - Manual trigger option

6.4.5 Security Hub Integration from EC2
  - CLI-based BatchImportFindings
  - Instance role permissions
  - Finding attribution

6.5 Finding Deduplication (700 words)
6.5.1 Inspector + Trivy Overlap
  - Same CVE from both sources
  - Image-based vs host-based context

6.5.2 CVE Matching Strategy
  - CVE ID as deduplication key
  - Resource context consideration
  - Finding ID generation

6.5.3 Deduplication Implementation
  - Suppression rules in Security Hub
  - Source prioritisation (Inspector primary)
  - Custom automation for dedup

ANTI-PATTERN ADDRESSED:
- #3: No Fallback for Container Scanning (complete Trivy fallback in 6.4)

CONSTRUCTS FULLY DEFINED:
- Trivy (6.3.2)
- GitHub Actions (6.3.1)
- ASFF (template usage in 6.3.3)

CODE EXAMPLES REQUIRED (5 minimum):
1. Complete GitHub Actions workflow YAML
2. ASFF output template (asff.tpl)
3. BatchImportFindings CLI command
4. SSM Run Command document for Trivy
5. EventBridge rule for scheduled scanning

DECISION MATRIX TABLE:
| Scenario | Primary Tool | Fallback | Rationale |
|----------|--------------|----------|-----------|
| CI/CD pipeline | Trivy | N/A | Shift-left before deployment |
| ECR images | Inspector | Trivy | Native integration |
| DockerHub images | Trivy | N/A | Inspector does not support |
| GHCR images | Trivy | N/A | Inspector does not support |
| EC2 + SSM | Inspector | Trivy | Agent-based preferred |
| EC2 no SSM | Trivy | N/A | Only option |
| ECS Fargate | Inspector | Trivy | Native integration |
| EKS | Inspector | Trivy | Native integration |

DIAGRAMS REQUIRED (2):
1. Container Scanning Architecture (Trivy + Inspector integration)
2. Trivy EC2 Fallback Architecture (EventBridge, SSM, Security Hub)

TONE AND STYLE:
- Practical implementation guidance
- Copy-paste ready code examples
- Decision-oriented
- UK English throughout

CITATION REQUIREMENTS:
- Trivy documentation
- Trivy GitHub Action repository
- AWS Security Hub Trivy integration blog
- Inspector documentation
- GitHub Actions documentation

CROSS-REFERENCES:
- Back: "Integrated with Security Hub as shown in Chapter 5..."
- Forward: "See Appendix E for complete workflow..."
- Forward: "See Chapter 8 for cost comparison..."
```

---

### Chapter 7: Security Data Lake and Analytics

**Word Target**: 4,000-5,000 words
**Citation Target**: 25-35 sources
**Writing Agent**: technical-writer-analytics

#### Research Questions Addressed
- **Q5** (Primary): Security Lake OCSF schema
- **Q10** (Primary): Reporting and visualisation capabilities

#### Constructs to Define/Use
| Construct | Definition | Section |
|-----------|------------|---------|
| OCSF | Full schema definition | 7.2 |
| Athena | Query service | 7.3 |
| CloudTrail | Data source | 7.1.2 |

#### Anti-Patterns to Highlight
| Anti-Pattern | Treatment |
|--------------|-----------|
| #6: Unstructured Data Lake | Security Lake OCSF normalisation |

#### Research Tasks Feeding This Chapter
| Task | Content Contribution |
|------|---------------------|
| T8: Security Lake OCSF | Schema research |
| T9: Source integrations | Integration patterns |
| T30: Query costs | Athena optimisation |
| T32: Athena queries | Query library |
| T33: QuickSight | Dashboard patterns |
| T34: Compliance reporting | Report templates |

---

#### WRITING PROMPT: Chapter 7

```
CHAPTER: 7 - Security Data Lake and Analytics
AGENT: technical-writer-analytics
WORD TARGET: 4,500 words (+/- 10%)
CITATION TARGET: 30 minimum

PURPOSE:
Document Security Lake configuration, OCSF schema usage, and
analytics/reporting capabilities. This chapter enables long-term
security data management and compliance reporting.

KEY MESSAGES TO CONVEY:
1. Security Lake normalises all security data to OCSF for portability
2. OCSF enables cross-tool correlation and analysis
3. Athena provides serverless SQL querying
4. QuickSight enables executive dashboards
5. Long-term retention supports compliance and forensics

SECTION STRUCTURE:

7.1 Amazon Security Lake Setup (1,000 words)
7.1.1 Enabling Security Lake
  - Organisation-wide enablement
  - Delegated administrator setup
  - S3 bucket configuration

7.1.2 Source Configuration
  - AWS native sources (CloudTrail, VPC Flow Logs, Security Hub)
  - Enabling each source
  - Regional considerations
  - Construct: CloudTrail (data source context)

7.1.3 Subscriber Configuration
  - Query subscribers (Athena, OpenSearch)
  - Data access subscribers (SIEM export)
  - Cross-account subscriber access

7.1.4 Multi-Region Setup
  - Regional rollup configuration
  - Data residency considerations
  - Query federation

7.2 OCSF Schema (1,200 words)
7.2.1 Schema Categories and Classes
  - 6 event categories
  - Class hierarchy
  - Attribute definitions
  - Construct: OCSF (full definition)

7.2.2 ASFF to OCSF Mapping
  - Field correspondence table
  - Normalisation process
  - Custom field handling

7.2.3 Custom Data Ingestion
  - Custom source setup
  - OCSF event formatting
  - Ingestion API usage

7.2.4 Schema Validation
  - OCSF validator tool
  - Common validation errors
  - Troubleshooting

7.3 Analytics with Amazon Athena (1,200 words)
7.3.1 Security Lake Query Patterns
  - Table structure
  - Partition usage
  - Time-based filtering
  - Construct: Athena

7.3.2 Query Library for Common Use Cases
  - High-severity findings last 7 days
  - Findings by source
  - Compliance status trends
  - User activity investigation
  - Reference to Appendix D

7.3.3 Query Performance Optimisation
  - Partition pruning
  - Column selection
  - Result caching

7.3.4 Cost Management for Queries
  - Per-TB pricing
  - Query result reuse
  - Workgroup budgets

7.4 Reporting and Visualisation (1,000 words)
7.4.1 Security Hub Trends Dashboard
  - 1-year historical data
  - Period-over-period analysis
  - Severity breakdown

7.4.2 QuickSight Integration
  - Data source setup
  - Dashboard creation
  - Sharing and embedding

7.4.3 Executive Reporting Templates
  - Monthly security summary
  - Compliance scorecard
  - Trend analysis

7.4.4 Compliance Scorecards
  - Framework-specific views
  - Control pass rates
  - Remediation progress

7.4.5 SIEM Integration Patterns
  - S3 export to SIEM
  - Real-time streaming options
  - Subscriber access patterns

ANTI-PATTERN ADDRESSED:
- #6: Unstructured Security Data Lake (OCSF normalisation in 7.2)

CONSTRUCTS FULLY DEFINED:
- OCSF (7.2.1)
- Athena (7.3.1)
- CloudTrail (7.1.2)

CODE EXAMPLES REQUIRED (5 minimum):
1. Athena query: High-severity findings last 7 days
2. Athena query: Findings by source with count
3. Athena query: Compliance trend over time
4. Athena query: User activity investigation
5. OCSF event example (JSON)

DIAGRAMS REQUIRED (1):
1. Security Lake Architecture (sources, normalisation, subscribers)

TONE AND STYLE:
- Analytics-focused
- Query examples prominent
- Reporting best practices
- UK English throughout

CITATION REQUIREMENTS:
- Security Lake documentation
- OCSF schema specification
- Athena user guide
- QuickSight documentation

CROSS-REFERENCES:
- Back: "Data from Security Hub (Chapter 5) and container scanning (Chapter 6)..."
- Forward: "See Chapter 8 for query cost optimisation..."
- Forward: "See Appendix D for complete query library..."
```

---

### Chapter 8: Cost Optimisation Strategies

**Word Target**: 4,000-5,000 words
**Citation Target**: 20-30 sources
**Writing Agent**: cost-analyst-writer

#### Research Questions Addressed
- **Q7** (Primary): Cost drivers for each service
- **Q18** (Primary): Cost estimate accuracy

#### Constructs to Define/Use
| Construct | Definition | Section |
|-----------|------------|---------|
| Finding Volume Pricing | Detailed model | 8.1.1 |
| Data Ingestion Costs | Storage model | 8.1.5 |

#### Anti-Patterns to Highlight
| Anti-Pattern | Treatment |
|--------------|-----------|
| #5: Over-Reliance on Third-Party | Cost comparison |

#### Research Tasks Feeding This Chapter
| Task | Content Contribution |
|------|---------------------|
| T27: Security Hub pricing | 2025 pricing model |
| T28: Inspector pricing | Per-resource costs |
| T29: GuardDuty/Detective | Volume pricing |
| T30: Security Lake costs | Storage and query |
| T31: Total cost model | Enterprise estimate |
| T40: Optimisation playbook | Strategies |

---

#### WRITING PROMPT: Chapter 8

```
CHAPTER: 8 - Cost Optimisation Strategies
AGENT: cost-analyst-writer
WORD TARGET: 4,500 words (+/- 10%)
CITATION TARGET: 25 minimum

PURPOSE:
Provide comprehensive cost analysis, pricing models, and optimisation
strategies for enterprise-scale deployment. This chapter directly
addresses the "cost effective" requirement from the research query.

KEY MESSAGES TO CONVEY:
1. AWS-native security stack is significantly cheaper than third-party CSPM
2. Tiered pricing rewards scale
3. Finding deduplication reduces costs
4. Query and storage optimisation matter for Security Lake
5. ROI extends beyond direct cost savings

SECTION STRUCTURE:

8.1 Pricing Models Overview (1,200 words)
8.1.1 Security Hub 2025 Pricing
  - Essentials plan components
  - Resource-based pricing
  - Finding ingestion pricing
  - Free tier details
  - Construct: Finding Volume Pricing

8.1.2 Inspector Pricing
  - Per-instance scanning
  - Per-image scanning
  - Lambda function scanning
  - Agentless vs agent pricing

8.1.3 GuardDuty Pricing
  - Data source analysis pricing
  - Malware Protection pricing (85% reduction)
  - Extended Threat Detection

8.1.4 Detective Pricing
  - Data ingested per GB
  - Investigation costs
  - Free trial period

8.1.5 Security Lake Pricing
  - Data normalisation per GB
  - S3 storage costs
  - Athena query costs
  - Construct: Data Ingestion Costs

8.2 Cost Estimation Model (1,000 words)
8.2.1 Per-Account Cost Breakdown
  - Base cost per account
  - Variable costs by resource count
  - Finding volume impact

8.2.2 Scaling Costs: 10, 50, 100, 500 Accounts
  - Table with estimated costs
  - Economies of scale
  - Tiered pricing benefits

8.2.3 Regional Cost Multipliers
  - Multi-region cost impact
  - Aggregation region optimisation
  - Data transfer costs

8.2.4 Finding Volume Impact
  - High-severity environment costs
  - Automation impact on finding volume
  - Suppression rule cost savings

8.3 Cost Optimisation Strategies (1,500 words)
8.3.1 Finding Deduplication
  - GuardDuty global finding suppression
  - Trivy/Inspector deduplication
  - Cost savings estimate

8.3.2 Tiered Standard Enablement
  - Essential standards only for low-risk accounts
  - Full standards for production
  - Sandbox exclusion

8.3.3 GuardDuty Suppression Rules
  - Known-good pattern suppression
  - Regional finding consolidation
  - False positive elimination

8.3.4 Security Lake Retention Optimisation
  - Hot/warm/cold tiering
  - Retention by data type
  - Lifecycle policies

8.3.5 Athena Query Optimisation
  - Partition pruning
  - Column selection
  - Result caching
  - Workgroup cost controls

8.3.6 Consolidated Service Plans
  - Security Hub Essentials bundling
  - Reserved capacity options
  - Enterprise discount programs

8.3.7 Reserved Capacity Options
  - Savings Plans applicability
  - Commitment-based discounts
  - Enterprise agreements

8.4 ROI Analysis (700 words)
8.4.1 Cost vs Third-Party CSPM
  - Comparative pricing table
  - Feature parity analysis
  - Hidden cost consideration
  - Anti-pattern #5 addressed

8.4.2 Risk Reduction Value
  - Breach cost avoidance
  - Compliance penalty prevention
  - Operational efficiency

8.4.3 Operational Efficiency Gains
  - Automation time savings
  - Investigation acceleration
  - Reporting automation

ANTI-PATTERN ADDRESSED:
- #5: Over-Reliance on Third-Party CSPM (cost comparison in 8.4.1)

CONSTRUCTS FULLY DEFINED:
- Finding Volume Pricing (8.1.1)
- Data Ingestion Costs (8.1.5)

TABLES REQUIRED:
1. Service-by-Service Pricing Summary
2. Cost by Account Scale (10, 50, 100, 500 accounts)
3. Third-Party CSPM Cost Comparison
4. Optimisation Strategy Impact Table

CHARTS/DIAGRAMS REQUIRED (2):
1. Cost Breakdown by Service (pie chart)
2. Cost Scaling Curve (accounts vs monthly cost)

CALCULATOR REFERENCE:
- Reference to AWS Pricing Calculator
- Sample inputs for enterprise scenario
- Link to live calculator

TONE AND STYLE:
- Financial analysis focus
- Data-driven assertions
- Clear cost/benefit framing
- UK English throughout

CITATION REQUIREMENTS:
- AWS pricing pages (all services)
- AWS Cost Estimator documentation
- Third-party CSPM pricing (public sources)
- AWS blog posts on cost optimisation

CROSS-REFERENCES:
- Back: "Based on configurations in Chapters 5-7..."
- Forward: "See Chapter 9 for cost-conscious implementation..."
- Forward: "See Chapter 10 for ROI summary..."
```

---

### Chapter 9: Implementation Guide

**Word Target**: 5,000-6,000 words
**Citation Target**: 20-30 sources
**Writing Agent**: implementation-writer

#### Research Questions Addressed
- **Q3** (Implementation): Cross-account setup procedures
- **Q14** (Implementation): IAM/SCP deployment

#### Constructs Used
All constructs from previous chapters applied in implementation context.

#### Research Tasks Feeding This Chapter
| Task | Content Contribution |
|------|---------------------|
| T36: Terraform | Module design |
| T37: CDK | Construct design |
| T39: Diagrams | Implementation architecture |

---

#### WRITING PROMPT: Chapter 9

```
CHAPTER: 9 - Implementation Guide
AGENT: implementation-writer
WORD TARGET: 5,500 words (+/- 10%)
CITATION TARGET: 25 minimum

PURPOSE:
Provide step-by-step implementation procedures with Infrastructure as
Code examples. This chapter transforms the architecture into actionable
deployment guidance.

KEY MESSAGES TO CONVEY:
1. Implementation follows phased approach for safety
2. IaC (Terraform/CDK) ensures reproducibility
3. Validation checkpoints prevent configuration drift
4. Rollback procedures provide safety net
5. Operationalisation completes the deployment

SECTION STRUCTURE:

9.1 Prerequisites and Planning (800 words)
9.1.1 AWS Account Requirements
  - AWS Organizations enabled
  - Security account created
  - Log Archive account created
  - IAM permissions for deployment

9.1.2 IAM Permissions Checklist
  - Deployment role requirements
  - Cross-account access setup
  - Least privilege principles

9.1.3 Network Prerequisites
  - VPC considerations
  - NAT Gateway for Lambda
  - PrivateLink options

9.1.4 Implementation Timeline
  - Phased rollout schedule
  - Milestone checkpoints
  - Risk mitigation

9.2 Phase 1: Foundation (1,200 words)
9.2.1 Organizations and OU Setup
  - OU creation procedure
  - Account placement
  - Terraform: organizations module

9.2.2 Security Account Creation
  - Account provisioning
  - Baseline configuration
  - IAM role setup

9.2.3 Delegated Administrator Assignment
  - Service-by-service delegation
  - Verification steps
  - Terraform: delegation module

9.2.4 Terraform Module: Foundation
  - Module structure
  - Variable configuration
  - Output values
  - Reference to Appendix A

9.3 Phase 2: Security Services (1,200 words)
9.3.1 Security Hub Enablement
  - Organisation-wide enablement
  - Standard selection
  - Cross-region aggregation

9.3.2 GuardDuty Enablement
  - Delegated admin configuration
  - Feature selection
  - Suppression rules

9.3.3 Inspector Enablement
  - Resource type selection
  - Scanning configuration
  - Coverage verification

9.3.4 Detective Enablement
  - Membership configuration
  - Data source enablement
  - Investigation setup

9.3.5 Terraform Module: Security Services
  - Module structure
  - Service-specific configuration
  - Reference to Appendix A

9.4 Phase 3: Integration (1,200 words)
9.4.1 Cross-Region Aggregation
  - Aggregation region setup
  - Region linking
  - Verification procedures

9.4.2 Security Lake Setup
  - Source configuration
  - Subscriber setup
  - Retention policies

9.4.3 Trivy Pipeline Integration
  - GitHub Actions workflow deployment
  - AWS IAM OIDC setup
  - Workflow testing

9.4.4 Terraform Module: Integration
  - Module structure
  - Integration configuration
  - Reference to Appendix A

9.5 Phase 4: Operationalisation (1,000 words)
9.5.1 Automation Rules Deployment
  - Rule configuration
  - Priority ordering
  - Testing procedures

9.5.2 Dashboard Creation
  - QuickSight setup
  - Dashboard deployment
  - Access configuration

9.5.3 Alerting Configuration
  - SNS topic setup
  - EventBridge rules
  - Escalation procedures

9.5.4 Runbook Development
  - Investigation runbooks
  - Remediation runbooks
  - Escalation procedures

CODE EXAMPLES REQUIRED (10 minimum - Terraform):
1. Organizations OU creation
2. Delegated administrator assignment
3. Security Hub organisation enablement
4. Cross-region aggregation setup
5. GuardDuty organisation enablement
6. Inspector enablement
7. Security Lake configuration
8. GitHub OIDC provider
9. EventBridge rules for alerting
10. IAM roles for Security account

DIAGRAMS REQUIRED (2):
1. Implementation Phase Diagram (timeline view)
2. Terraform Module Dependency Diagram

TONE AND STYLE:
- Step-by-step procedural
- IaC-first approach
- Validation at each step
- UK English throughout

CITATION REQUIREMENTS:
- Terraform AWS provider documentation
- CDK documentation
- AWS implementation guides
- Best practices documentation

CROSS-REFERENCES:
- Back: "Implementing architecture from Chapter 3..."
- Back: "Using governance from Chapter 4..."
- Forward: "See Appendix A for complete Terraform..."
- Forward: "See Appendix B for CDK constructs..."
```

---

### Chapter 10: Conclusion and Recommendations

**Word Target**: 2,000-3,000 words
**Citation Target**: 10-15 sources
**Writing Agent**: conclusion-writer

#### Research Questions Addressed
- **Q19** (Primary): Architecture risks and mitigations
- **Q20** (Partial): SA focus areas synthesis
- All questions synthesised

#### Anti-Patterns Summarised
All 10 anti-patterns referenced with prevention guidance.

---

#### WRITING PROMPT: Chapter 10

```
CHAPTER: 10 - Conclusion and Recommendations
AGENT: conclusion-writer
WORD TARGET: 2,500 words (+/- 10%)
CITATION TARGET: 12 minimum

PURPOSE:
Summarise key findings, provide strategic recommendations by scenario,
and outline future considerations. This chapter provides actionable
next steps for readers.

KEY MESSAGES TO CONVEY:
1. AWS-native security stack delivers on cost-effectiveness promise
2. Architecture scales to 100+ accounts with proven patterns
3. Security Hub 2025 represents significant advancement
4. Trivy integration fills container security gaps
5. Continuous compliance is achievable with this approach

SECTION STRUCTURE:

10.1 Summary of Key Findings (800 words)
10.1.1 Architecture Achievements
  - Centralised visibility across multi-account/region
  - Defence in depth with complementary services
  - Automation-first governance validated

10.1.2 Cost-Effectiveness Validation
  - Comparison to third-party alternatives
  - Tiered pricing benefits
  - Optimisation strategies impact

10.1.3 Governance Maturity Outcomes
  - Continuous compliance achieved
  - Automated response at scale
  - Investigation acceleration

10.2 Strategic Recommendations (1,200 words)
10.2.1 For Organisations Starting Fresh
  - Enable Security Hub 2025 from day one
  - Implement delegated administrator immediately
  - Deploy Trivy CI/CD integration early

10.2.2 For Organisations Migrating from Third-Party
  - Migration path considerations
  - Parallel running period
  - Cost transition planning

10.2.3 For Organisations Expanding Scope
  - Adding accounts to existing deployment
  - Regional expansion
  - Additional standards enablement

10.2.4 Common Pitfalls to Avoid
  - All 10 anti-patterns summarised
  - Priority order for prevention
  - Quick reference table

10.3 Future Considerations (500 words)
10.3.1 AWS Roadmap Alignment
  - Known upcoming features
  - Beta/preview features to watch
  - Service evolution trends

10.3.2 Emerging Capabilities
  - AI/ML in security operations
  - Generative AI for investigation
  - Automated remediation evolution

10.3.3 Multi-Cloud Considerations
  - Security Hub as aggregator for multi-cloud
  - Third-party integration options
  - Data normalisation across clouds

10.3.4 AI/ML Security Evolution
  - AWS Security Agent (preview)
  - AI-enhanced recommendations
  - Automated threat response

ANTI-PATTERNS SUMMARY TABLE:
| # | Anti-Pattern | Prevention | Chapter Reference |
|---|--------------|------------|-------------------|
| 1 | Siloed Security Tools | Delegated admin model | Chapter 4 |
| 2 | Missing Cross-Region Aggregation | Aggregation setup | Chapter 5 |
| 3 | No Container Fallback | Trivy fallback | Chapter 6 |
| 4 | Ignoring 2025 Changes | Current documentation | Chapter 2 |
| 5 | Third-Party Over-Reliance | AWS-native focus | Chapter 8 |
| 6 | Unstructured Data Lake | Security Lake OCSF | Chapter 7 |
| 7 | Manual Enrollment | Auto-enable | Chapter 4 |
| 8 | Alert Fatigue | Automation rules | Chapter 5 |
| 9 | Management Account Workloads | Account design | Chapter 3 |
| 10 | Point-in-Time Assessments | Continuous monitoring | Chapter 5 |

TONE AND STYLE:
- Strategic and forward-looking
- Actionable recommendations
- Scenario-based guidance
- UK English throughout

CITATION REQUIREMENTS:
- AWS roadmap announcements
- Well-Architected Framework
- Industry trend reports
- Previous chapter references

CROSS-REFERENCES:
- Back: References to all previous chapters for detail
- No forward references (final chapter)
```

---

## Appendices Synthesis Plan

### Appendix A: Complete Terraform Modules

**Writing Agent**: appendix-writer
**Word Target**: 1,500-2,000 words

**Content**:
- Foundation module (Organizations, OUs, accounts)
- Security Hub module (enablement, standards, aggregation)
- GuardDuty module (organisation enablement)
- Inspector module (scanning configuration)
- Security Lake module (sources, subscribers)

**Format**: Full Terraform HCL code with comments

---

### Appendix B: Complete CDK Constructs

**Writing Agent**: appendix-writer
**Word Target**: 1,000-1,500 words

**Content**:
- Security Stack construct (all services)
- Governance construct (SCPs, Config rules)

**Format**: TypeScript CDK code with comments

---

### Appendix C: SCP Policy Library

**Writing Agent**: appendix-writer
**Word Target**: 1,000-1,500 words

**Content**:
- Security service protection SCPs (5+)
- Privilege escalation prevention SCPs (3+)
- Region restriction SCPs (2+)
- Data exfiltration prevention SCPs (2+)

**Format**: JSON policy documents with explanations

---

### Appendix D: Athena Query Library

**Writing Agent**: appendix-writer
**Word Target**: 500-800 words

**Content**:
- Finding analysis queries (5+)
- Compliance reporting queries (3+)
- Trend analysis queries (3+)
- Investigation queries (3+)

**Format**: SQL with comments

---

### Appendix E: GitHub Actions Workflow

**Writing Agent**: appendix-writer
**Word Target**: 500-800 words

**Content**:
- Complete Trivy scanning workflow
- ASFF template (asff.tpl)
- OIDC configuration

**Format**: YAML workflow with comments

---

### Appendix F: Glossary

**Writing Agent**: appendix-writer
**Word Target**: 300-500 words

**Content**: Alphabetical definitions of all 25 constructs

---

### Appendix G: Reference Links

**Writing Agent**: appendix-writer
**Word Target**: 200-300 words

**Content**: Categorised URL list of all cited sources

---

## Cross-Chapter Coherence Guidelines

### Terminology Consistency

| Term | Correct Usage | Incorrect Usage |
|------|---------------|-----------------|
| AWS Security Hub | "Security Hub" after first use | "Hub", "SH" |
| Amazon Inspector | "Inspector" after first use | "Amazon Inspector" every time |
| Cross-region aggregation | Hyphenated, lowercase | "Cross Region Aggregation" |
| CSPM | Defined in Chapter 2, used throughout | Unexplained acronym |
| OCSF | Defined in Chapter 7, referenced earlier | Unexplained acronym |
| ASFF | Defined in Chapter 5 | "AWS Finding Format" |

### Narrative Thread

The white paper follows a logical progression:

1. **Why** (Chapter 1): Business case and value proposition
2. **What** (Chapters 2-3): Services and architecture
3. **How to Govern** (Chapter 4): Governance framework
4. **How to Configure** (Chapters 5-7): Technical configuration
5. **How Much** (Chapter 8): Cost analysis
6. **How to Deploy** (Chapter 9): Implementation
7. **What Next** (Chapter 10): Recommendations

Each chapter should:
- Open with reference to previous chapter context
- Close with transition to next chapter
- Use consistent terminology
- Reference earlier constructs rather than redefining

### Citation Consistency

**Format**: APA 7th edition with URL and access date

**Example**:
> AWS. (2025, December). AWS Security Hub now generally available with
> near real-time analytics and risk prioritization. AWS Blog.
> https://aws.amazon.com/blogs/aws/aws-security-hub-now-generally-available/
> (Accessed: 2026-01-01)

**In-text**: (AWS, 2025) or AWS (2025) states...

### Visual Consistency

**Diagrams**:
- Use AWS Architecture Icons
- Consistent colour scheme
- Clear labels
- Legend where needed

**Tables**:
- Header row styling consistent
- Alignment consistent
- Caption format consistent

**Code Blocks**:
- Syntax highlighting
- Line numbers for reference
- Language annotation

---

## Research-to-Prose Transformation Rules

### Rule 1: Remove All Research Artifacts

**Never include in final prose**:
- Q1:, Q2:, etc. (question markers)
- FLAG:, Confidence:, Assessment:
- HYPOTHESIS TO TEST, CRITICAL UNKNOWNS
- Step-Back Analysis:, Category:, Evidence:
- Prior:, Posterior:, Likelihood:
- Bullet-point lists (convert to paragraphs)

### Rule 2: Transform Findings to Prose

**Research Input** (raw):
```
Q1: What is Security Hub 2025 architecture?
Confidence: 75%
Evidence: AWS blog, re:Invent sessions
Key Finding: Near real-time analytics with signal correlation
```

**Transformed Prose**:
> AWS Security Hub underwent a fundamental transformation in December
> 2025, evolving from a finding aggregation service to a unified cloud
> security solution (AWS, 2025). The new architecture introduces near
> real-time risk analytics that automatically correlate signals from
> GuardDuty, Inspector, and CSPM controls to identify critical security
> issues and calculate exposures within minutes of detection.

### Rule 3: Integrate Citations Naturally

**Bad** (citation dump):
> Security Hub provides many features (AWS, 2025; re:Invent, 2025; Blog, 2025; Docs, 2025).

**Good** (integrated):
> AWS announced at re:Invent 2025 that Security Hub now correlates
> signals in near real-time (AWS, 2025a). This capability, detailed in
> the updated documentation (AWS, 2025b), enables attack path
> visualisation that security teams can use to prioritise remediation.

### Rule 4: Maintain Academic Register

**Characteristics**:
- Third person ("the solution provides" not "we recommend")
- Formal vocabulary ("utilise" not "use" where appropriate)
- Hedging language ("suggests", "indicates", "may")
- No contractions ("cannot" not "can't")
- UK English spelling

### Rule 5: Paragraph Standards

**Structure**:
1. Topic sentence (claim)
2. Evidence sentences (with citations)
3. Synthesis/interpretation
4. Transition to next paragraph

**Length**: 150-300 words per paragraph

**Citation density**: 2-5 citations per paragraph for technical sections

---

## Quality Metrics Summary

| Chapter | Word Target | Citations | Diagrams | Code Examples |
|---------|-------------|-----------|----------|---------------|
| 1 | 3,500 | 18 | 0 | 0 |
| 2 | 5,500 | 50 | 1 | 0 |
| 3 | 4,500 | 30 | 3 | 0 |
| 4 | 5,500 | 35 | 1 | 5 |
| 5 | 6,500 | 42 | 2 | 3 |
| 6 | 5,500 | 35 | 2 | 5 |
| 7 | 4,500 | 30 | 1 | 5 |
| 8 | 4,500 | 25 | 2 | 1 |
| 9 | 5,500 | 25 | 2 | 10 |
| 10 | 2,500 | 12 | 0 | 0 |
| **Total** | **48,000** | **302** | **14** | **29** |

---

## Validation Checklist for Writing Agents

Before submitting chapter content, verify:

### Content Quality
- [ ] All research artifacts removed (Q1:, FLAG:, etc.)
- [ ] Findings transformed to flowing prose
- [ ] Citations integrated naturally
- [ ] Logical flow with transitions
- [ ] Anti-patterns addressed as specified

### Technical Requirements
- [ ] Word count within +/- 10% of target
- [ ] Citation count meets minimum
- [ ] Required diagrams included
- [ ] Required code examples included
- [ ] Section structure matches prompt

### Style Compliance
- [ ] UK English throughout
- [ ] No contractions
- [ ] Third person voice
- [ ] Formal register
- [ ] Consistent terminology

### Cross-Reference Accuracy
- [ ] Only valid chapter numbers (1-10)
- [ ] Only valid appendix letters (A-G)
- [ ] Backward references only to completed chapters
- [ ] Forward references use "see Chapter X" format

---

## Metadata

**Analysis Completed**: 2026-01-01
**Agent ID**: 06-chapter-synthesizer
**Workflow Position**: Agent #7 of 46
**Previous Agent**: 05-dissertation-architect
**Next Agents**: All writing agents (introduction-writer through appendix-writer)

**Synthesis Statistics**:
- Chapters mapped: 10 + 7 appendices
- Research questions mapped: 20/20 (100%)
- Constructs mapped: 25/25 (100%)
- Anti-patterns mapped: 10/10 (100%)
- Research tasks mapped: 42/42 (100%)
- Writing prompts created: 10 chapters + 7 appendices

**Memory Keys to Create**:
- `research/synthesis/chapter-mapping`: Question-to-chapter mapping
- `research/synthesis/construct-mapping`: Construct-to-chapter mapping
- `research/synthesis/writing-prompts`: All writing prompts
- `research/synthesis/quality-metrics`: Chapter quality requirements

---

## XP Earned

**Base Rewards**:
- Research question mapping (20 questions): +100 XP
- Construct mapping (25 constructs): +125 XP
- Anti-pattern mapping (10 anti-patterns): +50 XP
- Research task mapping (42 tasks): +84 XP
- Writing prompts (10 chapters): +150 XP
- Appendix prompts (7 appendices): +35 XP
- Synthesis approach per chapter: +50 XP

**Bonus Rewards**:
- Complete chapter-by-chapter plan: +100 XP
- Cross-chapter coherence guidelines: +50 XP
- Transformation rules documented: +40 XP
- Quality metrics table: +25 XP
- Validation checklist: +25 XP
- Domain-specific AWS customisation: +30 XP

**Total XP**: 864 XP
